# English Anime

English-subtitled anime for **Samsung Tizen TVs** and **laptops/desktops** (same code, responsive UI).

- `public/` – the front-end. On Vercel it is served at the site root, so laptops just open your Vercel URL.
- `api/index.js` – Vercel serverless backend (AniList metadata + stream lookup, CORS `*`).
- `tools/build_wgt.py` – zips `public/` into `app.wgt` for the TV (sign with your Samsung certificate before installing).

Set `VERCEL_API_URL` at the top of `public/main.js`, then run `python3 tools/build_wgt.py`.

Controls – TV remote: arrows / Enter / Return, media keys. Laptop: mouse, or arrows / Enter / Esc,
`/` search, Space play-pause, ←/→ seek 10s, `N`/`P` next/prev episode, `C` subtitles, `F` fullscreen, `M` mute.

## Troubleshooting streams
Open `https://<your-vercel-url>/api?action=debug&title=Solo%20Leveling&ep=1` — it runs every bundled scraper
(AnimeHeaven, AllAnime, aniwatch/HiAnime, AnimePahe, AnimeKai, HiAnime) and shows which one worked, how long it took, or why it failed.

## Run locally (recommended — streaming sites block cloud IPs)
```
npm install
npm start        # prints http://localhost:3000 and your TV address http://<LAN-IP>:3000
```
Laptop: open `http://localhost:3000`. TV: open the app → **Settings** → *Stream server* → enter the TV address → Save → *Test streams*.
Keep the computer on and on the same Wi-Fi as the TV while watching.

## Stream sources
`AnimeHeaven` is the primary source: plain HTML, direct hard-subbed English MP4 links, no bot protection (verified live
for Solo Leveling, Frieren, Attack on Titan, One Piece, Demon Slayer, Dandadan, Death Note, FMA:B …).
The others are fallbacks; many are blocked by Cloudflare and may fail depending on your network.
