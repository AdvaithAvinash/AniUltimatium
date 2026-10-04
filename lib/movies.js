// Movies: metadata from Cinemeta (Stremio's free, key-less catalog) and streams from
//   1) Stremio-compatible addons you configure (STREMIO_ADDONS=url1,url2 — direct HTTP streams only, no torrents)
//   2) Internet Archive (public-domain feature films, direct MP4)
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
const qualityRank = t => { const m = String(t || '').match(/(2160|1440|1080|720|480|360)p?/i); return m ? parseInt(m[1], 10) : (/4k/i.test(t) ? 2160 : 0); };

async function viaStremio(imdb) {
  const addons = (process.env.STREMIO_ADDONS || '').split(',').map(s => s.trim().replace(/\/+$/, '').replace(/\/manifest\.json$/, '')).filter(Boolean);
  if (!addons.length) throw new Error('no STREMIO_ADDONS configured');
  const errs = [];
  const runs = addons.map(a => jget(`${a}/stream/movie/${imdb}.json`, 15000).then(d => (d.streams || []).filter(s => s.url && /^https?:/.test(s.url) && !s.infoHash)));
  const all = (await Promise.allSettled(runs)).flatMap((r, i) => { if (r.status === 'rejected') errs.push(r.reason.message); return r.status === 'fulfilled' ? r.value : []; });
  if (!all.length) throw new Error('addons returned no direct streams' + (errs.length ? ' (' + errs[0] + ')' : ''));
  all.sort((a, b) => qualityRank(b.title || b.name) - qualityRank(a.title || a.name));
  const best = all[0], h = best.behaviorHints && best.behaviorHints.proxyHeaders && best.behaviorHints.proxyHeaders.request || {};
  const subs = (best.subtitles || []).filter(s => /^eng?/i.test(s.lang || '') && s.url).slice(0, 1).map(s => ({ lang: 'English', url: s.url }));
  return { url: best.url, headers: h, subtitles: subs, mp4: !/m3u8/i.test(best.url), quality: String(best.title || best.name || '').slice(0, 30), matched: 'stremio' };
}

async function viaArchive(title, year) {
  const q = `title:("${title.replace(/["()]/g, ' ').trim()}") AND mediatype:movies`;
  const d = await jget(`https://archive.org/advancedsearch.php?q=${encodeURIComponent(q)}&fl%5B%5D=identifier&fl%5B%5D=title&fl%5B%5D=year&fl%5B%5D=downloads&rows=15&sort%5B%5D=downloads+desc&output=json`);
  const docs = (d.response && d.response.docs) || [];
  const want = norm(title);
  const ok = docs.filter(x => norm(x.title) === want && (!year || !x.year || Math.abs(parseInt(x.year, 10) - year) <= 1));
  if (!ok.length) throw new Error('not in the public-domain archive');
  for (const hit of ok.slice(0, 3)) {
    const meta = await jget(`https://archive.org/metadata/${encodeURIComponent(hit.identifier)}`);
    const files = (meta.files || []).filter(f => /\.(mp4|m4v)$/i.test(f.name) && f.source !== 'metadata' && /h\.?264|mpeg4|mp4/i.test(f.format || ''));
    if (!files.length) continue;
    files.sort((a, b) => (parseInt(b.size, 10) || 0) - (parseInt(a.size, 10) || 0));
    const f = files.find(x => (parseInt(x.size, 10) || 0) < 4e9) || files[0];
    const base = `https://${meta.d1 || meta.server}${meta.dir}`;
    const subs = (meta.files || []).filter(x => /\.(vtt|srt)$/i.test(x.name) && /en|eng/i.test(x.name)).slice(0, 1).map(x => ({ lang: 'English', url: `${base}/${encodeURIComponent(x.name)}` }));
    return { url: `https://archive.org/download/${encodeURIComponent(hit.identifier)}/${encodeURIComponent(f.name)}`, headers: {}, subtitles: subs, mp4: true, quality: 'Public domain', matched: 'archive.org: ' + hit.title };
  }
  throw new Error('no playable file');
}

async function sources(q) {
  const imdb = q.id, title = q.title || '', year = parseInt(q.year, 10) || null;
  const jobs = [['stremio', () => viaStremio(imdb)], ['archive', () => viaArchive(title, year)]];
  const errs = [];
  for (const [name, job] of jobs) {          // stremio first (better quality), then the public-domain archive
    try { return { ...(await job()), provider: name }; } catch (e) { errs.push(name + ': ' + e.message); }
  }
  const err = new Error('No free stream was found for this movie. Add a Stremio addon (STREMIO_ADDONS) to unlock more titles.');
  err.status = 502; err.detail = errs.join(' | ');
  throw err;
}

module.exports = { home, search, sources };
