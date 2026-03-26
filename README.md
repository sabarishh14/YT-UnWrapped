# YT Music Unwrapped - Your Stats, Cinematic 🎬

A high-performance React and Flask application that parses massive YouTube Music listening histories to generate immersive, shareable dashboards. Built with a Stale-While-Revalidate (SWR) cache in Supabase/Neon, multi-tier fallback metadata enrichment (Last.fm & JioSaavn), native-feeling swipeable 'Story Mode' transitions, and instant 9:16 exportable posters — protected by Firebase Auth and custom hash-routed sandboxing.

## Features
- **Month Capsule**: Total playtime, Top 5 Artists (by minutes), Top 5 Songs (by plays), Streak, Listening Split, and Throwback
- Song duration enrichment via YouTube Data API v3 (with graceful fallback)
- YouTube-native dark theme

## Setup

### 1. Backend (Flask)

```bash
cd backend
pip install -r requirements.txt

# Optional but recommended: set your YouTube Data API v3 key
# Without it, durations default to 3.5 min per track
export YT_API_KEY=your_key_here

python app.py
```

Backend runs on `http://localhost:5000`

**Getting a YouTube Data API key:**
1. Go to [console.cloud.google.com](https://console.cloud.google.com)
2. Create a project → Enable "YouTube Data API v3"
3. Credentials → Create API Key
4. Free quota: 10,000 units/day (each video duration fetch = 1 unit)

### 2. Frontend (Vite + React)

```bash
cd frontend
npm install
npm run dev
```

Frontend runs on `http://localhost:5173`
The Vite dev server proxies `/api/*` to Flask automatically.

### 3. Get your Takeout file

1. Go to [myaccount.google.com](https://myaccount.google.com) → Data & Privacy → Download your data
2. Select **YouTube and YouTube Music** only, format: **JSON**
3. After download, find: `Takeout/YouTube and YouTube Music/history/watch-history.json`
4. Upload it in the app

## Architecture

```
ytmusic-stats/
├── frontend/          # Vite + React
│   └── src/
│       ├── pages/     # UploadPage, DashboardPage
│       ├── components/ # Navbar, MonthCapsule
│       └── styles/    # global.css
└── backend/           # Flask
    └── app.py         # Parse → Enrich → Analytics → JSON
```

## Analytics Logic

| Stat | Method |
|------|--------|
| Total Playtime | Sum of song durations (seconds → minutes) |
| Top 5 Artists | Ranked by total minutes listened |
| Top 5 Songs | Ranked by play count (≥30s = 1 play) |
| The Streak | Longest consecutive days for top artist |
| Listening Split | Top artist's % of total time |
| The Throwback | Top-5 song from 3 months ago with biggest play drop |

## Notes

- Without a YouTube API key, all durations fall back to 3.5 minutes per track. Playtime and artist rankings will still work, but won't be perfectly accurate.
- The backend caches fetched durations in memory — re-uploading the same file won't re-fetch durations.
- Only entries with `"header": "YouTube Music"` are analyzed.
