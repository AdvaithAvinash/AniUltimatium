// Movies: metadata from Cinemeta (free, key-less catalog). Playback:
//   1) Internet Archive public-domain films (direct MP4, played in our own player)
//   2) Hosted embed player (VidCore, by TMDB id) shown in an iframe
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

function mapMeta(m) {
  const year = parseInt(m.year || m.releaseInfo, 10) || null;
  return {
    id: m.imdb_id || m.id, kind: 'movie', title: m.name, titleRomaji: m.name, synonyms: [],
    cover: m.poster, banner: m.background || null,
    description: m.description || '', year, format: 'Movie', status: null,
    score: m.imdbRating || null, genres: m.genres || [], runtime: m.runtime || null,
    cast: (m.cast || []).slice(0, 6), episodes: null,
  };
}
async function catalog(path) {
  const d = await jget(`${CINEMETA}/catalog/movie/${path}.json`);
  return (d.metas || []).filter(m => m.poster).map(mapMeta);
}
async function home() {
  const shelves = [['Popular Movies', 'top'], ['Top Rated', 'imdbRating'], ['Action', 'top/genre=Action'], ['Comedy', 'top/genre=Comedy'],
    ['Sci-Fi', 'top/genre=Sci-Fi'], ['Thriller', 'top/genre=Thriller'], ['Horror', 'top/genre=Horror'], ['Animation', 'top/genre=Animation'], ['Drama', 'top/genre=Drama']];
  const res = await Promise.allSettled(shelves.map(([, p]) => catalog(p)));
  return { rows: res.map((r, i) => ({ title: shelves[i][0], items: r.status === 'fulfilled' ? r.value.slice(0, 24) : [] })).filter(r => r.items.length) };
}
async function search(q) { return catalog(`top/search=${encodeURIComponent(q)}`); }

// ---- streams ----
const norm = s => (s || '').toLowerCase().replace(/&amp;/g, '&').replace(/[^a-z0-9]+/g, ' ').trim();

// Hosted embed players (keyed by TMDB id): VidCore -> https://vidcore.org/embed/movie/{tmdbId}
async function tmdbId(imdb) {
  const d = await jget(`${CINEMETA}/meta/movie/${encodeURIComponent(imdb)}.json`);
  const id = d.meta && d.meta.moviedb_id;
  if (!id) throw new Error('no TMDB id');
  return id;
}
// `quality` and `t` (resume seconds) are only understood by CineSrc (documented URL params); VidCore auto-selects up to 4K itself.
const EMBEDS = [
  { key: 'vidcore', name: 'VidCore', url: id => `https://vidcore.org/embed/movie/${id}` },
  { key: 'cinesrc', name: 'CineSrc', url: (id, o) => `https://cinesrc.st/embed/movie/${id}?seek=10&autoplay=true&controls=true&prioritize=true`
      + (o.quality ? `&quality=${encodeURIComponent(o.quality)}` : '') + (o.t > 5 ? `&t=${Math.floor(o.t)}&continueprompt=false` : '') },
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

// Returns { direct, embeds }. `via`: 'auto' | 'archive' | an embed key (vidcore / cinesrc).
// The chosen embed is moved to the front of `embeds`; with 'auto' a public-domain direct file wins, otherwise VidCore.
async function sources(q) {
  const via = String(q.via || 'auto'), year = parseInt(q.year, 10) || null;
  const wantEmbed = EMBEDS.some(e => e.key === via);
  const [tm, ar] = await Promise.allSettled([
    via === 'archive' ? Promise.reject(new Error('skipped')) : tmdbId(q.id),
    wantEmbed ? Promise.reject(new Error('skipped')) : viaArchive(q.title || '', year),
  ]);
  const opts = { quality: parseInt(q.quality, 10) || 0, t: parseFloat(q.t) || 0 };
  let embeds = tm.status === 'fulfilled' ? EMBEDS.map(e => ({ key: e.key, name: e.name, url: e.url(tm.value, opts) })) : [];
  if (wantEmbed) embeds = embeds.slice().sort((a, b) => (b.key === via) - (a.key === via));
  const direct = ar.status === 'fulfilled' ? ar.value : null;
  if (via === 'archive' && !direct) {
    const err = new Error('This movie is not in the public-domain archive. Pick another source.');
    err.status = 502; throw err;
  }
  if (!direct && !embeds.length) {
    const err = new Error('No stream was found for this movie.');
    err.status = 502; err.detail = [tm, ar].map(r => r.reason && r.reason.message).filter(Boolean).join(' | ');
    throw err;
  }
  return { direct, embeds };
}

module.exports = { home, search, sources };
