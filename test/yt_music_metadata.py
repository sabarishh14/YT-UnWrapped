#!/usr/bin/env python3
"""
YouTube Music Watch History Metadata Fetcher
---------------------------------------------
- Filters ONLY YouTube Music entries from Google Takeout watch-history.json
- Fetches accurate metadata (title, artist, album) via ytmusicapi
- Fast: parallel requests with ThreadPoolExecutor

Usage:
    pip install ytmusicapi
    python yt_music_metadata.py --input watch-history.json
    python yt_music_metadata.py --input watch-history.json --output songs.csv --workers 20
"""

import json
import csv
import argparse
import sys
import re
from pathlib import Path
from concurrent.futures import ThreadPoolExecutor, as_completed

try:
    from ytmusicapi import YTMusic
except ImportError:
    print("Missing dependency. Run:  pip install ytmusicapi")
    sys.exit(1)


def is_yt_music_entry(item: dict) -> bool:
    if item.get("header", "") == "YouTube Music":
        return True
    for sub in item.get("subtitles", []):
        if "music.youtube.com" in sub.get("url", ""):
            return True
    if "music.youtube.com" in item.get("titleUrl", ""):
        return True
    return False


def extract_video_ids(watch_history: list) -> list[dict]:
    entries = []
    seen = set()

    yt_music_items = [e for e in watch_history if is_yt_music_entry(e)]
    print(f"      YouTube Music entries: {len(yt_music_items)} / {len(watch_history)} total")

    for item in yt_music_items:
        title_url = item.get("titleUrl", "")
        match = re.search(r"v=([a-zA-Z0-9_-]{11})", title_url)
        if not match:
            continue
        video_id = match.group(1)
        if video_id in seen:
            continue
        seen.add(video_id)
        entries.append({
            "video_id": video_id,
            "watched_at": item.get("time", ""),
        })

    return entries


def fetch_song_metadata(video_id: str, ytmusic: YTMusic) -> dict:
    result = {"title": "", "artist": "", "album": "", "year": "", "duration": "", "thumbnail": ""}

    try:
        # Both calls in parallel would need nested threads — keep sequential per track
        # but tracks themselves are parallelised
        song = ytmusic.get_song(video_id)
        details = song.get("videoDetails", {})
        microformat = song.get("microformat", {}).get("microformatDataRenderer", {})

        result["title"] = details.get("title", "")
        result["duration"] = details.get("lengthSeconds", "")
        result["thumbnail"] = (
            details.get("thumbnail", {}).get("thumbnails", [{}])[-1].get("url", "")
        )

        watch = ytmusic.get_watch_playlist(video_id)
        tracks = watch.get("tracks", [])
        if tracks:
            track = tracks[0]
            artists = track.get("artists") or []
            result["artist"] = ", ".join(a["name"] for a in artists if a.get("name"))
            album = track.get("album")
            if album and album.get("name"):
                result["album"] = album["name"]
            if not result["title"]:
                result["title"] = track.get("title", "")

        result["year"] = microformat.get("publishDate", "")[:4]

    except Exception as e:
        result["error"] = str(e)

    return video_id, result


def process(input_path: str, output_path: str, workers: int):
    print(f"[1/4] Reading watch history from: {input_path}")
    with open(input_path, "r", encoding="utf-8") as f:
        watch_history = json.load(f)
    print(f"      Total entries in file: {len(watch_history)}")

    print("[2/4] Filtering YouTube Music entries and extracting video IDs...")
    entries = extract_video_ids(watch_history)
    print(f"      Unique tracks to fetch: {len(entries)}")

    if not entries:
        print("[ERROR] No YouTube Music entries found. Check your takeout file.")
        sys.exit(1)

    print("[3/4] Initialising YouTube Music API instances...")
    # One YTMusic instance per worker to avoid shared state issues
    ytmusic_pool = [YTMusic() for _ in range(workers)]

    print(f"[4/4] Fetching metadata ({workers} parallel workers)...\n")

    entry_map = {e["video_id"]: e for e in entries}
    results = {}
    done = 0
    total = len(entries)

    fieldnames = [
        "video_id", "watched_at", "title", "artist", "album",
        "year", "duration_sec", "youtube_music_url", "thumbnail",
    ]

    def worker_fn(args):
        idx, entry = args
        ytmusic = ytmusic_pool[idx % workers]
        return fetch_song_metadata(entry["video_id"], ytmusic)

    with open(output_path, "w", newline="", encoding="utf-8") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()

        success, failed = 0, 0

        with ThreadPoolExecutor(max_workers=workers) as executor:
            future_map = {
                executor.submit(worker_fn, (i, entry)): entry
                for i, entry in enumerate(entries)
            }

            for future in as_completed(future_map):
                done += 1
                try:
                    vid_id, meta = future.result()
                    entry = entry_map[vid_id]

                    if meta.get("title"):
                        success += 1
                        print(f"  [{done}/{total}] {meta['title'][:50]} — {meta['artist'][:30]}")
                    else:
                        failed += 1
                        print(f"  [{done}/{total}] (no data: {meta.get('error', 'unknown')}) {vid_id}")

                    writer.writerow({
                        "video_id": vid_id,
                        "watched_at": entry["watched_at"],
                        "title": meta["title"],
                        "artist": meta["artist"],
                        "album": meta["album"],
                        "year": meta["year"],
                        "duration_sec": meta["duration"],
                        "youtube_music_url": f"https://music.youtube.com/watch?v={vid_id}",
                        "thumbnail": meta["thumbnail"],
                    })

                except Exception as e:
                    failed += 1
                    print(f"  [{done}/{total}] ERROR: {e}")

    print(f"\n✅ Done! {success} tracks with metadata, {failed} failed.")
    print(f"   Output written to: {output_path}")


def main():
    parser = argparse.ArgumentParser(
        description="Fetch YouTube Music metadata from Google Takeout watch history."
    )
    parser.add_argument("--input",   "-i", required=True,                help="Path to watch-history.json")
    parser.add_argument("--output",  "-o", default="yt_music_songs.csv", help="Output CSV (default: yt_music_songs.csv)")
    parser.add_argument("--workers", "-w", type=int, default=10,         help="Parallel workers (default: 10)")
    args = parser.parse_args()

    if not Path(args.input).exists():
        print(f"[ERROR] File not found: {args.input}")
        sys.exit(1)

    process(args.input, args.output, args.workers)


if __name__ == "__main__":
    main()

    
