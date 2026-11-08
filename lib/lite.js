// AniUltimatium Lite playback. Lite ships no content source: it only plays what the viewer added themselves
// (their Stremio / Nuvio add-ons, their debrid account, their own P2P streaming server; IPTV and direct streams play on the TV).
// This module deliberately uses lib/addons.js only: no hosted players, no scrapers, no built-in catalogue of streams.
//
// How a stream is found (written for this project; the ideas, not any code, follow what a good Stremio client does):
//   1. every add-on of the viewer is asked at the same time, each with its own time limit; a slow or broken add-on never holds the others back;
//   2. every stream becomes a candidate (add-on, quality, size, seeders, flags); junk (cam / telesync) is dropped; candidates are ranked;
//   3. the best few are checked in parallel (torrents are turned into a link by the viewer's debrid account) and the first one in rank order that works wins;
//   4. if the server cannot check a link (some hosts only answer to the TV's own address) the best one is still handed over, marked "unverified", and the TV tries it;
//   5. the whole ranked list goes back to the TV for the Sources sheet; the viewer can pick any entry, and a stream that fails on the TV is skipped automatically.
const { addonBase, addonStreams, rankStream, directOf, addonSubs } = require('./addons');
const verify = require('./verify');
const crypto = require('crypto');

const ADDON_MS = 11000, TOP_CHECK = 5, CACHE_MS = 90000;
const cache = new Map();                                              // short memory of collected candidates, so choosing from the Sources sheet does not ask every add-on again

function idOf(addon, s) { return crypto.createHash('sha1').update(addon + '|' + (s.infoHash ? s.infoHash + ':' + (s.fileIdx == null ? '' : s.fileIdx) : s.url)).digest('hex').slice(0, 12); }
function sizeOf(t) { const m = /(\d+(?:[.,]\d+)?)\s?(gb|mb)\b/i.exec(t); if (!m) return 0; const n = parseFloat(m[1].replace(',', '.')); return Math.round(n * (/gb/i.test(m[2]) ? 1073741824 : 1048576)); }
function seedsOf(t) { const m = /(?:👤|seeders?[:\s]*|seeds?[:\s]*)\s*(\d+)/i.exec(t); return m ? parseInt(m[1], 10) : 0; }
function clean(s) { return String(s || '').replace(/\s+/g, ' ').trim(); }

function candidate(s, addonUrl, addonName, idx, quality) {
  const t = (s.name || '') + ' ' + (s.title || '') + ' ' + (s.description || '');
  if (/\b(cam|hdcam|telesync|tsrip|hdts)\b/i.test(t) || /\bts\b/i.test(clean(s.name))) return null;
  const direct = /^https?:\/\//i.test(s.url || '') && !(s.behaviorHints && s.behaviorHints.notWebReady && !/\.(m3u8|mp4)(\?|$)/i.test(s.url));
  const torrent = !direct && !!s.infoHash;
  if (!direct && !torrent) return null;                               // external pages and YouTube links cannot play here
  const r = rankStream(s, quality), size = sizeOf(t), seeds = seedsOf(t);
  let sc = r.sc + (direct ? 15 : 0) + Math.min(seeds, 500) / 50 - idx * 0.5;
  if (size > 40 * 1073741824) sc -= 12;
  if (size && size < 150 * 1048576) sc -= 6;
  const tags = []; if (/hdr/i.test(t)) tags.push('HDR'); if (/dolby.?vision|\bdv\b/i.test(t)) tags.push('DV'); if (/remux/i.test(t)) tags.push('Remux'); if (/hevc|x265|h\.?265/i.test(t)) tags.push('HEVC');
  const lines = String(s.title || s.description || '').split('\n').map(clean).filter(Boolean);
  return { id: idOf(addonUrl, s), addon: addonName, addonUrl, idx, kind: direct ? 'direct' : 'torrent', res: r.res, size, seeds, tags, sc,
    label: (lines[0] || clean(s.name) || 'Stream').slice(0, 90), name: clean(s.name).slice(0, 40), s };
}

async function collect(list, names, q, tv, quality) {
  const key = [list.join(','), q.id, tv ? q.s + ':' + q.e : '', quality].join('|'), hit = cache.get(key);
  if (hit && Date.now() - hit.at < CACHE_MS) return hit;
  const timed = u => Promise.race([addonStreams(u, q, tv), new Promise((_, no) => setTimeout(() => no(new Error('answered too slowly')), ADDON_MS))]);
  const got = await Promise.allSettled(list.map(u => timed(u)));
  const cands = [], errs = [], perAddon = [];
  got.forEach((r, i) => {
    const nm = clean(names[i]) || addonBase(list[i]) || 'add-on';
    if (r.status === 'rejected') { errs.push(nm + ': ' + r.reason.message); perAddon.push({ name: nm, n: 0, err: r.reason.message }); return; }
    let n = 0; r.value.forEach(s => { const c = candidate(s, list[i], nm, i, quality); if (c) { cands.push(c); n++; } });
    perAddon.push({ name: nm, n });
  });
  cands.sort((a, b) => b.sc - a.sc);
  const out = { at: Date.now(), cands, errs, perAddon };
  if (cands.length) { cache.set(key, out); if (cache.size > 60) cache.delete(cache.keys().next().value); }
  return out;
}

const summary = c => ({ id: c.id, addon: c.addon, label: c.label, res: c.res, size: c.size, seeds: c.seeds, kind: c.kind, tags: c.tags });
function playable(c, ep, label) {                                     // candidate + resolved link -> what the player gets
  return Object.assign(directOf({ url: c.link, behaviorHints: c.s.behaviorHints, subtitles: c.s.subtitles }, c.res, label || c.addon), { liteId: c.id, matched: c.addon + (c.res ? ' · ' + c.res + 'p' : ''), quality: c.res ? c.res + 'p' : 'auto', mp4: !/m3u8/i.test(c.link) });
}
async function resolveOne(c, ctx, tv, q, p2p) {                       // -> { link, label? } or throws; torrents need the viewer's debrid account
  if (c.kind === 'direct') return { link: c.s.url, resolver: true };
  if (ctx.debrid) {
    const debrid = require('./debrid'), ep = tv ? { s: Math.max(1, parseInt(q.s, 10) || 1), e: Math.max(1, parseInt(q.e, 10) || 1) } : null;
    const x = await debrid.resolve(ctx.debrid, c.s, ep);
    if (x && x.url) return { link: x.url, label: debrid.NAMES[ctx.debrid.p] };
    throw new Error('not cached at ' + debrid.NAMES[ctx.debrid.p]);
  }
  throw new Error('torrent without a debrid account');
}
const soft = (vf, c, link) => vf({ url: link, headers: (c.s.behaviorHints && c.s.behaviorHints.proxyHeaders && c.s.behaviorHints.proxyHeaders.request) || {}, mp4: !/m3u8/i.test(link) }, { timeout: 12000 });

async function sources(q, ctx = {}) {
  let list = []; try { list = q.addons ? JSON.parse(q.addons) : []; } catch (e) { list = []; }
  let names = []; try { names = q.names ? JSON.parse(q.names) : []; } catch (e) { names = []; }
  list = (Array.isArray(list) ? list : []).map(String).filter(Boolean).slice(0, 12);
  if (!/^tt\d+$/.test(q.id || '')) { const e = new Error('Add-ons need an IMDb id this title does not have'); e.status = 400; throw e; }
  if (!list.length) { const e = new Error('No add-ons yet. Add one in Settings → Extra sources → Add-ons (or sign in to Stremio from your phone).'); e.status = 502; throw e; }
  const tv = q.type === 'series', quality = parseInt(q.quality, 10) || 0, p2p = q.p2p === '1' || q.p2p === 1;
  const vf = ctx.verify || ((r, o) => verify.verifyStream(r, o));
  const pick = q.pick && list.includes(String(q.pick)) ? String(q.pick) : '', strict = q.strict === '1' || q.strict === 1;
  const skip = new Set(String(q.skip || '').split(',').filter(Boolean)), only = String(q.only || '');
  const all = await collect(list, names, q, tv, quality);
  const subsP = addonSubs(list, q, tv).catch(() => []);
  const done = async (c, link, label, unverified) => {
    const direct = playable(Object.assign({}, c, { link }), null, label); const subs = await subsP;
    direct.subtitles = (direct.subtitles || []).concat(subs).slice(0, 14);
    return { direct, list: all.cands.map(summary), chosen: summary(c), unverified: !!unverified, perAddon: all.perAddon };
  };
  if (!all.cands.length) {
    const subs = await subsP, e = new Error(all.errs.length ? 'Your add-ons gave no stream (' + all.errs.slice(0, 2).join('; ') + ')' : 'Your add-ons have no stream for this title'); e.status = 502; e.perAddon = all.perAddon; void subs; throw e;
  }
  if (only) {                                                          // the viewer chose this entry on the Sources sheet
    const c = all.cands.find(x => x.id === only);
    if (!c) { const e = new Error('That source is no longer listed. Open the Sources sheet again.'); e.status = 410; throw e; }
    if (c.kind === 'torrent' && !ctx.debrid) {
      if (p2p) return { direct: null, torrents: [{ infoHash: String(c.s.infoHash).toLowerCase(), fileIdx: typeof c.s.fileIdx === 'number' ? c.s.fileIdx : -1, name: c.label.slice(0, 40), q: c.res || '' }], subtitles: await subsP, list: all.cands.map(summary), chosen: summary(c) };
      const e = new Error('This is a torrent. Add a debrid service (Settings → Extra sources → Debrid) or a P2P streaming server to play it.'); e.status = 502; throw e;
    }
    const r = await resolveOne(c, ctx, tv, q, p2p);
    let ok = true; try { await soft(vf, c, r.link); } catch (e) { ok = false; }
    return done(c, r.link, r.label, !ok);
  }
  let pool = all.cands.filter(c => !skip.has(c.id));
  if (pick) { const mine = pool.filter(c => c.addonUrl === pick); if (mine.length || strict) pool = mine; }
  if (!pool.length) { const e = new Error(strict ? 'That add-on has no stream for this title. Open Sources and choose another.' : 'Every listed source was already tried. Open Sources to pick again.'); e.status = 502; e.perAddon = all.perAddon; throw e; }
  // the ones that can be played right now come first: direct links, then torrents a debrid account can turn into one
  const ready = pool.filter(c => c.kind === 'direct' || (c.kind === 'torrent' && ctx.debrid));
  const top = ready.slice(0, TOP_CHECK);
  if (top.length) {
    const tried = await Promise.allSettled(top.map(async c => { const r = await resolveOne(c, ctx, tv, q, p2p); await soft(vf, c, r.link); return { c, r }; }));
    const win = tried.find(x => x.status === 'fulfilled');
    if (win) return done(win.value.c, win.value.r.link, win.value.r.label, false);
    // nothing could be checked from here: hand over the best direct link anyway, the TV can often read what the server cannot
    const first = top.find(c => c.kind === 'direct');
    if (first) return done(first, first.s.url, null, true);
    const why = tried.map(x => x.reason && x.reason.message).filter(Boolean)[0];
    if (!p2p) { const e = new Error(why ? 'Your debrid service could not play these (' + why + ')' : 'No source could be opened'); e.status = 502; throw e; }
  }
  const tor = pool.filter(c => c.kind === 'torrent');
  if (tor.length && p2p) return { direct: null, torrents: tor.slice(0, 4).map(c => ({ infoHash: String(c.s.infoHash).toLowerCase(), fileIdx: typeof c.s.fileIdx === 'number' ? c.s.fileIdx : -1, name: c.label.slice(0, 40), q: c.res || '' })), subtitles: await subsP, list: all.cands.map(summary), chosen: summary(tor[0]) };
  const e = new Error(tor.length ? 'Your add-ons only have torrents for this title. Add a debrid service (Settings → Extra sources → Debrid) or a P2P streaming server.' : 'No playable stream was found'); e.status = 502; e.perAddon = all.perAddon; throw e;
}

module.exports = { sources, candidate, collect, sizeOf, seedsOf };
