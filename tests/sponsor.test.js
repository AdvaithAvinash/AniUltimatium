'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const S = require('../public/sponsor.js');
const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const NOW = Date.parse('2026-06-15T12:00:00');

test('only https video files and https pictures are usable, inside their dates', () => {
  assert.ok(S.validVideo({ video: 'https://a.example/x.mp4' }, NOW));
  assert.ok(!S.validVideo({ video: 'http://a.example/x.mp4' }, NOW));
  assert.ok(!S.validVideo({ video: 'https://a.example/x.html' }, NOW));
  assert.ok(!S.validVideo({ video: 'https://a.example/x.mp4', to: '2026-06-14' }, NOW));
  assert.ok(S.validVideo({ video: 'https://a.example/x.mp4', to: '2026-06-15' }, NOW));
  assert.ok(!S.validVideo({ video: 'https://a.example/x.mp4', from: '2026-06-16' }, NOW));
  assert.ok(S.validImage({ image: 'https://a.example/b.jpg' }, NOW));
  assert.ok(!S.validImage({ image: 'javascript:alert(1)' }, NOW));
});

test('nothing is picked unless enabled; weights are honoured', () => {
  const cfg = { enabled: true, preroll: [{ video: 'https://a/x.mp4', weight: 1 }, { video: 'https://a/y.mp4', weight: 3 }], pause: [{ image: 'https://a/i.jpg' }] };
  assert.strictEqual(S.pickVideo({ enabled: false, preroll: cfg.preroll }, NOW, 0), null);
  assert.strictEqual(S.pickVideo(null, NOW, 0), null);
  assert.strictEqual(S.pickVideo(cfg, NOW, 0.1).video, 'https://a/x.mp4');
  assert.strictEqual(S.pickVideo(cfg, NOW, 0.9).video, 'https://a/y.mp4');
  assert.strictEqual(S.pickImage(cfg, NOW, 0.5).image, 'https://a/i.jpg');
  assert.strictEqual(S.pickImage({ enabled: true, pause: [] }, NOW, 0), null);
});

test('anime: one ad per session; movies / TV: one per different title', () => {
  const seen = { anime: false, last: '' };
  assert.ok(S.due(seen, 'anime', 1));
  seen.anime = true;
  assert.ok(!S.due(seen, 'anime', 2));
  assert.ok(S.due(seen, 'movie', 'm1'));
  seen.last = 'movie:m1';
  assert.ok(!S.due(seen, 'movie', 'm1'));
  assert.ok(S.due(seen, 'movie', 'm2'));
  assert.ok(S.due(seen, 'tv', 'm1'));
});

test('skip is allowed after 20 s by default, never later than the ad is long', () => {
  assert.strictEqual(S.skipAfter({}, 0), 20);
  assert.strictEqual(S.skipAfter({ skipAfter: 25 }, 30), 25);
  assert.strictEqual(S.skipAfter({ skipAfter: 99 }, 30), 20);
  assert.strictEqual(S.skipAfter({}, 12), 11);
});

test('wired in: loaded by start.js, play() wrapped, pause ads have a setting, nothing can open a link', () => {
  const main = read('public/main.js'), sp = read('public/sponsor.js');
  assert.match(main, /EA\.sponsor\.wants\(a\)/);
  assert.match(main, /'ea_pauseads'/);
  assert.match(sp, /You can turn off these pause ads in settings\./);
  assert.ok(!/window\.open|location\.href|\.url\b|<a /.test(sp.replace(/\/\/.*$/gm, '')), 'no click-through');
  assert.ok(!/createElement\('script'\)|<script/.test(sp), 'no third-party scripts');
});
