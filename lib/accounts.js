// Accounts + cloud sync of continue-watching / My List / history.
// Storage (first that applies):
//   - Upstash Redis REST  (UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN)  -> persistent on Vercel
//   - JSON file in ./data  (local server)                                       -> persistent on your computer
//   - Cloudflare KV        (binding named STORE)                                 -> persistent on Workers
//   - memory / /tmp        (Workers or Vercel without a database)                -> temporary!
const crypto = require('crypto');

const env = k => (typeof process !== 'undefined' && process.env && process.env[k]) || (globalThis.__ENV && typeof globalThis.__ENV[k] === 'string' ? globalThis.__ENV[k] : undefined);
const kv = () => (globalThis.__ENV && globalThis.__ENV.STORE && typeof globalThis.__ENV.STORE.get === 'function' ? globalThis.__ENV.STORE : null);   // Cloudflare KV binding "STORE"
const box = () => (globalThis.__ENV && globalThis.__ENV.PAIR && typeof globalThis.__ENV.PAIR.idFromName === 'function' ? globalThis.__ENV.PAIR : null);   // Durable Object "PAIR" (worker/pairbox.mjs)
async function boxCall(op, key, value, ttl) {
  const ns = box(), stub = ns.get(ns.idFromName('main'));
  const r = await stub.fetch('https://box/', { method: 'POST', body: JSON.stringify({ op, key, value, ttl }) });
  if (!r.ok) throw new Error('storage error ' + r.status);
  return r.json();
}
const ON_VERCEL = !!env('VERCEL');
const ON_WORKER = typeof globalThis.__ENV !== 'undefined';
const mem = new Map();                                                // last-resort store (lives only as long as the instance)

async function upstash(cmd) {
  const r = await fetch(env('UPSTASH_REDIS_REST_URL'), { method: 'POST', headers: { Authorization: 'Bearer ' + env('UPSTASH_REDIS_REST_TOKEN'), 'Content-Type': 'application/json' }, body: JSON.stringify(cmd) });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}
function fsStore() {                                                  // only touched on Node (lazy requires, so Workers bundles never need fs)
  const fs = require('fs'), path = require('path'), os = require('os');
  const dir = env('DATA_DIR') || (ON_VERCEL ? path.join(os.tmpdir(), 'aniultimatium') : path.join(__dirname, '..', 'data'));
  return { fs, path, dir };
}
const store = {
  persistent() { return !!env('UPSTASH_REDIS_REST_URL') || !!box() || !!kv() || (!ON_VERCEL && !ON_WORKER); },
  // set(key, value, ttlMs): ttl is only a hint for short-lived entries (pairing codes); the Durable Object removes them by itself
  async get(key) {
    if (box()) {                                                      // Durable Object first; old KV data is carried over the first time it is read
      let v = await boxCall('get', key);
      if (v == null && kv()) { try { const raw = await kv().get(key); if (raw) { v = JSON.parse(raw); await boxCall('set', key, v); } } catch (e) { /* KV limit or empty: nothing to carry over */ } }
      return v;
    }
    if (env('UPSTASH_REDIS_REST_URL')) { const v = await upstash(['GET', key]); return v ? JSON.parse(v) : null; }
    if (kv()) { const v = await kv().get(key); return v ? JSON.parse(v) : null; }
    if (ON_WORKER) return mem.has(key) ? mem.get(key) : null;
    try { const { fs, path, dir } = fsStore(); return JSON.parse(fs.readFileSync(path.join(dir, encodeURIComponent(key) + '.json'), 'utf8')); } catch (e) { return mem.has(key) ? mem.get(key) : null; }
  },
  async set(key, val, ttl) {
    if (box()) return boxCall('set', key, val, ttl);
    if (env('UPSTASH_REDIS_REST_URL')) return upstash(ttl > 0 ? ['SET', key, JSON.stringify(val), 'PX', String(Math.ceil(ttl))] : ['SET', key, JSON.stringify(val)]);   // short-lived entries expire by themselves
    if (kv()) return kv().put(key, JSON.stringify(val));
    if (ON_WORKER) { mem.set(key, val); return; }
    try { const { fs, path, dir } = fsStore(); fs.mkdirSync(dir, { recursive: true }); fs.writeFileSync(path.join(dir, encodeURIComponent(key) + '.json'), JSON.stringify(val)); }
    catch (e) { mem.set(key, val); }
  },
  // add(key, value) -> true when the key was free and is now set, false when it was taken. One step where the storage allows it (two sign-ups for one name cannot both win).
  async add(key, val) {
    if (box()) return !!(await boxCall('add', key, val));
    if (env('UPSTASH_REDIS_REST_URL')) return (await upstash(['SET', key, JSON.stringify(val), 'NX'])) === 'OK';
    if (kv() || ON_WORKER) { if (await store.get(key)) return false; await store.set(key, val); return true; }
    try {
      const { fs, path, dir } = fsStore(); fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(path.join(dir, encodeURIComponent(key) + '.json'), JSON.stringify(val), { flag: 'wx' }); return true;
    } catch (e) { if (e && e.code === 'EEXIST') return false; if (mem.has(key)) return false; mem.set(key, val); return true; }
  },
};

let secretP = null;
function getSecret() {
  if (!secretP) secretP = (async () => {
    if (env('AUTH_SECRET')) return env('AUTH_SECRET');
    if (env('UPSTASH_REDIS_REST_TOKEN')) return crypto.createHash('sha256').update('aniultimatium:' + env('UPSTASH_REDIS_REST_TOKEN')).digest('hex');
    let s = await store.get('_secret');
    if (!s) { s = crypto.randomBytes(32).toString('hex'); await store.set('_secret', s); }
    return typeof s === 'string' ? s : String(s);
  })();
  return secretP;
}
const b64 = b => Buffer.from(b).toString('base64url');
async function sign(user) {
  const body = b64(JSON.stringify({ u: user, exp: Date.now() + 90 * 864e5 }));
  return body + '.' + crypto.createHmac('sha256', await getSecret()).update(body).digest('base64url');
}
async function verify(token) {
  const [body, sig] = String(token || '').split('.');
  if (!body || !sig) return null;
  const good = crypto.createHmac('sha256', await getSecret()).update(body).digest('base64url');
  if (sig.length !== good.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return null;
  try { const p = JSON.parse(Buffer.from(body, 'base64url').toString()); return p.exp > Date.now() ? p.u : null; } catch (e) { return null; }
}
// PBKDF2 is available (and fast) on Node and on Cloudflare Workers; older local accounts used scrypt and still verify.
const PBKDF2_ROUNDS = 100000;                                         // the most Cloudflare Workers allow; accounts made with the earlier 60,000 are upgraded when they next sign in
const hashPbkdf2 = (pw, salt, rounds) => new Promise((res, rej) => crypto.pbkdf2(pw, salt, rounds || 60000, 32, 'sha256', (e, k) => (e ? rej(e) : res(k.toString('hex')))));
const sameHex = (a, b) => { const x = Buffer.from(String(a)), y = Buffer.from(String(b)); return x.length === y.length && crypto.timingSafeEqual(x, y); };
const hashScrypt = (pw, salt) => new Promise((res, rej) => crypto.scrypt(pw, salt, 32, (e, k) => (e ? rej(e) : res(k.toString('hex')))));
const cleanName = s => String(s || '').trim().toLowerCase();
const fail = (msg, status = 400) => { const e = new Error(msg); e.status = status; return e; };

async function register(b) {
  const u = cleanName(b.username), pw = String(b.password || '');
  if (!/^[a-z0-9_.-]{3,24}$/.test(u)) throw fail('Username must be 3–24 letters, numbers, . _ -');
  if (pw.length < 6) throw fail('Password must be at least 6 characters');
  if (pw.length > 200) throw fail('Password is too long');
  if (await store.get('user:' + u)) throw fail('That username is taken', 409);
  const salt = crypto.randomBytes(16).toString('hex');
  if (!(await store.add('user:' + u, { alg: 'pbkdf2', it: PBKDF2_ROUNDS, salt, hash: await hashPbkdf2(pw, salt, PBKDF2_ROUNDS), created: Date.now() }))) throw fail('That username is taken', 409);
  return { token: await sign(u), username: u, persistent: store.persistent() };
}
async function login(b) {
  const u = cleanName(b.username), pw = String(b.password || '').slice(0, 200), rec = /^[a-z0-9_.-]{3,24}$/.test(u) ? await store.get('user:' + u) : null;
  const got = rec ? await (rec.alg === 'pbkdf2' ? hashPbkdf2(pw, rec.salt, rec.it) : hashScrypt(pw, rec.salt)) : await hashPbkdf2(pw, 'no-such-user', PBKDF2_ROUNDS);   // same work for an unknown name
  if (!rec || !sameHex(got, rec.hash)) throw fail('Wrong username or password', 401);
  if (rec.alg !== 'pbkdf2' || (rec.it || 60000) < PBKDF2_ROUNDS) {          // stronger hashing for accounts made before it was raised
    try { const salt = crypto.randomBytes(16).toString('hex'); await store.set('user:' + u, Object.assign({}, rec, { alg: 'pbkdf2', it: PBKDF2_ROUNDS, salt, hash: await hashPbkdf2(pw, salt, PBKDF2_ROUNDS) })); } catch (e) { /* keep the old record */ }
  }
  return { token: await sign(u), username: u, persistent: store.persistent() };
}
async function auth(token) { const u = await verify(token); if (!u) throw fail('Please sign in again', 401); return u; }
async function me(token) { const u = await auth(token); return { username: u, persistent: store.persistent() }; }
async function syncGet(token) { const u = await auth(token); return { data: (await store.get('data:' + u)) || { progress: {}, list: [], history: [], deleted: {} } }; }
async function syncPut(token, data) {
  const u = await auth(token);
  const d = data && typeof data === 'object' ? data : {};
  const obj = x => (x && typeof x === 'object' && !Array.isArray(x) ? x : {});
  const clean = { progress: obj(d.progress), list: Array.isArray(d.list) ? d.list.slice(0, 500) : [], history: Array.isArray(d.history) ? d.history.slice(0, 300) : [], deleted: obj(d.deleted), ts: Date.now() };
  if (JSON.stringify(clean).length > 900000) throw fail('Data too large', 413);
  await store.set('data:' + u, clean);
  return { ok: true };
}

module.exports = { register, login, me, syncGet, syncPut, store };
