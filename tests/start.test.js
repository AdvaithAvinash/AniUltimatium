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
  const start = read('public/start.js'), main = read('public/main.js'), app = main + read('public/sponsor.js');
  const keys = /PERP = \/\^\(([^)]*)\)\$\//.exec(start)[1].split('|');
  assert.ok(keys.includes('ea_list') && keys.includes('ea_hist') && keys.includes('ea_progress') && keys.includes('ea_anilist'));
  keys.forEach(k => assert.ok(app.includes("'" + k + "'"), k + ' is used by the app (main.js / sponsor.js, through the per-profile store)'));
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

test('profiles can be added and removed: Manage profiles on the picker, Remove a profile in Settings, data goes with it', () => {
  const start = read('public/start.js'), main = read('public/main.js');
  assert.match(start, /btn\(edit \? 'Done' : 'Manage profiles'/);
  assert.match(start, /function confirmRemove\(p, back, removed\)/);
  assert.match(start, /if \(p\.pin\) askPin\(p, go, back\); else go\(\);/, 'a locked profile needs its PIN to be removed');
  assert.match(start, /id === 'p1' \? PERP\.test\(k\) : k\.slice/, 'the first profile\'s data (plain key names) is deleted too, so a new p1 starts empty');
  assert.match(start, /manage: function \(done\)/);
  assert.match(main, /\['pman', 'Remove another profile'/);
  assert.match(main, /if \(EA_PROF\.removeCurrent\) rows\.push\(\['pdel', 'Delete this profile'/, 'Delete this profile is always offered, even with one profile');
  assert.match(start, /remove: function \(id, allowLast\)/);
  assert.match(main, /if \(k === 'pman'\) \{ EA_PROF\.manage\(/);
  assert.match(start, /if \(!edit && l\.length < 6\) \{ var add = el\('button', 'atile add'/, 'Add profile tile (up to 6)');
});

test('Customize: colours, each category can be hidden (one always stays), ads switch', () => {
  const main = read('public/main.js'), sp = read('public/sponsor.js'), html = read('public/index.html');
  assert.match(html, /id="setCustomize"/);
  for (const k of ['ea_accent', 'ea_c_anime', 'ea_c_movies', 'ea_c_tv', 'ea_c_live', 'ea_ads']) assert.ok(main.includes("['" + k + "'"), k);
  assert.match(main, /Keep at least one category on/);
  assert.match(main, /tabs\[i\]\.className = 'tab' \+ \(on \? ' focusable' : ''\)/, 'a hidden tab cannot be reached with the remote');
  assert.match(sp, /\|\| !adsOn\(\)\) return false;/, 'the ads switch stops the pre-roll');
  assert.match(sp, /state\.liveOn \|\| !adsOn\(\)\) return;/, 'and the pause ad');
});

test('Back on the first screen asks "Exit Aniultimatium?" (No by default, Back means No) instead of closing straight away', () => {
  const main = read('public/main.js');
  assert.match(main, /else askExit\(\);/);
  assert.match(main, /Exit Aniultimatium\?/);
  assert.match(main, /var prev = state\.focusEl, sel = 1;/, 'No is selected first');
  assert.match(main, /else if \(isBackKey\(k\) \|\| k === KEY\.STOP\) \{ close\(\); return; \}/);
  assert.ok(!/else if \(IS_TV && window\.tizen && tizen\.application\) tizen\.application\.getCurrentApplication\(\)\.exit\(\);\n/.test(main.split('function goBack')[1].split('function canExit')[0]), 'goBack itself never exits');
});
