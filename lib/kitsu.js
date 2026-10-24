'use strict';
// Kitsu: a second anime catalogue for search / trending when AniList refuses the server (AniList blocks Cloudflare Workers with HTTP 403).
// Kitsu gives each show's AniList id (its "mappings"), so results work everywhere else in the app (details, sources, lists). Shows without an AniList id are left out.
const BASE = () => process.env.KITSU_BASE || 'https://kitsu.io/api/edge';
const FIELDS = 'fields[anime]=canonicalTitle,titles,synopsis,posterImage,coverImage,episodeCount,averageRating,startDate,subtype,status,mappings,categories'
  + '&fields[mappings]=externalSite,externalId&fields[categories]=title&include=mappings,categories';
const STATUS = { current: 'RELEASING', finished: 'FINISHED', upcoming: 'NOT_YET_RELEASED', tba: 'NOT_YET_RELEASED', unreleased: 'NOT_YET_RELEASED' };

async function get(path) {
  const ctl = new AbortController(), t = setTimeout(() => ctl.abort(), 12000);
  try {
    const r = await fetch(BASE() + path, { signal: ctl.signal, headers: { Accept: 'application/vnd.api+json', 'User-Agent': 'Aniultimatium' } });
    if (!r.ok) throw new Error('Kitsu HTTP ' + r.status);
    return await r.json();
  } finally { clearTimeout(t); }
}
// Kitsu JSON:API answer -> the app's anime cards (same shape as api/index.js mapMedia)
function mapAll(d) {
  const inc = new Map((d.included || []).map(x => [x.type + ':' + x.id, x]));
  const rel = (a, k) => ((a.relationships && a.relationships[k] && a.relationships[k].data) || []).map(x => inc.get(x.type + ':' + x.id)).filter(Boolean);
  return (d.data || []).map(a => {
    const at = a.attributes || {}, maps = rel(a, 'mappings').map(m => m.attributes || {});
    const al = maps.find(m => m.externalSite === 'anilist/anime'), mal = maps.find(m => m.externalSite === 'myanimelist/anime');
    if (!al || !/^\d+$/.test(String(al.externalId))) return null;
    const t = at.titles || {}, p = at.posterImage || {}, c = at.coverImage || {};
    return {
      id: +al.externalId, mal: mal && /^\d+$/.test(String(mal.externalId)) ? +mal.externalId : null, kind: 'anime',
      title: t.en || t.en_us || at.canonicalTitle || t.en_jp || '', titleRomaji: t.en_jp || at.canonicalTitle || '',
      cover: p.large || p.original || p.medium || null, coverSm: p.medium || p.small || p.large || null, banner: c.large || c.original || null, color: null,
      description: String(at.synopsis || '').trim(), episodes: at.episodeCount || null, format: at.subtype ? String(at.subtype).toUpperCase() : null,
      year: at.startDate ? +String(at.startDate).slice(0, 4) || null : null, status: STATUS[at.status] || null,
      genres: rel(a, 'categories').map(x => x.attributes && x.attributes.title).filter(Boolean).slice(0, 5), synonyms: [],
      score: at.averageRating ? (parseFloat(at.averageRating) / 10).toFixed(1) : null, next: null,
    };
  }).filter(Boolean);
}
async function search(q, genre) {
  const f = [];
  if (q) f.push('filter[text]=' + encodeURIComponent(q));
  if (genre) f.push('filter[categories]=' + encodeURIComponent(String(genre).toLowerCase().replace(/\s+/g, '-')));
  if (!q) f.push('sort=-userCount');
  return mapAll(await get('/anime?' + f.concat(['page[limit]=20', FIELDS]).join('&')));
}
async function trending() { return mapAll(await get('/anime?filter[status]=current&sort=-userCount&page[limit]=20&' + FIELDS)); }   // most-watched shows airing now (Kitsu's own trending list carries no AniList ids)

module.exports = { search, trending, mapAll };
