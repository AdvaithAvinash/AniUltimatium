'use strict';
// Matchora data module (public/matchora.js), tested against REAL captured responses (tests/fixtures/matchora/*.json, from https://matchora.pro/api/v1).
process.env.TZ = 'Asia/Kolkata';                       // a zone whose local day touches two UTC days (the hard case for the schedule picker)
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const M = require('../public/matchora.js');
const fx = n => JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'matchora', n), 'utf8'));
const LIVE = fx('live.json'), SCHED = fx('schedule.json');
const byId = (list, id) => list.find(e => e.id === id);
const resp = (status, body, headers) => ({ status, ok: status >= 200 && status < 300, headers: { get: k => (headers || {})[k.toLowerCase()] || null }, text: async () => typeof body === 'string' ? body : JSON.stringify(body) });
const nowMs = Date.UTC(2026, 10, 21, 6, 45);          // the day the fixtures were captured

test('live: real /live document parses; flat fields and nested channels are read as the API names them', () => {
  const r = M.parseList(LIVE);
  assert.strictEqual(r.events.length, LIVE.count); assert.strictEqual(r.skipped, 0);
  const e = r.events[0];
  assert.strictEqual(e.id, '2626486'); assert.strictEqual(e.sport, 'Fighting'); assert.strictEqual(e.league, 'BKFC');
  assert.ok(e.live && !e.finished); assert.strictEqual(e.status, 'LIVE'); assert.strictEqual(e.score, null); assert.strictEqual(e.minute, '');
  assert.strictEqual(e.channels.length, 9);
  const c = e.channels[0];
  assert.deepStrictEqual([c.id, c.name, c.country, c.quality, c.lang, c.playing, c.dead], ['1917231', 'FIGHTKLUB', '🇧🇬', 'HD', 'Other', true, false]);
  assert.strictEqual(c.embed, 'https://matchora.pro/embed/channel/1917231');
  assert.strictEqual(e.embed, 'https://matchora.pro/embed/match/2626486');
  assert.ok(r.events.every(x => x.live));
});

test('scheduled, live-with-score, finished, cancelled, after-penalties and quarter states are told apart', () => {
  const ev = M.parseList(SCHED).events;
  const live = byId(ev, '2514910'); assert.ok(live.live); assert.deepStrictEqual([live.score.h, live.score.a, live.minute], [1, 1, '74']);
  assert.strictEqual(M.statusInfo(live, nowMs).text, "74'");
  const ns = byId(ev, '2540133'); assert.ok(!ns.live && !ns.finished); assert.strictEqual(ns.score, null);
  const ft = byId(ev, '2540131'); assert.ok(ft.finished && !ft.live); assert.strictEqual(M.statusInfo(ft, nowMs).label, 'FT');
  const canc = byId(ev, '2595853'); assert.ok(canc.cancelled && !canc.live); assert.strictEqual(M.statusInfo(canc, nowMs).label, 'CANCELLED');
  const ap = byId(ev, '2554571'); assert.ok(ap.finished); assert.strictEqual(M.statusInfo(ap, nowMs).label, 'AP');
  const q1 = byId(ev, '2487953'); assert.ok(q1.live); assert.strictEqual(q1.score.raw, '0-2'); assert.strictEqual(M.statusInfo(q1, nowMs).text, "1'");
  const blank = byId(ev, '2568495'); assert.strictEqual(blank.status, ''); assert.ok(!blank.live && !blank.finished);
});

test('kick-off is unix seconds and is shown in the viewer\'s own time zone (24 h and 12 h)', () => {
  const e = byId(M.parseList(SCHED).events, '2540133');
  assert.strictEqual(e.kickoff, 1795250400);
  const d = new Date(e.kickoff * 1000), hh = String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0');
  assert.strictEqual(M.fmtClock(e.kickoff, false), hh);
  assert.match(M.fmtClock(e.kickoff, true), /^\d{1,2}:\d{2} (AM|PM)$/);
  assert.strictEqual(M.fmtClock(e.kickoff, false), '14:10', 'Asia/Kolkata (UTC+5:30): 1795250400 = 08:40 UTC');
  const soon = M.statusInfo(e, e.kickoff * 1000 - 100 * 60000);
  assert.strictEqual(soon.kind, 'soon'); assert.strictEqual(soon.text, 'in 1h 40m');
});

test('multiple sports: counts, Soccer first, filters, league grouping with live leagues first', () => {
  const ev = M.parseList(SCHED).events, sp = M.sportsOf(ev);
  assert.strictEqual(sp[0].name, 'Soccer');
  assert.deepStrictEqual(new Set(sp.map(s => s.name)), new Set(['Soccer', 'Ice Hockey', 'Basketball', 'American Football', 'Baseball', 'Cricket', 'Fighting', 'Rugby', 'Motorsport', 'Golf', 'Tennis', 'Snooker']));
  assert.ok(M.applyFilters(ev, { sport: 'Soccer' }).every(e => e.sport === 'Soccer'));
  assert.strictEqual(M.applyFilters(ev, { sport: 'all' }).length, ev.length);
  assert.ok(M.applyFilters(ev, { live: true }).every(e => e.live));
  const g = M.groupByLeague(M.applyFilters(ev, { sport: 'Soccer' }));
  assert.ok(g.length > 1); assert.ok(g[0].live > 0, 'a league with a live match comes first');
  assert.ok(g.every(x => x.events.every(e => e.league === x.league)));
  const first = g[0].events; assert.ok(first[0].live, 'live match first inside its league');
});

test('nested channel info: playable feeds are ordered, de-duplicated, and carry the embed address', () => {
  const e = M.parseList(LIVE).events[0], feeds = M.feedsOf(e);
  assert.ok(feeds.length > 0 && feeds.length <= e.channels.length);
  assert.strictEqual(feeds[0].name, 'FIGHTKLUB'); assert.strictEqual(feeds[0].watching, 15);          // on air + most watched first
  const urls = feeds.map(f => f.embed); assert.strictEqual(new Set(urls).size, urls.length, 'no feed twice');
  const dup = M.normEvent(Object.assign({}, LIVE.events[0], { channels: [LIVE.events[0].channels[0], LIVE.events[0].channels[0], Object.assign({}, LIVE.events[0].channels[0], { id: '9', embed_url: 'https://matchora.pro/embed/channel/9', watching: 99 })] }));
  const f2 = M.feedsOf(dup); assert.strictEqual(f2.length, 1, 'same name+country+language is one channel'); assert.strictEqual(f2[0].watching, 99, 'the busier copy is kept');
  assert.deepStrictEqual(M.channelTerms(e, 3), ['FIGHTKLUB', 'DAZN CHANNEL', 'CANAL+ SPORT']);
});

test('missing channels: events without any channel have zero feeds and are removed by "only with channels"', () => {
  const ev = M.parseList(SCHED).events, none = byId(ev, '2626892');
  assert.strictEqual(none.channels.length, 0); assert.strictEqual(M.feedsOf(none).length, 0);
  const w = M.applyFilters(ev, { withChannels: true });
  assert.ok(!w.some(e => e.id === '2626892') && w.every(e => M.feedsOf(e).length > 0));
  assert.ok(w.length < ev.length);
});

test('dead channels never appear; a channel that failed is only moved down for a few minutes, never removed', () => {
  const ev = M.parseList(SCHED).events, d = byId(ev, '2627803');
  assert.ok(d.channels.some(c => c.dead), 'fixture has a real dead channel');
  const live = M.feedsOf(d); assert.ok(live.length < d.channels.length); assert.ok(live.every(f => !f.dead));
  const e = M.parseList(LIVE).events[0], client = M.createClient({ fetch: async () => resp(200, LIVE), now: () => nowMs });
  const top = M.feedsOf(e)[0].id; client.penalize(top);
  const during = M.feedsOf(e, client.penalties(), nowMs + 1000);
  assert.strictEqual(during.length, M.feedsOf(e).length, 'still offered'); assert.notStrictEqual(during[0].id, top); assert.ok(during[during.length - 1].penalized);
  const later = M.feedsOf(e, client.penalties(), nowMs + 4 * 60000); assert.strictEqual(later[0].id, top, 'back on top after the penalty expires');
});

test('embed hosts: matchora.pro and its language sub-domains pass; matchora.to is rewritten to .pro; everything else is refused', () => {
  const ok = { 'https://matchora.pro/embed/channel/1917231': 'https://matchora.pro/embed/channel/1917231', 'https://es.matchora.pro/embed/match/2506': 'https://es.matchora.pro/embed/match/2506',
    'https://matchora.to/embed/channel/1547292': 'https://matchora.pro/embed/channel/1547292', 'https://ES.matchora.to/embed/channel/5': 'https://es.matchora.pro/embed/channel/5', 'https://matchora.pro/embed/match/esc1561': 'https://matchora.pro/embed/match/esc1561' };
  for (const k in ok) assert.strictEqual(M.safeEmbed(k), ok[k], k);
  for (const bad of ['http://matchora.pro/embed/channel/1', 'https://matchora.pro.evil.com/embed/channel/1', 'https://evil.com/embed/channel/1', 'https://evilmatchora.pro/embed/channel/1',
    'https://matchora.pro@evil.com/embed/channel/1', 'https://matchora.pro:8443/embed/channel/1', 'https://matchora.pro/api/v1/live', 'https://matchora.pro/embed/../x', 'javascript:alert(1)', 'https://matchora.pro/embed/channel/1"onload="x', '', null, undefined, 42, {}])
    assert.strictEqual(M.safeEmbed(bad), null, String(bad));
  const e = M.parseList(fx('channels.json') && { events: [] }).events; assert.deepStrictEqual(e, []);
  const real = fx('channels.json').channels.map(c => c.feeds.map(f => M.safeEmbed(f.embed_url))).flat();     // real /channels data uses matchora.to
  assert.ok(real.length && real.every(u => /^https:\/\/matchora\.pro\/embed\/channel\/\d+$/.test(u)));
  const es = M.parseList(SCHED).events.filter(x => x.channels.some(c => /^https:\/\/es\.matchora\.pro\//.test(c.embed || '')));
  assert.ok(es.length > 0, 'real data has the es. host and it is accepted');
});

test('team badges: only Matchora image-proxy addresses are drawn; everything else becomes initials', () => {
  const ev = M.parseList(SCHED).events, e = byId(ev, '2540131');
  assert.match(e.badges.home, /^https:\/\/matchora\.pro\/img\?k=/);
  assert.strictEqual(M.safeBadge('https://evil.com/img?k=abcdefgh'), ''); assert.strictEqual(M.safeBadge('http://matchora.pro/img?k=abcdefgh'), ''); assert.strictEqual(M.safeBadge(null), '');
  assert.strictEqual(M.safeBadge('https://matchora.pro/img?k=abcdefgh"onerror="x'), '');
  assert.strictEqual(byId(ev, '2626892').badges.league === '' || /matchora/.test(byId(ev, '2626892').badges.league), true);
});

test('malformed data: bad items are skipped, a wrong document is an error, never a crash', () => {
  const doc = { count: 4, events: [null, 5, 'x', { id: '1' }, { id: '2', home: 'A', away: 'B', channels: 'nope', kickoff: 'soon', score: 7 }, { id: '2', home: 'dup' }, LIVE.events[0], { id: '../x', home: 'y' }] };
  const r = M.parseList(doc); assert.deepStrictEqual(r.events.map(e => e.id), ['2', '2626486']); assert.strictEqual(r.skipped, 6);
  assert.strictEqual(r.events[0].kickoff, 0); assert.deepStrictEqual(r.events[0].channels, []); assert.strictEqual(r.events[0].score, null); assert.strictEqual(M.statusInfo(r.events[0], nowMs).label, 'TBA');
  for (const bad of [null, [], 'x', {}, { events: {} }, { events: [null, 3] }]) assert.throws(() => M.parseList(bad), e => e.kind === 'malformed');
  assert.deepStrictEqual(M.parseList({ events: [] }).events, []);
  const c = M.normChannel({ id: '5', name: '  ', embed_url: 'https://evil.com/embed/x' }); assert.strictEqual(c.name, 'Channel 5'); assert.strictEqual(c.embed, null);
  assert.strictEqual(M.feedsOf(M.normEvent({ id: '9', home: 'A', away: 'B', channels: [{ id: '5', name: 'X', embed_url: 'https://evil.com/embed/x' }] })).length, 0, 'a channel without a trusted embed is not playable');
});

test('score text: "1-1" is parsed, odd text is kept as text', () => {
  assert.deepStrictEqual(M.parseScore('2-3'), { h: 2, a: 3, raw: '2-3' }); assert.deepStrictEqual(M.parseScore('2 : 3'), { h: 2, a: 3, raw: '2 : 3' });
  assert.deepStrictEqual(M.parseScore('45/2 (12)'), { h: null, a: null, raw: '45/2 (12)' }); assert.strictEqual(M.parseScore(null), null); assert.strictEqual(M.parseScore(''), null); assert.strictEqual(M.parseScore(5), null);
});

test('7-day picker: local days, UTC dates to ask for (a local day can touch two UTC days), cut to the local day', async () => {
  const days = M.weekDays(nowMs, 7);
  assert.strictEqual(days.length, 7); assert.strictEqual(days[0].label, 'Today'); assert.strictEqual(days[1].label, 'Tomorrow'); assert.ok(days[0].today && !days[1].today);
  for (let i = 0; i < 7; i++) { assert.strictEqual(days[i].end - days[i].start, 86400000); if (i) assert.strictEqual(days[i].start, days[i - 1].end); assert.ok(days[i].utc.length >= 1 && days[i].utc.length <= 2); }
  assert.deepStrictEqual(days[0].utc, ['2026-11-20', '2026-11-21'], 'India: 00:00 local is the evening of the previous UTC day');
  const asked = [], fetchFn = async url => { asked.push(url); const d = /date=(\S+)$/.exec(url)[1]; return resp(200, { count: 1, events: SCHED.events.filter(e => new Date(e.kickoff * 1000).toISOString().slice(0, 10) === d) }); };
  const r = await M.createClient({ fetch: fetchFn, now: () => nowMs }).day(days[0]);
  assert.deepStrictEqual(asked.map(u => u.split('/api/v1')[1]).sort(), ['/schedule?date=2026-11-20', '/schedule?date=2026-11-21']);
  assert.ok(r.data.events.length > 0 && r.data.events.every(e => M.inDay(e, days[0])));
  assert.strictEqual(new Set(r.data.events.map(e => e.id)).size, r.data.events.length);
});

test('merge: the live list wins over the schedule for the same match', () => {
  const sched = M.parseList(SCHED).events, live = [Object.assign({}, byId(sched, '2540133'), { live: true, score: { h: 1, a: 0, raw: '1-0' } })];
  const m = M.mergeLive(sched, live); assert.strictEqual(m.length, sched.length); assert.ok(byId(m, '2540133').live);
});

test('client: caching, a refresh inside the TTL costs no request, force asks again, concurrent calls share one request', async () => {
  let n = 0, t = nowMs; const c = M.createClient({ fetch: async () => { n++; return resp(200, LIVE); }, now: () => t });
  const [a, b] = await Promise.all([c.live(), c.live()]); assert.strictEqual(n, 1); assert.strictEqual(a.data, b.data);
  t += 10000; const r = await c.live(); assert.strictEqual(n, 1); assert.ok(r.cached);
  t += 25000; await c.live(); assert.strictEqual(n, 2, 'after the TTL');
  await c.live({ force: true }); assert.strictEqual(n, 3);
});

test('client: HTTP 502 is retried once; a second 502 is an error (or the old list when there is one)', async () => {
  let n = 0; const c = M.createClient({ fetch: async () => { n++; return n === 1 ? resp(502, { error: 'edge down' }) : resp(200, LIVE); }, now: () => nowMs, retryDelay: 0 });
  assert.strictEqual((await c.live()).data.events.length, 6); assert.strictEqual(n, 2);
  let t = nowMs; const calls = [], c2 = M.createClient({ fetch: async () => { calls.push(1); return calls.length === 1 ? resp(200, LIVE) : resp(502, { error: 'x' }); }, now: () => t, retryDelay: 0 });
  await c2.live(); t += 60000; const s = await c2.live(); assert.ok(s.stale); assert.strictEqual(s.error.kind, 'upstream'); assert.strictEqual(s.data.events.length, 6, 'stale list beats an empty screen');
  const c3 = M.createClient({ fetch: async () => resp(502, { error: 'x' }), now: () => nowMs, retryDelay: 0 });
  await assert.rejects(c3.live(), e => e.kind === 'upstream' && /server error/.test(e.message));
});

test('client: HTTP 429 backs off (Retry-After honoured, capped) and serves the old list without hitting the API again', async () => {
  let n = 0, t = nowMs; const c = M.createClient({ fetch: async () => { n++; return n === 1 ? resp(200, LIVE) : resp(429, 'slow down', { 'retry-after': '45' }); }, now: () => t });
  await c.live(); t += 31000; const r = await c.live(); assert.ok(r.stale); assert.strictEqual(r.error.kind, 'rate'); assert.strictEqual(n, 2);
  assert.strictEqual(c.blockedUntil(), t + 45000);
  t += 20000; await c.live({ force: true }); assert.strictEqual(n, 2, 'no request while backing off, even when forced');
  t += 30000; await c.live({ force: true }); assert.strictEqual(n, 3, 'asks again once the wait is over');
  const cap = M.createClient({ fetch: async () => resp(429, '', { 'retry-after': '99999' }), now: () => nowMs });
  await assert.rejects(cap.live(), e => e.kind === 'rate'); assert.strictEqual(cap.blockedUntil(), nowMs + 120000);
  await assert.rejects(cap.live(), e => e.kind === 'rate', 'nothing cached: an error, not a new request');
});

test('client: timeouts, network failures and bad JSON become typed errors', async () => {
  const slow = M.createClient({ fetch: () => new Promise(() => {}), now: () => nowMs, timeout: 30 });
  await assert.rejects(slow.live(), e => e.kind === 'timeout');
  const down = M.createClient({ fetch: async () => { throw new TypeError('Failed to fetch'); }, now: () => nowMs });
  await assert.rejects(down.live(), e => e.kind === 'offline');
  const bad = M.createClient({ fetch: async () => resp(200, '<html>oops</html>'), now: () => nowMs });
  await assert.rejects(bad.live(), e => e.kind === 'malformed');
  const shape = M.createClient({ fetch: async () => resp(200, { events: 'nope' }), now: () => nowMs });
  await assert.rejects(shape.live(), e => e.kind === 'malformed');
  const http = M.createClient({ fetch: async () => resp(500, 'boom'), now: () => nowMs }); await assert.rejects(http.live(), e => e.kind === 'http');
  for (const k of Object.keys(M.MESSAGES)) assert.ok(M.MESSAGES[k].length > 10);
});

test('events/{id}: the real event answers; an unknown id (HTTP 502 "unknown fixture") is "unknown" and is not retried', async () => {
  let n = 0; const ok = M.createClient({ fetch: async url => { n++; assert.match(url, /\/api\/v1\/events\/2626486$/); return resp(200, fx('event.json')); }, now: () => nowMs });
  const r = await ok.event('2626486'); assert.strictEqual(r.data.id, '2626486'); assert.strictEqual(r.data.channels.length, 9);
  let calls = 0; const unk = M.createClient({ fetch: async () => { calls++; return resp(502, fs.readFileSync(path.join(__dirname, 'fixtures', 'matchora', 'event_unknown.json'), 'utf8')); }, now: () => nowMs, retryDelay: 0 });
  await assert.rejects(unk.event('0000'), e => e.kind === 'unknown'); assert.strictEqual(calls, 1);
  await assert.rejects(unk.event('../etc'), e => e.kind === 'unknown'); assert.strictEqual(calls, 1, 'a bad id never reaches the network');
  const stale = M.createClient({ fetch: async () => resp(200, fx('event.json')), now: () => nowMs }); await stale.event('2626486');
});

test('channels list: real /channels data; feeds on matchora.to are rewritten, junk entries dropped', async () => {
  const c = M.createClient({ fetch: async () => resp(200, { channels: fx('channels.json').channels.concat([null, { name: '' }, { name: 'X', feeds: [{ embed_url: 'https://evil.com/embed/1' }] }]) }), now: () => nowMs });
  const r = (await c.channels()).data.channels; assert.strictEqual(r.length, 9);
  assert.deepStrictEqual([r[0].name, r[0].countries, r[0].featured], ['#Vamos', ['ES'], true]); assert.strictEqual(r[0].feeds[0].embed, 'https://matchora.pro/embed/channel/1547292'); assert.deepStrictEqual(r[8].feeds, []);
});

test('channel names: the same channel written differently matches; different channels in one family do not', () => {
  assert.strictEqual(M.nameScore('DAZN CHANNEL', 'DAZN HD'), 1); assert.strictEqual(M.nameScore('CANAL+ SPORT', 'Canal Plus Sport'), 1); assert.strictEqual(M.nameScore('Sky Sports', 'SkySports'), 1);
  assert.strictEqual(M.nameScore('beIN SPORTS 1 (FHD)', 'Bein Sports 1'), 1); assert.strictEqual(M.nameScore('Movistar+ Liga de Campeones', 'MOVISTAR PLUS LIGA DE CAMPEONES HD'), 1);
  assert.ok(M.nameScore('Sky Sports', 'Sky Sports Main Event') < 0.7); assert.ok(M.nameScore('ESPN', 'ESPN 2') < 0.7); assert.strictEqual(M.nameScore('', 'x'), 0); assert.strictEqual(M.nameScore('HD', 'HD'), 1);
});

test('sport filter: a saved sport that is not on this list does not apply (and is not lost)', () => {
  const sp = M.sportsOf(M.parseList(LIVE).events);
  assert.strictEqual(M.effectiveSport('Soccer', sp), 'Soccer'); assert.strictEqual(M.effectiveSport('Rugby', sp), 'all'); assert.strictEqual(M.effectiveSport('all', sp), 'all'); assert.strictEqual(M.effectiveSport(undefined, sp), 'all');
});

test('the module is old-engine safe and never names matchora.to as a place to load from', () => {
  const src = fs.readFileSync(path.join(__dirname, '..', 'public', 'matchora.js'), 'utf8');
  assert.ok(!/=>|`|\blet |\bconst |AbortController|URLSearchParams|\bnew URL\(/.test(src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')), 'ES5 only');
  assert.match(src, /var BASE = 'https:\/\/matchora\.pro'/);
  assert.ok(!/'https?:\/\/(?:[a-z]+\.)?matchora\.to/.test(src), 'no matchora.to address is ever requested');
});
