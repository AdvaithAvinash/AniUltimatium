'use strict';
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const movies = require('../lib/movies');

test('2Embed, SuperEmbed, VidSrc.to and VidSrc.me: movie and episode addresses; Auto tries them after the first four; VidLink stays optional', async () => {
  const real = global.fetch;
  global.fetch = () => Promise.resolve(new Response(JSON.stringify({ meta: { moviedb_id: 550 } }), { status: 200, headers: { 'content-type': 'application/json' } }));
  try {
    const m = await movies.sources({ id: 'tt0137523', title: 'x' });
    const by = Object.fromEntries(m.embeds.map(e => [e.key, e.url]));
    assert.strictEqual(by['2embed'], 'https://www.2embed.cc/embed/550');
    assert.strictEqual(by.superembed, 'https://multiembed.mov/?video_id=tt0137523');
    assert.strictEqual(by.vidsrcto, 'https://vidsrc.to/embed/movie/550');
    assert.strictEqual(by.vidsrcme, 'https://vidsrc.me/embed/movie?tmdb=550');
    const keys = m.embeds.map(e => e.key);
    assert.ok(keys.indexOf('videasy') < keys.indexOf('2embed') && keys.indexOf('2embed') < keys.indexOf('vidsrcme') && !keys.includes('vidlink'), keys.join());
    const t = await movies.sources({ id: 'tt0944947', type: 'series', s: '2', e: '3', title: 'x' });
    const tv = Object.fromEntries(t.embeds.map(e => [e.key, e.url]));
    assert.strictEqual(tv['2embed'], 'https://www.2embed.cc/embedtv/550&s=2&e=3');
    assert.strictEqual(tv.superembed, 'https://multiembed.mov/?video_id=tt0944947&s=2&e=3');
    assert.strictEqual(tv.vidsrcto, 'https://vidsrc.to/embed/tv/550/2/3');
    assert.strictEqual(tv.vidsrcme, 'https://vidsrc.me/embed/tv?tmdb=550&season=2&episode=3');
    const pick = await movies.sources({ id: 'tt0137523', title: 'x', via: 'vidsrcto' });
    assert.strictEqual(pick.embeds[0].key, 'vidsrcto', 'a picked source goes first');
  } finally { global.fetch = real; }
});

test('hosted players run in a sandboxed frame without popups or top navigation, with a setting to turn it off', () => {
  const main = fs.readFileSync(path.join(__dirname, '../public/main.js'), 'utf8');
  const sb = /var SANDBOX = '([^']+)'/.exec(main)[1];
  assert.ok(/allow-scripts/.test(sb) && /allow-same-origin/.test(sb) && /allow-presentation/.test(sb));
  assert.ok(!/allow-popups|allow-top-navigation|allow-modals/.test(sb), 'popups, top navigation and alert dialogs stay blocked');
  assert.match(main, /f\.setAttribute\('sandbox', SANDBOX\)/); assert.match(main, /'ea_popblock'/);
});
