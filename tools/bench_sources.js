#!/usr/bin/env node
// Repeatable source-discovery benchmark: measures time until the app would have a usable stream (the same retry/skip loop the
// app runs, one request at a time). Usage:  node tools/bench_sources.js [baseUrl] [shows=12] [reps=2]
// Scenarios: cold (fresh episode), warm (same request again), animex-down (skip=animex), two-down (skip=animex,anikoto).
// "down" scenarios simulate a failing primary source with ?skip=, exactly what the app sends after a source fails to play.
const BASE = (process.argv[2] || 'https://aniultimatium.advaithavinash404.workers.dev').replace(/\/+$/, '');
const SHOWS = parseInt(process.argv[3] || '12', 10), REPS = parseInt(process.argv[4] || '2', 10);
const F = 'id idMal title{english romaji native} status format episodes seasonYear startDate{year month day} genres synonyms nextAiringEpisode{episode airingAt timeUntilAiring}';
const pct = (a, p) => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : NaN; };
const jget = async (u, to = 60000) => { const t0 = Date.now(); const r = await fetch(u, { signal: AbortSignal.timeout(to) }); const j = await r.json().catch(() => ({})); return { ms: Date.now() - t0, j, status: r.status }; };
async function discover(m, ep, skip0, extra) {                       // emulates the app: follow retry/skip until a stream (or a final failure)
  const title = m.title.english || m.title.romaji;
  let skip = skip0 || '', calls = 0, ms = 0, key = null, ok = false, trace = null;
  while (calls < 8) {
    calls++;
    const q = new URLSearchParams({ action: 'sources', id: m.id, title, alt: m.title.romaji, syn: (m.synonyms || []).join('|').slice(0, 300), ep, skip, am: JSON.stringify(m), ...(extra || {}) });
    const r = await jget(BASE + '/api?' + q); ms += r.ms;
    if (r.j.url) { ok = true; key = r.j.key; break; }
    if (r.j.retry && r.j.skip) { skip = r.j.skip; continue; }
    break;
  }
  return { ms, calls, ok, key };
}
(async () => {
  const al = await fetch('https://graphql.anilist.co', { method: 'POST', headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ query: `query{Page(perPage:${SHOWS}){media(type:ANIME,sort:POPULARITY_DESC,isAdult:false,format_in:[TV]){${F}}}}` }) }).then(r => r.json());
  const media = al.data.Page.media;
  const res = { cold: [], warm: [], 'animex-down': [], 'two-down': [] }, fails = { cold: 0, warm: 0, 'animex-down': 0, 'two-down': 0 }, calls = { cold: [], warm: [], 'animex-down': [], 'two-down': [] };
  const note = (k, r) => { res[k].push(r.ms); calls[k].push(r.calls); if (!r.ok) fails[k]++; };
  for (let rep = 0; rep < REPS; rep++) {
    for (const m of media) {
      const ep = 1 + ((m.id + rep * 3) % 6);                            // varies per rep so nothing is cached by an earlier rep
      note('cold', await discover(m, ep, ''));
      note('warm', await discover(m, ep, ''));
      note('animex-down', await discover(m, ep + 6, 'animex'));
      note('two-down', await discover(m, ep + 12, 'animex,anikoto'));
    }
  }
  console.log(`bench ${BASE}  shows=${media.length} reps=${REPS} (sequential, each sample = time until a usable stream)`);
  console.log('scenario      n   median   p90     max    avg calls  failed');
  for (const k of Object.keys(res)) {
    const a = res[k];
    console.log(`${k.padEnd(12)} ${String(a.length).padStart(3)}  ${String(pct(a, .5)).padStart(6)}ms ${String(pct(a, .9)).padStart(6)}ms ${String(Math.max(...a)).padStart(6)}ms  ${(calls[k].reduce((x, y) => x + y, 0) / a.length).toFixed(2)}      ${fails[k]}`);
  }
})().catch(e => { console.error(e); process.exit(1); });
