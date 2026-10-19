# Sponsor ads

Aniultimatium can show sponsor ads that **you choose yourself**. There is no ad network, no third-party script, no tracking and no link that opens when a viewer presses OK on an ad.

## What viewers see
- **Pre-roll:** one video labelled "Ad" before a title starts. Anime: once per app session. Movies and TV: once per different title (not per episode). Skip is offered after `skipAfter` seconds (default 20). If the ad cannot load or freezes, playback just starts.
- **Pause ad:** a picture labelled "Ad" for 15 seconds while a video is paused, with the line "You can turn off these pause ads in settings." Settings -> Pause ads switches it off.
- Nothing is shown during playback, and nothing is shown in Live TV or inside the hosted embed players.

## Setting it up
Edit `sponsor.json` in the repository root on GitHub (no new release needed; the app re-reads it every 6 hours, and keeps the last copy offline):

```json
{ "enabled": true,
  "preroll": [{ "id": "a", "video": "https://cdn.example/ad.mp4", "skipAfter": 20, "weight": 1, "from": "2026-11-01", "to": "2026-11-30" }],
  "pause":   [{ "id": "p", "image": "https://cdn.example/banner.jpg", "alt": "Sponsor", "weight": 1 }] }
```
Videos must be https `.mp4` / `.webm` (H.264 MP4 plays everywhere); pictures https, about 640x360. `weight`, `from` and `to` are optional. `"enabled": false` turns everything off.
