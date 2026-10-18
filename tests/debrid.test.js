'use strict';
const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const debrid = require('../lib/debrid');
const movies = require('../lib/movies');

const HASH = 'a'.repeat(40);
function server(handler) {
  return new Promise(res => { const s = http.createServer((req, rs) => { let b = ''; req.on('data', c => b += c); req.on('end', () => { const u = new URL(req.url, 'http://x'); const out = handler(req, u, b, rs); if (out !== undefined) { rs.setHeader('content-type', 'application/json'); rs.end(JSON.stringify(out)); } }); }); s.listen(0, '127.0.0.1', () => res({ s, url: 'http://127.0.0.1:' + s.address().port })); });
}
const sp = b => Object.fromEntries(new URLSearchParams(b));

test('key header parsing', () => {
  assert.deepStrictEqual(debrid.parseAuth('rd:ABCDEFGH12345'), { p: 'rd', k: 'ABCDEFGH12345' });
  for (const bad of ['', 'xx:ABCDEFGH12345', 'rd:short', 'rd:has space in it', null]) assert.strictEqual(debrid.parseAuth(bad), null, String(bad));
});

test('file choice: add-on index, episode match, else the biggest video', () => {
  const f = [{ name: 'readme.txt', size: 9 }, { name: 'Show.S01E01.mkv', size: 100 }, { name: 'Show.S01E02.mkv', size: 90 }, { name: 'sample.mp4', size: 5 }];
  assert.strictEqual(debrid.pickFile(f, 2).name, 'Show.S01E02.mkv');
  assert.strictEqual(debrid.pickFile(f, undefined, { s: 1, e: 2 }).name, 'Show.S01E02.mkv');
  assert.strictEqual(debrid.pickFile(f).name, 'Show.S01E01.mkv');
  assert.strictEqual(debrid.pickFile([{ name: 'a.txt', size: 1 }]), null);
});

test('Real-Debrid: key check, cached torrent becomes a link, uncached torrent is removed again', async () => {
  const log = []; let state = 'cached';
  const { s, url } = await server((req, u, b, rs) => {
    log.push(req.method + ' ' + u.pathname);
    if (req.headers.authorization !== 'Bearer KEY12345') { rs.statusCode = 401; return { error: 'bad_token' }; }
    if (u.pathname === '/user') return { username: 'tester', premium: 86400, expiration: '2030-01-01T00:00:00.000Z' };
    if (u.pathname === '/torrents/addMagnet') { assert.match(sp(b).magnet, new RegExp('btih:' + HASH)); return { id: 'T1' }; }
    if (u.pathname === '/torrents/info/T1') return state === 'cached' ? { status: log.some(x => /selectFiles/.test(x)) ? 'downloaded' : 'waiting_files_selection', files: [{ id: 1, path: '/a.txt', bytes: 3 }, { id: 2, path: '/Movie.2160p.mkv', bytes: 9e9 }, { id: 3, path: '/Movie.1080p.mp4', bytes: 3e9 }], links: ['https://rd/x'] } : { status: 'queued', files: [], links: [] };
    if (u.pathname === '/torrents/selectFiles/T1') { assert.strictEqual(sp(b).files, '3', 'add-on fileIdx 2 = third file'); return {}; }
    if (u.pathname === '/unrestrict/link') return { download: 'https://cdn.example/Movie.mp4', filename: 'Movie.mp4' };
    if (u.pathname === '/torrents/delete/T1') return {};
  });
  process.env.DEBRID_BASE_RD = url;
  try {
    const c = await debrid.check('rd', 'KEY12345'); assert.strictEqual(c.user, 'tester'); assert.strictEqual(c.premium, true);
    await assert.rejects(debrid.check('rd', 'WRONGKEY1'), /refused|HTTP/);
    const r = await debrid.resolve({ p: 'rd', k: 'KEY12345' }, { infoHash: HASH, fileIdx: 2, title: 'Movie' }, null, { step: 5 });
    assert.strictEqual(r.url, 'https://cdn.example/Movie.mp4');
    state = 'uncached'; log.length = 0;
    const n = await debrid.resolve({ p: 'rd', k: 'KEY12345' }, { infoHash: HASH, title: 'Movie' }, null, { step: 5 });
    assert.strictEqual(n, null); assert.ok(log.includes('DELETE /torrents/delete/T1'), 'uncached torrent removed: ' + log.join());
  } finally { delete process.env.DEBRID_BASE_RD; s.close(); }
});

test('AllDebrid, Premiumize and TorBox: cached torrents resolve, uncached give null', async () => {
  const ad = await server((req, u) => {
    if (u.pathname === '/user') return { status: 'success', data: { user: { username: 'u', isPremium: true, premiumUntil: 1893456000 } } };
    if (u.pathname === '/magnet/upload') return { status: 'success', data: { magnets: [{ id: 7 }] } };
    if (u.pathname === '/magnet/status') return { status: 'success', data: { magnets: { id: 7, statusCode: 4, links: [{ filename: 'a.nfo', size: 1, link: 'l0' }, { filename: 'Movie.mkv', size: 5e9, link: 'l1' }] } } };
    if (u.pathname === '/link/unlock') { assert.strictEqual(u.searchParams.get('link'), 'l1'); return { status: 'success', data: { link: 'https://ad.example/Movie.mkv' } }; }
    return { status: 'success' };
  });
  const pm = await server((req, u, b) => {
    if (u.pathname === '/account/info') return { status: 'success', customer_id: 5, premium_until: 1893456000 };
    if (u.pathname === '/transfer/directdl') return /bbbb/.test(sp(b).src) ? { status: 'error', message: 'not cached' } : { status: 'success', content: [{ path: 'Movie.mp4', size: 4e9, link: 'https://pm.example/Movie.mp4' }] };
  });
  const tb = await server((req, u) => {
    if (u.pathname === '/user/me') return { success: true, data: { email: 'a@b', plan: 1 } };
    if (u.pathname === '/torrents/checkcached') return { success: true, data: u.searchParams.get('hash') === HASH ? [HASH] : [] };
    if (u.pathname === '/torrents/createtorrent') return { success: true, data: { torrent_id: 3 } };
    if (u.pathname === '/torrents/mylist') return { success: true, data: { files: [{ id: 9, name: 'Movie.mp4', size: 2e9 }] } };
    if (u.pathname === '/torrents/requestdl') return { success: true, data: 'https://tb.example/Movie.mp4' };
  });
  Object.assign(process.env, { DEBRID_BASE_AD: ad.url, DEBRID_BASE_PM: pm.url, DEBRID_BASE_TB: tb.url });
  try {
    for (const p of ['ad', 'pm', 'tb']) assert.strictEqual((await debrid.check(p, 'KEY12345')).ok, true, p);
    assert.match((await debrid.resolve({ p: 'ad', k: 'KEY12345' }, { infoHash: HASH }, null, { step: 5 })).url, /ad\.example/);
    assert.match((await debrid.resolve({ p: 'pm', k: 'KEY12345' }, { infoHash: HASH }, null)).url, /pm\.example/);
    assert.strictEqual(await debrid.resolve({ p: 'pm', k: 'KEY12345' }, { infoHash: 'b'.repeat(40) }, null), null);
    assert.match((await debrid.resolve({ p: 'tb', k: 'KEY12345' }, { infoHash: HASH }, null)).url, /tb\.example/);
    assert.strictEqual(await debrid.resolve({ p: 'tb', k: 'KEY12345' }, { infoHash: 'c'.repeat(40) }, null), null);
  } finally { for (const k of ['DEBRID_BASE_AD', 'DEBRID_BASE_PM', 'DEBRID_BASE_TB']) delete process.env[k]; ad.s.close(); pm.s.close(); tb.s.close(); }
});

test('movie sources: several add-ons, debrid for torrent-only entries, CinePro Core, optional VidLink', async () => {
  const realFetch = global.fetch;
  global.fetch = (u, o) => /127\.0\.0\.1/.test(String(u)) ? realFetch(u, o)
    : Promise.resolve(new Response(JSON.stringify(/strem\.io/.test(String(u)) ? { meta: { moviedb_id: 550 } } : { response: { docs: [] } }), { status: 200, headers: { 'content-type': 'application/json' } }));
  const seen = [];
  const A = await server((req, u) => { seen.push('A' + u.pathname); return { streams: [{ name: 'Torrent 1080p', infoHash: HASH, fileIdx: 0, title: 'Movie' }] }; });    // torrent only
  const B = await server((req, u) => { seen.push('B' + u.pathname); return { streams: [] }; });                                                                                // nothing
  const rd = await server((req, u, b) => {
    if (u.pathname === '/torrents/addMagnet') return { id: 'T9' };
    if (u.pathname === '/torrents/info/T9') return { status: 'downloaded', files: [{ id: 1, path: 'm.mp4', bytes: 1e9 }], links: ['x'] };
    if (u.pathname === '/unrestrict/link') return { download: 'https://rd.example/m.mp4', filename: 'm.mp4' };
    return {};
  });
  const cp = await server((req, u) => { seen.push('CP' + u.pathname); return { sources: [{ url: '/v1/proxy?x=1', type: 'hls', quality: '720p', provider: { name: 'prov' } }, { url: 'https://cp.example/1080.m3u8', type: 'hls', quality: '1080p', provider: { name: 'best' } }], subtitles: [{ url: 'https://s.example/e.vtt', label: 'English' }] }; });
  Object.assign(process.env, { ALLOW_PRIVATE_ADDONS: '1', DEBRID_BASE_RD: rd.url });
  try {
    const q = { id: 'tt0137523', title: 'x', addons: JSON.stringify([B.url + '/manifest.json', A.url + '/manifest.json']) };
    const noDebrid = await movies.sources(q);
    assert.ok(!noDebrid.direct && /debrid/i.test(noDebrid.addonError), 'torrent-only without debrid says so: ' + noDebrid.addonError);
    assert.ok(noDebrid.embeds.length >= 4, 'embeds are still there as the normal fallback');
    assert.ok(seen.some(x => x.startsWith('A/stream/movie/tt0137523')) && seen.some(x => x.startsWith('B/stream/movie/tt0137523')), 'both add-ons asked');
    const withDebrid = await movies.sources(q, { debrid: { p: 'rd', k: 'KEY12345' } });
    assert.strictEqual(withDebrid.direct.url, 'https://rd.example/m.mp4'); assert.strictEqual(withDebrid.direct.provider, 'debrid');
    const c = await movies.sources({ id: 'tt0137523', title: 'x', cinepro: cp.url });
    assert.strictEqual(c.direct.url, 'https://cp.example/1080.m3u8'); assert.strictEqual(c.direct.subtitles[0].url, 'https://s.example/e.vtt');
    assert.ok(seen.includes('CP/v1/movies/550'), seen.join());
    const t = await movies.sources({ id: 'tt0944947', type: 'series', s: '2', e: '3', title: 'x', cinepro: cp.url });
    assert.ok(t.direct && seen.includes('CP/v1/tv/550/seasons/2/episodes/3'));
    // VidLink is optional: never in Auto, only when picked
    const auto = await movies.sources({ id: 'tt0137523', title: 'x' });
    const keys = auto.embeds.map(e => e.key); assert.ok(!keys.includes('vidlink') && keys.includes('cinesrc') && !keys.includes('vidsrc'), keys.join());
    const vl = await movies.sources({ id: 'tt0137523', title: 'x', via: 'vidlink' });
    assert.strictEqual(vl.embeds[0].key, 'vidlink'); assert.match(vl.embeds[0].url, /vidlink\.pro\/movie\/550/);
    const tvl = await movies.sources({ id: 'tt0944947', type: 'series', s: '2', e: '3', title: 'x', via: 'vidlink' });
    assert.match(tvl.embeds[0].url, /vidlink\.pro\/tv\/550\/2\/3/);
  } finally { global.fetch = realFetch; delete process.env.ALLOW_PRIVATE_ADDONS; delete process.env.DEBRID_BASE_RD; [A, B, rd, cp].forEach(x => x.s.close()); }
});
