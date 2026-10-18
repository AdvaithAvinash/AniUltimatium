'use strict';
// feed.js (Schedule, airing countdowns, alerts, recommendations) and the library / personalization hooks in main.js: the browser behaviour is checked in a real browser;
// these keep the pieces wired together.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');

test('Schedule tab is wired: button, view, icon, name, hook, feed.js loaded after main.js', () => {
  const html = read('public/index.html'), main = read('public/main.js'), start = read('public/start.js');
  assert.match(html, /data-tab="schedule"/); assert.match(html, /id="viewSchedule"/); assert.match(html, /id="schDays"/);
  assert.match(main, /schedule: 'viewSchedule'/); assert.match(main, /schedule: 'cal'/); assert.match(main, /schedule: 'Schedule'/);
  assert.match(main, /t === 'schedule' && EA\.feed/);
  const list = (/var APP = \[([^\]]*)\]/.exec(start)[1].match(/'([^']+)'/g) || []).map(s => s.slice(1, -1));
  assert.ok(list.indexOf('feed.js') > list.indexOf('main.js') && list.indexOf('feed.js') < list.indexOf('live.js'));
});

test('feed.js uses only what main.js exports', () => {
  const feed = read('public/feed.js'), main = read('public/main.js');
  const used = [...feed.matchAll(/EA\.([A-Za-z_]+)/g)].map(m => m[1]).filter(n => !['feed'].includes(n));
  const bridge = /var EA = window\.EA = \{([\s\S]*?)\n\s*hasCls:/.exec(main)[1] + 'hasCls up IS_TV OLD_ENGINE CHROME_V lite showTab paintTabs live';
  for (const n of new Set(used)) assert.ok(new RegExp('\\b' + n + '\\b').test(bridge), 'EA.' + n + ' is exported by main.js');
});

test('library statuses, personalization and airing info exist in main.js', () => {
  const main = read('public/main.js'), html = read('public/index.html');
  for (const k of ['ea_tlang', 'ea_pz', 'ea_airbadge', 'ea_alerts', 'ea_recs', 'ea_rows']) assert.ok(main.includes("'" + k + "'"), k);
  assert.match(main, /ST_ORDER = \['watching', 'planning', 'completed', 'paused', 'dropped'\]/);
  assert.match(html, /id="dStatus"/); assert.match(html, /id="listChips"/); assert.match(html, /id="setRowsBtn"/); assert.match(html, /id="dMore"/);
  assert.match(read('api/index.js'), /next: m\.nextAiringEpisode/);
});

test('playback guard: the recovery ladder and the visible failure panel are in place', () => {
  const main = read('public/main.js');
  for (const s of ['function guardTick', 'function guardEscalate', 'function showPlayFail', 'function retryPlay', 'OK: try again', 'recoverMediaError', 'fallbackToProxy()', 'streamDead()']) assert.ok(main.includes(s), s);
  assert.match(main, /state\.playFail && \(k === KEY\.ENTER/);
});
