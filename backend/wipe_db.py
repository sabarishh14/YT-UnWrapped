import psycopg2
import os
from dotenv import load_dotenv

load_dotenv()
DATABASE_URL = os.environ.get("DATABASE_URL")

print("Connecting to Neon...")
with psycopg2.connect(DATABASE_URL) as conn:
    with conn.cursor() as cur:
        cur.execute("DELETE FROM artist_cache;")
        cur.execute("DELETE FROM listens;")
    conn.commit()
    
print("Database totally wiped! You are good to go.")