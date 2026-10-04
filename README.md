# Aniultimatium

English-subtitled anime for **Samsung Tizen TVs** and **laptops/desktops** (same code, responsive UI).

- `public/` – the front-end. On Vercel it is served at the site root, so laptops just open your Vercel URL.
- `api/index.js` – Vercel serverless backend (AniList metadata + stream lookup, CORS `*`).
- `tools/build_wgt.py` – zips `public/` into `app.wgt` for the TV (sign with your Samsung certificate before installing).
Use apps2samsung: https://github.com/Apps2Samsung/Apps2Samsung/releases to install, use custom wtg file and install. Thanks to apps2samsung without it the project would not have been possible.

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
**Anivexa API** ([walterwhite-69/Anivexa-API](https://github.com/walterwhite-69/Anivexa-API), installed as the `all-api`
dependency and run in-process) is the primary source. It aggregates AniZone, AniKoto, AnimeGG, KickAssAnime, AniWaves, Senshi …
by AniList id and returns **adaptive HLS up to 1080p with English soft-subs** (SRT/ASS are converted to WebVTT by the proxy).
Fallbacks: AnimeHeaven (720p hard-subbed MP4) and gogoanime.by.
In the player press **Up** (remote) / **Q** / click the quality button to open the settings menu: **Quality** (Auto/1080p/720p/…; your choice is remembered), **Subtitles** and **Source** (pick AniZone, AniKoto, AnimeGG, KickAssAnime, Omega, AniWaves, Senshi, AnimeHeaven or Gogoanime manually if the automatic one is poor or missing). Remote: Left/Right seek, Enter play/pause, Down show controls, red/Info = menu, green = subtitles.

These sites block cloud/datacenter IPs, so **run the app locally** (`npm install && npm start`) for best results.
To use a separately hosted Anivexa instance instead, set `ANIVEXA_URL`.
This app combines all anime apis into one.

## Movies, accounts, history
- **Movies** tab: catalogue/metadata from Cinemeta (free, no key). Playback: public-domain films from the Internet Archive play in our
  own player (quality/subtitle menu, resume, skip); every other movie opens the hosted **VidCore** embed player (TMDB id) in an iframe.
  Embedded players run their own controls, so resume/skip aren't available there. In the menu (Up / Q) choose Source: Auto / Embedded / Public domain.
- **Accounts**: Account tab -> create account / sign in. Continue Watching, My List and History sync between devices.
  Storage: `data/` folder when you run `npm start`; Upstash Redis on Vercel (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`,
  optional `AUTH_SECRET`). Without Upstash, Vercel only keeps accounts temporarily.
- **Skip intro / outro** (AniSkip) button appears during openings/endings (Enter on the remote, or click).
- **Remove from Continue Watching**: ✕ on the card (mouse), Delete / X / red button on a focused card, or the button on the detail page.
  **History** tab lists everything watched; remove single items the same way or "Clear all history".
