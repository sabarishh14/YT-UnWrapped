"""
YT Music Stats — Flask Backend
Handles: parsing, duration enrichment (YouTube Data API), and all analytics.
"""
import re
import os
import json
import time
import requests
from collections import defaultdict
from datetime import datetime, timedelta
from functools import lru_cache
from flask import Flask, request, jsonify
from flask_cors import CORS

app = Flask(__name__)
CORS(app)

# ── Config ──────────────────────────────────────────────
YT_API_KEY    = os.environ.get("YT_API_KEY", "")
LASTFM_API_KEY = os.environ.get("LASTFM_API_KEY", "")          # set this env var
DURATION_CACHE: dict = {}                               # video_id → seconds
DEFAULT_TRACK_DURATION = 210                            # 3.5 min fallback
MIN_PLAY_SECONDS = 30                                   # Spotify rule for a "play"

# ── YouTube Duration Fetching ────────────────────────────

def parse_iso8601_duration(duration_str):
    """Convert PT3M45S → seconds."""
    import re
    pattern = r'PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?'
    m = re.match(pattern, duration_str)
    if not m:
        return DEFAULT_TRACK_DURATION
    h = int(m.group(1) or 0)
    mn = int(m.group(2) or 0)
    s = int(m.group(3) or 0)
    return h * 3600 + mn * 60 + s


def fetch_durations_batch(video_ids: list[str]) -> dict:
    """Fetch durations for a batch of video IDs via YT Data API v3."""
    if not YT_API_KEY:
        return {}
    
    result = {}
    # API allows 50 IDs per request
    for i in range(0, len(video_ids), 50):
        batch = video_ids[i:i+50]
        try:
            resp = requests.get(
                "https://www.googleapis.com/youtube/v3/videos",
                params={
                    "key": YT_API_KEY,
                    "id": ",".join(batch),
                    "part": "contentDetails",
                },
                timeout=10,
            )
            if resp.ok:
                for item in resp.json().get("items", []):
                    vid_id = item["id"]
                    dur = item["contentDetails"].get("duration", "")
                    result[vid_id] = parse_iso8601_duration(dur) if dur else DEFAULT_TRACK_DURATION
        except Exception as e:
            app.logger.warning(f"YT API batch failed: {e}")
        time.sleep(0.05)  # be gentle
    
    return result


def get_durations(video_ids: list[str]) -> dict:
    """Get durations with local cache."""
    uncached = [v for v in video_ids if v not in DURATION_CACHE]
    if uncached:
        fetched = fetch_durations_batch(uncached)
        DURATION_CACHE.update(fetched)
        # For any still missing, use default
        for v in uncached:
            if v not in DURATION_CACHE:
                DURATION_CACHE[v] = DEFAULT_TRACK_DURATION
    return {v: DURATION_CACHE.get(v, DEFAULT_TRACK_DURATION) for v in video_ids}

# ── iTunes Artist Enrichment ─────────────────────────────

ARTIST_CACHE: dict = {}  # song title → enriched artist string
CACHE_FILE = os.path.join(os.path.dirname(__file__), ".artist_cache.json")

def _load_cache():
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, "r") as f:
                ARTIST_CACHE.update(json.load(f))
        except Exception:
            pass

def _save_cache():
    try:
        with open(CACHE_FILE, "w") as f:
            json.dump(ARTIST_CACHE, f, ensure_ascii=False)
        app.logger.info(f"Cache saved to {CACHE_FILE} ({len(ARTIST_CACHE)} entries)")
    except Exception as e:
        app.logger.error(f"Cache save failed: {e} — path was {CACHE_FILE}")

_load_cache()

# Labels, distributors, and junk values iTunes sometimes returns
# ARTIST_BLOCKLIST = {
#     "release", "various artists", "various", "t-series", "sony music",
#     "universal music", "warner music", "emi", "zee music", "saregama",
#     "tips music", "lahari music", "audio jungles", "epidemic sound",
#     "no copyright sounds", "ncs", "topic",
# }

# def is_junk_artist(name: str) -> bool:
#     return name.strip().lower() in ARTIST_BLOCKLIST

# def lookup_artist_itunes(title: str, fallback: str) -> str:
#     """Look up proper artist name via iTunes Search API."""
#     if title in ARTIST_CACHE:
#         return ARTIST_CACHE[title]
#     try:
#         resp = requests.get(
#             "https://itunes.apple.com/search",
#             params={"term": title, "media": "music", "limit": 5, "entity": "song"},
#             timeout=5,
#         )
#         if resp.ok:
#             results = resp.json().get("results", [])
#             for result in results:
#                 artist = result.get("artistName", "")
#                 if artist and not is_junk_artist(artist):
#                     ARTIST_CACHE[title] = artist
#                     return artist
#     except Exception:
#         pass
#     # iTunes gave nothing useful — use the raw channel fallback if it's not junk either
#     clean_fallback = fallback if not is_junk_artist(fallback) else "Unknown Artist"
#     ARTIST_CACHE[title] = clean_fallback
#     return clean_fallback

# def split_artists(artist: str) -> list[str]:
#     """Split a combined artist string into individual artist names."""
#     import re
#     parts = re.split(r'\s*(?:ft\.?|feat\.?|&|,|\bx\b)\s*', artist, flags=re.IGNORECASE)
#     return [p.strip() for p in parts if p.strip()]

# def enrich_artists_itunes(records: list) -> None:
#     """
#     Enrich artist names in-place using iTunes Search API.
#     Only fetches unique titles not already cached.
#     Batches with small delays to avoid rate limiting.
#     """
#     unique_titles = list({r["title"]: r for r in records}.keys())
#     uncached = [t for t in unique_titles if t not in ARTIST_CACHE]

#     for i, title in enumerate(uncached):
#         fallback = next((r["artist"] for r in records if r["title"] == title), "Unknown Artist")
#         lookup_artist_itunes(title, fallback)
#         # Small delay every 20 requests to be polite
#         if i > 0 and i % 20 == 0:
#             time.sleep(0.3)

#     # Persist cache to disk
#     if uncached:
#         _save_cache()

#     # Apply enriched names back, split into list of all artists
#     for r in records:
#         enriched = ARTIST_CACHE.get(r["title"], r["artist"])
#         r["artists"] = split_artists(enriched)
#         r["artist"] = r["artists"][0]  # primary, kept for display

# ── Last.fm Artist Enrichment ────────────────────────────

ARTIST_CACHE: dict = {}
CACHE_FILE = os.path.join(os.path.dirname(__file__), ".artist_cache.json")

JUNK_ARTISTS = {
    "release", "various artists", "various", "t-series", "sony music",
    "universal music", "warner music", "emi", "zee music", "saregama",
    "tips music", "lahari music", "audio jungles", "epidemic sound",
    "no copyright sounds", "ncs", "topic",
}

def _load_cache():
    if os.path.exists(CACHE_FILE):
        try:
            with open(CACHE_FILE, "r") as f:
                ARTIST_CACHE.update(json.load(f))
        except Exception:
            pass

def _save_cache():
    try:
        with open(CACHE_FILE, "w") as f:
            json.dump(ARTIST_CACHE, f, ensure_ascii=False)
    except Exception:
        pass

_load_cache()

def is_junk(name: str) -> bool:
    return not name or name.strip().lower() in JUNK_ARTISTS

def lookup_artist_lastfm(title: str, channel_artist: str) -> str:
    """
    Look up artist via Last.fm track.search.
    Falls back to channel_artist if Last.fm gives nothing useful.
    """
    if title in ARTIST_CACHE:
        return ARTIST_CACHE[title]

    if not LASTFM_API_KEY:
        result = channel_artist if not is_junk(channel_artist) else "Unknown Artist"
        ARTIST_CACHE[title] = result
        return result

    # First try: search with title + channel artist hint for precision
    # Second try: title only if first gives junk
    queries = [
        {"track": title, "artist": channel_artist},
        {"track": title},
    ] if not is_junk(channel_artist) else [{"track": title}]

    for params in queries:
        try:
            resp = requests.get(
                "https://ws.audioscrobbler.com/2.0/",
                params={
                    "method": "track.search",
                    "api_key": LASTFM_API_KEY,
                    "format": "json",
                    "limit": 5,
                    **params,
                },
                timeout=5,
            )
            if resp.ok:
                data = resp.json()
                matches = (
                    data.get("results", {})
                    .get("trackmatches", {})
                    .get("track", [])
                )
                app.logger.info(f"[LastFM] '{title}' → {[(m.get('artist'), m.get('name')) for m in matches]}")
                for match in matches:
                    artist = match.get("artist", "")
                    if artist and not is_junk(artist):
                        ARTIST_CACHE[title] = artist
                        return artist
            else:
                app.logger.warning(f"[LastFM] HTTP {resp.status_code} for '{title}'")
        except Exception as e:
            app.logger.warning(f"[LastFM] Exception for '{title}': {e}")

    # Last.fm gave nothing — use channel name if it's not junk
    fallback = channel_artist if not is_junk(channel_artist) else "Unknown Artist"
    ARTIST_CACHE[title] = fallback
    return fallback


def split_artists(artist: str) -> list[str]:
    """Split a combined artist string into individual credited artists."""
    parts = re.split(r'\s*(?:ft\.?|feat\.?|&|,|\bx\b)\s*', artist, flags=re.IGNORECASE)
    return [p.strip() for p in parts if p.strip()]


def enrich_artists_lastfm(records: list) -> None:
    """
    Enrich artist names in-place using Last.fm.
    Only fetches unique titles not already cached.
    """
    # Build unique (title, channel_artist) pairs not yet cached
    seen = {}
    for r in records:
        if r["title"] not in seen and r["title"] not in ARTIST_CACHE:
            seen[r["title"]] = r["artist"]

    uncached = list(seen.items())  # [(title, channel_artist), ...]

    for i, (title, channel_artist) in enumerate(uncached):
        lookup_artist_lastfm(title, channel_artist)
        if i > 0 and i % 20 == 0:
            time.sleep(0.2)

    if uncached:
        _save_cache()

    # Write enriched artists back to every record
    for r in records:
        enriched = ARTIST_CACHE.get(r["title"], r["artist"])
        r["artists"] = split_artists(enriched)
        r["artist"] = r["artists"][0]

# ── Parsing ──────────────────────────────────────────────

def extract_video_id(url: str) -> str | None:
    """Extract video ID from YouTube URL."""
    if not url:
        return None
    if "watch?v=" in url:
        vid = url.split("watch?v=")[-1].split("&")[0]
        return vid if len(vid) == 11 else None
    return None


def clean_title(title: str) -> str:
    """Strip 'Watched ' prefix from title."""
    if title.startswith("Watched "):
        return title[8:]
    return title


def parse_entries(raw_entries: list) -> list:
    """Parse raw Takeout JSON entries into structured records."""
    records = []
    for e in raw_entries:
        if e.get("header") != "YouTube Music":
            continue
        title = clean_title(e.get("title", ""))
        url = e.get("titleUrl", "")
        video_id = extract_video_id(url)
        if not video_id:
            continue
        
        time_str = e.get("time", "")
        try:
            ts = datetime.fromisoformat(time_str.replace("Z", "+00:00"))
        except Exception:
            continue
        
        artist = ""
        subtitles = e.get("subtitles", [])
        if subtitles:
            raw_artist = subtitles[0].get("name", "")
            # Clean " - Topic" suffix (auto-generated channels)
            artist = raw_artist.replace(" - Topic", "").strip()
        
        records.append({
            "title": title,
            "video_id": video_id,
            "artist": artist or "Unknown Artist",
            "artists": [artist or "Unknown Artist"],  # will be overwritten by enrichment
            "timestamp": ts,
            "year_month": ts.strftime("%Y-%m"),
            "date": ts.strftime("%Y-%m-%d"),
        })
    
    return records


# ── Analytics ────────────────────────────────────────────

def compute_top_artists_by_minutes(records: list, durations: dict) -> list:
    """Rank artists by total listening minutes — all collaborators get full credit."""
    artist_minutes = defaultdict(float)
    for r in records:
        dur = durations.get(r["video_id"], DEFAULT_TRACK_DURATION)
        for artist in r.get("artists", [r["artist"]]):
            artist_minutes[artist] += dur / 60

    sorted_artists = sorted(artist_minutes.items(), key=lambda x: x[1], reverse=True)
    return [{"name": a, "minutes": round(m, 1)} for a, m in sorted_artists[:10]]


def compute_top_songs_by_plays(records: list, durations: dict, top_n=5) -> list:
    """Rank songs by play count (only count plays > MIN_PLAY_SECONDS)."""
    song_plays = defaultdict(int)
    song_artist = {}
    for r in records:
        dur = durations.get(r["video_id"], DEFAULT_TRACK_DURATION)
        if dur >= MIN_PLAY_SECONDS:
            key = r["video_id"]
            song_plays[key] += 1
            song_artist[key] = (r["title"], r["artist"])
    
    sorted_songs = sorted(song_plays.items(), key=lambda x: x[1], reverse=True)
    result = []
    for vid_id, plays in sorted_songs[:10]:
        title, artist = song_artist[vid_id]
        result.append({"name": title, "artist": artist, "plays": plays, "video_id": vid_id})
    return result


def compute_streak(records: list) -> dict | None:
    """Find the longest consecutive-day streak for the top artist."""
    if not records:
        return None
    
    # Find top artist by plays
    artist_plays = defaultdict(int)
    for r in records:
        artist_plays[r["artist"]] += 1
    if not artist_plays:
        return None
    top_artist = max(artist_plays, key=lambda a: artist_plays[a])
    
    # Get unique dates for top artist
    dates = sorted(set(
        datetime.strptime(r["date"], "%Y-%m-%d").date()
        for r in records if r["artist"] == top_artist
    ))
    
    if not dates:
        return None
    
    best_streak = 1
    best_start = dates[0]
    best_end = dates[0]
    cur_streak = 1
    cur_start = dates[0]
    
    for i in range(1, len(dates)):
        if (dates[i] - dates[i-1]).days == 1:
            cur_streak += 1
            if cur_streak > best_streak:
                best_streak = cur_streak
                best_start = cur_start
                best_end = dates[i]
        else:
            cur_streak = 1
            cur_start = dates[i]
    
    return {
        "artist": top_artist,
        "days": best_streak,
        "start": best_start.strftime("%b %d"),
        "end": best_end.strftime("%b %d"),
    }


def compute_proportion(records: list, durations: dict) -> dict | None:
    """Calculate top artist's share of total listening time."""
    if not records:
        return None
    
    artist_minutes = defaultdict(float)
    total_minutes = 0.0
    for r in records:
        dur = durations.get(r["video_id"], DEFAULT_TRACK_DURATION) / 60
        artist_minutes[r["artist"]] += dur
        total_minutes += dur
    
    if total_minutes == 0:
        return None
    
    top_artist = max(artist_minutes, key=lambda a: artist_minutes[a])
    top_minutes = artist_minutes[top_artist]
    pct = round((top_minutes / total_minutes) * 100)
    
    return {
        "artist": top_artist,
        "top_artist_minutes": round(top_minutes, 1),
        "total_minutes": round(total_minutes, 1),
        "top_artist_pct": pct,
    }


def compute_throwback(all_months: dict, target_month: str) -> dict | None:
    """
    Find a song that was in the top 5 three months ago 
    but hasn't been played much since, and get its plays this month.
    """
    try:
        year, month = map(int, target_month.split("-"))
        # 3 months ago
        ref_date = datetime(year, month, 1) - timedelta(days=85)
        ref_month = ref_date.strftime("%Y-%m")
    except Exception:
        return None
    
    if ref_month not in all_months:
        return None
    
    ref_records = all_months[ref_month]
    cur_records = all_months[target_month]
    
    # Get top 5 songs from 3 months ago by play count
    ref_plays = defaultdict(int)
    ref_meta = {}
    for r in ref_records:
        ref_plays[r["video_id"]] += 1
        ref_meta[r["video_id"]] = (r["title"], r["artist"])
    
    top_then = sorted(ref_plays.items(), key=lambda x: x[1], reverse=True)[:5]
    if not top_then:
        return None
    
    # Count current plays for those songs
    cur_plays = defaultdict(int)
    for r in cur_records:
        cur_plays[r["video_id"]] += 1
    
    # Find the one with the biggest drop-off
    best = None
    best_drop = -1
    for vid_id, plays_then in top_then:
        plays_now = cur_plays.get(vid_id, 0)
        drop = plays_then - plays_now
        if drop > best_drop:
            best_drop = drop
            best = (vid_id, plays_then, plays_now)
    
    if not best:
        return None
    
    vid_id, plays_then, plays_now = best
    title, artist = ref_meta[vid_id]
    return {
        "song": title,
        "artist": artist,
        "video_id": vid_id,
        "plays_then": plays_then,
        "plays_now": plays_now,
        "ref_month": ref_month,
    }

def compute_weekly_breakdown(records: list, durations: dict, year: int, month: int) -> list:
    """Total minutes per calendar week within the month."""
    week_minutes = defaultdict(float)
    for r in records:
        ts = r["timestamp"]
        # Week number within the month (1-indexed)
        week_num = (ts.day - 1) // 7 + 1
        dur = durations.get(r["video_id"], DEFAULT_TRACK_DURATION) / 60
        week_minutes[week_num] += dur

    result = []
    for w in sorted(week_minutes.keys()):
        start_day = (w - 1) * 7 + 1
        import calendar
        last_day = calendar.monthrange(year, month)[1]
        end_day = min(w * 7, last_day)
        result.append({
            "week": w,
            "label": f"Week {w}",
            "range": f"{start_day}–{end_day}",
            "minutes": round(week_minutes[w], 1),
        })
    return result


def compute_day_of_week_breakdown(records: list, durations: dict) -> list:
    """Total minutes per day of week (Mon=0 … Sun=6)."""
    DAY_NAMES = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"]
    day_minutes = defaultdict(float)
    for r in records:
        dow = r["timestamp"].weekday()   # 0=Mon
        dur = durations.get(r["video_id"], DEFAULT_TRACK_DURATION) / 60
        day_minutes[dow] += dur

    return [
        {"day": DAY_NAMES[d], "short": DAY_NAMES[d][:3], "minutes": round(day_minutes[d], 1)}
        for d in range(7)
    ]


def compute_hour_heatmap(records: list, durations: dict) -> list:
    """Total minutes per hour of day (0–23)."""
    hour_minutes = defaultdict(float)
    for r in records:
        hr = r["timestamp"].hour
        dur = durations.get(r["video_id"], DEFAULT_TRACK_DURATION) / 60
        hour_minutes[hr] += dur

    return [
        {"hour": h, "label": f"{h:02d}:00", "minutes": round(hour_minutes[h], 1)}
        for h in range(24)
    ]


def compute_full_history(records: list, durations: dict) -> list:
    """Every play, sorted newest first, with duration."""
    history = []
    for r in records:
        dur = durations.get(r["video_id"], DEFAULT_TRACK_DURATION)
        history.append({
            "title": r["title"],
            "artist": r["artist"],
            "video_id": r["video_id"],
            "played_at": r["timestamp"].strftime("%Y-%m-%d %H:%M"),
            "duration_seconds": dur,
        })
    # newest first
    history.sort(key=lambda x: x["played_at"], reverse=True)
    return history

# ── Main Route ───────────────────────────────────────────

@app.route("/api/analyze", methods=["POST"])
def analyze():
    try:
        body = request.get_json(force=True)
        raw_entries = body.get("entries", [])
        
        if not raw_entries:
            return jsonify({"error": "No entries provided"}), 400
        
        # Parse
        records = parse_entries(raw_entries)
        if not records:
            return jsonify({"error": "Could not parse any valid YouTube Music entries"}), 400
        
        # Enrich artist names via Last.fm
        enrich_artists_lastfm(records)

        # Fetch durations for all unique video IDs
        all_video_ids = list(set(r["video_id"] for r in records))
        durations = get_durations(all_video_ids)
        
        # Group by month
        months: dict[str, list] = defaultdict(list)
        for r in records:
            months[r["year_month"]].append(r)
        
        months_available = sorted(months.keys())
        
        # Per-month analytics
        monthly_stats = {}
        for month_key, month_records in months.items():
            month_durations = {r["video_id"]: durations.get(r["video_id"], DEFAULT_TRACK_DURATION) for r in month_records}
            
            total_minutes = sum(
                durations.get(r["video_id"], DEFAULT_TRACK_DURATION) / 60
                for r in month_records
            )
            
            days_active = len(set(r["date"] for r in month_records))
            
            year_int, month_int = map(int, month_key.split("-"))
            monthly_stats[month_key] = {
                "total_plays": len(month_records),
                "total_minutes": round(total_minutes, 1),
                "days_active": days_active,
                "top_artists": compute_top_artists_by_minutes(month_records, durations),
                "top_songs": compute_top_songs_by_plays(month_records, durations),
                "streak": compute_streak(month_records),
                "throwback": compute_throwback(months, month_key),
                "weekly_breakdown": compute_weekly_breakdown(month_records, durations, year_int, month_int),
                "day_of_week": compute_day_of_week_breakdown(month_records, durations),
                "hour_heatmap": compute_hour_heatmap(month_records, durations),
                "history": compute_full_history(month_records, durations),
            }
        
        # Overall summary
        all_artists = set(r["artist"] for r in records)
        all_songs = set(r["video_id"] for r in records)
        
        return jsonify({
            "months_available": months_available,
            "monthly_stats": monthly_stats,
            "summary": {
                "total_plays": len(records),
                "unique_artists": len(all_artists),
                "unique_songs": len(all_songs),
                "date_range": {
                    "start": min(r["timestamp"].isoformat() for r in records),
                    "end": max(r["timestamp"].isoformat() for r in records),
                },
            },
        })
    
    except Exception as e:
        app.logger.error(f"Analysis error: {e}", exc_info=True)
        return jsonify({"error": str(e)}), 500


@app.route("/api/health", methods=["GET"])
def health():
    return jsonify({
        "status": "ok",
        "yt_api_configured": bool(YT_API_KEY),
        "cached_durations": len(DURATION_CACHE),
    })


if __name__ == "__main__":
    app.run(debug=True, port=5000)
