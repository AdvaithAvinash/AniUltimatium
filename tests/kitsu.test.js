'use strict';
// Kitsu backup catalogue (used when AniList refuses the server): results must carry AniList ids and the app's card shape.
const test = require('node:test');
const assert = require('node:assert');
const kitsu = require('../lib/kitsu');

const answer = {
  data: [
    { id: '46474', type: 'anime', attributes: { canonicalTitle: 'Sousou no Frieren', titles: { en: 'Frieren: Beyond Journey’s End', en_jp: 'Sousou no Frieren' }, synopsis: 'An elf mage.', posterImage: { large: 'https://media.kitsu.app/p/large.jpg', medium: 'https://media.kitsu.app/p/medium.jpg' }, coverImage: { large: 'https://media.kitsu.app/c/large.jpg' }, episodeCount: 28, averageRating: '90.5', startDate: '2023-09-29', subtype: 'TV', status: 'finished' },
      relationships: { mappings: { data: [{ type: 'mappings', id: 'm1' }, { type: 'mappings', id: 'm2' }] }, categories: { data: [{ type: 'categories', id: 'c1' }] } } },
    { id: '1', type: 'anime', attributes: { canonicalTitle: 'No AniList id', titles: {} }, relationships: { mappings: { data: [] } } },
  ],
  included: [
    { type: 'mappings', id: 'm1', attributes: { externalSite: 'anilist/anime', externalId: '154587' } },
    { type: 'mappings', id: 'm2', attributes: { externalSite: 'myanimelist/anime', externalId: '52991' } },
    { type: 'categories', id: 'c1', attributes: { title: 'Fantasy' } },
  ],
};

test('Kitsu results become anime cards with AniList ids; shows without one are left out', () => {
  const r = kitsu.mapAll(answer);
  assert.strictEqual(r.length, 1);
  const a = r[0];
  assert.strictEqual(a.id, 154587); assert.strictEqual(a.mal, 52991); assert.strictEqual(a.kind, 'anime');
  assert.strictEqual(a.title, 'Frieren: Beyond Journey’s End'); assert.strictEqual(a.titleRomaji, 'Sousou no Frieren');
  assert.strictEqual(a.cover, 'https://media.kitsu.app/p/large.jpg'); assert.strictEqual(a.episodes, 28); assert.strictEqual(a.year, 2023);
  assert.strictEqual(a.status, 'FINISHED'); assert.strictEqual(a.score, '9.1'); assert.deepStrictEqual(a.genres, ['Fantasy']);
});

test('the server falls back to Kitsu for anime search and trending when AniList refuses it', () => {
  const src = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'api/index.js'), 'utf8');
  assert.match(src, /catch \(e\) \{ const k = await kitsu\.search\(q, genre\)/);
  assert.match(src, /catch \(e\) \{ const k = await kitsu\.trending\(\)/);
  const main = require('node:fs').readFileSync(require('node:path').join(__dirname, '..', 'public/main.js'), 'utf8');
  assert.match(main, /if \(\/\^\(search\|trending\)\$\/\.test\(params\.action\)\) return aniDirect\(params\)/, 'the device asks AniList first');
});
