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
try {
  process.on('unhandledRejection', e => console.error('unhandledRejection:', e && e.message));
  process.on('uncaughtException', e => console.error('uncaughtException:', e && e.message));
} catch (e) { /* not available (e.g. Cloudflare Workers) */ }

const accounts = require('../lib/accounts');
const movies = require('../lib/movies');
const subsLib = require('../lib/subs');

const ANILIST = 'https://graphql.anilist.co';
// Optional extra remote instances (comma separated base URLs). Empty by default: the scrapers
// below run inside this function, so no third-party host has to be alive.
const ANIWATCH = (process.env.ANIWATCH_URLS || '').split(',').map(s => s.trim().replace(/\/+$/, '')).filter(Boolean);
const CONSUMET = (process.env.CONSUMET_URLS || '').split(',').map(s => s.trim().replace(/\/+$/, '')).filter(Boolean);
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0';

const MEDIA_FIELDS = `id title{romaji english native} coverImage{extraLarge large color} bannerImage description(asHtml:false)
  idMal episodes nextAiringEpisode{episode} format seasonYear averageScore status genres synonyms`;
const FRAG = `fragment F on Media{${MEDIA_FIELDS}}`;

function cors(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Authorization, Content-Type, *');
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
    headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': 'Aniultimatium/2.3' },
    body: JSON.stringify({ query, variables }),
  });
  if (d.errors) throw new Error(d.errors[0].message);
  return d.data;
}
function mapMedia(m) {
  return {
    id: m.id,
    mal: m.idMal || null,
    kind: 'anime',
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
    synonyms: (m.synonyms || []).filter(x => /^[\x20-\x7e]+$/.test(x)).slice(0, 4),
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
const norm = s => {
  let t = (s || '').toLowerCase().replace(/&#0?39;/g, "'").replace(/[^a-z0-9]+/g, ' ').trim();
  // "2nd season" / "second season" / "season ii" / trailing "ii" -> "season 2"
  const words = { second: 2, third: 3, fourth: 4, fifth: 5, sixth: 6 }, roman = { ii: 2, iii: 3, iv: 4 };
  t = t.replace(/\b(\d+)(?:st|nd|rd|th) season\b/g, 'season $1')
       .replace(/\b(second|third|fourth|fifth|sixth) season\b/g, (_, w) => 'season ' + words[w])
       .replace(/\bseason (ii|iii|iv)\b/g, (_, r) => 'season ' + roman[r]);
  return t;
};
function bestMatch(list, titles, getName, minScore = 55) {
  const wants = titles.map(norm).filter(Boolean);
  let best = null, score = -1;
  for (const item of list) {
    const n = norm(getName(item));
    if (!n) continue;
    let s = 0;
    for (const w of wants) {
      if (n === w) { s = 100; break; }
      if (n.includes(w) || w.includes(n)) {
        // substring only counts when lengths are close ("Attack on Titan" must not pick "... Final Season")
        const ratio = Math.max(n.length, w.length) / Math.min(n.length, w.length);
        if (ratio <= 1.6) s = Math.max(s, 90 - (ratio - 1) * 25);
      } else {
        const a = new Set(n.split(' ')), b = w.split(' ');
        s = Math.max(s, 85 * b.filter(x => a.has(x)).length / Math.max(a.size, b.length));
      }
    }
    if (s > score) { score = s; best = item; }
  }
  return score >= minScore ? best : null;
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
  return { url: pick.url, headers: d.headers || {}, subtitles: pickSubtitles(d.subtitles || d.tracks), mp4: !pick.isM3U8 && !/m3u8/i.test(pick.url) };
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




// 00) Anivexa API (https://github.com/walterwhite-69/Anivexa-API): aggregates AniZone, AniKoto, AnimeGG, KickAssAnime,
//     AniWaves, Senshi ... keyed by AniList id. Runs in-process (dependency `all-api`) or remotely via ANIVEXA_URL.
//     Gives HLS masters (up to 1080p) with English soft-subs, so it is the quality source.
let avWorker = null;
async function avGet(pathname) {
  if (process.env.ANIVEXA_URL) return fetchJson(process.env.ANIVEXA_URL.replace(/\/+$/, '') + pathname, {}, 25000);
  if (!avWorker && globalThis.__AV_WORKER) avWorker = globalThis.__AV_WORKER;     // Cloudflare Workers: bundled statically by worker/index.js
  if (!avWorker) {
    const file = require('path').join(__dirname, '..', 'node_modules', 'all-api', 'index.js');
    avWorker = (await import(require('url').pathToFileURL(file).href)).default;
  }
  const res = await avWorker.fetch(new Request('http://anivexa.local' + pathname), {});
  if (!res.ok) { let m = ''; try { const j = await res.json(); m = j.error || j.message || ''; } catch (e) { /* ignore */ } throw new Error('anivexa HTTP ' + res.status + (m ? ' ' + String(m).slice(0, 120) : '')); }
  return res.json();
}
const AV_ORDER = ['anizone', 'anikoto', 'animegg', 'kaa', 'animenosub', 'aniwaves', 'senshi'];
const AV_ALL = [...AV_ORDER, 'anipm', 'animedunya', 'animeonsen', 'mkissa'];
// Keep several subtitle tracks (English variants first, then Japanese and a few other languages) so the player can offer a language choice.
const LANG_CODES = { english: 'en', japanese: 'ja', spanish: 'es', portuguese: 'pt', french: 'fr', german: 'de', arabic: 'ar', italian: 'it', indonesian: 'id', russian: 'ru' };
function avSubtitles(list) {
  const langOf = t => { const l = String(t.language || t.lang || t.label || '').toLowerCase(); for (const k of Object.keys(LANG_CODES)) if (l.includes(k)) return LANG_CODES[k]; return null; };
  const rank = t => {                       // English variants: dialogue/plain best, forced/songs/AI worst
    const l = String(t.language || t.lang || t.label || '');
    if (/forced|signs|songs|dub|\bai\b/i.test(l)) return 1;
    if (/sdh|cc/i.test(l)) return 2;
    return 3;
  };
  const usable = (list || []).filter(t => t && t.url && /\.(vtt|srt|ass)(\?|$)/i.test(t.url) && langOf(t));
  const out = [], seen = {};
  usable.sort((a, b) => rank(b) - rank(a)).forEach(t => {
    const code = langOf(t), cap = code === 'en' ? 2 : 1;
    seen[code] = (seen[code] || 0) + 1;
    if (seen[code] <= cap) out.push({ lang: code, label: String(t.language || t.lang || t.label || code).replace(/\s*\(.*?\)\s*/g, ' ').trim(), url: t.url });
  });
  const order = { en: 0, ja: 1 };
  return out.sort((a, b) => (order[a.lang] ?? 9) - (order[b.lang] ?? 9)).slice(0, 8);
}
function avPick(d) {
  let streams = (d.streams || d.sources || []).filter(x => x && x.url && /^https?:/.test(x.url));
  if (!streams.length) throw new Error('no streams');
  const usable = streams.filter(x => x.type === 'hls' || x.type === 'mp4' || /\.(m3u8|mp4)(\?|$)/i.test(x.url));
  if (!usable.length) throw new Error('only embeds');
  const q = x => parseInt(x.quality, 10) || 0;
  const pick = usable.slice().sort((a, b) => (b.isActive ? 1 : 0) - (a.isActive ? 1 : 0) || q(b) - q(a))[0];
  // AnimeGG lists one mp4 per quality: take the best
  const best = pick.type === 'mp4' ? usable.filter(x => x.type === 'mp4').sort((a, b) => q(b) - q(a))[0] : pick;
  const headers = Object.assign({}, d.headers || {}, best.headers || {});
  if (best.referer && !headers.Referer) headers.Referer = best.referer;
  return {
    url: best.url, headers,
    subtitles: avSubtitles(best.subtitles || best.tracks || d.subtitles),
    mp4: best.type === 'mp4' || /\.mp4(\?|$)/i.test(best.url),
    quality: best.quality || (best.type === 'hls' ? 'adaptive' : ''),
    qualities: best.type === 'mp4' ? usable.filter(x => x.type === 'mp4' && x.quality).sort((a, b) => q(b) - q(a)).map(x => ({ label: x.quality, url: x.url })) : undefined,
  };
}
// Make sure a stream really plays from THIS host (some CDNs answer 404/HTML to cloud IPs) before we hand it out
async function probeStream(r) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), 9000);
  try {
    let x;
    try { x = await fetch(r.url, { signal: ctl.signal, redirect: 'follow', headers: { 'User-Agent': UA, ...(r.headers || {}), ...(r.mp4 ? { Range: 'bytes=0-1023' } : {}) } }); }
    catch (e) { if (/subrequest/i.test(e.message)) return r; throw e; }   // Workers request budget used up: let the player try it
    if (!x.ok) throw new Error('stream HTTP ' + x.status);
    const ct = (x.headers.get('content-type') || '').toLowerCase();
    if (r.mp4) { if (/text\/html|json/.test(ct)) throw new Error('stream is not video'); }
    else { const head = (await x.text()).slice(0, 64); if (head.indexOf('#EXTM3U') < 0) throw new Error('stream is not a playlist'); }
    try { x.body && x.body.cancel(); } catch (e) { /* ignore */ }
  } finally { clearTimeout(t); }
  return r;
}
async function viaAnivexa(anilistId, ep, only, audio) {
  if (!anilistId) throw new Error('no anilist id');
  const aud = audio === 'dub' ? 'dub' : 'sub';
  const order = (only && AV_ALL.includes(only) ? [only] : AV_ORDER).filter(p => aud === 'sub' || p !== 'anizone');   // AniZone has no separate dub (its HLS carries an English audio track)
  const T = 14000;
  if (globalThis.__AV_WORKER && !(only && AV_ALL.includes(only))) {
    // Cloudflare Workers allow only a handful of outgoing requests per call: try the reliable providers one at a time
    const seq = ['animegg', 'aniwaves', 'kaa', 'anikoto', 'senshi', 'animenosub', 'anizone'].filter(p => order.includes(p));
    const errs = [];
    for (const p of seq) {
      try {
        const r = await withTimeout(avGet(`/watch/${p}/${anilistId}/${aud}/${p}-${ep}`).then(d => probeStream({ ...avPick(d), via: p })), T, p);
        return { ...r, matched: p + (r.quality ? ' ' + r.quality : '') };
      } catch (e) { errs.push(p + ': ' + clean(e.message, 50)); }
    }
    throw new Error(errs.join('; '));
  }
  const runs = order.map(p => withTimeout(avGet(`/watch/${p}/${anilistId}/${aud}/${p}-${ep}`).then(d => probeStream({ ...avPick(d), via: p })), T + 6000, p));
  runs.forEach(r => r.catch(() => {}));
  const errs = [];
  for (let i = 0; i < runs.length; i++) {            // priority order; all already running in parallel
    try { const r = await runs[i]; return { ...r, matched: order[i] + (r.quality ? ' ' + r.quality : '') }; }
    catch (e) { errs.push(order[i] + ': ' + clean(e.message, 50)); }
  }
  throw new Error(errs.join('; '));
}

// 0) AnimeHeaven — plain HTML + direct, hard-subbed (English) MP4 links, no bot protection.
//    Verified live: search.php -> anime.php (episode ids) -> gate.php (cookie key=<id>) -> <source src=...mp4>
const AH = 'https://animeheaven.me';
const decodeEnt = t => t.replace(/&amp;/g, '&').replace(/&#0?39;|&apos;/g, "'").replace(/&quot;/g, '"').replace(/&lt;/g, '<').replace(/&gt;/g, '>');
async function ahText(pathname, headers = {}, timeout = 12000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeout);
  try {
    const r = await fetch(AH + pathname, { signal: ctl.signal, redirect: 'follow', headers: { 'User-Agent': UA, ...headers } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.text();
  } finally { clearTimeout(t); }
}
async function viaAnimeHeaven(titles, ep) {
  let hit = null;
  // the site's search is literal: also try the first words of each title ("Solo Leveling Season 2 ..." -> "Solo Leveling")
  const queries = [...new Set([...titles, ...titles.map(t => norm(t).split(' ').slice(0, 2).join(' '))])].filter(q => q.length > 2);
  for (const t of queries) {
    const html = await ahText('/search.php?s=' + encodeURIComponent(t));
    const seen = new Set(), items = [];
    for (const m of html.matchAll(/<a href='anime\.php\?(\w+)' class='c'>([^<]+)<\/a>/g)) {
      if (!seen.has(m[1])) { seen.add(m[1]); items.push({ id: m[1], name: decodeEnt(m[2]) }); }
    }
    hit = bestMatch(items.filter(i => !/\bdub\b/i.test(i.name)), titles, i => i.name);
    if (hit) break;
  }
  if (!hit) throw new Error('no match');
  const page = await ahText('/anime.php?' + hit.id);
  let epId = null;
  for (const m of page.matchAll(/id ="([a-f0-9]{32})"[^>]*>[\s\S]*?watch2 bc\s*'\s*>\s*([\d.]+)\s*</g)) {
    if (Number(m[2]) === ep) { epId = m[1]; break; }
  }
  if (!epId) throw new Error('episode not found');
  const gate = await ahText('/gate.php', { Cookie: 'key=' + epId, Referer: AH + '/anime.php?' + hit.id });
  const srcs = [...gate.matchAll(/<source src='([^']+\.mp4[^']*)'/g)].map(m => decodeEnt(m[1])).filter(u => !/&error/.test(u));
  if (!srcs.length) throw new Error('no video link');
  return { url: srcs[0], headers: {}, subtitles: [], mp4: true, matched: hit.name };
}


// 0a) AnimePararadise — public JSON API (works from Cloudflare): HLS up to 1080p + English soft subtitles.
//     search -> /anime/{id}/episode -> /ep/{uid}?origin={id} -> streamLink (played via stream.animeparadise.moe/m3u8)
const AP_API = 'https://api.animeparadise.moe', AP_SITE = 'https://www.animeparadise.moe/';
const apGet = u => fetchJson(AP_API + u, { headers: { Referer: AP_SITE, Origin: 'https://www.animeparadise.moe', Accept: 'application/json' } }, 9000);
async function viaAnimeParadise(anilistId, titles, ep) {
  const alOf = x => { const m = /\/bx?(\d+)-/.exec((x.posterImage && (x.posterImage.large || x.posterImage.medium)) || ''); return m ? Number(m[1]) : null; };
  const names = x => [x.title, x.alternativeTitle && x.alternativeTitle.english, x.alternativeTitle && x.alternativeTitle.romaji].filter(Boolean);
  let hit = null;
  for (const t of [...new Set(titles)].slice(0, 3)) {
    const list = ((await apGet('/search?q=' + encodeURIComponent(t))).data) || [];
    if (anilistId) hit = list.find(x => alOf(x) === Number(anilistId)) || null;   // AniList id is in the poster URL: exact match
    if (!hit) {
      const flat = []; list.forEach(x => { if (!anilistId || !alOf(x)) names(x).forEach(n => flat.push({ x, n })); });
      const b = bestMatch(flat, titles, i => i.n, 90); hit = b && b.x;
    }
    if (hit) break;
  }
  if (!hit) throw new Error('no match');
  const eps = ((await apGet(`/anime/${encodeURIComponent(hit._id)}/episode`)).data) || [];
  const e = eps.find(x => Number(x.number) === ep);
  if (!e) throw new Error('episode not found');
  const d = ((await apGet(`/ep/${encodeURIComponent(e.uid)}?origin=${encodeURIComponent(hit._id)}`)).data || {}).episode || {};
  if (!d.streamLink) throw new Error('no stream');
  const subtitles = (d.subData || []).filter(x => x && x.src && /vtt|ass|srt/i.test(x.type || 'vtt')).map(x => {
    const l = String(x.label || 'English').toLowerCase(); let lang = 'en';
    for (const k of Object.keys(LANG_CODES)) if (l.includes(k)) { lang = LANG_CODES[k]; break; }
    return { lang, label: x.label || 'English', url: /^https?:/.test(x.src) ? x.src : `${AP_API}/stream/file/${x.src}` };
  });
  return { url: `https://stream.animeparadise.moe/m3u8?url=${d.streamLink}`, headers: { Referer: AP_SITE }, subtitles, mp4: false, quality: 'adaptive', matched: hit.title };
}

// 0b) gogoanime.by — WordPress site; its "blogger" player exposes a Google Video MP4 (English sub).
//     Those links are locked to the requesting IP, so they are always relayed through this server.
const GG = 'https://gogoanime.by';
async function ggText(urlOrPath, headers = {}, timeout = 12000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeout);
  try {
    const r = await fetch(urlOrPath.startsWith('http') ? urlOrPath : GG + urlOrPath, { signal: ctl.signal, redirect: 'follow', headers: { 'User-Agent': UA, ...headers } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.text();
  } finally { clearTimeout(t); }
}
async function viaGogoanime(titles, ep) {
  const queries = [...new Set([...titles, ...titles.map(t => norm(t).split(' ').slice(0, 2).join(' '))])].filter(q => q.length > 2);
  let hit = null;
  for (const q of queries) {
    const html = await ggText('/?s=' + encodeURIComponent(q));
    const seen = new Set(), items = [];
    for (const m of html.matchAll(/class="bsx"[^>]*>\s*<a href="(https:\/\/gogoanime\.by\/series\/[^"]+)"[^>]*title="([^"]+)"/g)) {
      if (!seen.has(m[1])) { seen.add(m[1]); items.push({ url: m[1], name: decodeEnt(m[2]).replace(/\s*GoGoanime$/i, '') }); }
    }
    hit = bestMatch(items.filter(i => !/\bdub\b/i.test(i.name)), titles, i => i.name);
    if (hit) break;
  }
  if (!hit) throw new Error('no match');
  const page = await ggText(hit.url);
  const base = hit.url.split('/series/')[1].replace(/\/$/, '').split('-').slice(0, 2).join('-');
  let epUrl = null;
  for (const m of page.matchAll(/href="(https:\/\/gogoanime\.by\/([^"\/]*)-episode-(\d+)-[^"\/]*\/)"/g)) {
    if (m[2].startsWith(base) && Number(m[3]) === ep) { epUrl = m[1]; break; }
  }
  if (!epUrl) throw new Error('episode not found');
  const epHtml = await ggText(epUrl, { Referer: hit.url });
  const players = [...epHtml.matchAll(/data-src="(https:\/\/gogoanime\.by\/player\/[^"]+)"/g)].map(m => decodeEnt(m[1]));
  if (!players.length) throw new Error('no players');
  let last;
  for (const pl of players) {
    try {
      const ph = await ggText(pl, { Referer: epUrl });
      const m = ph.match(/var sources = (\[.*?\]);/s);
      if (!m) continue;
      const files = JSON.parse(m[1]).filter(f => f && f.file);
      files.sort((a, b) => (parseInt(b.label, 10) || 0) - (parseInt(a.label, 10) || 0));
      if (files.length) return { url: files[0].file, headers: {}, subtitles: [], mp4: true, matched: hit.name, forceProxy: true };
    } catch (e) { last = e; }
  }
  throw last || new Error('no playable source');
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

function providerJobs(titles, ep, anilistId, via, audio) {
  const T = 40000;
  return [
    ['animeparadise', () => withTimeout(viaAnimeParadise(anilistId, titles, ep), T, 'animeparadise')],
    ['anivexa', () => withTimeout(viaAnivexa(anilistId, ep, via, audio), T, 'anivexa')],
    ['animeheaven', () => withTimeout(viaAnimeHeaven(titles, ep), T, 'animeheaven')],
    ['gogoanime', () => withTimeout(viaGogoanime(titles, ep), T, 'gogoanime')],
    ['allanime', () => withTimeout(viaAllAnime(titles, ep), T, 'allanime')],
    // Cloudflare-blocked scrapers: off by default (they only add 20s of waiting). Set EXTRA_PROVIDERS=1 to try them.
    ...(process.env.EXTRA_PROVIDERS ? [
      ['aniwatch', () => withTimeout(viaAniwatchLib(titles, ep), T, 'aniwatch')],
      ['animepahe', () => withTimeout(viaConsumetLib('AnimePahe', titles, ep), T, 'animepahe')],
      ['animekai', () => withTimeout(viaConsumetLib('AnimeKai', titles, ep), T, 'animekai')],
      ['hianime', () => withTimeout(viaConsumetLib('Hianime', titles, ep), T, 'hianime')],
    ] : []),
    ...ANIWATCH.map((b, i) => ['aniwatch-remote' + i, () => viaAniwatchRemote(b, titles, ep)]),
    ...CONSUMET.map((b, i) => ['consumet-remote' + i, () => viaConsumetRemote(b, titles, ep)]),
  ];
}
function parseQuery(q) {
  const titles = [q.title, q.alt, ...String(q.syn || '').split('|')].map(x => (x || '').trim()).filter(Boolean);
  if (!titles.length) { const e = new Error('title required'); e.status = 400; throw e; }
  return { titles, ep: parseInt(q.ep, 10) || 1 };
}

// Source chain used on Cloudflare Workers (free plan: ~50 outgoing requests per call). Measured from a Worker:
// AnimeParadise (HLS 1080p + soft subs) > Anikoto (HLS + soft subs) > AnimeGG (hardsub mp4) > AniWaves > AnimeNoSub > AnimeHeaven > gogoanime.
// Each call tries sources one by one and stops early when its request budget runs low; the app then calls again with
// ?skip=<sources already tried>, so every source gets a fresh budget. The app also skips a source whose stream fails to play.
const CF_CHAIN = ['animeparadise', 'anikoto', 'animegg', 'aniwaves', 'animenosub', 'animeheaven', 'gogoanime', 'kaa', 'anizone'];
const DUB_OK = new Set(['anikoto', 'animegg', 'aniwaves', 'kaa', 'animenosub']);
function chainJob(k, titles, ep, q) {
  if (k === 'animeparadise') return viaAnimeParadise(q.id, titles, ep);
  if (k === 'animeheaven') return viaAnimeHeaven(titles, ep);
  if (k === 'gogoanime') return viaGogoanime(titles, ep);
  return viaAnivexa(q.id, ep, k, q.audio);
}
async function sourcesChain(titles, ep, q, origin) {
  const dub = q.audio === 'dub';
  const skip = String(q.skip || '').split(',').filter(Boolean);
  const chain = CF_CHAIN.filter(k => !skip.includes(k) && (!dub || DUB_OK.has(k)) && (q.id || k === 'animeheaven' || k === 'gogoanime'));
  const t0 = Date.now(), tried = [], errs = [];
  for (const k of chain) {
    try {
      const r = await withTimeout(chainJob(k, titles, ep, q), 16000, k);
      const provider = AV_ALL.includes(k) ? 'anivexa' : k;
      return { ...finish({ ...r, provider, matched: r.matched || k }, origin), key: k, audio: dub ? 'dub' : 'sub' };
    } catch (e) {
      const budget = /subrequest/i.test(e.message);
      if (!budget || !tried.length) tried.push(k);          // out of budget mid-way: retry this source in a fresh call
      errs.push(k + ': ' + clean(e.message, 80));
      if (budget || Date.now() - t0 > 12000) break;
    }
  }
  const rest = chain.filter(k => !tried.includes(k));
  const err = new Error(dub ? 'No English dub was found for this episode.' : 'Not available yet — this title or episode has not been found on any source. Try another episode or title.');
  err.detail = errs.join(' | ').slice(0, 600);
  err.status = 502;
  if (rest.length) { err.retry = true; err.skip = skip.concat(tried).join(','); }
  throw err;
}

async function sources(req, q, origin) {
  const { titles, ep } = parseQuery(q);
  // forced source from the player's menu: an Anivexa sub-provider, or animeparadise / animeheaven / gogoanime
  const via = q.via && q.via !== 'auto' ? String(q.via) : null;
  if (globalThis.__AV_WORKER && !via && !q.only) return sourcesChain(titles, ep, q, origin);
  const avVia = via && AV_ALL.includes(via) ? via : null;
  const skip = String(q.skip || '').split(',').filter(Boolean);
  const only = q.only ? String(q.only).split(',') : via ? [avVia ? 'anivexa' : via] : null;
  const all = providerJobs(titles, ep, q.id, avVia, q.audio).filter(([n]) => (!only || only.includes(n)) && !skip.includes(n) && (q.audio !== 'dub' || n === 'anivexa'));
  // AnimeParadise / Anivexa (HLS up to 1080p, soft English subs) go first; the rest only start if they fail or are slow (>6s)
  const prim = all.filter(([n]) => q.id && (n === 'animeparadise' || n === 'anivexa'));
  const primary = prim.length ? prim : all.filter(([n]) => n === 'animeheaven');
  const runs = new Map(primary.map(([n, job]) => [n, job()]));
  const firstOk = runs.size ? Promise.any([...runs.values()]) : Promise.reject(new Error('none'));
  const gate = runs.size ? Promise.race([firstOk.then(() => new Promise(() => {}), () => {}), new Promise(r => setTimeout(r, 6000))]) : Promise.resolve();
  const jobs = all.map(([name, job]) => (runs.has(name) ? runs.get(name) : gate.then(job)).then(r => ({ ...r, provider: name }), e => { throw new Error(name + ': ' + clean(e.message, 260)); }));
  try {
    // Race every provider; AnimeParadise wins ties (soft subs, 1080p): give it a moment if Anivexa answers first
    const r = await Promise.any(jobs);
    if (r.provider !== 'animeparadise' && runs.has('animeparadise')) {
      const ap = await Promise.race([runs.get('animeparadise').then(x => ({ ...x, provider: 'animeparadise' }), () => null), new Promise(res => setTimeout(() => res(null), 2500))]);
      if (ap) return { ...finish(ap, origin), key: 'animeparadise', audio: q.audio === 'dub' ? 'dub' : 'sub' };
    }
    const key = r.provider === 'anivexa' ? String(r.matched || '').split(' ')[0] : r.provider;
    return { ...finish(r, origin), key, audio: q.audio === 'dub' ? 'dub' : 'sub' };
  } catch (e) {
    const err = new Error(q.audio === 'dub' ? 'No English dub was found for this episode.' : 'Not available yet — this title or episode has not been found on any source. Try another episode or title.');
    err.detail = (e.errors || [e]).map(x => x.message).join(' | ').slice(0, 600);
    err.status = 502;
    throw err;
  }
}


// Turn a provider result into the response the app plays (proxying where a browser/TV could not fetch directly)
function finish(r, origin) {
  const ref = (r.headers && (r.headers.Referer || r.headers.referer)) || '';
  const isHls = /m3u8/i.test(r.url);
  // Route through our proxy when the CDN demands a Referer / CORS (browsers can't set it); HLS always goes through it
  // AnimeGG mp4 links redirect to a CDN that needs no Referer: the TV fetches it directly (no relay = no buffering), relay is the fallback
  const direct = !isHls && /^https:\/\/(www\.)?animegg\.org\/play\//.test(r.url);
  const url = !direct && (ref || r.forceProxy || isHls) ? `${origin}/api?action=proxy&ref=${encodeURIComponent(ref)}&url=${encodeURIComponent(r.url)}` : r.url;
  // Subtitle files are relayed too so the app can fetch them cross-origin (CORS *)
  const subtitles = (r.subtitles || []).map(t => ({ ...t, url: `${origin}/api?action=proxy&fmt=vtt&url=${encodeURIComponent(t.url)}` }));
  // Same stream relayed through this server (used by the app if the direct link fails in the viewer's browser)
  const proxyUrl = `${origin}/api?action=proxy&ref=${encodeURIComponent(ref || r.referer || '')}&url=${encodeURIComponent(r.url)}`;
  const qualities = (r.qualities || []).length > 1 ? r.qualities.map(x => ({ label: x.label, url: `${origin}/api?action=proxy&ref=${encodeURIComponent(ref)}&url=${encodeURIComponent(x.url)}` })) : undefined;
  // sources whose picture already has English subtitles burned in (so no overlay is added automatically)
  const hardsub = ['animeheaven', 'gogoanime'].includes(r.provider) || /^animegg/.test(r.matched || '');
  return { url, proxyUrl, type: isHls ? 'hls' : 'mp4', subtitles, provider: r.provider, matched: r.matched, qualities, hardsub };
}

// Intro / outro timestamps (AniSkip, keyed by MyAnimeList id)
async function skipTimes(mal, ep) {
  if (!mal) return { op: null, ed: null };
  try {
    const d = await fetchJson(`https://api.aniskip.com/v2/skip-times/${encodeURIComponent(mal)}/${encodeURIComponent(ep)}?types=op&types=ed&episodeLength=0`, {}, 8000);
    const pick = t => { const x = (d.results || []).find(r => r.skipType === t); return x ? { start: x.interval.startTime, end: x.interval.endTime } : null; };
    return { op: pick('op'), ed: pick('ed') };
  } catch (e) { return { op: null, ed: null }; }
}

// English OpenSubtitles candidates (proxied + converted to WebVTT). Movie: ?imdb=tt..  Episode: ?imdb=tt..&season=1&episode=3  Anime: ?anilist=ID&ep=N
async function subsFor(q, origin) {
  let id = q.imdb;
  if (!id && q.anilist) {
    const m = await avGet('/map/' + encodeURIComponent(q.anilist));
    const mm = m.mappings || m;
    if (!mm.imdbId) return [];
    id = `${mm.imdbId}:${mm.defaultTvdbSeason || 1}:${(parseInt(q.ep, 10) || 1) + (parseInt(mm.episodeOffset, 10) || 0)}`;
  } else if (id && q.season) id = `${id}:${q.season}:${q.episode || 1}`;
  if (!id) return [];
  const list = await subsLib.list(id);
  return list.map(x => ({ ...x, url: `${origin}/api?action=proxy&fmt=vtt&url=${encodeURIComponent(x.url)}` }));
}

async function readBody(req) {
  if (req.body !== undefined && req.body !== null && req.body !== '') return typeof req.body === 'string' ? (JSON.parse(req.body || '{}')) : req.body;
  return {};
}

// Diagnostic: runs every provider to completion and reports what each one did
async function debug(q) {
  const { titles, ep } = parseQuery(q);
  const out = await Promise.all(providerJobs(titles, ep, q.id).map(async ([name, job]) => {
    const t0 = Date.now();
    try { const r = await job(); return { provider: name, ok: true, ms: Date.now() - t0, matched: r.matched, url: r.url, subtitles: r.subtitles.length }; }
    catch (e) { return { provider: name, ok: false, ms: Date.now() - t0, error: e.message }; }
  }));
  return { titles, ep, node: process.version, providers: out };
}


// Subtitle conversion so any browser/TV <track> can show them: SRT / ASS -> WebVTT
function toVtt(text, url) {
  text = text.replace(/^﻿/, '').replace(/\r/g, '');
  if (/^WEBVTT/.test(text)) return text;
  if (/\.ass(\?|$)/i.test(url) || /^\[Script Info\]/m.test(text)) {
    const t = x => { const m = x.match(/(\d+):(\d+):(\d+)[.](\d+)/); return m ? `${String(m[1]).padStart(2, '0')}:${m[2]}:${m[3]}.${(m[4] + '00').slice(0, 3)}` : '00:00:00.000'; };
    let fmt = [], cues = [];
    for (const line of text.split('\n')) {
      if (/^Format:/i.test(line) && !fmt.length) fmt = line.slice(7).split(',').map(x => x.trim().toLowerCase());
      else if (/^Dialogue:/i.test(line)) {
        const parts = line.slice(9).split(','), n = fmt.length || 10;
        const o = {}; fmt.forEach((k, i) => { o[k] = i === n - 1 ? parts.slice(i).join(',') : parts[i]; });
        const txt = (o.text || '').replace(/\{[^}]*\}/g, '').replace(/\\N/gi, '\n').replace(/\\h/g, ' ').trim();
        if (txt) cues.push(`${t(o.start)} --> ${t(o.end)}\n${txt}`);
      }
    }
    return 'WEBVTT\n\n' + cues.join('\n\n') + '\n';
  }
  return 'WEBVTT\n\n' + text.replace(/(\d+:\d+:\d+),(\d+)/g, '$1.$2');
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
  if (q.fmt === 'vtt') {
    res.setHeader('Content-Type', 'text/vtt; charset=utf-8');
    res.setHeader('Cache-Control', 'public, max-age=3600');
    return res.status(200).send(toVtt(await r.text(), target));
  }
  const type = r.headers.get('content-type') || '';
  if (/mpegurl/i.test(type) || /\.m3u8(\?|$)/i.test(target)) {
    const text = await r.text();
    if (!r.ok || text.indexOf('#EXTM3U') < 0) return send(res, r.ok ? 502 : r.status, { error: 'upstream playlist unavailable (' + r.status + ')' }, 'no-store');
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
  // Stream everything else (mp4 etc.) straight through, honouring Range requests
  res.setHeader('Content-Type', type || 'application/octet-stream');
  ['content-range', 'content-length', 'accept-ranges'].forEach(h => { const v = r.headers.get(h); if (v) res.setHeader(h, v); });
  res.setHeader('Cache-Control', 'public, max-age=3600');
  res.statusCode = r.status;
  if (!r.body) return res.end();
  if (typeof res.sendWebStream === 'function') return res.sendWebStream(r.body);   // Cloudflare Workers: pass the stream straight through
  const { Readable } = require('stream');
  const stream = Readable.fromWeb(r.body);
  res.on('close', () => stream.destroy());
  stream.on('error', () => res.end());
  stream.pipe(res);
}

const bearer = req => String(req.headers.authorization || '').replace(/^Bearer\s+/i, '');

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
      // ---- movies (Cinemeta metadata; Stremio addons + Internet Archive streams) ----
      case 'movies_home':
        return send(res, 200, await movies.home(), 's-maxage=1800');
      case 'movies_search':
        if (!q.q) return send(res, 400, { error: 'q required' }, 'no-store');
        return send(res, 200, { results: await movies.search(q.q) }, 's-maxage=600');
      case 'movie_sources': {
        const r = await movies.sources(q);
        // direct = our own player (best); embeds = hosted iframe players (used when no direct file exists or the user picks it)
        const base = r.direct ? finish(r.direct, origin) : {};
        return send(res, 200, { ...base, mode: r.direct ? 'direct' : 'embed', embeds: r.embeds }, 'no-store');
      }
      case 'subs':
        return send(res, 200, { subtitles: await subsFor(q, origin).catch(() => []) }, 's-maxage=3600');
      case 'skip':
        return send(res, 200, await skipTimes(q.mal, q.ep || 1), 's-maxage=86400');
      // ---- accounts & sync ----
      case 'register': return send(res, 200, await accounts.register(await readBody(req)), 'no-store');
      case 'login': return send(res, 200, await accounts.login(await readBody(req)), 'no-store');
      case 'me': return send(res, 200, await accounts.me(bearer(req)), 'no-store');
      case 'sync_get': return send(res, 200, await accounts.syncGet(bearer(req)), 'no-store');
      case 'sync_put': return send(res, 200, await accounts.syncPut(bearer(req), (await readBody(req)).data), 'no-store');
      case 'avtest': {           // diagnostics: run one Anivexa provider from this host and check that its stream loads
        const t0 = Date.now(), p = String(q.p || ''), aud = q.audio === 'dub' ? 'dub' : 'sub';
        if (!AV_ALL.includes(p)) return send(res, 400, { error: 'unknown provider', providers: AV_ALL }, 'no-store');
        try {
          const d = await withTimeout(avGet(`/watch/${p}/${q.id}/${aud}/${p}-${parseInt(q.ep, 10) || 1}`), 20000, p);
          const r = avPick(d);
          const t1 = Date.now();
          let probe = 'ok';
          try { await probeStream(r); } catch (e) { probe = clean(e.message, 80); }
          return send(res, 200, { p, ok: probe === 'ok', ms: t1 - t0, probeMs: Date.now() - t1, probe, url: r.url, mp4: r.mp4, quality: r.quality, subs: (r.subtitles || []).length, ref: (r.headers && r.headers.Referer) || '' }, 'no-store');
        } catch (e) { return send(res, 200, { p, ok: false, ms: Date.now() - t0, error: clean(e.message, 160) }, 'no-store'); }
      }
      case 'proxy':
        return await proxy(req, res, q, origin);
      case 'home':
        return send(res, 200, await home());
      case 'trending':
      default:
        return send(res, 200, { results: await trending() });
    }
  } catch (e) {
    return send(res, e.status || 500, { error: e.message, detail: e.detail, retry: e.retry, skip: e.skip }, 'no-store');
  }
};
