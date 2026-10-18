'use strict';
const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const { verifyStream, publicUrl, sniff } = require('../lib/verify');
const movies = require('../lib/movies');

const TS = Buffer.concat([Buffer.from([0x47, 0x40, 0x00, 0x10]), Buffer.alloc(184, 0xff)]);
const MP4 = Buffer.concat([Buffer.from([0, 0, 0, 24]), Buffer.from('ftypisom'), Buffer.alloc(40)]);
function server(routes) {
  return new Promise(res => { const hits = []; const s = http.createServer((req, rs) => { hits.push(req.method + ' ' + req.url + (req.headers.range ? ' ' + req.headers.range : '')); const r = routes[req.url.split('?')[0]]; if (!r) { rs.statusCode = 404; return rs.end('nope'); } rs.statusCode = r.status || 200; rs.setHeader('content-type', r.type || 'application/octet-stream'); rs.end(r.body); }); s.listen(0, '127.0.0.1', () => res({ s, hits, url: 'http://127.0.0.1:' + s.address().port })); });
}
process.env.ALLOW_PRIVATE_ADDONS = '1';

test('sniffing: transport stream, fragmented mp4, id3/aac, image-wrapped, html', () => {
  assert.strictEqual(sniff(TS), 'ts'); assert.strictEqual(sniff(MP4), 'mp4');
  assert.strictEqual(sniff(Buffer.from('ID3\x03\x00')), 'id3'); assert.strictEqual(sniff(Buffer.from([0x89, 0x50, 0x4e, 0x47])), 'png');
  assert.strictEqual(sniff(Buffer.from('<!doctype html>')), '');
});

test('private addresses are never fetched on behalf of a provider', () => {
  delete process.env.ALLOW_PRIVATE_ADDONS;
  try { for (const u of ['http://127.0.0.1/a', 'http://192.168.1.2/a', 'http://localhost/a', 'ftp://x.example/a', 'nonsense']) assert.strictEqual(publicUrl(u), false, u); assert.strictEqual(publicUrl('https://cdn.example/a.m3u8'), true); }
  finally { process.env.ALLOW_PRIVATE_ADDONS = '1'; }
});

test('HLS: master -> variant -> key -> first segment must all read; the result says how deep it got', async () => {
  const { s, url, hits } = await server({
    '/master.m3u8': { type: 'application/vnd.apple.mpegurl', body: '#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1000,RESOLUTION=1280x720\nv720.m3u8\n#EXT-X-STREAM-INF:BANDWIDTH=500\nv360.m3u8\n' },
    '/v720.m3u8': { type: 'application/vnd.apple.mpegurl', body: '#EXTM3U\n#EXT-X-KEY:METHOD=AES-128,URI="key.bin"\n#EXTINF:4,\nseg0.ts\n#EXTINF:4,\nseg1.ts\n' },
    '/key.bin': { body: Buffer.alloc(16, 1) }, '/seg0.ts': { type: 'video/mp2t', body: TS },
  });
  try {
    const r = await verifyStream({ url: url + '/master.m3u8', mp4: false }, {});
    assert.strictEqual(r.verified.level, 'segment'); assert.strictEqual(r.verified.variants, 2); assert.strictEqual(r.verified.kind, 'ts');
    assert.ok(hits.some(h => /seg0\.ts bytes=0-2047/.test(h)), 'only the start of the first segment is requested: ' + hits.join(' | '));
  } finally { s.close(); }
});

test('HLS failures: dead segment, html segment, empty playlist, missing key, html instead of a playlist', async () => {
  const pl = body => ({ type: 'application/vnd.apple.mpegurl', body });
  const { s, url } = await server({
    '/dead.m3u8': pl('#EXTM3U\n#EXTINF:4,\nmissing.ts\n'), '/htmlseg.m3u8': pl('#EXTM3U\n#EXTINF:4,\nerr.ts\n'), '/err.ts': { type: 'text/html', body: '<html>blocked</html>' },
    '/empty.m3u8': pl('#EXTM3U\n#EXT-X-ENDLIST\n'), '/nokey.m3u8': pl('#EXTM3U\n#EXT-X-KEY:METHOD=AES-128,URI="gone.key"\n#EXTINF:4,\nseg0.ts\n'), '/seg0.ts': { type: 'video/mp2t', body: TS },
    '/page.m3u8': { type: 'text/html', body: '<html>sign in</html>' },
  });
  try {
    await assert.rejects(verifyStream({ url: url + '/dead.m3u8' }, {}), /segment HTTP 404/);
    await assert.rejects(verifyStream({ url: url + '/htmlseg.m3u8' }, {}), /segment is not media/);
    await assert.rejects(verifyStream({ url: url + '/empty.m3u8' }, {}), /no segments/);
    await assert.rejects(verifyStream({ url: url + '/nokey.m3u8' }, {}), /encryption key HTTP 404/);
    await assert.rejects(verifyStream({ url: url + '/page.m3u8' }, {}), /not a playlist/);
    const shallow = await verifyStream({ url: url + '/dead.m3u8' }, { deep: false });
    assert.strictEqual(shallow.verified.level, 'playlist', 'shallow mode (Workers) only checks the playlist');
  } finally { s.close(); }
});

test('MP4: a ranged read must return video, not an error page', async () => {
  const { s, url } = await server({ '/ok.mp4': { type: 'video/mp4', body: MP4 }, '/bin.mp4': { type: 'application/octet-stream', body: MP4 }, '/err.mp4': { type: 'text/html', body: '<html>403</html>' }, '/json.mp4': { type: 'application/json', body: '{"error":1}' } });
  try {
    assert.strictEqual((await verifyStream({ url: url + '/ok.mp4', mp4: true }, {})).verified.level, 'file');
    assert.strictEqual((await verifyStream({ url: url + '/bin.mp4', mp4: true }, {})).verified.kind, 'mp4');
    await assert.rejects(verifyStream({ url: url + '/err.mp4', mp4: true }, {}), /not video/);
    await assert.rejects(verifyStream({ url: url + '/json.mp4', mp4: true }, {}), /not video/);
    await assert.rejects(verifyStream({ url: url + '/missing.mp4', mp4: true }, {}), /HTTP 404/);
  } finally { s.close(); }
});

test('add-on streams: an unreadable best stream is skipped and the next readable one is used', async () => {
  const cdn = await server({ '/good.mp4': { type: 'video/mp4', body: MP4 }, '/bad.mp4': { type: 'text/html', body: 'x' } });
  const addon = await server({ '/stream/movie/tt0137523.json': { type: 'application/json', body: JSON.stringify({ streams: [{ name: 'Best 1080p', url: cdn.url + '/bad.mp4' }, { name: 'Next 720p', url: cdn.url + '/good.mp4' }] }) } });
  const realFetch = global.fetch;
  global.fetch = (u, o) => /127\.0\.0\.1/.test(String(u)) ? realFetch(u, o) : Promise.resolve(new Response(JSON.stringify({ meta: { moviedb_id: 550 } }), { status: 200, headers: { 'content-type': 'application/json' } }));
  try {
    const d = await movies.sources({ id: 'tt0137523', via: 'addon', addons: JSON.stringify([addon.url]), title: 'x' });
    assert.strictEqual(d.direct.url, cdn.url + '/good.mp4', 'the 1080p stream is an error page, so the 720p one wins');
    assert.strictEqual(d.direct.verified.level, 'file');
    const only = await movies.sources({ id: 'tt0137523', via: 'addon', addons: JSON.stringify([server && addon.url]), title: 'x' }, { verify: async () => { throw new Error('stream HTTP 403'); } });
    assert.ok(!only.direct && /could not be read/.test(only.addonError), 'nothing readable: the player is never given a dead stream: ' + only.addonError);
  } finally { global.fetch = realFetch; cdn.s.close(); addon.s.close(); }
});
