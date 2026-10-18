// Movies and TV shows: metadata from Cinemeta (free, key-less catalog). Playback:
//   1) Internet Archive public-domain films (direct MP4, played in our own player)
//   2) Hosted embed players (CineSrc, VidFast, VidCore, Videasy + SimplStream's list, VidLink on request) shown in an iframe
//   3) Optional extras the viewer sets up: Stremio/Nuvio add-ons, a debrid account, a CinePro Core server (all optional; direct streams play in our own player)
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0';
const CINEMETA = 'https://v3-cinemeta.strem.io';

async function jget(url, timeout = 12000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeout);
  try {
    const r = await fetch(url, { signal: ctl.signal, redirect: 'follow', headers: { 'User-Agent': UA, Accept: 'application/json' } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } finally { clearTimeout(t); }
}

function mapMeta(m, type) {
  const year = parseInt(m.year || m.releaseInfo, 10) || null, tv = type === 'series';
  return {
    id: m.imdb_id || m.id, kind: tv ? 'tv' : 'movie', title: m.name, titleRomaji: m.name, synonyms: [],
    cover: m.poster, banner: m.background || null,
    description: m.description || '', year, format: tv ? 'TV Show' : 'Movie', status: null,
    score: m.imdbRating || null, genres: m.genres || [], runtime: m.runtime || null,
    cast: (m.cast || []).slice(0, 6), episodes: null,
  };
}
async function catalog(path, type) {
  type = type || 'movie';
  const d = await jget(`${CINEMETA}/catalog/${type}/${path}.json`);
  return (d.metas || []).filter(m => m.poster).map(m => mapMeta(m, type));
}
// "Popular This Week" = Cinemeta's current popularity list; "New Releases" = this year's titles (last year's early in January)
async function home(type) {
  type = type === 'series' ? 'series' : 'movie';
  const yr = new Date().getUTCFullYear(), tv = type === 'series';
  const shelves = [['Popular This Week', 'top'], ['New Releases', `year/genre=${yr}`], ['Top Rated', 'imdbRating'], ['Action', 'top/genre=Action'], ['Comedy', 'top/genre=Comedy'],
    tv ? ['Crime', 'top/genre=Crime'] : ['Sci-Fi', 'top/genre=Sci-Fi'], tv ? ['Mystery', 'top/genre=Mystery'] : ['Thriller', 'top/genre=Thriller'],
    tv ? ['Animation', 'top/genre=Animation'] : ['Horror', 'top/genre=Horror'], ['Drama', 'top/genre=Drama']];
  const res = await Promise.allSettled(shelves.map(([, p]) => catalog(p, type)));
  let rows = res.map((r, i) => ({ title: shelves[i][0], items: r.status === 'fulfilled' ? r.value.slice(0, 24) : [] }));
  if (!rows[1].items.length) { try { rows[1].items = (await catalog(`year/genre=${yr - 1}`, type)).slice(0, 24); } catch (e) { /* keep empty */ } }
  return { rows: rows.filter(r => r.items.length) };
}
async function search(q, type) { return catalog(`top/search=${encodeURIComponent(q)}`, type === 'series' ? 'series' : 'movie'); }

// TV show: seasons and episodes (Cinemeta), specials (season 0) left out
async function seriesMeta(imdb) {
  const d = await jget(`${CINEMETA}/meta/series/${encodeURIComponent(imdb)}.json`);
  const m = d.meta; if (!m) throw new Error('show not found');
  const eps = (m.videos || []).filter(v => v.season > 0 && v.number > 0)
    .map(v => ({ s: v.season, e: v.number, name: v.name || v.title || '', aired: v.firstAired || v.released || null }))
    .sort((a, b) => a.s - b.s || a.e - b.e);
  const seasons = [];
  eps.forEach(v => { let x = seasons[seasons.length - 1]; if (!x || x.s !== v.s) seasons.push(x = { s: v.s, eps: [] }); x.eps.push({ e: v.e, name: v.name, aired: v.aired }); });
  return { id: imdb, tmdb: m.moviedb_id || null, seasons };
}

// ---- streams ----
const norm = s => (s || '').toLowerCase().replace(/&amp;/g, '&').replace(/[^a-z0-9]+/g, ' ').trim();

// Hosted embed players: VidCore -> https://vidcore.io/movie/{imdbId} (moved from vidcore.org, whose certificate broke), CineSrc by TMDB id
async function tmdbId(imdb, type) {
  const d = await jget(`${CINEMETA}/meta/${type === 'series' ? 'series' : 'movie'}/${encodeURIComponent(imdb)}.json`);
  const id = d.meta && d.meta.moviedb_id;
  if (!id) throw new Error('no TMDB id');
  return id;
}
// `quality` is only understood by CineSrc; both take a resume time (CineSrc `t`, VidCore `startAt`). VidCore auto-selects quality itself.
const EMBEDS = [                               // Auto tries them in this order; all post their playback clock to our page
  { key: 'cinesrc', name: 'CineSrc', url: (id, o) => `https://cinesrc.st/embed/movie/${id}?seek=10&autoplay=true&controls=true&prioritize=true`
      + (o.quality ? `&quality=${encodeURIComponent(o.quality)}` : '') + (o.t > 5 ? `&t=${Math.floor(o.t)}&continueprompt=false` : '') },
  // VidFast: same player API family as VidCore; its player code handles {command:'play'|'pause'|'seek',time}
  { key: 'vidfast', name: 'VidFast', imdb: true, url: (id, o) => `https://vidfast.vc/movie/${id}?autoPlay=true&title=false&poster=false&chromecast=false` + (o.t > 5 ? `&startAt=${Math.floor(o.t)}` : '') },
  { key: 'vidcore', name: 'VidCore', imdb: true, url: (id, o) => `https://vidcore.io/movie/${id}?autoPlay=true&title=false&chromecast=false` + (o.t > 5 ? `&startAt=${Math.floor(o.t)}` : '') },
  { key: 'videasy', name: 'Videasy', url: (id, o) => `https://player.videasy.to/movie/${id}?color=ff3d7f` + (o.t > 5 ? `&progress=${Math.floor(o.t)}` : '') },
  // SimplStream's own server list (github.com/JustANormalChurro/SimplStream, MIT): Auto tries these after ours; "SimplStream" in the Source list puts them first
  { key: 'vidsrc', name: 'VidSrc', group: 'simplstream', url: id => `https://vidsrc.xyz/embed/movie?tmdb=${id}` },
  { key: '111movies', name: '111Movies', group: 'simplstream', url: id => `https://111movies.com/movie/${id}` },
  { key: 'godrive', name: 'GoDrive', group: 'simplstream', imdb: true, url: id => `https://godriveplayer.com/player.php?imdb=${id}` },
  // Optional: never used by Auto (low chance of working on many networks); only when picked as the Source
  { key: 'vidlink', name: 'VidLink', optional: true, url: id => `https://vidlink.pro/movie/${id}` },
];
// The same players' TV-episode pages (season s, episode e)
const TV_EMBEDS = [
  { key: 'cinesrc', name: 'CineSrc', url: (id, o) => `https://cinesrc.st/embed/tv/${id}?s=${o.s}&e=${o.e}&seek=10&autoplay=true&controls=true&prioritize=true`
      + (o.quality ? `&quality=${encodeURIComponent(o.quality)}` : '') + (o.t > 5 ? `&t=${Math.floor(o.t)}&continueprompt=false` : '') },
  { key: 'vidfast', name: 'VidFast', imdb: true, url: (id, o) => `https://vidfast.vc/tv/${id}/${o.s}/${o.e}?autoPlay=true&title=false&poster=false&chromecast=false&nextButton=false&autoNext=false` + (o.t > 5 ? `&startAt=${Math.floor(o.t)}` : '') },
  { key: 'vidcore', name: 'VidCore', imdb: true, url: (id, o) => `https://vidcore.io/tv/${id}/${o.s}/${o.e}?autoPlay=true&title=false&chromecast=false` + (o.t > 5 ? `&startAt=${Math.floor(o.t)}` : '') },
  { key: 'videasy', name: 'Videasy', url: (id, o) => `https://player.videasy.to/tv/${id}/${o.s}/${o.e}?color=ff3d7f` + (o.t > 5 ? `&progress=${Math.floor(o.t)}` : '') },
  { key: 'vidsrc', name: 'VidSrc', group: 'simplstream', url: (id, o) => `https://vidsrc.xyz/embed/tv?tmdb=${id}&season=${o.s}&episode=${o.e}` },
  { key: '111movies', name: '111Movies', group: 'simplstream', url: (id, o) => `https://111movies.com/tv/${id}/${o.s}/${o.e}` },
  { key: 'godrive', name: 'GoDrive', group: 'simplstream', url: (id, o) => `https://godriveplayer.com/player.php?type=series&tmdb=${id}&season=${o.s}&episode=${o.e}` },
  { key: 'vidlink', name: 'VidLink', optional: true, url: (id, o) => `https://vidlink.pro/tv/${id}/${o.s}/${o.e}` },
];

// Internet Archive: public-domain feature films (direct MP4)
async function viaArchive(title, year) {
  const q = `title:("${title.replace(/["()]/g, ' ').trim()}") AND mediatype:movies`;
  const d = await jget(`https://archive.org/advancedsearch.php?q=${encodeURIComponent(q)}&fl%5B%5D=identifier&fl%5B%5D=title&fl%5B%5D=year&fl%5B%5D=downloads&rows=15&sort%5B%5D=downloads+desc&output=json`);
  const docs = (d.response && d.response.docs) || [];
  const want = norm(title);
  const ok = docs.filter(x => norm(x.title) === want && (!year || !x.year || Math.abs(parseInt(x.year, 10) - year) <= 1));
  if (!ok.length) throw new Error('not in the public-domain archive');
  for (const hit of ok.slice(0, 3)) {
    const meta = await jget(`https://archive.org/metadata/${encodeURIComponent(hit.identifier)}`);
    // feature films only: reject trailers/clips (needs a known runtime of 50+ minutes) and require the year to match
    if (!year || !hit.year || Math.abs(parseInt(hit.year, 10) - year) > 1) continue;
    const files = (meta.files || []).filter(f => /\.(mp4|m4v)$/i.test(f.name) && f.source !== 'metadata' && /h\.?264|mpeg4|mp4/i.test(f.format || '') && parseFloat(f.length) >= 3000);
    if (!files.length) continue;
    files.sort((a, b) => (parseInt(b.size, 10) || 0) - (parseInt(a.size, 10) || 0));
    const f = files.find(x => (parseInt(x.size, 10) || 0) < 4e9) || files[0];
    const base = `https://${meta.d1 || meta.server}${meta.dir}`;
    const subs = (meta.files || []).filter(x => /\.(vtt|srt)$/i.test(x.name) && /en|eng/i.test(x.name)).slice(0, 1).map(x => ({ lang: 'English', url: `${base}/${encodeURIComponent(x.name)}` }));
    return { url: `https://archive.org/download/${encodeURIComponent(hit.identifier)}/${encodeURIComponent(f.name)}`, headers: {}, subtitles: subs, mp4: true, quality: 'Public domain', matched: 'archive.org: ' + hit.title, provider: 'archive' };
  }
  throw new Error('no playable file');
}

// Stream add-on (the open Stremio add-on protocol): the user gives the address of an add-on they chose (for example one set up with their own debrid account).
// Its answer is a plain video file or HLS address, which plays in our own player, so it also works on old TV browsers that cannot run the hosted players.
// Only streams that are ready to play over http(s) are used (torrent-only entries are skipped); nothing is decrypted or unlocked here.
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
// All the add-ons the viewer listed, asked at once. A ready-to-play stream wins; torrent-only entries are turned into a direct link by the viewer's debrid account (if they set one).
async function viaAddons(list, q, tv, quality, auth) {
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
  if (direct.length) { const t = rank(direct)[0]; return directOf(t.s, t.r.res, String(t.s.name || 'add-on').replace(/\s+/g, ' ').trim()); }
  if (torrents.length && auth) {
    const debrid = require('./debrid'), ep = tv ? { s: Math.max(1, parseInt(q.s, 10) || 1), e: Math.max(1, parseInt(q.e, 10) || 1) } : null;
    const top = rank(torrents).slice(0, 3);
    const tried = await Promise.allSettled(top.map(t => debrid.resolve(auth, t.s, ep).then(x => x && { x, t })));
    const hit = tried.map(r => r.status === 'fulfilled' && r.value).filter(Boolean)[0];
    const first = tried.find(r => r.status === 'rejected');
    if (hit) return Object.assign(directOf({ url: hit.x.url }, hit.t.r.res, debrid.NAMES[auth.p]), { matched: debrid.NAMES[auth.p] + ': ' + (hit.x.name || 'cached file'), provider: 'debrid', mp4: !/m3u8/i.test(hit.x.url), quality: hit.t.r.res ? hit.t.r.res + 'p' : 'cached' });
    if (first) throw new Error(first.reason.message);
    throw new Error('Your debrid service does not have this title cached');
  }
  if (torrents.length) throw new Error('The add-ons only have torrents for this title — add a debrid service in Settings to play them');
  throw new Error(errs[0] || 'The add-ons have no ready-to-play stream for this title');
}
// CinePro Core (open-source OMSS streaming API, self-hosted by whoever runs it): { sources:[{url,type,quality,provider}], subtitles:[{url,label}] }
async function viaCinepro(raw, q, tv, quality) {
  const base = addonBase(raw);
  if (!base) throw new Error('The CinePro Core address is not valid');
  if (!q.tmdbId) throw new Error('CinePro Core needs a TMDB id this title does not have');
  const path = tv ? `/v1/tv/${q.tmdbId}/seasons/${Math.max(1, parseInt(q.s, 10) || 1)}/episodes/${Math.max(1, parseInt(q.e, 10) || 1)}` : `/v1/movies/${q.tmdbId}`;
  const d = await jget(base + path, 25000);
  const abs = u => { try { return new URL(u, base + '/').href; } catch (e) { return ''; } };
  const list = (d.sources || []).map(x => ({ url: abs(x.url), type: String(x.type || ''), q: parseInt(String(x.quality || '').replace(/\D/g, ''), 10) || 0, who: x.provider && (x.provider.name || x.provider.id) || '' }))
    .filter(x => /^https?:\/\//.test(x.url) && !/dash|mpd/i.test(x.type));
  if (!list.length) throw new Error('CinePro Core found no stream for this title');
  const score = x => (quality ? -Math.abs((x.q || 720) - quality) / 10 : x.q === 1080 ? 30 : x.q === 720 ? 24 : x.q ? 8 : 10) + (/hls|m3u8/i.test(x.type + x.url) || /mp4/i.test(x.type) ? 12 : 0);
  const top = list.sort((a, b) => score(b) - score(a))[0];
  const subs = (d.subtitles || []).filter(x => x && x.url).slice(0, 8).map(x => ({ lang: x.label || x.lang || 'Subtitles', url: abs(x.url) }));
  return { url: top.url, headers: {}, subtitles: subs, mp4: !/hls|m3u8/i.test(top.type + top.url), quality: top.q ? top.q + 'p' : 'auto', matched: 'CinePro Core' + (top.who ? ': ' + top.who : ''), provider: 'cinepro' };
}
// Check an add-on address (the app calls this when the viewer adds one): its name and whether it has streams
async function addonInfo(raw) {
  const base = addonBase(raw);
  if (!base) throw new Error('That address is not valid (use the https:// address of the add-on, ending in manifest.json)');
  const m = await jget(base + '/manifest.json', 12000);
  const res = (m.resources || []).map(r => typeof r === 'string' ? r : r && r.name);
  return { name: String(m.name || 'Add-on').slice(0, 60), version: m.version || '', streams: res.includes('stream'), config: !!(m.behaviorHints && m.behaviorHints.configurationRequired) };
}

// Returns { direct, embeds }. `via`: 'auto' | 'archive' | an embed key (vidcore / cinesrc).
// The chosen embed is moved to the front of `embeds`; with 'auto' a public-domain direct file wins, otherwise CineSrc.
async function sources(q, ctx = {}) {
  const tv = q.type === 'series', year = parseInt(q.year, 10) || null, list = tv ? TV_EMBEDS : EMBEDS;
  let addons = []; try { addons = q.addons ? JSON.parse(q.addons) : q.addon ? [q.addon] : []; } catch (e) { addons = []; }
  addons = (Array.isArray(addons) ? addons : []).map(String).filter(Boolean).slice(0, 8);
  const cinepro = q.cinepro ? String(q.cinepro) : '', haveExtra = addons.length > 0 || !!cinepro;
  let via = String(q.via || 'auto'); if (via === 'addon' && !haveExtra) via = 'auto';
  const imdbOk = /^tt\d+$/.test(q.id || ''), extraOn = imdbOk && haveExtra && (via === 'auto' || via === 'addon');
  const wantEmbed = !extraOn && (tv || list.some(e => e.key === via) || via === 'simplstream');
  const skipped = () => Promise.reject(new Error('skipped'));
  const quality = parseInt(q.quality, 10) || 0;
  const adP = extraOn && addons.length ? viaAddons(addons, q, tv, quality, ctx.debrid || null) : skipped();
  adP.catch(() => {});
  const [tm, ar] = await Promise.allSettled([
    via === 'archive' && !tv ? skipped() : tmdbId(q.id, tv ? 'series' : 'movie'),
    wantEmbed || tv || via === 'addon' ? skipped() : viaArchive(q.title || '', year),
  ]);
  const cpP = extraOn && cinepro && tm.status === 'fulfilled' ? viaCinepro(cinepro, Object.assign({}, q, { tmdbId: tm.value }), tv, quality) : skipped();
  const [ad, cp] = await Promise.allSettled([adP, cpP]);
  const opts = { quality, t: parseFloat(q.t) || 0, s: Math.max(1, parseInt(q.s, 10) || 1), e: Math.max(1, parseInt(q.e, 10) || 1) };
  let embeds = list.filter(e => !e.optional || e.key === via).filter(e => e.imdb ? imdbOk : tm.status === 'fulfilled')
    .map(e => ({ key: e.key, name: e.name, group: e.group || undefined, url: e.url(e.imdb ? q.id : tm.value, opts) }));
  if (wantEmbed) embeds = embeds.slice().sort((a, b) => ((b.key === via || b.group === via) ? 1 : 0) - ((a.key === via || a.group === via) ? 1 : 0));
  const direct = ad.status === 'fulfilled' ? ad.value : cp.status === 'fulfilled' ? cp.value : ar.status === 'fulfilled' ? ar.value : null;
  const addonError = extraOn && !direct ? [ad, cp].filter(r => r.status === 'rejected' && r.reason.message !== 'skipped').map(r => r.reason.message).join(' · ') || null : null;
  if (via === 'addon' && !direct && !embeds.length) { const err = new Error(addonError || 'The add-ons gave no stream'); err.status = 502; throw err; }
  if (via === 'archive' && !direct && !tv) {
    const err = new Error('This movie is not in the public-domain archive. Pick another source.');
    err.status = 502; throw err;
  }
  if (!direct && !embeds.length) {
    const err = new Error('No stream was found for this ' + (tv ? 'episode.' : 'movie.'));
    err.status = 502; err.detail = [tm, ar].map(r => r.reason && r.reason.message).filter(Boolean).join(' | ');
    throw err;
  }
  return { direct, embeds, tmdb: tm.status === 'fulfilled' ? tm.value : null, addonError };
}

module.exports = { home, search, sources, seriesMeta, addonBase, rankStream, addonInfo };
