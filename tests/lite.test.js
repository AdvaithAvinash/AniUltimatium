'use strict';
// AniUltimatium Lite: how a stream is found (lib/lite.js): all add-ons at once, ranked candidates, the best checked links win, skip / only / pick
const test = require('node:test');
const assert = require('node:assert');
const http = require('node:http');
const lite = require('../lib/lite');

function addon(streams, delay) {
  return new Promise(res => { const s = http.createServer((req, r) => { r.setHeader('content-type', 'application/json'); setTimeout(() => r.end(typeof streams === 'function' ? streams(req.url) : JSON.stringify({ streams })), delay || 0); });
    s.listen(0, '127.0.0.1', () => res({ s, url: 'http://127.0.0.1:' + s.address().port })); });
}
const q = (urls, extra) => Object.assign({ id: 'tt0137523', addons: JSON.stringify(urls.map(u => u)), names: JSON.stringify(urls.map((u, i) => 'A' + i)) }, extra);

test('candidates: size, seeders, tags are read; cam is dropped; a torrent needs a debrid account or P2P', () => {
  assert.strictEqual(lite.sizeOf('💾 2.4 GB ⚙️ x'), Math.round(2.4 * 1073741824));
  assert.strictEqual(lite.seedsOf('👤 123 💾 1 GB'), 123);
  assert.strictEqual(lite.candidate({ name: 'X CAM', url: 'https://x/a.mp4' }, 'u', 'A', 0, 0), null);
  const c = lite.candidate({ name: 'T 1080p', title: 'Movie.2020.1080p.HDR\n👤 50 💾 3 GB', infoHash: 'abc' }, 'u', 'A', 0, 0);
  assert.strictEqual(c.kind, 'torrent'); assert.deepStrictEqual(c.tags, ['HDR']); assert.strictEqual(c.res, 1080);
  assert.strictEqual(lite.candidate({ name: 'x', externalUrl: 'https://x' }, 'u', 'A', 0, 0), null);
});

test('finder: a broken and a slow add-on do not stop the good one; the best checked stream wins; the list is returned', async () => {
  process.env.ALLOW_PRIVATE_ADDONS = '1';
  const bad = await addon(() => 'not json'), slow = await addon([{ name: 'S 720p', url: 'https://slow.example/a.mp4' }], 300);
  const good = await addon([{ name: 'G 1080p', url: 'https://cdn.example/g1080.mp4' }, { name: 'G 720p', url: 'https://cdn.example/g720.mp4' }]);
  try {
    const checked = [];
    const verify = async c => { checked.push(c.url); if (/g1080/.test(c.url)) throw new Error('dead'); return c; };       // the best one is dead: the next one in rank order wins
    const r = await lite.sources(q([bad.url, slow.url, good.url]), { verify });
    assert.ok(r.direct && /g720|slow/.test(r.direct.url), r.direct && r.direct.url);
    assert.ok(r.list.length >= 3, 'the whole ranked list goes back');
    assert.strictEqual(r.unverified, false);
    assert.ok(r.perAddon.some(p => p.n === 0) && r.perAddon.some(p => p.n >= 2));
    // skip: what already failed on the TV is not offered again
    const skipId = r.list.find(x => /1080/.test(String(x.res))).id;
    const r2 = await lite.sources(q([bad.url, slow.url, good.url], { skip: skipId }), { verify: async c => c });
    assert.notStrictEqual(r2.chosen.id, skipId);
    // only: the entry the viewer chose on the Sources sheet
    const r3 = await lite.sources(q([bad.url, slow.url, good.url], { only: skipId }), { verify: async c => c });
    assert.strictEqual(r3.chosen.id, skipId);
    // pick + strict: just that add-on
    const r4 = await lite.sources(q([bad.url, slow.url, good.url], { pick: slow.url, strict: '1' }), { verify: async c => c });
    assert.match(r4.direct.url, /slow/);
  } finally { [bad, slow, good].forEach(x => x.s.close()); }
});

test('finder: when the server cannot check a link the best direct stream is still handed over, marked unverified', async () => {
  process.env.ALLOW_PRIVATE_ADDONS = '1';
  const a = await addon([{ name: 'A 1080p', url: 'https://cdn.example/a.mp4' }]);
  try {
    const r = await lite.sources(q([a.url]), { verify: async () => { throw new Error('blocked from the server'); } });
    assert.ok(r.direct && r.unverified === true);
  } finally { a.s.close(); }
});

test('finder: torrent-only titles need debrid or P2P, and say so', async () => {
  process.env.ALLOW_PRIVATE_ADDONS = '1';
  const t = await addon([{ name: 'T 1080p', infoHash: 'aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' }]);
  try {
    await assert.rejects(lite.sources(q([t.url]), { verify: async c => c }), /debrid/i);
    const r = await lite.sources(q([t.url], { p2p: '1' }), { verify: async c => c });
    assert.strictEqual(r.direct, null); assert.strictEqual(r.torrents.length, 1);
  } finally { t.s.close(); }
});

test('Lite client: Best source is the default, Sources sheet, automatic next source, source line in the player', () => {
  const fs = require('fs'), m = fs.readFileSync(require('path').join(__dirname, '..', 'public/main.js'), 'utf8'), h = fs.readFileSync(require('path').join(__dirname, '..', 'public/index.html'), 'utf8');
  assert.ok(/\['best', 'Best source'/.test(m) && /store\.get\('ea_msrc', 'best'\)/.test(m));
  assert.ok(/function openSources\(\)/.test(m) && /function chooseSource\(\)/.test(m) && /state\.liteOnly = x\.id/.test(m) && /only: lonly/.test(m));
  assert.ok(/function liteAdvance\(/.test(m) && /if \(ED_LITE && liteAdvance\('stopped'\)\) return true;/.test(m));
  assert.ok(h.includes('data-act="sources"') && h.includes('id="pSub"'));
});

test('Direct stream: Samsung player first, the server relay as the second route (no-CORS hosts), address sniffing, relay accepts hls=1', () => {
  const fs = require('fs'), p = require('path'), r = f => fs.readFileSync(p.join(__dirname, '..', f), 'utf8');
  const m = r('public/main.js'), avp = r('public/avp.js'), api = r('api/index.js');
  assert.ok(/function directSrc\(u\)/.test(m) && /proxyUrl: mixed \? '' : px/.test(m));
  assert.ok(/AVP\.prefer\(!!a\.direct\)/.test(m) && /prefer: function \(v\) \{ prefer = !!v; \}/.test(avp) && /m !== 'html5' && \(m === 'avplay' \|\| prefer/.test(avp));
  assert.ok(/provider === 'direct' && !state\.triedProxy && \/manifestLoad\|levelLoad\//.test(m), 'a manifest the browser cannot read goes to the relay at once');
  assert.ok(/d\.type === 'auto' && window\.fetch/.test(m) && /q\.hls === '1'/.test(api));
  assert.ok(!/addHist\(a, ep\); autoStatus\(a, ep, false\); \}/.test(m.replace('!a.direct', 'X')) || /!keepVia && !a\.direct/.test(m), 'direct streams are not added to History');
});
