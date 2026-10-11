# Aniultimatium — Stable v1.03

Samsung Tizen TV app (`app.wgt`, widget version 2.4.0) + laptop web app, backend on Cloudflare Workers
(`https://aniultimatium.advaithavinash404.workers.dev`).
Install `app.wgt` with [Apps2Samsung](https://github.com/Apps2Samsung/Apps2Samsung/releases).

## New
- **AniList**: link your account from the TV with a 6-letter code (sign in on your phone at `/link.html`).
  Episodes you finish update your AniList progress; *AniList · Watching* row on the home page; status button on each show.
  (Server needs `ANILIST_CLIENT_ID` — see README.)
- **Movies**: more sources — CineSrc (default), VidFast, VidCore, Videasy, plus public-domain films in our own player.
- **Movie control bar**: press **Down** in a movie for a seek bar with time, −10 / play-pause / +10, subtitles, subtitle sync,
  settings and exit. Left/Right skip 10s anytime.
- If an embedded player ignores the remote's commands, the app says so and hands the remote to the player's own controls.

## Anime
- Sources: **AnimeX** (default) → AniKoto → AnimeYubi → AniWaves, tried one by one; the app skips a source that
  does not play and moves on by itself. Next episode is looked up in the background.
- English sub found for 59/59 popular and current-season shows in testing; English dub for 49/59 (the rest have no dub yet).

## Fixes
- Back closes the player menu / control bar instead of leaving the player.
- OpenSubtitles is chosen automatically for subtitles.
- Works on Cloudflare Workers (AniList is queried from the device when the Worker is blocked).
