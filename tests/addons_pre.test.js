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
