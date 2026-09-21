import os
import re
import time
import json
from dotenv import load_dotenv

load_dotenv()

import pg8000.native
from urllib.parse import urlparse

# Import only the global cache and lookup function from app.py
from app import ARTIST_CACHE, lookup_metadata

def get_pg8000_conn():
    db_url = os.environ.get("DATABASE_URL")
    if not db_url:
        raise ValueError("DATABASE_URL not found in .env")
        
    parsed = urlparse(db_url)
    return pg8000.native.Connection(
        user=parsed.username,
        password=parsed.password,
        host=parsed.hostname,
        database=parsed.path[1:],
        ssl_context=True,
        port=parsed.port or 5432
    )

def is_bad_image(img_url):
    if not img_url:
        return True
    if "50x50" in img_url:
        return True
    if "=w" in img_url and "=w1080" not in img_url:
        return True
    return False

def backfill():
    print("Connecting to database using pure-python pg8000 driver...")
    conn = get_pg8000_conn()
    
    print("Loading cache from database...")
    rows = conn.run("SELECT title, meta FROM artist_cache")
    for row in rows:
        title = row[0]
        meta = row[1] if isinstance(row[1], dict) else json.loads(row[1])
        ARTIST_CACHE[title] = meta
        
    print(f"Total artists in cache: {len(ARTIST_CACHE)}")
    
    titles_to_refetch = []
    for title, meta in ARTIST_CACHE.items():
        if isinstance(meta, str): continue
            
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
            time.sleep(0.5)
        except Exception as e:
            print(f"Error for {title}: {e}")
            
    print(f"\nSuccessfully upgraded {count} thumbnails.")
    print("Saving updated cache to database...")
    
    # We will use simple UPSERT statements
    for title, meta in ARTIST_CACHE.items():
        # Only update the ones we fetched to save time, or just update all
        if title in [t[0] for t in titles_to_refetch]:
            conn.run(
                "INSERT INTO artist_cache (title, meta) VALUES (:title, :meta) "
                "ON CONFLICT (title) DO UPDATE SET meta = EXCLUDED.meta",
                title=title, meta=json.dumps(meta)
            )
            
    print("Done! All thumbnails backfilled.")
    conn.close()

if __name__ == "__main__":
    backfill()
