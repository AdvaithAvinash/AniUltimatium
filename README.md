# Aniultimatium

English-subtitled anime for **Samsung Tizen TVs** and **laptops/desktops** (same code, responsive UI).

- `public/` – the front-end. On Vercel it is served at the site root, so laptops just open your Vercel URL.
- `api/index.js` – Vercel serverless backend (AniList metadata + stream lookup, CORS `*`).
- `tools/build_wgt.py` – zips `public/` into `app.wgt` for the TV (sign with your Samsung certificate before installing).
Use apps2samsung: https://github.com/Apps2Samsung/Apps2Samsung/releases to install, use custom wtg file and install. Thanks to apps2samsung without it the project would not have been possible.



## Stream sources
**Anivexa API** ([walterwhite-69/Anivexa-API](https://github.com/walterwhite-69/Anivexa-API), installed as the `all-api`
dependency and run in-process) is the primary source. It aggregates AniZone, AniKoto, AnimeGG, KickAssAnime, AniWaves, Senshi …
by AniList id and returns **adaptive HLS up to 1080p with English soft-subs** (SRT/ASS are converted to WebVTT by the proxy).
Fallbacks: AnimeHeaven (720p hard-subbed MP4) and gogoanime.by.
In the player press **Up** (remote) / **Q** / click the quality button to open the settings menu: **Quality** (Auto/1080p/720p/…; your choice is remembered), **Subtitles** and **Source** (pick AniZone, AniKoto, AnimeGG, KickAssAnime, Omega, AniWaves, Senshi, AnimeHeaven or Gogoanime manually if the automatic one is poor or missing). Remote: Left/Right seek, Enter play/pause, Down show controls, red/Info = menu, green = subtitles.

These sites block cloud/datacenter IPs, so **run the app locally** (`npm install && npm start`) for best results.
To use a separately hosted Anivexa instance instead, set `ANIVEXA_URL`.
This app combines all anime apis into one.


