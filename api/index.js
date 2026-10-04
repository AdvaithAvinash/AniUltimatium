// Vercel Serverless Function: /api
//   ?action=home                                -> { rows:[{title,items}] } (hero + shelves)
//   ?action=trending
//   ?action=search&q=naruto[&genre=Action]
//   ?action=sources&title=...&alt=...&ep=1     -> { url, type, subtitles:[{lang,url}] }
//   ?action=proxy&url=...&ref=...               -> CORS/Referer-safe relay (m3u8 rewritten)
//
//   ?action=debug&title=...&ep=1                -> per-provider status/timing (use this to diagnose 502s)
//
// Metadata: AniList GraphQL (English titles).
// Streams: scrapers bundled with the function and raced in parallel (first success wins):
//   `aniwatch` (HiAnime), @consumet/extensions AnimePahe / AnimeKai / HiAnime.
// Optional env vars: ANIWATCH_URLS, CONSUMET_URLS (extra remote instances), ANIWATCH_DOMAIN.

// Scraper libraries sometimes reject after the race is already won; never let that crash the function.
process.on('unhandledRejection', e => console.error('unhandledRejection:', e && e.message));
process.on('uncaughtException', e => console.error('uncaughtException:', e && e.message));

const ANILIST = 'https://graphql.anilist.co';
// Optional extra remote instances (comma separated base URLs). Empty by default: the scrapers
// below run inside this function, so no third-party host has to be alive.
const ANIWATCH = (process.env.ANIWATCH_URLS || '').split(',').map(s => s.trim().replace(/\/+$/, '')).filter(Boolean);
const CONSUMET = (process.env.CONSUMET_URLS || '').split(',').map(s => s.trim().replace(/\/+$/, '')).filter(Boolean);
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0';

const MEDIA_FIELDS = `id title{romaji english native} coverImage{extraLarge large color} bannerImage description(asHtml:false)
  episodes nextAiringEpisode{episode} format seasonYear averageScore status genres`;
const FRAG = `fragment F on Media{${MEDIA_FIELDS}}`;

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', '*');
}
function send(res, code, body, cache) {
  cors(res);
  res.setHeader('Cache-Control', cache || 's-maxage=300, stale-while-revalidate=600');
  res.status(code).json(body);
}

async function fetchJson(url, opts = {}, timeout = 9000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeout);
  try {
    const r = await fetch(url, { ...opts, signal: ctl.signal, headers: { 'User-Agent': UA, ...(opts.headers || {}) } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally { clearTimeout(t); }
}

// ---------- AniList ----------
async function anilist(query, variables) {
  const d = await fetchJson(ANILIST, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify({ query, variables }),
  });
  if (d.errors) throw new Error(d.errors[0].message);
  return d.data;
}
function mapMedia(m) {
  return {
    id: m.id,
    title: m.title.english || m.title.romaji,          // strictly English-first
    titleRomaji: m.title.romaji,
    cover: m.coverImage.extraLarge || m.coverImage.large,
    banner: m.bannerImage || null,
    color: m.coverImage.color || null,
    description: (m.description || '').replace(/<[^>]+>/g, '').trim(),
    episodes: m.episodes || (m.nextAiringEpisode ? m.nextAiringEpisode.episode - 1 : null),
    format: m.format,
    year: m.seasonYear,
    status: m.status,
    genres: m.genres || [],
    score: m.averageScore ? (m.averageScore / 10).toFixed(1) : null,
  };
}
async function trending() {
  const d = await anilist(`query{Page(perPage:30){media(type:ANIME,sort:TRENDING_DESC,isAdult:false){${MEDIA_FIELDS}}}}`, {});
  return d.Page.media.map(mapMedia);
}
async function search(q, genre) {
  const d = await anilist(
    `query($s:String,$g:String,$sort:[MediaSort]){Page(perPage:30){media(type:ANIME,search:$s,genre:$g,sort:$sort,isAdult:false){${MEDIA_FIELDS}}}}`,
    { s: q || undefined, g: genre || undefined, sort: [q ? 'SEARCH_MATCH' : 'POPULARITY_DESC'] });
  return d.Page.media.map(mapMedia);
}
function currentSeason() {
  const m = new Date().getUTCMonth();
  return ['WINTER', 'SPRING', 'SUMMER', 'FALL'][Math.floor(m / 3)];
}
async function home() {
  const shelf = (alias, args) => `${alias}:Page(perPage:20){media(type:ANIME,isAdult:false,${args}){...F}}`;
  const q = `query($season:MediaSeason,$year:Int){
    ${shelf('trending', 'sort:TRENDING_DESC')}
    ${shelf('season', 'season:$season,seasonYear:$year,sort:POPULARITY_DESC')}
    ${shelf('top', 'sort:SCORE_DESC')}
    ${shelf('action', 'genre:"Action",sort:POPULARITY_DESC')}
    ${shelf('romance', 'genre:"Romance",sort:POPULARITY_DESC')}
    ${shelf('comedy', 'genre:"Comedy",sort:POPULARITY_DESC')}
    ${shelf('fantasy', 'genre:"Fantasy",sort:POPULARITY_DESC')}
  } ${FRAG}`;
  let d;
  try {
    d = await anilist(q, { season: currentSeason(), year: new Date().getUTCFullYear() });
  } catch (e) {
    console.error('home query failed, falling back to trending:', e.message);
    return { rows: [{ title: 'Trending Now', items: await trending() }] };
  }
  const titles = [
    ['trending', 'Trending Now'], ['season', 'Popular This Season'], ['top', 'Top Rated'],
    ['action', 'Action'], ['romance', 'Romance'], ['comedy', 'Comedy'], ['fantasy', 'Fantasy'],
  ];
  return { rows: titles.map(([k, title]) => ({ title, items: ((d[k] && d[k].media) || []).map(mapMedia) })).filter(r => r.items.length) };
}

// ---------- Stream providers ----------
const norm = s => (s || '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
function bestMatch(list, titles, getName) {
  const wants = titles.map(norm).filter(Boolean);
  let best = null, score = -1;
  for (const item of list) {
    const n = norm(getName(item));
    let s = 0;
    for (const w of wants) {
      if (n === w) s = Math.max(s, 100);
      else if (n.includes(w) || w.includes(n)) s = Math.max(s, 60);
      else {
        const a = new Set(n.split(' ')), b = w.split(' ');
        s = Math.max(s, 40 * b.filter(x => a.has(x)).length / Math.max(b.length, 1));
      }
    }
    if (s > score) { score = s; best = item; }
  }
  return best;
}
function pickSubtitles(tracks, base) {
  return (tracks || [])
    .filter(t => t && (t.url || t.file) && (!t.kind || t.kind === 'captions' || t.kind === 'subtitles') && /english|^en\b/i.test(t.lang || t.label || ''))
    .map(t => ({ lang: 'English', url: t.url || t.file, default: !!t.default }));
}


// Mirror domains change constantly; every scraper is tried against a list (override via env, comma separated).
const list = (env, def) => (process.env[env] || def).split(',').map(x => x.trim().replace(/^https?:\/\//, '').replace(/\/+$/, '')).filter(Boolean);
const HIANIME_DOMAINS = list('HIANIME_DOMAINS', 'hianime.to,hianimez.to,hianime.sx,hianime.is,hianime.nz,aniwatchtv.to');
const PAHE_DOMAINS = list('PAHE_DOMAINS', 'animepahe.ru,animepahe.org,animepahe.pw,animepahe.com,animepahe.si');
const KAI_DOMAINS = list('KAI_DOMAINS', 'anikai.to,animekai.to,animekai.bz,animekai.ac');
async function firstDomain(domains, fn) {
  const errs = [];
  for (const d of domains) {
    try { return await fn(d); } catch (e) { errs.push(d + ': ' + clean(e.message)); }
  }
  throw new Error(errs.join(' ; '));
}
// keep error text short and URL-free (it is shown on the TV screen)
const clean = (m, n = 90) => String(m || '').replace(/https?:\/\/\S+/g, '').replace(/\s+/g, ' ').trim().slice(0, n);
const withTimeout = (p, ms, label) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error(label + ' timed out')), ms))]);
const nameOf = r => {
  const t = r.title || r.name;
  return typeof t === 'string' ? t : t ? [t.english, t.romaji, t.userPreferred, t.native].filter(Boolean).join(' ') : '';
};
function findHit(results, titles) {
  const list = (results || []).filter(r => !/\bdub\b/i.test(nameOf(r)));
  return bestMatch(list, titles, nameOf);
}
function qualityOf(v) { return parseInt(String(v.quality || '').replace(/\D/g, ''), 10) || 0; }
function pickSource(sources) {
  const list = (sources || []).filter(s => s && s.url);
  const hls = list.filter(s => s.isM3U8 || /\.m3u8/i.test(s.url));
  const pool = hls.length ? hls : list;
  return pool.slice().sort((a, b) => qualityOf(b) - qualityOf(a))[0];
}
function result(d) {
  const pick = pickSource(d.sources);
  if (!pick) throw new Error('no sources');
  return { url: pick.url, headers: d.headers || {}, subtitles: pickSubtitles(d.subtitles || d.tracks) };
}

// 1) HiAnime scraped in-process via the `aniwatch` package (English sub, softsubs).
//    The package fixes its domain at import time, so each mirror gets its own module instance.
const awMods = {};
async function awFor(domain) {
  if (!awMods[domain]) {
    process.env.ANIWATCH_DOMAIN = domain;
    const file = require('path').join(__dirname, '..', 'node_modules', 'aniwatch', 'dist', 'index.js');
    awMods[domain] = (await import(require('url').pathToFileURL(file).href + '?d=' + domain)).HiAnime;
  }
  return awMods[domain];
}
async function viaAniwatchLib(titles, ep) {
  return firstDomain(HIANIME_DOMAINS, async domain => {
    const HiAnime = await awFor(domain);
    const hi = new HiAnime.Scraper();
    let hit = null;
    for (const t of titles) {
      const s = await hi.search(t);
      hit = bestMatch(s.animes || [], titles, a => a.name);
      if (hit) break;
    }
    if (!hit) throw new Error('no match');
    const eps = await hi.getEpisodes(hit.id);
    const episode = (eps.episodes || []).find(x => x.number === ep);
    if (!episode || !episode.episodeId) throw new Error('episode not found');
    let last;
    for (const server of ['hd-1', 'hd-2', 'megacloud']) {
      try { return result(await hi.getEpisodeSources(episode.episodeId, server, 'sub')); } catch (e) { last = e; }
    }
    throw last || new Error('no server worked');
  });
}

// 2-4) @consumet/extensions scrapers (AnimePahe, AnimeKai, HiAnime) — all English-subbed
function viaConsumetLib(name, titles, ep) {
  const domains = { AnimePahe: PAHE_DOMAINS, AnimeKai: KAI_DOMAINS, Hianime: HIANIME_DOMAINS }[name];
  return firstDomain(domains, d => consumetOnce(name, d, titles, ep));
}
async function consumetOnce(name, domain, titles, ep) {
  const { ANIME, SubOrSub } = require('@consumet/extensions');
  const p = new ANIME[name]();
  p.baseUrl = 'https://' + domain;
  let hit = null;
  for (const t of titles) {
    const r = await p.search(t);
    hit = findHit(r.results, titles);
    if (hit) break;
  }
  if (!hit) throw new Error('no match');
  const info = await p.fetchAnimeInfo(hit.id);
  const episode = (info.episodes || []).find(x => Number(x.number) === ep);
  if (!episode) throw new Error('episode not found');
  const d = name === 'AnimePahe'
    ? await p.fetchEpisodeSources(episode.id)
    : await p.fetchEpisodeSources(episode.id, undefined, SubOrSub.SUB);
  return result(d);
}


// 5) AllAnime (the API ani-cli uses): plain JSON, no HTML scraping, English-subbed ("sub")
const AA_API = 'https://api.allanime.day/api';
const AA_REFR = 'https://allmanga.to';
const AA_BASE = 'https://allanime.day';
async function aaQuery(query, variables) {
  const u = `${AA_API}?variables=${encodeURIComponent(JSON.stringify(variables))}&query=${encodeURIComponent(query)}`;
  const d = await fetchJson(u, { headers: { Referer: AA_REFR, Origin: AA_REFR } }, 12000);
  if (d.errors && !d.data) throw new Error(d.errors[0].message);
  let data = d.data;
  if (data && data.tobeparsed) data = aaDecrypt(data.tobeparsed);
  return data;
}
// Newer API responses wrap the payload in AES-256-CTR ("tobeparsed"); same scheme ani-cli uses.
function aaDecrypt(blob) {
  const crypto = require('crypto');
  const buf = Buffer.from(blob, 'base64');
  const key = crypto.createHash('sha256').update('Xot36i3lK3:v1').digest();
  const iv = Buffer.concat([buf.subarray(1, 13), Buffer.from([0, 0, 0, 2])]);
  const dec = crypto.createDecipheriv('aes-256-ctr', key, iv);
  const plain = Buffer.concat([dec.update(buf.subarray(13, buf.length - 16)), dec.final()]).toString('utf8');
  const j = JSON.parse(plain);
  return j.data || j;
}
function aaDecodeUrl(u) {
  if (!u.startsWith('--')) return u;
  let out = '';
  for (let i = 2; i + 1 < u.length; i += 2) out += String.fromCharCode(parseInt(u.substr(i, 2), 16) ^ 56);
  return out;
}
async function viaAllAnime(titles, ep) {
  const SEARCH = 'query($search:SearchInput,$limit:Int,$page:Int,$translationType:VaildTranslationTypeEnumType,$countryOrigin:VaildCountryOriginEnumType){shows(search:$search,limit:$limit,page:$page,translationType:$translationType,countryOrigin:$countryOrigin){edges{_id name englishName availableEpisodes}}}';
  let hit = null;
  for (const t of titles) {
    const d = await aaQuery(SEARCH, { search: { allowAdult: false, allowUnknown: false, query: t }, limit: 20, page: 1, translationType: 'sub', countryOrigin: 'ALL' });
    const edges = ((d.shows && d.shows.edges) || []).filter(e => e.availableEpisodes && e.availableEpisodes.sub >= ep);
    hit = bestMatch(edges, titles, e => [e.englishName, e.name].filter(Boolean).join(' '));
    if (hit) break;
  }
  if (!hit) throw new Error('no match');
  const EP = 'query($showId:String!,$translationType:VaildTranslationTypeEnumType!,$episodeString:String!){episode(showId:$showId,translationType:$translationType,episodeString:$episodeString){episodeString sourceUrls}}';
  const d = await aaQuery(EP, { showId: hit._id, translationType: 'sub', episodeString: String(ep) });
  const urls = ((d.episode && d.episode.sourceUrls) || [])
    .map(s => ({ name: s.sourceName, prio: s.priority || 0, url: aaDecodeUrl(s.sourceUrl || '') }))
    .filter(s => s.url.startsWith('/')).sort((a, b) => b.prio - a.prio);
  if (!urls.length) throw new Error('no usable sources');
  let last;
  for (const s of urls) {
    try {
      const j = await fetchJson(AA_BASE + s.url.replace('clock?', 'clock.json?'), { headers: { Referer: AA_REFR } }, 10000);
      const links = (j.links || []).filter(l => l && l.link);
      if (!links.length) continue;
      const best = links.find(l => l.hls || /m3u8/.test(l.link)) || links[0];
      const subs = (best.subtitles || []).map(t => ({ url: t.src || t.url, lang: t.lang || t.label || '' }));
      return result({
        sources: [{ url: best.link, isM3U8: !!best.hls || /m3u8/.test(best.link) }],
        headers: Object.assign({ Referer: AA_REFR }, best.headers || {}),
        subtitles: subs,
      });
    } catch (e) { last = e; }
  }
  throw last || new Error('no playable link');
}

// Optional remote instances (only used if ANIWATCH_URLS / CONSUMET_URLS are set)
async function viaAniwatchRemote(base, titles, ep) {
  let hit = null;
  for (const t of titles) {
    const s = await fetchJson(`${base}/api/v2/hianime/search?q=${encodeURIComponent(t)}`);
    hit = bestMatch((s.data && s.data.animes) || [], titles, a => a.name);
    if (hit) break;
  }
  if (!hit) throw new Error('no match');
  const e = await fetchJson(`${base}/api/v2/hianime/anime/${encodeURIComponent(hit.id)}/episodes`);
  const episode = ((e.data && e.data.episodes) || []).find(x => x.number === ep);
  if (!episode) throw new Error('episode not found');
  const src = await fetchJson(`${base}/api/v2/hianime/episode/sources?animeEpisodeId=${encodeURIComponent(episode.episodeId)}&category=sub`);
  return result({ sources: src.data.sources, headers: src.data.headers, subtitles: src.data.subtitles || src.data.tracks });
}
async function viaConsumetRemote(base, titles, ep) {
  const s = await fetchJson(`${base}/anime/animepahe/${encodeURIComponent(titles[0])}`);
  const hit = findHit(s.results, titles);
  if (!hit) throw new Error('no match');
  const info = await fetchJson(`${base}/anime/animepahe/info/${encodeURIComponent(hit.id)}`);
  const episode = (info.episodes || []).find(x => Number(x.number) === ep);
  if (!episode) throw new Error('episode not found');
  return result(await fetchJson(`${base}/anime/animepahe/watch?episodeId=${encodeURIComponent(episode.id)}`));
}

function providerJobs(titles, ep) {
  const T = 25000;
  return [
    ['allanime', () => withTimeout(viaAllAnime(titles, ep), T, 'allanime')],
    ['aniwatch', () => withTimeout(viaAniwatchLib(titles, ep), T, 'aniwatch')],
    ['animepahe', () => withTimeout(viaConsumetLib('AnimePahe', titles, ep), T, 'animepahe')],
    ['animekai', () => withTimeout(viaConsumetLib('AnimeKai', titles, ep), T, 'animekai')],
    ['hianime', () => withTimeout(viaConsumetLib('Hianime', titles, ep), T, 'hianime')],
    ...ANIWATCH.map((b, i) => ['aniwatch-remote' + i, () => viaAniwatchRemote(b, titles, ep)]),
    ...CONSUMET.map((b, i) => ['consumet-remote' + i, () => viaConsumetRemote(b, titles, ep)]),
  ];
}
function parseQuery(q) {
  const titles = [q.title, q.alt].filter(Boolean);
  if (!titles.length) { const e = new Error('title required'); e.status = 400; throw e; }
  return { titles, ep: parseInt(q.ep, 10) || 1 };
}

async function sources(req, q, origin) {
  const { titles, ep } = parseQuery(q);
  const jobs = providerJobs(titles, ep).map(([name, job]) => job().then(r => ({ ...r, provider: name }), e => { throw new Error(name + ': ' + clean(e.message, 260)); }));
  try {
    // Race every provider; first one that yields a stream wins
    const r = await Promise.any(jobs);
    const ref = (r.headers && (r.headers.Referer || r.headers.referer)) || '';
    const isHls = /m3u8/i.test(r.url);
    // Route through our proxy when the CDN demands a Referer (TV browsers can't set it)
    const url = ref ? `${origin}/api?action=proxy&ref=${encodeURIComponent(ref)}&url=${encodeURIComponent(r.url)}` : r.url;
    // Subtitle files are relayed too so the app can fetch them cross-origin (CORS *)
    const subtitles = (r.subtitles || []).map(t => ({ ...t, url: `${origin}/api?action=proxy&url=${encodeURIComponent(t.url)}` }));
    return { url, type: isHls ? 'hls' : 'mp4', subtitles, provider: r.provider };
  } catch (e) {
    const err = new Error('No stream found. ' + (e.errors || [e]).map(x => x.message).join(' | ').slice(0, 400));
    err.status = 502;
    throw err;
  }
}

// Diagnostic: runs every provider to completion and reports what each one did
async function debug(q) {
  const { titles, ep } = parseQuery(q);
  const out = await Promise.all(providerJobs(titles, ep).map(async ([name, job]) => {
    const t0 = Date.now();
    try { const r = await job(); return { provider: name, ok: true, ms: Date.now() - t0, url: r.url, subtitles: r.subtitles.length }; }
    catch (e) { return { provider: name, ok: false, ms: Date.now() - t0, error: e.message }; }
  }));
  return { titles, ep, node: process.version, providers: out };
}

// ---------- Proxy ----------
async function proxy(req, res, q, origin) {
  const target = q.url;
  if (!/^https?:\/\//i.test(target || '')) return send(res, 400, { error: 'bad url' }, 'no-store');
  const ref = q.ref || '';
  const headers = { 'User-Agent': UA };
  if (ref) { headers.Referer = ref; headers.Origin = ref.replace(/\/+$/, ''); }
  if (req.headers.range) headers.Range = req.headers.range;
  const r = await fetch(target, { headers });
  cors(res);
  const type = r.headers.get('content-type') || '';
  if (/mpegurl/i.test(type) || /\.m3u8(\?|$)/i.test(target)) {
    const text = await r.text();
    const abs = u => new URL(u, target).href;
    const wrap = u => `${origin}/api?action=proxy&ref=${encodeURIComponent(ref)}&url=${encodeURIComponent(abs(u))}`;
    const out = text.split('\n').map(line => {
      const t = line.trim();
      if (!t) return line;
      if (t.startsWith('#')) return line.replace(/URI="([^"]+)"/g, (_, u) => `URI="${wrap(u)}"`);
      return wrap(t);
    }).join('\n');
    res.setHeader('Content-Type', 'application/vnd.apple.mpegurl');
    res.setHeader('Cache-Control', 'no-store');
    return res.status(200).send(out);
  }
  res.setHeader('Content-Type', type || 'application/octet-stream');
  const cr = r.headers.get('content-range'); if (cr) res.setHeader('Content-Range', cr);
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.status(r.status).send(Buffer.from(await r.arrayBuffer()));
}

module.exports = async (req, res) => {
  cors(res);
  if (req.method === 'OPTIONS') return res.status(204).end();
  const q = req.query || {};
  const proto = req.headers['x-forwarded-proto'] || 'http';
  const origin = `${proto}://${req.headers.host}`;
  try {
    switch (q.action) {
      case 'search':
        if (!q.q && !q.genre) return send(res, 400, { error: 'q or genre required' }, 'no-store');
        return send(res, 200, { results: await search(q.q, q.genre) });
      case 'sources':
        return send(res, 200, await sources(req, q, origin), 's-maxage=60');
      case 'debug':
        return send(res, 200, await debug(q), 'no-store');
      case 'proxy':
        return await proxy(req, res, q, origin);
      case 'home':
        return send(res, 200, await home());
      case 'trending':
      default:
        return send(res, 200, { results: await trending() });
    }
  } catch (e) {
    return send(res, e.status || 500, { error: e.message }, 'no-store');
  }
};
