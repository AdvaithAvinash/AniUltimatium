'use strict';
// Cinematic look (Apple TV style): the setting, the floating top bar, the hero, the wide Continue Watching cards, the look picker.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');

test('Look setting: Classic, Modern and Cinematic; Cinematic adds both body classes but navigates like Classic', () => {
  const main = read('public/main.js');
  assert.match(main, /\['classic', 'Classic · low-end devices'\], \['modern', 'Modern · better looking'\], \['cine', 'Cinematic · Apple TV style'\]/);
  assert.match(main, /var UI_CINE = store\.get\('ea_ui', 'classic'\) === 'cine';/);
  assert.match(main, /var UI_MODERN = store\.get\('ea_ui', 'classic'\) === 'modern';/, 'the side-rail navigation stays Modern only');
  assert.match(main, /\(UI_MODERN \|\| UI_CINE \? ' ui-modern' : ''\) \+ \(UI_CINE \? ' ui-cine' : ''\)/);
  assert.match(main, /UI_MODERN = v === 'modern'; UI_CINE = v === 'cine';/);
});

test('Cinematic hero: one meta line ("Movie • Horror • 1h 35m • 2026 • IMDb 7.5"), View Details, Left / Right on the hero buttons flip titles, arrows click', () => {
  const main = read('public/main.js'), html = read('public/index.html');
  assert.match(main, /movie \? \(isTv\(a\) \? 'TV Show' : 'Movie'\) : 'Anime'/);
  assert.match(main, /'<span class="imdb"><b>IMDb<\/b>'/);
  assert.match(main, /UI_CINE \? 'View Details' : 'More Info'/);
  assert.match(main, /if \(dir === 'left' && cur === \$\('heroPlay'\)\) \{ stepHero\(-1\); return; \}/);
  assert.match(main, /if \(dir === 'right' && cur === \$\('heroInfo'\)\) \{ stepHero\(1\); return; \}/);
  assert.match(html, /id="heroArrows"><button class="harr" data-hd="-1"[^>]*>&#8249;<\/button><button class="harr" data-hd="1"/);
  assert.match(main, /heroTitle'\)\.textContent = tname\(a\);\n\s+if \(UI_CINE\)/, 'the title is set in every look');
});

test('Cinematic rows: "52m left" on Continue Watching, wide pictures (banner first), runtimes as 1h 49m', () => {
  const main = read('public/main.js');
  const fn = name => new Function('return ' + new RegExp('function ' + name + '\\([^)]*\\) \\{[\\s\\S]*?\\n  \\}').exec(main)[0].replace('function ' + name, 'function'))();
  const runtimeOf = fn('runtimeOf'), leftLabel = fn('leftLabel');
  assert.strictEqual(runtimeOf('109 min'), '1h 49m'); assert.strictEqual(runtimeOf('95 min'), '1h 35m'); assert.strictEqual(runtimeOf('45 min'), '45m'); assert.strictEqual(runtimeOf(''), '');
  assert.strictEqual(leftLabel(52 * 60), '52m left'); assert.strictEqual(leftLabel(93 * 60), '1h 33m left'); assert.strictEqual(leftLabel(10), '1m left');
  assert.match(main, /UI_CINE && extra\.dur > 60 \? leftLabel\(extra\.dur - extra\.time\)/);
  assert.match(main, /if \(UI_CINE && extra && extra\.cont && a\.banner\) lazyImg\(img, a\.banner, a\.cover\);/);
});

test('Cinematic styles: floating centred pill bar with icon tabs (name on the active / focused one), blur with a solid fallback, old-engine fallbacks', () => {
  const css = read('public/styles.css');
  assert.match(css, /body\.ui-cine #nav\{top:1\.3rem;[^}]*left:50%;[^}]*border-radius:2\.2rem/);
  assert.match(css, /@supports \(\(-webkit-backdrop-filter:blur\(1px\)\) or \(backdrop-filter:blur\(1px\)\)\)\{body\.ui-cine #nav\{/);
  assert.match(css, /body\.ui-cine \.tab \.tl\{display:none/);
  assert.match(css, /body\.ui-cine \.tab\.active \.tl,body\.ui-cine \.tab\.focused \.tl\{display:inline\}/);
  assert.match(css, /body\.ui-cine \.row\.cont \.card\{width:25rem\}/);
  assert.match(css, /\.noar body\.ui-cine \.row\.cont \.poster\{height:0;padding-top:56\.25%\}/, 'Tizen 4 has no aspect-ratio');
  assert.ok(!/body\.ui-cine[^{]*\{[^}]*(inset:|aspect-ratio:\s*16)/.test(css.split('/* ===== Old-engine')[0]), 'no Chromium-57+ only CSS in the look');
});

test('Look picker on first start offers Cinematic', () => {
  const start = read('public/start.js'), css = read('public/styles.css');
  assert.match(start, /card\('cine', 'Cinematic', 'Apple TV style · newer TVs'/);
  assert.match(start, /screen\(\[\[cl, mo, ci\]\]/);
  assert.match(css, /\.mock\.cine \.m-hero/);
});

test('Cinematic settings: three-pane layout (categories, options, explanation) is built', () => {
  const m = require('fs').readFileSync(require('path').join(__dirname, '..', 'public', 'main.js'), 'utf8');
  const css = require('fs').readFileSync(require('path').join(__dirname, '..', 'public', 'styles.css'), 'utf8');
  assert.ok(/function cineSettings\(/.test(m) && /function cineMove\(/.test(m) && /id = 'setInfo'/.test(m));
  assert.ok(/body\.ui-cine #setRail/.test(css) && /body\.ui-cine #setInfo/.test(css));
});
