// SportSRC proxy (https://api.sportsrc.org/v3). The licence key stays on the server (environment variable SPORTSRC_KEY, a Cloudflare secret in production);
// the app only ever sends "type", "sport", "status", "date" and "id", all checked here. A signed-in viewer may also send their own key in the X-Sportsrc-Key header.
// The free plan allows 1000 requests a day for the key, so every answer is cached on the server and shared by all viewers, and nothing is asked once few requests are left.
const { UA } = require('./http');

const BASE = 'https://api.sportsrc.org/v3/';
const TTL = { matches_live: 150e3, matches: 900e3, detail: 180e3, sports: 3600e3 };
const cache = new Map();
let remaining = null, limit = null, plan = '';

const ok = {
  type: v => /^(matches|detail|sports)$/.test(v),
  sport: v => /^[a-z_]{1,24}$/.test(v),
  status: v => /^(inprogress|live|notstarted|upcoming|finished|ended|all)$/.test(v),
  date: v => /^\d{4}-\d{2}-\d{2}$/.test(v),
  id: v => /^[A-Za-z0-9_-]{1,160}$/.test(v)
};
function bad(msg, status) { const e = new Error(msg); e.status = status || 400; return e; }

// -> { url, ttl, key } for a valid request, or throws (HTTP 400)
function build(q) {
  const type = String(q.type || '');
  if (!ok.type(type)) throw bad('type must be matches, detail or sports');
  const p = [['type', type]];
  if (type === 'matches') {
    const sport = String(q.sport || 'football'), status = q.status ? String(q.status) : '', date = q.date ? String(q.date) : '';
    if (!ok.sport(sport)) throw bad('bad sport');
    p.push(['sport', sport]);
    if (status) { if (!ok.status(status)) throw bad('bad status'); p.push(['status', status]); }
    if (date) { if (!ok.date(date)) throw bad('bad date'); p.push(['date', date]); }
  } else if (type === 'detail') {
    const id = String(q.id || ''); if (!ok.id(id)) throw bad('bad id'); p.push(['id', id]);
  }
  const live = type === 'matches' && /^(inprogress|live)$/.test(String(q.status || ''));
  return { url: BASE + '?' + p.map(x => x[0] + '=' + encodeURIComponent(x[1])).join('&'), ttl: live ? TTL.matches_live : TTL[type], key: p.map(x => x.join('=')).join('&') };
}

async function call(q, ctx = {}) {
  const r = build(q), own = ctx.key && /^[A-Za-z0-9]{16,64}$/.test(ctx.key) ? ctx.key : '', key = own || process.env.SPORTSRC_KEY || '';
  if (!key) throw bad('SportSRC is not set up on this server (no SPORTSRC_KEY)', 503);
  const ck = (own ? 'u:' : 's:') + r.key, hit = cache.get(ck), now = Date.now();
  if (hit && now - hit.at < r.ttl) return Object.assign({}, hit.d, { _cached: true });
  if (!own && remaining !== null && remaining < 40 && hit) return Object.assign({}, hit.d, { _cached: true, _stale: true });     // nearly out of requests for today: serve what we have
  const f = ctx.fetch || fetch, ctl = typeof AbortController === 'function' ? new AbortController() : null, t = setTimeout(() => ctl && ctl.abort(), 12000);
  try {
    const res = await f(r.url, { headers: { 'X-API-KEY': key, 'User-Agent': UA, Accept: 'application/json' }, signal: ctl && ctl.signal });
    const rl = res.headers && res.headers.get && res.headers.get('x-ratelimit-remaining');
    if (!own && rl !== null && rl !== undefined && isFinite(+rl)) { remaining = +rl; limit = +res.headers.get('x-ratelimit-limit') || limit; plan = res.headers.get('x-plan') || plan; }
    if (res.status === 429 || res.status === 403) { if (hit) return Object.assign({}, hit.d, { _cached: true, _stale: true }); throw bad(res.status === 429 ? 'SportSRC daily limit reached' : 'SportSRC refused the key', 502); }
    if (!res.ok) { if (hit) return Object.assign({}, hit.d, { _cached: true, _stale: true }); throw bad('SportSRC answered HTTP ' + res.status, 502); }
    const d = await res.json();
    if (!d || d.success === false) throw bad((d && d.error) || 'SportSRC gave no data', 502);
    cache.set(ck, { at: now, d }); if (cache.size > 120) cache.delete(cache.keys().next().value);
    return d;
  } catch (e) {
    if (hit) return Object.assign({}, hit.d, { _cached: true, _stale: true });
    if (e.status) throw e;
    throw bad(e && e.name === 'AbortError' ? 'SportSRC took too long to answer' : 'SportSRC could not be reached', 502);
  } finally { clearTimeout(t); }
}
const status = () => ({ remaining, limit, plan, cached: cache.size });
function reset() { cache.clear(); remaining = limit = null; plan = ''; }
module.exports = { call, build, status, reset, BASE };
