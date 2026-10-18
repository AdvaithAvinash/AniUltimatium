# Aniultimatium — Stable v1.09

Files: **`aniultimatium.wgt`** (Samsung Tizen 4.0+, install with Apps2Samsung, custom wgt) and **`aniultimatium.apk`** (Android TV / Fire TV / Android 5+, install with Downloader or Send Files to TV). **Redeploy the Cloudflare Worker** (movie sources, add-ons, debrid, CinePro).

## Start-up, profiles and looks
- **Opening animation** with the logo (skipped on Tizen 4 and 5, any key skips it, Settings → Opening animation turns it off).
- **Choose your profile:** 12 original character avatars (anime and movie archetypes), up to 6 profiles. Each profile has its own list, history, progress and AniList link. Your existing data becomes the first profile.
- **4-digit lock** (optional, per profile; Settings → Profile lock turns it off). It is a family lock, not security.
- **Connect to your list!** An optional step that links AniList (also available later under Account).
- **Choose your look:** *Classic* ("For low-end devices", the default on Tizen 4 / 5) or *Modern* ("For a better looking UI"): a side rail, flat surfaces, one accent colour and a plain white focus ring. Switch any time in Settings → Look.

## Stability (Samsung and Android)
- **Safe mode:** three starts in a row that never finished loading switch the app to Classic + Lite mode and explain why.
- A clear **"The app could not start"** screen (Try again / Safe mode) instead of a black page if a file fails to load.
- Every server call has a **time limit** and gets **one automatic retry** after a dropped connection or a 502/503/504.
- Full storage drops caches instead of failing silently; Android trims caches when the system is short of memory.
- Android: rotation / split-screen never reload the page, landscape in both directions, notch support, soft keyboard pans the page, playback pauses when you leave the app, recovery from a killed WebView, adaptive icon, large heap, game-controller A / B.
- Samsung **AVPlay** engine (Settings → Player engine; Auto = AVPlay on Tizen 4) with automatic fallback to the standard player.

## Sources and Settings → Extra sources (all optional)
- **Debrid** (Real-Debrid, AllDebrid, Premiumize, TorBox): your own account turns torrent entries from add-ons into direct links that play in our own player. Cached files only; the key stays on the device and is never stored by the server.
- **Stremio / Nuvio add-ons** (up to 8) and a **CinePro Core** server address. Nuvio's own scraper-plugin format is not supported. All of it can be typed on the TV or sent from a phone.
- **VidLink** is an optional source (never used by Auto) and carries the **Ads** tag. The too-old-browser message on Tizen 4–6 has an add-on box in it.
- **SimplStream's server list was removed again:** the player sites it relies on (VidSrc, 111Movies, GoDrive) did not answer from the build machine, and it was reported not to work.

## Files renamed
Release files are now `aniultimatium.wgt` and `aniultimatium.apk` (the older generic names are retired). README and About page have the Downloader code placeholder (`DOWNLOADER-CODE-HERE`) and the Send Files to TV steps.

## Honest limits
- The Android app, AVPlay, debrid, add-ons, CinePro and the animation timing were tested in a desktop browser and against mock servers; there was no TV, phone or emulator here.
- Avatars are original archetypes, not existing characters (official art cannot be bundled).
- Hosted movie players still cannot run on Tizen 4 itself; use an add-on / debrid there.
