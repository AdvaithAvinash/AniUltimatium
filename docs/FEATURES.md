# What is new after Stable v1.09

(These changes are in the source; they ship with the next build. The v1.09 release notes are unchanged.)

## Playback you can trust
- **Playback guard (app):** a watchdog checks the player every 2 seconds. A stream that freezes (12 s), never starts (30 s) or has sound but no picture (8 s) is recovered in steps: re-fetch in place → switch to the server relay → next source (Auto mode; SourceIQ is told) → a visible panel: **OK** retries, **Up** opens the source menu, **Back** leaves. Resolve errors ("could not start playback") get the same panel. A hosted movie player that should answer and stays silent for 40 s is replaced by the next player.
- **Stream verification (server, `lib/verify.js`):** before a stream is handed to the player the server reads it: MP4 → a ranged read must be video (not an HTML / JSON error page); HLS → the playlist must parse, a master's first variant must list segments, an encryption key must be readable, and the first segment (first 2 KB) must download and look like media (MPEG-TS, fragmented MP4, AAC, or image-wrapped segments). Add-on, debrid and CinePro streams go through the same check and the next-best candidate is used when one fails. Private addresses are never fetched. On Cloudflare Workers only the playlist is checked, to save subrequests.
- **SourceIQ quality:** besides "did it start", SourceIQ now records how a stream *played*: stall time as a share of playback, resolution reached, seconds watched, and mid-play drops (a drop counts against the source like a failed start). Rankings use start success, resolve success, start time and quality; the source picker shows "smooth" or "stutters" once there is evidence. Nothing is invented: no data means a neutral score. Stored on the device only, no URLs.

## Schedule and a personal feed
- **Schedule tab:** yesterday + the next 6 days in your local time (12 h or 24 h follows your clock setting), grouped by time, with AIRED / IN 3H / UPCOMING, and a bell to follow a show. "My list & follows" filters to shows you care about.
- **Airing info:** cards show "EP 12 · in 2d", the hero shows "New episode 12 in 5h", the detail page shows "Episode 12 airs Sat 18:30 · in 2d 3h". Server data carries it; otherwise the app asks AniList once per 30 minutes for the visible shows.
- **New episodes for you:** shows in your list (not Completed / Dropped), recent history and followed shows that have an episode out that you have not watched. It is a home row, not a push notification.
- **Because you watched …**, **Seasons & related** (prequels, sequels, side stories) and **You may also like** use AniList's recommendations and relations (cached 12 h).
- **Library statuses:** Watching / Planning / Completed / Paused / Dropped per list entry, filter chips with counts in My List, a Status button on the detail page, and automatic moves (starting an episode: Planning → Watching; finishing the last episode: Completed). Synced with your account like the rest of the list.
- **Personalization (Settings):** titles in English or Romaji, poster size (small / normal / large), airing badges on/off, new-episode alerts on/off, recommendations on/off, and **Home rows** (show, hide and reorder; Continue Watching, New episodes and Because you watched stay at the top and can be hidden).

## Notes
- All AniList data for these features is requested by the device through the app's rate-limited AniList queue, so no Worker redeploy is needed for them (the Worker's home data also carries `next` airing info after a redeploy).
- Tested in a desktop browser with a stubbed AniList and mock streams; not on real TVs or phones.

## Hosted players (later change)
2Embed, SuperEmbed, VidSrc.to and VidSrc.me are new hosted sources, and hosted players now run in a popup-blocking sandboxed frame by default. Details and limits: [SOURCE_ADS.md](SOURCE_ADS.md).
