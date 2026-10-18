// Aniultimatium "Feed": what is airing and what is new for YOU.
//   Schedule tab   a week of airing episodes (yesterday + the next 6 days) in your local time, filter "My list", bell reminders
//   Airing info    next-episode countdowns on cards, the hero and the detail page (filled in from AniList when the home data lacks them)
//   Alerts         "New episodes for you": shows you follow (list, history, reminders) that have episodes you have not watched yet
//   Recommendations "Because you watched ..." on the home page, and "Seasons & related" / "You may also like" on a show's page
// Everything is read straight from AniList by the device (through the app's rate-limited AniList queue) and cached on the device. No account needed.
// Plain ES5 (Tizen 4 = Chromium 56). Loaded after main.js; talks to it through window.EA.
(function () {
  'use strict';
  var EA = window.EA; if (!EA) return;
  var $ = EA.$, el = EA.el, esc = EA.esc, store = EA.store, state = EA.state, toast = EA.toast, setFocus = EA.setFocus;
  var DAY = 86400;

  // ------------------------------------------------------------------ small cache (shared by everything below)
  function cget(k, ttl) { var c = store.get('ea_fc', {}); var e = c[k]; return e && Date.now() - e.t < ttl ? e.d : null; }
  function cput(k, d) {
    var c = store.get('ea_fc', {}); c[k] = { t: Date.now(), d: d };
    var ks = Object.keys(c); if (ks.length > 40) { ks.sort(function (a, b) { return c[a].t - c[b].t; }); for (var i = 0; i < ks.length - 40; i++) delete c[ks[i]]; }
    store.set('ea_fc', c);
  }
  var FIELDS = 'id idMal title{romaji english} coverImage{extraLarge large color} bannerImage description(asHtml:false) episodes status format seasonYear averageScore genres synonyms popularity isAdult nextAiringEpisode{episode airingAt}';
  function mapFull(m) {                                                              // AniList media -> the app's anime object (+ next airing)
    var a = EA.aniMap(m);
    a.next = m.nextAiringEpisode && m.nextAiringEpisode.airingAt ? { ep: m.nextAiringEpisode.episode, at: m.nextAiringEpisode.airingAt } : null;
    return a;
  }
  function followed() {                                                              // anime ids the viewer follows: list (not finished / dropped), recent history, reminders
    var ids = {}, out = [];
    (store.get('ea_list', []) || []).forEach(function (x) { if (x.kind === 'anime' && x.st !== 'completed' && x.st !== 'dropped') ids[x.id] = 1; });
    (EA.getHist() || []).slice(0, 30).forEach(function (h) { if (h.anime && h.anime.kind === 'anime') { var it = EA.listItem(h.anime); if (!it || (it.st !== 'completed' && it.st !== 'dropped')) ids[h.anime.id] = 1; } });
    var rm = store.get('ea_remind', {}); Object.keys(rm).forEach(function (k) { ids[k] = 1; });
    Object.keys(ids).forEach(function (k) { out.push(+k); });
    return out.slice(0, 50);
  }

  // ------------------------------------------------------------------ airing info for cards / hero / detail
  function enrichHome(rows) {
    if (store.get('ea_airbadge', true) === false) return;
    var want = [], seen = {}, nx = store.get('ea_next', {}) || {}, now = Date.now(), dirty = false;
    function take(a) {
      if (!a || a.kind !== 'anime' || seen[a.id]) return; seen[a.id] = 1;
      if (a.next) return;
      var c = nx[a.id];
      if (c && now - c.t < 30 * 60000) { if (c.at) a.next = { ep: c.ep, at: c.at }; return; }
      want.push(a);
    }
    (rows || []).forEach(function (r) { (r.items || []).forEach(take); });
    (state.hero || []).forEach(take);
    function done() { EA.paintAirBadges(); if (state.hero && state.hero[state.heroIdx] && state.hero[state.heroIdx].next && EA.showHero) EA.showHero(state.heroIdx, true); }
    if (!want.length) { done(); return; }
    var byId = {}, ids = []; want.slice(0, 100).forEach(function (a) { byId[a.id] = a; ids.push(a.id); });
    function batch(i) {
      var part = ids.slice(i, i + 50); if (!part.length) { store.set('ea_next', nx); done(); return; }
      EA.aniQuery('query($ids:[Int]){Page(perPage:50){media(id_in:$ids,type:ANIME){id nextAiringEpisode{episode airingAt}}}}', { ids: part }).then(function (d) {
        var got = {}; ((d.Page && d.Page.media) || []).forEach(function (m) { got[m.id] = m.nextAiringEpisode; });
        part.forEach(function (id) { var n = got[id], a = byId[id]; nx[id] = n && n.airingAt ? { ep: n.episode, at: n.airingAt, t: now } : { ep: 0, at: 0, t: now }; if (n && n.airingAt) a.next = { ep: n.episode, at: n.airingAt }; });
        dirty = true; done(); batch(i + 50);
      }).catch(function () { if (dirty) store.set('ea_next', nx); });
    }
    batch(0);
  }

  // ------------------------------------------------------------------ alerts: new episodes for shows you follow
  var alertBusy = false;
  function progEp(a) {
    var best = 0, p = EA.progOf(a); if (p && p.ep > best) best = p.ep;
    (EA.getHist() || []).forEach(function (h) { if (h.key === EA.keyOf(a) && h.ep > best) best = h.ep; });
    return best;
  }
  function checkAlerts(cb) {
    var c = cget('alerts', 30 * 60000); if (c) { cb(c); return; }
    var ids = followed(); if (!ids.length || alertBusy) { cb([]); return; }
    alertBusy = true;
    EA.aniQuery('query($ids:[Int]){Page(perPage:50){media(id_in:$ids,type:ANIME){' + FIELDS + '}}}', { ids: ids }).then(function (d) {
      alertBusy = false;
      var rm = store.get('ea_remind', {}), out = [];
      ((d.Page && d.Page.media) || []).forEach(function (m) {
        if (m.isAdult) return;
        var a = mapFull(m), last = m.nextAiringEpisode ? m.nextAiringEpisode.episode - 1 : (m.status === 'FINISHED' ? m.episodes : 0);
        if (!last || last < 1) return;
        var w = progEp(a), base = rm[a.id] ? rm[a.id].base || 0 : 0, from = Math.max(w, base);
        var following = w > 0 || !!rm[a.id] || (EA.listItem(a) && EA.listItem(a).st === 'watching');
        if (following && last > from) out.push({ id: a.id, a: slimAlert(a), aired: last, behind: last - w });
      });
      out.sort(function (x, y) { return x.behind - y.behind; });
      cput('alerts', out); cb(out);
    }).catch(function () { alertBusy = false; cb([]); });
  }
  function slimAlert(a) { return { id: a.id, kind: 'anime', mal: a.mal, title: a.title, titleRomaji: a.titleRomaji, cover: a.cover, coverSm: a.coverSm, banner: a.banner, color: a.color, description: (a.description || '').slice(0, 400), episodes: a.episodes, format: a.format, year: a.year, status: a.status, genres: a.genres, synonyms: a.synonyms, score: a.score, next: a.next }; }

  // ------------------------------------------------------------------ recommendations
  function recsFor(h, cb) {
    var k = 'recs:' + h.id, c = cget(k, 12 * 3600000); if (c) { cb(c); return; }
    EA.aniQuery('query($id:Int){Media(id:$id){recommendations(sort:RATING_DESC,perPage:24){nodes{rating mediaRecommendation{' + FIELDS + '}}}}}', { id: h.id }).then(function (d) {
      var nodes = (((d.Media || {}).recommendations || {}).nodes || []), out = [];
      nodes.forEach(function (n) { var m = n.mediaRecommendation; if (m && !m.isAdult && (n.rating || 0) > 0) out.push(slimAlert(mapFull(m))); });
      cput(k, out); cb(out);
    }).catch(function () { cb([]); });
  }
  function lastWatched() { var h = EA.getHist() || []; for (var i = 0; i < h.length; i++) if (h[i].anime && h[i].anime.kind === 'anime') return h[i].anime; return null; }
  function hiddenRow(t) { var pr = store.get('ea_rows', null); return !!(pr && pr.hide && pr.hide[t]); }

  // ------------------------------------------------------------------ home rows (called by main.js after Continue Watching)
  function insertAfterTop(row) {
    var rows = $('rows'); if (!rows) return;
    var ref = rows.querySelector('.row:not(.cont):not(.alrow):not(.feedrow)'); rows.insertBefore(row, ref);
  }
  function renderRows() {
    var rows = $('rows'); if (!rows || state.mode !== 'anime') return;
    var olds = rows.querySelectorAll('.row.feedrow'); for (var i = 0; i < olds.length; i++) olds[i].parentNode.removeChild(olds[i]);
    var cont = rows.querySelector('.row.cont'); if (!rows.querySelector('.row')) return;          // the home page is not drawn yet
    if (store.get('ea_alerts', true) !== false && !hiddenRow('New episodes for you')) checkAlerts(function (list) {
      if (!list.length || state.mode !== 'anime' || rows.querySelector('.row.feedrow.new')) return;
      var row = EA.makeRow('New episodes for you', list.map(function (x) { return x.a; }), 'feedrow new', function (a) { var it = list.filter(function (x) { return x.id === a.id; })[0]; return { al: true, ep: it ? it.aired : 0 }; });
      insertAfterTop(row); EA.paintAirBadges();
    });
    var lw = lastWatched();
    if (lw && store.get('ea_recs', true) !== false && !hiddenRow('Because you watched')) recsFor(lw, function (list) {
      var mine = {}; (EA.getHist() || []).forEach(function (h) { mine[EA.keyOf(h.anime)] = 1; });
      list = list.filter(function (a) { return !mine[EA.keyOf(a)]; }).slice(0, 18);
      if (!list.length || state.mode !== 'anime' || rows.querySelector('.row.feedrow.recs')) return;
      var row = EA.makeRow('Because you watched ' + EA.tname(lw), list, 'feedrow recs');
      var n = rows.querySelector('.row.feedrow.new'); if (n) rows.insertBefore(row, n.nextSibling); else insertAfterTop(row);
      EA.paintAirBadges();
    });
  }

  // ------------------------------------------------------------------ detail page: related + recommendations (+ the show's own next episode)
  var REL = { PREQUEL: 'Prequel', SEQUEL: 'Sequel', PARENT: 'Parent story', SIDE_STORY: 'Side story', SPIN_OFF: 'Spin-off', ALTERNATIVE: 'Alternative', SUMMARY: 'Summary', COMPILATION: 'Compilation' };
  function detailMore(a) {
    var box = $('dMore'); if (!box) return; box.innerHTML = '';
    if (!a || a.kind !== 'anime') return;
    var k = 'more:' + a.id, c = cget(k, 12 * 3600000);
    function draw(d) {
      if (state.anime !== a || state.view !== 'detail') return;
      if (d.next && (!a.next || a.next.at !== d.next.at)) { a.next = d.next; if (EA.refreshDetailTags) EA.refreshDetailTags(a); }
      box.innerHTML = '';
      if (d.rel && d.rel.length) { var r1 = EA.makeRow('Seasons & related', d.rel.map(function (x) { return x.a; }), 'moreRow', function (a2) { var x = d.rel.filter(function (y) { return y.a.id === a2.id; })[0]; return { rel: x ? x.label : '' }; }); box.appendChild(r1); }
      if (d.recs && d.recs.length) box.appendChild(EA.makeRow('You may also like', d.recs, 'moreRow'));
      EA.paintAirBadges();
    }
    if (c) { draw(c); return; }
    EA.aniQuery('query($id:Int){Media(id:$id){nextAiringEpisode{episode airingAt} relations{edges{relationType node{' + FIELDS + ' type}}} recommendations(sort:RATING_DESC,perPage:16){nodes{rating mediaRecommendation{' + FIELDS + '}}}}}', { id: a.id }).then(function (r) {
      var m = r.Media || {}, rel = [], recs = [];
      ((m.relations || {}).edges || []).forEach(function (e) { var n = e.node; if (n && n.type === 'ANIME' && REL[e.relationType] && !n.isAdult) rel.push({ label: REL[e.relationType], a: slimAlert(mapFull(n)) }); });
      ((m.recommendations || {}).nodes || []).forEach(function (n) { var x = n.mediaRecommendation; if (x && !x.isAdult && (n.rating || 0) > 0) recs.push(slimAlert(mapFull(x))); });
      var d = { next: m.nextAiringEpisode && m.nextAiringEpisode.airingAt ? { ep: m.nextAiringEpisode.episode, at: m.nextAiringEpisode.airingAt } : null, rel: rel, recs: recs.slice(0, 14) };
      cput(k, d); draw(d);
    }).catch(function () { /* AniList busy: the rest of the page is already usable */ });
  }

  // ------------------------------------------------------------------ Schedule tab
  var S = { day: 1, filter: 'all', days: [], data: {} };
  function startOfToday() { var d = new Date(); d.setHours(0, 0, 0, 0); return Math.floor(d.getTime() / 1000); }
  function buildDays() {
    var base = startOfToday(), n = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], mo = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    S.days = [];
    for (var i = 0; i < 8; i++) {
      var t = base + (i - 1) * DAY, d = new Date(t * 1000 + 12 * 3600 * 1000);                  // noon: safe across daylight-saving changes
      S.days.push({ t: t, top: i === 0 ? 'Yesterday' : i === 1 ? 'Today' : i === 2 ? 'Tomorrow' : n[d.getDay()], sub: mo[d.getMonth()] + ' ' + d.getDate() });
    }
  }
  function fetchDay(i, cb) {
    var day = S.days[i], key = 'sch:' + day.t, c = cget(key, i === 0 ? 6 * 3600000 : 20 * 60000);
    if (c) { cb(c); return; }
    var q = 'query($a:Int,$b:Int,$p:Int){Page(page:$p,perPage:50){pageInfo{hasNextPage} airingSchedules(airingAt_greater:$a,airingAt_lesser:$b,sort:TIME){airingAt episode media{id title{romaji english} coverImage{large color} format episodes averageScore isAdult countryOfOrigin popularity}}}}';
    var out = [];
    function page(p) {
      EA.aniQuery(q, { a: day.t - 1, b: day.t + DAY, p: p }).then(function (d) {
        var pg = d.Page || {};
        (pg.airingSchedules || []).forEach(function (x) {
          var m = x.media; if (!m || m.isAdult) return;
          out.push({ id: m.id, t: m.title.english || m.title.romaji, r: m.title.romaji, c: m.coverImage.large, col: m.coverImage.color || null, ep: x.episode, at: x.airingAt, f: m.format, n: m.episodes || null, s: m.averageScore ? (m.averageScore / 10).toFixed(1) : null, p: m.popularity || 0 });
        });
        if (pg.pageInfo && pg.pageInfo.hasNextPage && p < 3) page(p + 1); else { cput(key, out); cb(out); }
      }).catch(function (e) { if (out.length) { cb(out); return; } cb(null, e); });
    }
    page(1);
  }
  function mineIds() { var m = {}; followed().forEach(function (id) { m[id] = 1; }); (store.get('ea_list', []) || []).forEach(function (x) { if (x.kind === 'anime') m[x.id] = 1; }); return m; }
  function fmtStatus(x) {
    var now = Date.now() / 1000;
    if (x.at <= now) return { cls: 'aired', text: 'AIRED' };
    var m = Math.round((x.at - now) / 60);
    if (m < 60 * 20) return { cls: 'soon', text: EA.airIn(x.at).toUpperCase() };
    return { cls: 'up', text: 'UPCOMING' };
  }
  function paintDays() {
    var box = $('schDays'); box.innerHTML = '';
    S.days.forEach(function (d, i) { var b = el('button', 'sch-day focusable' + (i === S.day ? ' on' : ''), '<b>' + esc(d.top) + '</b><span>' + esc(d.sub) + '</span>'); b.__feed = { k: 'day', i: i }; box.appendChild(b); });
    var bar = $('schBar'); bar.innerHTML = '';
    [['all', 'All shows'], ['mine', 'My list & follows']].forEach(function (f) { var b = el('button', 'chip focusable' + (S.filter === f[0] ? ' on' : ''), f[1]); b.__feed = { k: 'filter', v: f[0] }; bar.appendChild(b); });
  }
  function paintList(list) {
    var box = $('schList'); box.innerHTML = ''; $('schMsg').textContent = '';
    if (!list) { $('schMsg').innerHTML = 'Could not load the schedule (AniList is busy or offline). <button class="retry focusable" id="schRetry">Retry</button>'; var r = $('schRetry'); if (r) r.__feed = { k: 'retry' }; return; }
    var mine = S.filter === 'mine' ? mineIds() : null, rm = store.get('ea_remind', {}), shown = list.filter(function (x) { return !mine || mine[x.id]; });
    if (!shown.length) { $('schMsg').textContent = S.filter === 'mine' ? 'None of your list or followed shows air on this day. Tap the bell on a show to follow it.' : 'Nothing airs on this day.'; return; }
    var lastTime = '', firstUpcoming = null;
    shown.forEach(function (x) {
      var tm = EA.fmtTime(x.at); if (tm !== lastTime) { lastTime = tm; box.appendChild(el('div', 'sch-time', '<i></i>' + esc(tm))); }
      var st = fmtStatus(x), row = el('div', 'sch-row');
      var it = el('div', 'sch-item focusable' + (st.cls === 'aired' ? ' past' : ''), '<span class="si-img"><img alt="" src="' + esc(x.c || '') + '"></span><span class="si-main"><b>' + esc(store.get('ea_tlang', 'en') === 'romaji' ? x.r : x.t) + '</b><em>Episode ' + x.ep + (x.n ? ' of ' + x.n : '') + '</em><span class="si-tags">' +
        (x.f ? '<i>' + esc(String(x.f).replace(/_/g, ' ')) + '</i>' : '') + (x.s ? '<i>★ ' + esc(x.s) + '</i>' : '') + (mine && false ? '' : '') + '</span></span><span class="si-side"><b>' + esc(tm) + '</b><span class="si-st ' + st.cls + '">' + esc(st.text) + '</span></span>');
      it.__feed = { k: 'open', x: x }; row.appendChild(it);
      var bell = el('button', 'si-bell focusable' + (rm[x.id] ? ' on' : ''), EA.ic('bell')); bell.title = 'Remind me'; bell.__feed = { k: 'bell', x: x }; row.appendChild(bell);
      box.appendChild(row);
      if (!firstUpcoming && x.at > Date.now() / 1000) firstUpcoming = it;
    });
    S.firstUpcoming = firstUpcoming;
  }
  function loadDay(focus) {
    $('schMsg').textContent = 'Loading…'; $('schList').innerHTML = '';
    var i = S.day;
    fetchDay(i, function (list, err) {
      if (S.day !== i || state.tab !== 'schedule') return;
      S.data = list; paintList(list);
      if (focus === 'list') { var t = i === 1 && S.firstUpcoming || $('schList').querySelector('.sch-item'); if (t) setFocus(t); }
    });
  }
  function show(focusContent) {
    buildDays(); if (S.day < 0 || S.day > 7) S.day = 1;
    paintDays(); loadDay();
    if (focusContent !== false) { var on = $('schDays').querySelector('.sch-day.on'); if (on) setFocus(on); }
  }
  function openShow(x) {
    toast('Opening…');
    EA.aniQuery('query($id:Int){Media(id:$id){' + FIELDS + '}}', { id: x.id }).then(function (d) { if (d.Media) EA.openDetail(mapFull(d.Media)); else throw new Error('x'); }).catch(function () {
      EA.openDetail({ id: x.id, kind: 'anime', title: x.t, titleRomaji: x.r, cover: x.c, coverSm: x.c, banner: null, color: x.col, description: '', episodes: x.n, format: x.f, genres: [], synonyms: [], score: x.s, next: null });
    });
  }
  function activate(e) {
    var f = e.__feed;
    if (f.k === 'day') { S.day = f.i; paintDays(); loadDay(); var on = $('schDays').querySelector('.sch-day.on'); if (on) setFocus(on, true); return; }
    if (f.k === 'filter') { S.filter = f.v; paintDays(); paintList(S.data); var bs = $('schBar').querySelectorAll('.chip'); for (var i = 0; i < bs.length; i++) if (bs[i].__feed.v === f.v) setFocus(bs[i], true); return; }
    if (f.k === 'retry') { loadDay(); return; }
    if (f.k === 'open') { openShow(f.x); return; }
    if (f.k === 'bell') {
      var rm = store.get('ea_remind', {}), id = f.x.id;
      if (rm[id]) { delete rm[id]; toast('Reminder removed'); } else { rm[id] = { t: f.x.t, base: Math.max(0, f.x.ep - 1) }; toast('Following ' + f.x.t + ' — new episodes show on your home page'); }
      store.set('ea_remind', rm); cput('alerts', null); e.className = 'si-bell focusable focused' + (rm[id] ? ' on' : '');
    }
  }

  EA.feed = { show: show, activate: activate, renderRows: renderRows, enrichHome: enrichHome, detailMore: detailMore, _checkAlerts: checkAlerts, _fetchDay: fetchDay, _followed: followed };
}());
