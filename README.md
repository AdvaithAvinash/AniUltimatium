# Aniultimatium — free IPTV player (M3U & Xtream) and anime app for Samsung Tizen, Android TV and Fire TV

> **A free, open-source TV app with a fast IPTV player.** Add your own M3U playlist or Xtream login (from your phone, with a QR code), browse 50,000+ channels without the screen freezing,
> use a TV guide, favorites and fast zapping, and also watch English sub & dub anime, movies and TV shows. Runs on **Samsung Tizen 4.0+ (2018 and newer)**, **Android TV**, **Fire TV** and in any browser.
> It provides no channels: you bring your own playlist, or start with free public channel lists.

This app combines all anime apis into one.

[![Latest release](https://img.shields.io/github/v/release/AdvaithAvinash/AniUltimatium?label=release&color=ff3d7f)](https://github.com/AdvaithAvinash/AniUltimatium/releases/latest)
[![Platform](https://img.shields.io/badge/platform-Samsung%20Tizen%204.0%2B-1428a0)](#install-on-a-samsung-tv)
[![Android TV and Fire TV](https://img.shields.io/badge/Android%20TV%20%7C%20Fire%20TV-APK-3ddc84)](#install-on-android-tv-and-fire-tv)
[![IPTV](https://img.shields.io/badge/IPTV-M3U%20%7C%20Xtream%20%7C%20EPG-ff3d7f)](#live-tv-iptv)
[![Subtitles](https://img.shields.io/badge/English-sub%20%26%20dub-00b8d4)](#faq)
[![AniList](https://img.shields.io/badge/AniList-sync-02a9ff)](#anilist)
[![Last commit](https://img.shields.io/github/last-commit/AdvaithAvinash/AniUltimatium?color=555)](https://github.com/AdvaithAvinash/AniUltimatium/commits/main)

Download the latest [`Aniultimatium.wgt`](https://github.com/AdvaithAvinash/AniUltimatium/releases/latest/download/Aniultimatium.wgt) (Samsung) or [`Aniultimatium.apk`](https://github.com/AdvaithAvinash/AniUltimatium/releases/latest/download/Aniultimatium.apk) (Android TV / Fire TV) · [all releases](https://github.com/AdvaithAvinash/AniUltimatium/releases/latest) · [Live TV (IPTV)](#live-tv-iptv) · [Install on Samsung](#install-on-a-samsung-tv) · [Install on Android TV / Fire TV](#install-on-android-tv-and-fire-tv) · [FAQ](#faq) · [Developer docs](#developer-documentation) · [Website](https://aniultimatium.advaithavinash404.workers.dev/)

## Quick facts
| | |
|---|---|
| **What it is** | An IPTV player for your own playlist (M3U / Xtream) plus an anime, movie and TV-show client. Samsung Tizen web app (`.wgt`), Android TV / Fire TV app (`.apk`) and web browsers |
| **TV support** | Samsung Tizen 4.0 (2018) and newer (layout and scrolling checked against a Chromium 56 engine, the browser inside Tizen 4 TVs); Android TV / Google TV and Amazon Fire TV (Android 5+ / Fire OS 5+) |
| **Languages** | English subtitles (OpenSubtitles auto-picked, 15+ other languages) and English dub where a source has one; Japanese audio by default |
| **Control** | Built for the 10-key remote: arrows, OK, Return, media keys. Mouse and keyboard work on a laptop |
| **Sources** | AnimeX (default), AniKoto, AnimeYubi, AniWaves, ranked automatically from real playback results on *your* TV (SourceIQ) |
| **Accounts** | Optional sync of Continue Watching / My List / History, and optional [AniList](https://anilist.co) linking |
| **Live TV (IPTV)** | Bring your own M3U playlist or Xtream login (or pick free public channels): fast channel browser for 50,000+ channels, TV guide, zapping, favorites. No channels are included |
| **Player engine** | Samsung AVPlay (the TV's native player) is used by default on Tizen 4 and can be chosen on any Samsung TV in Settings; it plays HLS / MPEG-TS / MP4 natively and falls back to the standard player automatically |
| **Profiles and looks** | Up to 6 profiles (original character avatars), each with its own list, history, progress and AniList link; an optional 4-digit lock per profile (a family lock, not security; off in Settings); **Classic** look for low-end devices (the default on Tizen 4 / 5) and **Modern** look with a side rail for newer devices; an opening animation (skipped on Tizen 4 and 5, can be turned off) |
| **Stability** | A start-up safe mode after three failed starts, time limits and one automatic retry on API calls, memory trimming on Android, and a clear recovery screen instead of a black page |
| **Extra sources** | Optional, in Settings: debrid service (Real-Debrid, AllDebrid, Premiumize, TorBox; the key stays on your device), Stremio / Nuvio add-ons, a CinePro Core server. They play in our own player, so they also work on Tizen 4. Nothing here is required |
| **Movies & TV** | Movies and TV Shows tabs (seasons, episodes, next episode) with CineSrc, VidFast, VidCore, Videasy, optional VidLink and public-domain films. Those hosted players need a 2020+ browser, so on Tizen 4–6 TVs only public-domain films play unless you add a **stream add-on** (Settings), whose plain video files play in our own player; the app tells you instead of hanging |
| **Cost** | Free. No ads in our own player. Hosted on a free Cloudflare Worker, or run it at home with `npm start` |
| **Install** | Samsung: sideload `Aniultimatium.wgt` with [Apps2Samsung](https://github.com/Apps2Samsung/Apps2Samsung/releases) (no store account needed). Android TV / Fire TV: install `Aniultimatium.apk` ([steps](docs/ANDROID.md)) |

## IPTV player at a glance
Aniultimatium's **Live TV** is built for people who already have an IPTV provider (or want free public channels) and want it to feel quick on a TV remote.

- **Fast with huge lists.** A 30,000-channel Xtream list shows its first rows after about 0.1 s and is ready in about 0.6 s; reopening a saved list needs no download. Parsing runs in a background thread, the lists only draw what is on screen, and holding Down never exceeded 41 ms per frame in a test with the CPU slowed 4×. [Measured numbers](#live-tv-iptv).
- **Add a playlist from your phone** with a code or QR scan, or type an Xtream login / M3U link, or pick free public channels by country, category or language.
- **TV guide:** now / next with progress and descriptions (XMLTV including `.xml.gz`, or the Xtream short guide), a time-shift setting for guides in another time zone, 12/24-hour clock.
- **Fast zapping:** ▲▼, channel number entry, previous channel, channel list over the video, favorites, recently watched, search across every channel.
- **Control:** groups, sort, parental PIN and hidden adult groups, quality / audio / picture / sleep timer / buffering, a stream-stats overlay, a User-Agent choice for providers that need one.
- **Where it runs:** Samsung Tizen 4.0+, Android TV, Fire TV, and any browser. One codebase, tested down to a Chromium 56 engine.
- **Free and open source,** no account, no ads in the player. Details: [docs/IPTV.md](docs/IPTV.md).

### Choosing an IPTV player for a TV: what to check
Apps such as AquaPlay IPTV, Smart IPTV, IPTV Smarters Player, TiviMate and Kodi's PVR clients all play your provider's playlist; they differ in cost, platforms, speed and features. Aniultimatium has not been compared feature-by-feature with them here, so check what matters to you against these facts about Aniultimatium:

| You want | Aniultimatium |
|---|---|
| Free, no subscription or account | Yes, free and open source |
| Samsung Tizen TV support, including 2018 models | Yes (Tizen 4.0+), installed as a `.wgt` by sideloading |
| Android TV / Fire TV | Yes, `Aniultimatium.apk` (sideloaded; not on a store) |
| Your own M3U link or Xtream login | Yes |
| Typing nothing on the remote | Yes: code or QR scan from a phone |
| Large playlists without freezing | Measured: 30,000 channels ready in about 0.6 s, saved lists reopen in about 0.1 s to first rows |
| TV guide with time-zone fix | Yes (XMLTV, `.gz`, Xtream short guide, ±6 h shift) |
| Parental control | Adult groups hidden by default, 4-digit PIN to show them |
| Works in a laptop browser | Yes (HLS streams) |

**Choose something else if you need:** Xtream movies and series (VOD), catch-up or recording, DRM-protected channels, LG webOS or Apple TV apps, a store-listed app with official support, or a built-in channel subscription. Aniultimatium does not include any.

## Screenshots
| Home | Search |
|---|---|
| ![Aniultimatium home screen for Samsung Tizen TVs with trending anime rows](docs/screenshots/home.jpg) | ![Anime search results in Aniultimatium](docs/screenshots/search.jpg) |

| Show page with episodes | Player settings: audio sub/dub, subtitles and source status |
|---|---|
| ![Anime detail page with episode list, AniList status and Play button](docs/screenshots/detail.jpg) | ![Aniultimatium player menu on a Samsung TV: audio (Japanese or English dub), subtitles, speed and source selection](docs/screenshots/player-menu.jpg) |

## Why choose Aniultimatium on a Samsung TV
- **Made for Tizen first.** Most anime apps target phones or PCs. This one is a Tizen web app: remote navigation, TV-safe layout, hardware Back key, and an
  old-engine compatibility layer so it also works on 2018 TVs (v1.04 fixed a "no video / no scrolling" bug on Tizen 4).
- **English sub *and* dub.** Switch Japanese / English dub in the player (Up, then Audio), pick any subtitle language, nudge subtitle timing by ±0.5 s, and move subtitles up or down (low by default) or change their size.
  The app falls back to Japanese audio automatically when a dub does not exist yet.
- **Sources that fix themselves (SourceIQ).** The app records which source actually *plays* on your TV (resolution success, first-frame time, errors),
  ranks sources by that, cools down a failing source and brings it back automatically. The source menu shows *Recommended / Reliable / Untested / Temporarily unavailable*.
  Nothing is faked: with no history every source says "Untested".
- **Fast source discovery (TurboScrape).** Sources are raced with per-source time limits, the next source starts early when the first is slow, lookups are cached and
  de-duplicated, abandoned lookups are cancelled, and the next episode is prepared while you watch. See [measured results](#performance-measured).
- **AniList sync.** Link AniList with a code from your phone; finishing an episode updates your progress and your "Watching" list shows on the home page.
- **Movies and TV shows too.** Movies and TV Shows tabs with "Popular This Week" and "New Releases", several players, OpenSubtitles, and a Down-key control bar for seeking.
- **What's new each week.** "Popular This Week" and "New Releases" rows built from the episodes that actually aired in the last 7 days.
- **Open and self-hostable.** The whole project, including the backend and the tests, is in this repository.

## Install on Android TV and Fire TV
Get `Aniultimatium.apk` from the [latest release](https://github.com/AdvaithAvinash/AniUltimatium/releases/latest/download/Aniultimatium.apk) (this link always downloads the newest build). Pick whichever way is easiest:

- **Downloader (Fire TV and Android TV):** install the **Downloader** app, open it and enter the code **`1881056`** or use the shortener URL http://aftv.news/1881056 . It downloads `Aniultimatium.apk`; press Install.
- **Send Files to TV:** download `Aniultimatium.apk` on your phone or computer, send it to the TV with the **Send Files to TV** app (both on the same Wi-Fi), then open the file on the TV and install it. This is the normal way to sideload on Android TV.
- **Android TV without Downloader:** create an aftnews shortcut and use Downloader from there.

You may need to allow "Install unknown apps" for Downloader / your file manager once. Step by step: [docs/ANDROID.md](docs/ANDROID.md). Minimum Android 5.0 / Fire OS 5.

## Install on a Samsung TV
1. Download `Aniultimatium.wgt` from the [latest release](https://github.com/AdvaithAvinash/AniUltimatium/releases/latest/download/Aniultimatium.wgt) (this link always downloads the newest build).
2. Use apps2samsung: https://github.com/Apps2Samsung/Apps2Samsung/releases to install, use custom wtg file and install. Thanks to apps2samsung without it the project would not have been possible.
3. Open **Aniultimatium** on the TV. The first start walks you through choosing a profile, an optional 4-digit lock, an optional AniList link and your look (Classic or Modern).

Samsung TVs need Developer Mode for sideloading (Apps screen, type 12345, Developer mode ON, enter your computer's IP, reboot). Apps2Samsung walks through it.

## FAQ
**What is a good free IPTV player for a Samsung Tizen TV?**
Aniultimatium is a free, open-source IPTV player that runs on Samsung Tizen 4.0+ (2018 and newer) as well as Android TV, Fire TV and browsers. Add your own M3U playlist or Xtream login (from a phone with a code or QR), and it handles lists of 50,000+ channels without freezing. See [IPTV player at a glance](#iptv-player-at-a-glance) and the [checklist](#choosing-an-iptv-player-for-a-tv-what-to-check) for how to compare it with other players.

**Is Aniultimatium an alternative to AquaPlay IPTV?**
It does the same core job (plays your own IPTV provider's M3U or Xtream playlist on a TV) and is free and open source. Compare on the [checklist above](#choosing-an-iptv-player-for-a-tv-what-to-check): Aniultimatium adds phone/QR setup, a worker-based loader measured at about 0.6 s for 30,000 channels, a TV guide with time shift, a parental PIN, and Tizen, Android TV and Fire TV builds from one codebase. It does not include Xtream movies/series, catch-up or recording, and it ships no channels.

**Does it come with channels?** No. You add your provider's playlist, or choose free public channels (community lists; what plays depends on your region).

**How do I add an Xtream or M3U playlist without typing on the remote?** Live TV → Add a playlist → **Add with your phone**. Scan the QR code (or open the address shown), enter the details on the phone, and the playlist appears on the TV. The server forgets it as soon as the TV has it.

**Does it work on Android TV and Fire TV?** Yes: install `Aniultimatium.apk` ([steps](docs/ANDROID.md)). It blocks popup ads from movie players and works with the remote's media and colour keys. It has been built and checked statically but not yet run on a physical device here, so please report any problem with your device model.

**What is the best anime app for Samsung smart TVs?**
It depends on what you need. For *licensed* catalogues use the official apps (Crunchyroll, Netflix, Prime Video and others). If you want a **free, open-source anime app
built specifically for Samsung Tizen TVs, with English sub and dub, remote-first controls, automatic source fallback and AniList sync**, Aniultimatium is made for exactly that,
and that is the gap it is designed to be the best at. Phone/PC apps and website wrappers generally are not built for a TV remote or for Tizen's older browser.

**Does it work on older Samsung TVs (2018, Tizen 4.0)?**
Yes, that is a design goal. Tizen 4 TVs use Chromium 56, which lacks CSS `inset`, flex `gap`, CSS grid and more; the app detects this and uses fallbacks, and
`python3 tools/check_compat.py` fails the build if newer-only CSS/JS is added. If something still looks wrong, open an issue with your TV model and year.
Anime plays normally. Movies and TV shows are the exception: they open other sites' players, whose code needs a 2020 or newer browser (Chromium 80+), so on Tizen 4 to 6 only public-domain films play unless you set a stream add-on (Settings → Stream add-on; Stremio protocol, you choose it), which plays in our own player;
the app shows a message instead of hanging on "fetching media". Tizen 4 also gets Lite mode and lazy-loaded pictures automatically (home page download measured at 22 MB → 0.8 MB).

**Does it have English dub?**
Yes, where a source offers one: open the player menu (Up), then **Audio**, then English dub. In our latest tests 49 of 59 popular and current-season shows had an English dub on at least one source; the rest do not have a dub yet.

**Is it free? Is it legal?**
The app is free and open source. It does not host any video: it looks up streams that third-party sites publish and plays them. Availability and legality of that content
depend on your country and on those sites; you are responsible for what you watch. The project is not affiliated with any streaming service, AniList or Samsung. Please support official releases when you can.

**Why does a show not play?**
Sources differ per title. Open the player menu, then **Source**, to try another; the app also switches by itself if a stream does not start within about 25 seconds.
`/api?action=debug&id=<AniList id>&title=<title>&ep=1` on your server shows what each source returned.

**How do I link AniList?** Account, then AniList, then *Link AniList*; open the address shown on the TV on your phone and enter the code. Details in [AniList](#anilist).

**Can I run it without Cloudflare?** Yes: `npm install && npm start` on a computer on your Wi-Fi, then enter its address in the TV app (Settings, Stream server). A home IP is the most reliable for streaming sites.

## Performance (measured)
`tools/bench_sources.js` compares the old behaviour (`?turbo=0`) with TurboScrape **on the same live Cloudflare Worker, interleaved**, following the same retry loop the app uses.
Time = until a usable (playlist-verified) stream is returned; 12 popular shows, 3 rounds, 36 samples per cell, run from a cloud server (absolute numbers depend on network and time of day):

| Scenario | Old: median / slowest 10% | New: median / slowest 10% |
|---|---|---|
| Cold lookup (first AnimeX answer) | 760 ms / 8.6 s | 695 ms / 3.9 s |
| Same episode again | 675 ms / 1.1 s | 74 ms / 1.5 s |
| AnimeX failing (falls to the next source) | 2.5 s / 7.0 s | 2.3 s / 6.4 s |
| AnimeX and AniKoto failing | 2.5 s / 9.5 s | 2.1 s / 4.5 s |

An earlier identical run showed a cold median of 1.5 s to 0.7 s and slowest-10% of 16.8 s to 5.2 s. The reliable gains are in the *slow tail* (a slow source no longer blocks the next one) and in repeats;
when the first source is already fast there is little left to save. Time to first video frame depends on the TV and is recorded on-device by SourceIQ; it cannot be measured from a server.

---

# Developer documentation

- `public/` is the front-end and the TV app. `public/iq.js` is SourceIQ, `public/main.js` the app.
- `api/index.js` is the backend (AniList metadata, stream lookup, relay); it runs on Cloudflare Workers (`worker/index.js`), Vercel or Node (`server/local.js`).
- `lib/turbo.js` is TurboScrape (cache, de-duplication, hedged race, cancellation).
- `tools/build_wgt.py` zips `public/` into `Aniultimatium.wgt`; `tools/build_apk.py` builds the Android TV / Fire TV `Aniultimatium.apk` from the same files plus `android/` ([docs/ANDROID.md](docs/ANDROID.md)); `tools/probe_ads.js` checks which movie players run popup ads; `tools/check_compat.py` is the old-TV compatibility check; `tools/gen_compat_css.py` generates the CSS fallbacks;
  `tools/bench_sources.js` is the latency benchmark. Tests: `npm test`.

Set `VERCEL_API_URL` at the top of `public/main.js` (any backend URL), then run `python3 tools/build_wgt.py`.

## TurboScrape and SourceIQ
**TurboScrape** (`lib/turbo.js`, used by `api/index.js`):
- *Hedged race*: the best source starts first; if it has not answered after a short, self-adjusting delay the next source starts too (at most two at a time), the first playable result wins and the loser is cancelled.
  A failure starts the next source immediately. Every source has its own time limit.
- *Request budget*: each source's real number of outgoing requests is learned; heavy sources (AniKoto and AniWaves use 15-90 per call, the Workers free plan allows about 50) never overlap with others.
- *Caching*: AniList results 5 min (a host that blocks AniList is remembered for 10 min), AnimeX show lookup 30 min, AnimeYubi searches 6 h, episode data 3 min, a verified result 45 s. Concurrent identical lookups share one execution.
  Media links are never kept longer than that, so links do not go stale. Bounded to 300 small entries.
- *Cancellation*: outgoing requests are tied to the client request; when the app leaves the episode (or a race is lost) the work is aborted. The app also aborts abandoned lookups where the browser supports `AbortController` (Tizen 4 does not; stale answers are ignored there).
- Responses include a `trace` (per source: ok / failed / timeout / absent / cancelled and milliseconds, never URLs) and `ms` / `n` (time, outgoing requests). `?turbo=0` runs the pre-TurboScrape behaviour for comparison.

**SourceIQ** (`public/iq.js`, stored on the device under `ea_iq`):
- Records per source: *resolution* outcomes from the backend trace, and *playback* outcomes measured on the TV (first frame reached and time to first frame, fatal errors, stalls). A show missing from a source is not counted against it.
- Score = 0.50 x smoothed playback success + 0.25 x smoothed resolution success + 0.15 x speed + a small default preference that fades as evidence grows; evidence halves every 24 h.
- Two playback failures in a row (or three resolution failures) start a **cool-down** (2 min, doubling up to 30 min); the source is ranked last, can still be picked manually, recovers automatically, and one failure while recovering trips it again. A success clears it.
- The ranking is sent as `order=` with each lookup; the source menu shows *Recommended / Reliable / Untested / Temporarily unavailable*. No URLs, cookies or titles are stored.
- If a backend call dies without any answer (for example Cloudflare's CPU limit, error 1102) the app drops the lead source and asks again.

Controls – TV remote: arrows / Enter / Return, media keys. Laptop: mouse, or arrows / Enter / Esc,
`/` search, Space play-pause, ←/→ seek 10s, `N`/`P` next/prev episode, `C` subtitles, `F` fullscreen, `M` mute.


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
`wrangler.jsonc` → `"vars": { "ANILIST_CLIENT_ID": "<id>" }` (or the env var for `npm start`). Linking codes are kept in the Worker's Durable Object storage (see Deploy).

## Live TV (IPTV)
A fast IPTV section for your **own** playlist. Aniultimatium does not provide, host or link to any paid channels: you add what your provider gave you, or start with the free public channel lists (community-maintained, availability varies by region).

**Adding a playlist** (Live TV tab):
- **Add with your phone**: the TV shows a 6-character code; open `/add.html` on your phone, enter the code and your provider's details (no typing on the remote). The server keeps it for at most 10 minutes and forgets it once the TV has received it.
- **Xtream login**: server, username, password. The login is checked first and the account page shows status, expiry date and connections in use.
- **M3U link**: any `.m3u` / `.m3u8` playlist address (a `get.php?username=...` link is recognised as Xtream automatically).
- **Free public channels**: by country, category or language (iptv-org lists).

**Why it does not freeze** (measured, see below): downloading and parsing run in a Web Worker and channels appear while they stream in; the lists are virtual (about 22 row elements exist whatever the list size); logos load only when scrolling settles and a failed logo is never retried; saved playlists open from IndexedDB without downloading again; zapping updates the banner at once and starts the stream only when the remote pauses.

**Features:** groups, Favorites, Recently watched, search across every channel, sort (provider order / A-Z / number), now and next with progress bars and descriptions (XMLTV guide, or the Xtream short guide per channel), several playlists with separate favorites, adult groups hidden by default, quality / audio / picture (fit, fill, stretch, zoom) / sleep timer / connection choice, channel number entry, previous channel, channel list over the video (Left, with Left/Right switching group), automatic fallback (direct, then through your server, HLS then TS) and a clear message for channels that are offline.

**Settings:** stream format, sort, which group opens first, open the last channel on start, guide on/off, **guide time shift**, 12/24-hour clock, adult groups + **parental PIN**, picture, buffering mode, banner time, logos on/off, **stream stats overlay**, playlist update interval, request User-Agent. More: [docs/IPTV.md](docs/IPTV.md).

**Remote:** Up/Down zap, Left channel list, Right options, 0-9 channel number, OK show/hide the banner, Green previous channel, Yellow favorite, Blue sleep timer, Back leaves. In the list: OK watch, Right favorite, Left groups, Up search, CH+/- page.

**Measured** (mock provider, 30,000 channels, headless Chromium; the old-engine numbers use Chromium 60 with the CPU slowed 4x as a stand-in for a 2018 TV, not a real TV):

| What | Result |
|---|---|
| Xtream list of 30,000 channels, first rows on screen | 92 ms (modern Chromium) |
| Same list fully loaded and ready | 0.57 s (modern), 1.3 s (Chromium 60, 4x slower CPU) |
| Reopening a saved list | first rows after 101 ms, ready after about 1 s (4x slower CPU), no download |
| Frame time while holding Down in the list (4x slower CPU) | worst 41 ms, none over 100 ms |
| Search 30,000 channels | 244 ms including the screen update (4x slower CPU); 100,000 names in 2 ms in Node |
| Longest stall while loading and parsing 30,000 channels (4x slower CPU) | about 70-150 ms (it was 300 ms before the work was split into slices) |
| Parsing 100,000 channels (14 MB playlist) in Node | 0.9 s |

**Limits:** streams must be HTTP/HTTPS (RTMP/UDP/RTSP are skipped). HLS (`.m3u8`) works everywhere; raw MPEG-TS plays on TVs but not in desktop browsers. Compressed `.xml.gz` guides are unpacked by the server while relaying (guides over 80 MB are read in part). Live TV on the website goes through the server for providers without CORS, which costs bandwidth; the TV app connects directly first. Movies/series (Xtream VOD) are not included yet.

## Movies, accounts, history
- **Movies** and **TV Shows** tabs: catalogue/metadata from Cinemeta (free, no key); TV shows list seasons and episodes (`/api?action=tv_meta&id=tt…`). Playback: public-domain films from the Internet Archive play in our
  own player (quality/subtitle menu, resume, skip); every other movie opens a hosted embed player in an iframe: **CineSrc** (default), **VidFast**, **VidCore** or **Videasy**.
  Sources known (from reading their scripts) or seen to open popup ads are tagged **⚠ Ads**; the Android app blocks those popups. Settings can hide the tag, try ad-free sources first, or add a **custom player** address. Findings and method: [docs/SOURCE_ADS.md](docs/SOURCE_ADS.md).
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
