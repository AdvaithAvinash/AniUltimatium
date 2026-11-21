/* Live Sports — the "Sports" tab: live and scheduled matches from Matchora (data: matchora.js), played either
 *   B) in Matchora's own embedded player (iframe on a trusted Matchora host), or
 *   A) through the viewer's own Stremio / Nuvio add-ons (server action sports_sources) in the app's normal player.
 * Loaded after main.js and matchora.js; talks to main.js through window.EA, like live.js and feed.js.
 * Old TVs: ES5 only, no CSS grid / gap / aspect-ratio (see tools/check_compat.py); only the first 48 cards of a long day are drawn, the rest on "Show more".
 * The pure helpers (cards, badges, saved choices) are exported for the tests; everything below the `EA` check needs the app. */
(function (root) {
  'use strict';
  var M = root.Matchora || (typeof require === 'function' ? require('./matchora.js') : null);
  var SP = root.SportProviders || (typeof require === 'function' ? require('./providers.js') : null);
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }

  // ====================================================================== pure helpers (tested)
  function initials(name) {
    var w = String(name || '').replace(/[^A-Za-z0-9À-ɏ ]+/g, ' ').split(' ').filter(Boolean);
    if (!w.length) return '?';
    return (w.length === 1 ? w[0].slice(0, 2) : w[0].charAt(0) + w[1].charAt(0)).toUpperCase();
  }
  function hueOf(name) { var h = 7, s = String(name || ''); for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360; return h; }
  // A crest: the initials are always drawn; Matchora's image (only from its own image proxy) sits on top and simply disappears if it cannot load.
  function badgeHtml(url, name, cls) {
    var src = SP.safeImg(url), bg = 'background:hsl(' + hueOf(name) + ',42%,30%)';
    return '<span class="sp-bd ' + (cls || '') + '" style="' + bg + '"><b>' + esc(initials(name)) + '</b>' + (src ? '<img src="' + esc(src) + '" alt="" data-bd="1">' : '') + '</span>';
  }
  function num(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function teamRow(name, badge, score, win) {
    return '<div class="sp-team' + (win ? ' win' : '') + '">' + badgeHtml(badge, name) + '<span class="sp-tn">' + esc(name) + '</span>' + (score == null ? '' : '<span class="sp-sc">' + esc(score) + '</span>') + '</div>';
  }
  function cardHtml(ev, nowMs, clock12) {
    var st = M.statusInfo(ev, nowMs, clock12), feeds = M.feedsOf(ev).length, sc = ev.score, two = !!(ev.home && ev.away);
    var hs = null, as = null, hw = false, aw = false;
    if (sc && sc.h != null) { hs = sc.h; as = sc.a; hw = ev.finished && sc.h > sc.a; aw = ev.finished && sc.a > sc.h; } else if (sc && sc.raw) hs = sc.raw;
    var pill = st.kind === 'live' ? '<span class="sp-pill live"><i></i>LIVE' + (st.text ? ' <em>' + esc(st.text) + '</em>' : '') + '</span>'
      : '<span class="sp-pill ' + st.kind + '">' + esc(st.label) + (st.kind === 'soon' ? ' <em>' + esc(st.text) + '</em>' : '') + '</span>';
    var teams = two ? teamRow(ev.home, ev.badges.home, hs, hw) + teamRow(ev.away, ev.badges.away, as, aw)
      : '<div class="sp-solo">' + badgeHtml(ev.badges.league, ev.league || ev.home, 'big') + '<span class="sp-tn">' + esc(ev.home || ev.away) + '</span></div>';
    return '<div class="sp-top">' + pill + (ev.watching ? '<span class="sp-view">' + num(ev.watching) + ' watching</span>' : '') + '</div>'
      + '<div class="sp-teams">' + teams + '</div>'
      + '<div class="sp-foot"><span class="sp-lg">' + esc(ev.league || ev.sport) + '</span>' + (feeds ? '<span class="sp-ch on">' + feeds + (feeds === 1 ? ' channel' : ' channels') + '</span>' : ev.lazy ? '<span class="sp-ch on">Streams available</span>' : '<span class="sp-ch">No channels yet</span>') + '</div>';
  }
  // Saved choices (the sport filter survives restarts; a sport that is not on today's list simply does not apply, it is not forgotten).
  function createPrefs(store) {
    function get(k, d) { try { var v = store.get(k, d); return v === undefined || v === null ? d : v; } catch (e) { return d; } }
    function set(k, v) { try { store.set(k, v); } catch (e) { /* ignore */ } }
    return {
      sport: function () { var s = get('ea_sp_sport', 'all'); return typeof s === 'string' && s.length < 40 ? s : 'all'; },
      setSport: function (s) { set('ea_sp_sport', s || 'all'); },
      liveOnly: function () { return get('ea_sp_live', true) !== false; },
      setLiveOnly: function (b) { set('ea_sp_live', !!b); },
      withChannels: function () { return get('ea_sp_ch', true) !== false; },
      setWithChannels: function (b) { set('ea_sp_ch', !!b); },
      src: function () { var v = get('ea_sp_src', 'matchora'); return SP.ORDER.indexOf(v) >= 0 ? v : 'matchora'; },
      setSrc: function (v) { if (SP.ORDER.indexOf(v) >= 0) set('ea_sp_src', v); }
    };
  }
  // Which frame restrictions an embed gets. Matchora's own player refuses to run in a sandboxed frame (checked), so only its validated hosts go without; every other source's player
  // is sandboxed (no pop-ups, no top-level redirects) unless the viewer turned pop-up blocking off in Settings.
  var SANDBOX = 'allow-scripts allow-same-origin allow-forms allow-presentation';
  function frameRules(url, popBlock) { var mt = !!M.safeEmbed(url); return { sandbox: mt || popBlock === false ? '' : SANDBOX, referrer: mt ? 'origin' : 'no-referrer' }; }
  // The address a feed may be opened with, or null: Matchora feeds on Matchora hosts, other sources' feeds as https on a real host (EmbedSportex only on its own domain).
  function embedFor(ev, url) { return ev && ev.src ? SP.safeHttps(url, ev.src === 'ex' ? SP.ES_HOST : null) : M.safeEmbed(url); }
  var pure = { frameRules: frameRules, embedFor: embedFor, SANDBOX: SANDBOX, initials: initials, hueOf: hueOf, badgeHtml: badgeHtml, cardHtml: cardHtml, createPrefs: createPrefs, esc: esc };
  if (typeof module === 'object' && module.exports) module.exports = pure;
  var EA = root.EA;
  if (!EA || !root.document || !M) return;

  // ====================================================================== the tab
  var $ = EA.$, el = EA.el, KEY = EA.KEY, state = EA.state, store = EA.store, toast = EA.toast, setFocus = EA.setFocus;
  var prefs = createPrefs(store), client = M.createClient(), prov = SP.create({ apiBase: EA.apiBase, matchora: client }), badges = SP.createBadges({ store: store }), PAGE = 48, PEN = {};
  var S = { liveList: [], list: [], days: [], dayIdx: 0, seq: 0, at: 0, error: null, loading: false, shown: PAGE, built: false, ev: null, feeds: [], fi: 0, cands: null, busy: false, retFocus: null, lastRefresh: 0 };
  var barTimer = null, loadTimer = null, tick = null, repaintT = null;
  function P() { return prov[prefs.src()]; }
  function provOf(ev) { return ev.src === 'ss' ? prov.sportsrc : ev.src === 'sc' ? prov.streamcenter : ev.src === 'ex' ? prov.embedsportex : prov.matchora; }
  function repaintSoon() { clearTimeout(repaintT); repaintT = setTimeout(function () { if (active()) paint(); }, 500); }
  function popBlock() { return store.get('ea_popblock', true) !== false; }

  function clock12() { var s = store.get('ea_live_set', {}); return !!(s && s.clock12); }
  function active() { return state.tab === 'sports' && state.view === 'sports' && !root.document.hidden; }
  function key2(d) { return d.a + ':' + (d.v == null ? '' : d.v); }
  function mk(tag, cls, html, d) { var e = el(tag, cls, html); if (d) { e.__sports = d; e.__spkey = key2(d); } return e; }
  function ago(t) { if (!t) return ''; var s = Math.max(0, Math.round((Date.now() - t) / 1000)); return s < 10 ? 'just now' : s < 90 ? s + ' s ago' : Math.round(s / 60) + ' min ago'; }

  // ---------------------------------------------------------------- data
  function days() { if (!S.days.length || S.days[0].key !== M.localKey(Date.now())) S.days = M.weekDays(Date.now(), 7); return S.days; }
  function refresh(force) {
    var seq = ++S.seq, liveOnly = prefs.liveOnly(), day = days()[S.dayIdx] || days()[0];
    S.loading = true; S.lastRefresh = Date.now(); paintStatus();
    var pr = P(), pLive = pr.live({ force: force }), pMain = liveOnly ? pLive : pr.day(day, { force: force });
    return Promise.all([pMain, pLive.then(function (r) { return r; }, function () { return null; })]).then(function (rs) {
      if (seq !== S.seq) return;
      var main = rs[0], live = rs[1];
      S.liveList = live ? live.data.events : S.liveList;
      S.list = liveOnly ? main.data.events : M.mergeLive(main.data.events, live ? live.data.events.filter(function (e) { return M.inDay(e, day); }) : []);
      S.at = main.at; S.error = main.error || null; S.loading = false; S.first = false;
      paint(); badges.fill(visible().slice(0, 24), repaintSoon);
    }, function (e) {
      if (seq !== S.seq) return;
      S.loading = false; S.error = e; S.first = false; if (!S.list.length) S.list = []; paint();
    });
  }
  function onTick() { if (active()) { refresh(false); } else if (state.tab === 'sports' && (state.view === 'sportssheet') && S.list.length) { /* sheet open: keep the list as it is */ } }

  // ---------------------------------------------------------------- list
  function visible() { var f = { sport: M.effectiveSport(prefs.sport(), M.sportsOf(S.list)), withChannels: prefs.withChannels() }; return M.applyFilters(S.list, f); }
  function chip(label, d, on, extra) { var b = mk('button', 'sp-chip focusable' + (on ? ' on' : '') + (extra ? ' ' + extra : ''), label, d); return b; }
  function paintStatus() {
    var s = $('spStatus'); if (!s) return;
    var txt = S.loading ? (S.list.length ? 'Updating…' : '') : (S.at ? 'Updated ' + ago(S.at) : '');
    if (S.error && S.list.length && !S.loading) txt = '⚠ ' + S.error.message + (S.at ? ' (list from ' + ago(S.at) + ')' : '');
    s.textContent = txt; s.className = 'sp-stat' + (S.error && S.list.length ? ' warn' : '');
  }
  function paint() {
    if (!S.built) return;
    var keep = state.focusEl && state.focusEl.__spkey && $('viewSports').contains(state.focusEl) ? state.focusEl.__spkey : '';
    var sports = M.sportsOf(S.list), cur = M.effectiveSport(prefs.sport(), sports), liveOnly = prefs.liveOnly(), now = Date.now();
    var head = $('spHead'); head.innerHTML = '';
    var liveN = S.liveList.length;
    head.appendChild(mk('div', 'sp-title', '<h2>Live Sports</h2><p>' + (liveN ? '<b class="sp-dot"></b>' + liveN + ' live now' : 'Nothing live right now') + ' · source: ' + esc(P().name) + '</p>'));
    var right = mk('div', 'sp-right', ''); right.appendChild(mk('span', 'sp-stat', '', null)); right.lastChild.id = 'spStatus';
    right.appendChild(mk('button', 'btn sm focusable', '↻ Refresh', { a: 'refresh' })); head.appendChild(right);
    var sb = $('spSrc'); sb.innerHTML = '<span class="sp-srclabel">Source</span>';
    SP.ORDER.forEach(function (id) { sb.appendChild(chip(esc(prov[id].name), { a: 'src', v: id }, prefs.src() === id, 'sp-srcchip')); });
    sb.appendChild(mk('span', 'sp-note', esc(P().note), null));
    var bar = $('spSports'); bar.innerHTML = '';
    bar.appendChild(chip('All Sports', { a: 'sport', v: 'all' }, cur === 'all'));
    sports.forEach(function (s) { bar.appendChild(chip(esc(s.name) + ' <i>' + s.n + '</i>', { a: 'sport', v: s.name }, cur === s.name)); });
    var saved = prefs.sport(); if (saved !== 'all' && cur === 'all') bar.appendChild(mk('span', 'sp-note', 'Saved filter “' + esc(saved) + '” has no matches in this list', null));
    var db = $('spDays'); db.innerHTML = '';
    db.appendChild(chip('<b class="sp-dot"></b>Live Now', { a: 'live' }, liveOnly, 'sp-livechip'));
    days().forEach(function (d, i) { db.appendChild(chip(esc(d.label) + ' <i>' + esc(d.sub) + '</i>', { a: 'day', v: i }, !liveOnly && S.dayIdx === i)); });
    db.appendChild(chip((prefs.withChannels() ? '✓ ' : '') + 'Only with channels', { a: 'ch' }, prefs.withChannels(), 'sp-chonly'));
    paintStatus();
    var body = $('spBody'); body.innerHTML = '';
    var list = visible();
    if (S.loading && !S.list.length && !S.error) { skeleton(body); }
    else if (S.error && !S.list.length) {
      body.appendChild(mk('div', 'sp-empty', '<h3>' + (S.error.kind === 'rate' ? esc(P().name) + ' is busy' : esc(P().name) + ' could not be reached') + '</h3><p>' + esc(S.error.message || 'Something went wrong.') + '</p>'));
      body.lastChild.appendChild(mk('button', 'btn primary focusable', 'Try again', { a: 'refresh' }));
      SP.ORDER.forEach(function (id) { if (id !== prefs.src()) body.lastChild.appendChild(mk('button', 'btn focusable sp-alt', 'Use ' + esc(prov[id].name), { a: 'src', v: id })); });
    } else if (!list.length) {
      var msg, btn;
      if (liveOnly && !S.list.length) { msg = '<h3>Nothing is live right now</h3><p>Matches appear here as soon as they start. This list refreshes by itself every minute.</p>'; btn = mk('button', 'btn primary focusable', 'Show today’s schedule', { a: 'day', v: 0 }); }
      else if (S.list.length && prefs.withChannels()) { msg = '<h3>No match with a channel yet</h3><p>' + S.list.length + ' matches are listed, but none has a channel' + (cur !== 'all' ? ' for ' + esc(cur) : '') + '.</p>'; btn = mk('button', 'btn primary focusable', 'Show matches without channels too', { a: 'ch' }); }
      else if (S.list.length && cur !== 'all') { msg = '<h3>No ' + esc(cur) + ' matches</h3><p>Try another sport.</p>'; btn = mk('button', 'btn primary focusable', 'All Sports', { a: 'sport', v: 'all' }); }
      else { msg = '<h3>No matches on this day</h3><p>Pick another day.</p>'; btn = null; }
      body.appendChild(mk('div', 'sp-empty', msg)); if (btn) body.lastChild.appendChild(btn);
    } else {
      var groups = M.groupByLeague(list), drawn = 0, limit = S.shown, more = 0;
      groups.forEach(function (g) {
        if (drawn >= limit) { more += g.events.length; return; }
        var sec = mk('section', 'sp-grp', '', null), h = mk('div', 'sp-gh', badgeHtml(g.badge, g.league, 'sm') + '<span class="sp-gn">' + esc(g.league) + '</span><span class="sp-gs">' + esc(g.sport) + (g.live ? ' · ' + g.live + ' live' : '') + '</span>');
        sec.appendChild(h);
        var cards = mk('div', 'sp-cards', '');
        g.events.forEach(function (e) {
          if (drawn >= limit) { more++; return; }
          var c = mk('button', 'sp-card focusable' + (e.live ? ' is-live' : '') + (e.finished || e.cancelled ? ' is-done' : ''), cardHtml(e, now, clock12()), { a: 'card', v: e.id });
          c.__ev = e; cards.appendChild(c); drawn++;
        });
        sec.appendChild(cards); body.appendChild(sec);
      });
      if (more > 0) body.appendChild(mk('div', 'sp-more', '', null)).appendChild(mk('button', 'btn focusable', 'Show more matches (' + more + ' left)', { a: 'more' }));
      fixBadges(body);
    }
    if (!keep && state.view === 'sports' && state.focusEl && !root.document.body.contains(state.focusEl)) { var f0 = $('viewSports').querySelector('.sp-card.focusable') || $('viewSports').querySelector('.focusable'); if (f0) setFocus(f0, true); }   // the focused skeleton / old card is gone
    if (keep) { var again = findKey(keep); if (again) setFocus(again, true); else if (state.view === 'sports') { var f = $('viewSports').querySelector('.sp-card, .sp-chip'); if (f) setFocus(f, true); } }
    if (S.focusFirst && state.view === 'sports') { var fc = $('viewSports').querySelector('.sp-card.focusable'); if (fc) { S.focusFirst = false; setFocus(fc, true); } }   // first data of a visit: the remote lands on a match
  }
  function findKey(k) { var all = $('viewSports').querySelectorAll('.focusable'); for (var i = 0; i < all.length; i++) if (all[i].__spkey === k) return all[i]; return null; }
  function skeleton(body) { var s = mk('div', 'sp-cards sp-skel', ''); for (var i = 0; i < 8; i++) s.appendChild(mk('div', 'sp-card sk', '<div class="sk-l w40"></div><div class="sk-l"></div><div class="sk-l"></div><div class="sk-l w60"></div>')); body.appendChild(s); }
  function fixBadges(scope) {                                                                      // a crest that fails to load is simply hidden: the initials under it stay
    var imgs = scope.querySelectorAll('img[data-bd]');
    for (var i = 0; i < imgs.length; i++) imgs[i].onerror = function () { this.style.display = 'none'; };
  }
  function build() {
    if (S.built) return; S.built = true;
    var v = $('viewSports'); v.innerHTML = '<div id="spHead"></div><div id="spSrc" class="sp-bar"></div><div id="spSports" class="sp-bar"></div><div id="spDays" class="sp-bar sp-days"></div><div id="spBody"></div><div id="spHint">OK open · Red ↻ refresh · Green Live Now · Yellow next source · Blue channels filter · Back to home</div>';
    tick = setInterval(onTick, 60000);
  }
  function show(focusContent) {
    build(); S.first = !S.list.length;
    if (S.first) { S.loading = true; }
    paint();
    if (!S.list.length || Date.now() - S.at > 55000 || S.error) refresh(false); else paint();
    if (focusContent !== false) { var f = $('viewSports').querySelector('.sp-card.focusable'); S.focusFirst = !f; if (!f) f = $('viewSports').querySelector('.focusable'); if (f) setFocus(f); }
  }

  // ---------------------------------------------------------------- the match sheet (choose how to watch)
  function sheetEl() { return $('spSheet'); }
  function feedRow(f, i, ev) {
    var tags = [f.country, f.quality, f.lang && f.lang !== 'Other' ? f.lang : ''].filter(Boolean).join(' · ');
    var r = mk('button', 'sp-row focusable' + (f.penalized ? ' off' : ''), '<span class="sp-rn">' + esc(f.name) + '</span><span class="sp-rt">' + esc(tags) + '</span><span class="sp-rw">' + (f.penalized ? 'may be offline' : f.playing ? '▶ ' + (f.watching ? num(f.watching) + ' watching' : 'on air') : f.watching ? num(f.watching) + ' watching' : '') + '</span>', { a: 'feed', v: i });
    return r;
  }
  function openSheet(ev) {
    S.retFocus = state.focusEl; S.ev = ev; S.cands = null; state.sportsPlay = null;
    state.view = 'sportssheet'; paintSheet();
    sheetEl().className = ''; var f = sheetEl().querySelector('.focusable'); if (f) setFocus(f, true);
    loadStreams(ev);
  }
  function loadStreams(ev, force) {                                                                  // fresh channels (and dead flags) for this one match; lazy sources only list streams now
    if (ev.src === 'ex') return;
    S.loadingStreams = !!ev.lazy; if (ev.lazy) paintSheet(true);
    provOf(ev).event(ev, { force: force }).then(function (r) {
      if (S.ev !== ev && S.ev && S.ev.id !== ev.id || state.view !== 'sportssheet') return;
      S.loadingStreams = false; S.streamError = ''; S.ev = r.data; paintSheet(true);
    }, function (e) {
      if (!S.ev || S.ev.id !== ev.id || state.view !== 'sportssheet') return;
      S.loadingStreams = false;
      if (e.kind === 'unknown') { S.streamError = ''; paintSheet(false, 'This match is no longer listed. Refreshing the list…'); S.at = 0; refresh(true); }
      else if (ev.lazy) { S.streamError = e.message || 'The streams could not be loaded.'; paintSheet(true); }
    });
  }
  function paintSheet(keepFocus, notice) {
    var ev = S.ev, box = $('spSheetBox'); if (!ev) return;
    var prevKey = keepFocus && state.focusEl && state.focusEl.__spkey || '';
    S.feeds = M.feedsOf(ev, PEN, Date.now());
    var st = M.statusInfo(ev, Date.now(), clock12()), sc = ev.score && ev.score.h != null ? ev.score.h + ' – ' + ev.score.a : ev.score ? ev.score.raw : '';
    box.innerHTML = '';
    box.appendChild(mk('div', 'sp-sh-head', '<div class="sp-sh-l">' + (ev.home && ev.away ? badgeHtml(ev.badges.home, ev.home, 'big') : badgeHtml(ev.badges.league, ev.league || ev.home, 'big')) + '<b>' + esc(ev.home) + '</b></div>'
      + '<div class="sp-sh-m"><span class="sp-pill ' + st.kind + '">' + (st.kind === 'live' ? '<i></i>LIVE' + (st.text ? ' <em>' + esc(st.text) + '</em>' : '') : esc(st.label)) + '</span><strong>' + esc(sc || (ev.kickoff ? M.fmtClock(ev.kickoff, clock12()) : '')) + '</strong><small>' + esc(ev.league) + (ev.kickoff ? ' · ' + (new Date(ev.kickoff * 1000)).toLocaleDateString() : '') + '</small></div>'
      + (ev.away ? '<div class="sp-sh-r"><b>' + esc(ev.away) + '</b>' + badgeHtml(ev.badges.away, ev.away, 'big') + '</div>' : '')));
    if (notice) box.appendChild(mk('p', 'sp-sh-note', esc(notice)));
    box.appendChild(mk('h4', '', ev.src ? 'Watch · ' + esc(provOf(ev).name) : 'Watch in the Matchora player'));
    if (S.feeds.length) {
      if (ev.embed) box.appendChild(mk('button', 'sp-row focusable best', '<span class="sp-rn">Matchora player · all channels</span><span class="sp-rt">Pick the channel inside the player</span><span class="sp-rw">▶ Play</span>', { a: 'match' }));
      S.feeds.slice(0, 14).forEach(function (f, i) { box.appendChild(feedRow(f, i, ev)); });
      if (S.feeds.length > 14) box.appendChild(mk('p', 'sp-sh-note', (S.feeds.length - 14) + ' more channels are listed inside the Matchora player.'));
    } else if (S.loadingStreams) box.appendChild(mk('p', 'sp-sh-note', 'Looking for streams…'));
    else if (S.streamError) { box.appendChild(mk('p', 'sp-sh-note', esc(S.streamError))); box.appendChild(mk('button', 'sp-row focusable', '<span class="sp-rn">Try again</span>', { a: 'reload' })); }
    else box.appendChild(mk('p', 'sp-sh-note', ev.live ? 'No channel is available for this match right now. Try another source (back to the list, Source), or your add-ons below.' : 'No channels yet — they usually appear shortly before kick-off.'));
    var ad = EA.addons ? EA.addons() : { n: 0 };
    if (!ev.src) box.appendChild(mk('h4', '', 'Find it in your add-ons'));      // the other sources' feeds are server labels, not TV channel names: nothing to look up in add-ons
    if (ev.src) { /* no add-on search for these */ }
    else if (!ad.n) box.appendChild(mk('p', 'sp-sh-note', 'Add a Stremio or Nuvio add-on that offers live TV (Settings → Extra sources → Add-ons) to look for this match in your own channels.'));
    else if (!S.feeds.length && !M.channelTerms(ev, 1).length) box.appendChild(mk('p', 'sp-sh-note', 'No channel names are known for this match yet, so there is nothing to look for.'));
    else {
      box.appendChild(mk('button', 'sp-row focusable', '<span class="sp-rn">' + (S.busy ? 'Searching your add-ons…' : S.cands ? 'Search again' : 'Search your ' + ad.n + ' add-on' + (ad.n === 1 ? '' : 's')) + '</span><span class="sp-rt">Looks for the same channels as above</span><span class="sp-rw">⌕</span>', { a: 'find' }));
      if (S.cands) {
        if (!S.cands.matches.length) box.appendChild(mk('p', 'sp-sh-note', S.cands.tvAddons ? 'None of your add-ons has these channels.' : 'None of your add-ons offers live TV channels.'));
        S.cands.matches.forEach(function (c, i) { box.appendChild(mk('button', 'sp-row focusable', '<span class="sp-rn">' + esc(c.channel) + '</span><span class="sp-rt">' + esc([c.addon, c.res ? c.res + 'p' : '', c.hls ? 'HLS' : ''].filter(Boolean).join(' · ')) + '</span><span class="sp-rw">' + (c.verified ? '✓ checked' : c.checked ? 'unchecked' : '') + '</span>', { a: 'cand', v: i })); });
      }
    }
    box.appendChild(mk('button', 'sp-row focusable close', '<span class="sp-rn">◄ Back to matches</span>', { a: 'close' }));
    fixBadges(box);
    var again = prevKey && findIn(box, prevKey); if (again) setFocus(again, true);
  }
  function findIn(box, k) { var all = box.querySelectorAll('.focusable'); for (var i = 0; i < all.length; i++) if (all[i].__spkey === k) return all[i]; return null; }
  function closeSheet() {
    sheetEl().className = 'hidden'; state.view = 'sports'; S.ev = null; S.cands = null; S.busy = false;
    var f = S.retFocus && root.document.body.contains(S.retFocus) ? S.retFocus : (S.retFocus && S.retFocus.__spkey ? findKey(S.retFocus.__spkey) : null);
    if (!f) f = $('viewSports').querySelector('.sp-card, .focusable');
    if (f) setFocus(f);
  }

  // ---------------------------------------------------------------- Option A: the viewer's add-ons
  function getJson(url, ms) {
    return new Promise(function (resolve, reject) {
      var t = setTimeout(function () { reject(new Error('The server did not answer in time')); }, ms);
      root.fetch(url).then(function (r) { return r.json().catch(function () { return {}; }).then(function (j) { clearTimeout(t); if (!r.ok) reject(new Error(j.error || 'HTTP ' + r.status)); else resolve(j); }); }, function (e) { clearTimeout(t); reject(e); });
    });
  }
  function findInAddons() {
    if (S.busy || !S.ev) return; var ev = S.ev, ad = EA.addons(), terms = M.channelTerms(ev, 6);
    S.busy = true; paintSheet(true);
    var url = EA.apiBase() + '/api?action=sports_sources&addons=' + encodeURIComponent(ad.list) + '&names=' + encodeURIComponent(ad.names) + '&terms=' + encodeURIComponent(JSON.stringify(terms));
    getJson(url, 40000).then(function (j) { if (S.ev !== ev) return; S.busy = false; S.cands = { matches: j.matches || [], tvAddons: j.tvAddons || 0 }; paintSheet(true); }, function (e) {
      if (S.ev !== ev) return; S.busy = false; S.cands = null; paintSheet(true, e.message || 'The search failed.'); });
  }
  function playCand(c) {
    var ev = S.ev; if (!ev || !c || !/^https?:\/\//i.test(c.url)) return;
    var ref = c.headers && (c.headers.Referer || c.headers.referer) || '';
    state.sportsPlay = { ev: ev }; state.returnFocus = state.focusEl;
    EA.play({ id: 'sports:' + ev.id + ':' + c.id, kind: 'movie', title: (ev.away ? ev.home + ' v ' + ev.away : ev.home) + ' · ' + c.channel, direct: c.url, directRef: ref, sports: true }, 1, 0);
  }
  function afterPlayer() {                                                                          // main.js closePlayer: back to the sheet
    state.view = 'sportssheet'; state.sportsPlay = null;
    var f = sheetEl().querySelector('.focusable'); if (state.returnFocus && root.document.body.contains(state.returnFocus)) f = state.returnFocus; if (f) setFocus(f, true);
  }

  // ---------------------------------------------------------------- Option B: the Matchora embed player
  function embedFrame() { return $('spFrame'); }
  function playFeed(i) {
    var f = S.feeds[i], ev = S.ev; if (!f && i !== -1) return;
    var url = i === -1 ? M.safeEmbed(ev.embed) : embedFor(ev, f.embed);                             // checked again right before it is used
    if (!url) { toast('That player address was not accepted (' + (ev.src ? 'not a safe https address' : 'not on a trusted Matchora host') + '), so it was not opened'); return; }
    S.fi = i; var fr = embedFrame();
    $('spPlayer').className = ''; state.view = 'sportsplay';
    // Matchora's player refuses to run in a sandboxed frame (checked), so only its validated hosts go without; other sources' players are sandboxed (no pop-ups, no top-level redirects).
    // The Android app also refuses pop-ups and redirects (MainActivity). The sandbox attribute is set before the address.
    var rules = frameRules(url, popBlock());
    if (rules.sandbox) fr.setAttribute('sandbox', rules.sandbox); else fr.removeAttribute('sandbox');
    fr.setAttribute('referrerpolicy', rules.referrer);
    fr.setAttribute('allow', 'autoplay; fullscreen; encrypted-media; picture-in-picture');                // permissions are granted to the validated address only
    $('spLoad').className = 'sp-load'; $('spLoadTxt').textContent = 'Opening ' + (i === -1 ? 'the player' : f.name) + '…';
    fr.onload = function () { clearTimeout(loadTimer); $('spLoad').className = 'sp-load hidden'; };
    clearTimeout(loadTimer);
    loadTimer = setTimeout(function () {
      if (state.view !== 'sportsplay') return;
      if (i !== -1 && f) PEN[f.id] = Date.now() + M.PENALTY_MS;                                                      // only moves it down this list for a few minutes
      $('spLoadTxt').textContent = 'This channel is slow to open. Press ◄ ► for another channel.'; showBar();
    }, 25000);
    fr.src = url;
    paintBar(); showBar();
  }
  function paintBar() {
    var ev = S.ev, f = S.fi === -1 ? null : S.feeds[S.fi]; if (!ev) return;
    $('spTitle').textContent = (ev.away ? ev.home + ' v ' + ev.away : ev.home);
    $('spChan').textContent = S.fi === -1 ? 'All channels' : f ? f.name + (f.country ? ' ' + f.country : '') + (f.quality ? ' · ' + f.quality : '') + '  (' + (S.fi + 1) + '/' + S.feeds.length + ')' : '';
  }
  function showBar() { $('spBar').className = 'sp-bar-on'; clearTimeout(barTimer); barTimer = setTimeout(function () { $('spBar').className = ''; }, 7000); }
  function step(d) {
    if (!S.feeds.length) return; var n = S.fi === -1 ? (d > 0 ? 0 : S.feeds.length - 1) : (S.fi + d + S.feeds.length) % S.feeds.length;
    playFeed(n);
  }
  function exitPlayer() {
    clearTimeout(loadTimer); clearTimeout(barTimer);
    var fr = embedFrame(); fr.onload = null; fr.src = 'about:blank'; $('spPlayer').className = 'hidden'; $('spBar').className = '';
    try { root.document.activeElement && root.document.activeElement.blur(); } catch (e) { /* ignore */ }
    state.view = 'sportssheet'; var f = sheetEl().querySelector('.focusable'); if (state.focusEl && sheetEl().contains(state.focusEl)) f = state.focusEl; if (f) setFocus(f, true);
  }

  // ---------------------------------------------------------------- input
  function activate(e) {
    var d = e.__sports; if (!d) return;
    switch (d.a) {
      case 'refresh': if (Date.now() - S.lastRefresh < 4000) { toast('Just updated'); return; } S.error = null; refresh(true); break;
      case 'sport': prefs.setSport(d.v); S.shown = PAGE; paint(); break;
      case 'live': prefs.setLiveOnly(true); S.shown = PAGE; S.list = []; S.at = 0; S.loading = true; paint(); refresh(false); break;
      case 'day': prefs.setLiveOnly(false); S.dayIdx = d.v; S.shown = PAGE; S.list = []; S.at = 0; S.loading = true; paint(); refresh(false); break;
      case 'ch': prefs.setWithChannels(!prefs.withChannels()); S.shown = PAGE; paint(); break;
      case 'more': S.shown += PAGE; paint(); break;
      case 'card': openSheet(e.__ev); break;
      case 'feed': playFeed(d.v); break;
      case 'match': playFeed(-1); break;
      case 'find': findInAddons(); break;
      case 'reload': S.streamError = ''; loadStreams(S.ev, true); break;
      case 'src': if (prefs.src() === d.v) break; prefs.setSrc(d.v); S.list = []; S.liveList = []; S.at = 0; S.error = null; S.shown = PAGE; S.loading = true; paint(); refresh(false); break;
      case 'cand': playCand(S.cands && S.cands.matches[d.v]); break;
      case 'close': closeSheet(); break;
      case 'barback': exitPlayer(); break;
      case 'barprev': step(-1); break;
      case 'barnext': step(1); break;
    }
  }
  function back() {
    if (state.view === 'sportsplay') { exitPlayer(); return true; }
    if (state.view === 'sportssheet') { closeSheet(); return true; }
    return false;
  }
  function onKey(e) {
    var k = e.keyCode, v = state.view;
    if (v === 'sports' && state.tab === 'sports') {                                                  // colour keys: Red refresh, Green Live Now, Yellow next source, Blue channels filter
      var act = k === 403 ? { a: 'refresh' } : k === 404 ? { a: 'live' } : k === 405 ? { a: 'src', v: SP.ORDER[(SP.ORDER.indexOf(prefs.src()) + 1) % SP.ORDER.length] } : k === 406 ? { a: 'ch' } : null;
      if (act) { e.preventDefault(); activate({ __sports: act }); return true; }
      return false;
    }
    if (v === 'sportsplay') {
      e.preventDefault();
      if (EA.isBackKey(k) || k === KEY.STOP) { state.lastBack = Date.now(); exitPlayer(); }
      else if (k === KEY.LEFT || k === KEY.RW || k === 428) { step(-1); }                           // Left / rewind / channel down: previous channel
      else if (k === KEY.RIGHT || k === KEY.FF || k === 427) { step(1); }                           // Right / fast-forward / channel up: next channel
      else if (k === 403 || k === 457) { showBar(); }                                               // Red / Info: show the bar
      else if (k === KEY.ENTER) { try { embedFrame().focus(); } catch (er) { /* ignore */ } toast('Player selected — press Back to leave'); showBar(); }
      else showBar();
      return true;
    }
    if (v === 'sportssheet') {
      e.preventDefault();
      if (EA.isBackKey(k) || k === KEY.STOP) { state.lastBack = Date.now(); closeSheet(); return true; }
      var rows = sheetEl().querySelectorAll('.focusable'), i = -1, j;
      for (j = 0; j < rows.length; j++) if (rows[j] === state.focusEl) i = j;
      if (k === KEY.DOWN) i = Math.min(rows.length - 1, i + 1); else if (k === KEY.UP) i = Math.max(0, i - 1);
      else if (k === KEY.ENTER) { if (state.focusEl) activate(state.focusEl); return true; } else return true;
      if (rows[i]) { setFocus(rows[i], true); var box = $('spSheetBox'), r = rows[i].getBoundingClientRect(), b = box.getBoundingClientRect(); if (r.top < b.top + 8) box.scrollTop -= b.top + 8 - r.top; else if (r.bottom > b.bottom - 8) box.scrollTop += r.bottom - b.bottom + 8; }
      return true;
    }
    return false;
  }
  function onFocus() {}
  root.document.addEventListener('visibilitychange', function () { if (!root.document.hidden && active() && Date.now() - S.at > 60000) refresh(false); });

  EA.sports = { show: show, key: onKey, activate: activate, back: back, onFocus: onFocus, afterPlayer: afterPlayer, refresh: refresh,
    _debug: function () { return { S: S, client: client, prefs: prefs }; } };
  if (EA.paintTabs) EA.paintTabs();                                                                  // the tab exists now
  if (state.tab === 'sports') show(false);                                                          // "Start on: Sports"
})(typeof window !== 'undefined' ? window : this);
