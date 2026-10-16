# Aniultimatium — Stable v1.05

Free English **sub & dub** anime app for **Samsung Tizen smart TVs** (Tizen 4.0 / 2018 and newer) and browsers.
Install `app.wgt` with [Apps2Samsung](https://github.com/Apps2Samsung/Apps2Samsung/releases) (custom wgt). Widget version 2.6.0.
Backend: Cloudflare Worker (`https://aniultimatium.advaithavinash404.workers.dev`) or `npm start` at home.

## Fixed — movies stuck on "fetching media" on Tizen 4
Reported on Tizen 4.0 (v1.04): a movie never started, and the debug console showed `SyntaxError: Unexpected token .` / `?` from `cinesrc.st/_next/static/chunks/…js`.
Cause: movies play inside other sites' players (CineSrc, VidFast, VidCore, Videasy). Their own code uses 2020+ JavaScript (`?.`, `??`, `globalThis`) that the browser in
Tizen 4 (Chromium 56) cannot even read, so the player page never starts. This is not in our code and cannot be fixed from the app.
What changed:
- The app detects an old engine (Tizen 4/5/5.5/6) and says so instead of hanging: it explains why, and OK still lets you try the player.
- A watchdog notices a player that never starts (20 s on old TVs) and offers the next player instead of leaving you stuck.
- On old TVs, pressing OK no longer hands the remote to a dead player page (that was one way the controls got stuck).
- Public-domain films still play in our own player on every TV (Source: Public domain), and all anime plays normally.
Verified in a Chromium 60 engine (the closest available to Tizen 4): the notice appears, OK loads the player, the watchdog fires after 20 s, Back always exits.

## Fixed — quality control "stuck" in the player
The Quality row read the level that was *playing*, which only changes after the next video segment, so each press seemed to do nothing or jump back.
It now follows the level you picked. Tested with a 3-level stream: v1.04 showed 720p, 720p, 480p, 480p for four presses; v1.05 shows 720p, 480p, 360p, Auto, and the picture follows each step.

## New — subtitle position and size
Subtitles now sit lower by default ("Low"), and you can move them: **Settings → Subtitles**, or in the player **Up → Subtitle position** (Right = lower).
Six positions from *Lowest* to *Highest* (*Classic* is the v1.04 height) and four sizes. Works for anime and for movie/TV players. When the player controls are shown, low subtitles lift above them.

## New — TV shows
A **TV Shows** tab (popular this week, new releases, top rated, genres), search, seasons and episodes, resume, next episode at the end and with the Next button,
and OpenSubtitles matched to the season and episode. They use the same players as movies (CineSrc, VidFast, VidCore, Videasy), so on Tizen 4 they have the same limit as movies.

## New — "Popular This Week" and "New Releases"
- Anime: from the episodes that actually aired in the last 7 days (AniList airing schedule), most popular first, and the newest episodes first.
- Movies and TV: Cinemeta's current popularity list and this year's releases.

## Fixed — AniList errors ("rate limit")
AniList allows 30 requests a minute and answered extra requests with an error. The app now:
- sends every AniList request through one queue, slows down when AniList says few requests are left, and on a "too many requests" answer waits the time AniList asks for and retries (twice);
- keeps AniList data on the device (home page 15 min, show records up to 12 h), so reopening a show or the home page costs no request;
- asks once instead of twice when you open a show while linked; refreshes the Watching row every 5 min instead of every 2.
Tested with a simulated "too many requests": the home page still loads after the retry, a reload uses the saved page, and opening the same show twice makes one request.

## Faster on Tizen 4
Chromium 56 ignores `loading="lazy"`, so v1.04 downloaded every cover on the home page at start. v1.05 loads pictures only when they come near the screen
(and the next few in a row when you move), uses smaller cover files for cards, and turns on **Lite mode** automatically on Tizen 4 (no animations, no rotating banner; switchable in Settings).
Measured in Chromium 60, home page, first 8 seconds, 3 runs each: **114 → 10 pictures, 22.3 MB → 0.77 MB downloaded**. Time until the first row appears did not change (about 0.6–0.9 s in both).

## Tests
`npm test` (29 unit tests + Tizen-4 compatibility check), end-to-end browser tests (back key, control bar, source switching, SourceIQ, crash recovery, TV flow, subtitle position,
AniList 429 handling, quality switching) and Chromium 60 runs. Limitation: playback on a real TV cannot be tested here.
