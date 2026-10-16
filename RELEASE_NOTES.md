# Aniultimatium — Beta v1.07

**Beta.** Adds Android TV / Fire TV, a faster and more configurable Live TV, ad tags for movie sources, and many more settings. Files: `app.wgt` (Samsung Tizen 4.0+, widget 2.8.0) and `app.apk` (Android TV / Fire TV, Android 5+). Samsung install: Apps2Samsung (custom wgt). Android: [docs/ANDROID.md](docs/ANDROID.md).
**Redeploy the Cloudflare Worker** for the guide `.gz` support and the custom-player id.

## New — Android TV and Fire TV (`app.apk`)
The same app in a small native shell (one WebView, about 0.3 MB, no extra libraries): TV launcher entry with a banner, D-pad and OK, Back that follows the app's own menus and closes it at the top, media / colour / channel / Menu keys mapped (Yellow favorite, Green previous channel, Blue sleep timer), screen kept awake, **popup ads and ad redirects blocked**, and no CORS limit for the bundled page so IPTV providers load directly. Updates install over each other (project signing key).
**Honest status:** built, signed and statically verified; the web app was tested under the shell's conditions (file origin, no CORS, TV user-agent, injected remote keys). It has not been run on a physical TV or an emulator (none available here), so please report problems with your device and Android / Fire OS version.

## Faster, better Live TV
- hls.js is now **bundled** (no CDN) and loaded without blocking startup, so the app starts sooner and works with a poor connection to the CDN.
- **Tuning:** a silent route is abandoned after 9 s instead of 14 s; the stream format your provider really plays (HLS or TS) is remembered per playlist; manifest and level timeouts shortened. Buffering mode (fast start / balanced / stable).
- **TV guide:** `.xml.gz` guides now work (unpacked by the server; a TV browser cannot), very large guides are read in part, a **coming-up list** in the info pane, **guide time shift** (±6 h) and 12/24-hour clock.
- **Stream stats overlay** (resolution, stream and link bitrate, buffer, dropped frames, route), channel **banner time**, **logos on/off**, **parental PIN** for adult groups, **open on** all / favorites / last group, playlist **update interval**, a **User-Agent** choice for providers that need one.
- Everything from beta 1.06 measured again: 30,000 channels ready in about 0.6 s, saved lists reopen in about 0.1 s to first rows, no frame over 41 ms while holding Down with the CPU slowed 4× (stand-in for a 2018 TV).

## Ads tags on movie sources
Reading each player's own scripts (reproducible: `node tools/probe_ads.js static`, details in [docs/SOURCE_ADS.md](docs/SOURCE_ADS.md)):
**CineSrc** contains a popunder ad configuration and **VidFast** replaces `window.open` to get around popup blockers, so both are tagged **⚠ Ads** ("may open popup ads"). **VidCore** and **Videasy**: no ad or popup code found. This is static evidence: a live test was not possible from the research machine, and a player can change at any time. On Android the shell blocks popups and counts each one, so the tag also appears from real experience. Settings: hide the tag, or "try ad-free sources first" (off by default).

## More settings
Settings now has an **Interface & playback** section: start on (Anime / Movies / TV Shows / Live TV), accent colour (pink, cyan, violet, green, orange), play next episode automatically, skip intro and outro automatically, default audio, default quality (anime and movies/TV), rotate the home banner, Ads tag, ad-free first, a **custom movie player** address (`{imdb} {tmdb} {s} {e}`), and Reset all settings (keeps playlists, favorites and progress).

## Not added, and why
- **Embedwave** and **CinePro Core** were requested. Embedwave has no documentation I could find and its site could not be reached from here, so its embed address and behaviour could not be verified, and a source I cannot test cannot be promised to play "perfectly". CinePro Core is not a player: it is a self-hosted scraping backend for unlicensed streams, and this project does not add new scraper integrations. If you know a player's embed address, add it yourself under **Settings → Custom movie player**.
- Xtream movies and series (VOD), catch-up and recording are still not included.

## Tests
`npm test`: 42 unit tests (IPTV engine at 100,000 channels, storage with a fake Durable Object and a no-KV-writes assertion, Android shell consistency, TurboScrape, SourceIQ) and the Tizen-4 compatibility check, now covering every script. End-to-end browser tests: Live TV keyboard flow, playlists and pairing, settings, guide `.gz`, ad tags, custom player, the app under Android-like conditions, and the earlier anime / movie / TV suites.
