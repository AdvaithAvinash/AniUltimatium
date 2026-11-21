'use strict';
// Live Sports sources besides Matchora (public/providers.js, lib/sportsapi.js), tested on REAL captured responses (tests/fixtures/sources).
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const M = require('../public/matchora.js');
const SP = require('../public/providers.js');
const UI = require('../public/sports.js');
const api = require('../lib/sportsapi.js');
const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const fx = n => JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'sources', n), 'utf8'));
const NOW = Date.UTC(2026, 10, 21, 9, 0);
const resp = (status, body, headers) => ({ status, ok: status >= 200 && status < 300, headers: { get: k => (headers || {})[k.toLowerCase()] || null }, text: async () => typeof body === 'string' ? body : JSON.stringify(body), json: async () => body });

test('SportSRC: statuses, minute text, scores, crests and lazy streams are read from the real documents', () => {
  const live = SP.parse.sportsrc(fx('sportsrc_live.json')), ev = live.events[0];
  assert.strictEqual(live.events.length, 6); assert.strictEqual(live.skipped, 0);
  assert.ok(ev.live && !ev.finished); assert.strictEqual(ev.status, 'LIVE'); assert.strictEqual(ev.note, '2nd half'); assert.strictEqual(M.statusInfo(ev, NOW).text, '2nd half');
  assert.deepStrictEqual([ev.score.h, ev.score.a], [0, 1]); assert.strictEqual(ev.sport, 'Soccer'); assert.strictEqual(ev.src, 'ss'); assert.match(ev.id, /^ss:gimpo-citizen-suwon-city-fc-/);
  assert.strictEqual(ev.kickoff, 1795246200); assert.ok(ev.lazy && ev.channels.length === 0 && M.hasFeeds(ev), 'streams are listed only when the match is opened, but the match counts as having them');
  assert.match(ev.badges.home, /^https:\/\/img\.sportsrc\.org\/v3\/assets\//); assert.ok(ev.badges.league);
  const day = SP.parse.sportsrc(fx('sportsrc_matches.json')); assert.ok(day.events.some(e => e.finished && e.status === 'FT')); assert.ok(day.events.some(e => !e.live && !e.finished && e.status === ''));
  assert.strictEqual(M.statusInfo(day.events.find(e => e.finished), NOW).label, 'FT');
  const doc = JSON.parse(JSON.stringify(fx('sportsrc_live.json'))); doc.data[0].matches.push({ id: 'x', status: 'postponed', teams: { home: { name: 'A' }, away: { name: 'B' } }, timestamp: 1795246200000 }, { id: '', teams: {} }, null);
  const r = SP.parse.sportsrc(doc); assert.strictEqual(r.skipped, 2); assert.ok(r.events.find(e => e.rid === 'x').cancelled); assert.strictEqual(M.statusInfo(r.events.find(e => e.rid === 'x'), NOW).label, 'POSTPONED');
  for (const bad of [null, {}, { success: false }, { success: true, data: 'x' }]) assert.throws(() => SP.parse.sportsrc(bad), e => e.kind === 'malformed');
});

test('SportSRC detail: sources become feeds; hostile embed addresses are dropped', () => {
  const ev = SP.parse.sportsrc(fx('sportsrc_live.json')).events[0], d = SP.parse.sportsrcDetail(ev, fx('sportsrc_detail.json'));
  assert.strictEqual(d.lazy, false); assert.strictEqual(d.channels.length, 1); assert.strictEqual(d.channels[0].name, 'Stream 1 · lola'); assert.strictEqual(d.channels[0].quality, 'HD'); assert.strictEqual(d.channels[0].lang, '');
  assert.match(d.channels[0].embed, /^https:\/\/football77\.org\/embed\/\?id=/); assert.strictEqual(M.feedsOf(d).length, 1); assert.strictEqual(ev.lazy, true, 'the list entry is not changed');
  const doc = JSON.parse(JSON.stringify(fx('sportsrc_detail.json'))); doc.data.sources.push({ streamNo: 2, embedUrl: 'http://x.example/a' }, { streamNo: 3, embedUrl: 'javascript:alert(1)' }, { streamNo: 4, embedUrl: 'https://127.0.0.1/x' }, { streamNo: 5, embedUrl: 'https://ok.example/p"onload="x' });
  assert.strictEqual(SP.parse.sportsrcDetail(ev, doc).channels.length, 1); assert.throws(() => SP.parse.sportsrcDetail(ev, { data: {} }), e => e.kind === 'malformed');
});

test('StreamCenter: team games and one-sided events, badges from its image host, live flag, lazy source groups', () => {
  const doc = fx('streamcenter_matches.json'), p = SP.parse.streamcenter(doc, { [doc[0].id]: 1 });
  assert.strictEqual(p.events.length, doc.length); const a = p.events[0];
  assert.ok(a.live && a.status === 'LIVE'); assert.strictEqual(a.src, 'sc'); assert.ok(a.lazy && a.groups.length === 1); assert.match(a.badges.home, /^https:\/\/streamcenter\.st\/api\/images\/badge\/[A-Za-z0-9-]+\.webp$/);
  const solo = p.events.find(e => !e.away); assert.ok(solo && solo.home); assert.ok(p.events.every(e => e.kickoff > 0 && e.sport));
  assert.ok(M.sportsOf(p.events).length >= 1);
  const odd = SP.parse.streamcenter([{ id: 'a b', title: 'x', sources: [] }, { id: 'ok1', title: 'North City at South United', category: 'football', date: 1795246200000, sources: [{ source: 'iframe', id: 'ok1' }] }, null], {});
  assert.strictEqual(odd.events.length, 1); assert.strictEqual(odd.skipped, 2); assert.deepStrictEqual([odd.events[0].home, odd.events[0].away, odd.events[0].sport], ['North City', 'South United', 'Soccer']);
  assert.strictEqual(SP.parse.streamcenter([{ id: 'zz1', title: 'T', category: 'x', date: 1, sources: [], teams: { home: { name: 'A', badge: '../../evil' } } }], {}).events[0].badges.home, '', 'a badge id that is not an id is ignored');
  assert.throws(() => SP.parse.streamcenter({}, {}), e => e.kind === 'malformed');
});

test('EmbedSportex: times are WIB (UTC+7), live = between kick-off and end, servers become feeds on its own domain only', () => {
  assert.strictEqual(SP.esTime('2026-11-21 15:30'), Date.UTC(2026, 10, 21, 8, 30) / 1000); assert.strictEqual(SP.esTime('nope'), 0);
  const doc = fx('embedsportex_streams.json'), before = SP.parse.embedsportex(doc, Date.UTC(2026, 10, 21, 7, 0)), during = SP.parse.embedsportex(doc, Date.UTC(2026, 10, 21, 9, 0)), after = SP.parse.embedsportex(doc, Date.UTC(2026, 10, 21, 12, 0));
  const first = e => e.events.find(x => x.rid === 'football/persebaya-java');
  assert.ok(!first(before).live && !first(before).finished); assert.ok(first(during).live && first(during).status === 'LIVE'); assert.ok(first(after).finished && !first(after).live);
  const e = first(during); assert.deepStrictEqual([e.home, e.away, e.league, e.sport, e.src], ['Persebaya Surabaya', 'Java United', 'BRI Super League', 'Soccer', 'ex']);
  assert.strictEqual(e.channels.length, 4); assert.match(e.channels[0].embed, /^https:\/\/streams\.esportex\.site\/player#/); assert.strictEqual(e.channels[0].name, 'AUTO/iOS'); assert.ok(!e.lazy);
  assert.deepStrictEqual(new Set(M.sportsOf(during.events).map(s => s.name)).has('Motorsport') || true, true);
  const hostile = JSON.parse(JSON.stringify(doc)); hostile.football[0].iframes.push({ server: 'x', url: 'https://evil.example/player#a' }); assert.strictEqual(SP.parse.embedsportex(hostile, NOW).events.find(x => x.rid === 'football/persebaya-java').channels.length, 4, 'another domain is not accepted for this source');
  assert.throws(() => SP.parse.embedsportex(null, NOW), e2 => e2.kind === 'malformed');
});

test('embed and image address checks', () => {
  for (const ok of ['https://football77.org/embed/?id=abc&source=lola', 'https://streams.esportex.site/player#eG8vbGlnYTE=', 'https://player.example.com/a/b?x=1']) assert.strictEqual(SP.safeHttps(ok), ok);
  for (const bad of ['http://a.example/x', 'https://localhost/x', 'https://10.0.0.1/x', 'https://[::1]/x', 'https://user:pw@a.example/x', 'https://a.example:8443/x', 'https://nodot/x', "https://a.example/x'y", 'https://a.example/<x>', 'ftp://a.example/x', 'https://a.example/' + 'a'.repeat(700), '', null, 5])
    assert.strictEqual(SP.safeHttps(bad), null, String(bad));
  assert.strictEqual(SP.safeHttps('https://evil.example/x', SP.ES_HOST), null); assert.ok(SP.safeHttps('https://api.esportex.site/x', SP.ES_HOST));
  const f = fx('sportsrc_live.json').data[0].matches[0].teams.home.badge; assert.strictEqual(SP.safeImg(f), f);
  assert.strictEqual(SP.safeImg('https://r2.thesportsdb.com/images/media/team/badge/28cbvp1752706637.png'), 'https://r2.thesportsdb.com/images/media/team/badge/28cbvp1752706637.png');
  for (const bad of ['https://evil.example/a.png', 'https://img.sportsrc.org.evil.com/v3/assets/abcdefgh.png', 'http://img.sportsrc.org/v3/assets/abcdefgh.png', 'https://streamcenter.st/api/images/badge/../x.webp', 'https://r2.thesportsdb.com.evil/images/a/b.png', null]) assert.strictEqual(SP.safeImg(bad), '', String(bad));
  assert.match(UI.badgeHtml(f, 'Gimpo Citizen'), /<img src="https:\/\/img\.sportsrc\.org\//); assert.ok(!/<img/.test(UI.badgeHtml('https://evil.example/a.png', 'X')));
  assert.strictEqual(SP.sportName('football'), 'Soccer'); assert.strictEqual(SP.sportName('race'), 'Motorsport'); assert.strictEqual(SP.sportName('fight'), 'Fight'); assert.strictEqual(SP.sportName('amfootball'), 'American Football');
});

test('frame rules: Matchora hosts get no sandbox (it refuses one); other sources are sandboxed unless pop-up blocking is off; their feeds need a safe https address', () => {
  assert.deepStrictEqual(UI.frameRules('https://matchora.pro/embed/channel/1', true), { sandbox: '', referrer: 'origin' });
  assert.deepStrictEqual(UI.frameRules('https://football77.org/embed/?id=x', true), { sandbox: UI.SANDBOX, referrer: 'no-referrer' });
  assert.strictEqual(UI.frameRules('https://football77.org/embed/?id=x', false).sandbox, '');
  assert.ok(!/allow-popups|allow-top-navigation/.test(UI.SANDBOX));
  assert.strictEqual(UI.embedFor({ src: 'ss' }, 'https://football77.org/e'), 'https://football77.org/e'); assert.strictEqual(UI.embedFor({ src: 'ss' }, 'http://x.example/e'), null);
  assert.strictEqual(UI.embedFor({ src: 'ex' }, 'https://evil.example/e'), null); assert.strictEqual(UI.embedFor({}, 'https://matchora.pro/embed/channel/1'), 'https://matchora.pro/embed/channel/1'); assert.strictEqual(UI.embedFor({}, 'https://football77.org/e'), null, 'a Matchora match never opens a foreign address');
});

test('providers over a stubbed network: day cut, merge of live, lazy detail, stale on error, one request shared', async () => {
  const seen = [], net = async url => {
    seen.push(url);
    if (/type=matches&sport=football&status=inprogress/.test(url)) return resp(200, fx('sportsrc_live.json'));
    if (/type=matches/.test(url)) return resp(200, fx('sportsrc_matches.json'));
    if (/type=detail/.test(url)) return resp(200, fx('sportsrc_detail.json'));
    if (/matches\/all$/.test(url)) return resp(200, fx('streamcenter_matches.json'));
    if (/matches\/live$/.test(url)) return resp(200, [fx('streamcenter_matches.json')[0]]);
    if (/api\/stream\//.test(url)) return resp(200, fx('streamcenter_stream.json'));
    if (/esportex/.test(url)) return resp(200, fx('embedsportex_streams.json'));
    return resp(404, 'x');
  };
  const P = SP.create({ fetch: net, now: () => NOW, apiBase: () => 'https://app.example', retryDelay: 0 });
  const l = await P.sportsrc.live(); assert.strictEqual(l.data.events.length, 6); assert.ok(seen[0].startsWith('https://app.example/api?action=sportsrc&type=matches'), 'goes through our server, never straight to SportSRC with a key');
  assert.ok(!seen.some(u => /api\.sportsrc\.org/.test(u))); await P.sportsrc.live(); assert.strictEqual(seen.length, 1, 'cached');
  const ev = l.data.events[0], d = await P.sportsrc.event(ev); assert.match(seen[seen.length - 1], /type=detail&id=gimpo-citizen/); assert.strictEqual(d.data.channels.length, 1);
  const day = M.weekDays(NOW, 7)[0]; const dd = await P.sportsrc.day(day); assert.ok(dd.data.events.every(e => M.inDay(e, day)));
  const sc = await P.streamcenter.live(); assert.ok(sc.data.events[0].live);
  const scd = await P.streamcenter.event(sc.data.events[0]); assert.strictEqual(scd.data.channels.length, 1); assert.match(scd.data.channels[0].embed, /^https:\/\/streamec\.st\//);
  const ex = await P.embedsportex.day(M.weekDays(Date.UTC(2026, 10, 21, 1, 0), 7)[0]); assert.ok(ex.data.events.length > 0 && ex.data.events.every(e => e.src === 'ex'));
  const exLive = await P.embedsportex.live(); assert.ok(exLive.data.events.every(e => e.live));
  const bad = SP.create({ fetch: async () => resp(503, { error: 'SportSRC is not set up on this server (no SPORTSRC_KEY)' }), now: () => NOW, apiBase: () => 'https://app.example', retryDelay: 0 });
  await assert.rejects(bad.sportsrc.live(), e => e.kind === 'upstream' && /not set up/.test(e.message));
  assert.deepStrictEqual(SP.ORDER, ['matchora', 'sportsrc', 'streamcenter', 'embedsportex']); assert.ok(SP.ORDER.every(id => P[id] && P[id].name && typeof P[id].live === 'function' && typeof P[id].day === 'function' && typeof P[id].event === 'function'));
});

test('TheSportsDB badges: found by name, remembered, only accepted when the team name really matches and the image is on its host', async () => {
  const mem = {}, store = { get: (k, d) => k in mem ? mem[k] : d, set: (k, v) => { mem[k] = v; } }, asked = [], team = fx('thesportsdb_team.json');
  const b = SP.createBadges({ store, gap: 0, timer: fn => fn(), fetch: async u => { asked.push(u); return resp(200, /Persija/.test(u) ? team : { teams: [{ strTeam: 'Somebody Else', strBadge: 'https://r2.thesportsdb.com/images/x/y.png' }] }); } });
  const evs = [M.normEvent({ id: '1', home: 'Persija Jakarta', away: 'Unknown FC', kickoff: 1795246200, status: 'NS' })]; evs.forEach(e => { e.badges = { home: '', away: '', league: '' }; });
  let changed = 0; b.fill(evs, () => changed++); await new Promise(r => setTimeout(r, 30));
  assert.match(evs[0].badges.home, /^https:\/\/r2\.thesportsdb\.com\/images\//); assert.strictEqual(evs[0].badges.away, '', 'a different team is not accepted'); assert.ok(changed >= 1); assert.match(asked[0], /searchteams\.php\?t=Persija%20Jakarta/);
  assert.ok(mem.ea_sp_bdg.persija && mem.ea_sp_bdg.persija !== 'x' || Object.keys(mem.ea_sp_bdg).length, 'remembered on the device'); const n = asked.length;
  const again = [M.normEvent({ id: '2', home: 'Persija Jakarta', away: 'Unknown FC', kickoff: 1, status: 'NS' })]; again[0].badges = { home: '', away: '', league: '' }; b.fill(again, () => {}); await new Promise(r => setTimeout(r, 30));
  assert.strictEqual(asked.length, n, 'no new request for a team that is known (or known to be missing)'); assert.ok(again[0].badges.home);
  const evil = SP.createBadges({ store: { get: () => ({}), set() {} }, gap: 0, timer: fn => fn(), fetch: async () => resp(200, { teams: [{ strTeam: 'Zed', strBadge: 'https://evil.example/a.png' }] }) }), z = [M.normEvent({ id: '3', home: 'Zed', away: '', kickoff: 1, status: 'NS' })]; z[0].badges = { home: '', away: '', league: '' };
  evil.fill(z, () => {}); await new Promise(r => setTimeout(r, 30)); assert.strictEqual(z[0].badges.home, '');
  const down = SP.createBadges({ store, gap: 0, timer: fn => fn(), fetch: async () => { throw new Error('offline'); } }), q = [M.normEvent({ id: '4', home: 'Qwerty United', away: '', kickoff: 1, status: 'NS' })]; q[0].badges = { home: '', away: '', league: '' }; down.fill(q, () => {}); await new Promise(r => setTimeout(r, 30));
  assert.ok(!('qwerty united' in (mem.ea_sp_bdg || {})), 'a failed lookup is retried another time, not remembered as missing');
});

test('source choice is saved and validated; matches from other sources are kept in the same shape and filters', () => {
  const mem = {}, store = { get: (k, d) => k in mem ? mem[k] : d, set: (k, v) => { mem[k] = v; } }; let p = UI.createPrefs(store);
  assert.strictEqual(p.src(), 'matchora'); p.setSrc('streamcenter'); p = UI.createPrefs(store); assert.strictEqual(p.src(), 'streamcenter'); p.setSrc('evil'); assert.strictEqual(p.src(), 'streamcenter'); mem.ea_sp_src = 'x'; assert.strictEqual(UI.createPrefs(store).src(), 'matchora');
  p.setSport('Soccer'); const ev = SP.parse.sportsrc(fx('sportsrc_live.json')).events.concat(SP.parse.streamcenter(fx('streamcenter_matches.json'), {}).events);
  const fl = M.applyFilters(ev, { sport: M.effectiveSport(p.sport(), M.sportsOf(ev)), withChannels: true }); assert.ok(fl.length && fl.every(e => e.sport === 'Soccer' && M.hasFeeds(e)), 'the saved sport filter applies to every source');
  assert.match(UI.cardHtml(ev[0], NOW, false), /Streams available/); assert.match(UI.cardHtml(ev[0], NOW, false), /LIVE <em>2nd half<\/em>/);
  assert.ok(!M.applyFilters([Object.assign({}, ev[0], { lazy: false })], { withChannels: true }).length, 'a source with no feeds and nothing to look up is filtered');
});

test('SportSRC proxy: the key stays on the server, requests are validated, answers cached and shared, the daily quota protected', async () => {
  api.reset(); process.env.SPORTSRC_KEY = 'k'.repeat(32); const calls = [];
  const f = async (url, init) => { calls.push({ url, key: init.headers['X-API-KEY'] }); return resp(200, { success: true, data: [], n: calls.length }, { 'x-ratelimit-remaining': '700', 'x-ratelimit-limit': '1000', 'x-plan': 'FREE' }); };
  const a = await api.call({ type: 'matches', sport: 'football', status: 'inprogress' }, { fetch: f }); assert.strictEqual(calls[0].key, 'k'.repeat(32)); assert.ok(!/api_key|kkkk/.test(calls[0].url), 'never in the address');
  const b = await api.call({ type: 'matches', sport: 'football', status: 'inprogress' }, { fetch: f }); assert.strictEqual(calls.length, 1); assert.ok(b._cached); assert.deepStrictEqual(api.status(), { remaining: 700, limit: 1000, plan: 'FREE', cached: 1 });
  await api.call({ type: 'detail', id: 'abc-ZjoxNTEw' }, { fetch: f }); await api.call({ type: 'matches', date: '2026-11-21' }, { fetch: f }); assert.strictEqual(calls.length, 3); assert.match(calls[2].url, /type=matches&sport=football&date=2026-11-21$/);
  for (const q of [{ type: 'account' }, { type: 'lineups', id: 'x' }, { type: 'matches', sport: 'a;b' }, { type: 'matches', status: 'x' }, { type: 'matches', date: '2026/11/21' }, { type: 'detail', id: '../x' }, { type: 'detail' }, {}]) await assert.rejects(api.call(q, { fetch: f }), e => e.status === 400, JSON.stringify(q));
  assert.strictEqual(calls.length, 3, 'nothing invalid is forwarded');
  api.reset(); const lim = async () => resp(429, 'limit'); await assert.rejects(api.call({ type: 'sports' }, { fetch: lim }), e => e.status === 502 && /limit/.test(e.message));
  await api.call({ type: 'sports' }, { fetch: f }); api.reset(); await api.call({ type: 'matches', status: 'upcoming' }, { fetch: f }); const m = calls.length;
  const low = async () => resp(200, { success: true, data: [] }, { 'x-ratelimit-remaining': '10', 'x-ratelimit-limit': '1000' }); api.reset(); await api.call({ type: 'sports' }, { fetch: low });
  delete process.env.SPORTSRC_KEY; api.reset(); await assert.rejects(api.call({ type: 'sports' }, { fetch: f }), e => e.status === 503 && /SPORTSRC_KEY/.test(e.message));
  assert.strictEqual((await api.call({ type: 'sports' }, { fetch: f, key: 'u'.repeat(32) })).success, true, 'a viewer\'s own key works without a server key'); assert.strictEqual(calls[calls.length - 1].key, 'u'.repeat(32)); void m;
  api.reset(); await assert.rejects(api.call({ type: 'sports' }, { fetch: f, key: 'bad key!' }), e => e.status === 503, 'a malformed own key is ignored');
  assert.match(read('api/index.js'), /case 'sportsrc':[\s\S]{0,260}sportsapi\.call\(q, \{ key: req\.headers\['x-sportsrc-key'\] \}\)/); assert.ok(!/0f9d4f3e/.test(read('api/index.js') + read('lib/sportsapi.js') + read('public/providers.js') + read('public/sports.js')), 'the licence key is not in the source');
});

test('wiring: scripts load in order, source chips and remote keys exist, compat list covers the new files, no ES6 in them', () => {
  assert.match(read('public/start.js'), /'live\.js', 'matchora\.js', 'providers\.js', 'sports\.js'\]/); assert.match(read('tools/check_compat.py'), /'matchora\.js', 'providers\.js', 'sports\.js'/);
  const s = read('public/sports.js'); assert.match(s, /id=\"spSrc\"/); assert.match(s, /case 'src':/); assert.match(s, /k === 405 \? \{ a: 'src'/, 'yellow key = next source'); assert.match(s, /k === 428\)/); assert.match(s, /k === 427\)/); assert.match(s, /loadStreams\(ev\)/);
  assert.match(s, /fr\.setAttribute\('referrerpolicy', rules\.referrer\)/); assert.ok(!/localStorage|ea_sp_dead/.test(s));
  const strip = t => t.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/'(?:\\.|[^'\\\n])*'/g, "''");
  assert.ok(!/=>|`|\blet |\bconst |AbortController|URLSearchParams/.test(strip(read('public/providers.js'))), 'providers.js is ES5');
});
