'use strict';
// The Android TV / Fire TV shell cannot be run in CI (no emulator), so these checks keep the shell and the web app in step.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');

test('manifest: TV launcher entry, banner, no touchscreen needed, http streams allowed, Android 5+', () => {
  const m = read('android/app/src/main/AndroidManifest.xml');
  assert.match(m, /android\.intent\.category\.LEANBACK_LAUNCHER/);
  assert.match(m, /android\.intent\.category\.LAUNCHER/);
  assert.match(m, /android:banner="@drawable\/banner"/);
  assert.match(m, /android\.hardware\.touchscreen"\s+android:required="false"/);
  assert.match(m, /android\.software\.leanback"\s+android:required="false"/);
  assert.match(m, /usesCleartextTraffic="true"/);
  assert.match(m, /android\.permission\.INTERNET/);
  assert.ok(fs.existsSync(path.join(root, 'android/app/src/main/res/drawable-xhdpi/banner.png')), 'banner image exists');
  assert.ok(fs.existsSync(path.join(root, 'android/aniultimatium.keystore')), 'signing key exists');
  const g = read('android/app/build.gradle');
  assert.match(g, /minSdk 21/);
});

test('shell and web app agree on the hooks, the user-agent token and the key codes', () => {
  const java = read('android/app/src/main/java/com/aniultimatium/tv/MainActivity.java'), main = read('public/main.js'), live = read('public/live.js');
  assert.match(java, /AniUltimatiumTV\//, 'shell adds the user-agent token');
  assert.match(main, /AniUltimatiumTV/, 'web app recognises it as a TV');
  for (const hook of ['EA_key', 'EA_popup']) { assert.ok(java.includes(hook), 'shell calls ' + hook); assert.ok(main.includes('window.' + hook), 'web app defines ' + hook); }
  assert.ok(java.includes('tizenhwkey') && main.includes("'tizenhwkey'"), 'Back is sent as the hardware-back event the app already handles');
  assert.match(main, /AniNative\.exit/, 'Back at the root closes the app');
  assert.match(java, /onCreateWindow[\s\S]{0,420}return false/, 'popups are refused');
  assert.match(java, /shouldOverrideUrlLoading[\s\S]{0,700}return true/, 'the top page cannot be redirected away');
  assert.match(java, /setAllowUniversalAccessFromFileURLs\(true\)/, 'bundled page can reach any provider (no CORS), like the Samsung widget');
  // every code the shell sends is a code the web app listens for
  const sent = [...java.matchAll(/return (\d{2,5});/g)].map(m => +m[1]);
  assert.ok(sent.length >= 10);
  const known = new Set([...main.matchAll(/\b(\d{2,5})\b/g)].map(m => +m[1]).concat([...live.matchAll(/\b(\d{2,5})\b/g)].map(m => +m[1])));
  for (const code of new Set(sent)) assert.ok(known.has(code), 'web app knows key code ' + code);
});

test('version and web-only file lists are consistent between wgt, apk and package.json', () => {
  const pkg = JSON.parse(read('package.json'));
  assert.match(pkg.version, /^\d+\.\d+\.\d+(-beta\.\d+)?$/, 'build_apk.py needs this shape');
  const list = f => new Set([...read(f).match(/WEB_ONLY = \{([^}]*)\}/)[1].matchAll(/['"]([^'"]+)['"]/g)].map(m => m[1]));
  const wgt = list('tools/build_wgt.py'), apk = list('tools/build_apk.py');
  for (const f of wgt) assert.ok(apk.has(f), 'APK also leaves out ' + f);
  assert.ok(apk.has('config.xml'), 'the Samsung manifest is not shipped in the APK');
  assert.match(read('public/index.html'), /<script async src="hls\.min\.js">/, 'hls.js is bundled, not fetched from a CDN');
  assert.ok(fs.existsSync(path.join(root, 'public/hls.min.js')));
});
