'use strict';
// Live Sports UI helpers (public/sports.js, pure part) and how the tab is wired into the app.
const test = require('node:test');
const assert = require('node:assert');
const fs = require('node:fs');
const path = require('node:path');
const M = require('../public/matchora.js');
const P = require('../public/sports.js');
const root = path.join(__dirname, '..');
const read = f => fs.readFileSync(path.join(root, f), 'utf8');
const fx = n => JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'matchora', n), 'utf8'));
const ev = M.parseList(fx('schedule.json')).events, live = M.parseList(fx('live.json')).events;
const byId = (l, id) => l.find(e => e.id === id);
const NOW = Date.UTC(2026, 10, 21, 6, 45);

test('team badges: initials always, Matchora image only from its own proxy, hostile values are escaped or dropped', () => {
  const real = M.parseList(fx('schedule.json')).events.find(e => e.id === '2540131').badges.home;
  const h = P.badgeHtml(real, 'Auckland FC');
  assert.match(h, /<b>AF<\/b>/); assert.match(h, /<img src="https:\/\/matchora\.pro\/img\?k=[A-Za-z0-9_-]+" alt="" data-bd="1">/);
  assert.ok(!/<img/.test(P.badgeHtml('', 'Auckland FC')), 'no badge address: initials only');
  assert.ok(!/<img/.test(P.badgeHtml('https://evil.com/x.png', 'X')), 'other hosts are never loaded');
  assert.ok(!/<img/.test(P.badgeHtml('https://matchora.pro/img?k=abc12345"><script>', 'X')));
  assert.ok(!/<script/.test(P.badgeHtml('', '<script>alert(1)</script>')));
  assert.strictEqual(P.initials('Real Madrid'), 'RM'); assert.strictEqual(P.initials('Kean University'), 'KU'); assert.strictEqual(P.initials('Duke'), 'DU'); assert.strictEqual(P.initials(''), '?'); assert.strictEqual(P.initials('!!!'), '?');
  assert.strictEqual(P.hueOf('Duke'), P.hueOf('Duke')); assert.notStrictEqual(P.hueOf('Duke'), P.hueOf('Kean University'));
  assert.match(P.badgeHtml('', 'Duke', 'big'), /class="sp-bd big" style="background:hsl\(\d+,42%,30%\)"/);
});

test('cards: live match shows LIVE, minute, score and channel count; scheduled shows time; none shows "No channels yet"', () => {
  const l = P.cardHtml(byId(ev, '2514910'), NOW, false);
  assert.match(l, /sp-pill live/); assert.match(l, /LIVE <em>74'<\/em>/); assert.match(l, /SKA-Khabarovsk/); assert.match(l, /Rotor Volgograd/); assert.match(l, /<span class="sp-sc">1<\/span>/); assert.match(l, /Russian First League/);
  assert.match(l, /No channels yet/, 'this real match has no channel');
  const w = P.cardHtml(live[0], NOW, false);
  assert.match(w, /9 channels/); assert.match(w, /BKFC Fight Night Myrtle Beach Richardson vs Oxendine/); assert.match(w, /sp-solo/, 'one-sided events (fights, races) show one title'); assert.match(w, /\d+ watching/);
  const sched = P.cardHtml(byId(ev, '2506859'), NOW, false); assert.match(sched, /sp-pill soon">\d\d:\d\d <em>in 4h 15m<\/em>/); assert.match(P.cardHtml(byId(ev, '2506859'), NOW - 86400000, false), /sp-pill upcoming">\d\d:\d\d</); assert.match(sched, /3 channels/); assert.ok(!/sp-pill live/.test(sched));
  const one = Object.assign({}, byId(ev, '2597935'), {}); assert.match(P.cardHtml(one, NOW, false), /1 channel</);
  const none = P.cardHtml(byId(ev, '2626892'), NOW, false); assert.match(none, /No channels yet/);
  const ft = P.cardHtml(byId(ev, '2540131'), NOW, false); assert.match(ft, /sp-pill finished">FT/); assert.match(ft, /class="sp-team"/);
  const canc = P.cardHtml(byId(ev, '2595853'), NOW, false); assert.match(canc, /CANCELLED/);
  const win = P.cardHtml(Object.assign({}, byId(ev, '2540131'), { score: { h: 3, a: 1, raw: '3-1' } }), NOW, false); assert.match(win, /sp-team win"/);
  const odd = P.cardHtml(byId(ev, '2487953'), NOW, false); assert.match(odd, /<span class="sp-sc">0<\/span>/); assert.match(odd, /<span class="sp-sc">2<\/span>/);
});

test('cards: names from the API are escaped', () => {
  const evil = M.normEvent({ id: '1', home: '<img src=x onerror=alert(1)>', away: 'B"&', league: '<b>L</b>', sport: 'Soccer', kickoff: 1795250400, status: 'NS' });
  const h = P.cardHtml(evil, NOW, false); assert.ok(!/<img src=x/.test(h) && !/<b>L<\/b>/.test(h)); assert.match(h, /&lt;img src=x onerror=alert\(1\)&gt;/); assert.match(h, /B&quot;&amp;/);
});

test('sport filter persistence: the choice, Live Now and "only with channels" survive a restart; unknown values fall back safely', () => {
  const mem = {}, store = { get: (k, d) => k in mem ? mem[k] : d, set: (k, v) => { mem[k] = v; } };
  let p = P.createPrefs(store);
  assert.strictEqual(p.sport(), 'all'); assert.strictEqual(p.liveOnly(), true); assert.strictEqual(p.withChannels(), true);
  p.setSport('Soccer'); p.setLiveOnly(false); p.setWithChannels(false);
  p = P.createPrefs(store);                                                  // "restart": a new object over the same storage
  assert.strictEqual(p.sport(), 'Soccer'); assert.strictEqual(p.liveOnly(), false); assert.strictEqual(p.withChannels(), false);
  const sports = M.sportsOf(live); assert.strictEqual(M.effectiveSport(p.sport(), sports), 'Soccer' === 'Soccer' && sports.some(s => s.name === 'Soccer') ? 'Soccer' : 'all');
  p.setSport('Rugby'); assert.strictEqual(M.effectiveSport(p.sport(), sports), 'all', 'no rugby live now: filter does not apply'); assert.strictEqual(p.sport(), 'Rugby', '...but the choice is kept for the next list');
  mem.ea_sp_sport = { evil: 1 }; assert.strictEqual(P.createPrefs(store).sport(), 'all'); mem.ea_sp_sport = 'x'.repeat(80); assert.strictEqual(P.createPrefs(store).sport(), 'all');
  const bad = P.createPrefs({ get() { throw new Error('storage blocked'); }, set() { throw new Error('storage blocked'); } }); assert.strictEqual(bad.sport(), 'all'); bad.setSport('Soccer');
  const fl = M.applyFilters(ev, { sport: M.effectiveSport('Soccer', M.sportsOf(ev)), withChannels: true }); assert.ok(fl.length && fl.every(e => e.sport === 'Soccer' && M.feedsOf(e).length));
});

test('wiring: tab, view, sheet and player exist; scripts load after main.js; Back, keys and clicks reach the module; Lite has no Sports', () => {
  const html = read('public/index.html'), main = read('public/main.js'), start = read('public/start.js');
  assert.match(html, /data-tab="sports"/); assert.match(html, /<main id="viewSports" class="view hidden">/);
  assert.match(html, /<iframe id="spFrame"[^>]*referrerpolicy="origin"[^>]*allowfullscreen/); assert.ok(!/<iframe id="spFrame"[^>]*src=/.test(html), 'no address until the player opens');
  assert.match(start, /'live\.js', 'matchora\.js', 'providers\.js', 'sports\.js'\]/);
  assert.match(main, /sports: 'viewSports'/); assert.match(main, /sports: 'sports'/); assert.match(main, /if \(t === 'sports' && EA\.sports\) EA\.sports\.show\(focusContent\)/);
  assert.match(main, /\['sports', 'ea_c_sports'\]/); assert.match(main, /\['ea_c_sports', 'Live Sports', true, SHOWN, applyCats\]/);
  assert.match(main, /if \(tab === 'sports'\) return !ED_LITE/);
  assert.match(main, /function goBack\(\) \{\n    if \(EA\.sports && EA\.sports\.back\(\)\) return;/, 'hardware Back (Tizen / Android) reaches the sheet and the player first');
  assert.match(main, /if \(EA\.sports && EA\.sports\.key\(e\)\) return;/); assert.match(main, /if \(e\.__sports && EA\.sports\)/);
  assert.match(main, /if \(state\.sportsPlay && state\.anime && state\.anime\.sports && EA\.sports\) \{ EA\.sports\.afterPlayer\(\); return; \}/, 'add-on channel: Back from the normal player returns to the match, and only for a sports title');
  assert.match(main, /directSrc\(a\.direct, a\.directRef\)/);
  assert.match(read('tools/check_compat.py'), /'matchora\.js', 'providers\.js', 'sports\.js'/);
  assert.ok(!/matchora/i.test(read('public/lite.html')), 'Lite (no hosted players) has no Matchora');
});

test('player safety in the module: the embed address is validated again before use; frames get permissions only for it; no sandbox is claimed', () => {
  const s = read('public/sports.js');
  assert.match(s, /embedFor\(ev, f\.embed\)/); assert.match(s, /not on a trusted Matchora host/);
  assert.match(s, /fr\.removeAttribute\('sandbox'\)/); assert.match(s, /fr\.setAttribute\('sandbox', rules\.sandbox\)/); assert.match(s, /autoplay; fullscreen; encrypted-media; picture-in-picture/);
  assert.ok(!/\.src = [^;]*(http|\+)/.test(s.replace(/fr\.src = url;/, '').replace(/'about:blank'/g, '')), 'the frame only ever gets the validated address or about:blank');
  assert.match(s, /exitPlayer[\s\S]*fr\.src = 'about:blank'/, 'leaving stops the stream');
  assert.match(s, /PEN\[f\.id\] = Date\.now\(\) \+ M\.PENALTY_MS/); assert.ok(!/localStorage|store\.set\([^)]*penal|ea_sp_dead/i.test(s), 'a failed channel is never stored as dead');
  assert.ok(!/matchora\.to/.test(s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '')));
  assert.ok(!/=>|`|\blet |\bconst |AbortController/.test(s.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '').replace(/'(?:\\.|[^'\\\n])*'/g, "''")), 'ES5 only');
});

test('automatic refresh: once a minute, only while the list is on screen, and the client cache keeps real requests low', () => {
  const s = read('public/sports.js');
  assert.match(s, /setInterval\(onTick, 60000\)/); assert.match(s, /function active\(\) \{ return state\.tab === 'sports' && state\.view === 'sports' && !root\.document\.hidden; \}/);
  assert.match(s, /function onTick\(\) \{ if \(active\(\)\)/); assert.match(s, /Date\.now\(\) - S\.lastRefresh < 4000/, 'manual refresh is throttled');
  assert.ok(M.TTL.live >= 20000 && M.TTL.live < 60000 && M.TTL.day >= 60000);
});
