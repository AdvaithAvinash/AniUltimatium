'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const read = f => fs.readFileSync(path.join(__dirname, '..', f), 'utf8');

test('Torrentio, Comet and Peerflix are preinstalled, on by default, switchable', () => {
  const m = read('public/main.js');
  assert.ok(m.includes('https://torrentio.strem.fun/qualityfilter=480p,720p,other/manifest.json'));
  assert.ok(m.includes('https://addon.peerflix.mov/manifest.json'));
  const c = m.match(/https:\/\/comet\.elfhosted\.com\/([^/']+)\/manifest\.json/);
  assert.ok(c); const cfg = JSON.parse(Buffer.from(c[1], 'base64').toString());
  assert.strictEqual(cfg.removeTrash, true);
  assert.ok(/function preState\(id\)[^}]*'on'/.test(m) && /already preinstalled/.test(m));
});

test('Stremio account sign-in runs in the phone browser and reaches the TV through the pairing box (no KV writes)', () => {
  const h = read('public/add.html'), a = read('api/index.js');
  assert.ok(h.includes("api.strem.io/api/") && h.includes('AddonCollectionGet'));
  assert.ok(!/pair_put'[\s\S]{0,200}password/.test(h));
  assert.ok(a.includes("b.kind === 'stremio'"));
  assert.ok(read('wrangler.jsonc').includes('PairBox'));
});

test('AniUltimatium Lite: own entry page and package, only non-pirate preinstalled add-ons, no hosted players', () => {
  const m = read('public/main.js'), mv = read('lib/movies.js');
  assert.ok(/var ED_LITE = !!window\.EA_LITE/.test(m));
  const lite = m.slice(m.indexOf('var PRE = ED_LITE ? ['), m.indexOf('] : [', m.indexOf('var PRE = ED_LITE ? [')));
  ['v3-cinemeta.strem.io', 'watchhub.strem.io', 'opensubtitles-v3.strem.io', 'submaker.elfhosted.com'].forEach(u => assert.ok(lite.includes(u), u));
  ['torrentio', 'comet', 'peerflix', 'publicdomain'].forEach(u => assert.ok(!lite.includes(u), u));
  const lj = read('lib/lite.js'); assert.ok(!/require\('\.\/movies'\)|EMBEDS|vidsrc|2embed|videasy|viaArchive/i.test(lj.replace(/^\/\/.*$/mg, '')), 'lib/lite.js uses no hosted players, scrapers or built-in catalogue');
  assert.ok(m.includes("action: 'lite_sources'") && read('api/index.js').includes("case 'lite_sources'"));
  const lv = read('public/live.js'); assert.ok(lv.includes("window.EA_LITE && o[0] === 'free'"));
  const b = read('tools/build_wgt.py'); assert.ok(b.includes('--lite') && b.includes('AnUltLite1'));
});

test('Direct stream page, P2P switch (on by default), tutorial and Watch on phone exist', () => {
  const m = read('public/main.js'), h = read('public/index.html');
  assert.ok(h.includes('id="viewDirect"') && h.includes('id="dPhone"') && h.includes('id="setTour"'));
  assert.ok(/function p2pOn\(\) \{ return store\.get\('ea_p2p', true\) !== false; \}/.test(m));
  assert.ok(/function tourShow\(/.test(m) && /function phoneBoot\(/.test(m) && /function directPlay\(/.test(m));
  assert.ok(m.includes("'\u2714 Fast mode: On'") || m.includes('Fast mode: On'));
});

test('Lite: mandatory sign-in gate after the tutorial, random / first / chosen add-on, side-rail look, no sponsor ads', () => {
  const m = read('public/main.js'), c = read('public/styles.css'), l = read('lib/lite.js');
  assert.ok(/function liteGate\(\)/.test(m) && /ea_lite_linked/.test(m));
  assert.ok(/if \(ED_LITE && !store\.get\('ea_lite_linked', false\) && !store\.get\('ea_lite_skipped', false\)\) \{ state\.view = state\.tab; liteGate\(\); return; \}/.test(m), 'the gate follows the tutorial');
  assert.ok(/id=\"gSkip\"[^>]*>Skip for now/.test(m) && /ea_lite_skipped/.test(m), 'Skip for now');
  assert.ok(/function litePick\(\)/.test(m) && /Math\.random\(\)/.test(m) && /\['rand', 'Random add-on'/.test(m) && /\['first', 'First in list'/.test(m));
  assert.ok(/pick: lp\.url/.test(m) && /q\.pick/.test(l) && /strict/.test(l));
  assert.ok(m.includes("store.set('ea_ui', 'modern')") && /body\.ed-lite\.ui-modern #heroCount/.test(c) && /#gate\{/.test(c));
  assert.ok(/window\.EA_LITE \|\| ad/.test(read('public/sponsor.js')));
});
