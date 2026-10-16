'use strict';
const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const IPTV = require('../public/iptv.js');

// ---- fixtures ----
const SMALL = [
  '#EXTM3U x-tvg-url="http://example.test/guide.xml"',
  '#EXTINF:-1 tvg-id="bbc1.uk" tvg-logo="http://l/bbc1.png" group-title="UK, News",BBC One, HD',
  'http://h/1.m3u8',
  '#EXTINF:-1 tvg-chno="7" group-title="Sport",Sky Sports 1',
  '#EXTVLCOPT:http-user-agent=VLC',
  'http://h/2.ts',
  '#EXTGRP:Kids',
  '#EXTINF:-1 group-title="News;Public",Cartoon Net',
  'http://h/3.m3u8',
  '#EXTINF:-1,Old RTMP',
  'rtmp://h/4',
  '#EXTINF:-1 group-title="Sport",NoURL',
  '',
  'not a url',
  ''
].join('\r\n');

function bigPlaylist(n) {
  const out = ['#EXTM3U'];
  for (let i = 0; i < n; i++) out.push('#EXTINF:-1 tvg-id="c' + i + '" tvg-logo="http://logo/' + i + '.png" group-title="Group ' + (i % 300) + '",Channel number ' + i, 'http://host:8080/live/user/pass/' + i + '.m3u8');
  return out.join('\n');
}

// one tiny server for everything
let srv, base;
const routes = {};
test.before(async () => {
  srv = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x');
    const r = routes[u.pathname];
    if (!r) { res.statusCode = 404; return res.end('nope'); }
    r(req, res, u);
  });
  await new Promise(r => srv.listen(0, '127.0.0.1', r));
  base = 'http://127.0.0.1:' + srv.address().port;
});
test.after(() => srv.close());

// run the engine on the "main thread" exactly like the TV fallback does
function runJob(job, onChunk) {
  const client = IPTV.createClient({ noWorker: true });
  return client.run(job, onChunk);
}
const direct = [{ via: 'direct', pre: '' }];

test('M3U: attributes, quoted commas, EXTGRP, tvg-chno, junk lines, CRLF', async () => {
  routes['/s.m3u'] = (q, r) => r.end(SMALL);
  const chunks = [];
  const res = await runJob({ kind: 'm3u', url: base + '/s.m3u', tries: direct }, c => chunks.push(c));
  assert.strictEqual(res.total, 3); assert.strictEqual(res.skipped, 1);
  assert.deepStrictEqual(res.groups, ['UK, News', 'Sport', 'News']);
  assert.strictEqual(res.epgUrl, 'http://example.test/guide.xml');
  const c = chunks[0];
  assert.deepStrictEqual(c.n, ['BBC One, HD', 'Sky Sports 1', 'Cartoon Net']);
  assert.deepStrictEqual(c.u, ['http://h/1.m3u8', 'http://h/2.ts', 'http://h/3.m3u8']);
  assert.deepStrictEqual(c.g, [0, 1, 2]);
  assert.strictEqual(c.l[0], 'http://l/bbc1.png');
  assert.strictEqual(c.e[0], 'bbc1.uk');
  assert.strictEqual(c.o[1], 7);
  assert.strictEqual(res.via, 'direct');
});

test('M3U: rejects a web page, and falls back to the second route', async () => {
  routes['/html'] = (q, r) => r.end('<html>Forbidden</html>');
  routes['/good'] = (q, r) => r.end(SMALL);
  await assert.rejects(runJob({ kind: 'm3u', url: base + '/html', tries: direct }), /not an M3U playlist/);
  const tries = [{ via: 'direct', pre: '' }, { via: 'proxy', pre: base + '/px?url=' }];
  routes['/px'] = (q, r, u) => { fetch(u.searchParams.get('url')).then(x => x.text()).then(t => r.end(t)); };
  const res = await runJob({ kind: 'm3u', url: base + '/html', tries }, () => {}).catch(e => e);
  assert.ok(res instanceof Error, 'proxy also returns the page, so it still fails');
  const bad = base.replace('127.0.0.1', '127.0.0.1') + '/missing';
  const ok = await runJob({ kind: 'm3u', url: bad, tries: [{ via: 'direct', pre: '' }, { via: 'proxy', pre: base + '/px?url=' }] }, () => {}).catch(e => e);
  assert.ok(ok instanceof Error);
  assert.match(ok.message, /HTTP 404/);
});

test('M3U: 100,000 channels stream in chunks of 2000 and parse fast', async () => {
  const text = bigPlaylist(100000);
  routes['/big.m3u'] = (q, r) => r.end(text);
  const chunks = []; const t0 = Date.now();
  const res = await runJob({ kind: 'm3u', url: base + '/big.m3u', tries: direct }, c => chunks.push(c));
  const ms = Date.now() - t0;
  assert.strictEqual(res.total, 100000);
  assert.strictEqual(res.groups.length, 300);
  assert.strictEqual(chunks.length, 50);
  assert.ok(chunks.every(c => c.n.length <= 2000));
  console.log('# 100k channels (' + (text.length / 1048576).toFixed(1) + ' MB) downloaded + parsed in ' + ms + ' ms');
  assert.ok(ms < 8000);
});

test('Xtream: categories + streams become columns, auth reports expiry', async () => {
  routes['/player_api.php'] = (q, r, u) => {
    const a = u.searchParams.get('action');
    if (u.searchParams.get('password') !== 'pw') return r.end(JSON.stringify({ user_info: { auth: 0 } }));
    r.setHeader('content-type', 'application/json');
    if (!a) return r.end(JSON.stringify({ user_info: { auth: 1, status: 'Active', exp_date: '1900000000', max_connections: '2', active_cons: '1' }, server_info: { url: 'x', timestamp_now: 1700000000 } }));
    if (a === 'get_live_categories') return r.end(JSON.stringify([{ category_id: '5', category_name: 'Movies' }, { category_id: '9', category_name: 'News' }]));
    if (a === 'get_live_streams') return r.end(JSON.stringify([
      { num: 1, name: 'CNN', stream_id: 101, stream_icon: 'http://i/c.png', epg_channel_id: 'cnn.us', category_id: '9' },
      { num: 2, name: 'HBO', stream_id: 102, stream_icon: '', epg_channel_id: '', category_id: '5' },
      { num: 3, name: 'Orphan', stream_id: 103, category_id: '77' }]));
    r.end('[]');
  };
  const job = { server: base, user: 'u', pass: 'pw', tries: direct };
  const a = await runJob(Object.assign({ kind: 'auth' }, job));
  assert.strictEqual(a.status, 'Active'); assert.strictEqual(a.exp, 1900000000); assert.strictEqual(a.max, 2);
  const chunks = [];
  const res = await runJob(Object.assign({ kind: 'xtream' }, job), c => chunks.push(c));
  assert.strictEqual(res.total, 3);
  assert.deepStrictEqual(res.groups, ['Movies', 'News', 'Other']);
  assert.deepStrictEqual(chunks[0].u, ['101', '102', '103']);
  assert.deepStrictEqual(chunks[0].g, [1, 0, 2]);
  assert.strictEqual(chunks[0].e[0], 'cnn.us');
  await assert.rejects(runJob({ kind: 'auth', server: base, user: 'u', pass: 'bad', tries: direct }), /Login refused/);
});

test('XMLTV: keeps only wanted channels, current window, decodes entities, sorts', async () => {
  const f = t => { const d = new Date(t * 1000); const p = n => String(n).padStart(2, '0'); return d.getUTCFullYear() + p(d.getUTCMonth() + 1) + p(d.getUTCDate()) + p(d.getUTCHours()) + p(d.getUTCMinutes()) + p(d.getUTCSeconds()) + ' +0000'; };
  const now = Math.floor(Date.now() / 1000);
  const xml = '<?xml version="1.0"?><tv><channel id="a"/>' +
    '<programme start="' + f(now + 1800) + '" stop="' + f(now + 5400) + '" channel="a"><title lang="en">Next &amp; Later</title><desc>Second</desc></programme>' +
    '<programme start="' + f(now - 1800) + '" stop="' + f(now + 1800) + '" channel="a"><title>Now Show</title><desc><![CDATA[Tom & Jerry]]></desc></programme>' +
    '<programme start="' + f(now - 9 * 86400) + '" stop="' + f(now - 9 * 86400 + 3600) + '" channel="a"><title>Old</title></programme>' +
    '<programme start="' + f(now) + '" stop="' + f(now + 600) + '" channel="zzz"><title>Not mine</title></programme></tv>';
  routes['/g.xml'] = (q, r) => { r.write(xml.slice(0, 137)); setTimeout(() => r.end(xml.slice(137)), 20); };   // split mid-tag on purpose
  const res = await runJob({ kind: 'xmltv', url: base + '/g.xml', ids: ['a'], tries: direct });
  const map = {}; res.shards.forEach(s => Object.assign(map, JSON.parse(s)));
  assert.deepStrictEqual(Object.keys(map), ['a']);
  assert.deepStrictEqual(map.a.map(p => p[2]), ['Now Show', 'Next & Later']);
  assert.strictEqual(map.a[0][3], 'Tom & Jerry');
  const nn = IPTV.nowNext(map.a, now);
  assert.strictEqual(nn.now[2], 'Now Show'); assert.strictEqual(nn.next[2], 'Next & Later');
  assert.ok(nn.pct > 40 && nn.pct < 60, 'about halfway: ' + nn.pct);
});

test('search: every word must match, names starting with the word first, bounded', () => {
  const low = ['bbc news', 'cnn', 'sky news arabia', 'news 24', 'bbc one'];
  assert.deepStrictEqual(IPTV.search(low, 'news'), [3, 0, 2]);
  assert.deepStrictEqual(IPTV.search(low, 'bbc news'), [0]);
  assert.deepStrictEqual(IPTV.search(low, ''), []);
  const many = []; for (let i = 0; i < 100000; i++) many.push('channel ' + i);
  const t0 = Date.now(); const r = IPTV.search(many, 'channel 9', 3000); const ms = Date.now() - t0;
  assert.strictEqual(r.length, 3000); console.log('# search 100k names: ' + ms + ' ms'); assert.ok(ms < 100);
});

test('helpers: Xtream links, server cleanup, adult filter, base64 titles, nowNext edges', () => {
  assert.strictEqual(IPTV.xtreamUrl({ server: 'http://h:80/', user: 'a b', pass: 'p', ext: 'ts' }, 55), 'http://h:80/live/a%20b/p/55.ts');
  assert.strictEqual(IPTV.normServer('host.tv:8080/player_api.php?x=1'), 'http://host.tv:8080');
  assert.deepStrictEqual(IPTV.sniffXtream('http://h:8080/get.php?username=U&password=P%40&type=m3u_plus'), { server: 'http://h:8080', user: 'U', pass: 'P@' });
  assert.strictEqual(IPTV.sniffXtream('http://h/list.m3u'), null);
  assert.ok(IPTV.isAdultName('XXX Movies')); assert.ok(IPTV.isAdultName('Adults 18+')); assert.ok(IPTV.isAdultName('Adult Movies HD')); assert.ok(IPTV.isAdultName('Private Porn TV'));
  assert.ok(!IPTV.isAdultName('Sussex News')); assert.ok(!IPTV.isAdultName('Essex Sports')); assert.ok(!IPTV.isAdultName('Adult Swim')); assert.ok(!IPTV.isAdultName('Stingray Pop Adult (1080p)')); assert.ok(!IPTV.isAdultName('Pluto TV Adult Animation'));
  assert.strictEqual(IPTV.utf8b64(Buffer.from('Café ☕').toString('base64')), 'Café ☕');
  assert.strictEqual(IPTV.nowNext([], 5), null);
  assert.strictEqual(IPTV.nowNext([[10, 20, 'a', '']], 5).now, null);
  assert.strictEqual(IPTV.nowNext([[10, 20, 'a', '']], 5).next[2], 'a');
  assert.strictEqual(IPTV.nowNext([[10, 20, 'a', '']], 25), null);
});
