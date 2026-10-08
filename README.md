# Aniultimatium

English-subtitled anime for **Samsung Tizen TVs** and **laptops/desktops** (same code, responsive UI).

- `public/` – the front-end. On Vercel it is served at the site root, so laptops just open your Vercel URL.
- `api/index.js` – Vercel serverless backend (AniList metadata + stream lookup, CORS `*`).
- `tools/build_wgt.py` – zips `public/` into `app.wgt` for the TV (sign with your Samsung certificate before installing).
Use apps2samsung: https://github.com/Apps2Samsung/Apps2Samsung/releases to install, use custom wtg file and install. Thanks to apps2samsung without it the project would not have been possible.

Set `VERCEL_API_URL` at the top of `public/main.js`, then run `python3 tools/build_wgt.py`.

## Deploy on Cloudflare Workers (works while Vercel is paused)
The same `api/index.js` backend runs as a Cloudflare Worker (`worker/index.js` + `wrangler.jsonc`); the Worker also serves `public/`, so one URL covers laptop + TV.
1. Cloudflare dashboard → Workers & Pages → Create → connect this GitHub repo. Build command `npm install`, deploy command `npx wrangler deploy`. The Worker name must be `aniultimatium`.
2. Optional: a KV namespace bound as `STORE` keeps accounts/sync permanently (wrangler creates it on deploy; delete the `kv_namespaces` line in `wrangler.jsonc` if the deploy complains). Without it accounts live in memory only.
3. Put your `https://<name>.<you>.workers.dev` URL in `VERCEL_API_URL` (first line of `public/main.js`) and rebuild the `.wgt`.
Notes: the free plan has a small CPU limit per request, and streaming sites sometimes block Cloudflare IPs; open `/api?action=debug&title=Solo%20Leveling&ep=1` to see what works. `npm start` on a home PC stays the most reliable.

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
  own player (quality/subtitle menu, resume, skip); every other movie opens a hosted embed player (**VidCore** or **CineSrc**, all keyed by TMDB id) in an iframe.
  On a movie's page, the **Source** dropdown picks Auto / VidCore / CineSrc / Public domain before you press Play (remembered).
  Embedded players run their own controls, so resume/skip aren't available there. In the menu (Up / Q) choose Source: Auto / Embedded / Public domain.
- **Accounts**: Account tab -> create account / sign in. Continue Watching, My List and History sync between devices.
  Storage: `data/` folder when you run `npm start`; Upstash Redis on Vercel (`UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN`,
  optional `AUTH_SECRET`). Without Upstash, Vercel only keeps accounts temporarily.
- **Skip intro / outro** (AniSkip) button appears during openings/endings (Enter on the remote, or click).
- **Remove from Continue Watching**: ✕ on the card (mouse), Delete / X / red button on a focused card, or the button on the detail page.
  **History** tab lists everything watched; remove single items the same way or "Clear all history".

## Subtitles, ±10s and quality (movies)
- **OpenSubtitles** (English, up to 6 candidates per title, keyless via Stremio's OpenSubtitles data endpoint) work in our own player and over **CineSrc**:
  CineSrc is driven through its documented postMessage API, so subtitles are drawn locked to its playback clock. Menu (Up / Q): Subtitles (pick a candidate) and
  *Subtitle sync* (±0.5s) if a file is early/late. **VidCore** has no player API, so use its own CC button (it supports 30 languages).
- CineSrc: ±10s with Left/Right on the remote (or the ⟲ 10 / 10 ⟳ buttons), Enter = play/pause, green = cycle subtitles; progress is saved so Continue Watching resumes (`t=`).
- **Quality** dropdown on the movie page: Auto, 4K, 1440p, 1080p, 720p, 480p (sent to CineSrc as `quality=`, applied to our own HLS player too; VidCore auto-selects up to 4K).
- Anime: if a stream has no English subtitles, press Up → Subtitles to pick OpenSubtitles (matched through the AniList→IMDb mapping).

## Anime subtitles, dub and the first-run notice
- Subtitles are drawn by our own overlay locked to the real playback clock (`video.currentTime`), so they stay in sync and look the same on TV and laptop.
  Menu (Up / Q / red): **Subtitles** lists every track the stream ships (English first, SDH, other languages) plus OpenSubtitles English/Japanese; **Subtitle sync** shifts timing in 0.5 s steps.
- **Audio**: Japanese (original) or English dub. HLS streams with several audio tracks (AniZone) switch live; otherwise the server fetches the dub from the
  Anivexa providers that have one. Your choice is remembered, and it falls back to Japanese when no dub exists.
- A controls notice is shown when the app opens; **Don't show again** hides it (turn it back on under Settings → Tips).

## Automatic OpenSubtitles
- Subtitles turn on by themselves: **OpenSubtitles in your remembered language (English by default)** for anime and movies. Streams that already have English burned into
  the picture (AnimeHeaven, Gogoanime, AnimeGG) are left alone.
- **Auto-alignment**: when the stream ships its own English track, every OpenSubtitles English file is compared with it (nearest-cue histogram) and the best-aligned file is
  chosen and offset automatically — OpenSubtitles text, with timing locked to your exact release.
- Menu → **Subtitles** (language: English, Japanese, Malayalam, Hindi, Tamil, Telugu first, then Arabic, Chinese, French, German, Indonesian, Italian, Korean, Portuguese, Russian, Spanish, Turkish, Vietnamese …
  whatever exists for the title), **Subtitle file** (OpenSubtitles #1…#n or the stream's own track) and **Subtitle sync**. Your language is remembered.
