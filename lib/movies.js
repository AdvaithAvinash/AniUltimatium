// Movies and TV shows: metadata from Cinemeta (free, key-less catalog). Playback:
//   1) Internet Archive public-domain films (direct MP4, played in our own player)
//   2) Hosted embed players (CineSrc, VidFast, VidCore, Videasy) shown in an iframe
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
];
// The same players' TV-episode pages (season s, episode e)
const TV_EMBEDS = [
  { key: 'cinesrc', name: 'CineSrc', url: (id, o) => `https://cinesrc.st/embed/tv/${id}?s=${o.s}&e=${o.e}&seek=10&autoplay=true&controls=true&prioritize=true`
      + (o.quality ? `&quality=${encodeURIComponent(o.quality)}` : '') + (o.t > 5 ? `&t=${Math.floor(o.t)}&continueprompt=false` : '') },
  { key: 'vidfast', name: 'VidFast', imdb: true, url: (id, o) => `https://vidfast.vc/tv/${id}/${o.s}/${o.e}?autoPlay=true&title=false&poster=false&chromecast=false&nextButton=false&autoNext=false` + (o.t > 5 ? `&startAt=${Math.floor(o.t)}` : '') },
  { key: 'vidcore', name: 'VidCore', imdb: true, url: (id, o) => `https://vidcore.io/tv/${id}/${o.s}/${o.e}?autoPlay=true&title=false&chromecast=false` + (o.t > 5 ? `&startAt=${Math.floor(o.t)}` : '') },
  { key: 'videasy', name: 'Videasy', url: (id, o) => `https://player.videasy.to/tv/${id}/${o.s}/${o.e}?color=ff3d7f` + (o.t > 5 ? `&progress=${Math.floor(o.t)}` : '') },
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
  const t = ((s.name || '') + ' ' + (s.title || '') + ' ' + (s.description || '')).toLowerCase();
  const res = /2160|4k|uhd/.test(t) ? 2160 : /1440/.test(t) ? 1440 : /1080/.test(t) ? 1080 : /720/.test(t) ? 720 : /480/.test(t) ? 480 : 0;
  let sc = 0;
  if (want) sc -= Math.abs((res || 720) - want) / 10; else sc += res === 1080 ? 30 : res === 720 ? 24 : res === 2160 ? 12 : res ? 6 : 10;   // old TVs: 1080p is the safe default
  if (/\.m3u8(\?|$)/i.test(s.url) || /\.mp4(\?|$)/i.test(s.url)) sc += 20;
  if (/\.mkv(\?|$)/i.test(s.url) || /\bmkv\b/.test(t)) sc -= 15;
  if (/hdr|dolby.?vision|\bdv\b|remux|\bcam\b|\bts\b|hdcam/.test(t)) sc -= 25;
  if (/hevc|x265|h\.?265/.test(t)) sc -= 8;
  return { sc, res };
}
async function viaAddon(raw, q, tv, quality) {
  const base = addonBase(raw);
  if (!base) throw new Error('The add-on address is not valid (use the https:// address of its manifest.json)');
  const id = tv ? `${q.id}:${Math.max(1, parseInt(q.s, 10) || 1)}:${Math.max(1, parseInt(q.e, 10) || 1)}` : q.id;
  const d = await jget(`${base}/stream/${tv ? 'series' : 'movie'}/${encodeURIComponent(id).replace(/%3A/g, ':')}.json`, 15000);
  const list = (d.streams || []).filter(s => s && /^https?:\/\//i.test(s.url || '') && !(s.behaviorHints && s.behaviorHints.notWebReady));
  if (!list.length) throw new Error('The add-on has no ready-to-play stream for this title');
  const ranked = list.map(s => ({ s, r: rankStream(s, quality) })).sort((a, b) => b.r.sc - a.r.sc), top = ranked[0].s;
  const hdr = top.behaviorHints && top.behaviorHints.proxyHeaders && top.behaviorHints.proxyHeaders.request || {};
  const subs = (top.subtitles || []).filter(x => x && /^https?:\/\//.test(x.url || '')).slice(0, 8).map(x => ({ lang: x.lang || 'Subtitles', url: x.url }));
  const label = String(top.name || 'add-on').replace(/\s+/g, ' ').trim();
  return { url: top.url, headers: hdr, subtitles: subs, mp4: !/m3u8/i.test(top.url), quality: ranked[0].r.res ? ranked[0].r.res + 'p' : label, matched: 'add-on: ' + label, provider: 'addon' };
}

// Returns { direct, embeds }. `via`: 'auto' | 'archive' | an embed key (vidcore / cinesrc).
// The chosen embed is moved to the front of `embeds`; with 'auto' a public-domain direct file wins, otherwise CineSrc.
async function sources(q) {
  const tv = q.type === 'series', via = String(q.via || 'auto'), year = parseInt(q.year, 10) || null;
  const list = tv ? TV_EMBEDS : EMBEDS;
  const useAddon = !!q.addon && (via === 'auto' || via === 'addon') && /^tt\d+$/.test(q.id || '');
  const wantEmbed = !useAddon && (tv || list.some(e => e.key === via));
  const adP = useAddon ? viaAddon(q.addon, q, tv, parseInt(q.quality, 10) || 0) : Promise.reject(new Error('skipped'));
  adP.catch(() => {});
  const [tm, ar] = await Promise.allSettled([
    via === 'archive' && !tv ? Promise.reject(new Error('skipped')) : tmdbId(q.id, tv ? 'series' : 'movie'),
    wantEmbed || tv || via === 'addon' ? Promise.reject(new Error('skipped')) : viaArchive(q.title || '', year),
  ]);
  const [ad] = await Promise.allSettled([adP]);
  const opts = { quality: parseInt(q.quality, 10) || 0, t: parseFloat(q.t) || 0, s: Math.max(1, parseInt(q.s, 10) || 1), e: Math.max(1, parseInt(q.e, 10) || 1) };
  let embeds = list.filter(e => e.imdb ? /^tt\d+$/.test(q.id || '') : tm.status === 'fulfilled')
    .map(e => ({ key: e.key, name: e.name, url: e.url(e.imdb ? q.id : tm.value, opts) }));
  if (wantEmbed) embeds = embeds.slice().sort((a, b) => (b.key === via) - (a.key === via));
  const direct = ad.status === 'fulfilled' ? ad.value : ar.status === 'fulfilled' ? ar.value : null;
  const addonError = useAddon && ad.status === 'rejected' ? ad.reason.message : null;
  if (via === 'addon' && !direct && !embeds.length) { const err = new Error(addonError || 'The add-on gave no stream'); err.status = 502; throw err; }
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

module.exports = { home, search, sources, seriesMeta, addonBase, rankStream };
