import re
import os
import json
import time
import calendar
import requests
import hashlib
import sqlite3
from collections import defaultdict
from concurrent.futures import ThreadPoolExecutor, as_completed
from datetime import datetime, timedelta, timezone
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv
from ytmusicapi import YTMusic

load_dotenv()

app = Flask(__name__)
CORS(app, resources={
    r"/*": {
        "origins": [
            "http://localhost:5173",
            "https://yt-un-wrapped.vercel.app" # Make sure there is NO trailing slash here!
        ],
        "methods": ["GET", "POST", "OPTIONS"],
        "allow_headers": ["Content-Type", "Authorization"]
    }
})

YT_API_KEY     = os.environ.get("YT_API_KEY", "")
LASTFM_API_KEY = os.environ.get("LASTFM_API_KEY", "")

# Setup local SQLite instead of Neon DB
BASE_DIR      = os.path.dirname(os.path.abspath(__file__))
LOCAL_DB_PATH = os.path.join(BASE_DIR, "local_data.db")

ytmusic = YTMusic()

DEFAULT_TRACK_DURATION = 210  # 3.5 min fallback
MIN_PLAY_SECONDS       = 30   # minimum for a "play"

DURATION_CACHE: dict = {}
ARTIST_CACHE:   dict = {}

JUNK_ARTISTS = {
    "release", "various artists", "various", "t-series", "sony music",
    "universal music", "warner music", "emi", "zee music", "saregama",
    "tips music", "lahari music", "audio jungles", "epidemic sound",
    "no copyright sounds", "ncs", "topic",
}

def fetch_lastfm_scrobbles(username, from_ts=None):
    if not LASTFM_API_KEY or not username:
        return []
        
    new_records = []
    page = 1
    total_pages = 1
    
    # We will fetch up to 10 pages (2,000 tracks) per sync to prevent server timeouts
    while page <= total_pages and page <= 10:
        params = {
            "method": "user.getrecenttracks",
            "user": username,
            "api_key": LASTFM_API_KEY,
            "format": "json",
            "limit": 200,
            "page": page
        }
        if from_ts:
            params["from"] = int(from_ts)
            
        try:
            resp = requests.get("https://ws.audioscrobbler.com/2.0/", params=params, timeout=10)
            if not resp.ok:
                break
                
            data = resp.json().get("recenttracks", {})
            
            # Update the total pages on the first request
            if page == 1:
                total_pages = int(data.get("@attr", {}).get("totalPages", 1))
                
            tracks = data.get("track", [])
            if isinstance(tracks, dict):
                tracks = [tracks]
                
            for t in tracks:
                if "@attr" in t and t["@attr"].get("nowplaying"): 
                    continue # Skip currently playing track
                    
                title = t.get("name", "")
                artist = t.get("artist", {}).get("#text", "Unknown Artist")
                
                # Protect against tracks missing timestamps
                uts = t.get("date", {}).get("uts")
                if not uts:
                    continue
                    
                ts_unix = int(uts)
                ts = datetime.fromtimestamp(ts_unix, tz=timezone.utc)
                
                vid = "lfm_" + hashlib.md5(f"{title}{artist}".encode()).hexdigest()[:7]
                
                new_records.append({
                    "title": title,
                    "video_id": vid,
                    "artist": artist,
                    "artists": [artist],
                    "timestamp": ts,
                    "year_month": ts.strftime("%Y-%m"),
                    "date": ts.strftime("%Y-%m-%d"),
                })
                
            page += 1
            time.sleep(0.1) # Be nice to the Last.fm API
            
        except Exception as e:
            app.logger.warning(f"LastFM fetch error on page {page}: {e}")
            break
            
    return new_records

def init_db():
    with sqlite3.connect(LOCAL_DB_PATH, timeout=15.0) as conn:
        conn.execute("PRAGMA journal_mode=WAL;")
        cur = conn.cursor()
        cur.execute("""
            CREATE TABLE IF NOT EXISTS artist_cache (
                title TEXT PRIMARY KEY,
                meta TEXT
            );
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS listens (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                username TEXT,
                video_id TEXT,
                title TEXT,
                played_at TEXT,
                record_data TEXT,
                UNIQUE(username, title, played_at)
            );
        """)
        conn.commit()

init_db()

def load_cache():
    global ARTIST_CACHE
    ARTIST_CACHE = {}
    try:
        with sqlite3.connect(LOCAL_DB_PATH) as conn:
            cur = conn.cursor()
            cur.execute("SELECT title, meta FROM artist_cache")
            for row in cur.fetchall():
                ARTIST_CACHE[row[0]] = json.loads(row[1])
        app.logger.info(f"Loaded {len(ARTIST_CACHE)} cached artists locally")
    except Exception as e:
        app.logger.warning(f"DB Cache load error: {e}")

def save_cache():
    try:
        with sqlite3.connect(LOCAL_DB_PATH) as conn:
            cur = conn.cursor()
            for title, meta in ARTIST_CACHE.items():
                cur.execute("""
                    INSERT INTO artist_cache (title, meta)
                    VALUES (?, ?)
                    ON CONFLICT(title) DO UPDATE SET meta = excluded.meta;
                """, (title, json.dumps(meta)))
            conn.commit()
    except Exception as e:
        app.logger.error(f"DB Cache save error: {e}")

load_cache()

# ── Helpers ──────────────────────────────────────────────

def is_junk(name: str) -> bool:
    return not name or name.strip().lower() in JUNK_ARTISTS

def split_artists(artist: str) -> list:
    """Split 'A & B, C feat. D' into ['A', 'B', 'C', 'D']"""
    parts = re.split(r'\s*(?:ft\.?|feat\.?|&|,|\bx\b)\s*', artist, flags=re.IGNORECASE)
    return [p.strip() for p in parts if p.strip()]

# ── YouTube Duration Fetching ────────────────────────────

def parse_iso8601_duration(s):
    m = re.match(r'PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?', s)
    if not m:
        return DEFAULT_TRACK_DURATION
    h  = int(m.group(1) or 0)
    mn = int(m.group(2) or 0)
    sc = int(m.group(3) or 0)
    return h * 3600 + mn * 60 + sc

def fetch_durations_batch(video_ids):
    if not YT_API_KEY:
        return {}
    result = {}
    for i in range(0, len(video_ids), 50):
        batch = video_ids[i:i+50]
        try:
            resp = requests.get(
                "https://www.googleapis.com/youtube/v3/videos",
                params={"key": YT_API_KEY, "id": ",".join(batch), "part": "contentDetails"},
                timeout=10,
            )
            if resp.ok:
                for item in resp.json().get("items", []):
                    dur = item["contentDetails"].get("duration", "")
                    result[item["id"]] = parse_iso8601_duration(dur) if dur else DEFAULT_TRACK_DURATION
        except Exception as e:
            app.logger.warning(f"YT API error: {e}")
        time.sleep(0.05)
    return result

def get_durations(video_ids):
    uncached = [v for v in video_ids if v not in DURATION_CACHE]
    if uncached:
        fetched = fetch_durations_batch(uncached)
        DURATION_CACHE.update(fetched)
        for v in uncached:
            if v not in DURATION_CACHE:
                DURATION_CACHE[v] = DEFAULT_TRACK_DURATION
    return {v: DURATION_CACHE.get(v, DEFAULT_TRACK_DURATION) for v in video_ids}

def lookup_metadata(title: str, channel_artist: str, video_id: str) -> dict:
    if title in ARTIST_CACHE and isinstance(ARTIST_CACHE[title], dict):
        return ARTIST_CACHE[title]

    clean_title = re.sub(r'(?i)\(.*?lyrical.*?\)|\[.*?official.*?\]|\(.*?audio.*?\]|\(feat\..*?\)', '', title)
    clean_title = re.sub(r'\(.*?\)|\[.*?\]', '', clean_title).strip()

    try:    
        best_match = None
        
        # 1. Try Exact Video ID match first (Only for YouTube Takeout records)
        if video_id and not str(video_id).startswith("lfm_"):
            watch_playlist = ytmusic.get_watch_playlist(videoId=video_id)
            tracks = watch_playlist.get("tracks", [])
            if tracks:
                best_match = tracks[0]
        
        # 2. If it's a Last.fm record, fallback to a text Search
        if not best_match:
            search_query = f"{clean_title} {channel_artist}".strip() if not is_junk(channel_artist) else clean_title
            
            # Attempt 1: Strict "songs" search
            results = ytmusic.search(search_query, filter="songs", limit=1)
            
            # Attempt 2: If that fails, it might be classified as a "video" (common for some tracks)
            if not results:
                results = ytmusic.search(search_query, filter="videos", limit=1)
                
            # Attempt 3: If STILL failing, drop the artist name and just search the title
            if not results and channel_artist:
                results = ytmusic.search(clean_title, filter="songs", limit=1)

            if results:
                best_match = results[0]

        if best_match:
            artists = [a['name'] for a in best_match.get('artists', [])]
            
            # --- NEW: Extract Music Directors and block junk like "Various Artists" ---
            music_directors = []
            album_info = best_match.get('album')
            if album_info and album_info.get('id'):
                try:
                    full_album = ytmusic.get_album(album_info['id'])
                    album_artists = [a['name'] for a in full_album.get('artists', [])]
                    
                    existing_lower = [a.lower() for a in artists]
                    for aa in album_artists:
                        if not is_junk(aa): # Blocks "Various Artists", "Release", etc.
                            music_directors.append(aa)
                            if aa.lower() not in existing_lower:
                                artists.append(aa)
                except Exception as e:
                    app.logger.warning(f"Could not fetch album info for '{clean_title}': {e}")
            
            # Fallback: if no album info, assume the channel artist is the director (if valid)
            if not music_directors and channel_artist and not is_junk(channel_artist):
                music_directors.append(channel_artist)

            # FIX: Only use Takeout string if YT Music found zero artists
            if not artists and channel_artist and not is_junk(channel_artist):
                artists.append(channel_artist)
                    
            artist_str = ", ".join(artists) if artists else "Unknown Artist"
            
            images = best_match.get('thumbnails', [])
            image_url = images[-1]['url'] if images else None
            
            duration = best_match.get('duration_seconds')
            if duration is None and best_match.get('length'):
                parts = best_match['length'].split(':')
                duration = sum(int(x) * 60 ** i for i, x in enumerate(reversed(parts)))
            
            meta = {
                "artist": artist_str,
                "saavn_name": best_match.get('title', clean_title),
                "album": album_info.get('name') if album_info else None,
                "duration": duration,
                "image": image_url,
                "real_video_id": best_match.get('videoId'),
                "music_directors": music_directors # <-- Save MDs separately!
            }
            ARTIST_CACHE[title] = meta
            return meta
    except Exception as e:
        app.logger.warning(f"[YTMusicAPI] Exception for '{clean_title}': {e}")

    # Fallback to Last.fm
    lfm_meta = lookup_metadata_lastfm(clean_title, channel_artist)
    if lfm_meta:
        ARTIST_CACHE[title] = lfm_meta
        return lfm_meta

    # Ultimate Fallback
    fallback = channel_artist if not is_junk(channel_artist) else "Unknown Artist"
    meta_fallback = {"artist": fallback}
    ARTIST_CACHE[title] = meta_fallback
    return meta_fallback

def lookup_metadata_lastfm(title: str, channel_artist: str) -> dict:
    if not LASTFM_API_KEY:
        return None
    
    queries = (
        [{"track": title, "artist": channel_artist}, {"track": title}]
        if not is_junk(channel_artist)
        else [{"track": title}]
    )

    for params in queries:
        try:
            resp = requests.get(
                "https://ws.audioscrobbler.com/2.0/",
                params={"method": "track.search", "api_key": LASTFM_API_KEY,
                        "format": "json", "limit": 1, **params},
                timeout=5,
            )
            if resp.ok:
                tracks = resp.json().get("results", {}).get("trackmatches", {}).get("track", [])
                if tracks:
                    match = tracks[0]
                    artist = match.get("artist", "").strip()
                    if artist and not is_junk(artist):
                        images = match.get("image", [])
                        image_url = None
                        if images and isinstance(images, list):
                            # Grab the largest available image from the array
                            image_url = images[-1].get("#text")
                        
                        app.logger.info(f"[LastFM] Found fallback for '{title}' → {artist}")
                        return {
                            "artist": artist,
                            "saavn_name": match.get("name"),
                            "album": None, # track.search doesn't return album info
                            "duration": None, 
                            "image": image_url if image_url else None
                        }
        except Exception as e:
            app.logger.warning(f"[LastFM] Exception for '{title}': {e}")
            
    return None

def enrich_artists(records: list, user_id: str) -> None:
    seen = {}
    for r in records:
        if r["title"] not in ARTIST_CACHE and r["title"] not in seen:
            seen[r["title"]] = (r["artist"], r["video_id"])

    uncached = [(title, art, vid) for title, (art, vid) in seen.items()]
    
    global PROGRESS
    if user_id not in PROGRESS:
        PROGRESS[user_id] = {"message": "Idle", "processed": 0, "total": 0}
        
    PROGRESS[user_id]["total"] = len(uncached)
    PROGRESS[user_id]["processed"] = 0
    if len(uncached) > 0:
        PROGRESS[user_id]["message"] = "Finding album art & high-res details..."
    
    app.logger.info(f"Enriching {len(uncached)} new titles for {user_id}...")

    # SCALED DOWN PARALLEL FETCHING (Optimized for 1GB RAM)
    with ThreadPoolExecutor(max_workers=10) as executor:
        futures = [executor.submit(lookup_metadata, title, channel_artist, vid) for title, channel_artist, vid in uncached]
        for i, future in enumerate(as_completed(futures)):
            # THIS IS THE CRITICAL LINE THAT UPDATES THE FRONTEND:
            PROGRESS[user_id]["processed"] = i + 1
            
            # Print to the terminal so you can verify the backend isn't frozen!
            if (i + 1) % 10 == 0 or (i + 1) == len(uncached):
                print(f"Processed {i+1}/{len(uncached)}")

    if uncached:
        save_cache()

    PROGRESS[user_id]["message"] = "Wrapping things up..."

    for r in records:
        meta = ARTIST_CACHE.get(r["title"], {"artist": r["artist"]})
        if isinstance(meta, str): 
            meta = {"artist": meta}
            
        r["artists"]    = split_artists(meta.get("artist", r["artist"]))
        r["artist"]     = r["artists"][0]
        r["saavn_name"] = meta.get("saavn_name")
        r["album"]      = meta.get("album")
        r["music_directors"] = meta.get("music_directors", []) # <-- ADD THIS LINE
        
        # --- NEW: Replace fake Last.fm ID with the real YouTube ID! ---
        if meta.get("real_video_id"):
            r["video_id"] = meta["real_video_id"]
        # --------------------------------------------------------------
        
        # Safely parse duration
        raw_dur = meta.get("duration")
        try:
            r["duration"] = int(raw_dur) if raw_dur else None
        except (ValueError, TypeError):
            r["duration"] = None
            
        r["image"]      = meta.get("image")
        
# ── Parsing ──────────────────────────────────────────────

def extract_video_id(url):
    if url and "watch?v=" in url:
        vid = url.split("watch?v=")[-1].split("&")[0]
        return vid if len(vid) == 11 else None
    return None

def parse_entries(raw_entries):
    records = []
    for e in raw_entries:
        if e.get("header") != "YouTube Music":
            continue
        title = e.get("title", "")
        if title.startswith("Watched "):
            title = title[8:]
        url      = e.get("titleUrl", "")
        video_id = extract_video_id(url)
        if not video_id:
            continue
        try:
            ts = datetime.fromisoformat(e["time"].replace("Z", "+00:00"))
        except Exception:
            continue

        raw_artist = ""
        subtitles  = e.get("subtitles", [])
        if subtitles:
            raw_artist = subtitles[0].get("name", "")
            raw_artist = raw_artist.replace(" - Topic", "").strip()

        artist = raw_artist or "Unknown Artist"
        records.append({
            "title":      title,
            "video_id":   video_id,
            "artist":     artist,
            "artists":    [artist],
            "timestamp":  ts,
            "year_month": ts.strftime("%Y-%m"),
            "date":       ts.strftime("%Y-%m-%d"),
        })
    return records

# ── History Persistence & Last.fm ────────────────────────

# ── History Persistence & Last.fm ────────────────────────

def load_history(username):
    if not username: return []
    try:
        with sqlite3.connect(LOCAL_DB_PATH) as conn:
            cur = conn.cursor()
            cur.execute("SELECT record_data FROM listens WHERE username = ? ORDER BY played_at ASC", (username,))
            records = []
            for row in cur.fetchall():
                rec = json.loads(row[0])
                rec['timestamp'] = datetime.fromisoformat(rec['timestamp'])
                records.append(rec)
            return records
    except Exception as e:
        app.logger.error(f"DB History load error: {e}")
        return []

def save_history(username, records):
    if not username: return
    try:
        with sqlite3.connect(LOCAL_DB_PATH) as conn:
            cur = conn.cursor()
            for r in records:
                row = r.copy()
                if isinstance(row["timestamp"], datetime):
                    row["timestamp"] = row["timestamp"].isoformat()
                
                cur.execute("""
                    INSERT OR IGNORE INTO listens (username, video_id, title, played_at, record_data)
                    VALUES (?, ?, ?, ?, ?)
                """, (
                    username, 
                    row.get("video_id"), 
                    row.get("title"), 
                    row["timestamp"], 
                    json.dumps(row)
                ))
            conn.commit()
    except Exception as e:
        app.logger.error(f"DB History save error: {e}")

def merge_records(existing, new_records):
    # Deduplicate by Title + Minute played
    seen = {f"{r['title']}_{r['timestamp'].strftime('%Y%m%d%H%M')}": True for r in existing}
    merged = list(existing)
    for r in new_records:
        key = f"{r['title']}_{r['timestamp'].strftime('%Y%m%d%H%M')}"
        if key not in seen:
            seen[key] = True
            merged.append(r)
    merged.sort(key=lambda x: x["timestamp"])
    return merged

# ── Analytics ────────────────────────────────────────────

def compute_top_artists_by_minutes(records, durations):
    artist_minutes = defaultdict(float)
    for r in records:
        dur = durations.get(r["video_id"], DEFAULT_TRACK_DURATION)
        for artist in r.get("artists", [r["artist"]]):
            artist_minutes[artist] += dur / 60
    sorted_a = sorted(artist_minutes.items(), key=lambda x: x[1], reverse=True)
    return [{"name": a, "minutes": round(m, 1)} for a, m in sorted_a[:10]]

def compute_top_music_directors(records, durations):
    md_minutes = defaultdict(float)
    for r in records:
        dur = durations.get(r["video_id"], DEFAULT_TRACK_DURATION)
        mds = r.get("music_directors") or [r["artist"]] # Fallback to artist if no MD
        for md in mds:
            md_minutes[md] += dur / 60
    sorted_md = sorted(md_minutes.items(), key=lambda x: x[1], reverse=True)
    return [{"name": a, "minutes": round(m, 1)} for a, m in sorted_md[:10]]

def compute_top_songs_by_plays(records, durations):
    song_plays  = defaultdict(int)
    song_meta = {}
    for r in records:
        dur = durations.get(r["video_id"], DEFAULT_TRACK_DURATION)
        if dur >= MIN_PLAY_SECONDS:
            # Group by Title + Artist to merge different versions of the exact same song
            title = r.get("saavn_name") or r["title"]
            key = f"{title}_{r['artist']}"
            
            song_plays[key] += 1
            if key not in song_meta:
                # Join all the featured artists back together with a comma!
                full_artist_string = ", ".join(r.get("artists", [r["artist"]]))
                song_meta[key] = {"name": title, "artist": full_artist_string, "video_id": r["video_id"]}
                
    sorted_s = sorted(song_plays.items(), key=lambda x: x[1], reverse=True)
    return [{"name": song_meta[k]["name"], "artist": song_meta[k]["artist"], "plays": p, "video_id": song_meta[k]["video_id"]}
            for k, p in sorted_s[:10]]

def compute_streak(records):
    if not records:
        return None
    artist_plays = defaultdict(int)
    for r in records:
        artist_plays[r["artist"]] += 1
    top = max(artist_plays, key=lambda a: artist_plays[a])
    dates = sorted(set(
        datetime.strptime(r["date"], "%Y-%m-%d").date()
        for r in records if r["artist"] == top
    ))
    if not dates:
        return None
    best = cur = 1
    best_s = cur_s = dates[0]
    best_e = dates[0]
    for i in range(1, len(dates)):
        if (dates[i] - dates[i-1]).days == 1:
            cur += 1
            if cur > best:
                best, best_s, best_e = cur, cur_s, dates[i]
        else:
            cur, cur_s = 1, dates[i]
    return {"artist": top, "days": best,
            "start": best_s.strftime("%b %d"), "end": best_e.strftime("%b %d")}

def compute_top_albums_by_plays(records, durations):
    album_plays = defaultdict(int)
    album_meta = {}
    for r in records:
        dur = durations.get(r["video_id"], DEFAULT_TRACK_DURATION)
        if dur >= MIN_PLAY_SECONDS and r.get("album"):
            key = f"{r['album']}_{r['artist']}"
            album_plays[key] += 1
            album_meta[key] = {"name": r["album"], "artist": r["artist"]}
            
    sorted_a = sorted(album_plays.items(), key=lambda x: x[1], reverse=True)
    return [{"name": album_meta[k]["name"], "artist": album_meta[k]["artist"], "plays": p}
            for k, p in sorted_a[:10]]

def compute_throwback(all_months, target_month):
    try:
        y, mo = map(int, target_month.split("-"))
        ref_month = (datetime(y, mo, 1) - timedelta(days=85)).strftime("%Y-%m")
    except Exception:
        return None
    if ref_month not in all_months:
        return None
        
    ref_plays, ref_meta, cur_plays = defaultdict(int), {}, defaultdict(int)
    
    for r in all_months[ref_month]:
        key = f"{r.get('saavn_name') or r['title']}_{r['artist']}"
        ref_plays[key] += 1
        ref_meta[key] = (r.get('saavn_name') or r['title'], r["artist"], r["video_id"])
        
    for r in all_months[target_month]:
        key = f"{r.get('saavn_name') or r['title']}_{r['artist']}"
        cur_plays[key] += 1
        
    top_then = sorted(ref_plays.items(), key=lambda x: x[1], reverse=True)[:5]
    if not top_then:
        return None
        
    best_drop, best = -1, None
    for k, pt_ in top_then:
        pn_ = cur_plays.get(k, 0)
        if pt_ - pn_ > best_drop:
            best_drop, best = pt_ - pn_, (k, pt_, pn_)
            
    if not best:
        return None
        
    k, pt, pn = best
    title, artist, vid = ref_meta[k]
    return {"song": title, "artist": artist, "video_id": vid,
            "plays_then": pt, "plays_now": pn, "ref_month": ref_month}

def compute_weekly_breakdown(records, durations, year, month):
    week_minutes = defaultdict(float)
    for r in records:
        wk = (r["timestamp"].day - 1) // 7 + 1
        week_minutes[wk] += durations.get(r["video_id"], DEFAULT_TRACK_DURATION) / 60
    last_day = calendar.monthrange(year, month)[1]
    return [{"week": w, "label": f"Week {w}",
             "range": f"{(w-1)*7+1}–{min(w*7, last_day)}",
             "minutes": round(week_minutes[w], 1)}
            for w in sorted(week_minutes)]

def compute_day_of_week(records, durations):
    DAYS = ["Monday","Tuesday","Wednesday","Thursday","Friday","Saturday","Sunday"]
    day_m = defaultdict(float)
    for r in records:
        day_m[r["timestamp"].weekday()] += durations.get(r["video_id"], DEFAULT_TRACK_DURATION) / 60
    return [{"day": DAYS[d], "short": DAYS[d][:3], "minutes": round(day_m[d], 1)} for d in range(7)]

def compute_hour_heatmap(records, durations):
    hour_m = defaultdict(float)
    for r in records:
        hour_m[r["timestamp"].hour] += durations.get(r["video_id"], DEFAULT_TRACK_DURATION) / 60
    return [{"hour": h, "label": f"{h:02d}:00", "minutes": round(hour_m[h], 1)} for h in range(24)]

def compute_full_history(records, durations):
    history = [{
        "title":            r.get("saavn_name") or r["title"],
        "artist":           ", ".join(r.get("artists", [r["artist"]])),  # <-- FIX: Send all featured artists!
        "album":            r.get("album"),
        "image":            r.get("image"),
        "video_id":         r["video_id"],
        "played_at":        r["timestamp"].strftime("%Y-%m-%d %H:%M"),
        "duration_seconds": durations.get(r["video_id"], DEFAULT_TRACK_DURATION),
    } for r in records]
    history.sort(key=lambda x: x["played_at"], reverse=True)
    return history

# ── Routes ───────────────────────────────────────────────

@app.route("/", methods=["GET"])
def index():
    return jsonify({
        "status": "online", 
        "message": "YT Music Unwrapped API is running smoothly!"
    })

# ── Global Progress Tracker ──────────────────────────────

PROGRESS = {}

@app.route("/api/progress", methods=["GET"])
def get_progress():
    user_id = request.args.get("user_id")
    if not user_id or user_id not in PROGRESS:
        return jsonify({"message": "Idle", "processed": 0, "total": 0})
    return jsonify(PROGRESS[user_id])

# ─────────────────────────────────────────────────────────
@app.route("/api/analyze", methods=["POST"])
def analyze():
    try:
        body = request.get_json(force=True)
        raw_entries = body.get("entries", [])
        user_id = body.get("user_id", "").strip()
        
        global PROGRESS
        PROGRESS[user_id] = {"message": "Unwrapping your listening history...", "processed": 0, "total": 0}
        lastfm_username = body.get("lastfm_username", "").strip()
        
        # 1. Load existing history using the persistent user_id!
        existing_records = load_history(user_id)
        
        # 2. Parse new Takeout uploads if provided
        takeout_records = parse_entries(raw_entries) if raw_entries else []
        
        # 3. Merge Takeout into existing
        merged_records = merge_records(existing_records, takeout_records)
        
        # 4. Fetch new Last.fm scrobbles (Skips if no lastfm_username)
        last_ts = None
        if merged_records:
            latest_record = max(merged_records, key=lambda x: x["timestamp"])
            last_ts = latest_record["timestamp"].timestamp()
            
        lfm_records = fetch_lastfm_scrobbles(lastfm_username, from_ts=last_ts) if lastfm_username else []
        print(lfm_records)
        # 5. Merge Last.fm scrobbles
        records = merge_records(lfm_records, merged_records)
        if not records:
            return jsonify({"error": "No valid entries found from Takeout or History."}), 400

        # 6. Enrich artists (Fetch Saavn data for any new songs)
        enrich_artists(records, user_id)

        # 7. Save the unified history using the persistent user_id!
        if user_id:
            save_history(user_id, records)

        # Build durations map using local cache (No more YT API fallback needed!)
        durations = {}
        for r in records:
            vid = r["video_id"]
            if r.get("duration") and r["duration"] > 0:
                durations[vid] = r["duration"]
            elif vid not in durations:
                durations[vid] = DEFAULT_TRACK_DURATION

        months = defaultdict(list)
        for r in records:
            months[r["year_month"]].append(r)

        months_sorted = sorted(months.keys())
        monthly_stats = {}
        
        # Cumulative trackers
        cumulative_plays = 0
        cumulative_minutes = 0
        cumulative_songs = set()
        cumulative_artists = set()

        for mk in months_sorted:
            mrs = months[mk]
            y, mo = map(int, mk.split("-"))
            
            # Monthly calculations
            monthly_plays = len(mrs)
            monthly_minutes = sum(durations.get(r["video_id"], DEFAULT_TRACK_DURATION) / 60 for r in mrs)
            monthly_songs = set(r["video_id"] for r in mrs)
            monthly_artists = set(r["artist"] for r in mrs)
            
            # Update cumulative totals
            cumulative_plays += monthly_plays
            cumulative_minutes += monthly_minutes
            cumulative_songs.update(monthly_songs)
            cumulative_artists.update(monthly_artists)
            
            monthly_stats[mk] = {
                "total_plays":      monthly_plays,
                "total_minutes":    round(monthly_minutes, 1),
                "unique_songs":     len(monthly_songs),
                "unique_artists":   len(monthly_artists), # New field
                "days_active":      len(set(r["date"] for r in mrs)),
                # Cumulative "Till this month" stats
                "ytd_plays":        cumulative_plays,
                "ytd_minutes":      round(cumulative_minutes, 1),
                "ytd_songs":        len(cumulative_songs),
                "ytd_artists":      len(cumulative_artists),
                # ... keep other existing fields (top_artists, streak, etc.)
                "top_artists":      compute_top_artists_by_minutes(mrs, durations),
                "top_songs":        compute_top_songs_by_plays(mrs, durations),
                "top_albums":       compute_top_albums_by_plays(mrs, durations),
                "top_music_directors": compute_top_music_directors(mrs, durations),
                "streak":           compute_streak(mrs),
                "throwback":        compute_throwback(months, mk),
                "weekly_breakdown": compute_weekly_breakdown(mrs, durations, y, mo),
                "day_of_week":      compute_day_of_week(mrs, durations),
                "hour_heatmap":     compute_hour_heatmap(mrs, durations),
                "history":          compute_full_history(mrs, durations),
            }

        # Clear the user's progress from memory to save RAM
        PROGRESS.pop(user_id, None)

        return jsonify({
            "months_available": sorted(months.keys()),
            "monthly_stats":    monthly_stats,
            "summary": {
                "total_plays":    len(records),
                "unique_artists": len(set(r["artist"] for r in records)),
                "unique_songs":   len(set(r["video_id"] for r in records)),
            },
        })

    except Exception as e:
        app.logger.error(f"Analysis error: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500

@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({
        "status":           "ok",
        "yt_api":           bool(YT_API_KEY),
        "lastfm_api":       bool(LASTFM_API_KEY),
        "cached_artists":   len(ARTIST_CACHE),
        "cached_durations": len(DURATION_CACHE),
        "cache_file":       LOCAL_DB_PATH,
    })

if __name__ == "__main__":
    app.run(debug=True, port=5000)