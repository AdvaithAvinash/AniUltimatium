// English subtitles from OpenSubtitles (keyless access through Stremio's OpenSubtitles v3 endpoint — a data
// service only; no Stremio addon is used for playback). Returns up to 6 English + 3 Japanese candidates for a title/episode.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0';

async function jget(url, timeout = 15000) {
  const ctl = new AbortController();
  const t = setTimeout(() => ctl.abort(), timeout);
  try {
    const r = await fetch(url, { signal: ctl.signal, redirect: 'follow', headers: { 'User-Agent': UA, Accept: 'application/json' } });
    if (!r.ok) throw new Error('HTTP ' + r.status);
    return await r.json();
  } finally { clearTimeout(t); }
}

// id: "tt0137523" (movie) or "tt21209876:1:3" (series imdb:season:episode)
async function list(id) {
  const type = id.includes(':') ? 'series' : 'movie';
  const d = await jget(`https://opensubtitles-v3.strem.io/subtitles/${type}/${encodeURIComponent(id)}.json`);
  const seen = new Set(), out = [], n = { eng: 0, jpn: 0 }, cap = { eng: 6, jpn: 3 };
  for (const s of (d.subtitles || [])) {
    if (!(s.lang in cap) || !s.url || seen.has(s.url) || n[s.lang] >= cap[s.lang]) continue;
    seen.add(s.url); n[s.lang]++;
    out.push({ id: s.id, lang: s.lang, release: String(s.movieReleaseName || s.subtitleFileName || '').slice(0, 80), url: s.url });
  }
  return out;
}

module.exports = { list };
