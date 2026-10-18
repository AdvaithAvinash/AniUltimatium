# Which movie sources open popup ads

Movies and TV shows play inside other sites' players (CineSrc, VidFast, VidCore, Videasy). Some of those players run popup ads. The app tags a source **⚠ Ads** in the Source list and in the player menu when it is known, or has been seen, to open popups. Anime and public-domain films play in Aniultimatium's own player, so they have no third-party page and no popups.

## What was found (16 Oct 2026, static analysis of each player's own scripts)

| Source | Result | Evidence |
|---|---|---|
| CineSrc | **Tagged: Ads** | Its scripts contain a popunder ad configuration (keys `siteId`, `minBid`, `popundersPerIP`, `delayBetween`, the layout used by popunder ad networks) |
| VidFast | **Tagged: Ads** | Its scripts replace `window.open` with a version that opens windows through a hidden frame or form, with a frequency cap kept in `localStorage` (`shown_at`). That is the technique popup-ad code uses to get around popup blockers |
| VidLink | **Tagged: Ads** | Its scripts contain ad-network and popunder code (strings for Adcash, PopAds and popunder). Static scan, 18 Oct 2026 |
| VidCore | not tagged | No ad-network or popup code found (only Google tag / analytics references) |
| Videasy | not tagged | No ad-network or popup code found (its one `window.open` is a CSV download helper) |
| Public domain, anime sources | no ads | Played in our own `<video>` element; no third-party page |

## What this does and does not prove
- It is **static**: the code is there, but the search could not watch a popup actually fire. The research machine could not play these players (datacenter addresses are refused or stuck on "fetching media"), so a live click-through test would have shown nothing and proven nothing. The wording in the app is therefore "may open popup ads".
- A player can switch ads on or off from its server at any time, and ads can also come from the stream hosts after Play. A source that is not tagged is "nothing found", not a promise.
- The Android TV / Fire TV app **blocks popups and ad redirects** and counts each one for the source on screen, so on Android a source also gets the tag from real experience, and the tag appears on your own device.

## Using it
- Settings → **Show an "Ads" tag on sources with popups**: hide the tags if you do not want them.
- Settings → **Movies and TV: try ad-free sources first** (off by default): in *Auto*, tagged sources are tried last. CineSrc has the best remote and subtitle support, so this is your choice.
- Settings → **Custom movie player**: add a player of your own with an address like `https://player.example/movie/{tmdb}` (`{imdb}`, `{tmdb}`, `{s}`, `{e}` are filled in).

## Re-running the research
```
node tools/probe_ads.js static     # needs only Node 18+
node tools/probe_ads.js browser    # needs playwright-core and a Chromium; run it from a home connection
```
`browser` prints `loaded: false` for a player that did not start; ignore a 0 popup count in that case. If a source you tested shows popups, add it to `ADS_KNOWN` in `public/main.js` and update this table.

## Popup blocking for hosted players (new)
Settings -> **Block popups in hosted movie players** (On by default). Hosted players run in a frame with the browser's own `sandbox` attribute set to `allow-scripts allow-same-origin allow-forms allow-presentation`, and **without** `allow-popups`, `allow-top-navigation` and `allow-modals`. The browser itself then refuses `window.open()`, "open a new tab" links, ad redirects of the whole page and alert dialogs, on Samsung TVs, Android and the web alike. Checked in a real browser with a hostile test player: with blocking on, `window.open` returned nothing, changing the top page was refused and no new tab opened; with blocking off the same player opened a tab and moved the page. On Android the app shell additionally refuses and counts popups.

What it cannot do: remove ads drawn **inside** a player's own picture (overlays, pre-roll), and a player that refuses to run in a sandboxed frame will stay blank (the app says so after 40 s; turn the setting off for that player).

## New sources: 2Embed, SuperEmbed, VidSrc.to, VidSrc.me
Added as hosted players (Auto tries them after CineSrc, VidFast, VidCore and Videasy). Their outer pages are thin shells that load the real player in a nested frame, so a static scan of the outer page (18 Oct 2026) says nothing about ads inside: 2Embed and VidSrc.me showed no ad-network code in the page itself (one / two `window.open` calls); VidSrc.to has almost no code in the shell; SuperEmbed answered 403 to the scan. They carry **no Ads tag** because nothing was found, which is "not checked deeply", not "ad-free". VidSrc.me now redirects to vidsrc.sh.

## Cyberlockers (Vidplay / Vidsrc Stream, RabbitStream, Filemoon)
Not added as direct sources. Those hosts hand out streams only through encrypted or obfuscated requests and their own catalogue ids; using them directly would mean decrypting or reverse-engineering their players, which this project does not do. VidSrc and 2Embed pages already load them internally, so they play inside those frames when available.
