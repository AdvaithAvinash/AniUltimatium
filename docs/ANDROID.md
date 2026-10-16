# Aniultimatium for Android TV and Fire TV

`app.apk` is the same app as the Samsung `.wgt`, in a small native shell (one WebView, no extra libraries, about 0.3 MB including hls.js). It runs on **Android TV / Google TV**, **Amazon Fire TV** (Fire OS 5 and newer), Android tablets and phones. Minimum: Android 5.0 (API 21).

> Status: built and statically verified (valid signature, TV launcher entry, banner, permissions) and the web app was tested under the same conditions the shell creates (file origin, no CORS, TV user-agent, remote keys). It has **not** been run on a physical TV or an emulator yet. Please report problems with the device model and Android/Fire OS version.

## Install
**Fire TV (Fire Stick, Fire TV Cube, Fire TV TVs)**
1. Settings → My Fire TV → Developer options → turn on *Install unknown apps* for **Downloader** (install Downloader from the Amazon store first).
2. In Downloader, open `https://github.com/AdvaithAvinash/AniUltimatium/releases/latest`, choose `app.apk`, install.
3. Find it under Your Apps & Channels.

**Android TV / Google TV**
1. Settings → Device Preferences → Security & restrictions → *Unknown sources* (allow your file manager or Downloader).
2. Copy `app.apk` to the TV (Downloader, a USB stick, or "Send files to TV") and open it.

**From a computer (any of them)**
```
adb connect <tv-ip>:5555
adb install app.apk
```
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
python3 tools/build_apk.py        # copies public/ into the app, builds, writes app.apk (version from package.json)
```
`android/` is a plain Gradle project (AGP 8.5, no AndroidX): `MainActivity.java` is the whole shell. `tests/android.test.js` keeps the shell and the web app's key codes and hooks in step.
