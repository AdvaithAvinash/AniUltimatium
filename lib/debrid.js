// Debrid services (Real-Debrid, AllDebrid, Premiumize, TorBox): turn a torrent hash that a Stremio-style add-on listed into a direct HTTPS video link,
// using the viewer's OWN paid account. The API key is sent by the app with each request and is never stored on the server (no KV, no Durable Object).
// Only torrents the service already has cached are used: nothing is queued on the account (an uncached torrent is removed again straight away).
'use strict';
const UA = 'Aniultimatium';
const BASE = {
  rd: () => process.env.DEBRID_BASE_RD || 'https://api.real-debrid.com/rest/1.0',
  ad: () => process.env.DEBRID_BASE_AD || 'https://api.alldebrid.com/v4',
  pm: () => process.env.DEBRID_BASE_PM || 'https://www.premiumize.me/api',
  tb: () => process.env.DEBRID_BASE_TB || 'https://api.torbox.app/v1/api',
};
const NAMES = { rd: 'Real-Debrid', ad: 'AllDebrid', pm: 'Premiumize', tb: 'TorBox' };
const VIDEO = /\.(mkv|mp4|m4v|avi|mov|ts|webm)$/i;

function fail(msg, status) { const e = new Error(msg); e.status = status || 502; return e; }

async function call(url, o = {}) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), o.timeout || 15000);
  try {
    const r = await fetch(url, { method: o.method || 'GET', signal: ctl.signal, redirect: 'follow',
      headers: Object.assign({ 'User-Agent': UA, Accept: 'application/json' }, o.headers || {}), body: o.body });
    const text = await r.text(); let j = null; try { j = text ? JSON.parse(text) : {}; } catch (e) { /* not json */ }
    if (r.status === 401 || r.status === 403) throw fail('The service refused the API key', 401);
    if (!r.ok && !(j && typeof j === 'object' && o.allowError)) throw fail('The service answered HTTP ' + r.status, r.status >= 500 ? 502 : 400);
    return j || {};
  } finally { clearTimeout(t); }
}
const form = obj => new URLSearchParams(obj).toString();
const FORM = { 'Content-Type': 'application/x-www-form-urlencoded' };
const sleep = ms => new Promise(r => setTimeout(r, ms));

// Parses "rd:KEY" (the header the app sends) into { p, k }
function parseAuth(h) {
  const m = /^(rd|ad|pm|tb):(\S{8,200})$/.exec(String(h || '').trim());
  return m ? { p: m[1], k: m[2] } : null;
}

// Is the key good? -> { ok, name, user, premium, expires }
async function check(p, k) {
  if (!BASE[p]) throw fail('Unknown debrid service', 400);
  if (p === 'rd') { const d = await call(BASE.rd() + '/user', { headers: { Authorization: 'Bearer ' + k } }); return { ok: true, name: NAMES.rd, user: d.username, premium: (d.premium || 0) > 0, expires: d.expiration || null }; }
  if (p === 'ad') { const d = await call(BASE.ad() + '/user?agent=' + UA + '&apikey=' + encodeURIComponent(k)); if (d.status !== 'success') throw fail('The service refused the API key', 401); const u = d.data && d.data.user || {}; return { ok: true, name: NAMES.ad, user: u.username, premium: !!u.isPremium, expires: u.premiumUntil ? new Date(u.premiumUntil * 1000).toISOString() : null }; }
  if (p === 'pm') { const d = await call(BASE.pm() + '/account/info?apikey=' + encodeURIComponent(k)); if (d.status !== 'success') throw fail('The service refused the API key', 401); return { ok: true, name: NAMES.pm, user: String(d.customer_id || ''), premium: (d.premium_until || 0) * 1000 > Date.now(), expires: d.premium_until ? new Date(d.premium_until * 1000).toISOString() : null }; }
  const d = await call(BASE.tb() + '/user/me', { headers: { Authorization: 'Bearer ' + k } });
  if (!d.success) throw fail('The service refused the API key', 401);
  const u = d.data || {}; return { ok: true, name: NAMES.tb, user: u.email || '', premium: Number(u.plan) > 0, expires: u.premium_expires_at || null };
}

// Best video among {name,size,id}: the add-on's fileIdx if it gave one, else a series episode match, else the largest video file
function pickFile(files, fileIdx, ep) {
  const vids = files.filter(f => VIDEO.test(f.name));
  if (Number.isInteger(fileIdx) && files[fileIdx] && VIDEO.test(files[fileIdx].name)) return files[fileIdx];
  if (ep && vids.length > 1) {
    const re = new RegExp('s0*' + ep.s + '[ ._-]*e0*' + ep.e + '\\b|\\b' + ep.s + 'x0*' + ep.e + '\\b', 'i');
    const hit = vids.filter(f => re.test(f.name)).sort((a, b) => b.size - a.size)[0];
    if (hit) return hit;
  }
  return vids.sort((a, b) => b.size - a.size)[0] || null;
}

async function viaRD(k, magnet, o) {
  const H = { Authorization: 'Bearer ' + k };
  const add = await call(BASE.rd() + '/torrents/addMagnet', { method: 'POST', headers: Object.assign({}, FORM, H), body: form({ magnet }), allowError: true });
  if (!add.id) throw fail(add.error || 'Real-Debrid did not accept the torrent');
  const id = add.id, clean = () => call(BASE.rd() + '/torrents/delete/' + id, { method: 'DELETE', headers: H, timeout: 8000 }).catch(() => {});
  try {
    let info = null;
    for (let i = 0; i < 6; i++) { info = await call(BASE.rd() + '/torrents/info/' + id, { headers: H }); if (info.status === 'waiting_files_selection' || info.status === 'downloaded') break; await sleep(o.step || 700); }
    if (!info || (info.status !== 'waiting_files_selection' && info.status !== 'downloaded')) { await clean(); return null; }
    if (info.status === 'waiting_files_selection') {
      const files = (info.files || []).map((f, i) => ({ id: f.id, name: f.path || '', size: f.bytes || 0, i }));
      const f = pickFile(files, o.fileIdx, o.ep); if (!f) { await clean(); return null; }
      await call(BASE.rd() + '/torrents/selectFiles/' + id, { method: 'POST', headers: Object.assign({}, FORM, H), body: form({ files: String(f.id) }), allowError: true });
      for (let i = 0; i < 8; i++) { await sleep(o.step || 700); info = await call(BASE.rd() + '/torrents/info/' + id, { headers: H }); if (info.status === 'downloaded') break; }
    }
    if (info.status !== 'downloaded' || !(info.links || []).length) { await clean(); return null; }       // not cached on the service: nothing is queued
    const u = await call(BASE.rd() + '/unrestrict/link', { method: 'POST', headers: Object.assign({}, FORM, H), body: form({ link: info.links[0] }) });
    return u.download ? { url: u.download, name: u.filename || '' } : null;
  } catch (e) { await clean(); throw e; }
}

async function viaAD(k, magnet, o) {
  const q = '&agent=' + UA + '&apikey=' + encodeURIComponent(k);
  const up = await call(BASE.ad() + '/magnet/upload?magnets[]=' + encodeURIComponent(magnet) + q);
  const m0 = up.data && up.data.magnets && up.data.magnets[0];
  if (!m0 || m0.error || !m0.id) throw fail('AllDebrid did not accept the torrent');
  const id = m0.id, clean = () => call(BASE.ad() + '/magnet/delete?id=' + id + q, { timeout: 8000 }).catch(() => {});
  try {
    let st = null;
    for (let i = 0; i < 6; i++) { const d = await call(BASE.ad() + '/magnet/status?id=' + id + q); const m = d.data && d.data.magnets; st = Array.isArray(m) ? m[0] : m; if (st && st.statusCode === 4) break; if (st && st.statusCode > 4) break; await sleep(o.step || 700); }
    if (!st || st.statusCode !== 4) { await clean(); return null; }                                     // not cached
    const files = (st.links || []).map((l, i) => ({ id: i, name: l.filename || '', size: l.size || 0, link: l.link }));
    const f = pickFile(files, o.fileIdx, o.ep); if (!f) return null;
    const u = await call(BASE.ad() + '/link/unlock?link=' + encodeURIComponent(f.link) + q);
    return u.data && u.data.link ? { url: u.data.link, name: f.name } : null;
  } catch (e) { await clean(); throw e; }
}

async function viaPM(k, magnet, o) {
  const d = await call(BASE.pm() + '/transfer/directdl?apikey=' + encodeURIComponent(k), { method: 'POST', headers: FORM, body: form({ src: magnet }), allowError: true });
  if (d.status !== 'success') return null;                                                              // not cached
  const files = (d.content || []).map((c, i) => ({ id: i, name: c.path || '', size: Number(c.size) || 0, link: c.stream_link || c.link }));
  const f = pickFile(files, o.fileIdx, o.ep);
  return f && f.link ? { url: f.link, name: f.name } : null;
}

async function viaTB(k, magnet, o, hash) {
  const H = { Authorization: 'Bearer ' + k };
  const c = await call(BASE.tb() + '/torrents/checkcached?hash=' + hash + '&format=list', { headers: H });
  const cached = Array.isArray(c.data) ? c.data.some(x => String(x).toLowerCase() === hash) : !!(c.data && c.data[hash]);
  if (!cached) return null;
  const fd = new URLSearchParams({ magnet, seed: '3', allow_zip: 'false' });
  const mk = await call(BASE.tb() + '/torrents/createtorrent', { method: 'POST', headers: Object.assign({}, FORM, H), body: fd.toString(), allowError: true });
  const id = mk.data && (mk.data.torrent_id || mk.data.id); if (!id) return null;
  const li = await call(BASE.tb() + '/torrents/mylist?id=' + id, { headers: H });
  const files = ((li.data && li.data.files) || []).map((f, i) => ({ id: f.id, name: f.name || f.short_name || '', size: f.size || 0, i }));
  const f = pickFile(files, o.fileIdx, o.ep); if (!f) return null;
  const dl = await call(BASE.tb() + '/torrents/requestdl?token=' + encodeURIComponent(k) + '&torrent_id=' + id + '&file_id=' + f.id + '&zip_link=false', { headers: H });
  return dl.data && typeof dl.data === 'string' ? { url: dl.data, name: f.name } : null;
}

// Resolve one add-on stream ({ infoHash, fileIdx, sources, title }) -> { url, name } or null when the service does not have it cached
async function resolve(auth, st, ep, opts = {}) {
  const hash = String(st.infoHash || '').toLowerCase();
  if (!/^[0-9a-f]{40}$/.test(hash)) return null;
  const trackers = (st.sources || []).filter(x => /^tracker:/i.test(x)).map(x => '&tr=' + encodeURIComponent(x.slice(8)));
  const magnet = 'magnet:?xt=urn:btih:' + hash + '&dn=' + encodeURIComponent(String(st.title || st.name || 'video').split('\n')[0].slice(0, 120)) + trackers.slice(0, 12).join('');
  const o = { fileIdx: Number.isInteger(st.fileIdx) ? st.fileIdx : undefined, ep, step: opts.step };
  if (auth.p === 'rd') return viaRD(auth.k, magnet, o);
  if (auth.p === 'ad') return viaAD(auth.k, magnet, o);
  if (auth.p === 'pm') return viaPM(auth.k, magnet, o);
  return viaTB(auth.k, magnet, o, hash);
}

module.exports = { parseAuth, check, resolve, pickFile, NAMES };
