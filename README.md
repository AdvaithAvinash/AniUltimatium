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
Anime streams come from four sources, tried one at a time in this order (chosen from tests on a Samsung TV):

1. **AnimeX** (animex.one player API, keyed by AniList id) — default. HLS, sub + English dub, many subtitle languages, intro/outro times.
2. **AniKoto** (via the bundled [Anivexa API](https://github.com/walterwhite-69/Anivexa-API), `all-api` dependency) — HLS 1080p with soft subs.
3. **AnimeYubi** (ZokoAnime host) — HLS 1080p, sub + dub, English VTT.
4. **AniWaves** (via Anivexa) — last resort.

Streams whose CDN needs a Referer are relayed by `/api?action=proxy` (playlists rewritten); subtitle files are converted to WebVTT.
Each stream's playlist is checked from the server before it is handed out. On **Cloudflare Workers** (free plan ≈ 50 outgoing requests
per call) a call that runs low on budget tells the app to continue with `?skip=`; if a stream fails to play or never starts on the TV,
the app moves on to the next source by itself. The next episode is looked up in the background while you watch.
In the player press **Up** for the settings menu (Quality, Audio sub/dub, Subtitles, Subtitle file and sync, Speed, **Source**).
Diagnose from any host with `/api?action=debug&id=<anilistId>&title=<title>&ep=1`.

Evaluated and **not** used (Oct 2026): MiruroAPI (XOR-encoded streams, Miruro blocks Cloudflare), animetsu-api (upstream gone),
consumet.ts (removed from GitHub after DMCA; providers dead or need decryption), REIATSU (repository not found),
AnimeParadise / anv.to (did not play on the TV), hianimes/megaplay and AnimeStream (encrypted / DRM).

## AniList
Link your AniList account in **Account → AniList**. On the TV press *Link AniList*: it shows a 6-letter code and an address
(`<your worker>/link.html`); open it on your phone or laptop, enter the code and sign in with AniList — the TV links itself.
(On a laptop browser on the app's own site, *Link AniList* signs in directly.) Once linked:
- finishing 85% of an episode updates your AniList progress (and marks the show Completed on the last episode; toggle *Auto-update*),
- the home page shows an **AniList · Watching** row (next episode badge),
- a show's page shows your AniList status; press it to cycle Plan to watch → Watching → Completed → Paused → Dropped → remove,
  and *Play* continues from your AniList progress.

One-time setup (AniList requires an API client): go to https://anilist.co/settings/developer → *Create new client*, name it
Aniultimatium, Redirect URL `https://<your worker>.workers.dev/link.html`, save, and put the client **ID** into
`wrangler.jsonc` → `"vars": { "ANILIST_CLIENT_ID": "<id>" }` (or the env var for `npm start`). Linking codes are kept in the
Worker's KV namespace `STORE`.

## Movies, accounts, history
- **Movies** tab: catalogue/metadata from Cinemeta (free, no key). Playback: public-domain films from the Internet Archive play in our
  own player (quality/subtitle menu, resume, skip); every other movie opens a hosted embed player in an iframe: **CineSrc** (default), **VidFast**, **VidCore** or **Videasy**.
  On a movie's page, the **Source** dropdown picks Auto / CineSrc / VidFast / VidCore / Videasy / Public domain before you press Play (remembered).
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
  *Subtitle sync* (±0.5s) if a file is early/late. **VidCore** and **CineSrc**: press **Down** for the control bar (seek bar with time, −10 / play-pause / +10, subtitles, sync, settings, exit); Left/Right skip 10s anytime.
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
