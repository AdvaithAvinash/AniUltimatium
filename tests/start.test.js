'use strict';
// start.js loads the app: these checks keep it, index.html and main.js in step (the browser behaviour is checked by hand / in a real browser).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');

test('index.html starts through start.js and never loads the app scripts itself', () => {
  const html = read('public/index.html');
  assert.match(html, /<script src="start\.js"><\/script>/);
  for (const f of ['main.js', 'feed.js', 'live.js', 'iptv.js', 'iq.js', 'avp.js']) assert.ok(!new RegExp('<script[^>]+src="' + f.replace('.', '\\.') + '"').test(html), f + ' is loaded by start.js');
});

test('start.js lists every app script, in dependency order, and they exist', () => {
  const js = read('public/start.js'), list = (/var APP = \[([^\]]*)\]/.exec(js)[1].match(/'([^']+)'/g) || []).map(s => s.slice(1, -1));
  assert.deepStrictEqual(list, ['avp.js', 'iq.js', 'qr.js', 'iptv.js', 'main.js', 'feed.js', 'sponsor.js', 'live.js']);
  list.forEach(f => assert.ok(fs.existsSync(path.join(root, 'public', f)), f));
});

test('per-profile keys are keys the app really uses; main.js maps them and clears the crash counter', () => {
  const start = read('public/start.js'), main = read('public/main.js');
  const keys = /PERP = \/\^\(([^)]*)\)\$\//.exec(start)[1].split('|');
  assert.ok(keys.includes('ea_list') && keys.includes('ea_hist') && keys.includes('ea_progress') && keys.includes('ea_anilist'));
  keys.forEach(k => assert.ok(main.includes("'" + k + "'"), k + ' is used by main.js'));
  assert.match(main, /EA_PROF\.perProfile\.test\(k\)/);
  assert.match(main, /removeItem\('ea_boot'\)/);
  assert.match(main, /ui-modern/);
});

test('release files use the aniultimatium.* names everywhere', () => {
  const files = ['tools/build_wgt.py', 'tools/build_apk.py', '.github/workflows/release.yml', '.gitignore', 'README.md', 'docs/ANDROID.md', 'public/about.html', 'RELEASE_NOTES.md'];
  files.forEach(f => assert.ok(!/\bapp\.(wgt|apk)\b/.test(read(f)), f + ' still mentions app.wgt / app.apk'));
  assert.match(read('README.md'), /1881056/);
  assert.ok(!/adb install/.test(read('README.md') + read('docs/ANDROID.md')));
});
