'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const turbo = require('../lib/turbo.js');

const sleep = ms => new Promise(r => setTimeout(r, ms));
// a fake provider: resolves after `ms` (or rejects), and notices cancellation through the scoped fetch signal
function provider(log, key, ms, outcome) {
  return {
    key, cost: 6,
    run: () => new Promise((resolve, reject) => {
      log.push('start:' + key);
      const sig = turbo.ctx() && turbo.ctx().signal;
      const t = setTimeout(() => (outcome instanceof Error ? reject(outcome) : resolve({ url: 'u-' + key })), ms);
      if (sig) sig.addEventListener('abort', () => { clearTimeout(t); log.push('abort:' + key); reject(turbo.abortErr()); }, { once: true });
    }),
  };
}

test('cached: TTL, hit counting and expiry', async () => {
  let calls = 0;
  const f = () => { calls++; return Promise.resolve({ n: calls }); };
  const a = await turbo.cached('t:ttl', 40, f), b = await turbo.cached('t:ttl', 40, f);
  assert.equal(calls, 1); assert.deepEqual(a, b);
  await sleep(60);
  const c = await turbo.cached('t:ttl', 40, f);
  assert.equal(calls, 2); assert.equal(c.n, 2);
});

test('cached: concurrent identical requests share one execution', async () => {
  let calls = 0;
  const f = async () => { calls++; await sleep(30); return 'v'; };
  const r = await Promise.all([1, 2, 3, 4, 5].map(() => turbo.cached('t:dedupe', 1000, f)));
  assert.equal(calls, 1); assert.deepEqual(r, ['v', 'v', 'v', 'v', 'v']);
});

test('cached: failures are not cached unless a negative TTL is given', async () => {
  let calls = 0;
  const f = () => { calls++; return Promise.reject(new Error('boom')); };
  await assert.rejects(turbo.cached('t:err', 1000, f), /boom/);
  await assert.rejects(turbo.cached('t:err', 1000, f), /boom/);
  assert.equal(calls, 2);
  let n2 = 0;
  const g = () => { n2++; return Promise.reject(turbo.absent('no match')); };
  const opts = { negTtl: e => (e.absent ? 80 : 0) };
  await assert.rejects(turbo.cached('t:neg', 1000, g, opts), /no match/);
  await assert.rejects(turbo.cached('t:neg', 1000, g, opts), /no match/);
  assert.equal(n2, 1);                                   // second call answered from the negative cache
  await sleep(100);
  await assert.rejects(turbo.cached('t:neg', 1000, g, opts), /no match/);
  assert.equal(n2, 2);
});

test('cached: stays bounded', async () => {
  for (let i = 0; i < turbo.MAX_ENTRIES + 80; i++) await turbo.cached('t:big:' + i, 10000, () => i);
  assert.ok(turbo.store.size <= turbo.MAX_ENTRIES);
});

test('kindOf separates missing content from broken providers', () => {
  assert.equal(turbo.kindOf(new Error('anivexa HTTP 500 No MKissa match for "x"')), 'absent');
  assert.equal(turbo.kindOf(new Error('no dub')), 'absent');
  assert.equal(turbo.kindOf(new Error('stream HTTP 403')), 'fail');
  assert.equal(turbo.kindOf(new Error('animex timed out')), 'timeout');
  assert.equal(turbo.kindOf(new Error('Too many subrequests by single Worker invocation')), 'budget');
  assert.equal(turbo.kindOf(turbo.abortErr()), 'cancelled');
});

test('race: a healthy first source answers alone (no wasted requests)', async () => {
  const log = [];
  const r = await turbo.race([provider(log, 'a', 20), provider(log, 'b', 20)], { hedgeMs: 200, timeoutMs: 2000 });
  assert.equal(r.key, 'a'); assert.deepEqual(log, ['start:a']);
});

test('race: a fast failure starts the next source immediately', async () => {
  const log = [], t0 = Date.now();
  const r = await turbo.race([provider(log, 'a', 10, new Error('stream HTTP 403')), provider(log, 'b', 30)], { hedgeMs: 1500, timeoutMs: 3000 });
  assert.equal(r.key, 'b'); assert.ok(Date.now() - t0 < 500, 'did not wait for the hedge delay');
  assert.equal(r.trace.find(x => x.k === 'a').kind, 'fail');
});

test('race: a slow first source is hedged and the loser is cancelled', async () => {
  const log = [], t0 = Date.now();
  const r = await turbo.race([provider(log, 'slow', 1500), provider(log, 'fast', 40)], { hedgeMs: 120, timeoutMs: 3000 });
  const took = Date.now() - t0;
  assert.equal(r.key, 'fast'); assert.ok(took < 600, 'hedge answered long before the slow source: ' + took + 'ms');
  assert.deepEqual(log.filter(x => x.startsWith('start')), ['start:slow', 'start:fast']);
  assert.ok(log.includes('abort:slow'), 'the slow source was cancelled');
  assert.equal(r.trace.find(x => x.k === 'slow').kind, 'cancelled');
});

test('race: a hung source is cut off by its timeout and the next one runs', async () => {
  const log = [], t0 = Date.now();
  const r = await turbo.race([provider(log, 'hang', 60000), provider(log, 'ok', 30)], { hedgeMs: 5000, timeoutMs: 150 });
  assert.equal(r.key, 'ok'); assert.ok(Date.now() - t0 < 700);
  assert.equal(r.trace.find(x => x.k === 'hang').kind, 'timeout');
});

test('race: all failing -> rejects with a trace; missing content is flagged absent', async () => {
  const log = [];
  await assert.rejects(turbo.race([provider(log, 'a', 5, turbo.absent('no match')), provider(log, 'b', 5, new Error('HTTP 500'))], { timeoutMs: 1000 }),
    e => { assert.deepEqual(e.trace.map(x => x.kind), ['absent', 'fail']); return true; });
});

test('race: a hedge skips a heavy source and takes a cheap one that fits the request budget', async () => {
  const log = [];
  const heavy = provider(log, 'heavy', 300); heavy.cost = 70;
  const r = await turbo.race([provider(log, 'a', 600), heavy, provider(log, 'cheap', 40)], { hedgeMs: 60, timeoutMs: 3000, budget: 45 });
  assert.equal(r.key, 'cheap'); assert.deepEqual(log.filter(x => x.startsWith('start')), ['start:a', 'start:cheap']);   // heavy never overlapped
});

test('race: a heavy source still runs when it is next and nothing else is running', async () => {
  const log = [];
  const heavy = provider(log, 'heavy', 20); heavy.cost = 70;
  const r = await turbo.race([provider(log, 'a', 5, new Error('HTTP 500')), heavy], { hedgeMs: 1000, timeoutMs: 3000, budget: 45 });
  assert.equal(r.key, 'heavy');
});

test('race: learns the real request cost of a source', async () => {
  globalThis.fetch = () => Promise.resolve('x'); delete globalThis.__turboFetch; turbo.installFetch();
  const c = { key: 'learned', cost: 6, run: async () => { await fetch('1'); await fetch('2'); await fetch('3'); await fetch('4'); return 'ok'; } };
  await turbo.race([c], { timeoutMs: 1000 });
  assert.equal(turbo.costOf(c), 4);
});

test('race: a budget error stops starting more sources (the caller retries the rest)', async () => {
  const log = [];
  await assert.rejects(turbo.race([provider(log, 'a', 5, new Error('Too many subrequests by single Worker invocation')), provider(log, 'b', 5)], { timeoutMs: 1000 }),
    e => { assert.equal(e.trace[0].kind, 'budget'); return true; });
  assert.deepEqual(log, ['start:a']);
});

test('race: the request being cancelled cancels every running source', async () => {
  const log = [], ac = new AbortController();
  const p = turbo.race([provider(log, 'a', 5000)], { signal: ac.signal, timeoutMs: 8000 });
  await sleep(30); ac.abort();
  await assert.rejects(p);
  assert.ok(log.includes('abort:a'));
});

test('installFetch: scoped fetches are counted and cancellable; unscoped fetches are untouched', async () => {
  let seenSignal = null;
  globalThis.fetch = (u, init) => new Promise((res, rej) => { seenSignal = init && init.signal; if (seenSignal) seenSignal.addEventListener('abort', () => rej(turbo.abortErr())); else res('plain'); setTimeout(() => res('ok'), 200); });
  delete globalThis.__turboFetch; turbo.installFetch();
  assert.equal(await fetch('x'), 'plain');                                                    // outside a scope: passthrough
  const ac = new AbortController();
  await turbo.scope(ac.signal, async () => {
    const p = fetch('a'); const p2 = fetch('b').catch(() => 'b-aborted');
    assert.equal(turbo.used(), 2);
    ac.abort();
    await assert.rejects(p, e => turbo.isAbort(e)); assert.equal(await p2, 'b-aborted');
  });
});
