'use strict';
// Gamehub: ClassiCube is hosted on the website (public/classicube), shown full screen in the app with its credit, and never packed into the TV / Android app.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');

test('Gamehub in the app: card + full-screen frame with gamepad/autoplay/fullscreen and the credit; can be hidden; not in the app packages', () => {
  const main = read('public/main.js'), html = read('public/index.html');
  assert.match(html, /<iframe id="gameFrame"[^>]*allow="gamepad; autoplay; fullscreen"/);
  assert.match(html, /data-tab="games"/);
  assert.ok(!/omnirift/i.test(main), 'OmniRift is not in the app any more');
  assert.ok(!fs.existsSync(path.join(root, 'public/omnirift')));
  assert.match(main, /\['ea_c_games', 'Gamehub', true, SHOWN, applyCats\]/);
  assert.match(main, /if \(state\.view === 'game'\) \{ gameBack\(\); return; \}/, 'Back pauses, Back again leaves');
  assert.match(main, /if \(now - \(state\.gameBackAt \|\| 0\) < 2500\) \{ state\.gameBackAt = 0; closeGame\(\); return; \}/);
  assert.match(read('tools/build_wgt.py'), /WEB_ONLY_DIRS = \{"classicube"\}/);
  assert.match(read('tools/build_apk.py'), /not os\.path\.isfile\(os\.path\.join\(pub, f\)\)/, 'the APK only takes top-level files');
});

test('ClassiCube: official web build + texture pack + licence on the site, singleplayer, remote adapter, Gamehub card with credit', () => {
  const page = read('public/classicube/index.html'), js = read('public/classicube/ClassiCube.js'), main = read('public/main.js');
  assert.match(page, /arguments: \['Player'\]/, 'singleplayer');
  assert.match(page, /<script src="tvremote\.js"><\/script>\s*<script async src="ClassiCube\.js"><\/script>/);
  assert.match(js, /var url  = 'default\.zip';/, 'texture pack from the same folder');
  assert.ok(fs.existsSync(path.join(root, 'public/classicube/default.zip')));
  assert.match(read('public/classicube/LICENSE.txt'), /Redistribution and use in source and binary forms/);
  const tv = read('public/classicube/tvremote.js');
  assert.ok(!/=>|`|\blet |\bconst /.test(tv), 'plain ES5');
  for (const [k, c] of [['37', 'KeyA'], ['38', 'KeyW'], ['39', 'KeyD'], ['40', 'KeyS'], ['13', 'Space']]) assert.match(tv, new RegExp(k + ": \\['" + c + "'"));
  assert.match(main, /id: 'classicube', title: 'ClassiCube'/);
  assert.match(main, /credit: 'ClassiCube — open source \(BSD licence\)/);
});
