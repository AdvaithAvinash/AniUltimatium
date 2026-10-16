# Live TV (IPTV) guide

Aniultimatium's Live TV is a player for **your own** playlist. It does not provide, host or link to paid channels. Free public channel lists (iptv-org, by country, category or language) are offered as a starting point.

## Add a playlist
| Way | When to use it |
|---|---|
| **Add with your phone** | TV shows a 6-character code and a QR code. Scan it (or open the address), enter the provider's details on the phone; the playlist arrives on the TV. The server keeps it for at most 10 minutes and forgets it once the TV has it |
| **Xtream login** | Server, username and password. The login is checked first; the account page shows status, expiry and connections in use |
| **M3U link** | Any `.m3u` / `.m3u8` address. A `get.php?username=…&password=…` link is recognised as Xtream automatically |
| **Free public channels** | Country, category, language, or everything (about 11,000 channels) |

## Why it stays fast
- Download, parsing and the TV guide run in a **Web Worker**; channels appear while the list is still arriving (first rows after about 0.1 s, a 30,000-channel list ready in about 0.6 s on a laptop).
- **Virtual lists:** about 22 row elements exist whatever the list size.
- Saved playlists open from the device (IndexedDB) without downloading again; stale lists update quietly in the background (daily, weekly or manual).
- Logos load only when scrolling settles; a logo that fails is never retried; Settings can turn logos off.
- Zapping updates the banner at once and starts the stream only when the remote pauses, so a burst of presses opens one stream.
- Tuning gives up on a silent route after 9 s and tries the next (direct, then through your server; HLS then TS; the format your provider really plays is remembered).
- Measured numbers are in the main [README](../README.md#live-tv-iptv).

## Remote
List: OK watch · ▶ favorite · ◀ groups · ▲ search · CH+/− page · Green sort.
Watching: ▲▼ zap · ◀ channel list (◀▶ switches group inside it) · ▶ options · 0–9 channel number · OK show/hide banner · Green previous channel · Yellow favorite · Blue sleep timer · Back leaves.

## Settings (Live TV → ⚙)
Stream format (HLS/TS) · sort · open on (all, favorites, last group) · open the last channel on start · TV guide on/off · **guide time shift** (±6 h, for providers whose guide is in another time zone) · 12/24-hour clock · adult groups (hidden by default) · **parental PIN** · picture (fit, fill, stretch, zoom) · buffering (fast start, balanced, stable) · banner time (3–12 s) · logos · **stream stats overlay** (resolution, bitrates, buffer, dropped frames, route) · playlist update interval · request User-Agent used when the server relays (default, VLC, OkHttp, Chrome) · guide address (XMLTV).

## TV guide
Xtream playlists use the provider's `xmltv.php`; M3U playlists use the `x-tvg-url` in the playlist header or an address you enter. Compressed `.xml.gz` guides are unpacked by the server while relaying (a TV browser cannot). Guides over 80 MB are read only in part. Without an XMLTV guide, Xtream playlists fetch the short guide for the channel you are on.

## Troubleshooting
- **Playlist will not load:** the error screen lists what was tried (direct, then through the server). Providers that block cloud servers need the app at home (`npm start`, Settings → Stream server).
- **A channel says "not available":** it is offline, or your provider limits connections (check the account page for connections in use). Try Options → Connection, or the other stream format in Settings.
- **Wrong "now" programme:** use the guide time shift.
- **Desktop browser and raw `.ts` streams:** browsers cannot play bare MPEG-TS; use HLS (`.m3u8`). TVs play TS natively.

## Limits
HTTP/HTTPS streams only (RTMP, UDP, RTSP entries are skipped). No Xtream movies/series, catch-up or recording. No DRM channels.
