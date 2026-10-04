// English subtitles from OpenSubtitles (keyless access through Stremio's OpenSubtitles v3 endpoint — a data
// service only; no Stremio addon is used for playback). Returns every major language available for a title/episode.
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

// OpenSubtitles 3-letter codes -> the 2-letter codes the app uses
const LANG = { eng: 'en', jpn: 'ja', mal: 'ml', hin: 'hi', tam: 'ta', tel: 'te', kan: 'kn', ben: 'bn', spa: 'es', fre: 'fr', ger: 'de', ara: 'ar', pob: 'pt', por: 'pt',
  rus: 'ru', ita: 'it', kor: 'ko', zho: 'zh', zht: 'zh', zhe: 'zh', ind: 'id', tur: 'tr', vie: 'vi', may: 'ms', per: 'fa', pol: 'pl', dut: 'nl', tha: 'th' };

// id: "tt0137523" (movie) or "tt21209876:1:3" (series imdb:season:episode).
// Returns every major language that exists (English up to 6 files, others up to 2), English / Japanese / Malayalam first.
async function list(id) {
  const type = id.includes(':') ? 'series' : 'movie';
  const d = await jget(`https://opensubtitles-v3.strem.io/subtitles/${type}/${encodeURIComponent(id)}.json`);
  const seen = new Set(), n = {}, out = [];
  for (const s of (d.subtitles || [])) {
    const code = LANG[s.lang];
    if (!code || !s.url || seen.has(s.url)) continue;
    const cap = code === 'en' ? 6 : 2;
    if ((n[code] || 0) >= cap) continue;
    seen.add(s.url); n[code] = (n[code] || 0) + 1;
    out.push({ id: s.id, lang: code, release: String(s.movieReleaseName || s.subtitleFileName || '').slice(0, 80), url: s.url });
  }
  const order = { en: 0, ja: 1, ml: 2, hi: 3, ta: 4, te: 5 };
  return out.sort((a, b) => (order[a.lang] ?? 9) - (order[b.lang] ?? 9));
}

module.exports = { list };
