// Stremio / Nuvio add-ons the viewer adds, and their debrid account: streams, subtitles, ranking. No built-in sources.
const verify = require('./verify');
const { jget } = require('./http');

function addonBase(raw) {
  let u = String(raw || '').trim().replace(/^stremio:\/\//i, 'https://').replace(/\/manifest\.json.*$/i, '').replace(/\/+$/, '');
  let h; try { h = new URL(u); } catch (e) { return null; }
  if (!/^https?:$/.test(h.protocol)) return null;
  const host = h.hostname.toLowerCase();
  if (!process.env.ALLOW_PRIVATE_ADDONS && (host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal') || /^(127|10|0)\.|^192\.168\.|^169\.254\.|^172\.(1[6-9]|2\d|3[01])\.|^\[|^::/.test(host))) return null;   // the cloud server only fetches public addresses (ALLOW_PRIVATE_ADDONS=1 for a self-hosted one on your own network)
  return u;
}
function rankStream(s, want) {
  const t = ((s.name || '') + ' ' + (s.title || '') + ' ' + (s.description || '')).toLowerCase(), url = String(s.url || '');
  const res = /2160|4k|uhd/.test(t) ? 2160 : /1440/.test(t) ? 1440 : /1080/.test(t) ? 1080 : /720/.test(t) ? 720 : /480/.test(t) ? 480 : 0;
  let sc = 0;
  if (want) sc -= Math.abs((res || 720) - want) / 10; else sc += res === 1080 ? 30 : res === 720 ? 24 : res === 2160 ? 12 : res ? 6 : 10;   // old TVs: 1080p is the safe default
  if (/\.m3u8(\?|$)/i.test(url) || /\.mp4(\?|$)/i.test(url)) sc += 20;
  if (/\.mkv(\?|$)/i.test(url) || /\bmkv\b/.test(t)) sc -= 15;
  if (/hdr|dolby.?vision|\bdv\b|remux|\bcam\b|\bts\b|hdcam/.test(t)) sc -= 25;
  if (/hevc|x265|h\.?265/.test(t)) sc -= 8;
  return { sc, res };
}
// One Stremio-protocol add-on (Stremio and Nuvio use the same one): its streams for this title
async function addonStreams(raw, q, tv) {
  const base = addonBase(raw);
  if (!base) throw new Error('The add-on address is not valid (use the https:// address of its manifest.json)');
  const id = tv ? `${q.id}:${Math.max(1, parseInt(q.s, 10) || 1)}:${Math.max(1, parseInt(q.e, 10) || 1)}` : q.id;
  const d = await jget(`${base}/stream/${tv ? 'series' : 'movie'}/${encodeURIComponent(id).replace(/%3A/g, ':')}.json`, 15000);
  return (d.streams || []).filter(s => s && typeof s === 'object');
}
function directOf(top, res, label) {
  const hdr = top.behaviorHints && top.behaviorHints.proxyHeaders && top.behaviorHints.proxyHeaders.request || {};
  const subs = (top.subtitles || []).filter(x => x && /^https?:\/\//.test(x.url || '')).slice(0, 8).map(x => ({ lang: x.lang || 'Subtitles', url: x.url }));
  return { url: top.url, headers: hdr, subtitles: subs, mp4: !/m3u8/i.test(top.url), quality: res ? res + 'p' : label, matched: 'add-on: ' + label, provider: 'addon' };
}
// Verification (lib/verify.js): of the candidates, in order of preference, the first one whose stream really reads is used. A stream that cannot be read never reaches the player.
async function firstReadable(cands, vf) {
  const res = await Promise.allSettled(cands.map(c => vf(c, { timeout: 6000 })));
  const i = res.findIndex(x => x.status === 'fulfilled');
  if (i >= 0) return res[i].value;
  const why = res.map(x => x.reason && x.reason.message).filter(Boolean)[0] || 'unreadable';
  throw new Error('The stream could not be read (' + why + ')');
}
// All the add-ons the viewer listed, asked at once. A ready-to-play stream wins; torrent-only entries are turned into a direct link by the viewer's debrid account (if they set one).
async function viaAddons(list, q, tv, quality, auth, vf, p2p) {
  const urls = list.filter(Boolean).slice(0, 8);
  const got = await Promise.allSettled(urls.map(u => addonStreams(u, q, tv)));
  const direct = [], torrents = [], errs = [];
  got.forEach(r => {
    if (r.status === 'rejected') { errs.push(r.reason.message); return; }
    r.value.forEach(s => {
      if (/^https?:\/\//i.test(s.url || '')) { if (!(s.behaviorHints && s.behaviorHints.notWebReady)) direct.push(s); }
      else if (s.infoHash) torrents.push(s);
    });
  });
  const rank = arr => arr.map(s => ({ s, r: rankStream(s, quality) })).sort((a, b) => b.r.sc - a.r.sc);
  if (direct.length) {
    const top = rank(direct).slice(0, 3).map(t => directOf(t.s, t.r.res, String(t.s.name || 'add-on').replace(/\s+/g, ' ').trim()));
    try { return await firstReadable(top, vf); } catch (e) { if (!torrents.length || !auth) throw e; }
  }
  if (torrents.length && auth) {
    const debrid = require('./debrid'), ep = tv ? { s: Math.max(1, parseInt(q.s, 10) || 1), e: Math.max(1, parseInt(q.e, 10) || 1) } : null;
    const top = rank(torrents).slice(0, 3);
    const tried = await Promise.allSettled(top.map(t => debrid.resolve(auth, t.s, ep).then(x => x && { x, t })));
    const hit = tried.map(r => r.status === 'fulfilled' && r.value).filter(Boolean)[0];
    const first = tried.find(r => r.status === 'rejected');
    if (hit) return firstReadable([Object.assign(directOf({ url: hit.x.url }, hit.t.r.res, debrid.NAMES[auth.p]), { matched: debrid.NAMES[auth.p] + ': ' + (hit.x.name || 'cached file'), provider: 'debrid', mp4: !/m3u8/i.test(hit.x.url), quality: hit.t.r.res ? hit.t.r.res + 'p' : 'cached' })], vf);
    if (first) throw new Error(first.reason.message);
    throw new Error('Your debrid service does not have this title cached');
  }
  if (torrents.length && p2p) { const e = new Error('p2p'); e.torrents = rank(torrents).slice(0, 4).map(t => ({ infoHash: String(t.s.infoHash).toLowerCase(), fileIdx: typeof t.s.fileIdx === 'number' ? t.s.fileIdx : -1, name: String(t.s.name || '').replace(/\s+/g, ' ').trim().slice(0, 40), q: t.r.res || '' })); throw e; }
  if (torrents.length) throw new Error('The add-ons only have torrents for this title — add a debrid service in Settings to play them');
  throw new Error(errs[0] || 'The add-ons have no ready-to-play stream for this title');
}
// Subtitles from subtitle add-ons (OpenSubtitles v3, SubMaker, …): every add-on is asked; ones without subtitles simply fail fast
async function addonSubs(list, q, tv) {
  const id = tv ? `${q.id}:${Math.max(1, parseInt(q.s, 10) || 1)}:${Math.max(1, parseInt(q.e, 10) || 1)}` : q.id;
  const got = await Promise.allSettled(list.slice(0, 12).map(u => { const b = addonBase(u); return b ? jget(`${b}/subtitles/${tv ? 'series' : 'movie'}/${encodeURIComponent(id).replace(/%3A/g, ':')}.json`, 6000) : Promise.reject(new Error('bad')); }));
  const out = [], seen = {};
  got.forEach(r => { if (r.status !== 'fulfilled' || !r.value) return; (r.value.subtitles || []).forEach(x => { if (x && /^https?:\/\//.test(x.url || '') && !seen[x.url]) { seen[x.url] = 1; out.push({ lang: String(x.lang || 'Subtitles'), url: x.url }); } }); });
  const en = out.filter(x => /^(en|eng)/i.test(x.lang)), rest = out.filter(x => !/^(en|eng)/i.test(x.lang));
  return en.slice(0, 6).concat(rest.slice(0, 6));
}
// Check an add-on address (the app calls this when the viewer adds one): its name and whether it has streams
async function addonInfo(raw) {
  const base = addonBase(raw);
  if (!base) throw new Error('That address is not valid (use the https:// address of the add-on, ending in manifest.json)');
  const m = await jget(base + '/manifest.json', 12000);
  const res = (m.resources || []).map(r => typeof r === 'string' ? r : r && r.name);
  return { name: String(m.name || 'Add-on').slice(0, 60), version: m.version || '', streams: res.includes('stream'), config: !!(m.behaviorHints && m.behaviorHints.configurationRequired) };
}

module.exports = { addonBase, rankStream, addonStreams, directOf, firstReadable, viaAddons, addonSubs, addonInfo, verify };
