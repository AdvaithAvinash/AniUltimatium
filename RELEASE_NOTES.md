# Aniultimatium — Stable v1.04

Free English **sub & dub** anime app for **Samsung Tizen smart TVs** (Tizen 4.0 / 2018 and newer) and browsers.
Install `app.wgt` with [Apps2Samsung](https://github.com/Apps2Samsung/Apps2Samsung/releases) (custom wgt). Widget version 2.5.0.
Backend: Cloudflare Worker (`https://aniultimatium.advaithavinash404.workers.dev`) or `npm start` at home.

## Fixed — Tizen 4 (2018 TVs): no video / no scrolling
Reported on Tizen 4: the video showed as a tiny player with audio only, controls were unreachable, and the home page could not scroll down.
Cause: Tizen 4 uses Chromium 56, which does not know CSS `inset`, flex `gap`, `aspect-ratio`, `min()` or CSS grid. Without `inset` the player and the page views had no size.
The app now uses widely supported CSS and feature-detected fallbacks. Verified in a real Chromium 60 engine: before the fix the page view was 2982 px tall (so Down never scrolled)
and the player measured 0×0; after it the view is 720 px and scrolls, and the player and video fill the screen. A build check (`tools/check_compat.py`) now fails if newer-only CSS/JS is added.

## New — TurboScrape: faster source discovery
- A slow source no longer blocks the next one: the next source starts early (at most two at a time), the first verified stream wins, the loser is cancelled.
- Per-source time limits; request-budget aware (heavy sources are never overlapped on the Workers free plan).
- Cached and de-duplicated lookups (AniList, AnimeX, AnimeYubi), 45 s result cache, no stale media links; abandoned lookups are cancelled; stale prefetched links are refreshed once before switching source.
- Measured on the live Worker, old vs new interleaved (36 samples each): slowest 10% of cold lookups **8.6 s → 3.9 s**, repeat lookups **675 ms → 74 ms**, AnimeX+AniKoto failing slowest 10% **9.5 s → 4.5 s**.
  Typical (median) cold time barely changes (760 → 695 ms) because AnimeX is usually already fast. Full table and caveats in the README.

## New — SourceIQ: adaptive source ranking
- Learns on your TV which source actually plays: resolution outcomes, playback success, time to first frame, errors.
- Failing sources cool down automatically (2 min, doubling to 30 min) and recover by themselves; manual choice always works.
- The Source menu shows **Recommended / Reliable / Untested / Temporarily unavailable**. Stats stay on the device; no URLs or cookies are stored.
- If a backend call dies without an answer (Cloudflare CPU limit), the app drops the lead source and retries.

## Also in this release (since 1.03)
- AniList linking (code from your phone), auto progress, Watching row, status button.
- Movies: CineSrc (default), VidFast, VidCore, Videasy, public domain; Down-key control bar; detection when an embed ignores remote commands.
- Anime sources: AnimeX (default) → AniKoto → AnimeYubi → AniWaves.
- README, FAQ and metadata rewritten for discoverability (llms.txt, structured data, social preview).

## Tests
`npm test`: 29 unit tests (TurboScrape cache/race/cancellation, SourceIQ ranking/cool-down/persistence) and the Tizen-4 compatibility check; end-to-end browser tests for back-key, control bar,
AniList, source switching, SourceIQ and crash recovery. Limitations: real-TV playback and time to first frame can only be measured on a TV (SourceIQ records them on-device).
