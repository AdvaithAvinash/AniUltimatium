// Vercel Serverless Function: /api
//   ?action=trending
//   ?action=search&q=naruto
//   ?action=sources&title=...&alt=...&ep=1     -> { url, type, subtitles:[{lang,url}] }
//   ?action=proxy&url=...&ref=...               -> CORS/Referer-safe relay (m3u8 rewritten)
//
// Metadata: AniList GraphQL (English titles). Streams: HiAnime-compatible "aniwatch-api"
// instances (sub = hard/soft English subtitles) with Consumet as a fallback.
// Override providers with env vars (comma separated base URLs):
//   ANIWATCH_URLS, CONSUMET_URLS

const ANILIST = 'https://graphql.anilist.co';
const ANIWATCH = (process.env.ANIWATCH_URLS || 'https://aniwatch-api-v1-0.onrender.com,https://aniwatch.up.railway.app')
  .split(',').map(s => s.trim().replace(/\/+$/, '')).filter(Boolean);
const CONSUMET = (process.env.CONSUMET_URLS || 'https://api.consumet.org')
  .split(',').map(s => s.trim().replace(/\/+$/, '')).filter(Boolean);
const UA = 'Mozilla/5.0 (SMART-TV; Tizen 6.5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/85.0 TV Safari/537.36';

const MEDIA_FIELDS = `id title{romaji english native} coverImage{extraLarge large} description(asHtml:false)
  episodes format seasonYear averageScore status`;

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
    if (!r.ok) throw new Error(`${r.status} ${url}`);
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
    titleNative: m.title.romaji,
    cover: m.coverImage.extraLarge || m.coverImage.large,
    description: (m.description || '').replace(/<[^>]+>/g, '').trim(),
    episodes: m.episodes,
    format: m.format,
    year: m.seasonYear,
    score: m.averageScore ? (m.averageScore / 10).toFixed(1) : null,
  };
}
async function trending() {
  const d = await anilist(`query{Page(perPage:30){media(type:ANIME,sort:TRENDING_DESC,isAdult:false){${MEDIA_FIELDS}}}}`, {});
  return d.Page.media.map(mapMedia);
}
async function search(q) {
  const d = await anilist(`query($s:String){Page(perPage:30){media(type:ANIME,search:$s,sort:SEARCH_MATCH,isAdult:false){${MEDIA_FIELDS}}}}`, { s: q });
  return d.Page.media.map(mapMedia);
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
    .filter(t => t && (t.url || t.file) && (!t.kind || t.kind === 'captions' || t.kind === 'subtitles') && /english/i.test(t.lang || t.label || ''))
    .map(t => ({ lang: 'English', url: t.url || t.file, default: !!t.default }));
}
function pickSource(sources) {
  const list = sources || [];
  return list.find(s => s.isM3U8 || /m3u8/.test(s.url)) || list[0];
}

async function viaAniwatch(base, titles, ep) {
  const s = await fetchJson(`${base}/api/v2/hianime/search?q=${encodeURIComponent(titles[0])}`);
  const animes = (s.data && s.data.animes) || [];
  const hit = bestMatch(animes, titles, a => a.name);
  if (!hit) throw new Error('no match');
  const e = await fetchJson(`${base}/api/v2/hianime/anime/${encodeURIComponent(hit.id)}/episodes`);
  const episode = ((e.data && e.data.episodes) || []).find(x => x.number === ep);
  if (!episode) throw new Error('episode not found');
  const src = await fetchJson(`${base}/api/v2/hianime/episode/sources?animeEpisodeId=${encodeURIComponent(episode.episodeId)}&category=sub`);
  const d = src.data;
  const pick = pickSource(d.sources);
  if (!pick) throw new Error('no sources');
  return { url: pick.url, headers: d.headers || {}, subtitles: pickSubtitles(d.tracks) };
}
async function viaConsumet(base, titles, ep) {
  const s = await fetchJson(`${base}/anime/gogoanime/${encodeURIComponent(titles[0])}`);
  const hit = bestMatch((s.results || []).filter(r => !/dub/i.test(r.id + r.title)), titles, a => a.title);
  if (!hit) throw new Error('no match');
  const info = await fetchJson(`${base}/anime/gogoanime/info/${encodeURIComponent(hit.id)}`);
  const episode = (info.episodes || []).find(x => Number(x.number) === ep);
  if (!episode) throw new Error('episode not found');
  const d = await fetchJson(`${base}/anime/gogoanime/watch/${encodeURIComponent(episode.id)}`);
  const pick = pickSource(d.sources);
  if (!pick) throw new Error('no sources');
  return { url: pick.url, headers: d.headers || {}, subtitles: [] }; // gogoanime sub = softsub/hardsub English
}

async function sources(req, q, origin) {
  const titles = [q.title, q.alt].filter(Boolean);
  const ep = parseInt(q.ep, 10) || 1;
  if (!titles.length) throw new Error('title required');
  const jobs = [
    ...ANIWATCH.map(b => () => viaAniwatch(b, titles, ep)),
    ...CONSUMET.map(b => () => viaConsumet(b, titles, ep)),
  ];
  const errors = [];
  for (const job of jobs) {
    try {
      const r = await job();
      const ref = (r.headers && (r.headers.Referer || r.headers.referer)) || '';
      const isHls = /m3u8/i.test(r.url);
      // Route through our proxy when the CDN demands a Referer (TV browsers can't set it)
      const url = ref ? `${origin}/api?action=proxy&ref=${encodeURIComponent(ref)}&url=${encodeURIComponent(r.url)}` : r.url;
      return { url, type: isHls ? 'hls' : 'mp4', subtitles: r.subtitles };
    } catch (e) { errors.push(e.message); }
  }
  const err = new Error('No provider returned a stream: ' + errors.join(' | '));
  err.status = 502;
  throw err;
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
  const proto = req.headers['x-forwarded-proto'] || 'https';
  const origin = `${proto}://${req.headers.host}`;
  try {
    switch (q.action) {
      case 'search':
        if (!q.q) return send(res, 400, { error: 'q required' }, 'no-store');
        return send(res, 200, { results: await search(q.q) });
      case 'sources':
        return send(res, 200, await sources(req, q, origin), 's-maxage=60');
      case 'proxy':
        return await proxy(req, res, q, origin);
      case 'trending':
      default:
        return send(res, 200, { results: await trending() });
    }
  } catch (e) {
    return send(res, e.status || 500, { error: e.message }, 'no-store');
  }
};
