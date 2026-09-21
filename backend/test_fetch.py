import os
import requests
from dotenv import load_dotenv

load_dotenv()

LASTFM_API_KEY = os.environ.get("LASTFM_API_KEY")
LASTFM_USERNAME = os.environ.get("LASTFM_USERNAME", "sabarishh14")

def fetch_last_50_songs():
    if not LASTFM_API_KEY:
        print("LASTFM_API_KEY is not set in .env")
        return
        
    print(f"Fetching last 50 songs for Last.fm user: {LASTFM_USERNAME}...")
    
    params = {
        "method": "user.getrecenttracks",
        "user": LASTFM_USERNAME,
        "api_key": LASTFM_API_KEY,
        "format": "json",
        "limit": 50,
        "page": 1
    }
    
    try:
        resp = requests.get("https://ws.audioscrobbler.com/2.0/", params=params, timeout=10)
        if not resp.ok:
            print(f"Failed to fetch data. Status code: {resp.status_code}")
            print(resp.text)
            return
            
        data = resp.json()
        tracks = data.get("recenttracks", {}).get("track", [])
        
        if isinstance(tracks, dict):
            tracks = [tracks]
            
        count = 0
        for i, t in enumerate(tracks):
            is_now_playing = "@attr" in t and t["@attr"].get("nowplaying")
            
            title = t.get("name", "Unknown Title")
            artist = t.get("artist", {}).get("#text", "Unknown Artist")
            date_str = "Now Playing" if is_now_playing else t.get("date", {}).get("#text", "Unknown Date")
            
            print(f"{i+1:2d}. {title} - {artist} [{date_str}]")
            count += 1
            
        print(f"\nSuccessfully fetched {count} songs.")
        
    except Exception as e:
        print(f"An error occurred: {e}")

if __name__ == "__main__":
    fetch_last_50_songs()
