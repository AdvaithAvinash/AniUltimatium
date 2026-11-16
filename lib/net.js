'use strict';
// Network safety shared by the proxy, the stream check and the add-on fetches:
//   publicUrl()     is this an http(s) address of a public host? (the server must never be a door into a private network)
//   resolvesPublic() the same, after looking the name up (Node only; a public name can point at a private address)
//   safeFetch()     fetch that follows redirects itself and checks every hop
//   readText()      a response body as text, with a size limit
//   limiter()       a small in-memory attempt counter (per instance)
//   sha()           a short stable hash for cache keys
const crypto = require('crypto');

const allowPrivate = () => !!(typeof process !== 'undefined' && process.env && process.env.ALLOW_PRIVATE_ADDONS);   // a self-hosted server on your own network
function privateIp(host) {
  host = String(host || '').toLowerCase().replace(/^\[|\]$/g, '');
  if (/^\d+\.\d+\.\d+\.\d+$/.test(host)) {
    const p = host.split('.').map(Number);
    return p[0] === 0 || p[0] === 10 || p[0] === 127 || (p[0] === 169 && p[1] === 254) || (p[0] === 172 && p[1] >= 16 && p[1] <= 31) || (p[0] === 192 && p[1] === 168)
      || (p[0] === 100 && p[1] >= 64 && p[1] <= 127) || p[0] >= 224;
  }
  if (host.indexOf(':') >= 0) {                              // IPv6: loopback, unspecified, unique-local, link-local, and IPv4 written inside IPv6
    if (host === '::' || host === '::1' || /^f[cd]/.test(host) || /^fe[89ab]/.test(host)) return true;
    const m = /^::ffff:(.+)$/.exec(host);
    if (m) {
      if (/^\d+\.\d+\.\d+\.\d+$/.test(m[1])) return privateIp(m[1]);
      const h = m[1].split(':');
      if (h.length === 2) { const a = parseInt(h[0], 16), b = parseInt(h[1], 16); return privateIp([a >> 8, a & 255, b >> 8, b & 255].join('.')); }
      return true;
    }
    return false;
  }
  return false;
}
function publicUrl(u) {
  let h; try { h = new URL(u); } catch (e) { return false; }
  if (!/^https?:$/.test(h.protocol)) return false;
  if (allowPrivate()) return true;
  const host = h.hostname.toLowerCase();
  if (host === 'localhost' || host.endsWith('.localhost') || host.endsWith('.local') || host.endsWith('.internal')) return false;
  return !privateIp(host);
}
// Node only (Workers cannot reach private networks and have no resolver): a name that points at a private address is refused.
const dnsMemo = new Map();
async function resolvesPublic(u) {
  if (!publicUrl(u)) return false;
  if (allowPrivate()) return true;
  let host; try { host = new URL(u).hostname.replace(/^\[|\]$/g, ''); } catch (e) { return false; }
  if (/^[\d.]+$/.test(host) || host.indexOf(':') >= 0 || globalThis.__ENV) return true;      // already an address (checked above), or running on Workers
  const hit = dnsMemo.get(host);
  if (hit && hit.exp > Date.now()) return hit.ok;
  let ok = true;
  try {
    const list = await require('dns').promises.lookup(host, { all: true });
    ok = !list.some(a => privateIp(a.address));
  } catch (e) { ok = true; }                                  // the name does not resolve: the fetch itself will fail
  if (dnsMemo.size > 500) dnsMemo.clear();
  dnsMemo.set(host, { ok, exp: Date.now() + 5 * 60 * 1000 });
  return ok;
}
function refused(msg) { const e = new Error(msg || 'address is not public'); e.status = 400; e.refused = true; return e; }

// fetch that follows redirects by hand so that every hop is checked. o: { fetch, max (hops), check (async url -> bool) }
async function safeFetch(url, init, o) {
  o = o || {};
  const f = o.fetch || globalThis.fetch, check = o.check || (async u => publicUrl(u));
  let cur = String(url);
  for (let i = 0; i <= (o.max == null ? 5 : o.max); i++) {
    if (!(await check(cur))) throw refused();
    const r = await f(cur, Object.assign({}, init, { redirect: 'manual' }));
    const loc = r.status >= 300 && r.status < 400 && r.headers && r.headers.get && r.headers.get('location');
    if (!loc) return r;
    try { if (r.body && r.body.cancel) await r.body.cancel(); } catch (e) { /* ignore */ }
    cur = new URL(loc, cur).href;
  }
  throw new Error('too many redirects');
}

// Body as text, at most `max` bytes (a playlist or subtitle file is small; anything bigger is not what it claims to be)
async function readText(r, max) {
  if (!r.body || typeof r.body.getReader !== 'function') { const t = await r.text(); if (t.length > max) throw new Error('answer too large'); return t; }
  const reader = r.body.getReader(), chunks = []; let n = 0;
  for (;;) {
    const x = await reader.read(); if (x.done) break;
    n += x.value.length;
    if (n > max) { try { await reader.cancel(); } catch (e) { /* ignore */ } throw new Error('answer too large'); }
    chunks.push(x.value);
  }
  const all = new Uint8Array(n); let at = 0; for (const c of chunks) { all.set(c, at); at += c.length; }
  return new TextDecoder().decode(all);
}
// First `want` bytes of a body, then the download is stopped (a server that ignores Range must not make us read a whole film)
async function readHead(r, want) {
  if (!r.body || typeof r.body.getReader !== 'function') { const b = await r.arrayBuffer(); return new Uint8Array(b.slice(0, want)); }
  const reader = r.body.getReader(), chunks = []; let n = 0;
  while (n < want) { const x = await reader.read(); if (x.done) break; chunks.push(x.value); n += x.value.length; }
  try { await reader.cancel(); } catch (e) { /* ignore */ }
  const all = new Uint8Array(n); let at = 0; for (const c of chunks) { all.set(c, at); at += c.length; }
  return all.subarray(0, want);
}

// limiter(max, windowMs): hit(key) -> true while the key is within its allowance. In memory and per instance: it slows guessing down, it is not a hard guarantee.
function limiter(max, windowMs) {
  const m = new Map();
  const live = (k, now) => { const e = m.get(k); if (e && e.exp > now) return e; if (e) m.delete(k); return null; };
  return {
    blocked(k) { const e = live(k, Date.now()); return !!e && e.n >= max; },
    hit(k) {
      const now = Date.now(); let e = live(k, now);
      if (!e) { if (m.size > 5000) m.clear(); e = { n: 0, exp: now + windowMs }; m.set(k, e); }
      e.n++; return e.n <= max;
    },
    reset(k) { m.delete(k); },
  };
}
// Cloudflare sets cf-connecting-ip itself; x-forwarded-for is only believed on Vercel (anyone can send it to a plain Node server)
function clientIp(req) {
  const h = (req && req.headers) || {}, xff = String(h['x-forwarded-for'] || '').split(',')[0].trim();
  const vercel = typeof process !== 'undefined' && process.env && process.env.VERCEL && !globalThis.__ENV;
  return String(h['cf-connecting-ip'] || (vercel && xff) || (req && req.socket && req.socket.remoteAddress) || xff || 'unknown');
}
const sha = s => crypto.createHash('sha256').update(String(s)).digest('hex').slice(0, 24);

module.exports = { publicUrl, privateIp, resolvesPublic, safeFetch, readText, readHead, limiter, clientIp, sha, refused };
