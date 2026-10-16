# Aniultimatium — Beta v1.06 (beta 2)

**Beta:** new Live TV (IPTV) section. Please report problems with your TV model and year. Free English **sub & dub** anime app for **Samsung Tizen smart TVs** (Tizen 4.0 / 2018 and newer) and browsers.
Install `app.wgt` with [Apps2Samsung](https://github.com/Apps2Samsung/Apps2Samsung/releases) (custom wgt). Widget version 2.7.0.
Backend: Cloudflare Worker (`https://aniultimatium.advaithavinash404.workers.dev`) or `npm start` at home. **Redeploy the Worker** to use "Add with your phone" and the new proxy options.

## Fixed — "KV limit" error when linking AniList or adding a playlist from the phone
Cause: the temporary codes were saved in Cloudflare KV, whose free plan allows only **1,000 writes a day for the whole app**. Every TV's AniList link, phone pairing and account sync spent from that one shared budget, so after a while they all failed with a KV limit error.
- Storage now lives in a **Durable Object** (free plan: 100,000 writes a day) and KV is no longer written to. Old KV data (accounts, sync) is still read and carried over automatically. **Redeploy the Worker** (`wrangler deploy`); the Durable Object is created by the migration in `wrangler.jsonc`.
- "Add with your phone" now shows a **QR code**: scan it and the phone page opens with the code already filled in (same for the AniList link). It works like AquaPlay-style pairing: code on the TV, details on the phone, playlist arrives on the TV, and the server forgets it.
- If a storage limit is ever hit, the message now says what happened and to use Xtream login / M3U link instead, rather than a raw KV error.
- Verified on Cloudflare's own runtime (wrangler dev): pairing, one-time hand-off, wrong-code refusal, AniList code, and account registration; and with a test that fails if anything is written to KV.

## New — Live TV (IPTV)
A fast, remote-friendly IPTV section for **your own** playlist (M3U link or Xtream login; free public channel lists are offered as a starting point). No channels are included.
- **Built not to freeze.** Download and parsing run in a Web Worker, channels show up while they stream in, lists are virtual (about 22 row elements for any list size), logos load only when scrolling settles, saved playlists open from the device without downloading again.
- **Measured** (mock provider with 30,000 channels; the old-engine figures use Chromium 60 with the CPU slowed 4x, not a real TV): first rows in 92 ms and the full list in 0.57 s; 1.3 s on the slowed old engine; reopening a saved list shows rows after 101 ms; holding Down in the list never exceeded 41 ms per frame; the longest stall while loading was about 70-150 ms (it was 300 ms before the work was split up).
- **Browse:** groups, Favorites, Recently watched, search across all channels, sort, several playlists (favorites kept per playlist), adult groups hidden by default, "now / next" with progress and descriptions from the TV guide.
- **Watch:** Up/Down zapping (a fast burst of presses starts one stream, not many), channel number entry, previous channel, channel list over the video, quality / audio / picture / sleep timer / connection options, automatic fallback between routes and a clear message for offline channels.
- **Add playlists without typing on the remote:** the TV shows a code, you enter it with your provider's details on your phone.
- Checked against real public lists (11,346 channels parsed in 134 ms): multi-genre groups are tidied ("News;Public" becomes "News"), `(720p)` and `[Geo-blocked]` become badges, RTMP-only entries are skipped, the adult filter no longer flags "Adult Swim".

## Also in this release
- Hovering the mouse no longer steals focus from the remote when a screen changes under a still cursor.
- The top bar fits nine tabs at every window size.
- Release workflow: `beta-v*` tags create a pre-release.

## Limits (beta)
HTTP/HTTPS streams only; HLS everywhere, raw MPEG-TS on TVs only; compressed `.gz` guides are not supported on TVs; no Xtream movies/series yet. Playback on real TVs could not be tested here.

## Tests
`npm test`: 39 unit tests (TurboScrape, SourceIQ, the IPTV engine with 100,000 channels) and the Tizen-4 compatibility check, now covering every script. End-to-end browser tests for Live TV (keyboard flow, zapping, dead channels, side list, options, search, pairing, playlists, settings, persistence) and the earlier suites (anime, movies, TV shows, AniList, quality switching).
