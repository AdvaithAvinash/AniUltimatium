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

test('wired in: loaded by start.js, play() wrapped, nothing can open a link', () => {
  const main = read('public/main.js'), sp = read('public/sponsor.js');
  assert.match(main, /EA\.sponsor\.wants\(a\)/);
  assert.ok(!/window\.open|location\.href|\.url\b|<a /.test(sp.replace(/\/\/.*$/gm, '')), 'no click-through');
  assert.ok(!/createElement\('script'\)/.test(sp), 'the app itself never injects a script (a network banner runs only inside a sandboxed frame)');
});

test('network banner: needs an https ad page and a sane size', () => {
  const b = { page: 'https://site.example/adframe.html', width: 300, height: 250 };
  assert.ok(S.validBanner(b));
  assert.ok(!S.validBanner(Object.assign({}, b, { page: 'http://site.example/adframe.html' })));
  assert.ok(!S.validBanner(Object.assign({}, b, { width: 5000 })));
  assert.ok(!S.validBanner(null));
  const sp = fs.readFileSync(path.join(root, 'public/sponsor.js'), 'utf8').replace(/\/\/.*$/gm, '');
  assert.ok(!/allow-popups|allow-top-navigation/.test(sp), 'frame sandbox never grants popups or navigation');
  assert.ok(/frameSandbox\(cfg\.banner/.test(sp));
});

test('ad page frame: never shares the app\'s origin', () => {
  const b = { page: 'https://site.example/adframe.html' };
  assert.strictEqual(S.frameSandbox(b, 'null'), 'allow-scripts allow-same-origin');          // file:// TV / Android package: the page has its own origin
  assert.strictEqual(S.frameSandbox(b, 'http://localhost:3222'), 'allow-scripts allow-same-origin');
  assert.strictEqual(S.frameSandbox(b, 'https://site.example'), 'allow-scripts');            // the website: opaque origin, no access to the site's storage
  assert.strictEqual(S.frameSandbox({ page: 'http://site.example/x' }, 'null'), null);
  assert.strictEqual(S.frameSandbox({}, 'null'), null);
  const page = fs.readFileSync(path.join(root, 'public/adframe.html'), 'utf8');
  assert.ok(/n6wxm\.com\/vignette\.min\.js/.test(page) && !/location\.search|location\.hash|document\.referrer/.test(page), 'fixed snippet, no parameters');
  const idx = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8');
  assert.ok(!/n6wxm|bauval|vignette/.test(idx) && !/n6wxm|bauval|vignette/.test(fs.readFileSync(path.join(root, 'public/main.js'), 'utf8')), 'ad network tags never run inside the app page');
});
