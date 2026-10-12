#!/usr/bin/env node
// Repeatable source-discovery benchmark: measures time until the app would have a usable stream (the same retry/skip loop the
// app runs, one request at a time). Usage:  node tools/bench_sources.js [baseUrl] [shows=12] [reps=2]
// Compares the old behaviour (?turbo=0) with TurboScrape on the same deployment, interleaved.
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
  // A/B on the SAME deployment at the SAME time: `turbo=0` makes the backend behave like before TurboScrape (one source at a time,
  // full timeouts, no caching); the default is the new behaviour. Pairs alternate order so neither side is favoured by timing.
  const SC = ['cold', 'warm', 'animex-down', 'two-down'], MODES = { old: { turbo: '0' }, new: {} };
  const res = {}, fails = {}, calls = {};
  for (const sc of SC) for (const m of ['old', 'new']) { res[sc + m] = []; fails[sc + m] = 0; calls[sc + m] = []; }
  const note = (sc, m, r) => { res[sc + m].push(r.ms); calls[sc + m].push(r.calls); if (!r.ok) fails[sc + m]++; };
  let n = 0;
  for (let rep = 0; rep < REPS; rep++) {
    for (const mdl of media) {
      const ep = 1 + ((mdl.id + rep * 3) % 6), flip = (n++ % 2) === 1;
      const pair = async (sc, e, skip, twice) => {
        for (const m of (flip ? ['new', 'old'] : ['old', 'new'])) {
          note(sc, m, await discover(mdl, e, skip, MODES[m]));
          if (twice) note('warm', m, await discover(mdl, e, skip, MODES[m]));            // same request again immediately
        }
      };
      await pair('cold', ep, '', true);
      await pair('animex-down', ep + 6, 'animex');
      await pair('two-down', ep + 12, 'animex,anikoto');
    }
  }
  console.log(`bench ${BASE}  shows=${media.length} reps=${REPS}  (old = ?turbo=0, new = default; sequential requests; each sample = time until a usable stream)`);
  console.log('scenario       mode    n   median     p90      max   avg calls  failed');
  const med = a => pct(a, .5), p90 = a => pct(a, .9);
  for (const sc of SC) {
    for (const m of ['old', 'new']) {
      const a = res[sc + m], c = calls[sc + m];
      console.log(`${sc.padEnd(13)}  ${m.padEnd(4)} ${String(a.length).padStart(4)}  ${String(med(a)).padStart(6)}ms ${String(p90(a)).padStart(6)}ms ${String(Math.max(...a)).padStart(6)}ms   ${(c.reduce((x, y) => x + y, 0) / a.length).toFixed(2)}      ${fails[sc + m]}`);
    }
    const o = res[sc + 'old'], w = res[sc + 'new'];
    console.log(`               change: median ${((med(w) - med(o)) / med(o) * 100).toFixed(0)}%  p90 ${((p90(w) - p90(o)) / p90(o) * 100).toFixed(0)}%`);
  }
})().catch(e => { console.error(e); process.exit(1); });
