'use strict';
const test = require('node:test');
const assert = require('node:assert');

// ---- fakes: Durable Object storage + namespace, and a KV that counts writes (and can be told its daily limit is used up) ----
function fakeStorage() {
  const m = new Map(); let alarm = 0;
  return {
    m, async get(k) { return m.get(k); }, async put(k, v) { m.set(k, v); }, async delete(k) { m.delete(k); },
    async list(o) { const out = new Map(); for (const [k, v] of m) if (!o || !o.prefix || k.startsWith(o.prefix)) out.set(k, v); return out; },
    async getAlarm() { return alarm || null; }, async setAlarm(t) { alarm = t; }, alarmAt: () => alarm,
  };
}
function fakeKV(seed) {
  const m = new Map(Object.entries(seed || {})); const kv = { writes: 0, limited: false, m };
  kv.get = async k => (m.has(k) ? m.get(k) : null);
  kv.put = async (k, v) => { kv.writes++; if (kv.limited) throw new Error('KV put() limit exceeded for the day.'); m.set(k, v); };
  return kv;
}

test('PairBox: set/get, temporary entries expire, alarm cleans up, big values refused', async () => {
  const { PairBox } = await import('../worker/pairbox.mjs');
  const st = fakeStorage(), box = new PairBox({ storage: st });
  const call = async m => (await box.fetch(new Request('https://box/', { method: 'POST', body: JSON.stringify(m) }))).json();
  assert.strictEqual(await call({ op: 'get', key: 'a' }), null);
  await call({ op: 'set', key: 'user:1', value: { x: 1 } });
  assert.deepStrictEqual(await call({ op: 'get', key: 'user:1' }), { x: 1 });
  await call({ op: 'set', key: 'ip:ABC', value: { at: 1 }, ttl: 50 });
  assert.deepStrictEqual(await call({ op: 'get', key: 'ip:ABC' }), { at: 1 });
  assert.ok(st.m.has('t:ip:ABC') && st.alarmAt() > 0, 'temporary entry stored under t: with an alarm');
  await new Promise(r => setTimeout(r, 70));
  assert.strictEqual(await call({ op: 'get', key: 'ip:ABC' }), null, 'expired entries read as missing');
  await call({ op: 'set', key: 'ip:OLD', value: 1, ttl: 10 });
  await new Promise(r => setTimeout(r, 30));
  await box.alarm();
  assert.ok(!st.m.has('t:ip:OLD') && st.m.has('user:1'), 'alarm removes expired temporary entries only');
  await call({ op: 'del', key: 'user:1' });
  assert.strictEqual(await call({ op: 'get', key: 'user:1' }), null);
  const big = await box.fetch(new Request('https://box/', { method: 'POST', body: JSON.stringify({ op: 'set', key: 'big', value: 'x'.repeat(1900000) }) }));
  assert.strictEqual(big.status, 413);
  assert.strictEqual((await box.fetch(new Request('https://box/', { method: 'POST', body: '{' }))).status, 400);
});

test('accounts.store on Workers: Durable Object is primary, old KV data is carried over, KV is never written', async () => {
  const { PairBox } = await import('../worker/pairbox.mjs');
  const st = fakeStorage(), box = new PairBox({ storage: st }), kv = fakeKV({ 'data:old': JSON.stringify({ progress: { k: 1 } }) });
  const ns = { idFromName: n => n, get: () => ({ fetch: (u, init) => box.fetch(new Request(u, init)) }) };
  globalThis.__ENV = { PAIR: ns, STORE: kv };
  delete require.cache[require.resolve('../lib/accounts.js')];
  const { store } = require('../lib/accounts.js');
  assert.strictEqual(store.persistent(), true);
  assert.deepStrictEqual(await store.get('data:old'), { progress: { k: 1 } }, 'legacy KV value is still found');
  assert.ok(st.m.has('data:old'), 'and copied into the Durable Object');
  kv.limited = true;                                                             // KV's daily write limit is used up: nothing may notice
  await store.set('data:new', { a: 1 });
  await store.set('ip:CODE12', { at: Date.now(), data: null }, 600000);
  await store.set('ip:CODE12', { at: Date.now(), data: { type: 'm3u', url: 'http://x/y.m3u' } }, 600000);
  assert.deepStrictEqual((await store.get('ip:CODE12')).data, { type: 'm3u', url: 'http://x/y.m3u' });
  assert.deepStrictEqual(await store.get('data:new'), { a: 1 });
  assert.strictEqual(kv.writes, 0, 'no KV writes at all');
  assert.strictEqual(await store.get('nothing:here'), null);
  delete globalThis.__ENV; delete require.cache[require.resolve('../lib/accounts.js')];
});

test('pairing through the API handler: start, phone puts, TV polls once, wrong code refused, storage limit becomes a clear message', async () => {
  const { PairBox } = await import('../worker/pairbox.mjs');
  const st = fakeStorage(), box = new PairBox({ storage: st });
  let broken = false;
  const ns = { idFromName: n => n, get: () => ({ fetch: (u, init) => broken ? Promise.reject(new Error('KV put() limit exceeded for the day.')) : box.fetch(new Request(u, init)) }) };
  globalThis.__ENV = { PAIR: ns };
  for (const k of Object.keys(require.cache)) if (/\/(api\/index|lib\/accounts)\.js$/.test(k)) delete require.cache[k];
  const handler = require('../api/index.js');
  const call = (query, body) => new Promise(resolve => {
    const res = { code: 200, h: {}, setHeader(k, v) { this.h[k] = v; }, status(c) { this.code = c; return this; }, send(b) { this.out = b; resolve(this); }, end(b) { this.out = b; resolve(this); } };
    res.json = b => { res.out = JSON.stringify(b); resolve(res); return res; };
    handler({ method: body ? 'POST' : 'GET', query, headers: { host: 'tv.test', 'x-forwarded-proto': 'https' }, body }, res);
  }).then(r => ({ status: r.code || 200, body: r.out ? JSON.parse(r.out) : null }));
  const s = await call({ action: 'pair_start' });
  assert.strictEqual(s.status, 200); assert.match(s.body.code, /^[A-Z0-9]{6}$/); assert.strictEqual(s.body.url, 'https://tv.test/add.html');
  assert.strictEqual((await call({ action: 'pair_poll', code: s.body.code })).body.status, 'waiting');
  const bad = await call({ action: 'pair_put' }, { code: 'ZZZZZZ', kind: 'm3u', url: 'http://a.b/c.m3u' }); assert.strictEqual(bad.status, 410);
  const put = await call({ action: 'pair_put' }, { code: s.body.code.toLowerCase(), kind: 'xtream', name: 'X', server: 'host.example:8080', user: 'u', pass: 'p' }); assert.strictEqual(put.status, 200);
  const got = await call({ action: 'pair_poll', code: s.body.code });
  assert.strictEqual(got.body.status, 'ok'); assert.deepStrictEqual(got.body.playlist, { type: 'xtream', name: 'X', server: 'host.example:8080', user: 'u', pass: 'p' });
  assert.notStrictEqual((await call({ action: 'pair_poll', code: s.body.code })).body.status, 'ok', 'handed out once');
  broken = true;
  const lim = await call({ action: 'pair_start' });
  assert.strictEqual(lim.status, 503); assert.match(lim.body.error, /daily limit/); assert.match(lim.body.error, /Xtream login/);
  delete globalThis.__ENV;
  for (const k of Object.keys(require.cache)) if (/\/(api\/index|lib\/accounts)\.js$/.test(k)) delete require.cache[k];
});
