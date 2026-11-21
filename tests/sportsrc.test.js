'use strict';
// Live Sports option A (lib/sportsrc.js): channels found through the viewer's own Stremio / Nuvio add-ons. A stub add-on on localhost plays the add-on.
process.env.ALLOW_PRIVATE_ADDONS = '1';
const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const S = require('../lib/sportsrc');

function addon(spec) {                                   // spec: { manifest, search: {term -> metas}, catalog: metas, streams: {id -> streams}, slow }
  const hits = [];
  const srv = http.createServer((req, res) => {
    hits.push(decodeURIComponent(req.url));
    const send = o => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(o)); };
    const u = decodeURIComponent(req.url);
    if (spec.slow) return;                                // never answers
    if (u === '/manifest.json') return send(spec.manifest);
    let m = /^\/catalog\/(tv|channel)\/([^/]+)\/search=(.+)\.json$/.exec(u); if (m) return send({ metas: (spec.search || {})[m[3]] || [] });
    m = /^\/catalog\/(tv|channel)\/([^/]+)\.json$/.exec(u); if (m) return send({ metas: spec.catalog || [] });
    m = /^\/stream\/(tv|channel)\/(.+)\.json$/.exec(u); if (m) return send({ streams: (spec.streams || {})[m[2]] || [] });
    res.statusCode = 404; res.end('{}');
  });
  return new Promise(ok => srv.listen(0, '127.0.0.1', () => ok({ url: 'http://127.0.0.1:' + srv.address().port, hits, close: () => srv.close() })));
}
const tvManifest = (extra) => ({ id: 'x', name: 'Live', resources: ['catalog', 'stream'], types: ['tv'], catalogs: [{ type: 'tv', id: 'all', name: 'All', extra: extra === undefined ? [{ name: 'search' }] : extra }] });
const ok = async () => ({ ok: true });
const q = (urls, names, terms) => ({ addons: JSON.stringify(urls), names: JSON.stringify(names), terms: JSON.stringify(terms) });

test('search-capable live-TV add-on: channels are matched by name, streams returned, duplicates removed, checked streams first', async () => {
  const a = await addon({
    manifest: tvManifest(),
    search: { 'DAZN CHANNEL': [{ id: 'dazn:1', name: 'DAZN HD' }, { id: 'dazn:2', name: 'DAZN 2' }], 'FIGHTKLUB': [] },
    streams: { 'dazn:1': [{ name: 'DAZN', title: 'DAZN 1080p', url: 'https://cdn.example/dazn/index.m3u8' }, { name: 'DAZN dup', title: 'same', url: 'https://cdn.example/dazn/index.m3u8' },
      { name: 'DAZN alt', title: 'DAZN 720p', url: 'https://cdn2.example/dazn.m3u8' }, { name: 'YT', ytId: 'abc' }, { name: 'page', externalUrl: 'https://x.example/watch' }, { name: 'torrent', infoHash: 'a'.repeat(40) }] },
  });
  try {
    const bad = new Set(['https://cdn2.example/dazn.m3u8']);
    const r = await S.find(q([a.url], ['Live'], ['DAZN CHANNEL', 'FIGHTKLUB']), { verify: async c => { if (bad.has(c.url)) throw new Error('unreadable'); return { ok: true }; } });
    assert.strictEqual(r.matches.length, 2, 'duplicate address, YouTube, external page and torrent are not channels');
    assert.strictEqual(r.matches[0].url, 'https://cdn.example/dazn/index.m3u8'); assert.ok(r.matches[0].verified && r.matches[0].exact && r.matches[0].hls);
    assert.strictEqual(r.matches[1].verified, false, 'unreadable stream is listed after the checked one, not hidden');
    assert.strictEqual(r.matches[0].channel, 'DAZN HD'); assert.strictEqual(r.matches[0].addon, 'Live'); assert.strictEqual(r.tvAddons, 1);
    assert.ok(!a.hits.some(h => /dazn:2/.test(h) && /stream/.test(h)), '"DAZN 2" is a different channel: not asked for');
    assert.deepStrictEqual(r.perAddon, [{ name: 'Live', n: 3, tv: true }], 'n = candidates the add-on offered (before duplicates are removed)');
  } finally { a.close(); }
});

test('add-on without search: the first catalog page is read and matched here; catalogs that need an extra value are skipped', async () => {
  const a = await addon({ manifest: { name: 'NoSearch', resources: ['catalog', 'stream'], types: ['tv'], catalogs: [{ type: 'tv', id: 'main', extra: [] }, { type: 'tv', id: 'needs', extra: [{ name: 'genre', isRequired: true }] }, { type: 'movie', id: 'films' }] },
    catalog: [{ id: 'c:sky', name: 'Sky Sports Main Event' }, { id: 'c:bein', name: 'beIN SPORTS 1 HD' }, { id: 'c:x', name: 'Cartoon Network' }], streams: { 'c:bein': [{ name: 'beIN', url: 'https://cdn.example/bein.m3u8' }] } });
  try {
    const r = await S.find(q([a.url], ['NoSearch'], ['Bein Sports 1', 'Sky Sports']), { verify: ok });
    assert.deepStrictEqual(r.matches.map(m => m.channel), ['beIN SPORTS 1 HD']);
    assert.ok(!a.hits.some(h => /catalog\/tv\/needs/.test(h)) && !a.hits.some(h => /c:sky/.test(h)), '"Sky Sports" is not "Sky Sports Main Event"');
    assert.deepStrictEqual(S.tvCatalogs({ catalogs: [{ type: 'channel', id: 'a', extraSupported: ['search'] }] }), [{ id: 'a', type: 'channel', search: true }]);
  } finally { a.close(); }
});

test('add-ons that fail, are slow, have no live TV or are not valid addresses never break the answer; the others still count', async () => {
  const good = await addon({ manifest: tvManifest(), search: { ESPN: [{ id: 'e1', name: 'ESPN' }] }, streams: { e1: [{ name: 'ESPN', url: 'https://cdn.example/espn.m3u8' }] } });
  const movies = await addon({ manifest: { name: 'Movies only', resources: ['stream'], types: ['movie'], catalogs: [{ type: 'movie', id: 'm' }] } });
  const dead = await addon({ manifest: tvManifest(), slow: true });
  try {
    const t0 = Date.now();
    const r = await S.find(q([good.url, movies.url, 'ftp://nope', 'http://127.0.0.1:1'], ['Good', 'Movies', 'Bad', 'Down'], ['ESPN']), { verify: ok });
    assert.strictEqual(r.matches.length, 1); assert.strictEqual(r.matches[0].addon, 'Good');
    assert.strictEqual(r.perAddon.length, 4); assert.strictEqual(r.perAddon[1].tv, false); assert.ok(r.perAddon[2].err && r.perAddon[3].err); assert.strictEqual(r.tvAddons, 1);
    assert.ok(Date.now() - t0 < 15000);
    const only = await S.find(q([movies.url], ['Movies'], ['ESPN']), { verify: ok }); assert.strictEqual(only.matches.length, 0); assert.strictEqual(only.tvAddons, 0, 'the UI can say "none of your add-ons offers live TV"');
  } finally { good.close(); movies.close(); dead.close(); }
});

test('streams that need request headers keep them; nothing is invented when an add-on has no stream', async () => {
  const a = await addon({ manifest: tvManifest(), search: { 'TNT SPORTS 1': [{ id: 't1', name: 'TNT SPORTS 1' }, { id: 't2', name: 'TNT Sports 1 (UK)' }] },
    streams: { t1: [{ name: 'TNT', url: 'https://cdn.example/tnt.m3u8', behaviorHints: { proxyHeaders: { request: { Referer: 'https://site.example/' } } } }], t2: [] } });
  try {
    const seen = []; const r = await S.find(q([a.url], ['A'], ['TNT SPORTS 1']), { verify: async c => { seen.push(c.headers); return { ok: true }; } });
    assert.deepStrictEqual(r.matches[0].headers, { Referer: 'https://site.example/' }); assert.deepStrictEqual(seen[0], { Referer: 'https://site.example/' }); assert.strictEqual(r.matches.length, 1);
  } finally { a.close(); }
});

test('input errors: no add-ons, no channel names; the add-on address is checked like everywhere else', async () => {
  await assert.rejects(S.find(q([], [], ['ESPN'])), e => e.status === 502 && /No add-ons yet/.test(e.message));
  await assert.rejects(S.find(q(['http://127.0.0.1:1'], ['x'], [])), e => e.status === 400);
  await assert.rejects(S.find({ addons: 'not json', terms: '[]' }), e => e.status === 502);
  delete process.env.ALLOW_PRIVATE_ADDONS;
  const r = await S.find(q(['http://127.0.0.1:9', 'http://localhost/x'], ['a', 'b'], ['ESPN']), { verify: ok });
  assert.strictEqual(r.matches.length, 0); assert.ok(r.perAddon.every(p => /not a valid add-on address/.test(p.err)), 'private addresses are not fetched by the cloud server');
  process.env.ALLOW_PRIVATE_ADDONS = '1';
});

test('api: the sports_sources action is wired to the module', () => {
  const src = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'api', 'index.js'), 'utf8');
  assert.match(src, /case 'sports_sources':[\s\S]{0,200}sportsrc\.find\(q\)/); assert.match(src, /const sportsrc = require\('\.\.\/lib\/sportsrc'\)/);
});
