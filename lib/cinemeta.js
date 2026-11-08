// Movie and TV metadata from Cinemeta (Stremio's free, key-less catalog): titles, posters, details, seasons. No streams.
const { jget } = require('./http');
const CINEMETA = 'https://v3-cinemeta.strem.io';

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

module.exports = { home, search, seriesMeta, mapMeta };
