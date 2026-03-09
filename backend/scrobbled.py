import os
import requests
from dotenv import load_dotenv
from datetime import datetime

load_dotenv()

API_KEY = os.getenv("LASTFM_API_KEY")
BASE_URL = "https://ws.audioscrobbler.com/2.0/"
print(API_KEY)

def get_recent_tracks(username: str, limit: int = 50, page: int = 1) -> dict:
    """Fetch recent scrobbled tracks for a Last.fm user."""
    params = {
        "method": "user.getrecenttracks",
        "user": username,
        "api_key": API_KEY,
        "format": "json",
        "limit": limit,
        "page": page,
    }
    response = requests.get(BASE_URL, params=params)
    response.raise_for_status()
    return response.json()


def parse_tracks(data: dict) -> list[dict]:
    """Parse raw API response into a list of track dicts."""
    tracks = data.get("recenttracks", {}).get("track", [])
    parsed = []

    for track in tracks:
        # Skip the currently playing track (no date)
        date_info = track.get("date")
        if not date_info:
            scrobbled_at = "Now Playing 🎵"
        else:
            timestamp = int(date_info.get("uts", 0))
            scrobbled_at = datetime.fromtimestamp(timestamp).strftime("%Y-%m-%d %H:%M:%S")

        parsed.append({
            "artist": track.get("artist", {}).get("#text", "Unknown Artist"),
            "album":  track.get("album",  {}).get("#text", "Unknown Album"),
            "track":  track.get("name", "Unknown Track"),
            "scrobbled_at": scrobbled_at,
        })

    return parsed


def display_tracks(tracks: list[dict]) -> None:
    """Pretty-print tracks to the terminal."""
    if not tracks:
        print("No tracks found.")
        return

    print(f"\n{'#':<4} {'Track':<40} {'Artist':<30} {'Album':<30} {'Scrobbled At'}")
    print("-" * 120)
    for i, t in enumerate(tracks, 1):
        print(
            f"{i:<4} "
            f"{t['track'][:38]:<40} "
            f"{t['artist'][:28]:<30} "
            f"{t['album'][:28]:<30} "
            f"{t['scrobbled_at']}"
        )


def fetch_all_scrobbles(username: str, max_pages: int = 5) -> list[dict]:
    """Fetch multiple pages of scrobbles (up to max_pages)."""
    all_tracks = []
    for page in range(1, max_pages + 1):
        print(f"Fetching page {page}...")
        data = get_recent_tracks(username, limit=200, page=page)

        # Check total pages
        total_pages = int(
            data.get("recenttracks", {})
                .get("@attr", {})
                .get("totalPages", 1)
        )

        tracks = parse_tracks(data)
        all_tracks.extend(tracks)

        if page >= total_pages:
            break

    return all_tracks


if __name__ == "__main__":
    if not API_KEY:
        raise ValueError("LASTFM_API_KEY not found in .env file")

    username = "sabarishh14"
    mode = "a"

    if mode == "a":
        tracks = fetch_all_scrobbles(username, max_pages=5)
    else:
        data = get_recent_tracks(username, limit=50)
        tracks = parse_tracks(data)

    display_tracks(tracks)
    print(f"\nTotal tracks fetched: {len(tracks)}")