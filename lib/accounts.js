// Accounts + cloud sync of continue-watching / My List / history.
// Storage (first that applies):
//   - Upstash Redis REST  (UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN)  -> persistent on Vercel
//   - JSON file in ./data  (local server)                                       -> persistent on your computer
//   - /tmp                 (Vercel without Upstash)                              -> temporary!
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const os = require('os');

const UP_URL = process.env.UPSTASH_REDIS_REST_URL, UP_TOKEN = process.env.UPSTASH_REDIS_REST_TOKEN;
const ON_VERCEL = !!process.env.VERCEL;
const DIR = process.env.DATA_DIR || (ON_VERCEL ? path.join(os.tmpdir(), 'aniultimatium') : path.join(__dirname, '..', 'data'));

async function upstash(cmd) {
  const r = await fetch(UP_URL, { method: 'POST', headers: { Authorization: 'Bearer ' + UP_TOKEN, 'Content-Type': 'application/json' }, body: JSON.stringify(cmd) });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}
const store = {
  persistent: !!UP_URL || !ON_VERCEL,
  async get(key) {
    if (UP_URL) { const v = await upstash(['GET', key]); return v ? JSON.parse(v) : null; }
    try { return JSON.parse(fs.readFileSync(path.join(DIR, encodeURIComponent(key) + '.json'), 'utf8')); } catch (e) { return null; }
  },
  async set(key, val) {
    if (UP_URL) return upstash(['SET', key, JSON.stringify(val)]);
    fs.mkdirSync(DIR, { recursive: true });
    fs.writeFileSync(path.join(DIR, encodeURIComponent(key) + '.json'), JSON.stringify(val));
  },
};

function secret() {
  if (process.env.AUTH_SECRET) return process.env.AUTH_SECRET;
  if (UP_URL) return crypto.createHash('sha256').update('aniultimatium:' + UP_TOKEN).digest('hex');
  const f = path.join(DIR, '_secret');
  try { return fs.readFileSync(f, 'utf8'); } catch (e) {
    const s = crypto.randomBytes(32).toString('hex');
    try { fs.mkdirSync(DIR, { recursive: true }); fs.writeFileSync(f, s); } catch (e2) {}
    return s;
  }
}
const b64 = b => Buffer.from(b).toString('base64url');
function sign(user) {
  const body = b64(JSON.stringify({ u: user, exp: Date.now() + 90 * 864e5 }));
  return body + '.' + crypto.createHmac('sha256', secret()).update(body).digest('base64url');
}
function verify(token) {
  const [body, sig] = String(token || '').split('.');
  if (!body || !sig) return null;
  const good = crypto.createHmac('sha256', secret()).update(body).digest('base64url');
  if (sig.length !== good.length || !crypto.timingSafeEqual(Buffer.from(sig), Buffer.from(good))) return null;
  try { const p = JSON.parse(Buffer.from(body, 'base64url').toString()); return p.exp > Date.now() ? p.u : null; } catch (e) { return null; }
}
const hash = (pw, salt) => new Promise((res, rej) => crypto.scrypt(pw, salt, 32, (e, k) => (e ? rej(e) : res(k.toString('hex')))));
const cleanName = s => String(s || '').trim().toLowerCase();
const fail = (msg, status = 400) => { const e = new Error(msg); e.status = status; return e; };

async function register(b) {
  const u = cleanName(b.username), pw = String(b.password || '');
  if (!/^[a-z0-9_.-]{3,24}$/.test(u)) throw fail('Username must be 3–24 letters, numbers, . _ -');
  if (pw.length < 6) throw fail('Password must be at least 6 characters');
  if (await store.get('user:' + u)) throw fail('That username is taken', 409);
  const salt = crypto.randomBytes(16).toString('hex');
  await store.set('user:' + u, { salt, hash: await hash(pw, salt), created: Date.now() });
  return { token: sign(u), username: u, persistent: store.persistent };
}
async function login(b) {
  const u = cleanName(b.username), rec = await store.get('user:' + u);
  if (!rec || (await hash(String(b.password || ''), rec.salt)) !== rec.hash) throw fail('Wrong username or password', 401);
  return { token: sign(u), username: u, persistent: store.persistent };
}
function auth(token) { const u = verify(token); if (!u) throw fail('Please sign in again', 401); return u; }
async function me(token) { const u = auth(token); return { username: u, persistent: store.persistent }; }
async function syncGet(token) { const u = auth(token); return { data: (await store.get('data:' + u)) || { progress: {}, list: [], history: [], deleted: {} } }; }
async function syncPut(token, data) {
  const u = auth(token);
  const d = data && typeof data === 'object' ? data : {};
  const clean = { progress: d.progress || {}, list: Array.isArray(d.list) ? d.list.slice(0, 500) : [], history: Array.isArray(d.history) ? d.history.slice(0, 300) : [], deleted: d.deleted || {}, ts: Date.now() };
  if (JSON.stringify(clean).length > 900000) throw fail('Data too large', 413);
  await store.set('data:' + u, clean);
  return { ok: true };
}

module.exports = { register, login, me, syncGet, syncPut, store };
