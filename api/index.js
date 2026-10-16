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
// Streams: AnimeX, AniKoto, AnimeYubi, AniWaves — tried one at a time in that order (see SOURCES below).

// Scraper libraries sometimes reject after the race is already won; never let that crash the function.
try {
  process.on('unhandledRejection', e => console.error('unhandledRejection:', e && e.message));
  process.on('uncaughtException', e => console.error('uncaughtException:', e && e.message));
} catch (e) { /* not available (e.g. Cloudflare Workers) */ }

const accounts = require('../lib/accounts');
const movies = require('../lib/movies');
const subsLib = require('../lib/subs');
const turbo = require('../lib/turbo');          // TurboScrape: cache + de-duplication + hedged source race + cancellation
turbo.installFetch();

const ANILIST = 'https://graphql.anilist.co';
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0';

const MEDIA_FIELDS = `id title{romaji english native} coverImage{extraLarge large color} bannerImage description(asHtml:false)
  idMal episodes nextAiringEpisode{episode} format seasonYear averageScore status genres synonyms popularity isAdult`;
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
  let late = false;
  const t = setTimeout(() => { late = true; ctl.abort(); }, timeout);
  try {
    const r = await fetch(url, { ...opts, signal: ctl.signal, headers: { 'User-Agent': UA, ...(opts.headers || {}) } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } catch (e) {
    if (late) throw new Error('request timed out');             // our own time limit (a failure), as opposed to the client leaving (a cancellation)
    throw e;
  } finally { clearTimeout(t); }
}

// ---------- AniList ----------
const hash = str => { let h = 5381; for (let i = 0; i < str.length; i++) h = ((h << 5) + h + str.charCodeAt(i)) | 0; return (h >>> 0).toString(36); };
async function anilist(query, variables) {
  const body = JSON.stringify({ query, variables });
  return turbo.cached('al:' + hash(body), 5 * 60 * 1000, async () => {
    const d = await fetchJson(ANILIST, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json', 'User-Agent': 'Aniultimatium/2.3' },
      body,
    });
    if (d.errors) throw new Error(d.errors[0].message);
    return d.data;
  }, { negTtl: e => (e.message === 'HTTP 403' ? 10 * 60 * 1000 : 15 * 1000) });     // blocked host: fail fast for 10 min instead of retrying every call
}
function mapMedia(m) {
  return {
    id: m.id,
    mal: m.idMal || null,
    kind: 'anime',
    title: m.title.english || m.title.romaji,          // strictly English-first
    titleRomaji: m.title.romaji,
    cover: m.coverImage.extraLarge || m.coverImage.large,
    coverSm: m.coverImage.large || null,                // ~230px wide: enough for a card, a quarter of the bytes (old TVs decode it much faster)
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
// Episodes that aired in the last 7 days -> "Popular This Week" (most popular shows with a new episode) and "New Releases" (latest first)
function weekRows(d) {
  const sched = [].concat((d.week && d.week.airingSchedules) || [], (d.week2 && d.week2.airingSchedules) || []);
  const seen = new Set(), latest = [];
  for (const x of sched) {
    const m = x.media; if (!m || m.isAdult || seen.has(m.id)) continue;
    seen.add(m.id); latest.push({ m, at: x.airingAt, pop: m.popularity || 0 });
  }
  const pop = latest.slice().sort((a, b) => b.pop - a.pop).slice(0, 20).map(x => mapMedia(x.m));
  const fresh = latest.filter(x => x.pop >= 2000).sort((a, b) => b.at - a.at).slice(0, 20).map(x => mapMedia(x.m));
  return { pop, fresh };
}
async function home() {
  const shelf = (alias, args) => `${alias}:Page(perPage:20){media(type:ANIME,isAdult:false,${args}){...F}}`;
  const now = Math.floor(Date.now() / 1000), sch = (alias, page) => `${alias}:Page(page:${page},perPage:50){airingSchedules(airingAt_greater:$a,airingAt_lesser:$b,sort:TIME_DESC){airingAt media{...F}}}`;
  const q = `query($season:MediaSeason,$year:Int,$a:Int,$b:Int){
    ${shelf('trending', 'sort:TRENDING_DESC')}
    ${shelf('season', 'season:$season,seasonYear:$year,sort:POPULARITY_DESC')}
    ${shelf('top', 'sort:SCORE_DESC')}
    ${shelf('action', 'genre:"Action",sort:POPULARITY_DESC')}
    ${shelf('romance', 'genre:"Romance",sort:POPULARITY_DESC')}
    ${shelf('comedy', 'genre:"Comedy",sort:POPULARITY_DESC')}
    ${shelf('fantasy', 'genre:"Fantasy",sort:POPULARITY_DESC')}
    ${sch('week', 1)} ${sch('week2', 2)}
  } ${FRAG}`;
  let d;
  try {
    d = await anilist(q, { season: currentSeason(), year: new Date().getUTCFullYear(), a: now - 7 * 86400, b: Math.floor(now / 600) * 600 });
  } catch (e) {
    console.error('home query failed, falling back to trending:', e.message);
    return { rows: [{ title: 'Trending Now', items: await trending() }] };
  }
  const titles = [
    ['trending', 'Trending Now'], ['season', 'Popular This Season'], ['top', 'Top Rated'],
    ['action', 'Action'], ['romance', 'Romance'], ['comedy', 'Comedy'], ['fantasy', 'Fantasy'],
  ];
  const rows = titles.map(([k, title]) => ({ title, items: ((d[k] && d[k].media) || []).map(mapMedia) }));
  const w = weekRows(d);
  rows.splice(1, 0, { title: 'Popular This Week', items: w.pop }, { title: 'New Releases', items: w.fresh });
  return { rows: rows.filter(r => r.items.length) };
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

// 00) Anivexa API (https://github.com/walterwhite-69/Anivexa-API): aggregates AniZone, AniKoto, AnimeGG, KickAssAnime,
//     AniWaves, Senshi ... keyed by AniList id. Runs in-process (dependency `all-api`) or remotely via ANIVEXA_URL.
//     Gives HLS masters (up to 1080p) with English soft-subs, so it is the quality source.
let avWorker = null;
async function avGet(pathname) {
  if (/^\/map\//.test(pathname)) return turbo.cached('av:' + pathname, 6 * 3600 * 1000, () => avGet0(pathname));     // id mapping: stable
  return avGet0(pathname);
}
async function avGet0(pathname) {
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
  let late = false;
  const t = setTimeout(() => { late = true; ctl.abort(); }, 5000);                 // a playlist that cannot be fetched in 5 s will not play well either
  try {
    let x;
    try { x = await fetch(r.url, { signal: ctl.signal, redirect: 'follow', headers: { 'User-Agent': UA, ...(r.headers || {}), ...(r.headers && r.headers.Referer ? { Origin: (() => { try { return new URL(r.headers.Referer).origin; } catch (e) { return undefined; } })() } : {}), ...(r.cookie ? { Cookie: r.cookie } : {}), ...(r.mp4 ? { Range: 'bytes=0-1023' } : {}) } }); }
    catch (e) { if (/subrequest/i.test(e.message)) return r; throw e; }   // Workers request budget used up: let the player try it
    if (!x.ok) throw new Error('stream HTTP ' + x.status);
    const ct = (x.headers.get('content-type') || '').toLowerCase();
    if (r.mp4) { if (/text\/html|json/.test(ct)) throw new Error('stream is not video'); }
    else { const head = (await x.text()).slice(0, 64); if (head.indexOf('#EXTM3U') < 0) throw new Error('stream is not a playlist'); }
    try { x.body && x.body.cancel(); } catch (e) { /* ignore */ }
  } catch (e) { if (late) throw new Error('stream probe timed out'); throw e; }
  finally { clearTimeout(t); }
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

// 0d) animex.one — player backend keyed by AniList id (plyr.animex.one/e/{id}/{ep}/__data.json -> pp.animex.one sources).
//     Providers that work through a relay: yuki (megaplay files), zuna, loli. Streams need the Referer the API returns.
const AX_PLYR = 'https://plyr.animex.one', AX_API = 'https://pp.animex.one';
function devalue(arr, i, depth = 0) {                       // SvelteKit flat JSON: numbers index into the same array
  if (typeof i !== 'number' || i < 0 || depth > 40) return undefined;
  const v = arr[i];
  if (Array.isArray(v)) return v.map(j => devalue(arr, j, depth + 1));
  if (v && typeof v === 'object') { const o = {}; for (const k of Object.keys(v)) o[k] = devalue(arr, v[k], depth + 1); return o; }
  return v;
}
const AX_HDR = { 'User-Agent': UA, Referer: AX_PLYR + '/', Origin: AX_PLYR, Accept: 'application/json' };
// show lookup (internal id + which hosts carry sub/dub): stable for a show, so it is cached and shared between episodes and callers
const axMeta = (anilistId, ep) => turbo.cached('ax:meta:' + anilistId, 30 * 60 * 1000, async () => {
  const meta = await fetchJson(`${AX_PLYR}/e/${encodeURIComponent(anilistId)}/${ep}/__data.json`, { headers: AX_HDR }, 8000);
  const node = (meta.nodes || []).find(n => n && Array.isArray(n.data) && n.data[0] && typeof n.data[0] === 'object' && 'servers' in n.data[0]);     // cheap check (no JSON.stringify of the whole page data)
  const root = node ? devalue(node.data, 0) : null;
  if (!root || !root.id || !root.servers) throw turbo.absent('not found');
  const ids = l => (l || []).map(x => x && x.id).filter(Boolean);
  return { id: root.id, sub: ids(root.servers.subProviders), dub: ids(root.servers.dubProviders), at: Date.now() };
}, { negTtl: e => (e && e.absent ? 90 * 1000 : 0) });
async function viaAnimex(anilistId, ep, audio) {
  if (!anilistId) throw new Error('no anilist id');
  const type = audio === 'dub' ? 'dub' : 'sub';
  for (let attempt = 0; attempt < 2; attempt++) {
    const root = await axMeta(anilistId, ep);
    const order = ['yuki', 'zuna', 'loli'].filter(x => (type === 'dub' ? root.dub : root.sub).includes(x));
    if (!order.length) throw turbo.absent('no ' + type);
    const errs = [];
    for (const pv of order.slice(0, 2)) {
      try {
        const d = await fetchJson(`${AX_API}/rest/api/sources?id=${encodeURIComponent(root.id)}&epNum=${ep}&type=${type}&providerId=${pv}`, { headers: AX_HDR }, 8000);
        const src = (d.sources || []).find(x => x && x.url);
        if (!src) throw turbo.absent('no sources');
        const h = d.headers || {}, ref = h.Referer || h.referer || '';
        const subtitles = (d.tracks || []).filter(t => t && t.url && /captions|subtitles/i.test(t.kind || 'captions') && /\.(vtt|srt|ass)(\?|$)/i.test(t.url)).map(t => {
          const l = String(t.lang || t.label || '').toLowerCase(); let lang = l.length === 2 ? l : '';
          for (const k of Object.keys(LANG_CODES)) if (l.includes(k)) { lang = LANG_CODES[k]; break; }
          return { lang: lang || 'en', label: t.label || t.lang || 'English', url: t.url, default: !!t.default };
        });
        const ch = d.chapters || [], iv = n => { const c = ch.find(x => x && new RegExp(n, 'i').test(x.title || '')); return c && c.end > c.start ? { start: +c.start, end: +c.end } : null; };
        const mp4 = /mp4/i.test(src.type || '') || /\.mp4(\?|$)/i.test(src.url);
        return { url: src.url, headers: ref ? { Referer: ref } : {}, subtitles, mp4, quality: mp4 ? (src.quality || '') : 'adaptive', matched: 'animex ' + pv,
                 skip: (iv('intro') || iv('outro')) ? { op: iv('intro'), ed: iv('outro') } : null, forceProxy: true };
      } catch (e) { if (turbo.isAbort(e)) throw e; errs.push(pv + ': ' + clean(e.message, 40)); }
    }
    if (attempt === 0 && Date.now() - root.at > 3000) { turbo.drop('ax:meta:' + anilistId); continue; }   // the cached host list may be stale: look the show up again once
    throw new Error(errs.join('; '));
  }
}

// 0e) AnimeYubi — plain JSON API (search by title -> episode -> videos[]). We use its ZokoAnime host:
//     plain HLS up to 1080p, sub + dub, English VTT. Needs Referer/Origin zokoanime.video, so it goes through our relay.
const AY = 'https://animeyubi.com/api/v4/hianime';
const AY_HDR = { headers: { Referer: 'https://animeyubi.com/', Accept: 'application/json' } };
const ayList = t => turbo.cached('ay:s:' + norm(t), 6 * 3600 * 1000, async () => {
  const list = ((await fetchJson(`${AY}/?q=${encodeURIComponent(t)}`, AY_HDR, 8000)).list) || [];
  return list.filter(x => x && x.slug).slice(0, 25).map(x => ({ anime: x.anime, slug: x.slug }));
});
async function viaAnimeYubi(titles, ep, audio) {
  const ts = [...new Set(titles)].slice(0, 3);
  const lists = [ayList(ts[0]), ts[1] ? ayList(ts[1]) : null];          // the first two spellings are searched at the same time
  lists.forEach(l => l && l.catch(() => {}));
  let hit = null, lastErr = null;
  for (let i = 0; i < ts.length && !hit; i++) {
    try {
      const list = await (lists[i] || (lists[i] = ayList(ts[i])));
      hit = bestMatch(list.filter(x => !/\(dub\)/i.test(x.anime || '')), titles, x => x.anime, 80);
    } catch (e) { if (turbo.isAbort(e)) throw e; lastErr = e; }
  }
  if (!hit) { if (lastErr) throw lastErr; throw turbo.absent('no match'); }
  const d = await turbo.cached(`ay:e:${hit.slug}:${ep}`, 3 * 60 * 1000, async () => {      // short: keeps media links fresh
    const r = await fetchJson(`${AY}/episode/?anime=${encodeURIComponent(hit.slug)}&episode=${ep}`, AY_HDR, 10000);
    return { videos: (r.videos || []).filter(x => x && /zoko/i.test(x.title || '')) };
  });
  const want = audio === 'dub' ? 'DUB' : 'SUB';
  const v = (d.videos || []).find(x => x && x.is_public !== false && /zoko/i.test(x.title || '') && String(x.audio || '').toUpperCase() === want && /url=/.test(x.url || ''));
  if (!v) throw new Error('no ' + want.toLowerCase());
  const raw = v.url.slice(v.url.indexOf('url=') + 4).split('&headers=')[0];
  let h = {}; try { h = JSON.parse(decodeURIComponent((v.url.split('&headers=')[1] || '').split('&')[0] || '{}')); } catch (e) { /* ignore */ }
  const ref = h.referer || h.Referer || 'https://zokoanime.video/';
  if (!/^https:\/\//.test(raw)) throw new Error('bad url');
  const subtitles = (v.subtitles || []).filter(x => x && x.src).map(x => {
    const l = String(x.name || 'English').toLowerCase(); let lang = 'en';
    for (const k of Object.keys(LANG_CODES)) if (l.includes(k)) { lang = LANG_CODES[k]; break; }
    return { lang, label: x.name || 'English', url: x.src };
  });
  return { url: raw, headers: { Referer: ref }, subtitles, mp4: false, quality: 'adaptive', matched: 'animeyubi ' + hit.anime, forceProxy: true };
}

function parseQuery(q) {
  const titles = [q.title, q.alt, ...String(q.syn || '').split('|')].map(x => (x || '').trim()).filter(Boolean);
  if (!titles.length) { const e = new Error('title required'); e.status = 400; throw e; }
  return { titles, ep: parseInt(q.ep, 10) || 1 };
}

// ---------- Anime sources ----------
// Default order (from tests on a Samsung TV): AnimeX > AniKoto > AnimeYubi > AniWaves. The app may send its own order
// (?order=a,b,c) learned from real playback outcomes on that TV (SourceIQ); unknown names are ignored, missing ones are appended.
// TurboScrape: sources are raced with a hedge (the next source starts early when the current one is slow, losers are cancelled),
// every source has its own timeout, lookups are cached and de-duplicated. `cost` ~ outgoing requests (keeps overlaps inside the
// Workers free-plan budget of ~50 per call); when a call runs low the app continues with ?skip=<sources already tried>.
const SOURCES = {
  animex:    (q, titles, ep) => viaAnimex(q.id, ep, q.audio).then(probeStream),
  anikoto:   (q, titles, ep) => viaAnivexa(q.id, ep, 'anikoto', q.audio),
  animeyubi: (q, titles, ep) => viaAnimeYubi(titles, ep, q.audio).then(probeStream),
  aniwaves:  (q, titles, ep) => viaAnivexa(q.id, ep, 'aniwaves', q.audio),
};
const AUTO_ORDER = ['animex', 'anikoto', 'animeyubi', 'aniwaves'];
const NEEDS_ID = new Set(['animex', 'anikoto', 'aniwaves']);
const COST = { animex: 4, animeyubi: 4, anikoto: 70, aniwaves: 30 };           // starting estimates; the race learns the real numbers
const MAX_MS = { animex: 9000, animeyubi: 10000, anikoto: 14000, aniwaves: 14000 };
function pickOrder(orderStr, skip, hasId) {
  const want = String(orderStr || '').split(',').map(x => x.trim()).filter(k => SOURCES[k]);
  return [...new Set([...want, ...AUTO_ORDER])].filter(k => !skip.includes(k) && (hasId || !NEEDS_ID.has(k)));
}
function noStream(dub, errs) {
  const err = new Error(dub ? 'No English dub was found for this episode.' : 'Not available yet — this title or episode has not been found on any source. Try another episode or title.');
  err.detail = errs.join(' | ').slice(0, 600);
  err.status = 502;
  return err;
}
const pubTrace = tr => (tr || []).map(t => ({ k: t.k, ok: !!t.ok, ms: t.ms, kind: t.kind }));        // no URLs, cookies or messages leave the server
// a fresh result is reused for 45 s: de-duplicates the prefetch + play of the same episode and double taps, never serves stale media links
const runSource = (k, titles, ep, q) => turbo.cached(`res:${k}:${q.id || hash(titles.join('|'))}:${ep}:${q.audio === 'dub' ? 'dub' : 'sub'}`, 45 * 1000, () => SOURCES[k](q, titles, ep));
const candidate = (k, titles, ep, q) => ({ key: k, cost: COST[k], max: MAX_MS[k], run: () => runSource(k, titles, ep, q) });

async function sources(req, q, origin) {
  const { titles, ep } = parseQuery(q);
  const dub = q.audio === 'dub';
  const via = q.via && q.via !== 'auto' ? String(q.via) : null;
  const t0 = Date.now(), signal = req && req.signal;
  const legacy = q.turbo === '0';                          // diagnostic: the pre-TurboScrape behaviour (one source at a time, full timeouts, no caching) for A/B measurements
  const reply = (r, key, trace) => ({ ...finish({ ...r, provider: key, matched: r.matched || key }, origin), key, audio: dub ? 'dub' : 'sub', trace: pubTrace(trace), ms: Date.now() - t0, n: turbo.used() });
  if (via) {                                                   // a source picked in the player's menu: no fallback, but still cached / time-limited
    if (!SOURCES[via]) { const e = new Error('Unknown source: ' + via); e.status = 400; throw e; }
    try { const r = await turbo.race([candidate(via, titles, ep, q)], { signal, maxParallel: 1 }); return reply(r.result, via, r.trace); }
    catch (e) { if (turbo.isAbort(e)) throw e; const err = noStream(dub, [via + ': ' + clean((e.trace && e.trace[0] && e.trace[0].msg) || e.message, 120)]); err.trace = pubTrace(e.trace); throw err; }
  }
  const skip = String(q.skip || '').split(',').filter(Boolean);
  const order = pickOrder(q.order, skip, !!q.id);
  try {
    const r = await turbo.race(order.map(k => candidate(k, titles, ep, q)), legacy ? { signal, maxParallel: 1, hedgeMs: 1e9, timeoutMs: 16000 } : { signal, maxParallel: 2, budget: 45 });
    return reply(r.result, r.key, r.trace);
  } catch (e) {
    if (turbo.isAbort(e)) throw e;
    const trace = e.trace || [];
    const err = noStream(dub, trace.filter(t => t.kind !== 'cancelled').map(t => t.k + ': ' + clean(t.msg || t.kind, 80)));
    err.trace = pubTrace(trace);
    let tried = trace.filter(t => t.kind !== 'budget' && t.kind !== 'cancelled').map(t => t.k);
    if (!tried.length) tried = trace.filter(t => t.kind === 'budget').map(t => t.k);          // never loop on a source that cannot fit the request budget
    const rest = order.filter(k => !tried.includes(k));
    if (rest.length) { err.retry = true; err.skip = skip.concat(tried).join(','); }          // the app continues with the sources not tried yet
    throw err;
  }
}


// Turn a provider result into the response the app plays (proxying where a browser/TV could not fetch directly)
function finish(r, origin) {
  const ref = (r.headers && (r.headers.Referer || r.headers.referer)) || '';
  const isHls = /m3u8/i.test(r.url);
  // Route through our proxy when the CDN demands a Referer / CORS (browsers can't set it); HLS always goes through it
  // AnimeGG mp4 links redirect to a CDN that needs no Referer: the TV fetches it directly (no relay = no buffering), relay is the fallback
  const direct = r.cors || (!isHls && /^https:\/\/(www\.)?animegg\.org\/play\//.test(r.url));
  const url = !direct && (ref || r.forceProxy || isHls) ? `${origin}/api?action=proxy&ref=${encodeURIComponent(ref)}&url=${encodeURIComponent(r.url)}` : r.url;
  // Subtitle files are relayed too so the app can fetch them cross-origin (CORS *)
  const subtitles = (r.subtitles || []).map(t => ({ ...t, url: `${origin}/api?action=proxy&fmt=vtt${ref ? '&ref=' + encodeURIComponent(ref) : ''}&url=${encodeURIComponent(t.url)}` }));
  // Same stream relayed through this server (used by the app if the direct link fails in the viewer's browser)
  const proxyUrl = `${origin}/api?action=proxy&ref=${encodeURIComponent(ref || r.referer || '')}&url=${encodeURIComponent(r.url)}`;
  const qualities = (r.qualities || []).length > 1 ? r.qualities.map(x => ({ label: x.label, url: `${origin}/api?action=proxy&ref=${encodeURIComponent(ref)}&url=${encodeURIComponent(x.url)}` })) : undefined;
  // sources whose picture already has English subtitles burned in (so no overlay is added automatically)
  const hardsub = !!r.hardsub || ['animeheaven', 'gogoanime'].includes(r.provider) || /^animegg/.test(r.matched || '');
  return { url, proxyUrl, type: isHls ? 'hls' : 'mp4', subtitles, provider: r.provider, matched: r.matched, qualities, hardsub, skip: r.skip || undefined };
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

// ---------- AniList linking ----------
// AniList OAuth (implicit grant) needs an API client registered at https://anilist.co/settings/developer with the
// redirect URL <this site>/link.html; put its id in ANILIST_CLIENT_ID (wrangler.jsonc "vars" or env).
const alClientId = () => String((typeof process !== 'undefined' && process.env && process.env.ANILIST_CLIENT_ID) || (globalThis.__ENV && globalThis.__ENV.ANILIST_CLIENT_ID) || '').trim();
const AL_TTL = 10 * 60 * 1000;
function alCode() { const A = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; let c = ''; for (let i = 0; i < 6; i++) c += A[Math.floor(Math.random() * A.length)]; return c; }
async function alStart(origin) {
  if (!alClientId()) { const e = new Error('AniList is not set up on this server yet (ANILIST_CLIENT_ID is empty).'); e.status = 501; throw e; }
  const code = alCode();
  await accounts.store.set('al:' + code, { at: Date.now(), token: null });
  return { code, url: origin + '/link.html', expiresIn: AL_TTL / 1000, persistent: accounts.store.persistent() };
}
async function alPoll(code) {
  code = String(code || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const v = code && await accounts.store.get('al:' + code);
  if (!v || Date.now() - v.at > AL_TTL) return { status: 'expired' };
  if (!v.token) return { status: 'waiting' };
  await accounts.store.set('al:' + code, { at: 0, token: null });      // hand the token out once
  return { status: 'ok', token: v.token, expiresIn: v.expiresIn || null };
}
async function alPut(b) {
  const code = String((b && b.code) || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  const token = String((b && b.token) || '');
  if (!code || token.length < 20 || token.length > 4000) { const e = new Error('Missing code or token'); e.status = 400; throw e; }
  const v = await accounts.store.get('al:' + code);
  if (!v || Date.now() - v.at > AL_TTL) { const e = new Error('That code has expired — start again on the TV.'); e.status = 410; throw e; }
  await accounts.store.set('al:' + code, { at: v.at, token, expiresIn: parseInt(b.expiresIn, 10) || null });
  return { ok: true };
}


// Diagnostic: runs every source to completion and reports what each one did (time + outgoing requests)
async function debug(q) {
  const { titles, ep } = parseQuery(q);
  const out = await Promise.all(Object.keys(SOURCES).map(k => turbo.scope(null, async () => {
    const t0 = Date.now();
    try { const r = await turbo.race([candidate(k, titles, ep, q)], { maxParallel: 1 }); return { provider: k, ok: true, ms: Date.now() - t0, n: turbo.used(), matched: r.result.matched, subtitles: (r.result.subtitles || []).length }; }
    catch (e) { return { provider: k, ok: false, ms: Date.now() - t0, n: turbo.used(), kind: ((e.trace || [])[0] || {}).kind, error: clean((((e.trace || [])[0] || {}).msg) || e.message, 120) }; }
  })));
  return { titles, ep, node: process.version, providers: out, cache: turbo.stats };
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
  if (ref) { headers.Referer = ref; try { headers.Origin = new URL(ref).origin; } catch (e) { /* ignore */ } }
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

async function handle(req, res) {
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
      case 'movies_home':                                  // type=series: TV shows
        return send(res, 200, await turbo.cached('mh:' + (q.type || ''), 30 * 60 * 1000, () => movies.home(q.type)), 's-maxage=1800');
      case 'movies_search':
        if (!q.q) return send(res, 400, { error: 'q required' }, 'no-store');
        return send(res, 200, { results: await movies.search(q.q, q.type) }, 's-maxage=600');
      case 'tv_meta':
        if (!/^tt\d+$/.test(q.id || '')) return send(res, 400, { error: 'id required' }, 'no-store');
        return send(res, 200, await turbo.cached('tvm:' + q.id, 6 * 3600 * 1000, () => movies.seriesMeta(q.id)), 's-maxage=21600');
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
      // ---- AniList account linking (TV shows a code; a phone/laptop signs in at /link.html) ----
      case 'config':
        return send(res, 200, { anilistClientId: alClientId(), persistentStore: accounts.store.persistent() }, 'no-store');
      case 'al_start': return send(res, 200, await alStart(origin), 'no-store');
      case 'al_poll': return send(res, 200, await alPoll(q.code), 'no-store');
      case 'al_put': return send(res, 200, await alPut(await readBody(req)), 'no-store');
      case 'proxy':
        return await proxy(req, res, q, origin);
      case 'home':
        return send(res, 200, await home());
      case 'trending':
      default:
        return send(res, 200, { results: await trending() });
    }
  } catch (e) {
    return send(res, e.status || 500, { error: e.message, detail: e.detail, retry: e.retry, skip: e.skip, trace: e.trace }, 'no-store');
  }
}
module.exports = (req, res) => turbo.scope(req.signal, () => handle(req, res), { noCache: !!(req.query && req.query.turbo === '0') });       // cancels this request's outgoing work when the client leaves
