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

test('anime: one ad per day; movies / TV: one per different title', () => {
  const seen = { animeDay: '', last: '' };
  assert.ok(S.due(seen, 'anime', 1, '2026-10-19'));
  seen.animeDay = '2026-10-19';
  assert.ok(!S.due(seen, 'anime', 2, '2026-10-19'));
  assert.ok(S.due(seen, 'anime', 2, '2026-10-20'), 'a new day, a new ad');
  assert.ok(S.due(seen, 'movie', 'm1', '2026-10-19'));
  seen.last = 'movie:m1';
  assert.ok(!S.due(seen, 'movie', 'm1', '2026-10-19'));
  assert.ok(S.due(seen, 'movie', 'm2', '2026-10-19'));
  assert.ok(S.due(seen, 'tv', 'm1', '2026-10-19'));
});

test('VAST: picks a progressive https mp4 near 720p, never streaming or http; macros are filled', () => {
  const f = (o) => Object.assign({ url: 'https://cdn.example/a.mp4', type: 'video/mp4', delivery: 'progressive', height: 720, bitrate: 1500 }, o);
  assert.strictEqual(S.pickMedia([f({ height: 360, url: 'https://cdn.example/360.mp4' }), f({ height: 720, url: 'https://cdn.example/720.mp4' }), f({ height: 1080, url: 'https://cdn.example/1080.mp4' })]).url, 'https://cdn.example/720.mp4');
  assert.strictEqual(S.pickMedia([f({ delivery: 'streaming' }), f({ type: 'application/x-mpegURL' }), f({ url: 'http://cdn.example/a.mp4' })]), null);
  assert.strictEqual(S.pickMedia([f({ type: 'video/webm', url: 'https://cdn.example/w.webm' }), f({ url: 'https://cdn.example/m.mp4', height: 480 })]).url, 'https://cdn.example/m.mp4', 'mp4 before webm');
  assert.ok(!/\[TIMESTAMP\]/.test(S.fillMacros('https://t.example/p?ts=[TIMESTAMP]&r=[CACHEBUSTING]')));
  assert.strictEqual(S.fillMacros('https://t.example/e?code=[ERRORCODE]', 405), 'https://t.example/e?code=405');
  const sp = fs.readFileSync(path.join(root, 'public/sponsor.js'), 'utf8');
  assert.ok(!/ClickThrough|VideoClicks|JavaScriptResource/.test(sp.replace(/\/\/.*$/gm, '')), 'no click-through, no ad-verification scripts');
  assert.ok(S.httpsUrl(JSON.parse(fs.readFileSync(path.join(root, 'sponsor.json'), 'utf8')).vast.url));
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
  assert.ok(!/window\.open|location\.href|<a /.test(sp.replace(/\/\/.*$/gm, '')), 'nothing in the ads can open a page (the support QR is scanned on the phone)');
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

test('Support the app: Settings button, QR for the phone, link comes from sponsor.json, nothing opens by itself', () => {
  const idx = fs.readFileSync(path.join(root, 'public/index.html'), 'utf8'), main = fs.readFileSync(path.join(root, 'public/main.js'), 'utf8'), sp = fs.readFileSync(path.join(root, 'public/sponsor.js'), 'utf8');
  assert.match(idx, /id="setSupportBtn"/);
  assert.match(main, /setSupportBtn[^\n]*EA\.sponsor\.support\(\)/);
  assert.match(sp, /EA\.qr\(\$\('smQr'\), u\)/);
  assert.match(sp, /it is an ad/);
  const cfg = JSON.parse(fs.readFileSync(path.join(root, 'sponsor.json'), 'utf8'));
  assert.ok(S.httpsUrl(cfg.support.url));
});

test('VAST: one creative is used (short ones first), never a mix of two', () => {
  const m = (u) => [{ url: u, type: 'video/mp4', delivery: 'progressive', height: 720, bitrate: 1000 }];
  const long = { dur: 93, media: m('https://cdn.example/long.mp4'), track: {} }, short = { dur: 20, media: m('https://cdn.example/short.mp4'), track: {} };
  assert.strictEqual(S.chooseLinear([long, short]).file.url, 'https://cdn.example/short.mp4');
  assert.strictEqual(S.chooseLinear([short, long]).file.url, 'https://cdn.example/short.mp4');
  assert.strictEqual(S.chooseLinear([long]).file.url, 'https://cdn.example/long.mp4');
  assert.strictEqual(S.chooseLinear([{ dur: 20, media: [], track: {} }]), null);
});

test('video ad relay: web-only page that fetches only the tag from sponsor.json and the wrappers it names', () => {
  const r = fs.readFileSync(path.join(root, 'public/vastrelay.html'), 'utf8');
  assert.match(r, /if \(!allowed\[d\.url\]\) \{ reply\(\{ ok: false/);
  assert.match(r, /credentials: 'omit'/, 'the ad server answers with "*", which browsers refuse together with cookies');
  assert.ok(!/=>|`|\blet |\bconst /.test(r), 'plain ES5 for Tizen 4');
  for (const f of ['tools/build_wgt.py', 'tools/build_apk.py']) assert.match(fs.readFileSync(path.join(root, f), 'utf8'), /vastrelay\.html/, f + ' keeps it out of the app package');
  const cfg = JSON.parse(fs.readFileSync(path.join(root, 'sponsor.json'), 'utf8'));
  assert.ok(S.httpsUrl(cfg.vast.relay));
  const sp = fs.readFileSync(path.join(root, 'public/sponsor.js'), 'utf8');
  assert.match(sp, /EA\.stopVideo\(\)/, 'the app player lets go of the TV decoder before the ad');
  assert.ok(!/EA\.lite && EA\.lite\(\)\) return/.test(sp), 'the pause banner is not switched off in Lite mode');
});

test('pause screen uses the VAST video ad (muted, labelled) when a tag is set; network frame pages are only the fallback', () => {
  const sp = fs.readFileSync(path.join(root, 'public/sponsor.js'), 'utf8');
  assert.match(sp, /else if \(vastUrl\(\)\) pbox = videoBanner\(fallback\);/);
  assert.match(sp, /<video muted playsinline/);
  assert.match(sp, /stopPauseVideo\(\)/);
});
