/* Live TV — the IPTV section (UI, library, zapping player). Loaded after main.js; talks to it through window.EA.
 * Design rules that keep it fast on a 2018 TV (Chromium 56):
 *   - lists are virtual: only ~13 row elements exist whatever the list size (60,000 channels cost the same as 60);
 *   - parsing, downloading and the TV guide run in a Web Worker (see iptv.js); channels appear while they stream in;
 *   - logos load only once scrolling settles, and a failed logo is never retried;
 *   - zapping updates the banner at once and starts the stream only when the remote pauses.
 * ES5 on purpose. */
(function () {
  'use strict';
  var EA = window.EA, IPTV = window.IPTV;
  if (!EA || !IPTV) return;
  var $ = EA.$, el = EA.el, esc = EA.esc, KEY = EA.KEY, state = EA.state, store = EA.store, video = EA.video, toast = EA.toast;
  var K = { CH_UP: 427, CH_DOWN: 428, GREEN: 404, YELLOW: 405, BLUE: 406, RED: 403, INFO: 457, PGUP: 33, PGDN: 34 };
  var TRANSPARENT = 'data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==';

  function prof(name, t0) { if (window.__prof) window.__prof.push([name, Math.round((performance.now() - t0) * 10) / 10, Math.round(t0)]); }       // tests only: window.__prof = []
  // ====================================================================== settings, playlists, per-playlist data
  var UAS = { '': '', vlc: 'VLC/3.0.20 LibVLC/3.0.20', okhttp: 'okhttp/4.12.0', chrome: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36' };
  var SDEF = { ext: 'm3u8', adult: false, autoplay: false, guide: true, sort: 'provider', aspect: 'fit', shift: 0, clock12: false, banner: 5, buffer: 'balanced', logos: true, start: 'all', auto: 'daily', ua: '', stats: false, pin: '' };
  var SENUM = { ext: ['m3u8', 'ts'], sort: ['provider', 'az', 'num'], aspect: ['fit', 'fill', 'stretch', 'zoom'], banner: [3, 5, 8, 12], buffer: ['fast', 'balanced', 'stable'], start: ['all', 'fav', 'last'], auto: ['daily', 'weekly', 'manual'] };
  var SET = (function () {                                                         // saved settings, each checked against what is allowed so an old or damaged value can never break the screen
    var s = store.get('ea_live_set', {}) || {}, o = {}, k;
    for (k in SDEF) o[k] = s[k] !== undefined && typeof s[k] === typeof SDEF[k] ? s[k] : SDEF[k];
    for (k in SENUM) if (SENUM[k].indexOf(o[k]) < 0) o[k] = SDEF[k];
    if (UAS[o.ua] === undefined) o.ua = ''; o.shift = Math.max(-12, Math.min(12, Math.round(o.shift))); if (!/^\d{4}$/.test(o.pin)) o.pin = '';
    return o;
  })();
  function saveSet() { store.set('ea_live_set', SET); }
  function loadPls() { var a = store.get('ea_live_pl', []); return a instanceof Array ? a : []; }
  function savePls() { store.set('ea_live_pl', PLS); }
  var PLS = loadPls(), act = store.get('ea_live_act', ''), client = null, db = IPTV.createDB();
  function getClient() { return client || (client = IPTV.createClient()); }
  function curPl() { for (var i = 0; i < PLS.length; i++) if (PLS[i].id === act) return PLS[i]; return PLS[0] || null; }
  function pid(pl) { return pl.id + 'g' + (pl.gen || 0); }
  function userKey(what, pl) { return 'ea_live_' + what + '_' + pl.id; }
  function uid() { return 'p' + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36); }
  function ago(t) {
    if (!t) return 'never'; var s = Math.max(0, (Date.now() - t) / 1000);
    return s < 90 ? 'just now' : s < 5400 ? Math.round(s / 60) + ' min ago' : s < 129600 ? Math.round(s / 3600) + ' h ago' : Math.round(s / 86400) + ' days ago';
  }
  function num(n) { return String(n).replace(/\B(?=(\d{3})+(?!\d))/g, ','); }
  function hhmm(sec) {
    var d = new Date(sec * 1000), h = d.getHours(), m = d.getMinutes(), mm = (m < 10 ? '0' : '') + m;
    if (SET.clock12) { var ap = h >= 12 ? ' PM' : ' AM'; h = h % 12 || 12; return h + ':' + mm + ap; }
    return (h < 10 ? '0' : '') + h + ':' + mm;
  }
  function gt(sec) { return hhmm(sec + SET.shift * 3600); }                          // programme time as shown (Settings: guide time shift for providers whose guide is in another time zone)
  function autoMs() { return SET.auto === 'weekly' ? 7 * 864e5 : SET.auto === 'manual' ? 1e15 : 864e5; }
  function nowSec() { return Math.floor(Date.now() / 1000); }
  function tick(fn, ms) { var t = null; return function () { clearTimeout(t); t = setTimeout(fn, ms); }; }

  // ====================================================================== channel data of the open playlist (columnar)
  var D = null;
  function newData(pl) {
    return { pl: pl, n: [], g: [], u: [], l: [], o: [], e: [], low: [], total: 0, groups: [], gl: [], hide: null, epg: {}, epgShort: {}, fav: {}, favList: [], rec: [], keyIdx: null, numIdx: null, ready: false, partial: true, epgAt: 0, epgState: '' };
  }
  function append(cols) {
    var i, len = cols.n.length, t0 = performance.now();
    for (i = 0; i < len; i++) { D.n.push(cols.n[i]); D.g.push(cols.g[i]); D.u.push(cols.u[i]); D.l.push(cols.l[i]); D.o.push(cols.o[i]); D.e.push(cols.e[i]); D.low.push(cols.n[i].toLowerCase()); }
    D.total = D.n.length; D.keyIdx = null; D.numIdx = null; prof('append', t0);
  }
  // group lists, hidden (adult) flags, favourites: done in slices of ~7 ms so the remote never waits on a 60,000-channel scan
  function finalize(groups, tk, done) {
    var t0 = performance.now(), d = D; d.groups = groups || d.groups;
    var G = d.groups.length, total = d.total, hide = new Uint8Array(total), c = [], ghide = [], i, hn = 0;
    for (i = 0; i < G; i++) { ghide[i] = !SET.adult && IPTV.isAdultName(d.groups[i]); c[i] = 0; }
    i = 0;
    function pass1() {
      if (tk !== undefined && tk !== loadTk) return;
      var t = performance.now(), g;
      while (i < total && performance.now() - t < 7) {
        g = d.g[i];
        if (ghide[g] || (!SET.adult && IPTV.isAdultName(d.n[i]))) { hide[i] = 1; hn++; } else c[g]++;
        i++;
      }
      if (i < total) { setTimeout(pass1, 0); return; }
      var lists = [], fill = [];
      for (var k = 0; k < G; k++) { lists[k] = new Int32Array(c[k]); fill[k] = 0; }
      i = 0; pass2(lists, fill);
    }
    function pass2(lists, fill) {
      if (tk !== undefined && tk !== loadTk) return;
      var t = performance.now(), g;
      while (i < total && performance.now() - t < 7) { if (!hide[i]) { g = d.g[i]; lists[g][fill[g]++] = i; } i++; }
      if (i < total) { setTimeout(function () { pass2(lists, fill); }, 0); return; }
      d.hide = hide; d.hiddenN = hn; d.gl = lists; d.gc = c; d.partial = false; d.ready = true;
      loadUserData(); resetRows(); prof('finalize', t0);
      if (done) done();
    }
    pass1();
  }
  // append saved / held chunks without blocking: ~12 ms of work per turn
  function appendSliced(chunks, tk, done, each) {
    var j = 0;
    (function slice() {
      if (tk !== loadTk) return;
      var t0 = Date.now(), first = j === 0;
      while (j < chunks.length && Date.now() - t0 < 10) append(chunks[j++]);
      if (each) each(first);
      if (j < chunks.length) { setTimeout(slice, 0); return; }
      done();
    })();
  }
  // while channels are still arriving the list shows them all in provider order; the first rows appear after the first chunk
  function showPartial(first, focus) {
    if (first) { showView('wrap'); rebuildView(0); if (focus) enterList(); return; }
    if (Date.now() - (D.lastPaint || 0) < 400) return;
    D.lastPaint = Date.now();
    var all = new Int32Array(D.total), i; for (i = 0; i < D.total; i++) all[i] = i;
    V = { idx: all }; LL.setN(D.total, true); paintStatus();
  }
  function resetRows() { [LL, RL, SL].forEach(function (l) { if (l) l.pool.forEach(function (r) { r.ci = -2; r.it = null; r.cls = ''; }); }); }
  function keyMap() { if (!D.keyIdx) { var m = {}, i; for (i = D.total - 1; i >= 0; i--) m['$' + D.u[i]] = i; D.keyIdx = m; } return D.keyIdx; }
  function numMap() { if (!D.numIdx) { var m = {}, i; for (i = D.total - 1; i >= 0; i--) m['$' + D.o[i]] = i; D.numIdx = m; } return D.numIdx; }
  function loadUserData() {
    D.favList = store.get(userKey('fav', D.pl), []) || []; D.rec = store.get(userKey('rec', D.pl), []) || [];
    D.fav = {}; D.favList.forEach(function (k) { D.fav['$' + k] = 1; });
  }
  function isFav(ci) { return !!D.fav['$' + D.u[ci]]; }
  function toggleFav(ci) {
    var k = D.u[ci], on = !D.fav['$' + k];
    if (on) { D.fav['$' + k] = 1; D.favList.unshift(k); D.favList = D.favList.slice(0, 1000); } else { delete D.fav['$' + k]; D.favList = D.favList.filter(function (x) { return x !== k; }); }
    store.set(userKey('fav', D.pl), D.favList);
    toast(on ? '♥ Added to Favorites' : 'Removed from Favorites'); return on;
  }
  function pushRecent(ci) {
    var k = D.u[ci]; D.rec = [k].concat(D.rec.filter(function (x) { return x !== k; })).slice(0, 40);
    store.set(userKey('rec', D.pl), D.rec); store.set(userKey('last', D.pl), k);
  }
  function chUrl(ci, ext) { return D.pl.type === 'xtream' ? IPTV.xtreamUrl(D.pl, D.u[ci], ext || SET.ext) : D.u[ci]; }

  // views: which channel indices the list shows
  var C = { kind: 'all', g: 0, q: '' };                                           // browse category + search text
  function viewOf(cat, q) {
    var out, i, k;
    if (q) {
      var r = IPTV.search(D.low, q, 4000); out = [];
      for (i = 0; i < r.length; i++) if (!D.hide[r[i]]) out.push(r[i]);
      return Int32Array.from(out);
    }
    if (cat.kind === 'fav' || cat.kind === 'recent') {
      var keys = cat.kind === 'fav' ? D.favList : D.rec, km = keyMap(); out = [];
      for (i = 0; i < keys.length; i++) { k = km['$' + keys[i]]; if (k !== undefined) out.push(k); }
      return Int32Array.from(out);
    }
    if (cat.kind === 'g') out = D.gl[cat.g] || new Int32Array(0);
    else { out = new Int32Array(D.total - hiddenCount()); var p = 0; for (i = 0; i < D.total; i++) if (!D.hide[i]) out[p++] = i; }
    if (SET.sort === 'az') { out = Int32Array.from(out); out.sort(function (a, b) { var x = D.low[a], y = D.low[b]; return x < y ? -1 : x > y ? 1 : 0; }); }
    else if (SET.sort === 'num') { out = Int32Array.from(out); out.sort(function (a, b) { return D.o[a] - D.o[b] || a - b; }); }
    return out;
  }
  function hiddenCount() { return D.hiddenN || 0; }

  // ====================================================================== TV guide (now / next)
  var T = { now: nowSec() };
  setInterval(function () { T.now = nowSec(); if (state.tab === 'live' && state.view === 'live' && LL) { LL.paintAll(); } if (P.on) paintHud(); }, 30000);
  function progOf(ci) {
    if (!D) return null;
    var e = D.e[ci], l = (e && D.epg[e]) || D.epgShort['#' + D.u[ci]];
    return l ? IPTV.nowNext(l, T.now - SET.shift * 3600) : null;
  }
  function guideUrl(pl) {
    if (pl.type === 'xtream') return pl.server.replace(/\/+$/, '') + '/xmltv.php?username=' + encodeURIComponent(pl.user) + '&password=' + encodeURIComponent(pl.pass);
    return pl.epgUrl || '';
  }
  function loadGuide(force) {
    var pl = D && D.pl, tk = loadTk; if (!pl || !SET.guide) return;
    var url = guideUrl(pl);
    if (!url) { D.epgState = pl.type === 'xtream' ? '' : 'no-guide'; return; }
    var gz = /\.gz(\?|$)/i.test(url);                                                // a TV cannot unpack .gz: the server does it while relaying
    var key = pid(pl), list = pl.type === 'xtream' ? null : D.e.filter(Boolean);       // a provider's own guide only lists its channels; a shared guide is filtered to ours
    if (list && !list.length) { D.epgState = 'no-ids'; return; }
    var fresh = pl.epgAt && Date.now() - pl.epgAt < 6 * 3600000;
    function apply(shards, done) {
      var j = 0, ta = performance.now();
      (function step() {
        if (tk !== loadTk) return;
        var t0 = Date.now();
        while (j < shards.length && Date.now() - t0 < 12) { try { var m = JSON.parse(shards[j]), k; for (k in m) D.epg[k] = m[k]; } catch (x) { /* skip a damaged shard */ } j++; }
        if (j < shards.length) { setTimeout(step, 0); return; }
        prof('guide-apply', ta); D.epgState = 'ok'; D.epgAt = pl.epgAt; paintStatus(); if (LL) LL.paintAll(); paintInfo(true); done && done();
      })();
    }
    if (!force && fresh) {                                                         // saved guide, no network
      var saved = [];
      db.eachEpg(key, function (v) { saved.push(v); }).then(function () { if (saved.length && tk === loadTk) apply(saved); else if (tk === loadTk) fetchGuide(true); });
      return;
    }
    fetchGuide(false);
    function fetchGuide() {
      D.epgState = 'loading'; paintStatus();
      var job = { kind: 'xmltv', url: url, ids: list ? list.join('\n') : null, maxBytes: 80 * 1048576, tries: gz ? [{ via: 'proxy', pre: EA.apiBase() + '/api?action=proxy&raw=1&gunzip=1&url=' }] : tries(pl, url, true) };      // one string: cloning 30,000 small strings blocks a slow TV
      getClient().run(job, null, function (got, total) { D.epgProg = total ? Math.round(got / total * 100) : Math.round(got / 1048576) + ' MB'; }).then(function (res) {
        if (tk !== loadTk) return;
        pl.epgAt = Date.now(); savePls();
        db.dropEpg(key).then(function () { var n = 0; (function put() { if (n < res.shards.length) db.putEpg(key, n, res.shards[n++]).then(put); })(); });
        apply(res.shards);
      }, function (err) { if (tk === loadTk) { D.epgState = 'fail'; D.epgErr = err.message; paintStatus(); } });
    }
  }
  // Xtream short EPG for one channel (when there is no XMLTV for it)
  var shortBusy = false;
  function fetchShort(ci) {
    var pl = D && D.pl; if (!pl || pl.type !== 'xtream' || shortBusy) return;
    var id = D.u[ci], key = '#' + id; if (D.epgShort[key] !== undefined || (D.e[ci] && D.epg[D.e[ci]])) return;
    shortBusy = true;
    var full = pl.server.replace(/\/+$/, '') + '/player_api.php?username=' + encodeURIComponent(pl.user) + '&password=' + encodeURIComponent(pl.pass) + '&action=get_short_epg&limit=6&stream_id=' + encodeURIComponent(id);
    var routes = tries(pl, full, false), n = 0;
    (function go() {
      if (n >= routes.length) { shortBusy = false; D.epgShort[key] = null; return; }
      var t = routes[n++];
      fetch(t.pre ? t.pre + encodeURIComponent(full) : full).then(function (r) { if (!r.ok) throw new Error('http'); return r.json(); }).then(function (j) {
        shortBusy = false;
        var l = (j.epg_listings || []).map(function (x) { return [+x.start_timestamp || 0, +x.stop_timestamp || +x.end_timestamp || 0, IPTV.utf8b64(x.title), IPTV.utf8b64(x.description || '').slice(0, 240)]; }).filter(function (x) { return x[0] && x[1]; });
        l.sort(function (a, b) { return a[0] - b[0]; });
        D.epgShort[key] = l.length ? l : null;
        if (l.length) { if (LL) LL.paintAll(); paintInfo(true); if (P.on) paintHud(); }
      }).catch(go);
    })();
  }

  // route list for a URL: direct first, then through our server (needed for CORS / mixed content / User-Agent)
  function proxyPre(pl, live) { return EA.apiBase() + '/api?action=proxy' + (live ? '&live=1' : '&raw=1') + ((pl && pl.ua) || UAS[SET.ua] ? '&ua=' + encodeURIComponent((pl && pl.ua) || UAS[SET.ua]) : '') + '&url='; }
  function tries(pl, url, raw) {
    var d = { via: 'direct', pre: '' }, p = { via: 'proxy', pre: proxyPre(pl, false) };
    var mixed = location.protocol === 'https:' && /^http:/i.test(url);
    return mixed ? [p] : pl.via === 'proxy' ? [p, d] : [d, p];
  }

  // ====================================================================== virtual list
  function VList(box, o) {
    this.box = box; this.o = o; this.n = 0; this.top = 0; this.sel = 0; this.active = false; this.pool = []; this.vis = 1; this.rowPx = 40;
    this.sb = el('div', 'vsb', '<i></i>'); box.appendChild(this.sb);
    var self = this;
    box.addEventListener('click', function (e) { var r = EA.up(e.target, 'vrow'); if (r && r.__v === self && r.__i >= 0) { self.sel = r.__i; self.o.onClick(r.__i, e); } });
    box.addEventListener('wheel', function (e) { e.preventDefault(); self.move(e.deltaY > 0 ? 3 : -3); self.o.onMove && self.o.onMove(self.sel); }, false);
  }
  VList.prototype.layout = function () {
    var rem = parseFloat(document.documentElement.style.fontSize) || 16, h = this.box.clientHeight;
    if (h === this._h && rem === this._rem && this.pool.length) { this.paintAll(); return; }          // same size as last time: nothing to rebuild
    this._h = h; this._rem = rem;
    this.rowPx = Math.max(24, Math.round(this.o.rowRem * rem));
    this.vis = Math.max(1, Math.floor(h / this.rowPx));
    var need = Math.min(this.vis + 1, 40), i;
    while (this.pool.length < need) { var r = this.o.build(); r.el.__v = this; this.box.insertBefore(r.el, this.sb); this.pool.push(r); }
    while (this.pool.length > need) this.box.removeChild(this.pool.pop().el);
    for (i = 0; i < this.pool.length; i++) { var s = this.pool[i].el.style; s.height = this.rowPx + 'px'; s.webkitTransform = s.transform = 'translateY(' + i * this.rowPx + 'px)'; this.pool[i].ci = -2; }
    this.clamp(); this.paintAll();
  };
  VList.prototype.clamp = function () {
    if (this.sel >= this.n) this.sel = Math.max(0, this.n - 1);
    if (this.sel < 0) this.sel = 0;
    var maxTop = Math.max(0, this.n - this.vis);
    if (this.top > maxTop) this.top = maxTop;
    if (this.top < 0) this.top = 0;
    if (this.sel < this.top) this.top = this.sel;
    if (this.sel >= this.top + this.vis) this.top = this.sel - this.vis + 1;
  };
  VList.prototype.setN = function (n, keepSel) { this.n = n; if (!keepSel) { this.sel = 0; this.top = 0; } this.clamp(); this.paintAll(); };
  VList.prototype.paintAll = function () {
    var i, r, idx;
    for (i = 0; i < this.pool.length; i++) {
      r = this.pool[i]; idx = this.top + i;
      if (idx < this.n && i < this.vis + 1) { r.el.style.display = ''; r.el.__i = idx; this.o.paint(r, idx, idx === this.sel, this.active); }
      else { r.el.style.display = 'none'; r.el.__i = -1; }
    }
    var sb = this.sb, f = this.n > this.vis ? this.vis / this.n : 1;
    sb.style.display = f >= 1 ? 'none' : ''; if (f < 1) { var hh = Math.max(8, f * 100); sb.firstChild.style.height = hh + '%'; sb.firstChild.style.top = (this.top / Math.max(1, this.n - this.vis)) * (100 - hh) + '%'; }
  };
  VList.prototype.paintRow = function (idx) { var i = idx - this.top; if (i >= 0 && i < this.pool.length && idx < this.n) this.o.paint(this.pool[i], idx, idx === this.sel, this.active); };
  VList.prototype.select = function (idx) {
    var old = this.sel, oldTop = this.top; this.sel = idx; this.clamp();
    if (this.top !== oldTop) this.paintAll(); else { this.paintRow(old); this.paintRow(this.sel); }
  };
  VList.prototype.move = function (d) { if (!this.n) return; var t = Math.max(0, Math.min(this.n - 1, this.sel + d)); if (t !== this.sel) this.select(t); };
  VList.prototype.setActive = function (a) { this.active = a; this.paintRow(this.sel); };
  VList.prototype.rowAt = function (idx) { var i = idx - this.top; return i >= 0 && i < this.pool.length ? this.pool[i] : null; };

  // ---------------- row builders ----------------
  var logoOk = {}, logoBad = {}, settleT = null, pendingRows = [];
  function hue(s) { var h = 0, i; for (i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360; return h; }
  function initials(s) { var w = String(s).replace(/[^A-Za-z0-9À-￿ ]/g, ' ').trim().split(/\s+/); return ((w[0] || '?').charAt(0) + (w[1] ? w[1].charAt(0) : (w[0] || '').charAt(1) || '')).toUpperCase(); }
  function setLogo(r, url) {
    if (!SET.logos) url = '';                                                       // Settings: logos off (saves data on a slow connection)                                                       // cached logos appear at once; the rest after scrolling settles
    r.img.className = ''; r.url = url || '';
    if (!url || logoBad[url]) { if (r.img.src !== TRANSPARENT) r.img.src = TRANSPARENT; return; }
    if (logoOk[url]) { r.img.src = url; r.img.className = 'ld'; return; }
    r.img.src = TRANSPARENT; pendingRows.push(r); clearTimeout(settleT); settleT = setTimeout(settle, 140);
  }
  function settle() {
    var rows = pendingRows; pendingRows = [];
    rows.forEach(function (r) { if (r.url && !logoBad[r.url] && r.img.src === TRANSPARENT && r.el.style.display !== 'none') { r.img.src = r.url; } });
  }
  // "BBC One (720p) [Geo-blocked;Not 24/7]" -> title "BBC One", badge "720p", warning "Geo-blocked"
  function splitName(n) {
    var q = /\((\d{3,4}p)\)/.exec(n), br = /\[([^\]]*)\]/.exec(n), t = n.replace(/\[[^\]]*\]/g, '').replace(/\(\d{3,4}p\)/g, '').replace(/\s+/g, ' ').trim();
    return { t: t || n, q: q ? q[1] : (/\b(4K|UHD)\b/i.test(n) ? '4K' : /\bFHD\b/i.test(n) ? '1080p' : /\bHD\b/.test(n) ? 'HD' : ''), w: br ? (/geo/i.test(br[1]) ? 'Geo' : /not 24/i.test(br[1]) ? 'Part-time' : '') : '' };
  }
  function buildCh() {
    var r = { el: el('div', 'vrow chrow', '<span class="chn"></span><span class="chlogo"><b class="chini"></b><img alt=""></span><span class="chmid"><span class="cht"></span><span class="chs"></span><span class="chbar"><i></i></span></span><span class="chtag"></span><span class="chfav"></span>'), ci: -2 };
    var q = function (c) { return r.el.querySelector(c); };
    r.num = q('.chn'); r.ini = q('.chini'); r.img = q('img'); r.t = q('.cht'); r.s = q('.chs'); r.bar = q('.chbar'); r.barI = q('.chbar i'); r.fav = q('.chfav'); r.tag = q('.chtag');
    r.img.onload = function () { if (r.url && r.img.src === r.url) { logoOk[r.url] = 1; r.img.className = 'ld'; } };
    r.img.onerror = function () { if (r.img.src !== TRANSPARENT) { if (r.url) logoBad[r.url] = 1; r.img.src = TRANSPARENT; } };
    return r;
  }
  function paintCh(r, vi, sel, active, view, cls) {
    var ci = view.idx[vi], playing = P.on && P.ci === ci;
    if (r.ci !== ci) {
      var nm = splitName(D.n[ci]);
      r.ci = ci; r.num.textContent = D.o[ci]; r.t.textContent = nm.t; r.tag.textContent = nm.w || nm.q; r.tag.className = 'chtag' + (nm.w ? ' w' : nm.q ? ' q' : '');
      r.ini.textContent = initials(D.n[ci]); r.ini.style.color = 'hsl(' + hue(D.n[ci]) + ',70%,72%)'; r.ini.style.background = 'hsla(' + hue(D.n[ci]) + ',55%,45%,.22)';
      setLogo(r, D.l[ci]);
    }
    var nn = progOf(ci), sub = nn && nn.now ? nn.now[2] : (D.groups[D.g[ci]] || ''), pct = nn && nn.now ? nn.pct : 0;
    if (r.subTxt !== sub) { r.subTxt = sub; r.s.textContent = sub; }
    if (r.pct !== pct) { r.pct = pct; r.barI.style.width = pct + '%'; r.bar.style.visibility = pct ? 'visible' : 'hidden'; }
    var f = isFav(ci) ? 1 : 0; if (r.f !== f) { r.f = f; r.fav.innerHTML = f ? EA.ic('heart') : ''; }
    var c = 'vrow chrow' + (sel ? (active ? ' focused' : ' sel') : '') + (playing ? ' on' : '') + (cls || '');
    if (r.cls !== c) { r.cls = c; r.el.className = c; }
  }
  function buildRail() {
    var r = { el: el('div', 'vrow railrow', '<span class="rli"></span><span class="rll"></span><span class="rlc"></span>'), ci: -2 };
    r.i = r.el.children[0]; r.l = r.el.children[1]; r.c = r.el.children[2]; return r;
  }
  function paintRail(r, vi, sel, active) {
    var it = RAIL[vi]; if (!it) return;
    if (r.it !== it || r.cnt !== it.count) { r.it = it; r.cnt = it.count; r.l.textContent = it.label; r.c.textContent = it.count == null ? '' : num(it.count); r.i.innerHTML = it.icon || ''; }
    var c = 'vrow railrow' + (sel ? (active ? ' focused' : ' sel') : '') + (it.cur ? ' cur' : '') + (it.sub ? ' sub' : '');
    if (r.cls !== c) { r.cls = c; r.el.className = c; }
  }

  // ====================================================================== browse screen
  var LL = null, RL = null, RAIL = [], V = { idx: new Int32Array(0) }, Z = null, loadTk = 0, infoT = null;
  function ensureLists() {
    if (LL) return;
    LL = new VList($('liveList'), { rowRem: 4.6, build: buildCh, paint: function (r, i, s, a) { paintCh(r, i, s, a, V); }, onClick: function (i) { LL.select(i); setZone('list'); playFromList(i); }, onMove: function () { listMoved(); } });
    $('liveList').appendChild(el('div', 'vempty hidden', ''));
    RL = new VList($('liveRailList'), { rowRem: 3.4, build: buildRail, paint: paintRail, onClick: function (i) { RL.select(i); railApply(i); setZone('rail'); }, onMove: function () {} });
  }
  function layoutAll() { if (!LL) return; LL.layout(); RL.layout(); if (SL && P.side) SL.layout(); }
  window.addEventListener('resize', tick(layoutAll, 150));

  function setZone(z) {
    Z = z; if (!LL) return;
    LL.setActive(z === 'list'); RL.setActive(z === 'rail');
    if (z) { var f = EA.state.focusEl; if (f && f.className.indexOf('focused') > -1) f.className = f.className.replace(/\s*\bfocused\b/g, ''); }
    paintHint();
  }
  function buildRailItems() {
    var items = [], i;
    items.push({ k: 'fav', label: 'Favorites', count: D.favList.length, icon: EA.ic('heart') });
    items.push({ k: 'recent', label: 'Recently watched', count: D.rec.length, icon: '<svg class="ic" viewBox="0 0 24 24"><path d="M13 3a9 9 0 0 0-9 9H1l3.9 3.9.1.1L9 12H6a7 7 0 1 1 2.1 5l-1.4 1.4A9 9 0 1 0 13 3zm-1 5v5l4.3 2.5.7-1.2-3.5-2.1V8z"/></svg>' });
    items.push({ k: 'all', label: 'All channels', count: D.total - hiddenCount(), icon: '<svg class="ic" viewBox="0 0 24 24"><path d="M4 8h4V4H4v4zm6 12h4v-4h-4v4zm-6 0h4v-4H4v4zm0-6h4v-4H4v4zm6 0h4v-4h-4v4zm6-10v4h4V4h-4zm-6 4h4V4h-4v4zm6 6h4v-4h-4v4zm0 6h4v-4h-4v4z"/></svg>' });
    var gs = []; for (i = 0; i < D.groups.length; i++) if (D.gc[i] > 0) gs.push(i);
    gs.forEach(function (g) { items.push({ k: 'g', g: g, label: D.groups[g], count: D.gc[g], sub: true }); });
    RAIL = items;
    items.forEach(function (it) { it.cur = it.k === C.kind && (it.k !== 'g' || it.g === C.g); });
  }
  function railIndexOfCur() { var i; for (i = 0; i < RAIL.length; i++) if (RAIL[i].cur) return i; return 2; }
  function initialCat() {                                                          // Settings: which group opens first
    if (C.q || !D) return;
    if (SET.start === 'fav' && D.favList.length) C = { kind: 'fav', g: 0, q: '' };
    else if (SET.start === 'last') { var lc = store.get(userKey('lastcat', D.pl), null); if (lc && (lc.kind === 'all' || lc.kind === 'fav' || lc.kind === 'recent' || (lc.kind === 'g' && D.gc[lc.g] > 0))) C = { kind: lc.kind, g: lc.g || 0, q: '' }; }
  }
  function railApply(i) {
    var it = RAIL[i]; if (!it) return;
    C.kind = it.k; C.g = it.g || 0; if (D && it.k !== 'recent') store.set(userKey('lastcat', D.pl), { kind: it.k, g: it.g || 0 }); RAIL.forEach(function (x) { x.cur = x === it; }); RL.paintAll();
    clearSearch(); rebuildView(0);
  }
  var railApplyDeb = tick(function () { if (RL && Z === 'rail') railApply(RL.sel); }, 180);
  function clearSearch() { if (C.q) { C.q = ''; $('liveSearch').value = ''; } }
  function rebuildView(selIdx, keepKey) {
    if (!D || !D.ready && !D.partial) return; var t0 = performance.now();
    if (D.partial) { var all = new Int32Array(D.total), i; for (i = 0; i < D.total; i++) all[i] = i; V = { idx: all }; }
    else V = { idx: viewOf(C, C.q) };
    LL.setN(V.idx.length, false);
    if (keepKey !== undefined && keepKey !== null) { var p = findIn(V.idx, keepKey); if (p >= 0) LL.select(p); }
    else if (selIdx) LL.select(selIdx);
    LL.paintAll(); paintStatus(); paintInfo(true); paintHint(); paintEmpty(); prof('rebuildView', t0);
  }
  function paintEmpty() {
    var n = $('liveList').querySelector('.vempty'); if (!n) return;
    if (V.idx.length || !D || (D.partial && !D.total)) { n.className = 'vempty hidden'; return; }
    n.className = 'vempty';
    n.innerHTML = C.q ? '<b>No channels match “' + esc(C.q) + '”</b><span>Try fewer letters, or another spelling.</span>'
      : C.kind === 'fav' ? '<b>No favorites yet</b><span>Press ▶ on any channel (or the yellow key while watching) to add it here.</span>'
      : C.kind === 'recent' ? '<b>Nothing watched yet</b><span>Channels you watch show up here.</span>' : '<b>No channels in this group</b>';
  }
  function findIn(arr, ci) { var i; for (i = 0; i < arr.length; i++) if (arr[i] === ci) return i; return -1; }
  function curCi() { return LL && LL.sel < V.idx.length ? V.idx[LL.sel] : -1; }
  function listMoved() { paintInfoDeb(); }
  var paintInfoDeb = tick(function () { paintInfo(true); var ci = curCi(); if (ci >= 0) setTimeout(function () { if (curCi() === ci) fetchShort(ci); }, 380); }, 110);

  function paintStatus() {
    var s = $('liveStatus'), pl = D && D.pl, html = '';
    if (!pl || !D) { s.innerHTML = ''; return; }
    var cat = C.q ? 'Search “' + esc(C.q) + '”' : C.kind === 'fav' ? 'Favorites' : C.kind === 'recent' ? 'Recently watched' : C.kind === 'g' ? esc(D.groups[C.g]) : 'All channels';
    html = '<b>' + cat + '</b><span>' + num(V.idx.length) + ' channel' + (V.idx.length === 1 ? '' : 's') + '</span>';
    if (LOAD.busy) html += '<span class="ld">' + esc(LOAD.msg) + '</span>';
    else {
      html += '<span>Updated ' + ago(pl.updated) + '</span>';
      var g = D.epgState; html += g === 'ok' ? '<span class="gd">Guide ✓</span>' : g === 'loading' ? '<span class="ld">Guide ' + esc(String(D.epgProg == null ? '' : D.epgProg)) + (typeof D.epgProg === 'number' ? '%' : '') + '…</span>'
        : g === 'fail' ? '<span class="bd" title="' + esc(D.epgErr || '') + '">Guide unavailable</span>' : g === 'gz' ? '<span>Guide is compressed (.gz): not supported on TVs</span>' : '';
    }
    s.innerHTML = html;
  }
  function paintHint() {
    var h = $('liveHint'); if (!h) return;
    h.innerHTML = Z === 'rail' ? '<b>OK</b> open group · <b>▶</b> channels · <b>▲▼</b> browse' : '<b>OK</b> watch · <b>▶</b> favorite · <b>◀</b> groups · <b>▲</b> search · <b>CH▲▼</b> page';
  }
  function progList(ci) { var e = D.e[ci]; return (e && D.epg[e]) || D.epgShort['#' + D.u[ci]] || null; }
  function paintInfo(force) {
    var ci = curCi(), box = $('liveInfo'); if (!D || ci < 0) { box.className = 'empty'; $('liInfName').textContent = ''; $('liInfLogo').innerHTML = ''; $('liInfMeta').textContent = ''; $('liInfNow').innerHTML = ''; $('liInfNext').innerHTML = ''; return; }
    box.className = '';
    if (box.__ci !== ci || force) {
      box.__ci = ci;
      var u = D.l[ci];
      $('liInfLogo').innerHTML = '<b style="color:hsl(' + hue(D.n[ci]) + ',70%,72%)">' + esc(initials(D.n[ci])) + '</b>' + (SET.logos && u && !logoBad[u] ? '<img alt="" src="' + esc(u) + '">' : '');
      var im = $('liInfLogo').querySelector('img'); if (im) { im.onerror = function () { logoBad[u] = 1; im.style.display = 'none'; }; }
      $('liInfName').textContent = splitName(D.n[ci]).t;
      $('liInfMeta').innerHTML = '<span>CH ' + esc(D.o[ci]) + '</span><span>' + esc(D.groups[D.g[ci]] || '') + '</span>' + (isFav(ci) ? '<span class="fv">' + EA.ic('heart') + 'Favorite</span>' : '');
      var nn = progOf(ci);
      $('liInfNow').innerHTML = nn && nn.now ? '<label>NOW · ' + gt(nn.now[0]) + '–' + gt(nn.now[1]) + '</label><div class="tt">' + esc(nn.now[2]) + '</div><div class="pb"><i style="width:' + nn.pct + '%"></i></div>' + (nn.now[3] ? '<p>' + esc(nn.now[3]) + '</p>' : '')
        : '<label>NOW</label><div class="tt mu">' + (D.epgState === 'loading' ? 'Loading the TV guide…' : 'No programme information') + '</div>';
      var more = '', pl2 = progList(ci), t2 = T.now - SET.shift * 3600, n2 = 0, k2;
      if (nn && nn.next && pl2) for (k2 = 0; k2 < pl2.length && n2 < 3; k2++) if (pl2[k2][0] > nn.next[0]) { more += '<div class="upl"><b>' + gt(pl2[k2][0]) + '</b><span>' + esc(pl2[k2][2]) + '</span></div>'; n2++; }
      $('liInfNext').innerHTML = nn && nn.next ? '<label>NEXT · ' + gt(nn.next[0]) + '</label><div class="tt">' + esc(nn.next[2]) + '</div>' + (more ? '<div class="upc"><label>LATER</label>' + more + '</div>' : '') : '';
    }
  }

  // ====================================================================== opening a playlist
  var LOAD = { busy: false, msg: '' };
  function showView(which) {                                                       // 'wrap' | 'empty'
    $('liveWrap').style.display = which === 'wrap' ? '' : 'none'; $('liveEmpty').className = which === 'empty' ? '' : 'hidden';
  }
  function show(focusContent) {
    ensureLists(); Z = null;
    if (!PLS.length) { renderEmpty(); showView('empty'); if (focusContent) { var b = $('liveEmpty').querySelector('.focusable'); if (b) EA.setFocus(b); } return; }
    showView('wrap'); paintHeader(); layoutAll();
    var pl = curPl();
    if (D && D.pl.id === pl.id && (D.ready || D.partial)) { rebuildView(LL.sel, null); if (focusContent !== false) enterList(); return; }
    openPlaylist(pl, focusContent !== false);
  }
  function paintHeader() {
    var pl = curPl(); if (!pl) return;
    $('livePlAv').textContent = initials(pl.name); $('livePlName').textContent = pl.name;
    $('livePlSub').textContent = (pl.count ? num(pl.count) + ' channels · ' : '') + (pl.type === 'xtream' ? 'Xtream' : pl.free ? 'Free' : 'M3U');
    $('liveSort').innerHTML = 'Sort: ' + (SET.sort === 'az' ? 'A–Z' : SET.sort === 'num' ? 'Number' : 'Provider');
    $('liveRefresh').innerHTML = '⟳ Refresh'; $('liveSet').innerHTML = '⚙ Settings';
  }
  function openPlaylist(pl, focus, offline) {
    var tk = ++loadTk; act = pl.id; store.set('ea_live_act', act);
    D = newData(pl); resetRows(); C = { kind: 'all', g: 0, q: '' }; $('liveSearch').value = ''; V = { idx: new Int32Array(0) };
    LOAD = { busy: true, msg: 'Opening…' }; LL.setN(0); RAIL = []; RL.setN(0); paintStatus(); paintHeader(); paintInfo(true);
    var chunks = [];
    db.eachChunk(pid(pl), function (c) { chunks.push(c); }).then(function () {
      if (tk !== loadTk) return;
      if (!chunks.length) { if (offline) { LOAD.busy = false; paintStatus(); return; } refresh(pl, focus, tk); return; }
      appendSliced(chunks, tk, function () {                                       // saved chunks go in without blocking the remote
        finalize(pl.groups, tk, function () {
          initialCat(); buildRailItems(); RL.setN(RAIL.length); RL.select(railIndexOfCur());
          LOAD.busy = false; rebuildView(0); paintHeader();
          var last = store.get(userKey('last', pl), null);
          if (focus) { enterList(); if (SET.autoplay && last !== null) { var ci = keyMap()['$' + last]; if (ci !== undefined) playChannel(ci, V.idx, findIn(V.idx, ci)); } }
          loadGuide(false);
          if (!pl.updated || Date.now() - pl.updated > autoMs()) refresh(pl, false, tk, true);        // stale: update quietly in the background
        });
      }, function (first) { showPartial(first, focus); });
    });
  }
  // download + parse (worker), channels shown as they arrive, saved to IndexedDB under a new generation
  function refresh(pl, focus, tk, quiet) {
    if (!tk) tk = ++loadTk;
    var url = pl.type === 'xtream' ? '' : pl.url, nextGen = (pl.gen || 0) + 1, newD = quiet ? newData(pl) : (D = newData(pl)), idx = 0, writes = Promise.resolve(), t0 = Date.now(), lastPaint = 0;
    if (!quiet) { LOAD = { busy: true, msg: 'Connecting…' }; paintStatus(); }
    var job = pl.type === 'xtream' ? { kind: 'xtream', server: pl.server.replace(/\/+$/, ''), user: pl.user, pass: pl.pass, tries: tries(pl, pl.server, false) } : { kind: 'm3u', url: url, tries: tries(pl, url, false) };
    var key = pl.id + 'g' + nextGen, held = [];
    var p = getClient().run(job, function (cols) {
      var tc = performance.now(); setTimeout(function () { prof('chunk-cb', tc); }, 0);
      if (tk !== loadTk) return;
      if (quiet) { held.push(cols); } else {
        var first = D.total === 0; append(cols); showPartial(first, focus);
      }
      var n = idx++; writes = writes.then(function () { return db.putChunk(key, n, cols); });
    }, function (got, total) {
      if (tk !== loadTk || quiet) return;
      LOAD.msg = (D.total ? num(D.total) + ' channels · ' : '') + (total ? Math.round(got / total * 100) + '%' : (got / 1048576).toFixed(1) + ' MB'); paintStatus();
    });
    p.then(function (res) {
      return writes.then(function () {
        if (tk !== loadTk) { db.dropChannels(key); return; }
        var old = pid(pl); pl.gen = nextGen; pl.count = res.total; pl.groups = res.groups; pl.updated = Date.now(); pl.via = res.via; if (res.epgUrl && pl.type !== 'xtream') pl.epgUrl = pl.epgUrl || res.epgUrl;
        savePls(); db.dropChannels(old);
        var cc = curCi(), curKey = (D && cc >= 0) ? D.u[cc] : null;
        function swap() {
          finalize(res.groups, tk, function () {
            if (!quiet) initialCat(); buildRailItems(); RL.setN(RAIL.length); RL.select(railIndexOfCur());
            LOAD.busy = false; rebuildView(0); paintHeader();
            if (quiet && curKey !== null) { var ni = keyMap()['$' + curKey]; if (ni !== undefined) { var pos = findIn(V.idx, ni); if (pos >= 0) LL.select(pos); } }
            if (!quiet && focus) enterList();
            D.epgState = ''; setTimeout(function () { if (tk === loadTk) loadGuide(true); }, 60);
            if (!quiet) toast(num(res.total) + ' channels loaded in ' + ((Date.now() - t0) / 1000).toFixed(1) + ' s');
          });
        }
        if (quiet) { D = newD; resetRows(); appendSliced(held, tk, swap); } else { D = newD; swap(); }
      });
    }, function (err) {
      if (tk !== loadTk) return;
      LOAD.busy = false; db.dropChannels(key);
      if (quiet) return;                                                           // background update failed: keep what we have
      if (pl.gen) { openPlaylist(pl, false, true); toast('Could not update: ' + err.message); return; }      // an older saved copy exists: show that
      showLoadError(pl, err);
    });
    return p;
  }
  function showLoadError(pl, err) {
    D = newData(pl); D.partial = false; LL.setN(0); RL.setN(0); paintStatus();
    $('liveStatus').innerHTML = '<span class="bd">Could not open: ' + esc(err.message) + '</span>';
    modal('error', { pl: pl, msg: err.message, all: err.all });
  }

  // ====================================================================== keyboard: browse screen
  function enterList() { if (!D || !D.n.length || !LL) { return; } setZone('list'); paintInfo(true); }
  function enterRail() { setZone('rail'); }
  function focusTool(id) {
    Z = null; if (LL) { LL.setActive(false); RL.setActive(false); }
    EA.setFocus($(id));
    if (id === 'liveSearch' && !EA.IS_TV) $(id).focus();                           // laptop: type straight away (on a TV, OK opens the on-screen keyboard)
  }
  function playFromList(i) { var ci = V.idx[i]; if (ci === undefined) return; playChannel(ci, V.idx, i); }

  function browseKey(e, k) {
    var kk = EA.KEY;
    if (Z === 'list') {
      if (k === kk.UP) { if (LL.sel === 0) { focusTool('liveSearch'); } else { LL.move(-1); listMoved(); } }
      else if (k === kk.DOWN) { LL.move(1); listMoved(); }
      else if (k === K.CH_DOWN || k === kk.FF) { LL.move(LL.vis - 1); listMoved(); }
      else if (k === K.CH_UP || k === kk.RW) { LL.move(-(LL.vis - 1)); listMoved(); }
      else if (k === kk.ENTER) playFromList(LL.sel);
      else if (k === kk.RIGHT || k === K.YELLOW) { var ci = curCi(); if (ci >= 0) { toggleFav(ci); LL.paintRow(LL.sel); paintInfo(true); buildRailCounts(); if (C.kind === 'fav') rebuildView(Math.min(LL.sel, V.idx.length - 1)); } }
      else if (k === kk.LEFT) enterRail();
      else if (k === K.GREEN) cycleSort();
      else return false;
      return true;
    }
    if (Z === 'rail') {
      if (k === kk.UP) { if (RL.sel === 0) focusTool('livePlBtn'); else { RL.move(-1); railApplyDeb(); } }
      else if (k === kk.DOWN) { RL.move(1); railApplyDeb(); }
      else if (k === kk.ENTER || k === kk.RIGHT) { railApply(RL.sel); enterList(); }
      else if (k === kk.LEFT) return false;
      else if (k === K.CH_DOWN) { RL.move(RL.vis - 1); railApplyDeb(); }
      else if (k === K.CH_UP) { RL.move(-(RL.vis - 1)); railApplyDeb(); }
      else return false;
      return true;
    }
    // generic zones (tabs, toolbar, playlist button): only the hops into the custom lists are ours
    var f = EA.state.focusEl;
    if (k === kk.DOWN && f) {
      if (f.id === 'livePlBtn') { if (RL && RL.n) { enterRail(); return true; } }
      else if (f.id === 'liveSort' || f.id === 'liveRefresh' || f.id === 'liveSet') { enterList(); return true; }
    }
    return false;
  }
  function buildRailCounts() { if (!D || !RL || !RAIL.length) return; RAIL[0].count = D.favList.length; RAIL[1].count = D.rec.length; RL.paintAll(); }
  function cycleSort() { SET.sort = SET.sort === 'provider' ? 'az' : SET.sort === 'az' ? 'num' : 'provider'; saveSet(); paintHeader(); var cc = curCi(); rebuildView(0, cc >= 0 ? cc : null); toast('Sorted: ' + (SET.sort === 'az' ? 'A–Z' : SET.sort === 'num' ? 'by number' : 'provider order')); }

  // ====================================================================== player
  var P = { on: false, ci: -1, list: null, pos: 0, hls: null, token: 0, route: 0, routes: [], timer: 0, hudT: 0, startT: 0, numBuf: '', numT: 0, menu: false, side: false, prev: -1, sleepT: 0, sleepAt: 0, msgT: 0, stallT: 0, retries: 0, started: false, hud: true, menuIdx: 0, cat: null };
  var SL = null;
  function isHls(u) { return /\.m3u8?(\?|#|$)/i.test(u) || /[?&]type=m3u8/i.test(u) || /m3u8/i.test(u); }
  function pxUrl(pl, u) { return proxyPre(pl, true) + encodeURIComponent(u); }
  function makeRoutes(ci) {
    var pl = D.pl, first0 = pl.extLearned || SET.ext, urls = [{ u: chUrl(ci, first0), ext: first0, alt: false }], out = [], mixed = location.protocol === 'https:';
    if (pl.type === 'xtream') { var other = first0 === 'ts' ? 'm3u8' : 'ts'; urls.push({ u: chUrl(ci, other), ext: other, alt: true }); }
    var canHls = !!(window.Hls && Hls.isSupported());
    function add(uo, via) {
      var u = uo.u;
      if (via === 'direct' && mixed && /^http:/i.test(u)) return;
      var url = via === 'proxy' ? pxUrl(pl, u) : u, hl = isHls(u), mk = function (kind) { return { url: url, kind: kind, via: via, ext: uo.ext, alt: uo.alt }; };
      if (hl && canHls) out.push(mk('hls'));
      else if (hl) out.push(mk('native'));
      else { out.push(mk('native')); if (canHls) out.push(mk('hls')); }
    }
    var first = pl.via === 'proxy' ? ['proxy', 'direct'] : ['direct', 'proxy'];
    if (P.forceVia) first = [P.forceVia];
    first.forEach(function (v) { urls.forEach(function (u) { add(u, v); }); });
    return out;
  }
  function stopMedia() {
    clearTimeout(P.timer); clearTimeout(P.stallT);
    if (P.hls) { try { P.hls.destroy(); } catch (e) { /* ignore */ } P.hls = null; }
    try { video.pause(); video.removeAttribute('src'); video.load(); } catch (e2) { /* ignore */ }
  }
  function playChannel(ci, list, pos) {
    var wasOn = P.on;
    P.on = true; P.list = list; P.pos = pos >= 0 ? pos : 0;
    if (!wasOn) { P.prev = -1; P.forceVia = ''; applyAspect(); }
    state.view = 'player'; state.liveOn = true;
    var pl = $('player'); pl.className = ''; pl.setAttribute('data-kind', 'live'); pl.removeAttribute('data-embed');
    $('liveHud').className = ''; $('embedCtl').className = 'hidden'; $('skipBtn').className = 'skipbtn hidden';
    if (P.ci !== ci && P.ci >= 0) P.prev = P.ci;
    try { video.playbackRate = 1; } catch (e) { /* ignore */ }
    state.src = null; state.pPlay = null;                                          // the anime player's bookkeeping must not react to live video events
    P.ci = ci; P.hud = true; pushRecent(ci); buildRailCounts();
    paintHud(); showHud(); startStream(true);
  }
  function startStream(immediate) {
    var tk = ++P.token; P.started = false; P.retries = 0;
    clearTimeout(P.startT); stopMedia(); setMsg('Tuning…', '', true);
    P.startT = setTimeout(function () {
      if (tk !== P.token) return;
      P.routes = makeRoutes(P.ci); P.route = 0; tryRoute(tk);
    }, immediate ? 0 : 320);
  }
  function tryRoute(tk) {
    if (tk !== P.token) return;
    stopMediaKeep();
    if (P.route >= P.routes.length) { failStream(); return; }
    var r = P.routes[P.route]; P.cur = r;
    if (P.route > 0) setMsg('Trying another route…', 'attempt ' + (P.route + 1) + ' of ' + P.routes.length, true);
    clearTimeout(P.timer); P.timer = setTimeout(function () { if (tk === P.token && !P.started) nextRoute(tk); }, P.route === 0 ? 9000 : 12000);
    try {
      if (r.kind === 'hls' && !(window.AVP && AVP.use())) {            // Samsung AVPlay (avp.js) takes the address as it is
        var bm = { fast: [2, 6, 12], balanced: [3, 20, 40], stable: [5, 40, 80] }[SET.buffer] || [3, 20, 40];            // Settings: buffering
        var h = new Hls({ enableWorker: true, lowLatencyMode: false, liveSyncDurationCount: bm[0], liveMaxLatencyDurationCount: bm[0] + 9, maxBufferLength: bm[1], maxMaxBufferLength: bm[2], backBufferLength: 20,
          manifestLoadingMaxRetry: 1, manifestLoadingTimeOut: 6000, levelLoadingMaxRetry: 2, levelLoadingTimeOut: 6000, fragLoadingMaxRetry: 3, fragLoadingTimeOut: 12000, startLevel: -1, abrEwmaDefaultEstimate: 4000000, capLevelToPlayerSize: false });
        P.hls = h;
        h.on(Hls.Events.MANIFEST_PARSED, function () { applyQuality(); var pr = video.play(); if (pr && pr.catch) pr.catch(function () {}); });
        h.on(Hls.Events.LEVEL_SWITCHED, function () { paintQuality(); });
        h.on(Hls.Events.ERROR, function (_, d) {
          if (tk !== P.token || !d.fatal) return;
          if (d.type === Hls.ErrorTypes.NETWORK_ERROR && P.retries++ < 2 && P.started) { h.startLoad(); return; }
          if (d.type === Hls.ErrorTypes.MEDIA_ERROR && P.retries++ < 2) { h.recoverMediaError(); return; }
          nextRoute(tk);
        });
        h.loadSource(r.url); h.attachMedia(video);
      } else { video.src = r.url; var pr2 = video.play(); if (pr2 && pr2.catch) pr2.catch(function () {}); }
    } catch (e) { nextRoute(tk); }
  }
  function stopMediaKeep() {
    if (P.hls) { try { P.hls.destroy(); } catch (e) { /* ignore */ } P.hls = null; }
    try { video.pause(); video.removeAttribute('src'); video.load(); } catch (e2) { /* ignore */ }
  }
  function nextRoute(tk) { if (tk !== P.token) return; P.route++; tryRoute(tk); }
  function failStream() {
    clearTimeout(P.timer);
    setMsg('This channel is not available', 'It may be offline, or your provider limits connections.  OK: retry · ▲▼: other channel · Back: leave', false, true);
  }
  video.addEventListener('playing', function () {
    if (!P.on) return;
    clearTimeout(P.timer); clearTimeout(P.stallT); P.started = true; P.retries = 0; setMsg('');
    var r = P.cur; if (r && D && r.via !== D.pl.via) { D.pl.via = r.via; savePls(); }
    if (r && D && r.alt && D.pl.type === 'xtream' && D.pl.extLearned !== r.ext) { D.pl.extLearned = r.ext; savePls(); }          // this provider only plays the other format: start with it next time
    paintQuality();
  });
  video.addEventListener('waiting', function () {
    if (!P.on || !P.started) return;
    clearTimeout(P.stallT); P.stallT = setTimeout(function () { if (P.on && P.started && video.readyState < 3) setMsg('Buffering…', '', true); }, 900);
    var tk = P.token; clearTimeout(P.timer);
    P.timer = setTimeout(function () { if (tk === P.token && P.on && video.readyState < 3) { P.started = false; nextRouteSame(tk); } }, 20000);   // stuck for 20 s: restart this route
  });
  video.addEventListener('error', function () { if (P.on && video.getAttribute('src')) nextRoute(P.token); });
  function nextRouteSame(tk) { if (tk !== P.token) return; if (P.hls) { try { P.hls.startLoad(); } catch (e) { /* ignore */ } P.timer = setTimeout(function () { if (tk === P.token && !P.started) nextRoute(tk); }, 12000); } else tryRoute(tk); }
  function setMsg(a, b, busy, sticky) {
    var m = $('liveMsg'); clearTimeout(P.msgT);
    if (!a) { m.className = 'hidden'; return; }
    m.className = busy ? 'busy' : 'err'; m.innerHTML = (busy ? '<div class="sp"></div>' : '') + '<h3>' + esc(a) + '</h3>' + (b ? '<p>' + esc(b) + '</p>' : '');
  }
  function leavePlayer() {
    P.on = false; paintStats(); P.token++; clearTimeout(P.startT); stopMedia(); clearTimeout(P.hudT); clearTimeout(P.numT); closeMenu(); closeSide(); setSleep(0);
    state.liveOn = false; state.view = 'live';
    $('player').className = 'hidden'; $('player').removeAttribute('data-kind'); $('liveHud').className = 'hidden'; setMsg(''); $('liveNum').className = 'hidden';
    video.style.objectFit = ''; video.style.webkitTransform = video.style.transform = '';
    if (LL && V.idx.length) { var p = findIn(V.idx, P.ci); if (p >= 0) LL.select(p); LL.paintAll(); }
    setZone('list'); paintInfo(true);
  }

  // ---- banner ----
  function showHud(ms) {
    var h = $('liveHud'); h.className = P.side ? 'side' : P.menu ? 'menu' : ''; P.hud = true; clearTimeout(P.hudT);
    P.hudT = setTimeout(function () { if (!P.menu && !P.side) { h.className = 'idle'; P.hud = false; } }, ms || SET.banner * 1000);
  }
  function paintHud() {
    if (!P.on || !D || P.ci < 0) return;
    var ci = P.ci, u = D.l[ci], nn = progOf(ci);
    var sn = splitName(D.n[ci]);
    $('lhNum').textContent = D.o[ci]; $('lhName').textContent = sn.t; $('lhGroup').textContent = D.groups[D.g[ci]] || '';
    var lg = $('lhLogo'); if (lg.__ci !== ci) { lg.__ci = ci; lg.innerHTML = '<b style="color:hsl(' + hue(D.n[ci]) + ',70%,72%)">' + esc(initials(D.n[ci])) + '</b>' + (SET.logos && u && !logoBad[u] ? '<img alt="" src="' + esc(u) + '">' : ''); var im = lg.querySelector('img'); if (im) im.onerror = function () { logoBad[u] = 1; im.style.display = 'none'; }; }
    $('lhFav').innerHTML = isFav(ci) ? EA.ic('heart') : '';
    $('lhNow').textContent = nn && nn.now ? nn.now[2] : (D.epgState === 'loading' ? 'Loading guide…' : 'No programme information'); $('lhNowT').textContent = nn && nn.now ? gt(nn.now[0]) + '–' + gt(nn.now[1]) : '';
    $('lhBar').style.width = (nn && nn.now ? nn.pct : 0) + '%';
    $('lhNext').textContent = nn && nn.next ? nn.next[2] : ''; $('lhNextT').textContent = nn && nn.next ? gt(nn.next[0]) : '';
    var c = new Date(); $('lhClock').textContent = hhmm(nowSec());
    fetchShort(ci); paintQuality();
  }
  function paintStats() {
    var el0 = $('lhStats'); if (!el0) return;
    if (!P.on || !SET.stats) { el0.className = 'hidden'; return; }
    var parts = [], h = P.hls, lv = h && h.levels && h.currentLevel >= 0 ? h.levels[h.currentLevel] : null, q = video.getVideoPlaybackQuality ? video.getVideoPlaybackQuality() : null;
    if (video.videoHeight) parts.push(video.videoWidth + '×' + video.videoHeight);
    if (lv && lv.bitrate) parts.push((lv.bitrate / 1e6).toFixed(1) + ' Mbps stream');
    if (h && h.bandwidthEstimate) parts.push((h.bandwidthEstimate / 1e6).toFixed(1) + ' Mbps link');
    if (video.buffered && video.buffered.length) parts.push('buffer ' + Math.max(0, video.buffered.end(video.buffered.length - 1) - video.currentTime).toFixed(0) + ' s');
    if (q) parts.push(q.droppedVideoFrames + ' dropped');
    if (P.cur) parts.push((P.cur.via === 'proxy' ? 'via server' : 'direct') + ' · ' + P.cur.kind + (P.cur.ext ? ' · ' + P.cur.ext : ''));
    el0.className = ''; el0.textContent = parts.join('   ·   ');
  }
  setInterval(function () { if (P.on && SET.stats) paintStats(); }, 1000);
  function paintQuality() {
    var q = $('lhQ'), t = '';
    if (P.hls && P.hls.levels && P.hls.levels.length) { var lv = P.hls.levels[P.hls.currentLevel >= 0 ? P.hls.currentLevel : (P.hls.loadLevel >= 0 ? P.hls.loadLevel : 0)]; if (lv && lv.height) t = lv.height + 'p'; }
    else if (video.videoHeight) t = video.videoHeight + 'p';
    q.textContent = t; q.style.display = t ? '' : 'none';
  }

  // ---- zapping ----
  var zapStart = tick(function () { startStream(true); }, 340);
  function zap(dir) {
    if (!P.list || !P.list.length) return;
    P.pos = (P.pos + dir + P.list.length) % P.list.length;
    var ci = P.list[P.pos]; if (ci === P.ci) return;
    P.prev = P.ci; P.ci = ci; P.token++; clearTimeout(P.startT); stopMedia(); pushRecent(ci);
    setMsg('Tuning…', '', true); paintHud(); showHud(); zapStart();
  }
  function goChannel(ci) {                                                         // jump to a channel that may not be in the zap list
    var p = findIn(P.list || [], ci);
    if (p < 0) { P.list = V.idx.length && findIn(V.idx, ci) >= 0 ? V.idx : viewOf({ kind: 'all' }, ''); p = findIn(P.list, ci); }
    P.pos = p; P.prev = P.ci; P.ci = ci; pushRecent(ci); paintHud(); showHud(); startStream(true);
  }
  function numberKey(d) {
    P.numBuf = (P.numBuf + d).slice(0, 5);
    var b = $('liveNum'); b.className = ''; b.textContent = P.numBuf;
    clearTimeout(P.numT); P.numT = setTimeout(commitNumber, 1900);
  }
  function commitNumber() {
    clearTimeout(P.numT); var n = P.numBuf; P.numBuf = ''; $('liveNum').className = 'hidden';
    if (!n) return;
    var ci = numMap()['$' + parseInt(n, 10)];
    if (ci === undefined) { toast('No channel ' + n); return; }
    goChannel(ci);
  }

  // ---- side panel: channel list while watching ----
  function openSide() {
    if (!SL) SL = new VList($('liveSideList'), { rowRem: 3.8, build: buildCh, paint: function (r, i, s, a) { paintCh(r, i, s, a, { idx: P.sideView }, ' side'); }, onClick: function (i) { sidePlay(i); }, onMove: function () {} });
    P.side = true; $('liveSide').className = ''; P.sideCat = P.sideCat || { kind: C.kind, g: C.g };
    sideBuild(true); showHud(60000);
  }
  function sideBuild(keep) {
    var cat = P.sideCat; P.sideView = (cat.kind === 'cur') ? P.list : viewOf(cat, '');
    $('liveSideHead').innerHTML = '<span>◀</span><b>' + esc(sideTitle()) + '</b><span>▶</span><i>' + num(P.sideView.length) + '</i>';
    SL.layout(); SL.setN(P.sideView.length);
    var p = findIn(P.sideView, P.ci); SL.active = true; SL.select(p >= 0 ? p : 0); SL.paintAll();
  }
  function sideTitle() { var c = P.sideCat; return c.kind === 'fav' ? 'Favorites' : c.kind === 'recent' ? 'Recently watched' : c.kind === 'g' ? D.groups[c.g] : 'All channels'; }
  function sideCycle(dir) {
    var cats = [{ kind: 'fav' }, { kind: 'recent' }, { kind: 'all' }], g;
    for (g = 0; g < D.groups.length; g++) if (D.gc[g] > 0) cats.push({ kind: 'g', g: g });
    var i, cur = 2; for (i = 0; i < cats.length; i++) if (cats[i].kind === P.sideCat.kind && (cats[i].g || 0) === (P.sideCat.g || 0)) cur = i;
    P.sideCat = cats[(cur + dir + cats.length) % cats.length]; sideBuild(false);
  }
  function sidePlay(i) { var ci = P.sideView[i]; if (ci === undefined) return; P.list = P.sideView; P.pos = i; closeSide(); goChannel(ci); }
  function closeSide() { P.side = false; $('liveSide').className = 'hidden'; showHud(3500); }

  // ---- options menu ----
  function applyAspect() {
    var a = SET.aspect, s = video.style;
    s.objectFit = a === 'fill' ? 'cover' : a === 'stretch' ? 'fill' : 'contain'; s.webkitTransform = s.transform = a === 'zoom' ? 'scale(1.18)' : '';
  }
  function levelsOf() { var h = P.hls; return h && h.levels && h.levels.length > 1 ? h.levels : null; }
  function applyQuality() { var h = P.hls, pref = store.get('ea_live_q', 'auto'); if (!h || !h.levels || pref === 'auto') return; var best = -1, bh = 0; h.levels.forEach(function (l, i) { if (l.height <= pref && l.height >= bh) { bh = l.height; best = i; } }); h.currentLevel = best < 0 ? 0 : best; }
  function menuRows() {
    var rows = [], lv = levelsOf(), q = store.get('ea_live_q', 'auto'), h = P.hls, ci = P.ci;
    var heights = []; if (lv) lv.forEach(function (l) { if (l.height && heights.indexOf(l.height) < 0) heights.push(l.height); }); heights.sort(function (a, b) { return b - a; });
    rows.push({ l: 'Quality', v: lv ? (q === 'auto' ? 'Auto' : q + 'p') : 'Single stream', ch: function (d) { if (!lv) { toast('This channel has one quality'); return; } var opts = ['auto'].concat(heights), i = Math.max(0, opts.indexOf(q)); var n = opts[(i + d + opts.length) % opts.length]; store.set('ea_live_q', n); if (n === 'auto') h.currentLevel = -1; else applyQuality(); } });
    var at = h && h.audioTracks && h.audioTracks.length > 1 ? h.audioTracks : null;
    rows.push({ l: 'Audio', v: at ? (at[h.audioTrack] && (at[h.audioTrack].name || at[h.audioTrack].lang) || 'Track ' + (h.audioTrack + 1)) : 'Default', ch: function (d) { if (!at) { toast('No other audio tracks'); return; } h.audioTrack = (h.audioTrack + d + at.length) % at.length; } });
    var AS = { fit: 'Fit', fill: 'Fill (crop)', stretch: 'Stretch', zoom: 'Zoom' }, order = ['fit', 'fill', 'stretch', 'zoom'];
    rows.push({ l: 'Picture', v: AS[SET.aspect], ch: function (d) { SET.aspect = order[(order.indexOf(SET.aspect) + d + 4) % 4]; saveSet(); applyAspect(); } });
    var SLP = [0, 15, 30, 45, 60, 90, 120], sv = P.sleepMin || 0;
    rows.push({ l: 'Sleep timer', v: sv ? sv + ' min' : 'Off', ch: function (d) { var i = Math.max(0, SLP.indexOf(sv)); setSleep(SLP[(i + d + SLP.length) % SLP.length]); } });
    rows.push({ l: 'Connection', v: P.forceVia === 'proxy' ? 'Via server' : P.forceVia === 'direct' ? 'Direct' : 'Automatic', ch: function (d) { var o = ['', 'direct', 'proxy'], i = o.indexOf(P.forceVia || ''); P.forceVia = o[(i + d + 3) % 3]; startStream(true); } });
    rows.push({ l: 'Favorite', v: isFav(ci) ? '♥ In Favorites' : 'Add to Favorites', ch: function () { toggleFav(ci); paintHud(); buildRailCounts(); } });
    rows.push({ l: 'Stream stats', v: SET.stats ? 'On' : 'Off', ch: function () { SET.stats = !SET.stats; saveSet(); paintStats(); } });
    return rows;
  }
  function renderMenu() {
    var rows = menuRows(), box = $('liveMenuRows'); box.innerHTML = ''; if (P.menuIdx >= rows.length) P.menuIdx = rows.length - 1;
    P.menuRowsList = rows;
    rows.forEach(function (r, i) {
      var d = el('div', 'mrow' + (i === P.menuIdx ? ' sel' : ''), '<span class="ml">' + esc(r.l) + '</span><span class="mv">◀ ' + esc(r.v) + ' ▶</span>');
      d.onclick = function () { P.menuIdx = i; r.ch(1); renderMenu(); };
      box.appendChild(d);
    });
    var nn = progOf(P.ci), up = '';
    var l = (D.e[P.ci] && D.epg[D.e[P.ci]]) || D.epgShort['#' + D.u[P.ci]] || [], n = 0, i2;
    for (i2 = 0; i2 < l.length && n < 5; i2++) if (l[i2][1] > T.now) { up += '<div class="gl"><b>' + gt(l[i2][0]) + '</b><span>' + esc(l[i2][2]) + '</span></div>'; n++; }
    if (up) box.appendChild(el('div', 'mguide', '<div class="mg">Coming up</div>' + up));
  }
  function openMenu() { P.menu = true; P.menuIdx = 0; $('liveMenu').className = ''; renderMenu(); showHud(60000); }
  function closeMenu() { P.menu = false; $('liveMenu').className = 'hidden'; showHud(3500); }
  function setSleep(min) {
    clearTimeout(P.sleepT); P.sleepMin = min; $('lhSleep').textContent = '';
    if (!min) { P.sleepAt = 0; return; }
    P.sleepAt = Date.now() + min * 60000; $('lhSleep').textContent = '☾ ' + min + ' min';
    P.sleepT = setTimeout(function () { if (P.on) { toast('Sleep timer: goodbye'); leavePlayer(); } }, min * 60000);
  }
  setInterval(function () { if (P.on && P.sleepAt) { var m = Math.ceil((P.sleepAt - Date.now()) / 60000); $('lhSleep').textContent = '☾ ' + Math.max(1, m) + ' min'; } }, 20000);

  // ---- player keys ----
  function digitOf(k) { return k >= 48 && k <= 57 ? k - 48 : k >= 96 && k <= 105 ? k - 96 : -1; }
  function back() {                                                                // one place for every Back press while watching (keydown and the TV's hardware-back event)
    state.lastBack = Date.now();
    if (P.menu) closeMenu(); else if (P.side) closeSide();
    else if (P.numBuf) { P.numBuf = ''; $('liveNum').className = 'hidden'; }
    else leavePlayer();
  }
  function playerKey(k) {
    var kk = EA.KEY, d = digitOf(k);
    if (P.menu) {
      var rows = P.menuRowsList || [], n = rows.length;
      if (EA.isBackKey(k) || k === kk.STOP) { back(); return; }
      if (k === kk.UP) P.menuIdx = (P.menuIdx + n - 1) % n; else if (k === kk.DOWN) P.menuIdx = (P.menuIdx + 1) % n;
      else if (k === kk.LEFT) rows[P.menuIdx].ch(-1); else if (k === kk.RIGHT || k === kk.ENTER) rows[P.menuIdx].ch(1); else return;
      renderMenu(); return;
    }
    if (P.side) {
      if (EA.isBackKey(k) || k === kk.STOP) { back(); return; }
      if (k === kk.UP) SL.move(-1); else if (k === kk.DOWN) SL.move(1); else if (k === K.CH_UP) SL.move(-(SL.vis - 1)); else if (k === K.CH_DOWN) SL.move(SL.vis - 1);
      else if (k === kk.ENTER) sidePlay(SL.sel); else if (k === kk.LEFT) sideCycle(-1); else if (k === kk.RIGHT) sideCycle(1);
      else if (k === K.YELLOW) { var ci0 = P.sideView[SL.sel]; if (ci0 !== undefined) { toggleFav(ci0); SL.paintRow(SL.sel); } }
      return;
    }
    if (d >= 0) { numberKey(d); return; }
    if (EA.isBackKey(k) || k === kk.STOP) { back(); return; }
    if (k === kk.UP || k === K.CH_UP) zap(-1);
    else if (k === kk.DOWN || k === K.CH_DOWN) zap(1);
    else if (k === kk.LEFT) openSide();
    else if (k === kk.RIGHT || k === 81 || k === 83 || k === K.RED || k === K.INFO || k === 457) openMenu();
    else if (k === kk.ENTER) { if (P.numBuf) commitNumber(); else if ($('liveMsg').className === 'err') startStream(true); else if (P.hud) { $('liveHud').className = 'idle'; P.hud = false; } else { paintHud(); showHud(6000); } }
    else if (k === kk.PLAYPAUSE || k === kk.PLAY || k === kk.PAUSE || k === kk.SPACE) { if (video.paused) { var pr = video.play(); if (pr && pr.catch) pr.catch(function () {}); } else video.pause(); showHud(3000); }
    else if (k === K.GREEN) { if (P.prev >= 0) goChannel(P.prev); else toast('No previous channel yet'); }
    else if (k === K.YELLOW) { toggleFav(P.ci); paintHud(); buildRailCounts(); showHud(3000); }
    else if (k === K.BLUE) { var SLP = [0, 15, 30, 45, 60, 90, 120], i = SLP.indexOf(P.sleepMin || 0); setSleep(SLP[(i + 1) % SLP.length]); toast(P.sleepMin ? 'Sleep timer: ' + P.sleepMin + ' min' : 'Sleep timer off'); }
    else if (k === kk.FF || k === kk.RW) { /* live: no seeking */ }
    else showHud(3500);
  }
  $('player').addEventListener('click', function (e) {
    if (!P.on) return; e.stopPropagation();
    if (EA.up(e.target, 'mrow') || EA.up(e.target, 'vrow')) return;
    if (P.menu) { closeMenu(); return; } if (P.side) { closeSide(); return; }
    if (P.hud) { $('liveHud').className = 'idle'; P.hud = false; } else { paintHud(); showHud(); }
  }, true);
  $('player').addEventListener('mousemove', function () { if (P.on && !P.hud && !P.menu && !P.side) showHud(3000); });
  document.addEventListener('visibilitychange', function () {
    if (!P.on) return;
    if (document.hidden) { stopMedia(); P.token++; } else { startStream(true); }                          // leaving the app must not keep a stream (and a connection slot) open
  });

  // ====================================================================== modal screens (playlists, forms, settings)
  var M = { name: '', ctx: null, pairT: 0 };
  function modal(name, ctx) {
    M.name = name; M.ctx = ctx || {}; clearInterval(M.pairT);
    var box = $('liveModalBox'); box.innerHTML = ''; box.className = 'm-' + name;
    $('liveModal').className = ''; if (state.view !== 'modal') { M.prevView = state.view; state.view = 'modal'; }
    var fn = SCREENS[name]; fn(box, M.ctx);
    var first = box.querySelector('.focusable'); if (first) EA.setFocus(first);
  }
  function closeModal() {
    clearInterval(M.pairT); M.pairT = 0;
    $('liveModal').className = 'hidden'; state.view = M.prevView && M.prevView !== 'modal' ? M.prevView : 'live'; M.name = '';
    if (state.tab === 'live') { if (!PLS.length) { renderEmpty(); showView('empty'); var b = $('liveEmpty').querySelector('.focusable'); if (b) EA.setFocus(b); } else if (D && D.ready) enterList(); else focusTool('livePlBtn'); }
  }
  function mkBtn(label, act, cls, data) { var b = el('button', 'btn focusable ' + (cls || ''), label); b.__live = { act: act, d: data }; return b; }
  function mkField(box, label, id, ph, val, type) {
    var w = el('div', 'mfield'); w.appendChild(el('label', '', esc(label)));
    var i = el('input', 'focusable'); i.id = id; i.type = type || 'text'; i.placeholder = ph || ''; i.value = val || ''; i.autocomplete = 'off'; i.spellcheck = false; i.setAttribute('autocapitalize', 'none');
    i.__live = { act: 'input' }; w.appendChild(i); box.appendChild(w); return i;
  }
  function head(box, title, sub) { box.appendChild(el('h2', '', esc(title))); if (sub) box.appendChild(el('p', 'msub', sub)); }
  var SCREENS = {
    add: function (box) {
      head(box, 'Add a playlist', 'Aniultimatium comes with no channels. Bring your own provider, or start with free public channels.');
      var g = el('div', 'mopts');
      [['pair', 'Add with your phone', 'Enter a code on your phone. Easiest, no typing on the remote.', 'rec'], ['xtream', 'Xtream login', 'Server, username and password from your provider.'], ['m3u', 'M3U link', 'A playlist address ending in .m3u or .m3u8.'], ['free', 'Free public channels', 'Community lists by country, category or language.']].forEach(function (o) {
        var b = el('button', 'mopt focusable' + (o[3] ? ' rec' : ''), '<b>' + o[1] + '</b><span>' + o[2] + '</span>' + (o[3] ? '<i>Recommended</i>' : '')); b.__live = { act: 'go-' + o[0] }; g.appendChild(b);
      });
      box.appendChild(g);
      if (PLS.length) { var r = el('div', 'mrow2'); r.appendChild(mkBtn('Close', 'close', 'ghost')); box.appendChild(r); }
    },
    xtream: function (box, c) {
      head(box, 'Xtream login', 'The three details your IPTV provider gave you.');
      mkField(box, 'Name (optional)', 'liveFName', 'My IPTV', c.name); mkField(box, 'Server address', 'liveFServer', 'http://provider.example:8080', c.server);
      mkField(box, 'Username', 'liveFUser', '', c.user); mkField(box, 'Password', 'liveFPass', '', c.pass);
      var r = el('div', 'mrow2'); r.appendChild(mkBtn('Connect', 'do-xtream', 'primary')); r.appendChild(mkBtn('Back', 'go-add', 'ghost')); box.appendChild(r);
      box.appendChild(el('p', 'mmsg', '')).id = 'liveFMsg';
    },
    m3u: function (box, c) {
      head(box, 'M3U link', 'Paste the playlist address. A link with username and password in it (get.php?username=…) is detected as Xtream automatically.');
      mkField(box, 'Name (optional)', 'liveFName', 'My IPTV', c.name); mkField(box, 'Playlist link', 'liveFUrl', 'https://…/playlist.m3u', c.url);
      var r = el('div', 'mrow2'); r.appendChild(mkBtn('Add playlist', 'do-m3u', 'primary')); r.appendChild(mkBtn('Back', 'go-add', 'ghost')); box.appendChild(r);
      box.appendChild(el('p', 'mmsg', '')).id = 'liveFMsg';
    },
    error: function (box, c) {
      head(box, 'Could not open the playlist', esc(c.msg || ''));
      var det = (c.all || []).slice(0, 3).map(function (x) { return '<li>' + esc(x) + '</li>'; }).join('');
      if (det) box.appendChild(el('ul', 'mlist', det));
      box.appendChild(el('p', 'msub', 'Check the address, your internet connection and that your subscription is active. Some providers block cloud servers: if so, run the app at home (npm start) and set it in Settings.'));
      var r = el('div', 'mrow2'); r.appendChild(mkBtn('Try again', 'retry', 'primary')); r.appendChild(mkBtn('Playlists', 'go-manage', '')); r.appendChild(mkBtn('Close', 'close', 'ghost')); box.appendChild(r);
    },
    pair: function (box) {
      head(box, 'Add with your phone', 'Scan the QR code, or type the address on your phone. Enter your provider’s details there and they arrive here. The server forgets them as soon as the TV has them.');
      var info = el('div', 'pairbox', '<div class="pairtxt"><div class="pl">Open on your phone</div><div class="pu">…</div><div class="pl">and enter the code</div><div class="pc">······</div><div class="pw">Getting a code…</div></div><div class="pqr"></div>'); box.appendChild(info);
      var r = el('div', 'mrow2'); r.appendChild(mkBtn('Cancel', 'go-add', 'ghost')); box.appendChild(r);
      EA.api({ action: 'pair_start' }).then(function (p) {
        if (M.name !== 'pair') return;
        info.querySelector('.pu').textContent = p.url.replace(/^https?:\/\//, ''); info.querySelector('.pc').textContent = p.code;
        qr(info.querySelector('.pqr'), p.url + '?code=' + p.code);                      // scan instead of typing the address
        info.querySelector('.pw').textContent = p.persistent ? 'Waiting for your phone…' : 'Waiting… (this server stores codes in memory only: if it never completes, use Xtream or M3U instead)';
        var until = Date.now() + p.expiresIn * 1000;
        M.pairT = setInterval(function () {
          if (Date.now() > until) { clearInterval(M.pairT); info.querySelector('.pw').textContent = 'The code expired. Go back and try again.'; return; }
          EA.api({ action: 'pair_poll', code: p.code }).then(function (x) {
            if (x.status === 'ok') { clearInterval(M.pairT); closeModal(); addPlaylist(x.playlist); }
            else if (x.status === 'expired') { clearInterval(M.pairT); info.querySelector('.pw').textContent = 'The code expired. Go back and try again.'; }
          }).catch(function () {});
        }, 3000);
      }).catch(function (e) { info.querySelector('.pw').textContent = e.message; });
    },
    free: function (box, c) {
      head(box, 'Free public channels', 'A community-maintained list of free-to-air channels (iptv-org). Which ones play depends on your region.');
      var kind = c.kind || 'country', tabs = el('div', 'mtabs');
      [['country', 'By country'], ['category', 'By category'], ['language', 'By language'], ['all', 'Everything']].forEach(function (t) { var b = mkBtn(t[1], 'free-tab', 'chip' + (kind === t[0] ? ' on' : ''), t[0]); tabs.appendChild(b); });
      box.appendChild(tabs);
      var sc = el('div', 'mscroll mgrid'); box.appendChild(sc);
      function add(label, url, name) { var b = mkBtn(label, 'free-pick', 'chip big', { url: url, name: name }); sc.appendChild(b); }
      var base = 'https://iptv-org.github.io/iptv/';
      if (kind === 'all') { add('All free channels (about 11,000)', base + 'index.m3u', 'Free · All channels'); add('News', base + 'categories/news.m3u', 'Free · News'); add('Sports', base + 'categories/sports.m3u', 'Free · Sports'); }
      else if (kind === 'category') ['news', 'sports', 'movies', 'music', 'kids', 'documentary', 'entertainment', 'general', 'comedy', 'cooking', 'education', 'family', 'lifestyle', 'travel', 'weather', 'religious', 'science', 'series', 'animation', 'culture', 'business', 'outdoor', 'classic', 'legislative', 'relax', 'shop', 'auto', 'interactive', 'public'].forEach(function (x) { add(x.charAt(0).toUpperCase() + x.slice(1), base + 'categories/' + x + '.m3u', 'Free · ' + x.charAt(0).toUpperCase() + x.slice(1)); });
      else if (kind === 'language') [['eng', 'English'], ['spa', 'Spanish'], ['fra', 'French'], ['deu', 'German'], ['ita', 'Italian'], ['por', 'Portuguese'], ['ara', 'Arabic'], ['hin', 'Hindi'], ['tam', 'Tamil'], ['tel', 'Telugu'], ['mal', 'Malayalam'], ['kan', 'Kannada'], ['ben', 'Bengali'], ['urd', 'Urdu'], ['rus', 'Russian'], ['tur', 'Turkish'], ['zho', 'Chinese'], ['jpn', 'Japanese'], ['kor', 'Korean'], ['nld', 'Dutch'], ['pol', 'Polish'], ['ind', 'Indonesian'], ['vie', 'Vietnamese'], ['tha', 'Thai'], ['fas', 'Persian']].forEach(function (x) { add(x[1], base + 'languages/' + x[0] + '.m3u', 'Free · ' + x[1]); });
      else {
        var FB = [['us', 'United States'], ['uk', 'United Kingdom'], ['ca', 'Canada'], ['au', 'Australia'], ['in', 'India'], ['de', 'Germany'], ['fr', 'France'], ['es', 'Spain'], ['it', 'Italy'], ['br', 'Brazil'], ['mx', 'Mexico'], ['jp', 'Japan'], ['kr', 'South Korea'], ['tr', 'Turkey'], ['ae', 'UAE'], ['sa', 'Saudi Arabia'], ['pk', 'Pakistan'], ['id', 'Indonesia'], ['ph', 'Philippines'], ['za', 'South Africa'], ['ng', 'Nigeria'], ['ru', 'Russia'], ['pl', 'Poland'], ['nl', 'Netherlands']];
        var cached = store.get('ea_live_countries', null);
        function fill(list) { sc.innerHTML = ''; list.forEach(function (x) { add((x[2] ? x[2] + ' ' : '') + x[1], base + 'countries/' + x[0] + '.m3u', 'Free · ' + x[1]); }); var f = sc.querySelector('.focusable'); if (f && M.name === 'free' && !c.__filled) { c.__filled = 1; EA.setFocus(f); } }
        fill(cached && cached.at > Date.now() - 7 * 86400000 ? cached.list : FB);
        if (!cached || cached.at < Date.now() - 7 * 86400000) fetch('https://iptv-org.github.io/api/countries.json').then(function (r) { return r.json(); }).then(function (j) {
          var list = j.map(function (x) { return [String(x.code).toLowerCase(), x.name, x.flag || '']; }).sort(function (a, b) { return a[1] < b[1] ? -1 : 1; });
          store.set('ea_live_countries', { at: Date.now(), list: list }); if (M.name === 'free' && (c.kind || 'country') === 'country') fill(list);
        }).catch(function () {});
      }
      var r = el('div', 'mrow2'); r.appendChild(mkBtn('Back', 'go-add', 'ghost')); box.appendChild(r);
    },
    manage: function (box) {
      head(box, 'Playlists', 'Pick one to open it. Your favorites are kept separately for each playlist.');
      var sc = el('div', 'mscroll'); box.appendChild(sc);
      PLS.forEach(function (pl) {
        var row = el('div', 'plrow' + (pl.id === act ? ' cur' : ''), '<span class="plav">' + esc(initials(pl.name)) + '</span><span class="plt"><b>' + esc(pl.name) + '</b><i>' + (pl.type === 'xtream' ? 'Xtream · ' + esc(pl.server.replace(/^https?:\/\//, '')) : pl.free ? 'Free public list' : 'M3U') + ' · ' + (pl.count ? num(pl.count) + ' channels' : 'not loaded') + ' · updated ' + ago(pl.updated) + '</i></span>');
        var bs = el('span', 'plb'); bs.appendChild(mkBtn(pl.id === act ? 'Open ✓' : 'Open', 'pl-open', 'sm', pl.id)); bs.appendChild(mkBtn('Refresh', 'pl-refresh', 'sm', pl.id));
        if (pl.type === 'xtream') bs.appendChild(mkBtn('Account', 'pl-info', 'sm', pl.id));
        bs.appendChild(mkBtn('Delete', 'pl-del', 'sm bad', pl.id)); row.appendChild(bs); sc.appendChild(row);
      });
      var r = el('div', 'mrow2'); r.appendChild(mkBtn('＋ Add playlist', 'go-add', 'primary')); r.appendChild(mkBtn('Close', 'close', 'ghost')); box.appendChild(r);
      box.appendChild(el('p', 'mmsg', '')).id = 'liveFMsg';
    },
    settings: function (box) {
      head(box, 'Live TV settings', 'OK changes a setting. Saved on this device.');
      var sc = el('div', 'mscroll msets'), g = sc;
      function row(label, val, act) { var b = mkBtn('<span>' + esc(label) + '</span><b>' + esc(val) + '</b>', act, 'setr'); g.appendChild(b); }
      var onoff = function (v) { return v ? 'On' : 'Off'; };
      row('Stream format (Xtream)', (SET.ext === 'ts' ? 'TS (MPEG-TS)' : 'HLS (m3u8)') + (curPl() && curPl().extLearned ? ' · this provider uses ' + curPl().extLearned : ''), 'set-ext');
      row('Sort channels', SET.sort === 'az' ? 'A–Z' : SET.sort === 'num' ? 'By number' : 'Provider order', 'set-sort');
      row('Open on', { all: 'All channels', fav: 'Favorites', last: 'Last group used' }[SET.start], 'set-start');
      row('Open the last channel on start', onoff(SET.autoplay), 'set-auto');
      row('TV guide (now / next)', onoff(SET.guide), 'set-guide');
      row('Guide time shift', (SET.shift > 0 ? '+' : '') + SET.shift + ' h', 'set-shift');
      row('Clock', SET.clock12 ? '12-hour' : '24-hour', 'set-clock');
      row('Adult groups', SET.adult ? 'Shown' : 'Hidden', 'set-adult');
      row('Parental PIN', SET.pin ? 'On' : 'Off', 'set-pin');
      row('Picture', { fit: 'Fit', fill: 'Fill (crop)', stretch: 'Stretch', zoom: 'Zoom' }[SET.aspect], 'set-aspect');
      row('Buffering', { fast: 'Fast start', balanced: 'Balanced', stable: 'Stable (weak connection)' }[SET.buffer], 'set-buffer');
      row('Channel banner stays', SET.banner + ' s', 'set-banner');
      row('Channel logos', onoff(SET.logos), 'set-logos');
      row('Stream stats overlay', onoff(SET.stats), 'set-stats');
      row('Playlist update', { daily: 'Daily', weekly: 'Weekly', manual: 'Only when I press Refresh' }[SET.auto], 'set-autoup');
      row('Request User-Agent (through the server)', { '': 'Default', vlc: 'VLC', okhttp: 'OkHttp', chrome: 'Chrome' }[SET.ua], 'set-ua');
      var pl = curPl(); if (pl) row('Guide address (XMLTV)', pl.type === 'xtream' ? 'Automatic' : (pl.epgUrl ? 'From playlist' : 'None'), 'set-guideurl');
      box.appendChild(sc);
      var r = el('div', 'mrow2'); r.appendChild(mkBtn('Playlists', 'go-manage', '')); r.appendChild(mkBtn('Clear saved data', 'clear-data', 'bad')); r.appendChild(mkBtn('Close', 'close', 'ghost')); box.appendChild(r);
      box.appendChild(el('p', 'mmsg', '')).id = 'liveFMsg';
    },
    pin: function (box, c) {
      head(box, c.mode === 'set' ? 'Set a parental PIN' : c.mode === 'unlock' ? 'Enter the PIN to show adult groups' : 'Enter the PIN to turn it off', c.mode === 'set' ? 'Four digits. Needed to show adult groups. This is a household lock, not strong security.' : '');
      var f = mkField(box, 'PIN (4 digits)', 'liveFPin', '••••', '', 'password'); f.maxLength = 4; f.setAttribute('inputmode', 'numeric');
      var r = el('div', 'mrow2'); r.appendChild(mkBtn('OK', 'do-pin', 'primary', c.mode)); r.appendChild(mkBtn('Cancel', 'go-settings', 'ghost')); box.appendChild(r);
      box.appendChild(el('p', 'mmsg', '')).id = 'liveFMsg';
    },
    info: function (box, c) {
      head(box, c.title || 'Account'); var l = el('div', 'minfo', c.html || ''); box.appendChild(l);
      var r = el('div', 'mrow2'); r.appendChild(mkBtn('Back', 'go-manage', 'ghost')); box.appendChild(r);
    },
    guideurl: function (box, c) {
      head(box, 'TV guide address', 'XMLTV address for this playlist (.xml). Compressed .gz guides are not supported on TVs.'); mkField(box, 'Guide address', 'liveFGuide', 'https://…/guide.xml', c.url);
      var r = el('div', 'mrow2'); r.appendChild(mkBtn('Save', 'do-guideurl', 'primary')); r.appendChild(mkBtn('Back', 'go-settings', 'ghost')); box.appendChild(r);
    }
  };
  function qr(box, text) {                                                         // QR code as an image (vendored qr.js); silently nothing if it cannot be made
    try { if (!window.qrcode || !box) return; var q = window.qrcode(0, 'M'); q.addData(text); q.make(); box.innerHTML = '<img alt="QR code" src="' + q.createDataURL(6, 2) + '">'; } catch (e) { if (box) box.innerHTML = ''; }
  }
  EA.qr = qr;
  function fmsg(t, bad) { var m = $('liveFMsg'); if (m) { m.textContent = t || ''; m.className = 'mmsg' + (bad ? ' bad' : ''); } }
  function val(id) { var e = $(id); return e ? e.value.trim() : ''; }

  function addPlaylist(d) {
    var pl;
    if (d.type === 'xtream') pl = { id: uid(), type: 'xtream', name: d.name || 'IPTV', server: IPTV.normServer(d.server), user: d.user, pass: d.pass, ext: SET.ext };
    else {
      var x = IPTV.sniffXtream(d.url);
      pl = x ? { id: uid(), type: 'xtream', name: d.name || 'IPTV', server: IPTV.normServer(x.server), user: x.user, pass: x.pass, ext: SET.ext } : { id: uid(), type: 'm3u', name: d.name || 'My playlist', url: d.url, free: !!d.free };
    }
    PLS.push(pl); savePls(); act = pl.id; store.set('ea_live_act', act);
    showView('wrap'); ensureLists(); layoutAll(); paintHeader();
    D = null; openPlaylist(pl, true);
  }
  function renderEmpty() {
    var b = $('liveEmpty'); b.innerHTML = '';
    var c = el('div', 'emptybox'); c.innerHTML = '<div class="eicon">' + EA.ic('live') + '</div><h2>Live TV</h2><p>A fast, remote-friendly TV guide for your own IPTV playlist. Aniultimatium does not provide channels: add your provider’s playlist, or try free public channels.</p>';
    var r = el('div', 'erow2');
    [['go-pair', 'Add with phone', 'primary'], ['go-xtream', 'Xtream login', ''], ['go-m3u', 'M3U link', ''], ['go-free', 'Free channels', '']].forEach(function (o) { var x = mkBtn(o[1], o[0].replace('go-', 'go-'), o[2]); x.__live = { act: o[0] }; r.appendChild(x); });
    c.appendChild(r); b.appendChild(c);
  }
  function deletePlaylist(id) {
    var pl = null; PLS = PLS.filter(function (x) { if (x.id === id) { pl = x; return false; } return true; }); savePls();
    if (!pl) return; db.dropChannels(pid(pl)); db.dropEpg(pid(pl));
    ['fav', 'rec', 'last'].forEach(function (w) { try { localStorage.removeItem(userKey(w, pl)); } catch (e) { /* ignore */ } });
    if (act === id) { act = PLS[0] ? PLS[0].id : ''; store.set('ea_live_act', act); D = null; if (LL) { LL.setN(0); RL.setN(0); } }
  }

  function nextOf(list, v) { return list[(list.indexOf(v) + 1) % list.length]; }
  function again() {                                                               // redraw the settings list but keep the focus on the row that was just changed
    var rows = [].slice.call(document.querySelectorAll('#liveModalBox .setr')), at = rows.indexOf(state.focusEl), sc = document.querySelector('#liveModalBox .mscroll'), top = sc ? sc.scrollTop : 0;
    modal('settings');
    var nr = document.querySelectorAll('#liveModalBox .setr'), sc2 = document.querySelector('#liveModalBox .mscroll');
    if (sc2) sc2.scrollTop = top; if (at >= 0 && nr[at]) EA.setFocus(nr[at]);
  }
  function activate(e) {
    var a = e.__live ? e.__live.act : e.id, d = e.__live ? e.__live.d : null, pl, tk;
    switch (a) {
      case 'livePlBtn': if (PLS.length) modal('manage'); else modal('add'); break;
      case 'liveSort': cycleSort(); break;
      case 'liveRefresh': pl = curPl(); if (pl) { toast('Refreshing…'); loadTk++; showView('wrap'); refresh(pl, false, loadTk, false).catch(function () {}); } else modal('add'); break;
      case 'liveSet': modal('settings'); break;
      case 'close': closeModal(); break;
      case 'go-add': modal('add'); break;
      case 'go-pair': modal('pair'); break;
      case 'go-xtream': modal('xtream', {}); break;
      case 'go-m3u': modal('m3u', {}); break;
      case 'go-free': modal('free', {}); break;
      case 'go-manage': modal('manage'); break;
      case 'go-settings': modal('settings'); break;
      case 'free-tab': modal('free', { kind: d }); break;
      case 'free-pick': closeModal(); addPlaylist({ type: 'm3u', name: d.name, url: d.url, free: true }); break;
      case 'do-m3u': { var u = val('liveFUrl'); if (!/^https?:\/\/\S+$/i.test(u)) { fmsg('Enter a link that starts with http:// or https://', true); break; } closeModal(); addPlaylist({ type: 'm3u', name: val('liveFName'), url: u }); break; }
      case 'do-xtream': {
        var sv = val('liveFServer'), us = val('liveFUser'), pw = val('liveFPass');
        if (!sv || !us || !pw) { fmsg('Enter the server, username and password', true); break; }
        fmsg('Checking the login…');
        var nm = val('liveFName'), server = IPTV.normServer(sv), probe = { type: 'xtream', server: server, user: us, pass: pw, name: nm };
        getClient().run({ kind: 'auth', server: server, user: us, pass: pw, tries: tries(probe, server, false) }).then(function (info) {
          closeModal(); addPlaylist(probe); if (info.exp) toast('Subscription valid until ' + new Date(info.exp * 1000).toLocaleDateString());
        }, function (err) { fmsg(err.message, true); });
        break;
      }
      case 'retry': closeModal(); pl = curPl(); if (pl) { showView('wrap'); refresh(pl, true, ++loadTk, false).catch(function () {}); } break;
      case 'pl-open': closeModal(); pl = null; PLS.forEach(function (x) { if (x.id === d) pl = x; }); if (pl) { showView('wrap'); layoutAll(); openPlaylist(pl, true); } break;
      case 'pl-refresh': pl = null; PLS.forEach(function (x) { if (x.id === d) pl = x; }); if (pl) { closeModal(); act = pl.id; store.set('ea_live_act', act); showView('wrap'); layoutAll(); ++loadTk; refresh(pl, true, loadTk, false).catch(function () {}); } break;
      case 'pl-del': deletePlaylist(d); if (!PLS.length) { closeModal(); } else modal('manage'); break;
      case 'pl-info': pl = null; PLS.forEach(function (x) { if (x.id === d) pl = x; }); if (pl) {
        modal('info', { title: pl.name, html: '<p>Checking the account…</p>' });
        getClient().run({ kind: 'auth', server: pl.server.replace(/\/+$/, ''), user: pl.user, pass: pl.pass, tries: tries(pl, pl.server, false) }).then(function (i) {
          if (M.name !== 'info') return;
          var l = document.querySelector('#liveModalBox .minfo'); if (l) l.innerHTML = '<div class="kv"><span>Status</span><b>' + esc(i.status || 'unknown') + '</b></div><div class="kv"><span>Expires</span><b>' + (i.exp ? new Date(i.exp * 1000).toLocaleDateString() : 'never / unknown') + '</b></div><div class="kv"><span>Connections</span><b>' + i.active + ' of ' + (i.max || '?') + ' in use</b></div>' + (i.trial ? '<div class="kv"><span>Type</span><b>Trial</b></div>' : '');
        }, function (err) { var l = document.querySelector('#liveModalBox .minfo'); if (l) l.innerHTML = '<p class="bad">' + esc(err.message) + '</p>'; });
      } break;
      case 'set-ext': SET.ext = SET.ext === 'ts' ? 'm3u8' : 'ts'; PLS.forEach(function (x) { delete x.extLearned; }); savePls(); saveSet(); again(); break;
      case 'set-start': SET.start = nextOf(SENUM.start, SET.start); saveSet(); again(); break;
      case 'set-shift': { var SH = [0, 1, 2, 3, 4, 5, 6, -6, -5, -4, -3, -2, -1]; SET.shift = SH[(SH.indexOf(SET.shift) + 1) % SH.length]; saveSet(); if (LL) LL.paintAll(); paintInfo(true); again(); break; }
      case 'set-clock': SET.clock12 = !SET.clock12; saveSet(); if (LL) LL.paintAll(); paintInfo(true); again(); break;
      case 'set-buffer': SET.buffer = nextOf(SENUM.buffer, SET.buffer); saveSet(); again(); break;
      case 'set-banner': SET.banner = nextOf(SENUM.banner, SET.banner); saveSet(); again(); break;
      case 'set-logos': SET.logos = !SET.logos; saveSet(); resetRows(); if (LL) LL.paintAll(); paintInfo(true); again(); break;
      case 'set-stats': SET.stats = !SET.stats; saveSet(); again(); break;
      case 'set-autoup': SET.auto = nextOf(SENUM.auto, SET.auto); saveSet(); again(); break;
      case 'set-ua': { var UK = ['', 'vlc', 'okhttp', 'chrome']; SET.ua = UK[(UK.indexOf(SET.ua) + 1) % UK.length]; saveSet(); again(); break; }
      case 'set-pin': modal('pin', { mode: SET.pin ? 'clear' : 'set' }); break;
      case 'do-pin': {
        var pv = val('liveFPin'); if (!/^\d{4}$/.test(pv)) { fmsg('Enter exactly 4 digits', true); break; }
        if (d === 'set') { SET.pin = pv; saveSet(); modal('settings'); toast('PIN set'); break; }
        if (pv !== SET.pin) { fmsg('Wrong PIN', true); break; }
        if (d === 'clear') { SET.pin = ''; saveSet(); modal('settings'); toast('PIN removed'); break; }
        SET.adult = true; saveSet(); modal('settings');
        if (D && D.ready) finalize(undefined, undefined, function () { buildRailItems(); RL.setN(RAIL.length); RL.select(railIndexOfCur()); rebuildView(0); });
        break;
      }
      case 'set-sort': SET.sort = SET.sort === 'provider' ? 'az' : SET.sort === 'az' ? 'num' : 'provider'; saveSet(); if (D && D.ready) { var cc = curCi(); rebuildView(0, cc >= 0 ? cc : null); } paintHeader(); again(); break;
      case 'set-guide': SET.guide = !SET.guide; saveSet(); if (SET.guide && D) loadGuide(false); again(); break;
      case 'set-adult':
        if (!SET.adult && SET.pin) { modal('pin', { mode: 'unlock' }); break; }                      // showing adult groups needs the PIN
        SET.adult = !SET.adult; saveSet(); if (D && D.ready) { finalize(undefined, undefined, function () { buildRailItems(); RL.setN(RAIL.length); RL.select(railIndexOfCur()); rebuildView(0); }); } again(); break;
      case 'set-auto': SET.autoplay = !SET.autoplay; saveSet(); again(); break;
      case 'set-aspect': { var o = ['fit', 'fill', 'stretch', 'zoom']; SET.aspect = o[(o.indexOf(SET.aspect) + 1) % 4]; saveSet(); again(); break; }
      case 'set-guideurl': pl = curPl(); if (pl && pl.type !== 'xtream') modal('guideurl', { url: pl.epgUrl || '' }); else toast('Xtream playlists find their guide automatically'); break;
      case 'do-guideurl': pl = curPl(); if (pl) { pl.epgUrl = val('liveFGuide'); pl.epgAt = 0; savePls(); closeModal(); if (D) { D.epgState = ''; loadGuide(true); } } break;
      case 'clear-data': ['fav', 'rec', 'last'].forEach(function (w) { PLS.forEach(function (p) { try { localStorage.removeItem(userKey(w, p)); } catch (x) { /* ignore */ } }); }); PLS.forEach(function (p) { p.epgAt = 0; db.dropEpg(pid(p)); }); savePls(); if (D) { loadUserData(); buildRailItems(); RL.setN(RAIL.length); RL.select(railIndexOfCur()); rebuildView(0); } fmsg('Favorites, recent channels and saved guides cleared'); break;
      case 'input': break;
      default: break;
    }
  }
  function modalKey(e, k) {
    var ae = document.activeElement;
    if (ae && ae.tagName === 'INPUT') return false;                                // typing: the app's normal handler
    if (EA.isBackKey(k)) {
      e.preventDefault();
      if (M.name === 'xtream' || M.name === 'm3u' || M.name === 'free' || M.name === 'pair') { if (PLS.length) modal(M.name === 'free' || M.name === 'pair' || M.name === 'xtream' || M.name === 'm3u' ? 'add' : 'manage'); else modal('add'); }
      else if (M.name === 'info' || M.name === 'guideurl' || M.name === 'pin') modal(M.name === 'info' ? 'manage' : 'settings');
      else closeModal();
      return true;
    }
    return false;
  }

  // keep focused modal rows visible inside their scroll area
  function onFocus(e) {
    if (state.tab === 'live' && Z && !(e.__v)) { Z = null; if (LL) { LL.setActive(false); RL.setActive(false); } }
    if (state.view === 'modal') { var sc = EA.up(e, 'mscroll'); if (sc) { var r = e.getBoundingClientRect(), s = sc.getBoundingClientRect(); if (r.top < s.top + 4) sc.scrollTop -= s.top + 4 - r.top; else if (r.bottom > s.bottom - 4) sc.scrollTop += r.bottom - s.bottom + 4; } }
  }

  // ====================================================================== entry points used by main.js
  var searchDeb = tick(function () {
    var q = $('liveSearch').value.trim(); if (!D || !D.ready) return;
    if (q === C.q) return; C.q = q; rebuildView(0);
  }, 170);
  $('liveSearch').addEventListener('input', searchDeb);
  function key(e) {
    var k = e.keyCode;
    if (P.on) { e.preventDefault(); playerKey(k); return true; }
    if (EA.isBackKey(k)) state.lastBack = Date.now();                              // the hardware-back event that follows must not act twice
    if (state.view === 'modal') return modalKey(e, k);
    if (state.tab !== 'live' || state.view !== 'live') return false;
    var ae = document.activeElement;
    if (ae && ae.id === 'liveSearch') {
      if (k === EA.KEY.DOWN || k === EA.KEY.ENTER) { e.preventDefault(); ae.blur(); if (C.q !== ae.value.trim()) { C.q = ae.value.trim(); rebuildView(0); } enterList(); return true; }
      return false;
    }
    if (ae && ae.tagName === 'INPUT') return false;
    var used = browseKey(e, k);
    if (used) e.preventDefault();
    return used;
  }
  EA.api = EA.api || function (params) {
    var qs = Object.keys(params).map(function (x) { return x + '=' + encodeURIComponent(params[x]); }).join('&');
    return fetch(EA.apiBase() + '/api?' + qs).then(function (r) { return r.json().then(function (j) { if (!r.ok) throw new Error(j.error || 'HTTP ' + r.status); return j; }); });
  };
  EA.live = { show: show, key: key, onFocus: onFocus, activate: activate, closeModal: closeModal, back: back, playing: function () { return P.on; },
    _debug: function () { return { D: D, V: V, P: P, C: C, SET: SET, LL: LL, RL: RL, fmt: { hhmm: hhmm, gt: gt } }; } };
})();
