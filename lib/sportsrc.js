// Live Sports, Option A: find the match's TV channels through the viewer's own Stremio / Nuvio add-ons.
// It reuses lib/addons.js (address check, stream ranking, the direct-stream shape) and lib/verify.js (is the stream readable) and adds only what is new here:
// the Stremio *live TV* part of the add-on protocol (catalogs of type "tv", /catalog/tv/{id}[/search=..].json and /stream/tv/{id}.json) and channel-name matching.
// No stream address is made up: everything returned here was given by one of the viewer's add-ons.
const { addonBase, rankStream, directOf } = require('./addons');
const verify = require('./verify');
const { jget } = require('./http');
const Matchora = require('../public/matchora.js');       // the same channel-name matching the app uses

const ADDON_MS = 9000, MANIFEST_TTL = 10 * 60 * 1000, MAX_JOBS = 8, MAX_PICK = 3, MIN_SCORE = 0.7, TOP_CHECK = 4, BUDGET_MS = 20000;
const manifests = new Map();

const clean = s => String(s || '').replace(/\s+/g, ' ').trim();
const timed = (p, ms) => Promise.race([p, new Promise((_, no) => setTimeout(() => no(new Error('answered too slowly')), ms))]);

async function manifestOf(base) {
  const hit = manifests.get(base);
  if (hit && Date.now() - hit.at < MANIFEST_TTL) return hit.m;
  const m = await jget(base + '/manifest.json', ADDON_MS);
  manifests.set(base, { at: Date.now(), m });
  if (manifests.size > 40) manifests.delete(manifests.keys().next().value);
  return m;
}
const hasSearch = c => (c.extra || []).some(x => x && x.name === 'search') || (c.extraSupported || []).indexOf('search') >= 0;
const needsExtra = c => (c.extra || []).some(x => x && x.isRequired && x.name !== 'search') || (c.extraRequired || []).some(n => n !== 'search');
// The live-TV catalogs of an add-on (type "tv"; some add-ons call it "channel"). Catalogs that need an extra value this app cannot supply are skipped.
function tvCatalogs(m) {
  return (m.catalogs || []).filter(c => c && c.id && (c.type === 'tv' || c.type === 'channel') && !needsExtra(c)).map(c => ({ id: String(c.id), type: c.type, search: hasSearch(c) }));
}
const hasStreamTv = m => (m.resources || []).some(r => (typeof r === 'string' ? r === 'stream' : r && r.name === 'stream' && (!r.types || r.types.indexOf('tv') >= 0 || r.types.indexOf('channel') >= 0)));

function metasOf(d) { return (d && d.metas || []).filter(x => x && x.id && x.name).map(x => ({ id: String(x.id), name: clean(x.name) })); }

// One add-on: which of its channels look like one of the wanted names, and what streams they have.
async function oneAddon(url, name, terms) {
  const base = addonBase(url);
  if (!base) throw new Error('not a valid add-on address');
  const m = await timed(manifestOf(base), ADDON_MS);
  const cats = tvCatalogs(m);
  if (!cats.length) return { name, tv: false, found: [] };
  const found = new Map();                                                           // meta id -> { id, type, name, score, term }
  const note = (type, metas, term) => metas.forEach(x => {
    let best = 0, bt = ''; terms.forEach(t => { const s = Matchora.nameScore(t, x.name); if (s > best) { best = s; bt = t; } });
    if (best >= MIN_SCORE) { const old = found.get(x.id); if (!old || best > old.score) found.set(x.id, { id: x.id, type, name: x.name, score: best, term: bt }); }
  });
  const jobs = [];
  cats.forEach(c => {
    if (c.search) terms.slice(0, 4).forEach(t => jobs.push(() => jget(`${base}/catalog/${c.type}/${encodeURIComponent(c.id)}/search=${encodeURIComponent(t)}.json`, ADDON_MS).then(d => note(c.type, metasOf(d), t))));
    else jobs.push(() => jget(`${base}/catalog/${c.type}/${encodeURIComponent(c.id)}.json`, ADDON_MS).then(d => note(c.type, metasOf(d), '')));   // no search: read the first page and match here
  });
  await Promise.allSettled(jobs.slice(0, MAX_JOBS).map(j => timed(j(), ADDON_MS)));
  const picked = Array.from(found.values()).sort((a, b) => b.score - a.score).slice(0, MAX_PICK);
  const streams = [];
  await Promise.allSettled(picked.map(async ch => {
    const d = await timed(jget(`${base}/stream/${ch.type}/${encodeURIComponent(ch.id).replace(/%3A/g, ':')}.json`, ADDON_MS), ADDON_MS);
    (d.streams || []).forEach(s => { if (s && typeof s === 'object') streams.push({ s, ch }); });
  }));
  return { name, tv: true, streamTv: hasStreamTv(m), found: picked, streams };
}

function cand(addonName, addonUrl, s, ch) {
  if (!/^https?:\/\//i.test(s.url || '')) return null;                                // external pages, YouTube links and torrents are not live channels
  if (s.behaviorHints && s.behaviorHints.notWebReady && !/\.m3u8(\?|$)/i.test(s.url)) return null;
  const r = rankStream(s, 0), hdr = s.behaviorHints && s.behaviorHints.proxyHeaders && s.behaviorHints.proxyHeaders.request || {};
  const label = clean((s.title || s.description || '').split('\n')[0]) || clean(s.name) || ch.name;
  return { channel: ch.name, addon: addonName, label: label.slice(0, 80), res: r.res, url: s.url, headers: hdr, hls: /m3u8/i.test(s.url), exact: ch.score >= 0.95, score: ch.score * 100 + r.sc };
}

// q: { addons: JSON [url], names: JSON [name], terms: JSON [channel names from Matchora] }
async function find(q, ctx = {}) {
  const parse = s => { try { const v = s ? JSON.parse(s) : []; return Array.isArray(v) ? v : []; } catch (e) { return []; } };
  const list = parse(q.addons).map(String).filter(Boolean).slice(0, 12), names = parse(q.names);
  const terms = parse(q.terms).map(clean).filter(Boolean).slice(0, 6);
  if (!list.length) { const e = new Error('No add-ons yet. Add one in Settings → Extra sources → Add-ons (or sign in to Stremio from your phone).'); e.status = 502; throw e; }
  if (!terms.length) { const e = new Error('This match has no channel names to look for.'); e.status = 400; throw e; }
  const vf = ctx.verify || ((r, o) => verify.verifyStream(r, o));
  const got = await timed(Promise.allSettled(list.map((u, i) => oneAddon(u, clean(names[i]) || addonBase(u) || 'add-on', terms).then(r => Object.assign(r, { url: u })))), BUDGET_MS).catch(() => []);
  const perAddon = [], all = [];
  list.forEach((u, i) => {
    const r = got[i];
    if (!r || r.status === 'rejected') { perAddon.push({ name: clean(names[i]) || addonBase(u) || 'add-on', n: 0, err: r && r.reason ? r.reason.message : 'no answer' }); return; }
    const v = r.value, cs = [];
    (v.streams || []).forEach(x => { const c = cand(v.name, u, x.s, x.ch); if (c) cs.push(c); });
    all.push.apply(all, cs);
    perAddon.push({ name: v.name, n: cs.length, tv: v.tv });
  });
  // one entry per stream address and per (channel, add-on): the same channel offered twice by one add-on is shown once
  const seen = new Set(), seenKey = new Set(), uniq = [];
  all.sort((a, b) => b.score - a.score).forEach(c => {
    const k = c.addon + '|' + Matchora.normName(c.channel) + '|' + c.res;
    if (seen.has(c.url) || seenKey.has(k)) return; seen.add(c.url); seenKey.add(k); uniq.push(c);
  });
  const top = uniq.slice(0, TOP_CHECK + 6);
  const checks = await Promise.allSettled(top.slice(0, TOP_CHECK).map(c => vf({ url: c.url, headers: c.headers, mp4: !c.hls }, { timeout: 7000 })));
  top.forEach((c, i) => { c.verified = i < TOP_CHECK ? checks[i].status === 'fulfilled' : false; c.checked = i < TOP_CHECK; });
  top.sort((a, b) => (b.verified - a.verified) || (b.score - a.score));
  const matches = top.map((c, i) => Object.assign({ id: i + 1 }, c));
  return { matches, perAddon, terms, any: matches.length > 0, tvAddons: perAddon.filter(p => p.tv).length };
}
module.exports = { find, tvCatalogs, hasSearch, cand, oneAddon, directOf, verify };
