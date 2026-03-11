import urllib.parse as urlparse
from urllib.parse import parse_qs
from ytmusicapi import YTMusic

def test_metadata_by_url(url):
    print(f"🔍 Analyzing URL: {url}\n")
    
    # Extract Video ID from the URL
    parsed = urlparse.urlparse(url)
    video_id = parse_qs(parsed.query).get('v')
    
    if video_id:
        video_id = video_id[0]
    else:
        print("❌ Could not find 'v=' in the URL. Make sure it's a valid YouTube watch link.")
        return

    print(f"🎬 Extracted Video ID: {video_id}")
    ytmusic = YTMusic()
    
    try:
        # Fetch the exact track details using the Video ID
        watch_playlist = ytmusic.get_watch_playlist(videoId=video_id)
        tracks = watch_playlist.get("tracks", [])
        
        if not tracks:
            print("❌ No track data found for this ID.")
            return
            
        # The first track in the watch playlist is the song itself!
        track = tracks[0]
        
        print("🎵 --- TRACK LEVEL DATA ---")
        print(f"Title:  {track.get('title')}")
        
        track_artists = [a['name'] for a in track.get('artists', [])]
        print(f"Track Artists: {track_artists}")
        
        album_info = track.get('album')
        print(f"Album:  {album_info.get('name') if album_info else 'None'} (ID: {album_info.get('id') if album_info else 'None'})")
        
        final_artists = list(track_artists)
        
        # Look up the Album to find the Music Director / Album Artist
        if album_info and album_info.get('id'):
            print("\n💿 --- ALBUM LEVEL DATA ---")
            try:
                full_album = ytmusic.get_album(album_info['id'])
                album_artists = [a['name'] for a in full_album.get('artists', [])]
                print(f"Album Artists (Owners/Directors): {album_artists}")
                
                # Merge them if they aren't already there
                existing_lower = [a.lower() for a in final_artists]
                for aa in album_artists:
                    if aa.lower() not in existing_lower:
                        final_artists.append(aa)
                        print(f"  [+] Added '{aa}' to the final list!")
                    else:
                        print(f"  [-] '{aa}' is already in the list.")
            except Exception as e:
                print(f"Error fetching album: {e}")
                
        print("\n✅ === FINAL RESULT ===")
        print(f"Final Artists Array:  {final_artists}")
        print(f"Final String to Save: {', '.join(final_artists)}")

    except Exception as e:
        print(f"Error fetching data: {e}")

if __name__ == "__main__":
    # Paste your Takeout URL here!
    test_url = "https://music.youtube.com/watch?v=zaCpHZi1va4&si=tSozlCoORIgeTS0r" 
    
    test_metadata_by_url(test_url)