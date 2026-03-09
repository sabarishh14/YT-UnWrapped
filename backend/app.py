import re
import os
import json
import time
import calendar
import requests
import hashlib
import psycopg2
from psycopg2.extras import RealDictCursor
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from flask import Flask, request, jsonify
from flask_cors import CORS
from dotenv import load_dotenv

# Load variables from .env file into os.environ
load_dotenv()

app = Flask(__name__)
CORS(app)

# ── Config ───────────────────────────────────────────────
YT_API_KEY     = os.environ.get("YT_API_KEY", "")
LASTFM_API_KEY = os.environ.get("LASTFM_API_KEY", "")
DATABASE_URL   = os.environ.get("DATABASE_URL", "")

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
        
    params = {
        "method": "user.getrecenttracks",
        "user": username,
        "api_key": LASTFM_API_KEY,
        "format": "json",
        "limit": 200
    }
    if from_ts:
        params["from"] = int(from_ts)
        
    new_records = []
    try:
        resp = requests.get("https://ws.audioscrobbler.com/2.0/", params=params, timeout=10)
        if resp.ok:
            tracks = resp.json().get("recenttracks", {}).get("track", [])
            if isinstance(tracks, dict):
                tracks = [tracks]
                
            for t in tracks:
                if "@attr" in t and t["@attr"].get("nowplaying"): 
                    continue # Skip currently playing track
                    
                title = t.get("name", "")
                artist = t.get("artist", {}).get("#text", "Unknown Artist")
                
                ts_unix = int(t.get("date", {}).get("uts", 0))
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
    except Exception as e:
        app.logger.warning(f"LastFM fetch error: {e}")
        
    return new_records

DEFAULT_TRACK_DURATION = 210  # 3.5 min fallback
MIN_PLAY_SECONDS       = 30   # minimum for a "play"

DURATION_CACHE: dict = {}
ARTIST_CACHE:   dict = {}

BASE_DIR     = os.path.dirname(os.path.abspath(__file__))
CACHE_FILE   = os.path.join(BASE_DIR, ".artist_cache.json")
HISTORY_FILE = os.path.join(BASE_DIR, "history.json")

JUNK_ARTISTS = {
    "release", "various artists", "various", "t-series", "sony music",
    "universal music", "warner music", "emi", "zee music", "saregama",
    "tips music", "lahari music", "audio jungles", "epidemic sound",
    "no copyright sounds", "ncs", "topic",
}

# ── Cache persistence ────────────────────────────────────

# ── Database & Cache ─────────────────────────────────────

def init_db():
    if not DATABASE_URL:
        app.logger.warning("No DATABASE_URL provided. Running in memory.")
        return
    try:
        with psycopg2.connect(DATABASE_URL) as conn:
            with conn.cursor() as cur:
                cur.execute("""
                    CREATE TABLE IF NOT EXISTS artist_cache (
                        title TEXT PRIMARY KEY,
                        meta JSONB
                    );
                    CREATE TABLE IF NOT EXISTS listens (
                        id SERIAL PRIMARY KEY,
                        username TEXT,
                        video_id TEXT,
                        title TEXT,
                        played_at TIMESTAMP WITH TIME ZONE,
                        record_data JSONB,
                        UNIQUE(username, title, played_at)
                    );
                """)
            conn.commit()
    except Exception as e:
        app.logger.error(f"DB Init Error: {e}")

init_db()

def load_cache():
    global ARTIST_CACHE
    ARTIST_CACHE = {}
    if not DATABASE_URL: return
    try:
        with psycopg2.connect(DATABASE_URL) as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("SELECT title, meta FROM artist_cache")
                for row in cur.fetchall():
                    ARTIST_CACHE[row['title']] = row['meta']
        app.logger.info(f"Loaded {len(ARTIST_CACHE)} cached artists from Neon DB")
    except Exception as e:
        app.logger.warning(f"DB Cache load error: {e}")

def save_cache():
    if not DATABASE_URL: return
    try:
        with psycopg2.connect(DATABASE_URL) as conn:
            with conn.cursor() as cur:
                for title, meta in ARTIST_CACHE.items():
                    cur.execute("""
                        INSERT INTO artist_cache (title, meta)
                        VALUES (%s, %s)
                        ON CONFLICT (title) DO UPDATE SET meta = EXCLUDED.meta;
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

def lookup_metadata(title: str, channel_artist: str) -> dict:
    """Try Saavn first, fallback to Last.fm, then default."""
    if title in ARTIST_CACHE and isinstance(ARTIST_CACHE[title], dict):
        return ARTIST_CACHE[title]

    # Polish: Aggressively strip noisy YouTube tags to get clean Saavn matches
    clean_title = re.sub(r'(?i)\(.*?lyrical.*?\)|\[.*?official.*?\]|\(.*?audio.*?\]|\(feat\..*?\)', '', title)
    clean_title = re.sub(r'\(.*?\)|\[.*?\]', '', clean_title).strip()

    # 1. Try Saavn
    try:    
        resp = requests.get(
            "https://saavn.sumit.co/api/search/songs",
            params={"query": clean_title, "limit": 10}, # Pull more results to find the best match
            timeout=6,
        )
        if resp.ok:
            results = resp.json().get("data", {}).get("results", [])
            
            # Polish: Score and sort results to prioritize Tamil tracks and exact name matches
            def score_result(r):
                score = 0
                if r.get("language") == "tamil": score += 10
                if r.get("name", "").lower() == clean_title.lower(): score += 5
                return score
                
            results.sort(key=score_result, reverse=True)
            
            for result in results:
                artists_obj = result.get("artists", {})
                all_artists_raw = artists_obj.get("all", [])
                
                artist_roles = {}
                for a in all_artists_raw:
                    name = a.get("name")
                    if name:
                        artist_roles.setdefault(name, set()).add(a.get("role", "").lower())
                
                # Strict filtering: Only keep Singers and Music Directors
                allowed_roles = {"music", "singer", "co_singer"}
                valid_artist_names = [name for name, roles in artist_roles.items() if roles.intersection(allowed_roles)]
                
                if not valid_artist_names:
                    primary = artists_obj.get("primary", [])
                    valid_artist_names = [a.get("name") for a in primary if a.get("name")]
                
                if valid_artist_names:
                    artist_str = ", ".join(valid_artist_names)
                    if artist_str and not is_junk(artist_str.split(",")[0].strip()):
                        images = result.get("image", [])
                        meta = {
                            "artist": artist_str,
                            "saavn_name": result.get("name"),
                            "album": result.get("album", {}).get("name"),
                            "duration": result.get("duration"),
                            "image": images[-1]["url"] if images else None
                        }
                        ARTIST_CACHE[title] = meta
                        return meta
    except Exception as e:
        app.logger.warning(f"[Saavn] Exception for '{clean_title}': {e}")

    # 2. Fallback to Last.fm
    lfm_meta = lookup_metadata_lastfm(clean_title, channel_artist)
    if lfm_meta:
        ARTIST_CACHE[title] = lfm_meta
        return lfm_meta

    # 3. Ultimate Fallback
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

def enrich_artists(records: list) -> None:
    seen = {}
    for r in records:
        if r["title"] not in ARTIST_CACHE and r["title"] not in seen:
            seen[r["title"]] = r["artist"]

    uncached = list(seen.items())
    
    # Update global progress state
    PROGRESS["total"] = len(uncached)
    PROGRESS["processed"] = 0
    if len(uncached) > 0:
        PROGRESS["message"] = "Fetching metadata from Saavn/Last.fm..."
    
    app.logger.info(f"Enriching {len(uncached)} new titles ({len(ARTIST_CACHE)} already cached)")

    for i, (title, channel_artist) in enumerate(uncached):
        lookup_metadata(title, channel_artist)
        PROGRESS["processed"] = i + 1  # Live update!
        if i > 0 and i % 20 == 0:
            time.sleep(0.2)

    if uncached:
        save_cache()

    PROGRESS["message"] = "Processing complete!"

    for r in records:
        meta = ARTIST_CACHE.get(r["title"], {"artist": r["artist"]})
        if isinstance(meta, str): 
            meta = {"artist": meta}
            
        r["artists"]    = split_artists(meta.get("artist", r["artist"]))
        r["artist"]     = r["artists"][0]
        r["saavn_name"] = meta.get("saavn_name")
        r["album"]      = meta.get("album")
        r["duration"]   = meta.get("duration")
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
    if not DATABASE_URL or not username:
        return []
    try:
        with psycopg2.connect(DATABASE_URL) as conn:
            with conn.cursor(cursor_factory=RealDictCursor) as cur:
                cur.execute("SELECT record_data FROM listens WHERE username = %s ORDER BY played_at ASC", (username,))
                records = []
                for row in cur.fetchall():
                    rec = row['record_data']
                    rec['timestamp'] = datetime.fromisoformat(rec['timestamp'])
                    records.append(rec)
                return records
    except Exception as e:
        app.logger.error(f"DB History load error: {e}")
        return []

def save_history(username, records):
    if not DATABASE_URL or not username:
        return
    try:
        with psycopg2.connect(DATABASE_URL) as conn:
            with conn.cursor() as cur:
                for r in records:
                    row = r.copy()
                    if isinstance(row["timestamp"], datetime):
                        row["timestamp"] = row["timestamp"].isoformat()
                    
                    cur.execute("""
                        INSERT INTO listens (username, video_id, title, played_at, record_data)
                        VALUES (%s, %s, %s, %s, %s)
                        ON CONFLICT (username, title, played_at) DO NOTHING;
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

def compute_top_songs_by_plays(records, durations):
    song_plays  = defaultdict(int)
    song_artist = {}
    for r in records:
        dur = durations.get(r["video_id"], DEFAULT_TRACK_DURATION)
        if dur >= MIN_PLAY_SECONDS:
            song_plays[r["video_id"]] += 1
            song_artist[r["video_id"]] = (r["title"], r["artist"])
    sorted_s = sorted(song_plays.items(), key=lambda x: x[1], reverse=True)
    return [{"name": song_artist[v][0], "artist": song_artist[v][1], "plays": p, "video_id": v}
            for v, p in sorted_s[:10]]

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
        ref_plays[r["video_id"]] += 1
        ref_meta[r["video_id"]] = (r["title"], r["artist"])
    for r in all_months[target_month]:
        cur_plays[r["video_id"]] += 1
    top_then = sorted(ref_plays.items(), key=lambda x: x[1], reverse=True)[:5]
    if not top_then:
        return None
    vid, pt, pn = max(top_then, key=lambda x: x[1] - cur_plays.get(x[0], 0)) + (None,)
    vid, pt = top_then[0][0], top_then[0][1]
    best_drop, best = -1, None
    for v, pt_ in top_then:
        pn_ = cur_plays.get(v, 0)
        if pt_ - pn_ > best_drop:
            best_drop, best = pt_ - pn_, (v, pt_, pn_)
    if not best:
        return None
    v, pt, pn = best
    title, artist = ref_meta[v]
    return {"song": title, "artist": artist, "video_id": v,
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
        "artist":           r["artist"],
        "album":            r.get("album"),
        "image":            r.get("image"),
        "video_id":         r["video_id"],
        "played_at":        r["timestamp"].strftime("%Y-%m-%d %H:%M"),
        "duration_seconds": durations.get(r["video_id"], DEFAULT_TRACK_DURATION),
    } for r in records]
    history.sort(key=lambda x: x["played_at"], reverse=True)
    return history

# ── Routes ───────────────────────────────────────────────

# ── Global Progress Tracker ──────────────────────────────

PROGRESS = {"message": "Idle", "processed": 0, "total": 0}

@app.route("/api/progress", methods=["GET"])
def get_progress():
    return jsonify(PROGRESS)

# ─────────────────────────────────────────────────────────
@app.route("/api/analyze", methods=["POST"])
def analyze():
    try:
        global PROGRESS
        PROGRESS["message"] = "Merging history and fetching Last.fm..."
        PROGRESS["processed"] = 0
        PROGRESS["total"] = 0
        
        body = request.get_json(force=True)
        raw_entries = body.get("entries", [])
        username = body.get("lastfm_username", "").strip()
        
        # 1. Load existing history (Empty if no username / Guest mode)
        existing_records = load_history(username)
        
        # 2. Parse new Takeout uploads if provided
        takeout_records = parse_entries(raw_entries) if raw_entries else []
        
        # 3. Merge Takeout into existing
        merged_records = merge_records(existing_records, takeout_records)
        
        # 4. Fetch new Last.fm scrobbles (Skips if no username)
        last_ts = None
        if merged_records:
            latest_record = max(merged_records, key=lambda x: x["timestamp"])
            last_ts = latest_record["timestamp"].timestamp()
            
        lfm_records = fetch_lastfm_scrobbles(username, from_ts=last_ts)
        
        # 5. Merge Last.fm scrobbles
        records = merge_records(merged_records, lfm_records)
        
        if not records:
            return jsonify({"error": "No valid entries found from Takeout or History."}), 400

        # 6. Enrich artists (Fetch Saavn data for any new songs)
        enrich_artists(records)

        # 7. Save the unified history WITH the new Saavn metadata included! (Skips if no username)
        save_history(username, records)

        # Build durations map, prioritizing Saavn's exact duration, falling back to YouTube API
        durations = {}
        yt_fetch_ids = []
        
        for r in records:
            vid = r["video_id"]
            if r.get("duration") and r["duration"] > 0:
                durations[vid] = r["duration"]
            elif vid not in durations:
                if str(vid).startswith("lfm_"):
                    # Last.fm tracks without Saavn duration get the default
                    durations[vid] = DEFAULT_TRACK_DURATION
                else:
                    yt_fetch_ids.append(vid)

        if yt_fetch_ids:
            # remove duplicates while preserving order
            yt_fetch_ids = list(dict.fromkeys(yt_fetch_ids))
            yt_durations = get_durations(yt_fetch_ids)
            durations.update(yt_durations)

        months = defaultdict(list)
        for r in records:
            months[r["year_month"]].append(r)

        monthly_stats = {}
        for mk, mrs in months.items():
            y, mo = map(int, mk.split("-"))
            total_minutes = sum(durations.get(r["video_id"], DEFAULT_TRACK_DURATION) / 60 for r in mrs)
            monthly_stats[mk] = {
                "total_plays":      len(mrs),
                "total_minutes":    round(total_minutes, 1),
                "days_active":      len(set(r["date"] for r in mrs)),
                "top_artists":      compute_top_artists_by_minutes(mrs, durations),
                "top_songs":        compute_top_songs_by_plays(mrs, durations),
                "streak":           compute_streak(mrs),
                "throwback":        compute_throwback(months, mk),
                "weekly_breakdown": compute_weekly_breakdown(mrs, durations, y, mo),
                "day_of_week":      compute_day_of_week(mrs, durations),
                "hour_heatmap":     compute_hour_heatmap(mrs, durations),
                "history":          compute_full_history(mrs, durations),
            }

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
        "cache_file":       CACHE_FILE,
    })

if __name__ == "__main__":
    app.run(debug=True, port=5000)