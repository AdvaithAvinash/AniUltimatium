'use strict';
// TurboScrape — small, dependency-free helpers shared by the Node server and the Cloudflare Worker.
//   cached()   TTL cache (bounded, LRU-ish) with in-flight de-duplication and short negative caching
//   scope()    request-scoped context: cancellation (abort when the client leaves / a race is lost) + outgoing-request counting
//   race()     hedged provider race: start the best source, start the next one early when the first is slow, take the first
//              playable result, cancel the rest. Never runs more than `maxParallel` sources and respects a request budget
//              (Workers free plan: ~50 subrequests per call).
// Everything is in memory and per instance; nothing here is required for correctness, it only removes waiting.

let ALS = null;
try { ALS = require('node:async_hooks').AsyncLocalStorage; } catch (e) { /* no async context: cancellation/counting disabled */ }
const als = ALS ? new ALS() : null;

// ---------------------------------------------------------------- abort helpers
const abortErr = () => { const e = new Error('aborted'); e.name = 'AbortError'; e.aborted = true; return e; };
const isAbort = e => !!e && (e.name === 'AbortError' || e.aborted === true);
function anySignal(list) {
  list = list.filter(Boolean);
  if (!list.length) return undefined;
  if (list.length === 1) return list[0];
  if (typeof AbortSignal !== 'undefined' && typeof AbortSignal.any === 'function') { try { return AbortSignal.any(list); } catch (e) { /* fall through */ } }
  const ac = new AbortController();
  for (const s of list) { if (s.aborted) { ac.abort(); break; } s.addEventListener('abort', () => ac.abort(), { once: true }); }
  return ac.signal;
}

// ---------------------------------------------------------------- request context (cancellation + subrequest counting)
function scope(signal, fn) {
  if (!als) return fn();
  const parent = als.getStore();
  const sig = anySignal([signal, parent && parent.signal]);
  return als.run({ signal: sig, n: 0, parent: parent || null }, fn);
}
const ctx = () => (als ? als.getStore() : undefined);
const used = () => { const c = ctx(); return c ? c.n : 0; };

function installFetch() {                                  // every outgoing fetch inside a scope() is cancellable and counted
  if (globalThis.__turboFetch || typeof globalThis.fetch !== 'function' || !als) return;
  globalThis.__turboFetch = true;
  const real = globalThis.fetch;
  globalThis.fetch = function (input, init) {
    const c = als.getStore();
    if (!c) return real.call(globalThis, input, init);
    for (let p = c; p; p = p.parent) p.n++;
    if (c.signal) {
      if (c.signal.aborted) return Promise.reject(abortErr());
      const own = init && init.signal;
      init = Object.assign({}, init, { signal: own ? anySignal([own, c.signal]) : c.signal });
    }
    return real.call(globalThis, input, init);
  };
}

// ---------------------------------------------------------------- TTL cache + in-flight de-duplication
const MAX_ENTRIES = 300;                                   // small on purpose (TV-class memory, Worker isolates)
const store = new Map();
const inflight = new Map();
const stats = { hit: 0, miss: 0, dedupe: 0, neg: 0 };
function getEntry(k) {
  const e = store.get(k);
  if (!e) return undefined;
  if (e.exp < Date.now()) { store.delete(k); return undefined; }
  store.delete(k); store.set(k, e);                        // LRU touch
  return e;
}
function setEntry(k, v, ttl, err) {
  store.set(k, { v, err, exp: Date.now() + ttl });
  while (store.size > MAX_ENTRIES) store.delete(store.keys().next().value);
}
// cached(key, ttlMs, fn, { negTtl: (err)=>ms })  -> value; concurrent callers with the same key share one execution
async function cached(key, ttl, fn, opts, retried) {
  opts = opts || {};
  const hit = getEntry(key);
  if (hit) { if (hit.err) { stats.neg++; throw hit.err; } stats.hit++; return hit.v; }
  const mine = ctx();
  if (inflight.has(key)) {
    stats.dedupe++;
    try { return await inflight.get(key); }
    catch (e) {                                            // the owner was cancelled but we are still waiting: run it ourselves once
      if (isAbort(e) && !retried && !(mine && mine.signal && mine.signal.aborted)) return cached(key, ttl, fn, opts, true);
      throw e;
    }
  }
  stats.miss++;
  const p = (async () => {
    try { const v = await fn(); setEntry(key, v, ttl); return v; }
    catch (e) { const nt = !isAbort(e) && opts.negTtl ? opts.negTtl(e) : 0; if (nt > 0) setEntry(key, undefined, nt, e); throw e; }
    finally { inflight.delete(key); }
  })();
  inflight.set(key, p);
  return p;
}
const drop = key => store.delete(key);

// ---------------------------------------------------------------- error classification (content missing vs. provider broken)
const ABSENT = /\bno\b[^|;]{0,30}\bmatch|match (not|found)|not found|not confident|no confident|no dub|no sub|not available|only embeds|no (video )?(streams?|sources?|link)|episode[^|;]{0,24}\bnot\b|cannot find|could not resolve titles/i;
function absent(msg) { const e = new Error(msg); e.absent = true; return e; }
function kindOf(e) {
  const m = String((e && e.message) || e || '');
  if (isAbort(e)) return 'cancelled';
  if (/subrequest/i.test(m)) return 'budget';
  if (/timed out|timeout/i.test(m)) return 'timeout';
  if ((e && e.absent) || ABSENT.test(m)) return 'absent';          // the provider simply does not have this title/episode: not a reliability problem
  return 'fail';
}

// ---------------------------------------------------------------- per-source latency memory (adapts hedge delay and timeouts)
const perf = Object.create(null);
function note(key, ms, ok) {
  const p = perf[key] || (perf[key] = { ewma: 0, n: 0, fails: 0 });
  if (ok) { p.ewma = p.n ? p.ewma * 0.7 + ms * 0.3 : ms; p.n++; p.fails = 0; } else p.fails++;
}
const costMemo = Object.create(null);                      // observed outgoing requests per call, per source (EWMA)
function learnCost(key, n) { if (n > 0) costMemo[key] = costMemo[key] ? Math.round(costMemo[key] * 0.6 + n * 0.4) : n; }
const costOf = c => costMemo[c.key] || c.cost || 10;
const hedgeDelay = key => { const p = perf[key]; return p && p.n >= 2 ? Math.max(1500, Math.min(3500, Math.round(p.ewma * 1.8))) : 2200; };
function timeoutFor(key, max) {                              // generous: a slow-but-working source must not be cut off (reliability first)
  const p = perf[key];
  const t = p && p.n >= 3 ? Math.round(p.ewma * 3 + 2500) : max;
  return Math.max(6000, Math.min(max, t));
}

// ---------------------------------------------------------------- hedged race
// cands: [{ key, cost, max (timeout ceiling ms), run() -> Promise<result> }] in priority order
// resolves { result, key, trace, n } with the first successful candidate; rejects with err.trace when every candidate failed
function race(cands, o) {
  o = o || {};
  const maxPar = o.maxParallel || 2, budget = o.budget || 45;
  const t0 = Date.now(), trace = [], running = new Map(), pending = cands.slice();
  let used = 0, done = false, stop = false;
  const reqSignal = o.signal;
  const total = () => { const c = ctx(); return c ? c.n : 0; };
  return new Promise((resolve, reject) => {
    const settle = () => { if (!done && !running.size && (!pending.length || stop)) { done = true; const e = new Error('no source'); e.trace = trace; reject(e); } };
    function startNext() {
      if (done || stop || !pending.length || running.size >= maxPar) return false;
      let at = 0;
      if (running.size) {                                                       // overlapping: take the first source that fits the remaining request budget
        at = pending.findIndex(c => used + costOf(c) <= budget);
        if (at < 0) return false;
      }
      const c = pending.splice(at, 1)[0];
      used += costOf(c); launch(c); return true;
    }
    function launch(c) {
      const ac = new AbortController(), t = Date.now();
      const onReq = () => ac.abort();
      if (reqSignal) { if (reqSignal.aborted) ac.abort(); else reqSignal.addEventListener('abort', onReq, { once: true }); }
      const ent = { ac, c, t, timer: null, hedge: null, ctx: null };
      running.set(c.key, ent);
      ent.timer = setTimeout(() => { ent.timedOut = true; ac.abort(); }, o.timeoutMs != null ? o.timeoutMs : timeoutFor(c.key, c.max || 12000));
      ent.hedge = setTimeout(() => { startNext(); }, o.hedgeMs != null ? o.hedgeMs : hedgeDelay(c.key));        // first one is slow: start the next source early
      const fin = () => { clearTimeout(ent.timer); clearTimeout(ent.hedge); if (reqSignal) reqSignal.removeEventListener('abort', onReq); running.delete(c.key); if (ent.ctx) { used -= costOf(c); learnCost(c.key, ent.ctx.n); used += costOf(c); } };
      const aborted = new Promise((_, rej) => { ac.signal.addEventListener('abort', () => rej(abortErr()), { once: true }); });
      Promise.race([scope(ac.signal, () => { ent.ctx = ctx(); return Promise.resolve().then(() => c.run()); }), aborted]).then(res => {
        const ms = Date.now() - t; fin();
        if (done) { trace.push({ k: c.key, ok: false, ms, kind: 'cancelled' }); return; }
        done = true; note(c.key, ms, true);
        trace.push({ k: c.key, ok: true, ms, kind: 'ok' });
        for (const [, other] of running) { clearTimeout(other.timer); clearTimeout(other.hedge); other.ac.abort(); trace.push({ k: other.c.key, ok: false, ms: Date.now() - other.t, kind: 'cancelled' }); }
        running.clear();
        resolve({ result: res, key: c.key, trace, n: total(), ms: Date.now() - t0 });
      }, err => {
        const ms = Date.now() - t, timedOut = ent.timedOut; fin();
        if (done) return;
        const kind = timedOut ? 'timeout' : kindOf(err);
        trace.push({ k: c.key, ok: false, ms, kind, msg: String((err && err.message) || err).slice(0, 120) });
        if (kind === 'cancelled') { settle(); return; }
        if (kind !== 'absent') note(c.key, ms, false);
        if (kind === 'budget') stop = true;                                      // out of outgoing requests for this call: caller retries the rest
        if (!startNext()) settle();
      });
    }
    if (reqSignal && reqSignal.aborted) { done = true; const e = abortErr(); e.trace = trace; reject(e); return; }
    if (!startNext()) settle();
  });
}

module.exports = { learnCost, costOf, scope, ctx, used, installFetch, cached, drop, stats, absent, kindOf, isAbort, race, note, perf, hedgeDelay, timeoutFor, anySignal, abortErr, MAX_ENTRIES, store };
