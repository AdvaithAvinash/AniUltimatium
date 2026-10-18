#!/usr/bin/env node
/* Checks which movie players open popup ads, so the app can tag them (docs/SOURCE_ADS.md has what was found and why it matters).
 *
 *   node tools/probe_ads.js static            scan each player's own scripts for ad-network code (needs only Node 18+)
 *   node tools/probe_ads.js browser           load each player in a real browser, click it like a viewer, count popups (needs playwright-core + a Chromium)
 *
 * Run it from a normal home connection: from a datacenter the players often refuse to load, which makes the result meaningless.
 * "browser" reports `loaded:false` when a player did not start, and you should not trust a 0 in that case.
 * Results are printed as JSON; copy sources that really open popups into ADS_KNOWN in public/main.js. */
'use strict';
const SOURCES = {
  cinesrc: 'https://cinesrc.st/embed/movie/550',
  vidfast: 'https://vidfast.vc/movie/tt0137523',
  vidcore: 'https://vidcore.io/movie/tt0137523',
  videasy: 'https://player.videasy.to/movie/550',
  vidlink: 'https://vidlink.pro/movie/550',
  vidsrc: 'https://vidsrc.xyz/embed/movie?tmdb=550',
  '111movies': 'https://111movies.com/movie/550',
  godrive: 'https://godriveplayer.com/player.php?imdb=tt0137523',
};
const AD_NETWORKS = ['adsterra', 'propellerads', 'propeller-tracking', 'exoclick', 'juicyads', 'clickadu', 'hilltopads', 'monetag', 'trafficjunky', 'adcash', 'popcash', 'popads', 'onclickads', 'onclasrv', 'a-ads', 'admaven', 'richads', 'pushhouse', 'trafficstars', 'realsrv', 'tsyndicate', 'clickaine', 'mgid', 'revcontent', 'yllix', 'adskeeper', 'plugrush', 'adspyglass', 'popunder', 'pop-under', 'profitableratecpm', 'highperformanceformat', 'effectivegatecpm', 'cpmrevenuegate', 'wpnsrv', 'pemsrv'];
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120 Safari/537.36';
// Google's own analytics/tag code mentions doubleclick and googlesyndication: that is tracking, not popup ads, so it is reported separately
const GOOGLE = ['doubleclick', 'googlesyndication', 'googleadservices'];

async function get(u) { const r = await fetch(u, { headers: { 'User-Agent': UA, Accept: '*/*' }, redirect: 'follow' }); return { status: r.status, text: await r.text(), url: r.url }; }

async function scanStatic() {
  const out = {};
  for (const [name, url] of Object.entries(SOURCES)) {
    try {
      const page = await get(url), base = new URL(page.url);
      const srcs = new Set([...page.text.matchAll(/<script[^>]+src=["']([^"']+)["']/g)].map(m => new URL(m[1], base).href));
      for (const m of page.text.matchAll(/["'](\/_next\/static\/[^"']+\.js)["']/g)) srcs.add(new URL(m[1], base).href);
      let blob = page.text, n = 0;
      for (const s of [...srcs].slice(0, 40)) { try { blob += '\n' + (await get(s)).text; n++; } catch (e) { /* skip */ } }
      const low = blob.toLowerCase();
      out[name] = { status: page.status, scriptsScanned: n, kbScanned: Math.round(blob.length / 1024),
        adNetworksFound: AD_NETWORKS.filter(a => low.includes(a)), googleTagReferences: GOOGLE.filter(a => low.includes(a)),
        windowOpenCalls: (blob.match(/window\.open\(/g) || []).length };
    } catch (e) { out[name] = { error: String(e.message) }; }
  }
  return out;
}

async function scanBrowser() {
  let chromium; try { chromium = require('playwright-core').chromium; } catch (e) { throw new Error('browser mode needs playwright-core (npm i playwright-core) and a Chromium (set CHROMIUM=/path/to/chrome)'); }
  const b = await chromium.launch({ executablePath: process.env.CHROMIUM || undefined, args: ['--no-sandbox'] });
  const out = {};
  for (const [name, url] of Object.entries(SOURCES)) {
    const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, ignoreHTTPSErrors: true });
    const r = { loaded: false, popupTabs: 0, windowOpenCalls: 0, adHosts: [] };
    let mine = null;
    await ctx.addInitScript(() => { window.__opens = 0; window.open = function () { try { window.top.__opens = (window.top.__opens || 0) + 1; } catch (e) { window.__opens++; } return null; }; });
    ctx.on('page', pg => { if (mine && pg !== mine) { r.popupTabs++; pg.close().catch(() => {}); } });
    const p = await ctx.newPage(); mine = p;
    p.on('request', q => { try { const h = new URL(q.url()).hostname; if (AD_NETWORKS.some(a => h.includes(a.replace(/[^a-z0-9]/g, '')) || h.includes(a))) r.adHosts.push(h); } catch (e) { /* ignore */ } });
    try {
      await p.route('https://tools.invalid/probe', route => route.fulfill({ contentType: 'text/html', body: '<body style="margin:0"><iframe id=f src="' + url + '" style="width:1280px;height:720px;border:0" allow="autoplay; fullscreen" allowfullscreen></iframe></body>' }));
      await p.goto('https://tools.invalid/probe', { waitUntil: 'commit' });
      await p.waitForTimeout(10000);
      const frame = p.frames().find(f => f !== p.mainFrame());
      r.loaded = !!frame && !/^chrome-error:/.test(frame.url()) && frame.url() !== '';
      for (let i = 0; i < 5; i++) { await p.mouse.click(640, 360); await p.waitForTimeout(1800); }
      r.windowOpenCalls = await p.evaluate(() => window.__opens || 0);
    } catch (e) { r.error = String(e.message).slice(0, 120); }
    r.adHosts = [...new Set(r.adHosts)]; out[name] = r;
    await ctx.close();
  }
  await b.close();
  return out;
}

(async () => {
  const mode = process.argv[2];
  if (mode !== 'static' && mode !== 'browser') { console.log('usage: node tools/probe_ads.js static|browser'); process.exit(1); }
  console.log(JSON.stringify(await (mode === 'static' ? scanStatic() : scanBrowser()), null, 2));
})().catch(e => { console.error(e.message); process.exit(1); });
