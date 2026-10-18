'use strict';
const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const movies = require('../lib/movies');

test('add-on address: manifest suffix and stremio:// are normalised, private hosts refused', () => {
  assert.strictEqual(movies.addonBase('stremio://a.example/cfg/manifest.json'), 'https://a.example/cfg');
  assert.strictEqual(movies.addonBase('https://a.example/x/'), 'https://a.example/x');
  for (const bad of ['', 'ftp://a.example', 'http://localhost:7000', 'http://127.0.0.1/x', 'http://192.168.1.5/x', 'http://10.0.0.2/x', 'http://169.254.169.254/x', 'http://[::1]/x', 'nonsense'])
    assert.strictEqual(movies.addonBase(bad), null, bad);
});

test('stream choice: plays-anywhere files first, 1080p default, honours a wanted quality, avoids mkv/HDR/cam', () => {
  const r = (name, url, want) => movies.rankStream({ name, url }, want).sc;
  assert.ok(r('1080p BluRay', 'https://x/a.mp4') > r('4K HDR', 'https://x/a.mkv'));
  assert.ok(r('1080p', 'https://x/a.mp4') > r('720p', 'https://x/a.mp4'));
  assert.ok(r('720p', 'https://x/a.mp4', 720) > r('1080p', 'https://x/a.mp4', 720));
  assert.ok(r('1080p', 'https://x/a.m3u8') > r('1080p CAM', 'https://x/a.m3u8'));
});

const realFetch = global.fetch;
function stubNet() {                                   // Cinemeta / archive.org answers are canned: this test is about the add-on
  global.fetch = (u, o) => /127\.0\.0\.1/.test(String(u)) ? realFetch(u, o)
    : Promise.resolve(new Response(JSON.stringify(/cinemeta|strem\.io/.test(String(u)) ? { meta: { moviedb_id: 550 } } : { response: { docs: [] } }), { status: 200, headers: { 'content-type': 'application/json' } }));
}

test('sources(): add-on stream becomes the direct file; movie and episode addresses; failures are reported', async () => {
  stubNet(); const seen = [];
  const srv = http.createServer((req, res) => {
    seen.push(req.url); res.setHeader('content-type', 'application/json');
    if (/tt0000001/.test(req.url)) return res.end(JSON.stringify({ streams: [{ infoHash: 'abc' }, { url: 'https://x/a.mp4', behaviorHints: { notWebReady: true } }] }));
    res.end(JSON.stringify({ streams: [{ name: 'Add 720p', url: 'https://cdn.example/m720.mp4' }, { name: 'Add 1080p', url: 'https://cdn.example/m1080.mp4', subtitles: [{ url: 'https://s.example/e.vtt', lang: 'eng' }],
      behaviorHints: { proxyHeaders: { request: { Referer: 'https://r.example/' } } } }, { infoHash: 'zzz' }] }));
  });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + srv.address().port;
  assert.match((await movies.sources({ id: 'tt0137523', via: 'addon', addon: base + '/manifest.json', title: 'x' })).addonError, /not valid/);   // refused while the guard is on
  process.env.ALLOW_PRIVATE_ADDONS = '1';
  try {
    const d = await movies.sources({ id: 'tt0137523', via: 'addon', addon: base + '/manifest.json', title: 'x', quality: '' });
    assert.strictEqual(d.direct.url, 'https://cdn.example/m1080.mp4');
    assert.deepStrictEqual(d.direct.headers, { Referer: 'https://r.example/' });
    assert.strictEqual(d.direct.subtitles[0].url, 'https://s.example/e.vtt');
    assert.strictEqual(d.direct.provider, 'addon');
    assert.ok(seen.includes('/stream/movie/tt0137523.json'), seen.join());
    const t = await movies.sources({ id: 'tt0944947', via: 'auto', type: 'series', s: '2', e: '3', addon: base, title: 'x' });
    assert.ok(t.direct && seen.includes('/stream/series/tt0944947:2:3.json'), seen.join());
    const n = await movies.sources({ id: 'tt0000001', via: 'auto', addon: base, title: 'x' }).catch(e => e);
    assert.ok(!n.direct && /torrents|no ready-to-play/.test(n.addonError), JSON.stringify(n.addonError));
  } finally { delete process.env.ALLOW_PRIVATE_ADDONS; global.fetch = realFetch; srv.close(); }
});
