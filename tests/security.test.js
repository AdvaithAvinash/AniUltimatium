'use strict';
// The relay, the pairing codes and the accounts: the parts of the server that anyone on the internet can call.
const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');

process.env.DATA_DIR = fs.mkdtempSync(path.join(os.tmpdir(), 'aniu-test-'));
const handler = require('../api/index.js');
const net = require('../lib/net');
const accounts = require('../lib/accounts');

// Calls the API handler the way the local server does and collects the answer
function call(query, o) {
  o = o || {};
  return new Promise((resolve, reject) => {
    const headers = {}, chunks = [];
    const res = {
      statusCode: 200, headersSent: false,
      setHeader(k, v) { headers[k.toLowerCase()] = String(v); return res; },
      getHeader(k) { return headers[k.toLowerCase()]; },
      status(c) { res.statusCode = c; return res; },
      json(b) { headers['content-type'] = 'application/json'; return res.end(JSON.stringify(b)); },
      send(b) { return res.end(b); },
      write(b) { chunks.push(Buffer.from(b)); return true; },
      end(b) { if (b != null) chunks.push(Buffer.from(b)); const body = Buffer.concat(chunks).toString(); let json = null; try { json = JSON.parse(body); } catch (e) { /* not json */ } resolve({ status: res.statusCode, headers, body, json }); return res; },
      on() { return res; }, once() { return res; }, emit() { return true; },
    };
    const req = { method: o.body ? 'POST' : 'GET', query, body: o.body, headers: Object.assign({ host: 'app.test', 'x-forwarded-proto': 'https' }, o.headers || {}), socket: { remoteAddress: o.ip || '203.0.113.9' } };
    Promise.resolve(handler(req, res)).catch(reject);
  });
}
function upstream(routes) {
  return new Promise(res => {
    const s = http.createServer((req, rs) => {
      const r = routes[req.url.split('?')[0]]; if (!r) { rs.statusCode = 404; return rs.end('nope'); }
      rs.statusCode = r.status || 200; Object.keys(r.headers || {}).forEach(k => rs.setHeader(k, r.headers[k])); if (r.type) rs.setHeader('Content-Type', r.type); rs.end(r.body || '');
    }).listen(0, '127.0.0.1', () => res({ s, url: 'http://127.0.0.1:' + s.address().port }));
  });
}

test('private and odd addresses are recognised (IPv4, IPv6, names)', () => {
  delete process.env.ALLOW_PRIVATE_ADDONS;
  for (const u of ['http://127.0.0.1/', 'http://10.1.2.3/', 'http://172.20.0.1/', 'http://192.168.0.1/', 'http://169.254.169.254/latest', 'http://100.64.0.1/', 'http://0.0.0.0/', 'http://[::1]/', 'http://[fd00::1]/', 'http://[fe80::1]/',
    'http://[::ffff:127.0.0.1]/', 'http://2130706433/', 'http://localhost:3000/', 'http://printer.local/', 'http://db.internal/', 'file:///etc/passwd', 'ftp://x.example/']) assert.strictEqual(net.publicUrl(u), false, u);
  for (const u of ['https://cdn.example/a.m3u8', 'http://93.184.216.34/x', 'http://172.32.0.1/', 'https://[2606:4700::1111]/']) assert.strictEqual(net.publicUrl(u), true, u);
});

test('relay: a private address is refused, also when a public-looking answer redirects to one', async () => {
  delete process.env.ALLOW_PRIVATE_ADDONS;
  const up = await upstream({ '/page': { type: 'text/html', body: '<script>1</script>' } });
  try {
    const a = await call({ action: 'proxy', url: up.url + '/page' });
    assert.strictEqual(a.status, 400); assert.ok(!/script/.test(a.body));
    assert.strictEqual((await call({ action: 'proxy', url: 'http://localhost:1/' })).status, 400);
    assert.strictEqual((await call({ action: 'proxy', url: 'file:///etc/passwd' })).status, 400);
    // the redirect hop is checked too
    const seen = [];
    const r = await net.safeFetch('https://public.example/a', {}, { fetch: async u => { seen.push(u); return { status: 302, headers: new Map([['location', up.url + '/page']]), body: null }; } }).catch(e => e);
    assert.ok(r instanceof Error && r.refused, 'refused at the second hop'); assert.deepStrictEqual(seen, ['https://public.example/a']);
  } finally { up.s.close(); }
});

test('relay: a web page is never served as a web page; media and playlists still pass', async () => {
  process.env.ALLOW_PRIVATE_ADDONS = '1';
  const up = await upstream({
    '/page': { type: 'text/html; charset=utf-8', body: '<script>alert(1)</script>' },
    '/pic.svg': { type: 'image/svg+xml', body: '<svg onload="alert(1)"/>' },
    '/clip.mp4': { type: 'video/mp4', body: 'xxxx' },
    '/api.json': { type: 'application/json', body: '{"a":1}' },
    '/list.m3u8': { type: 'application/vnd.apple.mpegurl', body: '#EXTM3U\n#EXTINF:4,\nseg0.ts\n' },
    '/sub.srt': { type: 'text/plain', body: '1\n00:00:01,000 --> 00:00:02,000\nHi\n' },
    '/hop': { status: 302, headers: { Location: '/clip.mp4' } },
  });
  try {
    const page = await call({ action: 'proxy', url: up.url + '/page' });
    assert.strictEqual(page.headers['content-type'], 'text/plain; charset=utf-8');
    assert.strictEqual(page.headers['x-content-type-options'], 'nosniff');
    assert.match(page.headers['content-security-policy'], /sandbox/);
    assert.strictEqual((await call({ action: 'proxy', url: up.url + '/pic.svg' })).headers['content-type'], 'text/plain; charset=utf-8');
    const mp4 = await call({ action: 'proxy', url: up.url + '/clip.mp4' });
    assert.strictEqual(mp4.headers['content-type'], 'video/mp4'); assert.strictEqual(mp4.body, 'xxxx'); assert.strictEqual(mp4.headers['x-content-type-options'], 'nosniff');
    assert.strictEqual((await call({ action: 'proxy', url: up.url + '/hop' })).body, 'xxxx', 'an allowed redirect is followed');
    const js = await call({ action: 'proxy', raw: '1', url: up.url + '/api.json' });
    assert.strictEqual(js.headers['content-type'], 'text/plain; charset=utf-8'); assert.deepStrictEqual(js.json, { a: 1 });
    const pl = await call({ action: 'proxy', url: up.url + '/list.m3u8' });
    assert.strictEqual(pl.headers['content-type'], 'application/vnd.apple.mpegurl');
    assert.match(pl.body, /https:\/\/app\.test\/api\?action=proxy&ref=&url=http%3A%2F%2F127\.0\.0\.1%3A\d+%2Fseg0\.ts/);
    const vtt = await call({ action: 'proxy', fmt: 'vtt', url: up.url + '/sub.srt' });
    assert.strictEqual(vtt.headers['content-type'], 'text/vtt; charset=utf-8'); assert.match(vtt.body, /^WEBVTT\n\n1\n00:00:01\.000 --> 00:00:02\.000/);
    assert.strictEqual((await call({ action: 'proxy', fmt: 'vtt', url: up.url + '/missing.srt' })).status, 404);
  } finally { delete process.env.ALLOW_PRIVATE_ADDONS; up.s.close(); }
  for (const [t, want] of [['text/html', 'text/plain; charset=utf-8'], ['application/xhtml+xml', 'text/plain; charset=utf-8'], ['image/svg+xml', 'text/plain; charset=utf-8'], ['video/mp2t', 'video/mp2t'], ['image/png', 'image/png'],
    ['application/pdf', 'application/octet-stream'], ['', 'application/octet-stream']]) assert.strictEqual(handler.relayType(t), want, t);
});

test('pairing: a phone can send to a waiting TV once; wrong codes are counted and then refused', async () => {
  const ip = '198.51.100.7';
  const start = await call({ action: 'pair_start' }, { ip });
  assert.match(start.json.code, /^[A-HJ-NP-Z2-9]{6}$/);
  assert.strictEqual((await call({ action: 'pair_poll', code: start.json.code }, { ip })).json.status, 'waiting');
  assert.strictEqual((await call({ action: 'pair_put' }, { ip, body: { code: start.json.code, kind: 'm3u', url: 'https://tv.example/list.m3u', name: 'Mine' } })).status, 200);
  const got = await call({ action: 'pair_poll', code: start.json.code }, { ip });
  assert.strictEqual(got.json.status, 'ok'); assert.strictEqual(got.json.playlist.url, 'https://tv.example/list.m3u');
  assert.notStrictEqual((await call({ action: 'pair_poll', code: start.json.code }, { ip })).json.status, 'ok', 'handed out once');
  // polling a real code never counts, guessing does
  const bad = '198.51.100.8';
  let last;
  for (let i = 0; i < 31; i++) last = await call({ action: 'pair_poll', code: 'ZZZZZ' + (i % 8 + 2) }, { ip: bad });
  assert.strictEqual(last.status, 429);
  assert.strictEqual((await call({ action: 'al_poll', code: 'AAAAAA' }, { ip: bad })).status, 429, 'the same count covers AniList codes');
  assert.strictEqual((await call({ action: 'pair_start' }, { ip })).status, 200, 'other addresses are not affected');
  assert.strictEqual((await call({ action: 'pair_put' }, { ip, body: '{not json' })).status, 400, 'a broken body is a 400, not a server error');
});

test('accounts: one winner per name, stronger hashing, wrong passwords are limited, sync data keeps its shape', async () => {
  const ip = '198.51.100.20';
  const reg = await call({ action: 'register' }, { ip, body: { username: 'Alyssa', password: 'correct horse' } });
  assert.strictEqual(reg.status, 200); assert.strictEqual(reg.json.username, 'alyssa');
  assert.strictEqual((await call({ action: 'register' }, { ip, body: { username: 'alyssa', password: 'another one' } })).status, 409);
  assert.strictEqual(await accounts.store.add('user:alyssa', { x: 1 }), false, 'add() never overwrites');
  const rec = await accounts.store.get('user:alyssa'); assert.strictEqual(rec.it, 100000);
  // an account made with the earlier, weaker setting still signs in and is upgraded
  const crypto = require('node:crypto'), salt = 'aa'.repeat(16);
  await accounts.store.set('user:oldie', { alg: 'pbkdf2', salt, hash: crypto.pbkdf2Sync('hunter22', salt, 60000, 32, 'sha256').toString('hex') });
  assert.strictEqual((await call({ action: 'login' }, { ip, body: { username: 'oldie', password: 'hunter22' } })).status, 200);
  assert.strictEqual((await accounts.store.get('user:oldie')).it, 100000);
  assert.strictEqual((await call({ action: 'login' }, { ip, body: { username: 'oldie', password: 'hunter22' } })).status, 200, 'and again after the upgrade');
  // sync
  const tok = reg.json.token, H = { authorization: 'Bearer ' + tok };
  assert.strictEqual((await call({ action: 'sync_put' }, { ip, headers: H, body: { data: { progress: 'oops', deleted: [1], list: [{ id: 1 }], history: 'x' } } })).status, 200);
  assert.deepStrictEqual((({ progress, list, history, deleted }) => ({ progress, list, history, deleted }))((await call({ action: 'sync_get' }, { ip, headers: H })).json.data), { progress: {}, list: [{ id: 1 }], history: [], deleted: {} });
  assert.strictEqual((await call({ action: 'sync_get' }, { ip, headers: { authorization: 'Bearer nope.nope' } })).status, 401);
  // guessing a password
  let last;
  for (let i = 0; i < 11; i++) last = await call({ action: 'login' }, { ip: '198.51.100.21', body: { username: 'alyssa', password: 'guess' + i } });
  assert.strictEqual(last.status, 429);
  assert.strictEqual((await call({ action: 'login' }, { ip: '198.51.100.21', body: { username: 'alyssa', password: 'correct horse' } })).status, 429, 'locked for that address for a while');
  assert.strictEqual((await call({ action: 'login' }, { ip: '198.51.100.22', body: { username: 'alyssa', password: 'correct horse' } })).status, 200, 'the owner can still sign in from elsewhere');
});

test('ids that go into provider addresses must be numbers', async () => {
  assert.strictEqual((await call({ action: 'sources', title: 'X', id: '1/../../x', ep: '1' })).status, 400);
  assert.strictEqual((await call({ action: 'avtest', p: 'animegg', id: '../x' })).status, 400);
});

test('Android version codes: unique per version, betas just below their release, always rising', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'tools', 'build_apk.py'), 'utf8');
  assert.match(src, /code = major \* 1000000 \+ minor \* 10000 \+ patch \* 100 \+ \(int\(beta\) if beta else 99\)/);
  const code = v => { const m = /^(\d+)\.(\d+)\.(\d+)(?:-beta\.(\d+))?$/.exec(v); return +m[1] * 1000000 + +m[2] * 10000 + +m[3] * 100 + (m[4] ? +m[4] : 99); };
  const order = ['1.10.0', '1.10.1-beta.1', '1.10.1', '1.10.2', '1.10.3', '1.11.0-beta.1', '1.11.0-beta.2', '1.11.0', '2.0.0-beta.1', '2.0.0'].map(code);
  for (let i = 1; i < order.length; i++) assert.ok(order[i] > order[i - 1], 'rises at ' + i);
  assert.ok(code('1.10.1') > 11100, 'above the code the last release was built with, so it installs over it');
});

test.after(() => { try { fs.rmSync(process.env.DATA_DIR, { recursive: true, force: true }); } catch (e) { /* ignore */ } });
