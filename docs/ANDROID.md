# Aniultimatium for Android TV and Fire TV

`aniultimatium.apk` is the same app as the Samsung `.wgt`, in a small native shell (one WebView, no extra libraries, about 0.3 MB including hls.js). It runs on **Android TV / Google TV**, **Amazon Fire TV** (Fire OS 5 and newer), Android tablets and phones. Minimum: Android 5.0 (API 21).

> Status: built and statically verified (valid signature, TV launcher entry, banner, permissions) and the web app was tested under the same conditions the shell creates (file origin, no CORS, TV user-agent, remote keys). It has **not** been run on a physical TV or an emulator yet. Please report problems with the device model and Android/Fire OS version.

## Install
**Fire TV (Fire Stick, Fire TV Cube, Fire TV TVs)**
1. Settings → My Fire TV → Developer options → turn on *Install unknown apps* for **Downloader** (install Downloader from the Amazon store first).
2. In Downloader, enter the code **`DOWNLOADER-CODE-HERE`** (placeholder, to be added), or open `https://github.com/AdvaithAvinash/AniUltimatium/releases/latest` and choose `aniultimatium.apk`, then install.
3. Find it under Your Apps & Channels.

**Android TV / Google TV**
1. Settings → Device Preferences → Security & restrictions → *Unknown sources* (allow your file manager or Downloader).
2. Send `aniultimatium.apk` to the TV with **Send Files to TV** (phone or computer and TV on the same Wi-Fi), a USB stick, or Downloader, then open it on the TV and install. If Downloader is not available, create an aftnews shortcut and use Downloader from there.

Updates install over the old version because every release is signed with the same key (`android/aniultimatium.keystore`; it is a project key for sideloading, not a secret and not for the Play Store).

## What the shell adds
- **TV launcher entry** with a banner image, full-screen window, screen kept awake.
- **Remote:** D-pad and OK as usual; Back goes to the app's own Back (menus, players, tabs) and closes the app at the top; media keys, colour keys (Yellow favorite, Green previous channel, Blue sleep timer), Menu, Info and channel up/down are mapped to what the app already understands.
- **Popup blocking:** `window.open` from movie players and ad redirects of the page are refused and counted, which also tags the source "Ads" (see [SOURCE_ADS.md](SOURCE_ADS.md)).
- **No CORS for the bundled page**, like the Samsung widget: IPTV playlists, guides and streams from providers that do not allow browsers load directly, and `http://` streams are allowed.
- IPTV works exactly as on Samsung ([IPTV.md](IPTV.md)); add a playlist from your phone with the code or QR.

## Build it yourself
Needs JDK 17+ and the Android SDK (platform 34, build-tools 34). Set `ANDROID_HOME`, then:
```
python3 tools/build_apk.py        # copies public/ into the app, builds, writes aniultimatium.apk (version from package.json)
```
`android/` is a plain Gradle project (AGP 8.5, no AndroidX): `MainActivity.java` is the whole shell. `tests/android.test.js` keeps the shell and the web app's key codes and hooks in step.

## Orientation, rotation and screens (Beta v1.09)
- The UI is a 16:9 landscape layout, so the app is locked to landscape **in both directions** (`sensorLandscape`): a phone held upright still opens landscape, and flipping the phone 180° flips the app without restarting it. `android.hardware.screen.landscape` / `portrait` are declared as not required, so no device is filtered out.
- Rotation, split-screen, window resize and keyboard changes are listed in `configChanges` and handled in `MainActivity.onConfigurationChanged`: the page is resized, **never reloaded** (it used to lose the player on some devices). `resizeableActivity` is on for tablets, foldables and Chromebooks.
- Notches and punch-holes (Android 9+): `shortEdges` cutout mode; Android 11+: the modern full-screen / transient-bars API. `adjustPan` keeps text inputs visible when the soft keyboard opens on a phone.
- Leaving the app (Home, another app) pauses the picture and sound. If Android kills the WebView process (low memory) the app reloads itself instead of crashing.
- Game controllers: A = OK, B = Back. All of this is built and statically checked; it has **not** been run on a real device or an emulator.

## Player on Android
The Android app plays everything in the WebView's **HTML5 `<video>` player with hls.js** (hardware-decoded by the system WebView): anime, Live TV and add-on / debrid streams. Hosted movie players run in an embedded frame, with popups blocked. Samsung's AVPlay engine is Tizen-only and is never used here. A native ExoPlayer was considered and not added: it cannot be tested without a device, and the HTML5 path is what the rest of the app (subtitles overlay, skip buttons, quality menu) is built on.
