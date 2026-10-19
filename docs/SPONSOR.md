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

## Network banner (optional, e.g. Adsterra "Banner", format iframe)
Add a `"banner": { "key": "<32 hex>", "src": "https://<network>/<path>/<key>", "width": 300, "height": 250 }` block to `sponsor.json` (the values come from the network's embed code). It is shown as the **pause ad**, from a small ad page on your site (`page`, e.g. `/adframe.html`) inside a frame that has *no* permission to open windows or navigate the page. The TV and Android apps run from a different origin than that page, so the ad script cannot read the app's data; on the website itself the frame is sandboxed without an origin for the same reason; if you also list your own pause pictures, the two take turns. The network can see the request its banner makes (like any web ad), so mention that in your privacy text. Use only the *Banner* format: popunder, smartlink and social bar redirect viewers and are not used.
