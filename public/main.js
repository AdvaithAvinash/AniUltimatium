const VERCEL_API_URL = "https://aniultimatium.advaithavinash404.workers.dev";

(function () {
  'use strict';

  // ======================= Constants & helpers =======================
  var BACKS = [10009, 27, 8, 166, 461, 10182];                       // Tizen Return, Esc, Backspace, browser/webOS back, Exit
  function isBackKey(k) { return BACKS.indexOf(k) > -1; }
  var KEY = { UP: 38, DOWN: 40, LEFT: 37, RIGHT: 39, ENTER: 13, BACK: 10009, ESC: 27, BKSP: 8, SPACE: 32,
              PLAY: 415, PAUSE: 19, PLAYPAUSE: 10252, STOP: 413, FF: 417, RW: 412 };
  var GENRES = ['Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Horror', 'Mystery', 'Romance', 'Sci-Fi', 'Slice of Life', 'Sports', 'Supernatural'];
  var IS_TV = /Tizen|SMART-?TV|Web0S|NetCast|AniUltimatiumTV|AFT[A-Z]/i.test(navigator.userAgent);      // AniUltimatiumTV = the Android TV / Fire TV app
  var ICONS = {
    cal: 'M17 12h-5v5h5v-5zM16 1v2H8V1H6v2H5c-1.11 0-1.99.9-1.99 2L3 19c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V5c0-1.1-.9-2-2-2h-1V1h-2zm3 18H5V8h14v11z', bell: 'M12 22c1.1 0 2-.9 2-2h-4c0 1.1.89 2 2 2zm6-6v-5c0-3.07-1.64-5.64-4.5-6.32V4c0-.83-.67-1.5-1.5-1.5s-1.5.67-1.5 1.5v.68C7.63 5.36 6 7.92 6 11v5l-2 2v1h16v-1l-2-2z',
    play: 'M8 5v14l11-7z', pause: 'M6 19h4V5H6v14zm8-14v14h4V5h-4z',
    back: 'M20 11H7.83l5.59-5.59L12 4l-8 8 8 8 1.41-1.41L7.83 13H20v-2z',
    info: 'M11 7h2v2h-2zm0 4h2v6h-2zm1-9C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm0 18c-4.41 0-8-3.59-8-8s3.59-8 8-8 8 3.59 8 8-3.59 8-8 8z',
    plus: 'M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z', check: 'M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41z',
    next: 'M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z', prev: 'M6 6h2v12H6zm3.5 6l8.5 6V6z',
    cc: 'M19 4H5c-1.11 0-2 .9-2 2v12c0 1.1.89 2 2 2h14c1.1 0 2-.9 2-2V6c0-1.1-.9-2-2-2zm-8 7H9.5v-.5h-2v3h2V13H11v1c0 .55-.45 1-1 1H7c-.55 0-1-.45-1-1v-4c0-.55.45-1 1-1h3c.55 0 1 .45 1 1v1zm7 0h-1.5v-.5h-2v3h2V13H18v1c0 .55-.45 1-1 1h-3c-.55 0-1-.45-1-1v-4c0-.55.45-1 1-1h3c.55 0 1 .45 1 1v1z',
    fs: 'M7 14H5v5h5v-2H7v-3zm-2-4h2V7h3V5H5v5zm12 7h-3v2h5v-5h-2v3zM14 5v2h3v3h2V5h-5z',
    search: 'M15.5 14h-.79l-.28-.27C15.41 12.59 16 11.11 16 9.5 16 5.91 13.09 3 9.5 3S3 5.91 3 9.5 5.91 16 9.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z',
    home: 'M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z', list: 'M17 3H7c-1.1 0-1.99.9-1.99 2L5 21l7-3 7 3V5c0-1.1-.9-2-2-2z',
    gear: 'M19.14 12.94c.04-.3.06-.61.06-.94 0-.32-.02-.64-.07-.94l2.03-1.58a.49.49 0 0 0 .12-.61l-1.92-3.32a.488.488 0 0 0-.59-.22l-2.39.96c-.5-.38-1.03-.7-1.62-.94l-.36-2.54a.484.484 0 0 0-.48-.41h-3.84c-.24 0-.43.17-.47.41l-.36 2.54c-.59.24-1.13.57-1.62.94l-2.39-.96c-.22-.08-.47 0-.59.22L2.74 8.87c-.12.21-.08.47.12.61l2.03 1.58c-.05.3-.09.63-.09.94s.02.64.07.94l-2.03 1.58a.49.49 0 0 0-.12.61l1.92 3.32c.12.22.37.29.59.22l2.39-.96c.5.38 1.03.7 1.62.94l.36 2.54c.05.24.24.41.48.41h3.84c.24 0 .44-.17.47-.41l.36-2.54c.59-.24 1.13-.56 1.62-.94l2.39.96c.22.08.47 0 .59-.22l1.92-3.32c.12-.22.07-.47-.12-.61l-2.01-1.58zM12 15.6c-1.98 0-3.6-1.62-3.6-3.6s1.62-3.6 3.6-3.6 3.6 1.62 3.6 3.6-1.62 3.6-3.6 3.6z',
    film: 'M18 4l2 4h-3l-2-4h-2l2 4h-3l-2-4H8l2 4H7L5 4H4c-1.1 0-1.99.9-1.99 2L2 18c0 1.1.9 2 2 2h16c1.1 0 2-.9 2-2V4h-4z',
    history: 'M13 3c-4.97 0-9 4.03-9 9H1l3.89 3.89.07.14L9 12H6c0-3.87 3.13-7 7-7s7 3.13 7 7-3.13 7-7 7c-1.93 0-3.68-.79-4.94-2.06l-1.42 1.42C8.27 19.99 10.51 21 13 21c4.97 0 9-4.03 9-9s-4.03-9-9-9zm-1 5v5l4.28 2.54.72-1.21-3.5-2.08V8H12z',
    person: 'M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z',
    tv: 'M21 3H3c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h5v2h8v-2h5c1.1 0 1.99-.9 1.99-2L23 5c0-1.1-.9-2-2-2zm0 14H3V5h18v12z',
    live: 'M7.76 16.24C6.67 15.16 6 13.66 6 12s.67-3.16 1.76-4.24l1.42 1.42C8.45 9.9 8 10.9 8 12c0 1.1.45 2.1 1.17 2.83l-1.41 1.41zm8.48 0C17.33 15.16 18 13.66 18 12s-.67-3.16-1.76-4.24l-1.42 1.42C15.55 9.9 16 10.9 16 12c0 1.1-.45 2.1-1.17 2.83l1.41 1.41zM12 10c-1.1 0-2 .9-2 2s.9 2 2 2 2-.9 2-2-.9-2-2-2zm8 2c0 2.21-.9 4.21-2.35 5.65l1.42 1.42C20.88 17.26 22 14.76 22 12s-1.12-5.26-2.93-7.07l-1.42 1.42C19.1 7.79 20 9.79 20 12zM6.35 6.35L4.93 4.93C3.12 6.74 2 9.24 2 12s1.12 5.26 2.93 7.07l1.42-1.42C4.9 16.21 4 14.21 4 12s.9-4.21 2.35-5.65z',
    heart: 'M12 21.35l-1.45-1.32C5.4 15.36 2 12.28 2 8.5 2 5.42 4.42 3 7.5 3c1.74 0 3.41.81 4.5 2.09C13.09 3.81 14.76 3 16.5 3 19.58 3 22 5.42 22 8.5c0 3.78-3.4 6.86-8.55 11.54L12 21.35z',
    star: 'M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z'
  };
  function ic(n) { return '<svg class="ic" viewBox="0 0 24 24"><path d="' + ICONS[n] + '"/></svg>'; }
  function $(id) { return document.getElementById(id); }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function ext(a, b) { Object.keys(b || {}).forEach(function (k) { a[k] = b[k]; }); return a; }
  function hasCls(e, c) { return (' ' + e.className + ' ').indexOf(' ' + c + ' ') > -1; }
  function up(e, cls) { while (e && e !== document) { if (e.nodeType === 1 && hasCls(e, cls)) return e; e = e.parentNode; } return null; }
  function fmt(t) {
    if (!isFinite(t)) t = 0; t = Math.floor(t);
    var h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), s = t % 60;
    return (h ? h + ':' + (m < 10 ? '0' : '') : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }
  // Per-profile keys (list, history, progress, AniList link) get the profile id appended; the first profile keeps the old names (see start.js)
  function pk(k) { var p = window.EA_PROFILE; return p && p.id !== 'p1' && window.EA_PROF && EA_PROF.perProfile.test(k) ? k + '@' + p.id : k; }
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem(pk(k)); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(pk(k), JSON.stringify(v)); } catch (e) { try { prune(); localStorage.setItem(pk(k), JSON.stringify(v)); } catch (e2) { /* storage full */ } } }
  };
  function prune() { try { ['ea_adseen', 'ea_live_countries', 'ea_am'].forEach(function (k) { localStorage.removeItem(k); }); } catch (e) { /* ignore */ } }   // storage full: drop the caches first

  // Kinds: 'anime' (AniList), 'movie' and 'tv' (Cinemeta + hosted players). TV episodes are numbered season*1000+episode (S2 E5 = 2005).
  function isVid(a) { return !!a && (a.kind === 'movie' || a.kind === 'tv'); }
  function isTv(a) { return !!a && a.kind === 'tv'; }
  function modeOf(a) { return a.kind === 'movie' ? 'movies' : a.kind === 'tv' ? 'tv' : 'anime'; }
  function isHomeTab(t) { return t === 'home' || t === 'movies' || t === 'tv'; }
  function tvS(ep) { return Math.floor(ep / 1000) || 1; }
  function tvE(ep) { return ep % 1000 || 1; }
  function epLabel(a, ep) { return isTv(a) ? 'S' + tvS(ep) + ' E' + tvE(ep) : 'EP ' + ep; }
  // Old TV browsers (Tizen 4 = Chromium 56, Tizen 5 = 63, 5.5 = 69, 6 = 76) cannot even parse the hosted movie players' code (ES2018/ES2020 syntax: object spread, optional chaining, nullish operator)
  var OLD_ENGINE = (function () { try { new Function('var o={a:1},b={.' + '..o};return o?' + '.a?' + '?b.a'); return false; } catch (e) { return true; } })();
  var CHROME_V = (function () { var m = navigator.userAgent.match(/Chrome\/(\d+)/); return m ? +m[1] : 0; })();
  // Lite mode: no animations / banner rotation, smaller pictures. Default on for the oldest engines (Chromium < 63: Tizen 4)
  var LITE = store.get('ea_lite', null); if (LITE === null) LITE = OLD_ENGINE && CHROME_V > 0 && CHROME_V < 63;

  var UI_MODERN = store.get('ea_ui', 'classic') === 'modern';
  function bodyCls() { var pz = store.get('ea_pz', 'normal'); return (IS_TV ? 'tv' : 'desktop') + (LITE ? ' lite' : '') + (UI_MODERN ? ' ui-modern' : '') + (pz === 'small' ? ' pz-s' : pz === 'large' ? ' pz-l' : ''); }
  document.body.className = bodyCls();
  // One layout, scaled to any window: 1080p TV -> 20px root, 1366x768 laptop -> ~14px root
  function applyScale() {
    var w = window.innerWidth, h = window.innerHeight;
    document.documentElement.style.fontSize = Math.max(12, Math.min(w / 96, h / 54)) + 'px';
  }
  window.addEventListener('resize', applyScale);
  applyScale();

  var state = {
    view: 'home', tab: 'home', focusEl: null, anime: null, ep: 1, hls: null, token: 0,
    hero: [], heroIdx: 0, heroTimer: null, hudTimer: null, lastSave: 0, returnFocus: null,
    genre: '', epRange: 0, searchTimer: null, trackUrls: [],
    mode: 'anime', smode: 'anime', speed: 1, audioPref: store.get('ea_audio', 'sub'), srcAudio: 'sub', cache: {}, skip: null, mvia: (function () { var v = store.get('ea_msrc', 'auto'); return /^(auto|vidcore|vidfast|videasy|cinesrc|archive|custom)$/.test(v) ? v : 'auto'; })(), mq: store.get('ea_mq', 'auto')
  };

  // ======================= Persistence =======================
  // Airing info: a.next = { ep: next episode number, at: when it airs (unix seconds) }. Shown as a small badge on cards and a tag in the hero / detail page.
  function airIn(at) {                                                             // "in 40m" / "in 5h" / "in 2d 3h"
    var m = Math.round((at * 1000 - Date.now()) / 60000);
    if (m <= 0) return 'now';
    if (m < 60) return 'in ' + m + 'm';
    if (m < 1440) return 'in ' + Math.floor(m / 60) + 'h' + (m % 60 >= 10 && m < 360 ? ' ' + (m % 60) + 'm' : '');
    return 'in ' + Math.floor(m / 1440) + 'd' + (Math.floor((m % 1440) / 60) ? ' ' + Math.floor((m % 1440) / 60) + 'h' : '');
  }
  function clock12() { return !!(store.get('ea_live_set', {}) || {}).clock12; }
  function fmtTime(at) { var d = new Date(at * 1000), h = d.getHours(), m = d.getMinutes(); m = m < 10 ? '0' + m : '' + m; if (clock12()) return ((h % 12) || 12) + ':' + m + ' ' + (h < 12 ? 'AM' : 'PM'); return (h < 10 ? '0' + h : h) + ':' + m; }
  function fmtDay(at) { var d = new Date(at * 1000), n = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'][d.getDay()]; return n + ' ' + fmtTime(at); }
  function airBadgeOn() { return store.get('ea_airbadge', true) !== false; }
  function airBadgeText(n) { return 'EP ' + n.ep + ' · ' + airIn(n.at); }
  function paintAir(c) {                                                           // (re)draw the airing badge of one card
    var a = c.__anime, p = c.querySelector('.poster'); if (!p) return;
    var old = p.querySelector('.badge.air'); if (old) p.removeChild(old);
    if (!a || !a.next || !airBadgeOn() || c.__cont || c.__hist || a.kind !== 'anime') return;
    if (a.next.at * 1000 - Date.now() > 7 * 86400000) return;
    p.appendChild(el('div', 'badge air', esc(airBadgeText(a.next))));
  }
  function paintAirBadges() { var cs = document.querySelectorAll('#rows .card, #listGrid .card, #searchGrid .card'); for (var i = 0; i < cs.length; i++) paintAir(cs[i]); }
  function tname(a) { return store.get('ea_tlang', 'en') === 'romaji' && a.titleRomaji ? a.titleRomaji : a.title; }        // Settings: title language
  function keyOf(a) { return (a.kind === 'movie' ? 'm:' : a.kind === 'tv' ? 't:' : 'a:') + a.id; }
  function slim(a) {
    return { id: a.id, kind: isVid(a) ? a.kind : 'anime', mal: a.mal || null, title: a.title, titleRomaji: a.titleRomaji, cover: a.cover, coverSm: a.coverSm || null, banner: a.banner, color: a.color,
             description: (a.description || '').slice(0, 500), episodes: a.episodes, format: a.format, year: a.year, runtime: a.runtime || null, cast: a.cast || [],
             status: a.status, genres: a.genres || [], synonyms: a.synonyms || [], score: a.score };
  }
  function nowTs() { return Date.now(); }
  function getDel() { return store.get('ea_del', {}); }
  function addDel(k) { var d = getDel(); d[k] = nowTs(); store.set('ea_del', d); }
  function getProg() { return store.get('ea_progress', {}); }
  function progOf(a) { return getProg()[keyOf(a)]; }
  function setProg(a, ep, time, dur) {
    var p = getProg();
    p[keyOf(a)] = { anime: slim(a), ep: ep, time: time, dur: dur, ts: nowTs() };
    store.set('ea_progress', p); scheduleSync();
  }
  function removeProg(key) {
    var p = getProg(); delete p[key]; store.set('ea_progress', p); addDel('p:' + key); scheduleSync();
  }
  function inList(a) { var k = keyOf(a); return store.get('ea_list', []).some(function (x) { return (x.key || keyOf(x)) === k; }); }
  function toggleList(a) {
    var k = keyOf(a), l = store.get('ea_list', []), had = false;
    l = l.filter(function (x) { if ((x.key || keyOf(x)) === k) { had = true; return false; } return true; });
    if (had) addDel('l:' + k); else { var it = slim(a); it.key = k; it.ts = nowTs(); it.st = 'planning'; l.unshift(it); }
    store.set('ea_list', l); scheduleSync();
    toast(had ? 'Removed from My List' : 'Added to My List');
    return !had;
  }
  // ---- Library statuses (Watching / Planning / Completed / Paused / Dropped), kept with each list entry and synced with it ----
  var ST_ORDER = ['watching', 'planning', 'completed', 'paused', 'dropped'];
  var ST_CYCLE = ['planning', 'watching', 'completed', 'paused', 'dropped'];                // the detail-page button goes through these in turn
  var ST_LABEL = { watching: 'Watching', planning: 'Planning', completed: 'Completed', paused: 'Paused', dropped: 'Dropped' };
  function listItem(a) { var k = keyOf(a), l = store.get('ea_list', []); for (var i = 0; i < l.length; i++) if ((l[i].key || keyOf(l[i])) === k) return l[i]; return null; }
  function statusOf(a) { var it = listItem(a); return it ? (it.st || 'planning') : ''; }
  function setStatus(a, st) {
    var k = keyOf(a), l = store.get('ea_list', []), hit = false;
    l.forEach(function (x) { if ((x.key || keyOf(x)) === k && x.st !== st) { x.st = st; x.ts = nowTs(); hit = true; } });
    if (hit) { store.set('ea_list', l); scheduleSync(); }
    return hit;
  }
  function autoStatus(a, ep, finished) {                                           // watching an episode moves a Planning / Paused entry to Watching; the last episode completes it
    if (!a || isVid(a)) return;
    var cur = statusOf(a); if (!cur) return;
    if (finished && a.episodes && ep >= a.episodes) { if (cur !== 'completed') setStatus(a, 'completed'); return; }
    if (cur === 'planning' || cur === 'paused') setStatus(a, 'watching');
  }
  function getHist() { return store.get('ea_hist', []); }
  function addHist(a, ep) {
    var k = keyOf(a), h = getHist().filter(function (x) { return !(x.key === k && x.ep === ep); });
    h.unshift({ key: k, anime: slim(a), ep: ep, ts: nowTs() });
    store.set('ea_hist', h.slice(0, 200)); scheduleSync();
  }
  function removeHist(key, ep) {
    store.set('ea_hist', getHist().filter(function (x) { return !(x.key === key && x.ep === ep); }));
    addDel('h:' + key + ':' + ep); scheduleSync();
  }
  function clearHist() { store.set('ea_hist', []); addDel('h:all'); scheduleSync(); }
  function continueItems() {
    var p = getProg(), out = [];
    Object.keys(p).forEach(function (k) { if (modeOf(p[k].anime) === state.mode) out.push(p[k]); });
    out.sort(function (a, b) { return b.ts - a.ts; });
    return out.slice(0, 20);
  }
  // one-time migration from the older id-keyed progress
  (function migrate() {
    var p = getProg(), changed = false;
    Object.keys(p).forEach(function (k) { if (!/^[amt]:/.test(k)) { p['a:' + k] = p[k]; delete p[k]; changed = true; } });
    if (changed) store.set('ea_progress', p);
  })();

  // ---- accounts & cloud sync ----
  function auth() { return store.get('ea_auth', null); }
  function localData() { return { progress: getProg(), list: store.get('ea_list', []), history: getHist(), deleted: getDel() }; }
  function mergeData(L, R) {
    L = L || {}; R = R || {};
    var del = {};
    [L.deleted || {}, R.deleted || {}].forEach(function (d) { Object.keys(d).forEach(function (k) { del[k] = Math.max(del[k] || 0, d[k]); }); });
    var prog = {};
    [L.progress || {}, R.progress || {}].forEach(function (pp) { Object.keys(pp).forEach(function (k) { if (!prog[k] || pp[k].ts > prog[k].ts) prog[k] = pp[k]; }); });
    Object.keys(prog).forEach(function (k) { if ((del['p:' + k] || 0) >= prog[k].ts) delete prog[k]; });
    var lm = {};
    (L.list || []).concat(R.list || []).forEach(function (x) { var k = x.key || keyOf(x); x.key = k; x.ts = x.ts || 0; if (!lm[k] || x.ts > lm[k].ts) lm[k] = x; });
    var list = Object.keys(lm).map(function (k) { return lm[k]; }).filter(function (x) { return (del['l:' + x.key] || 0) < x.ts || !del['l:' + x.key]; })
      .sort(function (a, b) { return b.ts - a.ts; });
    var hm = {};
    (L.history || []).concat(R.history || []).forEach(function (x) { var k = x.key + ':' + x.ep; if (!hm[k] || x.ts > hm[k].ts) hm[k] = x; });
    var hist = Object.keys(hm).map(function (k) { return hm[k]; }).filter(function (x) {
      return x.ts > (del['h:all'] || 0) && x.ts > (del['h:' + x.key + ':' + x.ep] || 0);
    }).sort(function (a, b) { return b.ts - a.ts; }).slice(0, 200);
    return { progress: prog, list: list, history: hist, deleted: del };
  }
  var syncTimer = null;
  function scheduleSync() { if (!auth()) return; clearTimeout(syncTimer); syncTimer = setTimeout(function () { syncNow(false); }, 2500); }
  function syncNow(manual) {
    if (!auth()) return Promise.resolve();
    return api({ action: 'sync_get' }).then(function (r) {
      var m = mergeData(localData(), r.data || {});
      store.set('ea_progress', m.progress); store.set('ea_list', m.list); store.set('ea_hist', m.history); store.set('ea_del', m.deleted);
      return api({ action: 'sync_put' }, { body: { data: m } });
    }).then(function () {
      if (manual) toast('Synced');
      if (isHomeTab(state.tab)) renderContinue();
      if (state.tab === 'list') renderList();
      if (state.tab === 'history') renderHistory();
    }).catch(function (e) {
      if (/sign in again/i.test(e.message)) { store.set('ea_auth', null); paintTabs(); if (state.tab === 'account') renderAccount(); }
      if (manual) toast('Sync failed: ' + e.message);
    });
  }

  // ======================= SourceIQ: ranks sources from real outcomes on this device (see iq.js) =======================
  var SRC_KEYS = ['animex', 'anikoto', 'animeyubi', 'aniwaves'];
  var iq = window.SourceIQ ? SourceIQ.create({ get: function () { return store.get('ea_iq', null); }, set: function (v) { store.set('ea_iq', v); } })
    : { order: function (k) { return k; }, recordTrace: function () {}, recordPlay: function () {}, status: function () { return { short: '' }; }, rank: function (k) { return k; } };
  function iqOrder() { return iq.order(SRC_KEYS).join(','); }
  function playFailed() {                       // the stream of this source did not (or stopped) play: remember it once per attempt
    var p = state.pPlay;
    if (p && !p.failed && p.key) { p.failed = true; if (p.ok) flushQuality(true); else iq.recordPlay(p.key, false); }       // it had started: that is a drop (counted with its quality); else a failed start
  }
  // ---- Playback quality, measured while a stream plays (stalls, resolution, seconds watched) and given to SourceIQ when playback ends or drops ----
  function qInit() { state.pq = { stalls: 0, stallMs: 0, waitAt: 0, played: 0, lastT: -1, h: 0 }; }
  function qHeight() { var h = state.hls && state.hls.levels && state.hls.currentLevel >= 0 && state.hls.levels[state.hls.currentLevel] ? state.hls.levels[state.hls.currentLevel].height : 0; return h || video.videoHeight || 0; }
  function flushQuality(dropped) {
    var q = state.pq, p = state.pPlay; state.pq = null;
    if (!q || !p || !p.key || !state.anime || isVid(state.anime)) return;
    if (q.waitAt) q.stallMs += Date.now() - q.waitAt;
    iq.recordQuality(p.key, { played: q.played, stalls: q.stalls, stallMs: q.stallMs, height: q.h, dropped: !!dropped });
  }
  function streamDead() {                       // route switch did not help: refresh a possibly stale prefetched link once, else try the next source
    var d = state.src;
    if (d && d.pre && !state.preRetried && state.anime && !isVid(state.anime)) {
      state.preRetried = true; toast('Refreshing the link…');
      play(state.anime, state.ep, video.currentTime > 5 ? video.currentTime : state.startAt, true, state.srcSkip);
      return true;
    }
    playFailed();
    return nextSource();
  }

  // ======================= API =======================
  // Which backend to use: user-set server (Settings) > the local server that served this page > cloud (Vercel)
  function apiBase() {
    var custom = (store.get('ea_server', '') || '').trim();
    if (custom) return (/^https?:\/\//i.test(custom) ? custom : 'http://' + custom).replace(/\/+$/, '');
    if (/^https?:$/.test(location.protocol) && /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(location.hostname)) return location.origin;
    return VERCEL_API_URL.replace(/\/+$/, '');
  }
  // Stability: every API call has a time limit (a hung connection never leaves the screen waiting forever), and a plain GET gets one more try after a dropped connection or a 502/503/504
  function delay(ms) { return new Promise(function (res) { setTimeout(res, ms); }); }
  function fetchRetry(url, init, ms) {
    function once() { return Promise.race([fetch(url, init), new Promise(function (_, rej) { setTimeout(function () { rej(new Error('The server did not answer in time')); }, ms); })]); }
    function go(n) {
      return once().then(function (r) { return (r.status === 502 || r.status === 503 || r.status === 504) && n < 1 && !init.body ? delay(700).then(function () { return go(n + 1); }) : r; },
        function (e) { if (n < 1 && !init.body && !(e && e.name === 'AbortError')) return delay(700).then(function () { return go(n + 1); }); throw e; });
    }
    return go(0);
  }
  function api(params, opts) {
    opts = opts || {};
    var amId = (params.action === 'sources' && params.id) || (params.action === 'subs' && params.anilist) || '';
    if (amId && !opts.hasAm) {
      return aniFull(amId).then(function (am) {
        var p2 = {}; Object.keys(params).forEach(function (k) { p2[k] = params[k]; });
        if (am) p2.am = am;
        return api(p2, { body: opts.body, hasAm: true, signal: opts.signal });
      });
    }
    var qs = Object.keys(params).map(function (k) { return k + '=' + encodeURIComponent(params[k]); }).join('&');
    var headers = {}, au = auth(), init = { headers: headers };
    if (opts.signal) init.signal = opts.signal;
    if (opts.headers) Object.keys(opts.headers).forEach(function (k) { headers[k] = opts.headers[k]; });
    if (au && /^(me|sync_get|sync_put)$/.test(params.action)) headers.Authorization = 'Bearer ' + au.token;
    if (opts.body) { init.method = 'POST'; headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(opts.body); }
    var aniAct = /^(home|trending|search)$/.test(params.action);
    var ckey = /^(search|trending|movies_search)$/.test(params.action) && !opts.body ? qs : null;
    if (ckey && apiCache[ckey] && Date.now() - apiCache[ckey].t < 120000) return Promise.resolve(apiCache[ckey].d);       // same search again within 2 min
    // A server that AniList blocks (Cloudflare Workers) is skipped for 10 minutes: ask AniList from the device straight away (saves a failing round trip)
    if (aniAct && Date.now() < (store.get('ea_aldirect', 0) || 0)) return aniDirect(params).catch(function () { return remote(); });
    return remote();
    function remote() {
      return fetchRetry(apiBase() + '/api?' + qs, init, /^(sources|movie_sources|movie_home|proxy)$/.test(params.action) ? 45000 : 25000).then(function (r) {
        return r.json().catch(function () { return {}; }).then(function (j) {
          if (!r.ok) { var er = new Error(j.error || 'HTTP ' + r.status); er.data = j; er.status = r.status; er.nojson = !Object.keys(j).length; throw er; }
          return j;
        });
      }).then(function (j) {
        if (ckey) { apiCache[ckey] = { t: Date.now(), d: j }; var ks = Object.keys(apiCache); if (ks.length > 12) delete apiCache[ks[0]]; }
        return j;
      }).catch(function (e) {
        // Some hosts (e.g. Cloudflare Workers) get blocked by AniList: ask AniList straight from the device instead
        if (aniAct && !(e && e.name === 'AbortError')) {
          if (/403/.test(e.message || '')) store.set('ea_aldirect', Date.now() + 10 * 60 * 1000);
          return aniDirect(params).catch(function () { throw e; });
        }
        throw e;
      });
    }
  }
  var apiCache = {};
  // Full AniList record, handed to the backend so it never has to reach AniList itself (Cloudflare Workers get blocked there)
  // Kept on the device (12 h; 2 h while a show is airing) so opening a show again costs no AniList request at all
  var AM_FIELDS = 'id idMal title{english romaji native} status format episodes seasonYear startDate{year month day} genres synonyms nextAiringEpisode{episode airingAt timeUntilAiring}';
  var amCache = {}, amInflight = {};
  function amGet(id) {
    if (amCache[id] !== undefined) return amCache[id];
    var all = store.get('ea_am', {}), e = all[id];
    if (e && Date.now() < e.x) return (amCache[id] = e.v);
    return undefined;
  }
  function amPut(id, media) {
    var v = JSON.stringify(media); amCache[id] = v;
    var all = store.get('ea_am', {}), now = Date.now(), keys = Object.keys(all);
    all[id] = { v: v, x: now + (media && media.status === 'RELEASING' ? 2 : 12) * 3600000 };
    if (keys.length > 80) keys.sort(function (a, b) { return all[a].x - all[b].x; }).slice(0, keys.length - 80).forEach(function (k) { delete all[k]; });
    store.set('ea_am', all); return v;
  }
  function aniFull(id) {
    if (!id || isNaN(id)) return Promise.resolve('');
    var c = amGet(id); if (c !== undefined) return Promise.resolve(c);
    if (amInflight[id]) return amInflight[id];
    return (amInflight[id] = aniQuery('query($id:Int){Media(id:$id,type:ANIME){' + AM_FIELDS + '}}', { id: Number(id) })
      .then(function (d) { delete amInflight[id]; return amPut(id, d.Media); }, function () { delete amInflight[id]; return ''; }));
  }
  var AL_F = 'id title{romaji english} coverImage{extraLarge large color} bannerImage description(asHtml:false) idMal episodes nextAiringEpisode{episode airingAt} format seasonYear averageScore status genres synonyms popularity isAdult';
  // Episodes aired in the last 7 days -> "Popular This Week" (most popular shows with a new episode) and "New Releases" (newest first)
  function weekRows(d) {
    var sched = [].concat((d.week && d.week.airingSchedules) || [], (d.week2 && d.week2.airingSchedules) || []), seen = {}, latest = [];
    sched.forEach(function (x) { var m = x.media; if (!m || m.isAdult || seen[m.id]) return; seen[m.id] = 1; latest.push({ m: m, at: x.airingAt, pop: m.popularity || 0 }); });
    return { pop: latest.slice().sort(function (a, b) { return b.pop - a.pop; }).slice(0, 20).map(function (x) { return aniMap(x.m); }),
             fresh: latest.filter(function (x) { return x.pop >= 2000; }).sort(function (a, b) { return b.at - a.at; }).slice(0, 20).map(function (x) { return aniMap(x.m); }) };
  }
  function aniMap(m) {
    return { id: m.id, mal: m.idMal || null, kind: 'anime', title: m.title.english || m.title.romaji, titleRomaji: m.title.romaji,
      cover: m.coverImage.extraLarge || m.coverImage.large, coverSm: m.coverImage.large || null, banner: m.bannerImage || null, color: m.coverImage.color || null,
      description: (m.description || '').replace(/<[^>]+>/g, '').trim(),
      episodes: m.episodes || (m.nextAiringEpisode ? m.nextAiringEpisode.episode - 1 : null), format: m.format, year: m.seasonYear,
      status: m.status, genres: m.genres || [], synonyms: (m.synonyms || []).filter(function (x) { return /^[\x20-\x7e]+$/.test(x); }).slice(0, 4),
      score: m.averageScore ? (m.averageScore / 10).toFixed(1) : null,
      next: m.nextAiringEpisode && m.nextAiringEpisode.airingAt ? { ep: m.nextAiringEpisode.episode, at: m.nextAiringEpisode.airingAt } : null };
  }
  // ---- AniList from the device: ONE queue for every request (AniList allows 30 requests a minute per IP and answers 429 above that) ----
  // Requests run one at a time, spaced out when AniList says few are left (X-RateLimit-Remaining), and a 429 waits Retry-After seconds and tries again (twice).
  var alQ = { busy: false, list: [], until: 0, last: 0 };
  function alSend(body, token) {
    return new Promise(function (resolve, reject) { alQ.list.push({ body: body, token: token, resolve: resolve, reject: reject, tries: 0 }); alPump(); });
  }
  function alPump() {
    if (alQ.busy || !alQ.list.length) return;
    var job = alQ.list[0], now = Date.now(), wait = Math.max(alQ.until - now, alQ.last + 120 - now, 0);
    if (wait > 0) { alQ.busy = true; setTimeout(function () { alQ.busy = false; alPump(); }, wait); return; }
    alQ.busy = true; alQ.last = now;
    var h = { 'Content-Type': 'application/json', Accept: 'application/json' }; if (job.token) h.Authorization = 'Bearer ' + job.token;
    fetch('https://graphql.anilist.co', { method: 'POST', headers: h, body: job.body }).then(function (r) {
      var rem = parseInt(r.headers.get('X-RateLimit-Remaining'), 10), reset = parseInt(r.headers.get('X-RateLimit-Reset'), 10);
      if (r.status === 429) {
        var ra = parseInt(r.headers.get('Retry-After'), 10); if (!(ra > 0)) ra = reset > 0 ? Math.max(1, reset - Math.floor(Date.now() / 1000)) : 30;
        alQ.until = Date.now() + Math.min(ra, 65) * 1000;
        if (job.tries++ < 2) { if (ra > 3) toast('AniList is busy — retrying in ' + ra + 's'); return 'retry'; }
        var e = new Error('AniList is busy (too many requests) — try again in a minute'); e.status = 429; throw e;
      }
      if (rem >= 0 && rem <= 3) alQ.until = Date.now() + (rem <= 1 ? 8000 : 2500);       // nearly out: slow down instead of hitting the wall
      return r.json().catch(function () { return {}; }).then(function (j) { j.__status = r.status; return j; });
    }).then(function (j) {
      alQ.busy = false;
      if (j === 'retry') { alPump(); return; }
      alQ.list.shift(); job.resolve(j); alPump();
    }, function (err) { alQ.busy = false; alQ.list.shift(); job.reject(err); alPump(); });
  }
  function aniQuery(query, vars) {
    return alSend(JSON.stringify({ query: query, variables: vars || {} })).then(function (j) {
      if (!j.data) throw new Error(j.errors && j.errors[0] && j.errors[0].message ? 'AniList: ' + j.errors[0].message : 'AniList unavailable'); return j.data; });
  }
  function aniDirect(p) {
    var shelf = function (a, args) { return a + ':Page(perPage:20){media(type:ANIME,isAdult:false,' + args + '){...F}}'; };
    if (p.action === 'home') {
      var hc = store.get('ea_homec', null);
      if (hc && Date.now() - hc.t < 15 * 60000 && hc.d && hc.d.rows) return Promise.resolve(hc.d);       // one home request per 15 min at most
      var mo = new Date().getUTCMonth(), season = ['WINTER', 'SPRING', 'SUMMER', 'FALL'][Math.floor(mo / 3)];
      var now = Math.floor(Date.now() / 1000), sch = function (a, pg) { return a + ':Page(page:' + pg + ',perPage:50){airingSchedules(airingAt_greater:$a,airingAt_lesser:$b,sort:TIME_DESC){airingAt media{...F}}}'; };
      var q = 'query($season:MediaSeason,$year:Int,$a:Int,$b:Int){' + [sch('week', 1), sch('week2', 2), shelf('trending', 'sort:TRENDING_DESC'), shelf('season', 'season:$season,seasonYear:$year,sort:POPULARITY_DESC'),
        shelf('top', 'sort:SCORE_DESC'), shelf('action', 'genre:"Action",sort:POPULARITY_DESC'), shelf('romance', 'genre:"Romance",sort:POPULARITY_DESC'),
        shelf('comedy', 'genre:"Comedy",sort:POPULARITY_DESC'), shelf('fantasy', 'genre:"Fantasy",sort:POPULARITY_DESC')].join(' ') + '} fragment F on Media{' + AL_F + '}';
      return aniQuery(q, { season: season, year: new Date().getUTCFullYear(), a: now - 7 * 86400, b: Math.floor(now / 600) * 600 }).then(function (d) {
        var names = [['trending', 'Trending Now'], ['season', 'Popular This Season'], ['top', 'Top Rated'], ['action', 'Action'], ['romance', 'Romance'], ['comedy', 'Comedy'], ['fantasy', 'Fantasy']];
        var rows = names.map(function (n) { return { title: n[1], items: ((d[n[0]] && d[n[0]].media) || []).map(aniMap) }; });
        var w = weekRows(d); rows.splice(1, 0, { title: 'Popular This Week', items: w.pop }, { title: 'New Releases', items: w.fresh });
        var out = { rows: rows.filter(function (r) { return r.items.length; }) };
        store.set('ea_homec', { t: Date.now(), d: out });
        return out;
      }, function (e) { if (hc && hc.d && hc.d.rows) return hc.d; throw e; });          // AniList busy: last home page is better than an error
    }
    var term = p.action === 'search' ? p.q : '', genre = p.action === 'search' ? p.genre : '';
    return aniQuery('query($s:String,$g:String,$sort:[MediaSort]){Page(perPage:30){media(type:ANIME,search:$s,genre:$g,sort:$sort,isAdult:false){' + AL_F + '}}}',
      { s: term || undefined, g: genre || undefined, sort: [term ? 'SEARCH_MATCH' : (p.action === 'trending' ? 'TRENDING_DESC' : 'POPULARITY_DESC')] }).then(function (d) {
      return { results: d.Page.media.map(aniMap) };
    });
  }
  function toast(t) {
    var e = $('toast'); e.textContent = t; e.className = 'on';
    clearTimeout(toast.t); toast.t = setTimeout(function () { e.className = ''; }, 2400);
  }

  // ======================= Cards & rows =======================
  function card(a, extra) {
    var c = el('div', 'card focusable');
    var p = el('div', 'poster');
    var img = el('img'); img.alt = '';
    img.onload = function () { img.className = 'ld'; };
    img.onerror = function () { if (img.__alt) { var u = img.__alt; img.__alt = null; img.src = u; } else img.style.display = 'none'; };
    lazyImg(img, (a.coverSm && a.coverSm !== a.cover) ? a.coverSm : a.cover, a.cover);
    p.appendChild(img);
    var movie = a.kind === 'movie';
    if (extra && extra.cont) {
      p.appendChild(el('div', 'badge ep', movie ? 'RESUME' : epLabel(a, extra.ep)));
      if (extra.dur) p.appendChild(el('div', 'pbar', '<i style="width:' + Math.min(100, extra.time / extra.dur * 100) + '%"></i>'));
    } else if (extra && extra.rel) {
      p.appendChild(el('div', 'badge ep', esc(extra.rel)));
    } else if (extra && extra.al) {
      p.appendChild(el('div', 'badge ep al', 'EP ' + extra.ep));
    } else if (extra && extra.hist) {
      p.appendChild(el('div', 'badge ep', movie ? 'MOVIE' : epLabel(a, extra.ep)));
    } else if (a.score) p.appendChild(el('div', 'badge', '★ ' + esc(a.score)));
    if (extra && (extra.cont || extra.hist)) p.appendChild(el('button', 'cx', '✕'));
    if (extra && extra.st) p.appendChild(el('div', 'badge st st-' + extra.st, esc(ST_LABEL[extra.st] || extra.st)));
    c.appendChild(p);
    c.appendChild(el('div', 'ct', esc(tname(a))));
    c.__anime = a;
    if (!extra || extra.st) paintAir(c);
    if (extra && extra.cont) { c.__cont = extra; }
    if (extra && extra.hist) { c.__hist = extra; }
    return c;
  }
  // Pictures load only when their card is near the screen (IntersectionObserver: Chromium 51+, so Tizen 4 too); everything else waits.
  // A remote moves one card at a time, so the next few cards in a row are loaded when a card gets focus (see setFocus).
  var lazyIO = window.IntersectionObserver ? new IntersectionObserver(function (ents) {
    ents.forEach(function (en) { if (en.isIntersecting || en.intersectionRatio > 0) { lazyIO.unobserve(en.target); loadImg(en.target); } });
  }, { rootMargin: '400px 0px 400px 0px' }) : null;
  function loadImg(img) { if (img.__src) { var u = img.__src; img.__src = null; img.src = u; } }
  function lazyImg(img, url, alt) {
    img.__alt = alt && alt !== url ? alt : null;
    if (!url) return;
    if (!lazyIO) { img.src = url; return; }
    img.__src = url; lazyIO.observe(img);
  }
  function warmNear(e) {                                             // focused card: load it and its next 5 neighbours in the row
    var n = e, i = 0;
    while (n && i < 6) { var im = n.querySelector && n.querySelector('img'); if (im && im.__src) { if (lazyIO) lazyIO.unobserve(im); loadImg(im); } n = n.nextSibling; i++; }
  }
  function skeletonRows() {
    var rows = $('rows'); rows.innerHTML = '';
    for (var r = 0; r < 2; r++) {
      var row = el('div', 'row skel', '<div class="rowhead"><h3>&nbsp;</h3></div>');
      var t = el('div', 'track');
      for (var i = 0; i < 9; i++) t.appendChild(el('div', 'card', '<div class="poster"></div><div class="ct">.</div>'));
      row.appendChild(t); rows.appendChild(row);
    }
  }
  function makeRow(title, items, cls, extraFn) {                                   // a row of cards that is not appended yet (feed.js builds its own rows with it)
    var row = el('div', 'row' + (cls ? ' ' + cls : ''));
    row.appendChild(el('div', 'rowhead', '<h3>' + esc(title) + '</h3><div class="rowbtns"><button class="rowbtn" data-dir="-1">&#8249;</button><button class="rowbtn" data-dir="1">&#8250;</button></div>'));
    var track = el('div', 'track');
    items.forEach(function (it) { track.appendChild(card(it, extraFn ? extraFn(it) : undefined)); });
    row.appendChild(track); return row;
  }
  function addRow(title, items, contMode) {
    var row = el('div', 'row');
    var head = el('div', 'rowhead', '<h3>' + esc(title) + '</h3><div class="rowbtns"><button class="rowbtn" data-dir="-1">&#8249;</button><button class="rowbtn" data-dir="1">&#8250;</button></div>');
    var track = el('div', 'track');
    items.forEach(function (it) {
      track.appendChild(contMode ? card(it.anime, { cont: true, ep: it.ep, time: it.time, dur: it.dur }) : card(it));
    });
    row.appendChild(head); row.appendChild(track);
    $('rows').appendChild(row);
  }

  // ======================= Home =======================
  function loadHome(force) {
    var m = state.mode;
    $('homeMsg').innerHTML = '';
    if (!force && state.cache[m]) return renderHome(state.cache[m]);
    state.hero = []; clearInterval(state.heroTimer);
    skeletonRows();
    api(m === 'anime' ? { action: 'home' } : m === 'tv' ? { action: 'movies_home', type: 'series' } : { action: 'movies_home' }).then(function (d) {
      state.cache[m] = d;
      if (m === state.mode) renderHome(d);
    }).catch(function (e) {
      if (m !== state.mode) return;
      $('rows').innerHTML = '';
      var unset = VERCEL_API_URL.indexOf('YOUR_VERCEL') === 0;
      $('homeMsg').innerHTML = esc(unset ? 'Set VERCEL_API_URL in main.js' : 'Could not load ' + (m === 'movies' ? 'movies' : m === 'tv' ? 'TV shows' : 'anime') + ': ' + e.message) +
        '<button class="retry focusable" id="retryHome">Retry</button>';
      if (isHomeTab(state.tab)) setFocus($('retryHome'));
    });
  }
  // Settings -> Home rows: hide rows and put the rest in your own order. Row titles are the keys; unknown rows keep their place at the end.
  function rowPrefs(rows) {
    var pr = store.get('ea_rows', null); if (!pr) return rows;
    var hide = pr.hide || {}, order = pr.order || [];
    var out = rows.filter(function (r) { return !hide[r.title]; });
    out.sort(function (a, b) { var x = order.indexOf(a.title), y = order.indexOf(b.title); return (x < 0 ? 999 : x) - (y < 0 ? 999 : y); });
    return out;
  }
  function renderHome(d) {
    $('rows').innerHTML = ''; $('homeMsg').innerHTML = '';
    var rows = d.rows || [];
    renderContinue();
    rows = rowPrefs(rows);
    rows.forEach(function (r) { addRow(r.title, r.items); });
    var feat = [];
    (rows[0] ? rows[0].items : []).forEach(function (a) { if (a.banner && feat.length < 6) feat.push(a); });
    if (!feat.length && rows[0]) feat = rows[0].items.slice(0, 5);
    setHeroList(feat);
    if (isHomeTab(state.tab) && state.view === state.tab) setFocus($('heroPlay'));
    if (EA.feed && state.mode === 'anime') EA.feed.enrichHome(rows);
  }
  function renderContinue() {
    var old = $('rows').querySelector('.row.cont');
    if (old) old.parentNode.removeChild(old);
    var c = continueItems(); var cpr = store.get('ea_rows', null);
    if (!c.length || (cpr && cpr.hide && cpr.hide['Continue Watching'])) return;
    addRow('Continue Watching', c, true);
    var rows = $('rows'), last = rows.lastChild;
    last.className += ' cont';
    rows.insertBefore(last, rows.firstChild);
  }
  var renderContinue0 = renderContinue;
  renderContinue = function () { renderContinue0(); renderAlRow(); if (EA.feed && state.mode === 'anime') EA.feed.renderRows(); };

  function setHeroList(list) {
    state.hero = list; state.heroIdx = 0;
    var dots = $('heroDots'); dots.innerHTML = '';
    list.forEach(function () { dots.appendChild(el('i')); });
    showHero(0, true);
    clearInterval(state.heroTimer);
    if (list.length > 1 && !LITE && store.get('ea_hero', true) !== false) state.heroTimer = setInterval(function () {
      if (isHomeTab(state.view) && state.view === state.tab) showHero((state.heroIdx + 1) % state.hero.length);
    }, 9000);
  }
  function showHero(i, instant) {
    var a = state.hero[i]; if (!a) return;
    var body = $('heroBody'), bg = $('heroBg');
    function paint() {
      state.heroIdx = i;
      bg.style.backgroundImage = 'url("' + (a.banner || a.cover) + '")';
      if (!a.banner) bg.style.backgroundPosition = 'center 20%';
      var movie = isVid(a);
      $('heroTags').innerHTML = '<span class="tag hot">#' + (i + 1) + (movie ? ' Popular' : ' Trending') + '</span>' +
        (a.next && airBadgeOn() && a.next.at * 1000 - Date.now() < 4 * 86400000 ? '<span class="tag air">New episode ' + a.next.ep + ' ' + airIn(a.next.at) + '</span>' : '') +
        (a.genres || []).slice(0, 3).map(function (g) { return '<span class="tag">' + esc(g) + '</span>'; }).join('');
      $('heroTitle').textContent = tname(a);
      $('heroMeta').innerHTML = (a.score ? '<span class="score">★ ' + esc(a.score) + '</span>' : '') +
        [a.format, a.year, movie ? a.runtime : (a.episodes ? a.episodes + ' eps' : '')].filter(Boolean).map(esc).map(function (x) { return '<span>' + x + '</span>'; }).join('') +
        (movie ? '' : '<span class="tag">ENG SUB</span>');
      $('heroDesc').textContent = a.description;
      var p = progOf(a);
      $('heroPlay').innerHTML = ic('play') + (isTv(a) ? (p ? 'Continue ' + epLabel(a, p.ep) : 'Play S1 E1') : movie ? (p ? 'Resume' : 'Play Movie') : (p ? 'Continue EP ' + p.ep : 'Play EP 1'));
      $('heroInfo').innerHTML = ic('info') + 'More Info';
      var dots = $('heroDots').children;
      for (var k = 0; k < dots.length; k++) dots[k].className = k === i ? 'on' : '';
      body.className = ''; bg.className = '';
    }
    if (instant || LITE) return paint();
    body.className = 'swap'; bg.className = 'swap';
    setTimeout(paint, 380);
  }

  // ======================= Tabs =======================
  var VIEW_OF = { home: 'viewHome', movies: 'viewHome', tv: 'viewHome', live: 'viewLive', schedule: 'viewSchedule', search: 'viewSearch', list: 'viewList', history: 'viewHistory', account: 'viewAccount', settings: 'viewSettings' };
  var TAB_ICON = { home: 'home', movies: 'film', tv: 'tv', live: 'live', schedule: 'cal', search: 'search', list: 'list', history: 'history', account: 'person', settings: 'gear' };
  function paintTabs() {
    var tabs = document.querySelectorAll('.tab'), names = { home: 'Anime', movies: 'Movies', tv: 'TV Shows', live: 'Live TV', schedule: 'Schedule', search: 'Search', list: 'My List', history: 'History', account: auth() ? auth().username : 'Account', settings: 'Settings' };
    for (var i = 0; i < tabs.length; i++) {
      var t = tabs[i].getAttribute('data-tab');
      tabs[i].innerHTML = ic(TAB_ICON[t]) + '<span class="tl">' + esc(names[t]) + '</span>';
      tabs[i].className = 'tab focusable' + (t === state.tab ? ' active' : '') + (tabs[i] === state.focusEl ? ' focused' : '');
      tabs[i].__tab = t;
    }
  }
  function showTab(t, focusContent) {
    var prev = state.tab;
    state.tab = t; state.view = t;
    if (t === 'home') state.mode = 'anime';
    if (t === 'movies') state.mode = 'movies';
    if (t === 'tv') state.mode = 'tv';
    var shown = VIEW_OF[t];
    ['viewHome', 'viewSearch', 'viewList', 'viewHistory', 'viewAccount', 'viewSettings', 'viewLive', 'viewSchedule'].forEach(function (id) {
      $(id).className = 'view' + (id === shown ? '' : ' hidden');
    });
    $('nav').className = t === 'live' || activeView().scrollTop > 40 ? 'solid' : '';
    paintTabs();
    if (isHomeTab(t)) {
      if (state.rowsDirty && state.cache[state.mode]) { state.rowsDirty = false; renderHome(state.cache[state.mode]); }
      else if (state.hero.length && state.cache[state.mode] && prev === state.tab) { renderContinue(); showHero(state.heroIdx, true); }
      else loadHome();
    }
    if (t === 'search') {
      state.smode = state.smode || state.mode; paintTypeChips();
      if (!$('searchGrid').children.length && !$('searchMsg').textContent) runSearch();
      if (focusContent !== false) { setFocus($('searchInput')); if (!IS_TV) $('searchInput').focus(); }
    }
    if (t === 'live' && EA.live) EA.live.show(focusContent);
    if (t === 'schedule' && EA.feed) EA.feed.show(focusContent);
    if (t === 'list') renderList();
    if (t === 'history') renderHistory();
    if (t === 'account') renderAccount();
    if (t === 'settings') { paintTipsBtn(); paintSetSubs(); paintSettingsApp(); paintExtras(); paintProf(); $('serverInput').value = store.get('ea_server', ''); $('setUsing').textContent = 'Currently using: ' + apiBase(); $('setSave').innerHTML = ic('check') + 'Save'; $('setTest').innerHTML = ic('play') + 'Test streams'; $('setReset').innerHTML = 'Reset'; if (focusContent !== false) setFocus($('setApp').firstChild || $('serverInput')); }
    if (focusContent && isHomeTab(t)) setFocus($('heroPlay'));
    if (focusContent && t === 'list') { var f = $('listGrid').firstChild; if (f) setFocus(f); }
    if (focusContent && t === 'history') { var hb = $('clearHist'); setFocus($('histGrid').firstChild || hb); }
    if (focusContent && t === 'account') setFocus($(auth() ? 'accSync' : 'accUser'));
  }
  function renderList() {
    var l = store.get('ea_list', []), g = $('listGrid'), f = state.lst || '', ch = $('listChips'), cnt = { '': l.length };
    g.innerHTML = ''; ch.innerHTML = '';
    l.forEach(function (x) { var k = x.st || 'planning'; cnt[k] = (cnt[k] || 0) + 1; });
    [''].concat(ST_ORDER).forEach(function (k) {
      if (k && !cnt[k] && k !== f) return;
      var b = el('button', 'chip focusable' + (f === k ? ' on' : ''), (k ? ST_LABEL[k] : 'All') + ' <i>' + (cnt[k] || 0) + '</i>'); b.__lst = k; ch.appendChild(b);
    });
    var shown = l.filter(function (x) { return !f || (x.st || 'planning') === f; });
    $('listMsg').textContent = !l.length ? 'Your list is empty. Open a title and choose “My List” to save it here.' : !shown.length ? 'Nothing here yet.' : '';
    shown.forEach(function (a) { g.appendChild(card(a, { st: a.st || 'planning' })); });
  }
  function renderHistory() {
    var h = getHist(), g = $('histGrid'); g.innerHTML = '';
    $('histMsg').textContent = h.length ? '' : 'Nothing watched yet.';
    $('clearHist').innerHTML = 'Clear all history';
    h.forEach(function (it) { g.appendChild(card(it.anime, { hist: true, ep: it.ep, key: it.key })); });
  }
  function renderAccount() {
    var au = auth();
    $('accOut').className = au ? 'hidden' : '';
    $('accIn').className = au ? '' : 'hidden';
    $('accLogin').innerHTML = ic('check') + 'Sign in'; $('accRegister').innerHTML = ic('plus') + 'Create account';
    $('accSync').innerHTML = ic('history') + 'Sync now'; $('accLogout').innerHTML = 'Sign out';
    $('accWho').textContent = au ? 'Signed in as ' + au.username : '';
    renderAniList();
  }
  function accMsg(t, bad) { $('accMsg').textContent = t || ''; $('accMsg').className = 'accmsg' + (bad ? ' bad' : ''); }
  function doAuth(kind) {
    var u = $('accUser').value.trim(), pw = $('accPass').value;
    if (!u || !pw) { accMsg('Enter a username and password', true); return; }
    accMsg(kind === 'register' ? 'Creating account…' : 'Signing in…');
    api({ action: kind }, { body: { username: u, password: pw } }).then(function (r) {
      store.set('ea_auth', { token: r.token, username: r.username });
      $('accPass').value = '';
      accMsg(r.persistent ? '' : 'Note: this server keeps accounts only temporarily. Run the app locally (npm start) or add an Upstash database for permanent accounts.', !r.persistent);
      toast(kind === 'register' ? 'Account created' : 'Welcome back, ' + r.username);
      paintTabs(); renderAccount(); syncNow(true); setFocus($('accSync'));
    }).catch(function (e) { accMsg(e.message, true); });
  }
  function logout() { store.set('ea_auth', null); paintTabs(); renderAccount(); accMsg(''); toast('Signed out'); setFocus($('accUser')); }

  // ======================= AniList (optional link to the user's AniList account) =======================
  // The TV shows a code; the user signs in on a phone/laptop at <server>/link.html. AniList calls go straight to graphql.anilist.co.
  var AL_GQL = 'https://graphql.anilist.co';
  state.alProg = {};                                     // AniList progress by media id (from the user's list)
  function alAuth() {
    var a = store.get('ea_anilist', null);
    if (a && a.exp && a.exp < Date.now()) { store.set('ea_anilist', null); return null; }
    return a && a.token ? a : null;
  }
  function alAutoOn() { return store.get('ea_al_auto', true) !== false; }
  function alGql(query, vars) {
    var a = alAuth(); if (!a) return Promise.reject(new Error('AniList is not linked'));
    return alSend(JSON.stringify({ query: query, variables: vars || {} }), a.token).then(function (j) {
      if (j.__status === 401 || (j.errors && /invalid token|unauthorized/i.test(j.errors[0].message || ''))) { store.set('ea_anilist', null); renderAniList(); throw new Error('AniList sign-in expired — link it again in Account'); }
      if (j.errors && j.errors.length) throw new Error(j.errors[0].message);
      if (!j.data) throw new Error('AniList HTTP ' + j.__status);
      return j.data;
    });
  }
  function alLoadViewer() {
    return alGql('query{Viewer{id name avatar{medium}}}').then(function (d) {
      var a = alAuth(); if (!a) return;
      a.id = d.Viewer.id; a.name = d.Viewer.name; store.set('ea_anilist', a);
      renderAniList(); return a;
    });
  }
  function renderAniList() {
    var a = alAuth();
    $('alWho').textContent = a ? 'Linked to AniList as ' + (a.name || '…') + '. Episodes you finish here update your AniList progress.'
      : 'Link your AniList account to update your watch progress automatically and see your AniList “Watching” list on the home page.';
    $('alLink').innerHTML = a ? ic('history') + 'Refresh' : ic('plus') + 'Link AniList';
    $('alAuto').innerHTML = 'Auto-update: ' + (alAutoOn() ? 'On' : 'Off');
    $('alAuto').style.display = a ? '' : 'none';
    $('alUnlink').innerHTML = 'Unlink';
    $('alUnlink').style.display = a ? '' : 'none';
  }
  function alStopPoll() { clearInterval(state.alPoll); state.alPoll = null; $('alLinkBox').className = 'hidden'; }
  function alStartLink() {
    if (alAuth()) { alLoadViewer().then(function () { toast('AniList refreshed'); state.alRowAt = 0; }).catch(function (e) { toast(e.message); }); return; }
    // a laptop browser on the app's own site can sign in right here
    if (!IS_TV && /^https?:$/.test(location.protocol) && location.origin === apiBase()) { location.href = '/link.html?local=1'; return; }
    accMsg('');
    api({ action: 'al_start' }).then(function (r) {
      $('alUrl').textContent = r.url.replace(/^https?:\/\//, ''); $('alCode').textContent = r.code;
      if (EA.qr) EA.qr($('alQr'), r.url + '?code=' + r.code);                       // phone: scan instead of typing the address
      $('alWait').textContent = r.persistent ? 'Waiting for you to sign in…' : 'Waiting… (tip: add a KV namespace named STORE to the Worker if linking never completes)';
      $('alLinkBox').className = '';
      clearInterval(state.alPoll);
      var until = Date.now() + r.expiresIn * 1000;
      state.alPoll = setInterval(function () {
        if (Date.now() > until) { alStopPoll(); toast('The code expired — try again'); return; }
        api({ action: 'al_poll', code: r.code }).then(function (p) {
          if (p.status === 'ok') {
            alStopPoll();
            store.set('ea_anilist', { token: p.token, exp: p.expiresIn ? Date.now() + p.expiresIn * 1000 : 0 });
            alLoadViewer().then(function (a) { toast('AniList linked' + (a && a.name ? ' — hi ' + a.name : '')); state.alRowAt = 0; }).catch(function (e) { toast(e.message); });
          } else if (p.status === 'expired') { alStopPoll(); toast('The code expired — try again'); }
        }).catch(function () {});
      }, 4000);
    }).catch(function (e) { toast(e.message); $('alWho').textContent = e.message; });
  }
  function alUnlink() { alStopPoll(); store.set('ea_anilist', null); state.alProg = {}; state.alRowAt = 0; renderAniList(); toast('AniList unlinked'); }
  // Home: the user's AniList "Watching" list
  var AL_LIST_Q = 'query($u:Int){MediaListCollection(userId:$u,type:ANIME,status_in:[CURRENT,REPEATING],sort:UPDATED_TIME_DESC){lists{entries{progress media{' + AL_F + '}}}}}';
  function renderAlRow() {
    var a = alAuth();
    var old = $('rows').querySelector('.row.alrow'); if (old) old.parentNode.removeChild(old);
    if (!a || !a.id || state.mode !== 'anime') return;
    function draw(items) {
      if (!items.length || state.mode !== 'anime') return;
      var o2 = $('rows').querySelector('.row.alrow'); if (o2) o2.parentNode.removeChild(o2);
      var rows = $('rows'), row = el('div', 'row alrow');
      row.appendChild(el('div', 'rowhead', '<h3>AniList · Watching</h3><div class="rowbtns"><button class="rowbtn" data-dir="-1">&#8249;</button><button class="rowbtn" data-dir="1">&#8250;</button></div>'));
      var track = el('div', 'track');
      items.forEach(function (it) { var c = card(it.anime, { al: true, ep: it.next }); track.appendChild(c); });
      row.appendChild(track);
      var cont = rows.querySelector('.row.cont');
      rows.insertBefore(row, cont ? cont.nextSibling : rows.firstChild);
    }
    if (state.alRow && Date.now() - (state.alRowAt || 0) < 300000) return draw(state.alRow);
    if (state.alRowBusy) return; state.alRowBusy = true;
    alGql(AL_LIST_Q, { u: a.id }).then(function (d) {
      var items = [];
      ((d.MediaListCollection && d.MediaListCollection.lists) || []).forEach(function (l) { (l.entries || []).forEach(function (e) {
        var m = aniMap(e.media); state.alProg[m.id] = e.progress || 0;
        if (!m.episodes || e.progress < m.episodes) items.push({ anime: m, next: (e.progress || 0) + 1 });
      }); });
      state.alRow = items.slice(0, 30); state.alRowAt = Date.now(); state.alRowBusy = false; draw(state.alRow);
    }).catch(function () { state.alRowBusy = false; if (state.alRow) draw(state.alRow); });
  }
  // Detail page: status button (cycles Planning > Watching > Completed > Paused > Dropped > not on list)
  var AL_STATUS = ['PLANNING', 'CURRENT', 'COMPLETED', 'PAUSED', 'DROPPED'];
  var AL_NAMES = { PLANNING: 'Plan to watch', CURRENT: 'Watching', COMPLETED: 'Completed', PAUSED: 'Paused', DROPPED: 'Dropped', REPEATING: 'Rewatching' };
  function paintAlButton(entry) {
    var a = state.anime, b = $('dAL');
    if (!alAuth() || !a || isVid(a)) { b.className = 'btn focusable hidden'; return; }
    b.className = 'btn focusable';
    state.alEntry = entry === undefined ? state.alEntry : entry;
    var e = state.alEntry;
    b.innerHTML = e ? 'AniList: ' + (AL_NAMES[e.status] || e.status) + (e.progress ? ' · EP ' + e.progress : '') : '+ AniList';
  }
  function alLoadEntry(a) {
    state.alEntry = null; paintAlButton(null);
    if (!alAuth() || isVid(a)) return;
    alGql('query($id:Int){Media(id:$id,type:ANIME){' + AM_FIELDS + ' mediaListEntry{id status progress}}}', { id: a.id }).then(function (d) {
      var e = d.Media && d.Media.mediaListEntry;
      if (d.Media && amGet(a.id) === undefined) { var m2 = {}; Object.keys(d.Media).forEach(function (k) { if (k !== 'mediaListEntry') m2[k] = d.Media[k]; }); amPut(a.id, m2); }
      if (state.anime !== a) return;
      if (e) state.alProg[a.id] = e.progress || 0;
      paintAlButton(e || null); paintDetailButtons();
    }).catch(function () {});
  }
  function alCycle() {
    var a = state.anime, e = state.alEntry;
    var i = e ? AL_STATUS.indexOf(e.status) : -1, next = AL_STATUS[i + 1];
    var p = next ? alGql('mutation($m:Int,$s:MediaListStatus){SaveMediaListEntry(mediaId:$m,status:$s){id status progress}}', { m: a.id, s: next })
                   .then(function (d) { return d.SaveMediaListEntry; })
                 : alGql('mutation($id:Int){DeleteMediaListEntry(id:$id){deleted}}', { id: e.id }).then(function () { return null; });
    p.then(function (ne) { if (state.anime === a) paintAlButton(ne); state.alRowAt = 0; toast(ne ? 'AniList: ' + AL_NAMES[ne.status] : 'Removed from your AniList'); })
     .catch(function (er) { toast(er.message); });
  }
  // Player: mark the episode watched on AniList once 85% of it has played
  function alMaybeUpdate(a, ep, t, d) {
    if (!alAuth() || !alAutoOn() || !a || isVid(a) || !d || t < d * 0.85) return;
    var key = a.id + ':' + ep; if (state.alDone === key) return; state.alDone = key;
    if ((state.alProg[a.id] || 0) >= ep) return;
    var done = a.episodes && ep >= a.episodes;
    alGql('mutation($m:Int,$p:Int,$s:MediaListStatus){SaveMediaListEntry(mediaId:$m,progress:$p,status:$s){id status progress}}',
      { m: a.id, p: ep, s: done ? 'COMPLETED' : 'CURRENT' }).then(function (r) {
      state.alProg[a.id] = ep; state.alRowAt = 0; toast('AniList updated: EP ' + ep + (done ? ' · Completed' : ''));
    }).catch(function (e) { state.alDone = null; });
  }

  // ======================= Search =======================
  function paintTypeChips() {
    var cs = $('typeChips').children;
    for (var i = 0; i < cs.length; i++) cs[i].className = 'chip focusable' + (cs[i].__stype === state.smode ? ' on' : '') + (cs[i] === state.focusEl ? ' focused' : '');
    $('chips').style.display = state.smode !== 'anime' ? 'none' : '';
    $('searchInput').placeholder = state.smode === 'movies' ? 'Search movies…' : state.smode === 'tv' ? 'Search TV shows…' : 'Search anime (English titles)…';
  }
  function buildChips() {
    var tc = $('typeChips'); tc.innerHTML = '';
    [['anime', 'Anime'], ['movies', 'Movies'], ['tv', 'TV Shows']].forEach(function (t) { var b = el('button', 'chip focusable', t[1]); b.__stype = t[0]; tc.appendChild(b); });
    var c = $('chips'); c.innerHTML = '';
    GENRES.forEach(function (g) {
      var b = el('button', 'chip focusable', esc(g)); b.__genre = g; c.appendChild(b);
    });
    paintChips();
  }
  function paintChips() {
    var cs = $('chips').children;
    for (var i = 0; i < cs.length; i++) {
      cs[i].className = 'chip focusable' + (cs[i].__genre === state.genre ? ' on' : '') + (cs[i] === state.focusEl ? ' focused' : '');
    }
  }
  function runSearch() {
    var q = $('searchInput').value.trim(), g = state.genre, movies = state.smode !== 'anime', mt = state.smode === 'tv' ? { type: 'series' } : {};
    var grid = $('searchGrid'), msg = $('searchMsg'), tk = ++state.token;
    grid.innerHTML = '';
    msg.textContent = 'Searching…';
    var p = movies
      ? (q ? api(ext({ action: 'movies_search', q: q }, mt)) : api(ext({ action: 'movies_home' }, mt)).then(function (d) { return { results: d.rows[0] ? d.rows[0].items : [] }; }))
      : api(q || g ? { action: 'search', q: q, genre: g } : { action: 'trending' });
    p.then(function (d) {
      if (tk !== state.token) return;
      var list = d.results || [];
      msg.textContent = list.length ? (q || (!movies && g) ? '' : 'Popular right now') : 'No results found.';
      list.forEach(function (a) { grid.appendChild(card(a)); });
    }).catch(function (e) { if (tk === state.token) msg.textContent = 'Search failed: ' + e.message; });
  }

  // ======================= Detail =======================
  function paintGenres(a) {                                                        // genre tags (+ the next-episode tag when we know it)
    var movie = isVid(a);
    $('dGenres').innerHTML = (a.next && airBadgeOn() && !movie ? '<span class="tag air">Episode ' + a.next.ep + ' airs ' + fmtDay(a.next.at) + ' · ' + airIn(a.next.at) + '</span>' : '') + (a.genres || []).map(function (g) { return '<span class="tag">' + esc(g) + '</span>'; }).join('') +
      (movie && a.cast && a.cast.length ? '<span class="tag cast">' + esc(a.cast.slice(0, 4).join(' · ')) + '</span>' : '');
  }
  function refreshDetailTags(a) { if (state.anime === a && state.view === 'detail') paintGenres(a); }
  function openDetail(a) {
    state.anime = a; state.view = 'detail'; state.epRange = 0;
    state.returnFocus = state.focusEl;
    var movie = isVid(a);
    $('detail').className = '';
    $('dBg').style.backgroundImage = 'url("' + (a.banner || a.cover) + '")';
    $('dCover').src = a.cover || '';
    $('dTitle').textContent = tname(a);
    $('dMeta').innerHTML = (a.score ? '<span class="score">★ ' + esc(a.score) + '</span>' : '') +
      (movie ? [isTv(a) ? 'TV Show' : '', a.year, a.runtime] : [a.format, a.year, a.status ? a.status.replace(/_/g, ' ') : '', a.episodes ? a.episodes + ' episodes' : '']).filter(Boolean)
        .map(function (x) { return '<span>' + esc(x) + '</span>'; }).join('') + (movie ? '' : '<span class="tag">ENG SUB</span>');
    paintGenres(a);
    $('dDesc').textContent = a.description || 'No description available.';
    $('dBack').innerHTML = ic('back') + 'Back';
    $('detail').setAttribute('data-kind', movie ? a.kind : 'anime');
    $('detail').querySelector('.sec').textContent = isTv(a) ? 'Seasons & episodes' : 'Episodes';
    closeDrops(false); if (movie) renderDrops();
    if (isTv(a)) { state.tvSeason = 0; var pr0 = progOf(a); loadTvMeta(a).then(function (m) {
      if (state.anime !== a || state.view !== 'detail') return;
      if (pr0) m.seasons.forEach(function (x, i) { if (x.s === tvS(pr0.ep)) state.tvSeason = i; });
      renderEpisodes(); paintDetailButtons();
    }).catch(function (e) { if (state.anime === a) $('dEps').textContent = 'Could not load the episode list: ' + e.message; }); }
    paintDetailButtons();
    alLoadEntry(a);
    if (!movie && !alAuth()) aniFull(a.id);                                        // warm the AniList record the backend needs, so Play does not wait for it (linked: alLoadEntry fetches both in one request)
    renderEpisodes();
    $('dScroll').scrollTop = 0;
    if (EA.feed && !movie) EA.feed.detailMore(a);
    setFocus($('dPlay'));
  }
  // ----- movie dropdowns: Source and desired Quality (picked on the movie page, before Play) -----
  // ---- Ads: a source gets an "Ads" tag when it is known to open popups. Built-in findings are in ADS_KNOWN (docs/SOURCE_ADS.md explains what was tested);
  // on the Android app every popup the shell blocks is counted for the source on screen, so the tag also appears from your own experience.
  var ADS_KNOWN = { cinesrc: 'popups', vidfast: 'popups', vidlink: 'popups' };       // from reading the players' own scripts (tools/probe_ads.js static): see docs/SOURCE_ADS.md
  function adsSeen() { return store.get('ea_adseen', {}) || {}; }
  function hasAds(key) { return ADS_KNOWN[key] === 'popups' || (adsSeen()[key] || 0) >= 1; }
  function adWarnOn() { return store.get('ea_adwarn', true) !== false; }
  function embedKey(name) { return String(name || '').toLowerCase(); }
  window.EA_popup = function (kind) {                                            // called by the Android shell: a popup or an ad redirect was blocked
    if (!state.embed) return;
    var k = state.embedName === (customSrc() || {}).name ? 'custom' : embedKey(state.embedName), seen = adsSeen();
    seen[k] = (seen[k] || 0) + 1; store.set('ea_adseen', seen);
    var now = Date.now(); if (now - (state.popToast || 0) > 8000) { state.popToast = now; toast('Blocked a popup ad from ' + state.embedName + (adWarnOn() ? ' — it is now tagged “Ads”' : '')); }
  };
  window.EA_key = function (code) {                                              // Android shell: remote keys that WebView does not deliver (media, colour, channel) arrive as the codes this app already knows
    var ev = document.createEvent('Event'); ev.initEvent('keydown', true, true); ev.keyCode = code; document.dispatchEvent(ev);
  };
  // ---- Optional extra sources: Stremio / Nuvio add-ons, a debrid account, a CinePro Core server. Everything is stored on this device only. ----
  function hostOf(u) { return String(u || '').replace(/^\w+:\/\//, '').split('/')[0]; }
  function addonList() {
    var l = store.get('ea_addons', null);
    if (!l) { var old = store.get('ea_addon', ''); l = typeof old === 'string' && /^(https?|stremio):\/\/\S+$/i.test(old) ? [{ url: old, name: hostOf(old) }] : []; }      // the single add-on of the previous version
    return Array.isArray(l) ? l.filter(function (x) { return x && /^(https?|stremio):\/\/\S+$/i.test(x.url || ''); }) : [];
  }
  function addonsParam() { var l = addonList(); return l.length ? JSON.stringify(l.map(function (x) { return x.url; })) : ''; }
  function debridCfg() { var d = store.get('ea_debrid', null); return d && /^(rd|ad|pm|tb)$/.test(d.p) && typeof d.k === 'string' && d.k.length >= 8 ? d : null; }
  function debridHdr() { var d = debridCfg(); return d ? { 'x-debrid': d.p + ':' + d.k } : undefined; }        // sent with the request, never stored by the server
  function cineproUrl() { var u = store.get('ea_cinepro', ''); return typeof u === 'string' && /^https?:\/\/\S+$/i.test(u) ? u : ''; }
  function hasExtra() { return addonList().length > 0 || !!cineproUrl(); }
  var DEBRIDS = [['rd', 'Real-Debrid'], ['ad', 'AllDebrid'], ['pm', 'Premiumize'], ['tb', 'TorBox']];
  function debridName(p) { for (var i = 0; i < DEBRIDS.length; i++) if (DEBRIDS[i][0] === p) return DEBRIDS[i][1]; return p; }
  function customSrc() { var c = store.get('ea_custom_src', null); return c && /^https?:\/\//i.test(c.url || '') ? c : null; }
  function customUrl(d, a, ep) {                                                 // {imdb} {tmdb} {s} {e}: the address template of a player the user chose
    var c = customSrc(); if (!c) return null;
    if (/\{tmdb\}/.test(c.url) && !d.tmdb) return null;
    return c.url.replace(/\{imdb\}|\{id\}/g, encodeURIComponent(a.id)).replace(/\{tmdb\}/g, encodeURIComponent(d.tmdb || '')).replace(/\{s\}/g, isTv(a) ? tvS(ep) : 1).replace(/\{e\}/g, isTv(a) ? tvE(ep) : 1);
  }
  function embedOrder(list) {                                                    // with "Prefer sources without ads", sources seen opening popups go last
    if (store.get('ea_noads', false) !== true || state.mvia !== 'auto') return list;
    return list.filter(function (x) { return !hasAds(x.key); }).concat(list.filter(function (x) { return hasAds(x.key); }));
  }
  var MOVIE_SOURCES = [['auto', 'Auto (best)', 'public domain, else CineSrc'], ['cinesrc', 'CineSrc', 'remote control · subtitles · quality'],
                       ['vidfast', 'VidFast', 'remote control · auto quality'], ['vidcore', 'VidCore', 'auto quality up to 4K'],
                       ['videasy', 'Videasy', 'auto quality'], ['2embed', '2Embed', 'extra player'], ['superembed', 'SuperEmbed', 'extra player'], ['vidsrcto', 'VidSrc.to', 'extra player'], ['vidsrcme', 'VidSrc.me', 'extra player'], ['vidlink', 'VidLink', 'optional · may not work everywhere'], ['archive', 'Public domain', 'our own player']];
  var MOVIE_QUALITIES = [['auto', 'Auto (default)', 'best available'], ['2160', '4K (2160p)', ''], ['1440', '1440p', ''], ['1080', '1080p', ''], ['720', '720p', ''], ['480', '480p', '']];
  function srcOpts() {
    var base = isTv(state.anime) ? MOVIE_SOURCES.filter(function (o) { return o[0] !== 'archive'; }).map(function (o) { return o[0] === 'auto' ? ['auto', 'Auto (best)', 'CineSrc first'] : o; }) : MOVIE_SOURCES.slice();
    var c = customSrc(); if (c) base.push(['custom', 'Custom: ' + c.name, 'your own player address']);
    if (hasExtra()) base.unshift(['addon', 'Your add-ons' + (debridCfg() ? ' + ' + debridName(debridCfg().p) : ''), 'plays in our own player · works on every TV']);
    return base.map(function (o) { return hasAds(o[0]) && adWarnOn() ? [o[0], o[1] + '  ⚠ Ads', 'may open popup ads' + (o[2] ? ' · ' + o[2] : '')] : o; });
  }
  var DROPS = {
    src: { btn: 'dSrcBtn', list: 'dSrcList', label: 'Source', opts: MOVIE_SOURCES, get: function () { return state.mvia; }, set: function (v) { state.mvia = v; store.set('ea_msrc', v); } },
    q: { btn: 'dQBtn', list: 'dQList', label: 'Quality', opts: MOVIE_QUALITIES, get: function () { return String(state.mq); }, set: function (v) { state.mq = v; store.set('ea_mq', v); } }
  };
  function optName(opts, v) { for (var i = 0; i < opts.length; i++) if (opts[i][0] === v) return opts[i][1]; return opts[0][1]; }
  function movieSrcName(v) { return optName(MOVIE_SOURCES, v); }
  function renderDrops() { DROPS.src.opts = srcOpts(); Object.keys(DROPS).forEach(function (k) { var d = DROPS[k]; $(d.btn).innerHTML = '<span>' + d.label + ': ' + esc(optName(d.opts, d.get())) + '</span><span>▾</span>'; }); }
  function openDropKey() { var f = null; Object.keys(DROPS).forEach(function (k) { if ($(DROPS[k].list).className !== 'hidden') f = k; }); return f; }
  function anyDropOpen() { return openDropKey() !== null; }
  function closeDrops(refocus) {
    var k = openDropKey();
    Object.keys(DROPS).forEach(function (x) { $(DROPS[x].list).className = 'hidden'; });
    if (refocus && k) setFocus($(DROPS[k].btn));
  }
  function openDrop(k) {
    closeDrops(false);
    var d = DROPS[k], box = $(d.list), sel = null; box.innerHTML = '';
    d.opts.forEach(function (o) {
      var on = o[0] === d.get();
      var it = el('div', 'dsopt focusable' + (on ? ' on' : ''), '<span>' + esc(o[1]) + (on ? ' ✓' : '') + '</span><span class="hint2">' + esc(o[2]) + '</span>');
      it.__drop = k; it.__dropval = o[0]; if (on) sel = it; box.appendChild(it);
    });
    box.className = ''; setFocus(sel || box.firstChild);
  }
  function pickDrop(k, v) { DROPS[k].set(v); renderDrops(); closeDrops(false); setFocus($('dPlay')); toast(DROPS[k].label + ': ' + optName(DROPS[k].opts, v)); }
  function paintDetailButtons() {
    var a = state.anime, p = progOf(a), movie = isVid(a);
    $('dPlay').innerHTML = ic('play') + (isTv(a) ? (p ? 'Continue ' + epLabel(a, p.ep) + (p.time > 10 ? ' · ' + fmt(p.time) : '') : 'Play ' + epLabel(a, tvFirst(a)))
      : movie ? (p ? 'Resume' + (p.time > 10 ? ' · ' + fmt(p.time) : '') : 'Play Movie')
      : (p ? 'Continue EP ' + p.ep + (p.time > 10 ? ' · ' + fmt(p.time) : '') : alNextEp(a) > 1 ? 'Continue EP ' + alNextEp(a) + ' (AniList)' : 'Play EP 1'));
    $('dList').innerHTML = ic(inList(a) ? 'check' : 'plus') + (inList(a) ? 'In My List' : 'My List');
    var stb = $('dStatus'); if (stb) { var cs = statusOf(a); stb.style.display = cs && !isVid(a) ? '' : 'none'; stb.innerHTML = 'Status: ' + (ST_LABEL[cs] || ''); }
    $('dRemove').innerHTML = '✕ Remove from Continue Watching';
    $('dRemove').style.display = p ? '' : 'none';
  }
  function renderEpisodes() {
    var a = state.anime, ranges = $('dRanges'), box = $('dEps');
    ranges.innerHTML = ''; box.innerHTML = '';
    if (a.kind === 'movie') return;
    if (isTv(a)) { renderTvEpisodes(a, ranges, box); return; }
    var n = a.episodes || 12, per = 50;
    if (n > per) {
      for (var r = 0; r * per < n; r++) {
        var b = el('button', 'chip focusable' + (r === state.epRange ? ' on' : ''), (r * per + 1) + '–' + Math.min(n, (r + 1) * per));
        b.__range = r; ranges.appendChild(b);
      }
    }
    var p = progOf(a);
    for (var i = state.epRange * per + 1; i <= Math.min(n, (state.epRange + 1) * per); i++) {
      var e = el('div', 'ep focusable', 'EP ' + i);
      if (p && i === p.ep) { e.className += ' cur'; if (p.dur) e.appendChild(el('div', 'pbar', '<i style="width:' + Math.min(100, p.time / p.dur * 100) + '%"></i>')); }
      else if (p && i < p.ep) e.className += ' seen';
      e.__ep = i; box.appendChild(e);
    }
  }
  // ----- TV shows: seasons and episodes from Cinemeta -----
  state.tvMeta = {};
  function loadTvMeta(a) {
    var c = state.tvMeta[a.id]; if (c && c.seasons) return Promise.resolve(c); if (c && c.then) return c;
    var p = api({ action: 'tv_meta', id: a.id }).then(function (m) { state.tvMeta[a.id] = m; return m; }, function (e) { delete state.tvMeta[a.id]; throw e; });
    state.tvMeta[a.id] = p; return p;
  }
  function tvSeasons(a) { var m = state.tvMeta[a.id]; return m && m.seasons ? m.seasons : null; }
  function tvFirst(a) { var ss = tvSeasons(a); return ss && ss[0] ? ss[0].s * 1000 + ss[0].eps[0].e : 1001; }
  function tvStep(a, ep, d) {                                        // next / previous episode code, 0 when there is none
    var ss = tvSeasons(a), list = [];
    if (!ss) return d > 0 ? ep + 1 : (tvE(ep) > 1 ? ep - 1 : 0);
    ss.forEach(function (x) { x.eps.forEach(function (v) { list.push(x.s * 1000 + v.e); }); });
    var i = list.indexOf(ep); if (i < 0) return d > 0 ? list[0] || 0 : 0;
    return list[i + d] || 0;
  }
  function renderTvEpisodes(a, ranges, box) {
    var ss = tvSeasons(a);
    if (!ss) { box.textContent = 'Loading episodes…'; return; }
    if (!ss.length) { box.textContent = 'No episodes listed for this show yet.'; return; }
    if (state.tvSeason >= ss.length) state.tvSeason = 0;
    ss.forEach(function (x, i) { var b = el('button', 'chip focusable' + (i === state.tvSeason ? ' on' : ''), 'Season ' + x.s); b.__season = i; ranges.appendChild(b); });
    var se = ss[state.tvSeason], p = progOf(a), cur = p ? p.ep : 0, now = Date.now();
    se.eps.forEach(function (v) {
      var code = se.s * 1000 + v.e, future = v.aired && Date.parse(v.aired) > now;
      var e = el('div', 'ep focusable' + (future ? ' seen' : ''), 'E' + v.e);
      e.title = (v.name || '') + (future ? ' (not aired yet)' : '');
      if (code === cur) { e.className += ' cur'; if (p.dur) e.appendChild(el('div', 'pbar', '<i style="width:' + Math.min(100, p.time / p.dur * 100) + '%"></i>')); }
      else if (cur && code < cur) e.className += ' seen';
      e.__ep = code; box.appendChild(e);
    });
  }
  function closeDetail() {
    state.view = state.tab;
    $('detail').className = 'hidden';
    if (isHomeTab(state.tab)) renderContinue();
    if (state.tab === 'history') renderHistory();
    if (state.tab === 'list') renderList();
    var f = state.returnFocus;
    if (f && document.body.contains(f)) setFocus(f); else setFocus($('heroPlay'));
  }
  function alNextEp(a) { var n = state.alProg[a.id]; return n ? Math.min(n + 1, a.episodes || n + 1) : 0; }
  function startFromDetail() {
    var a = state.anime, p = progOf(a), al = !p && !isVid(a) ? alNextEp(a) : 0;
    play(a, a.kind === 'movie' ? 1 : isTv(a) ? (p ? p.ep : tvFirst(a)) : (p ? p.ep : al || 1));
  }

  // ======================= Player =======================
  var video = $('video');
  function hud(show) {
    if (state.view !== 'player') return;
    var h = $('phud'); clearTimeout(state.hudTimer);
    if (show === false) { h.className = 'fade'; $('player').className = 'idle'; $('player').removeAttribute('data-hud'); return; }
    h.className = ''; $('player').className = ''; $('player').setAttribute('data-hud', '1');
    state.hudTimer = setTimeout(function () { if (!video.paused) hud(false); }, 3500);
  }
  function pmsg(t, busy) { $('pMsg').textContent = t || ''; $('spinner').className = busy ? 'on' : ''; hud(); }
  function paintPlayBtn() {
    document.querySelector('[data-act="toggle"]').innerHTML = ic(video.paused ? 'play' : 'pause');
  }
  function initPlayerIcons() {
    var map = { back: 'back', prev: 'prev', next: 'next', cc: 'cc', fs: 'fs' };
    Object.keys(map).forEach(function (k) { document.querySelector('[data-act="' + k + '"]').innerHTML = ic(map[k]); });
    paintPlayBtn();
  }
  function play(a, ep, startAt, keepVia, skip) {
    var tk = ++state.token, movie = isVid(a);
    abortSources(); hideOldEng();                                                               // the previous lookup is not needed any more
    state.srcSkip = skip || [];                                                   // sources already tried for this episode
    if (!keepVia) { state.dubFailed = false; state.preRetried = false; state.oldTry = false; }
    if (!keepVia && state.via && state.anime && state.anime.id !== a.id) state.via = 'auto';
    state.anime = a; state.ep = ep; state.view = 'player'; state.skip = null; hideEmbed();
    if (state.os.key !== osKey()) state.os = newOs(osKey());
    $('player').className = ''; $('player').setAttribute('data-kind', movie ? a.kind : 'anime');
    $('skipBtn').className = 'skipbtn hidden';
    $('pTitle').textContent = a.kind === 'movie' ? a.title : isTv(a) ? a.title + ' — ' + epLabel(a, ep) : a.title + ' — Episode ' + ep;
    if (isTv(a)) loadTvMeta(a).catch(function () {});
    stopVideo();
    var pr = progOf(a);
    if (startAt == null) startAt = pr && pr.ep === ep ? pr.time : 0;
    if (!keepVia) { addHist(a, ep); autoStatus(a, ep, false); }
    pmsg(movie ? 'Finding a stream…' : state.srcSkip.length ? 'Trying more sources… (' + state.srcSkip.length + ' checked)' : 'Finding an English-subbed stream…', true);
    state.srcCtl = !movie && window.AbortController ? new AbortController() : null;                  // Tizen 4 has no AbortController: stale answers are ignored instead
    var usedPre = false;
    var req = movie ? api(ext({ action: 'movie_sources', via: isTv(a) && state.mvia === 'archive' ? 'auto' : state.mvia || 'auto', id: a.id, title: a.title, year: a.year || '', quality: state.mq !== 'auto' ? state.mq : '', t: startAt > 5 ? Math.floor(startAt) : '', addons: addonsParam(), cinepro: cineproUrl() },
        isTv(a) ? { type: 'series', s: tvS(ep), e: tvE(ep) } : {}), { headers: debridHdr() })
      : (function () { var pre = takePrefetch(a, ep); if (pre) { usedPre = true; return pre; } return api({ action: 'sources', via: state.via || 'auto', audio: state.audioPref === 'dub' ? 'dub' : '', id: a.id, title: a.title, alt: a.titleRomaji || '', syn: (a.synonyms || []).join('|'), ep: ep, skip: state.srcSkip.join(','), order: iqOrder() }, { signal: state.srcCtl && state.srcCtl.signal }); })();
    req.then(function (d) {
      if (tk !== state.token) return;
      if (!movie && d.trace) iq.recordTrace(d.trace);                             // which sources answered / failed / timed out, as seen by the backend
      if (usedPre) d.pre = true;
      if (movie && d.addonError) toast('Add-on: ' + d.addonError);
      if (movie && d.mode === 'embed' && d.embeds && d.embeds.length) {
        var elist = embedOrder(d.embeds);
        if (state.mvia === 'custom') { var cu = customUrl(d, a, ep); if (cu) elist = [{ key: 'custom', name: customSrc().name, url: cu }].concat(elist); else toast('The custom player needs a TMDB id this title does not have — using another source'); }
        state.embeds = elist; state.embedIdx = 0;
        if (OLD_ENGINE && !state.oldTry) { showOldEng(false); return; }          // this TV cannot run the hosted players: say so instead of hanging on "fetching media"
        startEmbed(elist[0].url, elist[0].key === 'custom' ? elist[0].name : null); return;
      }
      if (!d.url) throw new Error(d.error || 'No stream found');
      startVideo(d, startAt, tk);
      if (!(d.subtitles && d.subtitles.length) && !d.hardsub) osFetchList(function () { if (tk === state.token) subAuto(); });   // OpenSubtitles automatically
      if (d.skip) state.skip = d.skip;                                              // the source's own intro/outro times
      if (!movie && a.mal) api({ action: 'skip', mal: a.mal, ep: ep }).then(function (sk) { if (tk === state.token && sk && (sk.op || sk.ed)) state.skip = sk; }).catch(function () {});
    }).catch(function (e) {
      if (e && e.name === 'AbortError') return;
      if (tk === state.token && !movie && e.data && e.data.trace) iq.recordTrace(e.data.trace);
      if (tk === state.token && !movie && e.nojson && e.status >= 500 && state.srcSkip.length < 3) {   // the backend call died without an answer (e.g. Cloudflare CPU limit): drop the lead source and ask again
        var lead = iqOrder().split(',').filter(function (k) { return state.srcSkip.indexOf(k) < 0; })[0];
        if (lead && (!state.via || state.via === 'auto')) { iq.recordTrace([{ k: lead, ok: false, ms: 0, kind: 'fail' }]); return play(a, ep, startAt, true, state.srcSkip.concat([lead])); }
      }
      if (tk === state.token && !movie && e.data && e.data.retry && e.data.skip && state.srcSkip.length < 12) {   // server ran out of its per-call budget: continue with the remaining sources
        return play(a, ep, startAt, true, String(e.data.skip).split(','));
      }
      if (tk === state.token && !movie && state.audioPref === 'dub' && !state.dubFailed) {   // no English dub here: fall back to Japanese audio
        state.dubFailed = true; state.audioPref = 'sub'; toast('No English dub for this episode — using Japanese audio');
        return play(a, ep, startAt, true);
      }
      if (tk === state.token) { state.playFail = true; state.failAt = startAt || 0; pmsg('Could not start playback: ' + e.message + '.   OK: try again   ·   Up: choose another source   ·   Back: leave', false); }
    });
  }
  // Sponsor pre-roll (public/sponsor.js): one labelled video before a title, anime once per session, movies / TV once per different title; retries and source switches never show another
  var play0 = play;
  play = function (a, ep, startAt, keepVia, skip) {
    if (!keepVia && !(skip && skip.length) && EA.sponsor && EA.sponsor.wants(a)) { EA.sponsor.preroll(a, function (go) { if (go) play0(a, ep, startAt, keepVia, skip); }); return; }
    return play0(a, ep, startAt, keepVia, skip);
  };
  // ---- Old TV engines (Tizen 4/5/5.5/6): the hosted movie/TV players are written for 2020+ browsers and do not run there ----
  function showOldEng(failed) {
    pmsg('', false);
    var b = $('oldEng'), has = hasExtra(), tz = CHROME_V >= 76 ? '6' : CHROME_V >= 69 ? '5.5' : CHROME_V >= 63 ? '5' : '4';
    b.innerHTML = '<h3>' + (failed ? 'The player did not start on this TV' : 'This TV\'s browser is too old for these players') + '</h3>' +
      '<p>The hosted movie and TV players need a 2020 or newer browser. This TV has Chromium ' + (CHROME_V || '56') + ' (Tizen ' + tz + '), which cannot run them.</p>' +
      '<p>' + (has ? 'Your extra sources had no stream for this title.' : 'You can still watch here: add a <b>Stremio / Nuvio add-on</b> address below (or a debrid service in Settings → Extra sources). It gives us a plain video file that plays in our own player, which this TV can run.') + '</p>' +
      '<input id="oeUrl" class="focusable" type="text" placeholder="https://your-addon.example/manifest.json" value="" autocomplete="off" spellcheck="false">' +
      '<div class="setrow"><button id="oeSave" class="btn primary focusable">Save add-on and play</button><button id="oeTry" class="btn focusable">' + (failed ? 'Try the next player' : 'Try the player anyway') + '</button></div>' +
      '<p class="hint">Up / Down to move · OK to type or press · Back to return. Public-domain films and all anime play normally.</p>';
    b.className = ''; state.oldEng = { failed: failed }; setFocus($('oeUrl'));
  }
  function hideOldEng() { $('oldEng').className = 'hidden'; state.oldEng = null; }
  function oldEngGo(useAddon) {
    var failed = state.oldEng && state.oldEng.failed;
    if (useAddon) {
      var u = $('oeUrl').value.trim();
      if (!/^(https?|stremio):\/\/\S+$/i.test(u)) { toast('Enter the add-on address first (it starts with https://)'); setFocus($('oeUrl')); return; }
      addAddon(u, hostOf(u)); state.mvia = 'addon'; store.set('ea_msrc', 'addon'); hideOldEng(); play(state.anime, state.ep, 0, true); return;
    }
    var list = state.embeds || [], i = failed ? (state.embedIdx || 0) + 1 : (state.embedIdx || 0);
    hideOldEng();
    if (!list[i]) { pmsg('None of the players started on this TV. Press Back to return.', false); return; }
    state.embedIdx = i; state.oldTry = true; startEmbed(list[i].url);
  }
  function oldEngKey(e) {
    var k = e.keyCode, ids = ['oeUrl', 'oeSave', 'oeTry'], cur = state.focusEl ? ids.indexOf(state.focusEl.id) : -1;
    if (isBackKey(k) || k === KEY.STOP) { e.preventDefault(); state.lastBack = Date.now(); hideOldEng(); closePlayer(); return; }
    if (k === KEY.UP || k === KEY.DOWN) { e.preventDefault(); setFocus($(ids[Math.max(0, Math.min(2, (cur < 0 ? 0 : cur) + (k === KEY.DOWN ? 1 : -1)))])); return; }
    if (cur === 0) { if (k === KEY.ENTER && !(document.activeElement && document.activeElement.tagName === 'INPUT')) { e.preventDefault(); $('oeUrl').focus(); } return; }   // OK opens the TV keyboard; while typing, keys go to it
    if (k === KEY.ENTER) { e.preventDefault(); if (cur === 1) oldEngGo(true); else oldEngGo(false); }
  }
  // Hosted embed player (iframe). Used for movies when no direct file exists; Back always exits.
  var EMBED_NAMES = [[/vidfast/, 'VidFast'], [/videasy/, 'Videasy'], [/cinesrc/, 'CineSrc'], [/vidlink/, 'VidLink'], [/2embed/, '2Embed'], [/multiembed|streamingnow/, 'SuperEmbed'],
                     [/vidsrc\.to/, 'VidSrc.to'], [/vidsrc\.(me|sh)/, 'VidSrc.me']];
  function embedNameOf(url) { for (var i = 0; i < EMBED_NAMES.length; i++) if (EMBED_NAMES[i][0].test(url)) return EMBED_NAMES[i][1]; return 'VidCore'; }
  // Popup blocking for hosted players: the frame is sandboxed WITHOUT allow-popups and allow-top-navigation, so window.open() and "redirect the whole page" ads are refused by the browser itself
  // (Samsung TV, Android and web). Scripts, cookies, forms and fullscreen still work. Ads drawn inside the player's own picture cannot be removed this way.
  var SANDBOX = 'allow-scripts allow-same-origin allow-forms allow-presentation';
  function popBlockOn() { return store.get('ea_popblock', true) !== false; }
  function startEmbed(url, customName) {
    stopVideo();
    state.embed = true; state.embedKind = !customName && /cinesrc\.st/.test(url) ? 'cinesrc' : 'vidcore';   // 'vidcore' = the VidCore/VidFast/Videasy message API (a custom player is treated the same way)
    state.embedName = customName || embedNameOf(url);
    state.cin = { t: 0, d: 0, paused: true, stamp: performance.now(), live: false };
    state.vcNoCmd = false; state.vcChk = null; state.embedHeard = false;
    var f = $('embedFrame');
    f.className = 'show';
    if (popBlockOn()) f.setAttribute('sandbox', SANDBOX); else f.removeAttribute('sandbox');          // must be set before the address
    f.src = url;
    pmsg('Loading player… (press Enter to focus it, Back to exit)', true);
    f.onload = function () { if (state.embed) pmsg('', false); };
    $('player').setAttribute('data-embed', '1');
    $('embedCtl').className = '';                    // bottom control bar: Down opens it
    state.ebar = { open: false, idx: 2 };
    clearInterval(state.ebarTick); state.ebarTick = setInterval(paintEbar, 500);
    clearInterval(state.vcPoll); if (state.embedKind === 'vidcore') state.vcPoll = setInterval(function () { cinSend('getStatus'); }, 2000);
    setTimeout(function () { if (state.embed) pmsg('', false); }, 6000);
    var etk = state.token; clearTimeout(state.embedDog);                  // watchdog: a player that never says a word did not start
    state.embedDog = setTimeout(function () {
      if (etk !== state.token || !state.embed || state.embedHeard) return;
      if (OLD_ENGINE) { hideEmbed(); showOldEng(true); }
      else if (/^(CineSrc|VidFast|VidCore|Videasy)$/.test(state.embedName) && state.embeds && state.embeds[(state.embedIdx || 0) + 1]) {         // these players always report back: silence means a dead player, so move on
        state.embedIdx = (state.embedIdx || 0) + 1; var nx = state.embeds[state.embedIdx]; toast(state.embedName + ' did not start — trying ' + nx.name); startEmbed(nx.url);
      }
      else toast('Player not responding? Press Up, then Source, to try another player' + (popBlockOn() ? ' — or switch off "Block popups in hosted players" in Settings if it stays blank' : ''));
    }, OLD_ENGINE ? 20000 : 30000);
    startSubLoop();                                  // OpenSubtitles overlay, locked to the player clock
    osFetchList(function () { subAuto(); });
  }
  function hideEmbed() {
    state.embed = false; state.embedKind = null; $('player').removeAttribute('data-embed');
    $('embedSubs').textContent = ''; $('embedCtl').className = 'hidden'; state.ebar = { open: false, idx: 2 };
    clearInterval(state.ebarTick); clearInterval(state.vcPoll); clearTimeout(state.ebarHide); clearTimeout(state.embedDog);
    var f = $('embedFrame');
    if (f.className !== '') { f.className = ''; f.removeAttribute('src'); }
  }
  function clearTracks() {
    while (video.firstChild) video.removeChild(video.firstChild);
    state.trackUrls.forEach(function (u) { try { URL.revokeObjectURL(u); } catch (e) {} });
    state.trackUrls = [];
  }
  // Start at the best quality the connection can sustain (hls.js default starts low)
  function newHls() {
    var h = new Hls({ maxBufferLength: 45, maxMaxBufferLength: 90, backBufferLength: 60, abrEwmaDefaultEstimate: 10000000, startLevel: -1, capLevelToPlayerSize: false,
                      manifestLoadingMaxRetry: 4, levelLoadingMaxRetry: 4, fragLoadingMaxRetry: 6, fragLoadingRetryDelay: 600 });
    h.on(Hls.Events.MANIFEST_PARSED, function () { applyQualityPref(); setQualityLabel(); });
    h.on(Hls.Events.AUDIO_TRACKS_UPDATED, function () { var i = hlsAudio(state.audioPref === 'dub' ? 'dub' : 'sub'); if (i >= 0 && h.audioTrack !== i) h.audioTrack = i; if (state.menuOpen) renderMenu(); });
    h.on(Hls.Events.LEVEL_SWITCHED, function () { setQualityLabel(); });
    return h;
  }
  // saved choice: 'auto' or a height (e.g. 1080). Locks to the best level <= that height.
  function applyQualityPref() {
    var movie = isVid(state.anime);
    var pref = movie ? store.get('ea_mq', 'auto') : store.get('ea_q', 'auto'), h = state.hls;
    if (pref !== 'auto') pref = parseInt(pref, 10) || 'auto';
    if (!h || !h.levels || pref === 'auto') return;
    var best = -1, bh = 0;
    h.levels.forEach(function (l, i) { if (l.height <= pref && l.height >= bh) { bh = l.height; best = i; } });
    if (best < 0) best = 0;
    h.currentLevel = best;
  }
  function qualityOptions() {
    var h = state.hls, d = state.src, out = [];
    if (h && h.levels && h.levels.length) {
      out.push({ label: 'Auto', pref: 'auto', apply: function () { h.currentLevel = -1; } });
      h.levels.map(function (l, i) { return { i: i, h: l.height, bw: l.bitrate }; })
        .sort(function (a, b) { return b.h - a.h || b.bw - a.bw; })
        .filter(function (x, k, arr) { return !k || arr[k - 1].h !== x.h; })
        .forEach(function (x) { out.push({ label: x.h + 'p', pref: x.h, apply: function () { h.currentLevel = x.i; } }); });
    } else if (d && d.qualities && d.qualities.length > 1) {
      d.qualities.forEach(function (q, i) {
        out.push({ label: q.label, pref: parseInt(q.label, 10) || 'auto', apply: function () {
          state.qIdx = i; var at = video.currentTime; video.src = q.url;
          var sv = store.get('ea_vol', null); if (sv) { try { video.volume = sv.v; video.muted = !!sv.m; } catch (e) {} }
    try { video.playbackRate = state.speed || 1; } catch (e) {}
    video.onloadedmetadata = function () { if (at > 1) video.currentTime = at; };
          var pr = video.play(); if (pr && pr.catch) pr.catch(function () {});
        } });
      });
    }
    return out;
  }
  function curQualityIndex(opts) {
    var h = state.hls;
    if (h && h.levels && h.levels.length) {
      // hls.js: currentLevel = the level PLAYING now (changes only after the next fragment), loadLevel = the level asked for.
      // Reading currentLevel made the row lag one press behind, so Left/Right seemed stuck on the same quality.
      if (h.autoLevelEnabled) return 0;
      var lv = h.levels[h.loadLevel >= 0 ? h.loadLevel : h.currentLevel];
      for (var i = 1; i < opts.length; i++) if (lv && opts[i].label === lv.height + 'p') return i;
      return 0;
    }
    return state.qIdx || 0;
  }
  function setQualityLabel() {
    var b = document.querySelector('[data-act="menu"]'); if (!b) return;
    var opts = qualityOptions();
    if (!opts.length) { b.textContent = 'HD'; return; }
    var h = state.hls;
    if (h && h.levels && h.levels.length) {
      var auto = h.autoLevelEnabled, live = h.levels[auto ? (h.currentLevel >= 0 ? h.currentLevel : h.loadLevel) : (h.loadLevel >= 0 ? h.loadLevel : h.currentLevel)];
      b.textContent = (auto ? 'Auto ' : '') + (live ? live.height + 'p' : '');
    } else b.textContent = opts[curQualityIndex(opts)].label;
  }
  // ======================= Subtitles (OpenSubtitles) & CineSrc control =======================
  function parseVtt(text) {
    var cues = [], blocks = String(text).replace(/\r/g, '').split(/\n\n+/);
    function tm(x) { var m = x.match(/(?:(\d+):)?(\d+):(\d+)[.,](\d+)/); return m ? (+(m[1] || 0)) * 3600 + (+m[2]) * 60 + (+m[3]) + (+('0.' + m[4])) : 0; }
    blocks.forEach(function (b) {
      var lines = b.split('\n'), i = 0;
      while (i < lines.length && lines[i].indexOf('-->') < 0) i++;
      if (i >= lines.length) return;
      var t = lines[i].split('-->');
      var txt = lines.slice(i + 1).join('\n').replace(/<[^>]+>/g, '').replace(/\{[^}]*\}/g, '').trim();
      if (txt) cues.push({ s: tm(t[0]), e: tm(t[1]), text: txt });
    });
    cues.sort(function (a, b) { return a.s - b.s; });
    return cues;
  }
  function vttTime(x) { x = Math.max(0, x); var h = Math.floor(x / 3600), m = Math.floor(x % 3600 / 60), sec = x % 60; return (h < 10 ? '0' : '') + h + ':' + (m < 10 ? '0' : '') + m + ':' + (sec < 10 ? '0' : '') + sec.toFixed(3); }
  function cuesToVtt(cues, off) { return 'WEBVTT\n\n' + cues.map(function (c, i) { return (i + 1) + '\n' + vttTime(c.s + off) + ' --> ' + vttTime(c.e + off) + '\n' + c.text; }).join('\n\n') + '\n'; }
  // One subtitle model for every player: items = tracks shipped with the stream (any language) + OpenSubtitles (English / Japanese).
  // They are drawn by our own overlay, locked to the real playback clock (video.currentTime, or CineSrc's clock) — no native <track>
  // (which is what made subtitles unreliable), so sync is exact and works the same on TV, laptop and embeds.
  var LANG_NAMES = { en: 'English', ja: 'Japanese', ml: 'Malayalam', hi: 'Hindi', ta: 'Tamil', te: 'Telugu', kn: 'Kannada', bn: 'Bengali', es: 'Spanish', pt: 'Portuguese', fr: 'French', de: 'German', ar: 'Arabic',
                     it: 'Italian', id: 'Indonesian', ru: 'Russian', ko: 'Korean', zh: 'Chinese', tr: 'Turkish', vi: 'Vietnamese', ms: 'Malay', fa: 'Persian', pl: 'Polish', nl: 'Dutch', th: 'Thai' };
  var LANG_ORDER = ['en', 'ja', 'ml', 'hi', 'ta', 'te'];
  function newOs(key) { return { key: key, items: [], idx: -1, off: 0, cues: [], osLoaded: false, osLoading: false, userPick: false, auto: false }; }
  state.os = newOs('');
  function osKey() { var a = state.anime; return a ? (a.kind === 'movie' ? 'm:' + a.id : (isTv(a) ? 't:' : 'a:') + a.id + ':' + state.ep) : ''; }
  function subCode(it) { return it.lang || 'en'; }
  function subLabel(it) { return it.label; }
  // stream-provided tracks (replaces only the stream items, keeps OpenSubtitles ones)
  function subSetStream(list) {
    var o = state.os, keep = o.items.filter(function (x) { return x.kind === 'os'; }), n = {};
    var st = (list || []).map(function (t) {
      n[t.lang] = (n[t.lang] || 0) + 1;
      return { kind: 'stream', lang: t.lang || 'en', label: (LANG_NAMES[t.lang] || t.label || 'Subtitles') + (t.label && /sdh|cc/i.test(t.label) ? ' (SDH)' : '') + (n[t.lang] > 1 && !/sdh/i.test(t.label || '') ? ' #' + n[t.lang] : ''), url: t.url, short: 'Stream' + (t.label && /sdh|cc/i.test(t.label) ? ' (SDH)' : ''), cues: null };
    });
    o.items = st.concat(keep); o.idx = -1; o.cues = [];
  }
  function osFetchList(cb) {
    var a = state.anime, k = osKey();
    if (state.os.key === k && (state.os.osLoaded || state.os.osLoading)) { if (state.os.osLoaded && cb) cb(); return; }
    if (state.os.key !== k) state.os = newOs(k);
    state.os.osLoading = true;
    var req = a.kind === 'movie' ? api({ action: 'subs', imdb: a.id }) : isTv(a) ? api({ action: 'subs', imdb: a.id, season: tvS(state.ep), episode: tvE(state.ep) })
      : api({ action: 'subs', anilist: a.id, ep: state.ep });
    req.then(function (r) {
      if (state.os.key !== k) return;
      var cnt = {};
      (r.subtitles || []).forEach(function (x) {
        var code = x.lang || 'en'; cnt[code] = (cnt[code] || 0) + 1;
        state.os.items.push({ kind: 'os', lang: code, label: (LANG_NAMES[code] || code) + ' · OpenSubtitles #' + cnt[code], short: 'OpenSubtitles #' + cnt[code], release: x.release || '', url: x.url, cues: null });
      });
      state.os.osLoaded = true; state.os.osLoading = false;
      if (cb) cb();
      if (state.menuOpen) renderMenu();
    }).catch(function () {
      if (state.os.key !== k) return;
      if (!state.os.retried) { state.os.retried = true; state.os.osLoading = false; setTimeout(function () { if (state.os.key === k && !state.os.osLoaded) osFetchList(cb); }, 1500); return; }
      state.os.osLoaded = true; state.os.osLoading = false; if (state.menuOpen) renderMenu();
    });
  }
  // choose an item (idx -1 = off)
  function subSelect(idx, quiet) {
    var o = state.os, it = o.items[idx];
    o.idx = it ? idx : -1;
    if (!it) { o.cues = []; return Promise.resolve(); }
    if (it.cues) { o.cues = it.cues; if (!quiet) toast(subLabel(it)); return Promise.resolve(); }
    var k = o.key; o.cues = [];
    return fetch(it.url).then(function (r) { return r.text(); }).then(function (t) {
      it.cues = parseVtt(t);
      if (state.os.key === k && state.os.idx === idx) { state.os.cues = it.cues; if (!quiet) toast(subLabel(it) + ' · ' + it.cues.length + ' lines'); }
    }).catch(function () { toast('Could not load that subtitle'); });
  }
  function loadCues(it) {
    if (it.cues) return Promise.resolve(it.cues);
    return fetch(it.url).then(function (r) { return r.text(); }).then(function (t) { it.cues = parseVtt(t); return it.cues; }).catch(function () { it.cues = []; return it.cues; });
  }
  // How far OpenSubtitles cues sit from a reference track (the stream's own subtitles, perfectly synced to the picture).
  // Nearest-start matching, histogram in 0.25 s bins; returns {off, share} where off = seconds to ADD to the video clock.
  function alignOffset(os, ref) {
    var diffs = [], j = 0, i;
    for (i = 0; i < os.length; i++) {
      while (j + 1 < ref.length && Math.abs(ref[j + 1].s - os[i].s) <= Math.abs(ref[j].s - os[i].s)) j++;
      var d = os[i].s - (ref[j] ? ref[j].s : 1e9); if (Math.abs(d) <= 120) diffs.push(d);
    }
    if (diffs.length < 8) return null;
    var bins = {}, best = null;
    diffs.forEach(function (d) { var k = Math.round(d / 0.25); bins[k] = (bins[k] || 0) + 1; });
    Object.keys(bins).forEach(function (k) { var c = (bins[k] || 0) + (bins[+k - 1] || 0) + (bins[+k + 1] || 0); if (!best || c > best.c) best = { k: +k, c: c }; });
    var near = diffs.filter(function (d) { return Math.abs(d - best.k * 0.25) <= 0.6; });
    var off = near.reduce(function (a, b) { return a + b; }, 0) / near.length;
    return { off: Math.round(off * 10) / 10, share: best.c / diffs.length };
  }
  function itemsOf(lang, kind) { var out = []; state.os.items.forEach(function (it, i) { if (it.lang === lang && (!kind || it.kind === kind)) out.push(i); }); return out; }
  // Automatic choice, no clicks needed: OpenSubtitles in the remembered language (English by default).
  // When the stream carries its own English track, every OpenSubtitles candidate is scored against it and the best-aligned one wins
  // (its offset is applied), so the text is OpenSubtitles' but the timing is locked to this exact release.
  function subAuto() {
    var o = state.os, pref = store.get('ea_sublang', 'en'), kind = store.get('ea_subkind', 'os');
    if (pref === 'off') pref = 'en';                                    // legacy value: "Off" is per-title now
    if (o.userPick) return;
    var key = o.key, st = itemsOf(pref, 'stream'), os = itemsOf(pref, 'os'), hard = state.src && state.src.hardsub;
    if (hard && !st.length) return;                                    // picture already has burned-in subtitles
    if (kind === 'stream' && st.length) { if (o.idx < 0) { subSelect(st[0], true); o.auto = true; } return; }   // you explicitly prefer the stream's own track
    if (!os.length) {                                                  // OpenSubtitles not (yet) available: show the stream track meanwhile
      if (st.length && o.idx < 0) { subSelect(st[0], true); o.auto = true; }
      return;
    }
    if (!st.length) { if (o.idx < 0 || o.auto) { o.off = 0; subSelect(os[0], true); o.auto = true; } return; }   // no reference: first OpenSubtitles file
    if (o.idx < 0) { subSelect(st[0], true); o.auto = true; }           // instant: stream English while OpenSubtitles are compared
    loadCues(o.items[st[0]]).then(function (ref) {
      return Promise.all(os.slice(0, 6).map(function (i) { return loadCues(o.items[i]).then(function (c) { return { i: i, a: alignOffset(c, ref), n: c.length }; }); }));
    }).then(function (res) {
      if (state.os.key !== key || state.os.userPick) return;
      var best = null; res.forEach(function (r) { if (!best || (r.a ? r.a.share : -1) > (best.a ? best.a.share : -1)) best = r; });
      if (!best) best = { i: os[0], a: null };
      state.os.off = best.a && best.a.share >= 0.3 ? best.a.off : 0; state.os.auto = true;
      subSelect(best.i, true);                                          // ALWAYS OpenSubtitles (best-aligned file), never left on the stream track
      if (Math.abs(state.os.off) >= 0.3) toast('OpenSubtitles auto-aligned (' + (state.os.off > 0 ? '+' : '') + state.os.off.toFixed(1) + 's)');
      if (state.menuOpen) renderMenu();
    });
  }
  function rememberSub(idx) { var it = state.os.items[idx]; if (it) { store.set('ea_sublang', it.lang); store.set('ea_subkind', it.kind); } }

  // ---- Embeds with a documented postMessage API: CineSrc (cinesrc:*) and VidCore (timeupdate / PLAYER_EVENT / ended) ----
  var CIN = 'https://cinesrc.st', VCO = 'https://vidcore.io';
  state.cin = { t: 0, d: 0, paused: true, stamp: 0, last: 0 };
  function isCin() { return state.embed && (state.embedKind === 'cinesrc' || (state.embedKind === 'vidcore' && state.cin.live)); }
  function cinSend(cmd, args) {
    try {
      var w = $('embedFrame').contentWindow;
      if (state.embedKind === 'vidcore') {
        var t = args && args.length ? args[0] : cinNow();
        w.postMessage({ command: cmd, time: t }, '*');
        w.postMessage({ action: cmd, time: t }, '*');
      }
      else w.postMessage({ type: 'cinesrc:command', command: cmd, args: args || [] }, CIN);
    } catch (e) {}
  }
  function vcFocus() {
    hideEbar();
    try { $('embedFrame').focus(); } catch (e) {}
    toast(state.embedName + ' player selected — use its own controls; press Back to leave');
  }
  function cinNow() { return state.cin.t + (state.cin.paused ? 0 : (performance.now() - state.cin.stamp) / 1000); }
  // VidCore documents seek/play/pause commands, but if its player ignores them we say so instead of failing silently
  function vcExpect(target) {
    if (state.embedKind !== 'vidcore') return;
    var chk = { target: target, sent: Date.now(), ok: false, seen: false }; state.vcChk = chk;
    setTimeout(function () {
      if (state.vcChk !== chk || chk.ok || !state.embed || !chk.seen) return;
      state.vcNoCmd = true;
      toast(state.embedName + ' is not following remote commands — press OK to use its own controls, or pick another source in ⚙ Settings');
    }, 3500);
  }
  function cinSeek(delta) {
    if (state.embedKind === 'vidcore' && state.vcNoCmd) { vcFocus(); return; }
    if (state.embedKind === 'vidcore' && !state.cin.live) { cinSend('getStatus'); toast('The player has not reported its position yet — try again in a moment'); return; }
    var t = Math.max(0, cinNow() + delta); state.cin.t = t; state.cin.stamp = performance.now(); cinSend('seek', [t]); vcExpect(t); toast((delta > 0 ? '+' : '') + delta + 's'); }
  function cinToggle() {
    if (state.cin.paused) { cinSend('play'); state.cin.paused = false; state.cin.stamp = performance.now(); }
    else { state.cin.t = cinNow(); cinSend('pause'); state.cin.paused = true; }
  }
  window.addEventListener('message', function (e) {
    var fromFrame = false; try { fromFrame = e.source === $('embedFrame').contentWindow; } catch (er) {}
    var raw = e.data; if (typeof raw === 'string' && /^\s*\{/.test(raw)) { try { raw = JSON.parse(raw); } catch (er2) {} }   // some players post JSON strings
    if ((fromFrame || /vidcore|vidfast|videasy/i.test(e.origin)) && state.embed && state.embedKind === 'vidcore' && raw && typeof raw === 'object') {
      var v = raw, vd = v.data || {}, vc = state.cin; state.embedHeard = true;
      if (!vc.live && (v.type === 'timeupdate' || v.type === 'PLAYER_EVENT')) { vc.live = true; pmsg('', false); }
      if (v.type === 'timeupdate') {
        var vt = +vd.currentTime || 0, ck = state.vcChk;
        if (ck && !ck.ok && Date.now() - ck.sent > 400) { ck.seen = true; if (Math.abs(vt - ck.target) < 4) { ck.ok = true; state.vcNoCmd = false; } }
        if (Math.abs(vt - vc.t) > 0.05 && vt > vc.t) vc.paused = false;
        vc.t = vt; vc.d = +vd.duration || vc.d; vc.stamp = performance.now(); saveEmbedProgress();
      } else if (v.type === 'PLAYER_EVENT') {
        if (vd.currentTime != null) { vc.t = +vd.currentTime || 0; vc.stamp = performance.now(); }
        if (vd.duration) vc.d = +vd.duration;
        if (vd.event === 'playerstatus' && vd.paused != null) vc.paused = !!vd.paused;
        if (vd.event === 'play' || vd.event === 'playing') vc.paused = false;
        else if (vd.event === 'pause') vc.paused = true;
        else if (vd.event === 'ended') embedEnded();
      } else if (v.type === 'ended') embedEnded();
      return;
    }
    if (!(fromFrame || e.origin === CIN) || state.embedKind !== 'cinesrc' || !state.embed || !e.data || typeof e.data !== 'object') return;
    var m = e.data, c = state.cin;
    if (/^cinesrc:/.test(m.type || '')) state.embedHeard = true;
    switch (m.type) {
      case 'cinesrc:timeupdate': {                                   // only counts as "playing" while the time is actually moving
        var nt = +m.currentTime || 0;
        if (Math.abs(nt - c.t) > 0.05 && nt > c.t) c.paused = false;
        c.t = nt; c.d = +m.duration || c.d; c.stamp = performance.now(); saveEmbedProgress(); break;
      }
      case 'cinesrc:seeked': case 'cinesrc:seeking': c.t = +m.currentTime || 0; c.stamp = performance.now(); break;
      case 'cinesrc:play': c.paused = false; c.stamp = performance.now(); break;
      case 'cinesrc:pause': c.t = cinNow(); c.paused = true; break;
      case 'cinesrc:loadedmetadata': c.d = +m.duration || c.d; break;
      case 'cinesrc:ended': embedEnded(); break;
      case 'cinesrc:ready': pmsg('', false); break;
    }
  });
  // ---- Bottom control bar for embedded movie players (Down opens it) ----
  function ebarItems() { return [].slice.call(document.querySelectorAll('#embedCtl .ectl')); }
  function paintEbar() {
    if (!state.embed) return;
    var c = state.cin, now = cinNow(), known = state.embedKind === 'cinesrc' || c.live;
    $('eTime').textContent = known ? fmt(now) : '--:--';
    $('eDur').textContent = known && c.d ? fmt(c.d) : '--:--';
    $('eFill').style.width = known && c.d ? Math.min(100, now / c.d * 100) + '%' : '0';
    var pb = document.querySelector('#embedCtl .eplay'); if (pb) pb.textContent = c.paused ? '▶' : '❚❚';
    ebarItems().forEach(function (b, i) { b.className = b.className.replace(/ ?sel/g, '') + (state.ebar.open && i === state.ebar.idx ? ' sel' : ''); });
  }
  function showEbar() {
    if (!state.embed) return;
    if (!state.ebar.open) state.ebar.idx = 2;                       // always starts on play/pause
    state.ebar.open = true; $('embedCtl').className = 'open'; paintEbar();
    clearTimeout(state.ebarHide); state.ebarHide = setTimeout(hideEbar, 8000);
  }
  function hideEbar() {
    clearTimeout(state.ebarHide); state.ebar.open = false;
    if (state.embed) { $('embedCtl').className = ''; paintEbar(); }
  }
  function ebarAct(a) {
    if (a === 'back10') cinSeek(-10); else if (a === 'fwd10') cinSeek(10); else if (a === 'toggle') cinToggle();
    else if (a === 'cc') { var so = subOptions(); so.opts[(so.cur + 1) % so.opts.length].apply(); }
    else if (a === 'syncm' || a === 'syncp') { state.os.off = Math.max(-15, Math.min(15, Math.round((state.os.off + (a === 'syncp' ? 0.5 : -0.5)) * 10) / 10)); toast('Subtitle sync ' + (state.os.off >= 0 ? '+' : '') + state.os.off.toFixed(1) + 's'); }
    else if (a === 'menu') { hideEbar(); openMenu(); }
    else if (a === 'exit') closePlayer();
    else if (a === 'seek') toast('Use Left / Right to seek 10s');
    paintEbar();
  }
  function ebarKey(k) {
    var items = ebarItems(), cur = items[state.ebar.idx], onSeek = cur && cur.getAttribute('data-ec') === 'seek';
    clearTimeout(state.ebarHide); state.ebarHide = setTimeout(hideEbar, 8000);
    if (k === KEY.LEFT || k === KEY.RIGHT) {
      if (onSeek) cinSeek(k === KEY.LEFT ? -10 : 10);
      else state.ebar.idx = Math.max(1, Math.min(items.length - 1, state.ebar.idx + (k === KEY.LEFT ? -1 : 1)));
    }
    else if (k === KEY.UP) { if (!onSeek) state.ebar.idx = 0; else hideEbar(); }
    else if (k === KEY.DOWN) { if (onSeek) state.ebar.idx = 2; }
    else if (k === KEY.ENTER) ebarAct(cur.getAttribute('data-ec'));
    else if (k === KEY.RW) cinSeek(-30); else if (k === KEY.FF) cinSeek(30);
    else if (k === KEY.PLAY || k === KEY.PAUSE || k === KEY.PLAYPAUSE || k === KEY.SPACE) cinToggle();
    paintEbar();
  }
  function saveEmbedProgress() {
    var c = state.cin; if (!state.anime || Date.now() - state.lastSave < 5000 || c.t < 5 || !c.d) return;
    state.lastSave = Date.now(); setProg(state.anime, state.ep, c.t, c.d);
  }
  function embedEnded() {                                            // movie: done; TV: next episode
    var a = state.anime; if (!a) return;
    if (isTv(a)) { var n = tvStep(a, state.ep, 1); if (n) { setProg(a, n, 0, 0); if (store.get('ea_autonext', true) === false) { closePlayer(); toast('Episode finished'); return; } play(a, n, 0); return; } setProg(a, state.ep, 0, 0); closePlayer(); return; }
    removeProg(keyOf(a)); closePlayer();
  }
  function renderSubs() {
    state.subRaf = requestAnimationFrame(renderSubs);
    var box = $('embedSubs'), o = state.os;
    if (state.view !== 'player' || o.idx < 0 || !o.cues.length || (state.embed && !isCin())) { if (box.textContent) box.textContent = ''; return; }
    var t = (isCin() ? cinNow() : video.currentTime) + o.off, cues = o.cues, lo = 0, hi = cues.length - 1, hit = null;
    while (lo <= hi) {                                               // last cue starting at or before t
      var mid = (lo + hi) >> 1;
      if (cues[mid].s <= t) { hit = mid; lo = mid + 1; } else hi = mid - 1;
    }
    var txt = '';
    for (var i = hit; i !== null && i >= 0 && i > hit - 3; i--) if (cues[i].e >= t) { txt = cues[i].text; break; }
    if (box.textContent !== txt) box.textContent = txt;
  }
  function startSubLoop() { cancelAnimationFrame(state.subRaf); state.subRaf = requestAnimationFrame(renderSubs); }

  // Anime sources in Auto order (AnimeX is the default; the rest are fallbacks, also pickable here)
  var SOURCES = ['auto', 'animex', 'anikoto', 'animeyubi', 'aniwaves'];
  var SRC_NAMES = { auto: 'Auto (AnimeX first)', animex: 'AnimeX', anikoto: 'AniKoto', animeyubi: 'AnimeYubi', aniwaves: 'AniWaves' };
  // subtitle languages available now (English, Japanese, Malayalam, Hindi, Tamil, Telugu first), plus Off
  function subLangs() {
    var seen = {}, langs = [];
    state.os.items.forEach(function (it) { if (!seen[it.lang]) { seen[it.lang] = 1; langs.push(it.lang); } });
    langs.sort(function (a, b) { var x = LANG_ORDER.indexOf(a), y = LANG_ORDER.indexOf(b); return (x < 0 ? 99 : x) - (y < 0 ? 99 : y) || (LANG_NAMES[a] || a).localeCompare(LANG_NAMES[b] || b); });
    return langs;
  }
  function pickLang(lang) {                                           // default file for a language: OpenSubtitles #1, else the stream track
    var os = itemsOf(lang, 'os'), st = itemsOf(lang, 'stream'), i = os.length ? os[0] : st[0];
    state.os.userPick = true; state.os.off = 0; subSelect(i); rememberSub(i);
  }
  function subOptions() {                                             // used by the quick toggle (green key / CC button)
    var o = state.os, opts = [{ label: 'Off', apply: function () { o.userPick = true; subSelect(-1); } }];
    subLangs().forEach(function (l) { opts.push({ label: LANG_NAMES[l] || l, apply: function () { pickLang(l); } }); });
    var cur = 0; if (o.idx >= 0) { var l2 = o.items[o.idx].lang, k = subLangs().indexOf(l2); cur = k + 1; }
    return { opts: opts, cur: cur };
  }
  // ----- audio: Japanese (original) / English (dub) -----
  function hlsAudio(kind) {                                          // find an HLS audio track for 'sub' (Japanese) or 'dub' (English)
    var h = state.hls, tr = (h && h.audioTracks) || [], i;
    if (tr.length < 2) return -1;
    var re = kind === 'dub' ? /^en|engl/i : /^ja|^jp|japan/i;
    for (i = 0; i < tr.length; i++) if (re.test(tr[i].lang || '') || re.test(tr[i].name || '')) return i;
    return -1;
  }
  function audioCur() {
    var h = state.hls;
    if (h && h.audioTracks && h.audioTracks.length > 1 && h.audioTrack >= 0) {
      var t = h.audioTracks[h.audioTrack] || {};
      return /^en|engl/i.test((t.lang || '') + ' ' + (t.name || '')) ? 'dub' : 'sub';
    }
    return state.srcAudio === 'dub' ? 'dub' : 'sub';
  }
  function setAudio(kind) {
    store.set('ea_audio', kind); state.audioPref = kind;
    var i = hlsAudio(kind);
    if (i >= 0) { state.hls.audioTrack = i; toast('Audio: ' + (kind === 'dub' ? 'English (dub)' : 'Japanese')); return; }
    if (audioCur() === kind) return;
    toast(kind === 'dub' ? 'Looking for an English dub…' : 'Switching to Japanese audio…');
    var at = video.currentTime; closeMenu(); play(state.anime, state.ep, at > 5 ? at : 0, true);
  }
  // ----- subtitle position & size (every player: our overlay is drawn by renderSubs) -----
  var SUBPOS = ['Lowest', 'Low (default)', 'Medium', 'Classic (v1.04)', 'High', 'Highest'];
  var SUBSIZE = [['s', 'Small'], ['m', 'Medium (default)'], ['l', 'Large'], ['xl', 'Extra large']];
  function subPos() { var v = store.get('ea_subpos', 1); return v >= 0 && v < SUBPOS.length ? v : 1; }
  function subSize() { var v = store.get('ea_subsize', 'm'); return /^(s|m|l|xl)$/.test(v) ? v : 'm'; }
  function applySubStyle() { $('player').setAttribute('data-subpos', String(subPos())); $('player').setAttribute('data-subsize', subSize()); }
  function setSubPos(v) { store.set('ea_subpos', v); applySubStyle(); toast('Subtitle position: ' + SUBPOS[v]); }
  // ----- app settings: one row per setting, OK cycles through the choices -----
  var ACCENTS = { pink: '255,61,127', cyan: '0,200,230', violet: '150,110,255', green: '61,220,151', orange: '255,150,50' };
  function applyAccent() {
    var k = store.get('ea_accent', 'pink'), rgb = ACCENTS[k] || ACCENTS.pink, p = rgb.split(',');
    var r = document.documentElement.style; r.setProperty('--accent-rgb', rgb); r.setProperty('--accent', 'rgb(' + rgb + ')');
  }
  var QOPTS = [['auto', 'Auto'], ['1080', '1080p'], ['720', '720p'], ['480', '480p']];
  var APPSET = [
    ['ea_engine', 'Player engine (Samsung TVs)', 'auto', [['auto', 'Auto (AVPlay on Tizen 4)'], ['avplay', 'Samsung AVPlay'], ['html5', 'Standard HTML5']]],
    ['ea_tlang', 'Titles', 'en', [['en', 'English'], ['romaji', 'Romaji (Japanese)']]],
    ['ea_pz', 'Poster size', 'normal', [['small', 'Small'], ['normal', 'Normal'], ['large', 'Large']], function () { document.body.className = bodyCls(); }],
    ['ea_pauseads', 'Pause ads (picture shown while a video is paused)', true, [[true, 'On'], [false, 'Off']], function () { if (EA.sponsor) EA.sponsor.hidePause(); }],
    ['ea_airbadge', 'Airing badges (episode countdown)', true, [[true, 'On'], [false, 'Off']], function () { paintAirBadges(); }],
    ['ea_alerts', 'New-episode alerts on the home page', true, [[true, 'On'], [false, 'Off']]],
    ['ea_recs', 'Recommendations on the home page', true, [[true, 'On'], [false, 'Off']]],
    ['ea_popblock', 'Block popups in hosted movie players', true, [[true, 'On'], [false, 'Off']]],
    ['ea_ui', 'Look', 'classic', [['classic', 'Classic · low-end devices'], ['modern', 'Modern · better looking']], function (v) { UI_MODERN = v === 'modern'; document.body.className = bodyCls(); }],
    ['ea_intro', 'Opening animation', true, [[true, 'On'], [false, 'Off']]],
    ['ea_start', 'Start on', 'home', [['home', 'Anime'], ['movies', 'Movies'], ['tv', 'TV Shows'], ['live', 'Live TV']]],
    ['ea_accent', 'Accent colour', 'pink', [['pink', 'Pink'], ['cyan', 'Cyan'], ['violet', 'Violet'], ['green', 'Green'], ['orange', 'Orange']], applyAccent],
    ['ea_autonext', 'Play the next episode automatically', true, [[true, 'On'], [false, 'Off']]],
    ['ea_autoskip', 'Skip intro and outro automatically', false, [[false, 'Off'], [true, 'On']]],
    ['ea_audio', 'Default audio (anime)', 'sub', [['sub', 'Japanese (sub)'], ['dub', 'English (dub)']], function (v) { state.audioPref = v; }],
    ['ea_q', 'Default quality (anime)', 'auto', QOPTS],
    ['ea_mq', 'Default quality (movies and TV)', 'auto', [['auto', 'Auto'], ['2160', '4K'], ['1080', '1080p'], ['720', '720p'], ['480', '480p']], function (v) { state.mq = v; }],
    ['ea_hero', 'Rotate the home banner', true, [[true, 'On'], [false, 'Off']]],
    ['ea_adwarn', 'Show an “Ads” tag on sources with popups', true, [[true, 'Show'], [false, 'Hide']]],
    ['ea_noads', 'Movies and TV: try ad-free sources first', false, [[false, 'Off'], [true, 'On']]]
  ];
  function setLabel(row) { var cur = store.get(row[0], row[2]), o = row[3].filter(function (x) { return String(x[0]) === String(cur); })[0]; return o ? o[1] : String(cur); }
  function paintSettingsApp() {
    var box = $('setApp'); if (!box) return; box.innerHTML = '';
    APPSET.forEach(function (row, i) { var b = el('button', 'setr focusable', '<span>' + esc(row[1]) + '</span><b>' + esc(setLabel(row)) + '</b>'); b.__set = i; box.appendChild(b); });
    var c = customSrc(), cb = el('button', 'setr focusable', '<span>Custom movie player</span><b>' + (c ? esc(c.name) : 'None') + '</b>'); cb.__set = 'custom'; box.appendChild(cb);
    $('setCustomHelp').textContent = c ? c.url : 'Add a player of your own with an address like https://player.example/movie/{tmdb} ({imdb} {tmdb} {s} {e} are filled in).';
  }
  function cycleAppSetting(i) {
    var row = APPSET[i], cur = store.get(row[0], row[2]), opts = row[3], at = 0, k;
    for (k = 0; k < opts.length; k++) if (String(opts[k][0]) === String(cur)) at = k;
    var nv = opts[(at + 1) % opts.length][0]; store.set(row[0], nv); if (row[4]) row[4](nv);
    paintSettingsApp(); var nb = $('setApp').children[i]; if (nb) setFocus(nb, true);
    if (row[0] === 'ea_hero' && state.hero.length > 1) setHeroList(state.hero);
  }
  function editCustomSource() {
    var c = customSrc() || {};                                                              // the TV keyboard works on input fields: use the two fields in the settings page
    $('setCustomName').value = c.name || ''; $('setCustomUrl').value = c.url || ''; $('setCustomBox').className = ''; setFocus($('setCustomName'));
  }
  // ---- Profiles (start.js owns the screens; these are the Settings entry points) ----
  function paintProf() {
    var box = $('setProf'); if (!box || !window.EA_PROF) return; box.innerHTML = '';
    var p = EA_PROF.current(); if (!p) return;
    var rows = [['switch', 'Profile', p.name, '<span class="pav">' + EA_PROF.avatarOf(p) + '</span>'], ['lock', 'Profile lock (4-digit PIN)', p.pin ? 'On' : 'Off', ''], ['padd', 'Add a profile', '', '']];
    if (EA_PROF.list().length > 1) rows.push(['pdel', state.pdelAsk ? 'Press again to delete this profile and its list' : 'Delete this profile', '', '']);
    rows.forEach(function (r) { var b = el('button', 'setr focusable', r[3] + '<span>' + esc(r[1]) + '</span><b>' + esc(r[2]) + '</b>'); b.__p = r[0]; box.appendChild(b); });
    paintProfBtn();
  }
  function paintProfBtn() { var b = $('navProf'), p = window.EA_PROF && EA_PROF.current(); if (b && p) { b.innerHTML = EA_PROF.avatarOf(p); b.title = p.name; } }
  function profAct(k) {
    if (k === 'switch') { EA_PROF.switchTo(); return; }
    if (k === 'lock') { var p = EA_PROF.current(); if (p.pin) EA_PROF.clearPin(function () { toast('Profile lock off'); paintProf(); }); else EA_PROF.setPin(function () { toast('Profile lock on'); paintProf(); }); return; }
    if (k === 'padd') { EA_PROF.add(); return; }
    if (k === 'pdel') {
      if (!state.pdelAsk) { state.pdelAsk = true; paintProf(); clearTimeout(state.pdelT); state.pdelT = setTimeout(function () { state.pdelAsk = false; paintProf(); }, 4000); return; }
      state.pdelAsk = false; var cur = EA_PROF.current();
      var go = function () { EA_PROF.remove(cur.id); try { sessionStorage.setItem('ea_switch', '1'); } catch (e) { /* ignore */ } location.reload(); };
      if (cur.pin) EA_PROF.verify(go); else go();
    }
  }
  // ---- Settings -> Home rows ----
  function homeRowTitles() {
    var t = [], c = state.cache.anime; if (c && c.rows) c.rows.forEach(function (r) { t.push(r.title); });
    ['Continue Watching', 'New episodes for you', 'Because you watched'].forEach(function (x) { if (t.indexOf(x) < 0) t.push(x); });
    var pr = store.get('ea_rows', null), order = pr && pr.order || [];
    t.sort(function (a, b) { var x = order.indexOf(a), y = order.indexOf(b); return (x < 0 ? 999 : x) - (y < 0 ? 999 : y); });
    return t;
  }
  function openRows(keep) {
    var box = $('setXBox'); state.xk = 'rows'; clearInterval(state.xPoll);
    var pr = store.get('ea_rows', null) || { hide: {}, order: [] }, titles = homeRowTitles();
    pr.order = titles; store.set('ea_rows', pr);
    var h = '<p class="hint">Choose which rows appear on the Anime home page and in what order. Hidden rows are not loaded or drawn.</p>';
    var SPECIAL = { 'Continue Watching': 1, 'New episodes for you': 1, 'Because you watched': 1 };
    titles.forEach(function (t, i) { h += '<div class="rrow"><span class="rt">' + esc(t) + (SPECIAL[t] ? ' <i>(always at the top)</i>' : '') + '</span><button class="btn focusable" data-i="' + i + '" data-a="tog">' + (pr.hide[t] ? 'Hidden' : 'Shown') + '</button>' + (SPECIAL[t] ? '' : '<button class="btn focusable" data-i="' + i + '" data-a="up">Up</button><button class="btn focusable" data-i="' + i + '" data-a="dn">Down</button>') + '</div>'; });
    h += '<div class="setrow"><button id="xClose" class="btn primary focusable">Done</button></div>';
    box.innerHTML = h; box.className = '';
    var bs = box.querySelectorAll('button[data-a]'); for (var i = 0; i < bs.length; i++) bs[i].__rows = { i: +bs[i].getAttribute('data-i'), a: bs[i].getAttribute('data-a') };
    var f = keep ? box.querySelector('button[data-i="' + keep.i + '"][data-a="' + keep.a + '"]') : box.querySelector('button[data-a]'); setFocus(f || $('xClose'));
  }
  function rowsAct(r) {
    var pr = store.get('ea_rows', null) || { hide: {}, order: [] }, t = pr.order, i = r.i;
    if (r.a === 'tog') pr.hide[t[i]] = !pr.hide[t[i]] ? 1 : 0;
    else if (r.a === 'up' && i > 0) { var x = t[i]; t[i] = t[i - 1]; t[i - 1] = x; i--; }
    else if (r.a === 'dn' && i < t.length - 1) { var y = t[i]; t[i] = t[i + 1]; t[i + 1] = y; i++; }
    store.set('ea_rows', pr); state.rowsDirty = true; openRows({ i: i, a: r.a });
  }
  function addAddon(url, name) {
    var l = addonList().filter(function (x) { return x.url !== url; }); l.unshift({ url: url, name: name || hostOf(url) }); store.set('ea_addons', l.slice(0, 8));
  }
  // ---- Settings -> Extra sources (all optional) ----
  function paintExtras() {
    var box = $('setExtra'); if (!box) return; box.innerHTML = '';
    var d = debridCfg(), l = addonList(), c = cineproUrl();
    [['debrid', 'Debrid service', d ? debridName(d.p) + ' · connected' : 'None'], ['addons', 'Add-ons (Stremio / Nuvio)', l.length ? l.length + ' added' : 'None'], ['cinepro', 'CinePro Core server', c ? hostOf(c) : 'None']].forEach(function (r) {
      var b = el('button', 'setr focusable', '<span>' + r[1] + '</span><b>' + esc(r[2]) + '</b>'); b.__x = r[0]; box.appendChild(b);
    });
  }
  function closeExtra() { clearInterval(state.xPoll); state.xPoll = null; $('setXBox').className = 'hidden'; $('setXBox').innerHTML = ''; state.xk = null; paintExtras(); }
  function openExtra(kind) {
    var box = $('setXBox'); clearInterval(state.xPoll); state.xk = kind; state.xProv = (debridCfg() || { p: 'rd' }).p;
    var h = '';
    if (kind === 'debrid') {
      h = '<p class="hint">Use your own debrid account to play torrent entries that your add-ons list. The key stays on this device and is sent with each request; our server never stores it. Only files the service already has cached play.</p>' +
        '<button id="xProv" class="btn focusable"></button><input id="xKey" class="focusable" type="text" placeholder="API key" autocomplete="off" spellcheck="false">' +
        '<div class="setrow"><button id="xSave" class="btn primary focusable">Save and check</button><button id="xPhone" class="btn focusable">Send from phone</button><button id="xRemove" class="btn focusable">Remove</button><button id="xClose" class="btn focusable">Close</button></div>';
    } else if (kind === 'addons') {
      h = '<p class="hint">Stremio and Nuvio add-ons both work: paste the add-on\'s address (the link that ends in manifest.json). Add-ons are optional extra sources and are never required to play anything.</p><div id="xList"></div>' +
        '<input id="xUrl" class="focusable" type="text" placeholder="https://your-addon.example/manifest.json" autocomplete="off" spellcheck="false">' +
        '<div class="setrow"><button id="xSave" class="btn primary focusable">Add</button><button id="xPhone" class="btn focusable">Send from phone</button><button id="xClose" class="btn focusable">Close</button></div>';
    } else {
      h = '<p class="hint">CinePro Core is an open-source streaming API that you (or someone you trust) host. Enter its address, for example https://cinepro.example. It is an optional extra source.</p>' +
        '<input id="xUrl" class="focusable" type="text" placeholder="https://your-cinepro.example" autocomplete="off" spellcheck="false">' +
        '<div class="setrow"><button id="xSave" class="btn primary focusable">Save</button><button id="xPhone" class="btn focusable">Send from phone</button><button id="xRemove" class="btn focusable">Remove</button><button id="xClose" class="btn focusable">Close</button></div>';
    }
    box.innerHTML = h + '<div id="xInfo" class="hint"></div><div id="xQr"></div>'; box.className = '';
    if (kind === 'debrid') { paintProv(); $('xKey').value = ''; setFocus($('xKey')); }
    else { if (kind === 'addons') paintAddonList(); else $('xUrl').value = cineproUrl(); setFocus($('xUrl')); }
  }
  function paintProv() { $('xProv').textContent = 'Service: ' + debridName(state.xProv); }
  function paintAddonList() {
    var l = addonList(), box = $('xList'); box.innerHTML = '';
    l.forEach(function (x, i) { var b = el('button', 'setr focusable', '<span>' + esc(x.name) + '</span><b>Remove</b>'); b.__xdel = i; box.appendChild(b); });
  }
  function xmsg(t) { var i = $('xInfo'); if (i) i.textContent = t; toast(t); }
  function saveExtra() {
    var k = state.xk;
    if (k === 'debrid') {
      var key = $('xKey').value.trim(); if (key.length < 8) { xmsg('Paste your API key first'); return; }
      xmsg('Checking the key…');
      api({ action: 'debrid_check' }, { headers: { 'x-debrid': state.xProv + ':' + key } }).then(function (r) {
        store.set('ea_debrid', { p: state.xProv, k: key });
        xmsg(debridName(state.xProv) + ' connected' + (r.user ? ' as ' + r.user : '') + (r.premium === false ? ' — but the account is not premium' : ''));
        $('xKey').value = ''; paintExtras();
      }).catch(function (e) { xmsg('Could not use that key: ' + e.message); });
    } else if (k === 'addons') {
      var u = $('xUrl').value.trim(); if (!/^(https?|stremio):\/\/\S+$/i.test(u)) { xmsg('Enter the add-on address (https://…/manifest.json)'); return; }
      xmsg('Checking the add-on…');
      api({ action: 'addon_check', url: u }).then(function (r) {
        if (r.streams === false) { xmsg((r.name || 'That add-on') + ' does not provide streams'); return; }
        addAddon(u, r.name); $('xUrl').value = ''; paintAddonList(); paintExtras();
        xmsg(r.name + ' added' + (r.config ? ' (it may need configuring on its own page first)' : ''));
      }).catch(function (e) { xmsg('Could not use that add-on: ' + e.message); });
    } else {
      var c = $('xUrl').value.trim();
      if (!/^https?:\/\/\S+$/i.test(c)) { xmsg('Enter the server address (https://…)'); return; }
      store.set('ea_cinepro', c); paintExtras(); xmsg('CinePro Core saved');
    }
  }
  function removeExtra() {
    if (state.xk === 'debrid') { store.set('ea_debrid', null); xmsg('Debrid service removed'); }
    else if (state.xk === 'cinepro') { store.set('ea_cinepro', ''); $('xUrl').value = ''; xmsg('CinePro Core removed'); }
    if (state.mvia === 'addon' && !hasExtra()) { state.mvia = 'auto'; store.set('ea_msrc', 'auto'); }
    paintExtras();
  }
  function phoneExtra() {                                                          // like the IPTV "Add with your phone": scan the QR, type there, it arrives here
    var kind = state.xk; clearInterval(state.xPoll); $('xInfo').textContent = 'Getting a code…';
    api({ action: 'pair_start' }).then(function (p) {
      if (state.xk !== kind) return;
      $('xInfo').textContent = 'On your phone open ' + p.url.replace(/^https?:\/\//, '') + ' and enter the code ' + p.code + ' (or scan the QR code), then choose ' + (kind === 'debrid' ? 'Debrid key' : kind === 'addons' ? 'Add-on' : 'CinePro') + '.';
      if (EA.qr) EA.qr($('xQr'), p.url + '?code=' + p.code);
      var until = Date.now() + p.expiresIn * 1000;
      state.xPoll = setInterval(function () {
        if (Date.now() > until) { clearInterval(state.xPoll); $('xInfo').textContent = 'The code expired. Press Send from phone again.'; return; }
        api({ action: 'pair_poll', code: p.code }).then(function (x) {
          if (x.status === 'expired') { clearInterval(state.xPoll); $('xInfo').textContent = 'The code expired. Press Send from phone again.'; return; }
          if (x.status !== 'ok' || !x.playlist) return;
          clearInterval(state.xPoll); var d = x.playlist;
          if (d.type === 'debrid') { store.set('ea_debrid', { p: d.p, k: d.k }); xmsg(debridName(d.p) + ' key received'); }
          else if (d.type === 'addon') { addAddon(d.url, hostOf(d.url)); xmsg('Add-on received'); if (state.xk === 'addons') paintAddonList(); }
          else if (d.type === 'cinepro') { store.set('ea_cinepro', d.url); xmsg('CinePro Core received'); }
          paintExtras();
        }).catch(function () {});
      }, 3000);
    }).catch(function (e) { $('xInfo').textContent = e.message; });
  }
  function saveCustomSource() {
    var n = $('setCustomName').value.trim(), u = $('setCustomUrl').value.trim();
    if (!u) { store.set('ea_custom_src', null); if (state.mvia === 'custom') { state.mvia = 'auto'; store.set('ea_msrc', 'auto'); } toast('Custom player removed'); }
    else if (!/^https?:\/\/\S+$/i.test(u) || !/\{(imdb|tmdb|id)\}/.test(u)) { toast('The address must start with http(s):// and contain {imdb} or {tmdb}'); return; }
    else { store.set('ea_custom_src', { name: n || 'Custom', url: u }); toast('Custom player saved — pick it under Source on a movie page'); }
    $('setCustomBox').className = 'hidden'; paintSettingsApp(); setFocus($('setApp').lastChild);
  }
  function resetAppSettings() {
    APPSET.forEach(function (row) { try { localStorage.removeItem(row[0]); } catch (e) { /* ignore */ } });
    ['ea_custom_src', 'ea_adseen', 'ea_lite', 'ea_subpos', 'ea_subsize', 'ea_live_set'].forEach(function (k) { try { localStorage.removeItem(k); } catch (e) { /* ignore */ } });
    state.audioPref = 'sub'; state.mq = 'auto'; applyAccent(); applySubStyle(); paintSettingsApp(); paintSetSubs(); toast('Settings reset (playlists, favorites and progress are kept)');
  }
  function paintSetSubs() {
    $('setSubPos').innerHTML = 'Position: ' + SUBPOS[subPos()]; $('setSubSize').innerHTML = 'Size: ' + optName(SUBSIZE, subSize());
    $('setLite').innerHTML = (LITE ? '✔ Lite mode: On' : '✕ Lite mode: Off');
  }
  var SPEEDS = [0.75, 1, 1.25, 1.5, 2];
  function menuRows() {
    var opts = qualityOptions(), qi = curQualityIndex(opts);
    var movie = isVid(state.anime);
    var vias = movie ? srcOpts().map(function (o) { return o[0]; }) : SOURCES, cur = movie ? (state.mvia || 'auto') : (state.via || 'auto'), vi = Math.max(0, vias.indexOf(cur));
    var names = movie ? (function () { var n = {}; srcOpts().forEach(function (o) { n[o[0]] = o[1]; }); return n; })() : SRC_NAMES;
    function srcLabel(k) {                                          // SourceIQ status: Recommended / Reliable / Untested / Temporarily unavailable
      if (movie) return names[k] || k;
      if (k === 'auto') return 'Auto · ' + (SRC_NAMES[iq.order(SRC_KEYS)[0]] || 'AnimeX') + ' first';
      var st = iq.status(k, SRC_KEYS); return (SRC_NAMES[k] || k) + (st && st.short ? ' · ' + st.short : '');
    }
    var srcRow = { key: 'source', label: 'Source', value: srcLabel(vias[vi]),
      change: function (dir) {
        var nv = vias[(vi + dir + vias.length) % vias.length];
        if (movie) { state.mvia = nv; store.set('ea_msrc', nv); } else state.via = nv;
        var at = state.embed ? (isCin() ? cinNow() : 0) : video.currentTime; toast('Source: ' + srcLabel(nv));
        closeMenu(); state.oldTry = false; play(state.anime, state.ep, at > 5 ? at : 0, true);
      } };
    var posRow = { key: 'subpos', label: 'Subtitle position', value: SUBPOS[subPos()],
      change: function (dir) { setSubPos(Math.max(0, Math.min(SUBPOS.length - 1, subPos() - dir))); } };    // Right = lower
    var syncRow = { key: 'sync', label: 'Subtitle sync', value: (state.os.off >= 0 ? '+' : '') + state.os.off.toFixed(1) + 's',
      change: function (dir) { state.os.userPick = true; state.os.off = Math.max(-15, Math.min(15, Math.round((state.os.off + dir * 0.5) * 10) / 10)); } };
    function subRow() {
      var so = subOptions(), loading = state.os.osLoading && !state.os.osLoaded;
      return { key: 'subs', label: 'Subtitles', value: so.opts[so.cur].label + (loading ? ' · loading…' : ''),
        change: function (dir) {
          if (!state.os.osLoaded && !state.os.osLoading) { osFetchList(); toast('Fetching OpenSubtitles…'); }
          var n = (so.cur + dir + so.opts.length) % so.opts.length; so.opts[n].apply();
        } };
    }
    function fileRow() {                                              // which file of the chosen language (OpenSubtitles #1..#n / stream track)
      var o = state.os; if (o.idx < 0) return null;
      var lang = o.items[o.idx].lang, group = itemsOf(lang); if (group.length < 2) return null;
      var pos = group.indexOf(o.idx), it = o.items[o.idx];
      return { key: 'file', label: 'Subtitle file', value: (it.short || it.label) + ' (' + (pos + 1) + '/' + group.length + ')',
        change: function (dir) { o.userPick = true; o.off = 0; var ni = group[(pos + dir + group.length) % group.length]; subSelect(ni); rememberSub(ni); } };
    }
    if (movie && state.embed) {
      if (state.embedKind === 'vidcore') return isCin() ? [srcRow, subRow(), fileRow(), syncRow, posRow,
        { key: 'q', label: 'Quality', value: 'Auto (up to 4K)', change: function () { toast(state.embedName + ' picks quality automatically'); } }] : [srcRow,
        { key: 'subs', label: 'Subtitles', value: "Use player's CC", change: function () { toast(state.embedName + ' has its own subtitle button inside the player'); } },
        { key: 'q', label: 'Quality', value: 'Auto (up to 4K)', change: function () { toast(state.embedName + ' picks quality automatically'); } }];
      return [srcRow, subRow(), fileRow(), syncRow, posRow,
        { key: 'q', label: 'Quality', value: optName(MOVIE_QUALITIES, String(state.mq)),
          change: function (dir) {
            var qs = MOVIE_QUALITIES.map(function (o) { return o[0]; }), n = qs[(qs.indexOf(String(state.mq)) + dir + qs.length) % qs.length];
            state.mq = n; store.set('ea_mq', n); var at = cinNow(); closeMenu(); toast('Quality: ' + optName(MOVIE_QUALITIES, n)); play(state.anime, state.ep, at > 5 ? at : 0, true);
          } }];
    }
    var rows = [
      { key: 'quality', label: 'Quality', value: opts.length ? opts[qi].label : 'Single stream',
        change: function (dir) { if (opts.length < 2) { toast('This source has a single quality'); return; }
          var n = (qi + dir + opts.length) % opts.length; opts[n].apply(); store.set(movie ? 'ea_mq' : 'ea_q', String(opts[n].pref)); setQualityLabel(); toast('Quality: ' + opts[n].label); } }
    ];
    if (!movie) rows.push({ key: 'audio', label: 'Audio', value: audioCur() === 'dub' ? 'English (dub)' : 'Japanese (sub)', change: function () { setAudio(audioCur() === 'dub' ? 'sub' : 'dub'); } });
    rows.push(subRow());
    var fr = fileRow(); if (fr) rows.push(fr);
    if (state.os.idx >= 0) rows.push(syncRow);
    rows.push(posRow);
    rows.push({ key: 'speed', label: 'Speed', value: (state.speed || 1) + '×', change: function (dir) {
      var i = Math.max(0, SPEEDS.indexOf(state.speed || 1)); state.speed = SPEEDS[(i + dir + SPEEDS.length) % SPEEDS.length]; video.playbackRate = state.speed; } });
    rows.push(srcRow);
    return rows;
  }
  function renderMenu() {
    var rows = menuRows().filter(Boolean), box = $('mrows'); box.innerHTML = '';
    if (state.menuIdx >= rows.length) state.menuIdx = rows.length - 1;
    state.menuRows = rows;
    rows.forEach(function (r, i) {
      var d = el('div', 'mrow' + (i === state.menuIdx ? ' sel' : ''), '<span class="ml">' + esc(r.label) + '</span><span class="mv">◀ ' + esc(r.value) + ' ▶</span>');
      d.onclick = function () { state.menuIdx = i; r.change(1); if (!$('pmenu').className.match(/hidden/)) renderMenu(); };
      box.appendChild(d);
    });
  }
  function openMenu() { state.menuIdx = Math.min(state.menuIdx || 0, 6); if (!state.os.osLoaded && !state.os.osLoading && state.anime) osFetchList(); state.menuOpen = true; $('pmenu').className = ''; renderMenu(); hud(); clearTimeout(state.hudTimer); }
  function closeMenu() { state.menuOpen = false; $('pmenu').className = 'hidden'; hud(); }
  function menuKey(k) {
    var n = state.menuRows.length;
    if (k === KEY.UP) state.menuIdx = (state.menuIdx + n - 1) % n;
    else if (k === KEY.DOWN) state.menuIdx = (state.menuIdx + 1) % n;
    else if (k === KEY.LEFT) state.menuRows[state.menuIdx].change(-1);
    else if (k === KEY.RIGHT || k === KEY.ENTER) state.menuRows[state.menuIdx].change(1);
    else if (k === KEY.PLAY || k === KEY.PAUSE || k === KEY.PLAYPAUSE) { if (!state.embed) togglePlay(); return; }   // media keys never close the menu
    else return;                                                                  // only Back closes it
    if (state.menuOpen) renderMenu();
  }
  function startVideo(d, startAt, tk) {
    clearTracks();
    state.src = d; state.pPlay = { key: d.key, t0: performance.now(), ok: false, failed: false }; qInit(); state.playFail = false; guardStart(); state.triedProxy = false; state.startAt = startAt; state.qIdx = 0; state.menuOpen = false; $('pmenu').className = 'hidden';
    // Subtitle tracks from the stream are fetched through the API (CORS-open) and drawn by our overlay (exact sync)
    state.srcAudio = d.audio || 'sub';
    subSetStream(d.subtitles || []);
    subAuto();
    startSubLoop();
    state.hasSoftSubs = !!(d.subtitles && d.subtitles.length);
    if (state.hasSoftSubs) osFetchList(function () { subAuto(); });
    var isHls = d.type === 'hls' || /m3u8/i.test(d.url);
    if (isHls && window.Hls && Hls.isSupported() && !(window.AVP && AVP.use())) {   // Samsung AVPlay (avp.js) plays HLS itself
      state.hls = newHls();
      state.hls.loadSource(d.url);
      state.hls.attachMedia(video);
      state.netRetry = 0; state.mediaRetry = 0;
      state.hls.on(Hls.Events.ERROR, function (_, e) {                       // self-heal before giving up
        if (!e.fatal) return;
        if (e.type === Hls.ErrorTypes.NETWORK_ERROR && state.netRetry++ < 3) { state.hls.startLoad(); return; }
        if (e.type === Hls.ErrorTypes.MEDIA_ERROR && state.mediaRetry++ < 3) { state.hls.recoverMediaError(); return; }
        if (!fallbackToProxy() && !streamDead()) showPlayFail(e.details || 'playback error', video.currentTime);
      });
    } else {
      video.src = d.url; // native HLS (Tizen/Safari) or mp4
    }
    video.onloadedmetadata = function () {
      if (startAt > 5 && startAt < video.duration - 30) video.currentTime = startAt;
    };
    setQualityLabel();
    var pr = video.play(); if (pr && pr.catch) pr.catch(function () { pmsg('Press Enter / Space to play', false); });
    clearTimeout(state.startTimer);                                          // never started after 25s: other route, then next source
    state.startTimer = setTimeout(function startCheck() {
      if (tk !== state.token || state.view !== 'player' || video.paused || video.readyState >= 3 || video.currentTime > 0.5) return;
      if (fallbackToProxy()) { toast('Slow source — switching route'); state.startTimer = setTimeout(startCheck, 20000); } else streamDead();
    }, 25000);
  }
  video.addEventListener('playing', function () {
    if (state.liveOn) return;
    clearTimeout(state.waitTimer); pmsg('', false); paintPlayBtn();
    if (state.pq && state.pq.waitAt) { state.pq.stallMs += Date.now() - state.pq.waitAt; state.pq.waitAt = 0; }
    var p = state.pPlay;
    if (p && !p.ok && p.key && state.anime && !isVid(state.anime)) { p.ok = true; iq.recordPlay(p.key, true, performance.now() - p.t0); }      // time to first frame
  });
  video.addEventListener('pause', function () { if (state.liveOn) return; paintPlayBtn(); hud(); });
  video.addEventListener('waiting', function () {
    if (state.liveOn) return;
    pmsg('', true);
    if (state.pq && state.pPlay && state.pPlay.ok && !state.pq.waitAt && !video.seeking) { state.pq.stalls++; state.pq.waitAt = Date.now(); }       // a stall (not a seek)
    clearTimeout(state.waitTimer);                                           // stalled for 15s -> try the server relay once
    state.waitTimer = setTimeout(function () { if (state.view === 'player' && video.readyState < 3 && !video.paused) { if (fallbackToProxy()) toast('Slow connection — switching route'); } }, 15000);
  });
  video.addEventListener('volumechange', function () { store.set('ea_vol', { v: video.volume, m: video.muted }); });
  // Look up the next episode's stream while this one plays, so "next episode" starts instantly
  function sourceParams(a, ep) {
    return { action: 'sources', via: state.via || 'auto', audio: state.audioPref === 'dub' ? 'dub' : '', id: a.id, title: a.title, alt: a.titleRomaji || '', syn: (a.synonyms || []).join('|'), ep: ep, skip: '', order: iqOrder() };
  }
  function abortSources() {                         // leaving a search / episode: stop work nobody is waiting for
    if (state.srcCtl) { try { state.srcCtl.abort(); } catch (e) {} state.srcCtl = null; }
  }
  function dropPrefetch() {
    if (state.pre && state.pre.ctl) { try { state.pre.ctl.abort(); } catch (e) {} }
    state.pre = null;
  }
  function prefetchNext() {
    var a = state.anime; if (!a || isVid(a) || (a.episodes && state.ep >= a.episodes)) return;
    var key = a.id + ':' + (state.ep + 1) + ':' + state.audioPref + ':' + (state.via || 'auto');
    if (state.pre && state.pre.key === key) return;
    var ctl = window.AbortController ? new AbortController() : null;
    var p = api(sourceParams(a, state.ep + 1), { signal: ctl && ctl.signal }); p.catch(function () {});
    state.pre = { key: key, p: p, at: Date.now(), ctl: ctl };
  }
  function takePrefetch(a, ep) {
    var pre = state.pre, key = a.id + ':' + ep + ':' + state.audioPref + ':' + (state.via || 'auto');
    if (!pre || pre.key !== key || state.srcSkip.length || Date.now() - pre.at > 10 * 60000) return null;   // older links may be stale
    state.pre = null; return pre.p;
  }
  // This source's stream does not play here: ask the server for the next source (Auto mode only)
  function nextSource() {
    var d = state.src, a = state.anime;
    if (!d || !d.key || !a || isVid(a) || (state.via && state.via !== 'auto') || state.srcSkip.length >= 12) return false;
    var at = video.currentTime > 5 ? video.currentTime : state.startAt;
    toast('That source did not play — trying the next one');
    play(a, state.ep, at, true, state.srcSkip.concat([d.key]));
    return true;
  }
  // If the direct link fails in this viewer's browser/TV, retry once through our own server
  function fallbackToProxy() {
    var d = state.src;
    if (!d || !d.proxyUrl || state.triedProxy || d.proxyUrl === d.url) return false;
    state.triedProxy = true;
    pmsg('Switching route…', true);
    var at = video.currentTime > 5 ? video.currentTime : state.startAt;
    state.startAt = at;
    if (state.hls) { state.hls.destroy(); state.hls = null; }
    if (/m3u8/i.test(d.proxyUrl) || d.type === 'hls') {
      if (window.Hls && Hls.isSupported()) { state.hls = newHls(); state.hls.loadSource(d.proxyUrl); state.hls.attachMedia(video); }
      else video.src = d.proxyUrl;
    } else video.src = d.proxyUrl;
    var pr = video.play(); if (pr && pr.catch) pr.catch(function () {});
    return true;
  }
  // ---- Playback guard: a stream that stalls, freezes or shows no picture is noticed within seconds and recovered step by step, and a final failure always leaves a visible message and choices ----
  //   1) re-fetch / recover in place   2) switch route (server relay)   3) next source (SourceIQ marks this one)   4) a clear panel: OK = retry, Up = choose another source, Back = leave
  var guard = { timer: null, last: -1, moveAt: 0, rung: 0, calm: 0, startAt: 0 };
  function guardStart() { clearInterval(guard.timer); guard.last = -1; guard.moveAt = Date.now(); guard.rung = 0; guard.calm = 0; guard.startAt = Date.now(); guard.timer = setInterval(guardTick, 2000); }
  function guardStop() { clearInterval(guard.timer); guard.timer = null; }
  function guardTick() {
    if (state.view !== 'player' || state.liveOn || state.embed || !state.src || state.oldEng || state.playFail) return;
    var now = Date.now(), t = video.currentTime;
    if (video.paused || video.seeking || state.menuOpen) { guard.moveAt = now; guard.last = t; return; }       // the viewer paused or is seeking
    if (Math.abs(t - guard.last) > 0.05) {                                                                      // the picture is moving
      guard.last = t; guard.moveAt = now; guard.calm += 2000;
      if (guard.calm > 20000) guard.rung = 0;                                                                   // healthy for 20 s: the next problem starts again at step 1
      var blind = !(window.AVP && AVP.active()) && state.pPlay && state.pPlay.ok && video.videoWidth === 0 && video.videoHeight === 0 && now - guard.startAt > 9000;   // sound but no picture
      if (blind && !guard.blindAt) guard.blindAt = now;
      if (blind && now - guard.blindAt > 8000) { guard.blindAt = 0; guardEscalate('no picture'); }
      if (!blind) guard.blindAt = 0;
      return;
    }
    guard.last = t; guard.calm = 0;
    var limit = state.pPlay && state.pPlay.ok ? 12000 : 30000;                                                   // frozen while playing / never started
    if (now - guard.moveAt > limit) { guard.moveAt = now; guardEscalate(state.pPlay && state.pPlay.ok ? 'stalled' : 'did not start'); }
  }
  function guardEscalate(why) {
    var r = guard.rung++, at = video.currentTime > 5 ? video.currentTime : state.startAt;
    if (r === 0 && state.hls) {                                              // 1) in place
      toast('Reconnecting…');
      try { if (why === 'no picture') state.hls.recoverMediaError(); else state.hls.startLoad(); } catch (e) { /* ignore */ }
      var pr = video.play(); if (pr && pr.catch) pr.catch(function () {}); return;
    }
    if (r <= 1 && fallbackToProxy()) { toast('Trying another route…'); return; }                               // 2) route
    if (r <= 2 && streamDead()) return;                                                                         // 3) next source (Auto), SourceIQ remembers
    showPlayFail(why, at);                                                                                      // 4) never a silent black screen
  }
  function showPlayFail(why, at) {
    guardStop(); playFailed(); state.playFail = true; state.failAt = at || 0; $('spinner').className = '';
    pmsg('Playback stopped (' + why + ').   OK: try again   ·   Up: choose another source   ·   Back: leave', false); hud();
  }
  function retryPlay() {
    state.playFail = false; var a = state.anime; if (!a) return;
    pmsg('Trying again…', true); state.srcSkip = []; state.triedProxy = false;
    play(a, state.ep, state.failAt || 0, true, []);
  }
  video.addEventListener('error', function () {
    if (state.liveOn || !video.getAttribute('src')) return;
    if (!fallbackToProxy() && !streamDead()) showPlayFail('the stream could not be played', video.currentTime);
  });
  video.addEventListener('progress', function () {
    if (state.liveOn) return;
    if (video.duration && video.buffered.length) $('seekBuf').style.width = video.buffered.end(video.buffered.length - 1) / video.duration * 100 + '%';
  });
  video.addEventListener('timeupdate', function () {
    if (state.liveOn) return;                                                  // live TV: infinite duration, nothing to save
    var d = video.duration, t = video.currentTime;
    if (state.pq) { var dt = t - state.pq.lastT; if (state.pq.lastT >= 0 && dt > 0 && dt < 2.5) state.pq.played += dt; state.pq.lastT = t; var qh = qHeight(); if (qh) state.pq.h = qh; }
    if (d) $('seekBar').style.width = t / d * 100 + '%';
    $('pTime').textContent = fmt(t) + ' / ' + fmt(d);
    if (Date.now() - state.lastSave > 5000 && t > 3 && d) { state.lastSave = Date.now(); setProg(state.anime, state.ep, t, d); alMaybeUpdate(state.anime, state.ep, t, d); }
    updateSkip(t);
    if (d && t > d * 0.6 && t > 60) prefetchNext();
  });
  // Skip intro / outro (AniSkip timestamps)
  function updateSkip(t) {
    var sk = state.skip, b = $('skipBtn'), hit = null;
    if (sk && sk.op && t >= sk.op.start - 1 && t < sk.op.end - 1) hit = { to: sk.op.end, label: 'Skip Intro' };
    else if (sk && sk.ed && t >= sk.ed.start - 1 && t < sk.ed.end - 1) hit = { to: sk.ed.end, label: 'Skip Outro' };
    if (hit && store.get('ea_autoskip', false) === true && state.skipTo !== hit.to) { state.skipTo = hit.to; video.currentTime = hit.to; toast(hit.label + ' skipped'); return; }      // Settings: skip automatically
    if (hit) { state.skipTo = hit.to; b.innerHTML = hit.label + ' ' + ic('next'); if (b.className !== 'skipbtn show') b.className = 'skipbtn show'; }
    else if (b.className !== 'skipbtn hidden') b.className = 'skipbtn hidden';
  }
  function doSkip() { if (state.skipTo) { video.currentTime = state.skipTo; $('skipBtn').className = 'skipbtn hidden'; hud(); } }
  video.addEventListener('ended', function () {
    if (state.liveOn) return;
    var a = state.anime;
    if (isVid(a)) { embedEnded(); return; }
    if (a.episodes && state.ep >= a.episodes) { setProg(a, state.ep, 0, 0); autoStatus(a, state.ep, true); closePlayer(); toast('Series finished — marked Completed'); return; }
    setProg(a, state.ep + 1, 0, 0);
    if (store.get('ea_autonext', true) === false) { closePlayer(); toast('Episode finished'); return; }       // Settings: play the next episode automatically
    play(a, state.ep + 1, 0);
  });
  function stopVideo() {
    guardStop(); flushQuality(false);
    if (state.hls) { state.hls.destroy(); state.hls = null; }
    try { video.pause(); video.removeAttribute('src'); video.load(); } catch (e) {}
    clearTracks();
    $('seekBar').style.width = '0'; $('seekBuf').style.width = '0';
  }
  function closePlayer() {
    if (EA.sponsor) EA.sponsor.hidePause();
    state.token++; abortSources(); dropPrefetch(); state.menuOpen = false; $('pmenu').className = 'hidden'; $('skipBtn').className = 'skipbtn hidden'; hideEmbed();
    if (video.duration && video.currentTime > 3) setProg(state.anime, state.ep, video.currentTime, video.duration);
    stopVideo();
    if (document.fullscreenElement && document.exitFullscreen) { try { document.exitFullscreen(); } catch (e) {} }
    $('player').className = 'hidden';
    state.view = 'detail';
    paintDetailButtons(); renderEpisodes();
    var cur = $('dEps').querySelector('.cur');
    setFocus(cur || $('dPlay'));
  }
  function seek(sec) { if (video.duration) { video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + sec)); } toast((sec > 0 ? '+' : '') + sec + 's'); hud(); }
  function togglePlay() { if (video.paused) { var p = video.play(); if (p && p.catch) p.catch(function () {}); } else video.pause(); hud(); }
  function stepEp(d) {
    var a = state.anime, n = state.ep + d;
    if (a.kind === 'movie') return;
    if (isTv(a)) { n = tvStep(a, state.ep, d); if (!n) { toast(d > 0 ? 'This is the last episode' : 'This is the first episode'); return; } play(a, n, 0); return; }
    if (n < 1 || (a.episodes && n > a.episodes)) { toast(d > 0 ? 'This is the last episode' : 'This is the first episode'); return; }
    play(a, n, 0);
  }
  function toggleCC() {
    var so = subOptions();
    if (so.opts.length < 2) { toast(state.os.osLoading ? 'Looking for subtitles…' : 'English subtitles are built into this video'); if (!state.os.osLoaded) osFetchList(); return; }
    var n = so.cur === 0 ? Math.max(1, store.get('ea_lastsub', 1)) : 0;
    so.opts[n].apply(); if (n > 0) store.set('ea_lastsub', n);
    if (n === 0) toast('Subtitles off');
  }
  function toggleFS() {
    var p = $('player');
    if (document.fullscreenElement) document.exitFullscreen();
    else if (p.requestFullscreen) p.requestFullscreen();
  }
  function playerAct(a) {
    ({ back: closePlayer, toggle: togglePlay, rew: function () { seek(-10); }, ff: function () { seek(10); },
       prev: function () { stepEp(-1); }, next: function () { stepEp(1); }, cc: toggleCC, fs: toggleFS, menu: function () { state.menuOpen ? closeMenu() : openMenu(); } })[a]();
  }
  $('embedCtl').addEventListener('click', function (e) {
    var b = up(e.target, 'ectl'); if (!b) return;
    var a = b.getAttribute('data-ec');
    if (a === 'seek') {                                                  // click on the bar = jump there
      var c = state.cin, r = b.getBoundingClientRect();
      if (c.d && (state.embedKind === 'cinesrc' || c.live)) { var t = Math.max(0, Math.min(c.d - 5, (e.clientX - r.left) / r.width * c.d)); c.t = t; c.stamp = performance.now(); cinSend('seek', [t]); }
      paintEbar(); return;
    }
    ebarAct(a);
  });
  $('player').addEventListener('mousemove', function () { if (state.embed && !state.menuOpen) showEbar(); });
  $('player').addEventListener('click', function (e) {
    if (e.target.id === 'skipBtn' || up(e.target, 'skipbtn')) { doSkip(); return; }
    var b = up(e.target, 'pbtn');
    if (b) { playerAct(b.getAttribute('data-act')); return; }
    if (e.target.id === 'seek' || e.target.parentNode.id === 'seek') {
      var r = $('seek').getBoundingClientRect();
      if (video.duration) video.currentTime = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * video.duration;
      hud(); return;
    }
    if (state.menuOpen && !up(e.target, 'mrow') && e.target.id !== 'pmenu' && !up(e.target, 'pmenu') && !up(e.target, 'pbtn')) { closeMenu(); return; }
    if (e.target === video) togglePlay();
  });
  $('player').addEventListener('mousemove', function () { if (state.view === 'player') hud(); });
  $('player').addEventListener('dblclick', function (e) { if (e.target === video) toggleFS(); });

  // ======================= Spatial navigation =======================
  function setFocus(e, noScroll) {
    if (!e) return;
    var prev = state.focusEl;
    if (prev) prev.className = prev.className.replace(/\s*\bfocused\b/g, '');
    if (document.activeElement && document.activeElement !== e && document.activeElement.tagName === 'INPUT') document.activeElement.blur();
    state.focusEl = e;
    e.className += ' focused';
    if (hasCls(e, 'card')) warmNear(e);
    if (EA.live) EA.live.onFocus(e);
    if (!noScroll) ensureVisible(e);
  }
  function scrollRoot(e) {
    return up(e, 'view') || ($('detail').contains(e) ? $('dScroll') : null);
  }
  function ensureVisible(e) {
    var track = e.parentNode;
    if (track && hasCls(track, 'track')) track.scrollLeft = e.offsetLeft - (track.clientWidth - e.offsetWidth) / 2;
    var root = scrollRoot(e);
    if (!root || up(e, 'tab') || $('nav').contains(e)) return;
    if (up(e, 'row') === null && $('hero').contains(e)) { root.scrollTop = 0; return; }
    // The "camera": scroll only as far as needed to keep the focused card (and its row heading) on screen. The top bar only exists in the Classic look;
    // in the Modern look the nav is a full-height side rail, so it must not be counted as something covering the top of the page.
    var rem = parseFloat(document.documentElement.style.fontSize) || 16;
    var anchor = up(e, 'row') || e, r = anchor.getBoundingClientRect(), er = e.getBoundingClientRect(), vr = root.getBoundingClientRect();
    var barH = root === $('dScroll') || UI_MODERN ? 0 : $('nav').offsetHeight;
    var topSafe = vr.top + barH + rem * 1.2, bottomSafe = vr.bottom - rem * 1.2;
    if (r.top < topSafe) root.scrollTop -= topSafe - r.top;                         // the row heading is above the visible area: bring it back
    else if (er.bottom > bottomSafe) root.scrollTop += Math.min(er.bottom - bottomSafe, Math.max(0, r.top - topSafe));     // the card is cut off below: scroll down just enough (never past the row heading)
  }
  function candidates() {
    var roots = state.view === 'notice' ? [$('notice')] : state.view === 'modal' ? [$('liveModal')] : state.view === 'detail' ? [$('detail')] : [$('nav'), activeView()], out = [];
    roots.forEach(function (r) {
      var all = r.querySelectorAll('.focusable');
      for (var i = 0; i < all.length; i++) out.push(all[i]);
    });
    return out;
  }
  function activeView() { return $(VIEW_OF[state.tab]); }
  function center(e) { var r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, h: r.height }; }
  function move(dir) {
    var cur = state.focusEl;
    if (!cur || !document.body.contains(cur) || cur.offsetParent === null && !$('nav').contains(cur)) {
      var f = candidates()[0]; if (f) setFocus(f); return;
    }
    var c = center(cur), best = null, bestScore = Infinity, nav = $('nav'), inNav = nav.contains(cur);
    if (UI_MODERN && inNav && dir === 'right') {                      // Modern look: the tabs are a side rail, so Right enters the content (the row that is nearest in height)
      var tgt = null, td = Infinity;
      candidates().forEach(function (e) {
        if (nav.contains(e) || e.offsetParent === null) return;
        var r = e.getBoundingClientRect(); if (r.bottom < 0 || r.top > window.innerHeight || r.right < 0) return;
        var d = Math.abs((r.top + r.height / 2) - c.y) + Math.max(0, r.left) * 0.15; if (d < td) { td = d; tgt = e; }
      });
      if (tgt) { setFocus(tgt); return; }
    }
    candidates().forEach(function (e) {
      if (e === cur || e.offsetParent === null && !(e.parentNode && e.parentNode.id === 'tabs')) return;
      var p = center(e), dx = p.x - c.x, dy = p.y - c.y, main, off;
      if (dir === 'left' || dir === 'right') {
        if (Math.abs(dy) > c.h * 0.6) return;            // same row only
        main = dir === 'left' ? -dx : dx; off = Math.abs(dy);
      } else {
        main = dir === 'up' ? -dy : dy; off = Math.abs(dx);
        if (main < 4) return;
      }
      if (main <= 1) return;
      var score = main + off * 3;
      if (score < bestScore) { bestScore = score; best = e; }
    });
    if (UI_MODERN && dir === 'left' && !inNav && (!best || nav.contains(best))) { var at = $('tabs').querySelector('.tab.active') || $('tabs').firstChild; if (at) best = at; }   // Left from the content goes to the current tab, not to whatever sits at the same height
    if (best) setFocus(best);
  }

  function activate(e) {
    if (e.tagName === 'INPUT') { e.focus(); return; }
    if (e.__live && EA.live) { EA.live.activate(e); return; }
    if (e.id && /^live[A-Z]/.test(e.id) && EA.live) { EA.live.activate(e); return; }
    if (e.__tab) { showTab(e.__tab, e.__tab !== 'search'); if (e.__tab === 'search') setFocus($('searchInput')); return; }
    if (e.__stype) { state.smode = e.__stype; paintTypeChips(); $('searchGrid').innerHTML = ''; runSearch(); return; }
    if (e.id === 'heroPlay') { var h = state.hero[state.heroIdx]; if (h) { state.returnFocus = e; var p = progOf(h); state.anime = h;
      if (isTv(h) && !p) { loadTvMeta(h).then(function () { play(h, tvFirst(h)); }, function () { play(h, 1001); }); return; }
      play(h, h.kind === 'movie' ? 1 : (p ? p.ep : 1)); } return; }
    if (e.id === 'heroInfo') { var h2 = state.hero[state.heroIdx]; if (h2) openDetail(h2); return; }
    if (e.id === 'setSave') { store.set('ea_server', $('serverInput').value.trim()); $('setUsing').textContent = 'Currently using: ' + apiBase(); toast('Saved'); state.cache = {}; loadHome(true); return; }
    if (e.id === 'setReset') { store.set('ea_server', ''); $('serverInput').value = ''; $('setUsing').textContent = 'Currently using: ' + apiBase(); toast('Reset to default'); state.cache = {}; loadHome(true); return; }
    if (e.id === 'setTest') { testStreams(); return; }
    if (e.id === 'noticeOk') { hideNotice(false); return; }
    if (e.id === 'noticeNever') { hideNotice(true); return; }
    if (e.id === 'setTips') { store.set('ea_notice_off', !store.get('ea_notice_off', false)); paintTipsBtn(); toast(store.get('ea_notice_off', false) ? 'Startup tips off' : 'Startup tips on'); return; }
    if (e.id === 'retryHome') { loadHome(true); return; }
    if (e.id === 'accLogin') { doAuth('login'); return; }
    if (e.id === 'accRegister') { doAuth('register'); return; }
    if (e.id === 'accLogout') { logout(); return; }
    if (e.id === 'accSync') { syncNow(true); return; }
    if (e.id === 'alLink') { alStartLink(); return; }
    if (e.id === 'alAuto') { store.set('ea_al_auto', !alAutoOn()); renderAniList(); return; }
    if (e.id === 'alUnlink') { alUnlink(); return; }
    if (e.id === 'dAL') { alCycle(); return; }
    if (e.id === 'clearHist') { clearHist(); renderHistory(); toast('History cleared'); setFocus($('clearHist')); return; }
    if (e.id === 'dSrcBtn' || e.id === 'dQBtn') { var dk = e.id === 'dSrcBtn' ? 'src' : 'q'; openDropKey() === dk ? closeDrops(true) : openDrop(dk); return; }
    if (e.__dropval !== undefined) { pickDrop(e.__drop, e.__dropval); return; }
    if (e.id === 'dRemove') { removeProg(keyOf(state.anime)); paintDetailButtons(); renderEpisodes(); toast('Removed from Continue Watching'); setFocus($('dPlay')); return; }
    if (e.id === 'dBack') { closeDetail(); return; }
    if (e.id === 'dPlay') { startFromDetail(); return; }
    if (e.id === 'dList') { toggleList(state.anime); paintDetailButtons(); return; }
    if (e.id === 'dStatus') { var cs = statusOf(state.anime), nx = ST_CYCLE[(ST_CYCLE.indexOf(cs) + 1) % ST_CYCLE.length]; setStatus(state.anime, nx); paintDetailButtons(); toast('Marked ' + ST_LABEL[nx]); return; }
    if (e.__lst !== undefined) { state.lst = e.__lst; renderList(); var again = $('listChips').querySelectorAll('.chip'); for (var q = 0; q < again.length; q++) if (again[q].__lst === e.__lst) setFocus(again[q]); return; }
    if (e.__genre !== undefined) { state.genre = state.genre === e.__genre ? '' : e.__genre; paintChips(); runSearch(); return; }
    if (e.__season !== undefined) { state.tvSeason = e.__season; renderEpisodes(); setFocus($('dRanges').children[e.__season]); return; }
    if (e.__set !== undefined) { if (e.__set === 'custom') editCustomSource(); else cycleAppSetting(e.__set); return; }
    if (e.__feed && EA.feed) { EA.feed.activate(e); return; }
    if (e.__rows) { rowsAct(e.__rows); return; }
    if (e.id === 'setRowsBtn') { openRows(); return; }
    if (e.__p) { profAct(e.__p); return; }
    if (e.id === 'navProf') { EA_PROF.switchTo(); return; }
    if (e.__x) { openExtra(e.__x); return; }
    if (e.__xdel !== undefined) { var al = addonList(); al.splice(e.__xdel, 1); store.set('ea_addons', al); paintAddonList(); paintExtras(); if (!hasExtra() && state.mvia === 'addon') { state.mvia = 'auto'; store.set('ea_msrc', 'auto'); } setFocus($('xUrl')); return; }
    if (e.id === 'xProv') { var pi = 0; DEBRIDS.forEach(function (d, i) { if (d[0] === state.xProv) pi = i; }); state.xProv = DEBRIDS[(pi + 1) % DEBRIDS.length][0]; paintProv(); return; }
    if (e.id === 'xSave') { saveExtra(); return; }
    if (e.id === 'xRemove') { removeExtra(); return; }
    if (e.id === 'xPhone') { phoneExtra(); return; }
    if (e.id === 'xClose') { closeExtra(); setFocus($('setExtra').firstChild); return; }
    if (e.id === 'setCustomSave') { saveCustomSource(); return; }
    if (e.id === 'setCustomCancel') { $('setCustomBox').className = 'hidden'; setFocus($('setApp').lastChild); return; }
    if (e.id === 'setResetAll') { resetAppSettings(); return; }
    if (e.id === 'setSubPos') { setSubPos((subPos() + 1) % SUBPOS.length); paintSetSubs(); return; }
    if (e.id === 'setSubSize') { var zs = SUBSIZE.map(function (x) { return x[0]; }); store.set('ea_subsize', zs[(zs.indexOf(subSize()) + 1) % zs.length]); applySubStyle(); paintSetSubs(); return; }
    if (e.id === 'setLite') { LITE = !LITE; store.set('ea_lite', LITE); document.body.className = bodyCls(); paintSetSubs(); toast('Lite mode ' + (LITE ? 'on' : 'off')); if (!LITE && state.hero.length > 1) setHeroList(state.hero); return; }
    if (e.__range !== undefined) { state.epRange = e.__range; renderEpisodes(); var rs = $('dRanges').children; setFocus(rs[e.__range]); return; }
    if (e.__ep) { play(state.anime, e.__ep); return; }
    if (e.__cont) { state.returnFocus = e; state.anime = e.__anime; play(e.__anime, e.__cont.ep); return; }
    if (e.__anime) { openDetail(e.__anime); }
  }

  function testStreams() {
    var out = $('setOut'); out.textContent = 'Testing every scraper (can take ~30s)…';
    store.set('ea_server', $('serverInput').value.trim());
    $('setUsing').textContent = 'Currently using: ' + apiBase();
    api({ action: 'debug', title: 'Solo Leveling', alt: 'Ore dake Level Up na Ken', ep: 1 }).then(function (d) {
      out.innerHTML = d.providers.map(function (p) {
        return p.ok ? '<span class="ok">✔ ' + esc(p.provider) + '  ' + p.ms + 'ms</span>'
                    : '<span class="bad">✘ ' + esc(p.provider) + ': ' + esc(String(p.error).slice(0, 160)) + '</span>';
      }).join('\n');
    }).catch(function (e) { out.innerHTML = '<span class="bad">Server unreachable: ' + esc(e.message) + '</span>'; });
  }

  // Remove a card from Continue Watching / History (mouse ✕, or Delete / X / red button on the remote)
  function removeCard(c) {
    if (!c) return false;
    var key = keyOf(c.__anime);
    if (c.__cont) { removeProg(key); toast('Removed from Continue Watching'); }
    else if (c.__hist) { removeHist(c.__hist.key || key, c.__hist.ep); toast('Removed from history'); }
    else return false;
    var next = c.nextSibling || c.previousSibling, track = c.parentNode;
    track.removeChild(c);
    if (hasCls(track, 'track') && !track.children.length) { var row = track.parentNode; row.parentNode.removeChild(row); }
    var hm = $('histMsg'); if (c.__hist && !$('histGrid').children.length) hm.textContent = 'Nothing watched yet.';
    setFocus(next || $('heroPlay'));
    return true;
  }

  // ----- first-run notice (controls) with "Don't show again" -----
  function showNotice() {
    state.noticePrev = state.view; state.view = 'notice';
    $('notice').className = ''; setFocus($('noticeOk'));
  }
  function hideNotice(never) {
    if (never) { store.set('ea_notice_off', true); toast('Tips hidden — turn them back on in Settings'); }
    $('notice').className = 'hidden';
    state.view = state.noticePrev && state.noticePrev !== 'notice' ? state.noticePrev : state.tab;
    var f = isHomeTab(state.tab) ? $('heroPlay') : null; if (f) setFocus(f);
  }
  function paintTipsBtn() { var off = store.get('ea_notice_off', false); $('setTips').innerHTML = (off ? '✕ Startup tips: Off' : '✔ Startup tips: On'); }
  function goBack() {
    if (state.liveOn && EA.live) { EA.live.back(); return; }                           // Live TV player: its own Back
    if (state.view === 'notice') { hideNotice(false); return; }
    if (state.view === 'modal' && EA.live) { EA.live.closeModal(); return; }
    if (state.view === 'player' && state.oldEng) { hideOldEng(); closePlayer(); return; }
    if (state.view === 'player' && state.menuOpen) { closeMenu(); return; }          // Back closes the settings menu first
    if (state.view === 'player' && state.embed && state.ebar && state.ebar.open) { hideEbar(); return; }
    if (state.view === 'detail' && anyDropOpen()) { closeDrops(true); return; }
    if (state.view === 'player') closePlayer();
    else if (state.view === 'detail') closeDetail();
    else if (state.tab !== 'home') showTab('home', true);
    else if (IS_TV && window.tizen && tizen.application) tizen.application.getCurrentApplication().exit();
    else if (window.AniNative && AniNative.exit) AniNative.exit();                                   // Android TV / Fire TV app
  }

  document.addEventListener('keydown', function (e) {
    var k = e.keyCode;
    if (EA.live && EA.live.key(e)) return;                                            // Live TV: its own lists, zapping and player keys
    if (state.view === 'player' && state.oldEng) { oldEngKey(e); return; }
    if (state.view === 'player') {
      e.preventDefault();
      if (state.embed && !state.menuOpen && state.ebar && state.ebar.open) {
        if (isBackKey(k)) { state.lastBack = Date.now(); hideEbar(); } else ebarKey(k);
        return;
      }
      if (state.embed && !state.menuOpen) {
        if (k === KEY.DOWN) { showEbar(); return; }
        if (isBackKey(k) || k === KEY.STOP) { state.lastBack = Date.now(); closePlayer(); }
        else if (k === KEY.LEFT || k === KEY.RW) cinSeek(k === KEY.RW ? -30 : -10);
        else if (k === KEY.RIGHT || k === KEY.FF) cinSeek(k === KEY.FF ? 30 : 10);
        else if (isCin() && (k === KEY.ENTER || k === KEY.SPACE || k === KEY.PLAYPAUSE || k === KEY.PLAY || k === KEY.PAUSE)) cinToggle();
        else if (isCin() && k === 404) { var so = subOptions(); so.opts[(so.cur + 1) % so.opts.length].apply(); }
        else if (k === KEY.ENTER) {
          if (OLD_ENGINE && !state.embedHeard) { toast('The player has not started — press Down for controls, Up for Source, Back to exit'); return; }   // focusing a dead frame would swallow the remote
          try { $('embedFrame').focus(); } catch (e) {} toast('Player selected — press Back to exit');
        }
        else if (k === KEY.UP || k === 81 || k === 83 || k === 403 || k === 457) openMenu();
        return;
      }
      if (state.menuOpen) { if (isBackKey(k)) { state.lastBack = Date.now(); closeMenu(); } else menuKey(k); return; }
      if (isBackKey(k) || k === KEY.STOP) { state.lastBack = Date.now(); closePlayer(); }
      else if (k === KEY.ENTER && $('skipBtn').className === 'skipbtn show') doSkip();
      else if (state.playFail && (k === KEY.ENTER || k === KEY.PLAY)) retryPlay();
      else if (k === KEY.ENTER || k === KEY.SPACE || k === KEY.PLAYPAUSE || k === KEY.PLAY || k === KEY.PAUSE) togglePlay();
      else if (k === KEY.LEFT || k === KEY.RW) seek(-10);
      else if (k === KEY.RIGHT || k === KEY.FF) seek(10);
      else if (k === KEY.UP || k === 81 || k === 83 || k === 403 || k === 457) openMenu();      // Up / Q / S / red / info
      else if (k === KEY.DOWN) hud();
      else if (k === 70) toggleFS();
      else if (k === 77) { video.muted = !video.muted; toast(video.muted ? 'Muted' : 'Unmuted'); }
      else if (k === 67 || k === 404) toggleCC();
      else if (k === 78) stepEp(1);
      else if (k === 80) stepEp(-1);
      else hud();
      return;
    }
    var ae = document.activeElement, typing = ae && ae.tagName === 'INPUT';
    if (typing) {
      if (k === KEY.ENTER) { e.preventDefault(); ae.blur(); if (ae.id === 'searchInput') { clearTimeout(state.searchTimer); runSearch(); } return; }
      if (k === KEY.BACK || k === KEY.ESC) { e.preventDefault(); ae.blur(); return; }
      if (k === KEY.DOWN) { e.preventDefault(); ae.blur(); move('down'); }
      else if (k === KEY.UP) { e.preventDefault(); ae.blur(); move('up'); }
      return; // everything else edits the text
    }
    if ((k === 46 || k === 88 || k === 403) && state.focusEl && removeCard(state.focusEl)) { e.preventDefault(); return; }
    switch (k) {
      case KEY.UP: e.preventDefault(); move('up'); break;
      case KEY.DOWN: e.preventDefault(); move('down'); break;
      case KEY.LEFT: e.preventDefault(); move('left'); break;
      case KEY.RIGHT: e.preventDefault(); move('right'); break;
      case KEY.ENTER: e.preventDefault(); if (state.focusEl) activate(state.focusEl); break;
      case KEY.BACK: case KEY.ESC: case KEY.BKSP: case 166: case 461: case 10182: e.preventDefault(); state.lastBack = Date.now(); goBack(); break;
      default:
        // laptop convenience: "/" jumps to search
        if (k === 191 && state.view !== 'detail') { e.preventDefault(); showTab('search'); }
    }
  });

  // Mouse / Magic Remote pointer support
  var lastMouseMove = 0;                                                         // a still cursor under a screen that changed must not steal the remote's focus
  document.addEventListener('mousemove', function () { lastMouseMove = Date.now(); }, true);
  document.addEventListener('mouseover', function (e) {
    if (state.view === 'player' || Date.now() - lastMouseMove > 350) return;
    var f = up(e.target, 'focusable');
    if (f && f !== state.focusEl && f.tagName !== 'INPUT') setFocus(f, true);
  });
  document.addEventListener('click', function (e) {
    if (state.view === 'player') return;
    var rb = up(e.target, 'rowbtn');
    if (rb) { var tr = rb.parentNode.parentNode.parentNode.querySelector('.track'); tr.scrollLeft += parseInt(rb.getAttribute('data-dir'), 10) * tr.clientWidth * 0.8; return; }
    if (state.view === 'detail' && anyDropOpen() && !up(e.target, 'dsopt') && e.target.id !== 'dSrcBtn' && e.target.id !== 'dQBtn' && !up(e.target, 'focusable')) closeDrops(false);
    var cx = up(e.target, 'cx');
    if (cx) { removeCard(up(cx, 'card')); return; }
    var f = up(e.target, 'focusable');
    if (!f) return;
    if (f !== state.focusEl) setFocus(f, true);
    activate(f);
  });
  $('searchInput').addEventListener('input', function () {
    clearTimeout(state.searchTimer);
    state.searchTimer = setTimeout(runSearch, 450);
  });
  ['viewHome', 'viewSearch', 'viewList', 'viewHistory', 'viewAccount', 'viewSettings', 'viewSchedule'].forEach(function (id) {
    $(id).addEventListener('scroll', function () { $('nav').className = this.scrollTop > 40 ? 'solid' : ''; });
  });
  document.addEventListener('visibilitychange', function () { if (document.hidden && state.view === 'player' && !(EA.live && EA.live.playing())) video.pause(); });

  // ======================= Bridge for public/live.js (Live TV) =======================
  var EA = window.EA = { state: state, $: $, el: el, esc: esc, ic: ic, fmt: fmt, store: store, toast: toast, setFocus: setFocus, KEY: KEY, isBackKey: isBackKey, apiBase: apiBase, video: video,
    card: card, keyOf: keyOf, progOf: progOf, getProg: getProg, getHist: getHist, inList: inList, listItem: listItem, openDetail: openDetail, aniQuery: aniQuery, aniMap: aniMap, tname: tname, airIn: airIn, fmtTime: fmtTime, paintAir: paintAir, paintAirBadges: paintAirBadges, makeRow: makeRow, showHero: showHero, refreshDetailTags: refreshDetailTags, ST_LABEL: ST_LABEL, feed: null,
    hasCls: hasCls, up: up, IS_TV: IS_TV, OLD_ENGINE: OLD_ENGINE, CHROME_V: CHROME_V, lite: function () { return LITE; }, showTab: showTab, paintTabs: paintTabs, live: null };

  // ======================= Init =======================
  try {
    if (window.tizen && tizen.tvinputdevice) {
      ['MediaPlayPause', 'MediaPlay', 'MediaPause', 'MediaStop', 'MediaFastForward', 'MediaRewind', 'ColorF0Red', 'ColorF1Green', 'ColorF2Yellow', 'ColorF3Blue', 'Info', 'ChannelUp', 'ChannelDown', '0', '1', '2', '3', '4', '5', '6', '7', '8', '9'].forEach(function (n) {
        try { tizen.tvinputdevice.registerKey(n); } catch (e) {}
      });
    }
  } catch (e) {}
  // Tizen's hardware back event (fires when the key is pressed while an embedded iframe has focus); ignore it if keydown already handled the same press
  document.addEventListener('tizenhwkey', function (e) { if (e.keyName === 'back' && Date.now() - (state.lastBack || 0) > 500) { e.preventDefault && e.preventDefault(); goBack(); } });
  initPlayerIcons();
  applySubStyle(); applyAccent();
  buildChips();
  paintTabs();
  setFocus($('heroPlay'));
  loadHome();
  (function () { var st = store.get('ea_start', 'home'); if (/^(movies|tv|live)$/.test(st)) showTab(st, false); })();                       // Settings: Start on
  if (auth()) syncNow(false);
  if (alAuth() && !alAuth().id) alLoadViewer().then(function () { state.alRowAt = 0; renderContinue(); }).catch(function () {});
  paintProfBtn();
  try { localStorage.removeItem('ea_boot'); } catch (e) { /* ignore */ }                         // started properly: start.js counts starts that never got this far (safe mode)
  var goAl = false; try { goAl = sessionStorage.getItem('ea_al_go') === '1'; sessionStorage.removeItem('ea_al_go'); } catch (e) { /* ignore */ }
  if (goAl) { showTab('account', false); setTimeout(function () { alStartLink(); }, 300); }                    // chosen on the "Connect to your list!" step
  else if (window.EA_SAFE) toast('Safe mode: the app did not start properly three times, so it is using the Classic look and Lite mode. You can change this in Settings.');
  else if (!store.get('ea_notice_off', false)) showNotice();
  window.EA_trim = function () { apiCache = {}; state.hero = state.hero.slice(0, 8); };                          // the Android shell calls this when the system is short of memory
})();
