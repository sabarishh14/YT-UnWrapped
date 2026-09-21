import os
import re
import time
from dotenv import load_dotenv

load_dotenv()

# Set dummy proxy if needed or let it be
from app import load_cache, save_cache, ARTIST_CACHE, lookup_metadata

def is_bad_image(img_url):
    if not img_url:
        return True
    if "50x50" in img_url:
        return True
    
    # Check if it's a YouTube Music thumbnail that hasn't been upgraded to 1080x1080
    if "=w" in img_url and "=w1080" not in img_url:
        return True
        
    return False

def backfill():
    print("Loading cache from database...")
    load_cache()
    print(f"Total artists in cache: {len(ARTIST_CACHE)}")
    
    titles_to_refetch = []
    for title, meta in ARTIST_CACHE.items():
        if isinstance(meta, str):
            continue
            
        img = meta.get("image")
        if is_bad_image(img):
            titles_to_refetch.append((title, meta))
            
    print(f"Found {len(titles_to_refetch)} tracks needing thumbnail backfills.")
    
    if not titles_to_refetch:
        print("Everything is up to date!")
        return

    count = 0
    for i, (title, meta) in enumerate(titles_to_refetch):
        print(f"[{i+1}/{len(titles_to_refetch)}] Re-fetching thumbnail for: {title}")
        
        # Remove from cache so lookup_metadata doesn't instantly return it
        if title in ARTIST_CACHE:
            del ARTIST_CACHE[title]
            
        try:
            artist = meta.get("artist", "")
            vid = meta.get("real_video_id")
            
            # lookup_metadata automatically puts it back into ARTIST_CACHE
            new_meta = lookup_metadata(title, artist, vid)
            if new_meta and not is_bad_image(new_meta.get("image")):
                print(f"   => Success: {new_meta.get('image')[:60]}...")
                count += 1
            else:
                print("   => Still no high-res image found.")
            time.sleep(0.2)
        except Exception as e:
            print(f"Error for {title}: {e}")
            
    print(f"\nSuccessfully upgraded {count} thumbnails.")
    print("Saving updated cache to database...")
    save_cache()
    print("Done!")

if __name__ == "__main__":
    backfill()
