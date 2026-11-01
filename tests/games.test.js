'use strict';
// Gamehub: OmniRift is hosted on the website (public/omnirift), shown full screen in the app with its creator's credit, and never packed into the TV / Android app.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');

test('OmniRift files are on the site: the game page, the remote adapter and every asset it loads', () => {
  const page = read('public/omnirift/index.html');
  assert.match(page, /^<!doctype html>/i);
  assert.match(page, /<script src="tvremote\.js"><\/script>\s*$/);
  assert.ok(!/\?\.|\?\?/.test(page.split('<script>').slice(-1)[0].split('start();')[1] || ''), 'no syntax older TVs cannot read in the start line');
  const want = new Set();
  (page.match(/'assets\/[a-z_]+\.mp3'/g) || []).forEach(m => want.add(m.slice(8, -1)));
  ['hero', 'dummy', 'vesper', 'kame', 'sans', 'saiyan', 'boxer', 'assassin', 'slash', 'dodge', 'gblock', 'gattack', 'gspin'].forEach(n => want.add(n + '.json'));
  want.forEach(f => assert.ok(fs.existsSync(path.join(root, 'public/omnirift/assets', f)), f));
});

test('Gamehub in the app: card + full-screen frame with gamepad/autoplay/fullscreen and the creator credit; can be hidden; not in the app packages', () => {
  const main = read('public/main.js'), html = read('public/index.html');
  assert.match(html, /<iframe id="gameFrame"[^>]*allow="gamepad; autoplay; fullscreen"/);
  assert.match(html, /data-tab="games"/);
  assert.match(main, /by: '@unboxingdetective', link: 'https:\/\/www\.youtube\.com\/@unboxingdetective'/);
  assert.match(main, /' — made by ' \+ g\.by \+ ' on YouTube · '/);
  assert.match(main, /\['ea_c_games', 'Gamehub', true, SHOWN, applyCats\]/);
  assert.match(main, /if \(state\.view === 'game'\) \{ closeGame\(\); return; \}/, 'Back leaves the game');
  assert.match(read('tools/build_wgt.py'), /WEB_ONLY_DIRS = \{"omnirift"\}/);
  assert.match(read('tools/build_apk.py'), /not os\.path\.isfile\(os\.path\.join\(pub, f\)\)/, 'the APK only takes top-level files');
});

test('TV remote adapter: number / colour / Play-Pause buttons become the game keys, without double presses', () => {
  const src = read('public/omnirift/tvremote.js');
  assert.ok(!/=>|`|\blet |\bconst /.test(src), 'plain ES5');
  for (const [k, c] of [[49, 'Comma'], [50, 'Period'], [51, 'Slash'], [52, 'Semicolon'], [403, 'Comma'], [406, 'Slash'], [10252, 'Escape']]) assert.match(src, new RegExp(k + ": '" + c + "'"));
  assert.match(src, /if \(!c \|\| e\.__aniu\) return null;/, 'its own events are not mapped again');
  assert.match(src, /if \(NAMED_ONLY\[e\.keyCode\] && e\.code\) return null;/, 'normal arrows / Enter are left to the game');
});
