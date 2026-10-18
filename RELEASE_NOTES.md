# Aniultimatium — Beta v1.09

**Beta.** Extra (optional) movie and TV sources, a Samsung AVPlay player engine, a more compatible Android app, and new file names. Files: `aniultimatium.wgt` (Samsung Tizen 4.0+, Apps2Samsung custom wgt) and `aniultimatium.apk` (Android TV / Fire TV / Android 5+). **The files are now named `aniultimatium.wgt` and `aniultimatium.apk`** (they were `app.wgt` / `app.apk`).
**Redeploy the Cloudflare Worker** (add-on / debrid / CinePro requests, new sources, `gunzip`).

## New — Settings → Extra sources (all optional, nothing is needed to watch)
- **Debrid service:** Real-Debrid, AllDebrid, Premiumize or TorBox. Your own account turns the torrent entries that add-ons list into direct links that play in our own player. Only files the service already has cached are used (an uncached torrent is removed from your account again). The key is checked when you save it, is kept **on the device only**, and is sent with each request in a header: **the server never stores it** (no KV, no Durable Object, so no storage-limit errors). You can type it, or send it from your phone (the same code / QR as IPTV playlists; that one-time hand-over lives in memory/the pairing store for a few minutes and is deleted once the TV has it).
- **Add-ons (Stremio / Nuvio):** up to 8 add-on addresses (`…/manifest.json`; Nuvio uses the same Stremio add-on protocol). Each is checked when added. Ready-to-play streams play directly; torrent-only entries go through your debrid account if you set one. Nuvio's own scraper-plugin format (JavaScript) is **not** supported.
- **CinePro Core server:** the address of a CinePro Core (open-source OMSS streaming API) server that you or someone you trust hosts. Its streams play in our own player.
- All three also work on **Tizen 4**, because they hand us plain video that plays in our own player (or AVPlay).

## New — movie sources
- **SimplStream** (github.com/JustANormalChurro/SimplStream, MIT): its server list (VidSrc, 111Movies, GoDrive; Videasy and VidFast were already here) is now in **Auto** after our own players, and "SimplStream" in the Source list puts them first.
- **VidLink:** added as an **optional** source (never used by Auto). Static scan: its scripts contain ad-network and popunder code, so it carries the **Ads** tag.
- **CinePro** is supported as a server you point the app at (above). I could not reach CinePro's own site from the build machine, so the client follows the OMSS API shape from memory/description and is **tested against a mock server only**.
- Ad research (docs/SOURCE_ADS.md) has VidLink; VidSrc, 111Movies and GoDrive could not be fetched from the research machine, so they are not tagged (that means "not checked", not "no ads").

## Improved — Android app
Same app, more compatible: rotation and split-screen no longer reload the page (the manifest handles the changes and the page is only resized); landscape in both directions, locked, with no portrait/landscape feature requirement; draws behind notches (Android 9+) and uses the modern full-screen API (Android 11+); the soft keyboard pans the page instead of hiding inputs; stops playing when you leave the app; recovers if the system kills the WebView process; adaptive launcher icon; game-controller A / B = OK / Back; resizable window on tablets and foldables. **Not run on a real device or emulator here** (no emulator in the build environment): built, signed and statically verified.

## Also in this release
- **Samsung AVPlay** player engine (Settings → Player engine): Auto uses it on Tizen 4. Tested against a simulated AVPlay only. The widget declares the `avplay` privilege (if a TV refuses to install the widget, that line is the first suspect).
- The "too old for these players" message on Tizen 4–6 now has an add-on address box in it.

## Honest limits
- Debrid, add-on and CinePro paths are tested against mock servers, not against live accounts. VidLink "has a low chance of working" and many hosted players still cannot run on Tizen 4 itself.
- Hosted movie players (everything except add-ons / debrid / CinePro / public domain) still need a 2020+ browser: Tizen 4–6 TVs use the extras above.

---

# Earlier notes (Beta v1.07)

**Beta.** Adds Android TV / Fire TV, a faster and more configurable Live TV, ad tags for movie sources, and many more settings. Files: `aniultimatium.wgt` (Samsung Tizen 4.0+, widget 2.8.0) and `aniultimatium.apk` (Android TV / Fire TV, Android 5+). Samsung install: Apps2Samsung (custom wgt). Android: [docs/ANDROID.md](docs/ANDROID.md).
**Redeploy the Cloudflare Worker** for the guide `.gz` support and the custom-player id.

## New — Samsung AVPlay player engine
Settings → **Player engine (Samsung TVs)**: Auto / Samsung AVPlay / Standard HTML5. **Auto uses AVPlay on Tizen 4** (Chromium 56) and the normal player elsewhere; pick AVPlay on any other Samsung TV to try it. AVPlay is the TV's own player: it plays HLS, MPEG-TS and MP4 natively (no hls.js / MediaSource), for Live TV, anime and add-on movies. The page around the video turns transparent while it runs (the picture is drawn behind the page), and the app keeps its own controls, subtitles and remote keys. If AVPlay is missing or fails before the first picture, the app switches to the normal player by itself. The widget now declares the `avplay` privilege. **Honest status:** tested against a simulated AVPlay (open/play/pause/seek/stop, transparency, fallback), not on a real Tizen TV; hosted movie players still cannot run on Tizen 4. TV volume is the TV's own, and the aspect/zoom options of Live TV do not apply under AVPlay. If the widget refuses to install, tell me: the privilege line is the first thing to check.

## New — Stream add-on: movies and TV shows on Tizen 4 (and every other TV)
Tizen 4 to 6 TVs cannot run the hosted movie players (the "This TV's browser is too old" message). **The "too old" message now has the add-on address box right in it** (type it with the TV keyboard, Save add-on and play); it is also under Settings → Stream add-on. It takes the address of a Stremio-protocol add-on you choose (for example one configured with your own debrid account). The app asks it for the title and plays the plain video file it returns **in our own player**, which Tizen 4 can run (same player as anime and Live TV). Nothing is bundled and nothing is decrypted: you bring the add-on. It is picked first under Source, 1080p MP4/HLS preferred, quality choice respected, subtitles and required headers passed along; if it has nothing for a title the normal sources are used. Torrent-only entries are skipped. The cloud server only contacts public addresses; a self-hosted `npm start` server can use a LAN add-on with `ALLOW_PRIVATE_ADDONS=1`. **Redeploy the Worker.** Verified with a mock add-on and in the browser; not with a real add-on on a real Tizen 4 TV.

## New — Android TV and Fire TV (`aniultimatium.apk`)
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
