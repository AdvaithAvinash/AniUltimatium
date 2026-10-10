const VERCEL_API_URL = "https://aniultimatium.advaithavinash404.workers.dev";

(function () {
  'use strict';

  // ======================= Constants & helpers =======================
  var BACKS = [10009, 27, 8, 166, 461, 10182];                       // Tizen Return, Esc, Backspace, browser/webOS back, Exit
  function isBackKey(k) { return BACKS.indexOf(k) > -1; }
  var KEY = { UP: 38, DOWN: 40, LEFT: 37, RIGHT: 39, ENTER: 13, BACK: 10009, ESC: 27, BKSP: 8, SPACE: 32,
              PLAY: 415, PAUSE: 19, PLAYPAUSE: 10252, STOP: 413, FF: 417, RW: 412 };
  var GENRES = ['Action', 'Adventure', 'Comedy', 'Drama', 'Fantasy', 'Horror', 'Mystery', 'Romance', 'Sci-Fi', 'Slice of Life', 'Sports', 'Supernatural'];
  var IS_TV = /Tizen|SMART-?TV|Web0S|NetCast/i.test(navigator.userAgent);
  var ICONS = {
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
    star: 'M12 17.27L18.18 21l-1.64-7.03L22 9.24l-7.19-.61L12 2 9.19 8.63 2 9.24l5.46 4.73L5.82 21z'
  };
  function ic(n) { return '<svg class="ic" viewBox="0 0 24 24"><path d="' + ICONS[n] + '"/></svg>'; }
  function $(id) { return document.getElementById(id); }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function hasCls(e, c) { return (' ' + e.className + ' ').indexOf(' ' + c + ' ') > -1; }
  function up(e, cls) { while (e && e !== document) { if (e.nodeType === 1 && hasCls(e, cls)) return e; e = e.parentNode; } return null; }
  function fmt(t) {
    if (!isFinite(t)) t = 0; t = Math.floor(t);
    var h = Math.floor(t / 3600), m = Math.floor(t % 3600 / 60), s = t % 60;
    return (h ? h + ':' + (m < 10 ? '0' : '') : '') + m + ':' + (s < 10 ? '0' : '') + s;
  }
  var store = {
    get: function (k, d) { try { var v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } },
    set: function (k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch (e) {} }
  };

  document.body.className = IS_TV ? 'tv' : 'desktop';
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
    mode: 'anime', smode: 'anime', speed: 1, audioPref: store.get('ea_audio', 'sub'), srcAudio: 'sub', cache: {}, skip: null, mvia: (function () { var v = store.get('ea_msrc', 'auto'); return /^(auto|vidcore|cinesrc|archive)$/.test(v) ? v : 'auto'; })(), mq: store.get('ea_mq', 'auto')
  };

  // ======================= Persistence =======================
  function keyOf(a) { return (a.kind === 'movie' ? 'm:' : 'a:') + a.id; }
  function slim(a) {
    return { id: a.id, kind: a.kind === 'movie' ? 'movie' : 'anime', mal: a.mal || null, title: a.title, titleRomaji: a.titleRomaji, cover: a.cover, banner: a.banner, color: a.color,
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
    if (had) addDel('l:' + k); else { var it = slim(a); it.key = k; it.ts = nowTs(); l.unshift(it); }
    store.set('ea_list', l); scheduleSync();
    toast(had ? 'Removed from My List' : 'Added to My List');
    return !had;
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
    Object.keys(p).forEach(function (k) { if ((p[k].anime.kind || 'anime') === state.mode) out.push(p[k]); });
    out.sort(function (a, b) { return b.ts - a.ts; });
    return out.slice(0, 20);
  }
  // one-time migration from the older id-keyed progress
  (function migrate() {
    var p = getProg(), changed = false;
    Object.keys(p).forEach(function (k) { if (!/^[am]:/.test(k)) { p['a:' + k] = p[k]; delete p[k]; changed = true; } });
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
      if (state.tab === 'home' || state.tab === 'movies') renderContinue();
      if (state.tab === 'list') renderList();
      if (state.tab === 'history') renderHistory();
    }).catch(function (e) {
      if (/sign in again/i.test(e.message)) { store.set('ea_auth', null); paintTabs(); if (state.tab === 'account') renderAccount(); }
      if (manual) toast('Sync failed: ' + e.message);
    });
  }

  // ======================= API =======================
  // Which backend to use: user-set server (Settings) > the local server that served this page > cloud (Vercel)
  function apiBase() {
    var custom = (store.get('ea_server', '') || '').trim();
    if (custom) return (/^https?:\/\//i.test(custom) ? custom : 'http://' + custom).replace(/\/+$/, '');
    if (/^https?:$/.test(location.protocol) && /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(location.hostname)) return location.origin;
    return VERCEL_API_URL.replace(/\/+$/, '');
  }
  function api(params, opts) {
    opts = opts || {};
    var amId = (params.action === 'sources' && params.id) || (params.action === 'subs' && params.anilist) || '';
    if (amId && !opts.hasAm) {
      return aniFull(amId).then(function (am) {
        var p2 = {}; Object.keys(params).forEach(function (k) { p2[k] = params[k]; });
        if (am) p2.am = am;
        return api(p2, { body: opts.body, hasAm: true });
      });
    }
    var qs = Object.keys(params).map(function (k) { return k + '=' + encodeURIComponent(params[k]); }).join('&');
    var headers = {}, au = auth(), init = { headers: headers };
    if (au && /^(me|sync_get|sync_put)$/.test(params.action)) headers.Authorization = 'Bearer ' + au.token;
    if (opts.body) { init.method = 'POST'; headers['Content-Type'] = 'application/json'; init.body = JSON.stringify(opts.body); }
    return fetch(apiBase() + '/api?' + qs, init).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) { var er = new Error(j.error || 'HTTP ' + r.status); er.data = j; throw er; }
        return j;
      });
    }).catch(function (e) {
      // Some hosts (e.g. Cloudflare Workers) get blocked by AniList: ask AniList straight from the device instead
      if (/^(home|trending|search)$/.test(params.action)) return aniDirect(params).catch(function () { throw e; });
      throw e;
    });
  }
  // Full AniList record, handed to the backend so it never has to reach AniList itself (Cloudflare Workers get blocked there)
  var amCache = {};
  function aniFull(id) {
    if (!id || isNaN(id)) return Promise.resolve('');
    if (amCache[id] !== undefined) return Promise.resolve(amCache[id]);
    return aniQuery('query($id:Int){Media(id:$id,type:ANIME){id idMal title{english romaji native} status format episodes seasonYear startDate{year month day} genres synonyms nextAiringEpisode{episode airingAt timeUntilAiring}}}', { id: Number(id) })
      .then(function (d) { return (amCache[id] = JSON.stringify(d.Media)); }, function () { return ''; });
  }
  var AL_F = 'id title{romaji english} coverImage{extraLarge large color} bannerImage description(asHtml:false) idMal episodes nextAiringEpisode{episode} format seasonYear averageScore status genres synonyms';
  function aniMap(m) {
    return { id: m.id, mal: m.idMal || null, kind: 'anime', title: m.title.english || m.title.romaji, titleRomaji: m.title.romaji,
      cover: m.coverImage.extraLarge || m.coverImage.large, banner: m.bannerImage || null, color: m.coverImage.color || null,
      description: (m.description || '').replace(/<[^>]+>/g, '').trim(),
      episodes: m.episodes || (m.nextAiringEpisode ? m.nextAiringEpisode.episode - 1 : null), format: m.format, year: m.seasonYear,
      status: m.status, genres: m.genres || [], synonyms: (m.synonyms || []).filter(function (x) { return /^[\x20-\x7e]+$/.test(x); }).slice(0, 4),
      score: m.averageScore ? (m.averageScore / 10).toFixed(1) : null };
  }
  function aniQuery(query, vars) {
    return fetch('https://graphql.anilist.co', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query: query, variables: vars || {} }) }).then(function (r) { return r.json(); }).then(function (j) {
      if (!j.data) throw new Error('AniList unavailable'); return j.data; });
  }
  function aniDirect(p) {
    var shelf = function (a, args) { return a + ':Page(perPage:20){media(type:ANIME,isAdult:false,' + args + '){...F}}'; };
    if (p.action === 'home') {
      var mo = new Date().getUTCMonth(), season = ['WINTER', 'SPRING', 'SUMMER', 'FALL'][Math.floor(mo / 3)];
      var q = 'query($season:MediaSeason,$year:Int){' + [shelf('trending', 'sort:TRENDING_DESC'), shelf('season', 'season:$season,seasonYear:$year,sort:POPULARITY_DESC'),
        shelf('top', 'sort:SCORE_DESC'), shelf('action', 'genre:"Action",sort:POPULARITY_DESC'), shelf('romance', 'genre:"Romance",sort:POPULARITY_DESC'),
        shelf('comedy', 'genre:"Comedy",sort:POPULARITY_DESC'), shelf('fantasy', 'genre:"Fantasy",sort:POPULARITY_DESC')].join(' ') + '} fragment F on Media{' + AL_F + '}';
      return aniQuery(q, { season: season, year: new Date().getUTCFullYear() }).then(function (d) {
        var names = [['trending', 'Trending Now'], ['season', 'Popular This Season'], ['top', 'Top Rated'], ['action', 'Action'], ['romance', 'Romance'], ['comedy', 'Comedy'], ['fantasy', 'Fantasy']];
        return { rows: names.map(function (n) { return { title: n[1], items: ((d[n[0]] && d[n[0]].media) || []).map(aniMap) }; }).filter(function (r) { return r.items.length; }) };
      });
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
    var img = el('img'); img.alt = ''; img.loading = 'lazy';
    img.onload = function () { img.className = 'ld'; };
    img.onerror = function () { img.style.display = 'none'; };
    img.src = a.cover || '';
    p.appendChild(img);
    var movie = a.kind === 'movie';
    if (extra && extra.cont) {
      p.appendChild(el('div', 'badge ep', movie ? 'RESUME' : 'EP ' + extra.ep));
      if (extra.dur) p.appendChild(el('div', 'pbar', '<i style="width:' + Math.min(100, extra.time / extra.dur * 100) + '%"></i>'));
    } else if (extra && extra.hist) {
      p.appendChild(el('div', 'badge ep', movie ? 'MOVIE' : 'EP ' + extra.ep));
    } else if (a.score) p.appendChild(el('div', 'badge', '★ ' + esc(a.score)));
    if (extra && (extra.cont || extra.hist)) p.appendChild(el('button', 'cx', '✕'));
    c.appendChild(p);
    c.appendChild(el('div', 'ct', esc(a.title)));
    c.__anime = a;
    if (extra && extra.cont) { c.__cont = extra; }
    if (extra && extra.hist) { c.__hist = extra; }
    return c;
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
    api({ action: m === 'movies' ? 'movies_home' : 'home' }).then(function (d) {
      state.cache[m] = d;
      if (m === state.mode) renderHome(d);
    }).catch(function (e) {
      if (m !== state.mode) return;
      $('rows').innerHTML = '';
      var unset = VERCEL_API_URL.indexOf('YOUR_VERCEL') === 0;
      $('homeMsg').innerHTML = esc(unset ? 'Set VERCEL_API_URL in main.js' : 'Could not load ' + (m === 'movies' ? 'movies' : 'anime') + ': ' + e.message) +
        '<button class="retry focusable" id="retryHome">Retry</button>';
      if (state.tab === 'home' || state.tab === 'movies') setFocus($('retryHome'));
    });
  }
  function renderHome(d) {
    $('rows').innerHTML = ''; $('homeMsg').innerHTML = '';
    var rows = d.rows || [];
    renderContinue();
    rows.forEach(function (r) { addRow(r.title, r.items); });
    var feat = [];
    (rows[0] ? rows[0].items : []).forEach(function (a) { if (a.banner && feat.length < 6) feat.push(a); });
    if (!feat.length && rows[0]) feat = rows[0].items.slice(0, 5);
    setHeroList(feat);
    if ((state.tab === 'home' || state.tab === 'movies') && state.view === state.tab) setFocus($('heroPlay'));
  }
  function renderContinue() {
    var old = $('rows').querySelector('.row.cont');
    if (old) old.parentNode.removeChild(old);
    var c = continueItems();
    if (!c.length) return;
    addRow('Continue Watching', c, true);
    var rows = $('rows'), last = rows.lastChild;
    last.className += ' cont';
    rows.insertBefore(last, rows.firstChild);
  }

  function setHeroList(list) {
    state.hero = list; state.heroIdx = 0;
    var dots = $('heroDots'); dots.innerHTML = '';
    list.forEach(function () { dots.appendChild(el('i')); });
    showHero(0, true);
    clearInterval(state.heroTimer);
    if (list.length > 1) state.heroTimer = setInterval(function () {
      if (state.view === 'home' && state.tab === 'home') showHero((state.heroIdx + 1) % state.hero.length);
    }, 9000);
  }
  function showHero(i, instant) {
    var a = state.hero[i]; if (!a) return;
    var body = $('heroBody'), bg = $('heroBg');
    function paint() {
      state.heroIdx = i;
      bg.style.backgroundImage = 'url("' + (a.banner || a.cover) + '")';
      if (!a.banner) bg.style.backgroundPosition = 'center 20%';
      var movie = a.kind === 'movie';
      $('heroTags').innerHTML = '<span class="tag hot">#' + (i + 1) + (movie ? ' Popular' : ' Trending') + '</span>' +
        (a.genres || []).slice(0, 3).map(function (g) { return '<span class="tag">' + esc(g) + '</span>'; }).join('');
      $('heroTitle').textContent = a.title;
      $('heroMeta').innerHTML = (a.score ? '<span class="score">★ ' + esc(a.score) + '</span>' : '') +
        [a.format, a.year, movie ? a.runtime : (a.episodes ? a.episodes + ' eps' : '')].filter(Boolean).map(esc).map(function (x) { return '<span>' + x + '</span>'; }).join('') +
        (movie ? '' : '<span class="tag">ENG SUB</span>');
      $('heroDesc').textContent = a.description;
      var p = progOf(a);
      $('heroPlay').innerHTML = ic('play') + (movie ? (p ? 'Resume' : 'Play Movie') : (p ? 'Continue EP ' + p.ep : 'Play EP 1'));
      $('heroInfo').innerHTML = ic('info') + 'More Info';
      var dots = $('heroDots').children;
      for (var k = 0; k < dots.length; k++) dots[k].className = k === i ? 'on' : '';
      body.className = ''; bg.className = '';
    }
    if (instant) return paint();
    body.className = 'swap'; bg.className = 'swap';
    setTimeout(paint, 380);
  }

  // ======================= Tabs =======================
  var VIEW_OF = { home: 'viewHome', movies: 'viewHome', search: 'viewSearch', list: 'viewList', history: 'viewHistory', account: 'viewAccount', settings: 'viewSettings' };
  var TAB_ICON = { home: 'home', movies: 'film', search: 'search', list: 'list', history: 'history', account: 'person', settings: 'gear' };
  function paintTabs() {
    var tabs = document.querySelectorAll('.tab'), names = { home: 'Anime', movies: 'Movies', search: 'Search', list: 'My List', history: 'History', account: auth() ? auth().username : 'Account', settings: 'Settings' };
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
    var shown = VIEW_OF[t];
    ['viewHome', 'viewSearch', 'viewList', 'viewHistory', 'viewAccount', 'viewSettings'].forEach(function (id) {
      $(id).className = 'view' + (id === shown ? '' : ' hidden');
    });
    $('nav').className = activeView().scrollTop > 40 ? 'solid' : '';
    paintTabs();
    if (t === 'home' || t === 'movies') {
      if (state.hero.length && state.cache[state.mode] && prev === state.tab) { renderContinue(); showHero(state.heroIdx, true); }
      else loadHome();
    }
    if (t === 'search') {
      state.smode = state.smode || state.mode; paintTypeChips();
      if (!$('searchGrid').children.length && !$('searchMsg').textContent) runSearch();
      if (focusContent !== false) { setFocus($('searchInput')); if (!IS_TV) $('searchInput').focus(); }
    }
    if (t === 'list') renderList();
    if (t === 'history') renderHistory();
    if (t === 'account') renderAccount();
    if (t === 'settings') { paintTipsBtn(); $('serverInput').value = store.get('ea_server', ''); $('setUsing').textContent = 'Currently using: ' + apiBase(); $('setSave').innerHTML = ic('check') + 'Save'; $('setTest').innerHTML = ic('play') + 'Test streams'; $('setReset').innerHTML = 'Reset'; if (focusContent !== false) setFocus($('serverInput')); }
    if (focusContent && (t === 'home' || t === 'movies')) setFocus($('heroPlay'));
    if (focusContent && t === 'list') { var f = $('listGrid').firstChild; if (f) setFocus(f); }
    if (focusContent && t === 'history') { var hb = $('clearHist'); setFocus($('histGrid').firstChild || hb); }
    if (focusContent && t === 'account') setFocus($(auth() ? 'accSync' : 'accUser'));
  }
  function renderList() {
    var l = store.get('ea_list', []), g = $('listGrid'); g.innerHTML = '';
    $('listMsg').textContent = l.length ? '' : 'Your list is empty. Open a title and choose “My List” to save it here.';
    l.forEach(function (a) { g.appendChild(card(a)); });
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

  // ======================= Search =======================
  function paintTypeChips() {
    var cs = $('typeChips').children;
    for (var i = 0; i < cs.length; i++) cs[i].className = 'chip focusable' + (cs[i].__stype === state.smode ? ' on' : '') + (cs[i] === state.focusEl ? ' focused' : '');
    $('chips').style.display = state.smode === 'movies' ? 'none' : '';
  }
  function buildChips() {
    var tc = $('typeChips'); tc.innerHTML = '';
    [['anime', 'Anime'], ['movies', 'Movies']].forEach(function (t) { var b = el('button', 'chip focusable', t[1]); b.__stype = t[0]; tc.appendChild(b); });
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
    var q = $('searchInput').value.trim(), g = state.genre, movies = state.smode === 'movies';
    var grid = $('searchGrid'), msg = $('searchMsg'), tk = ++state.token;
    grid.innerHTML = '';
    msg.textContent = 'Searching…';
    var p = movies
      ? (q ? api({ action: 'movies_search', q: q }) : api({ action: 'movies_home' }).then(function (d) { return { results: d.rows[0] ? d.rows[0].items : [] }; }))
      : api(q || g ? { action: 'search', q: q, genre: g } : { action: 'trending' });
    p.then(function (d) {
      if (tk !== state.token) return;
      var list = d.results || [];
      msg.textContent = list.length ? (q || (!movies && g) ? '' : 'Popular right now') : 'No results found.';
      list.forEach(function (a) { grid.appendChild(card(a)); });
    }).catch(function (e) { if (tk === state.token) msg.textContent = 'Search failed: ' + e.message; });
  }

  // ======================= Detail =======================
  function openDetail(a) {
    state.anime = a; state.view = 'detail'; state.epRange = 0;
    state.returnFocus = state.focusEl;
    var movie = a.kind === 'movie';
    $('detail').className = '';
    $('dBg').style.backgroundImage = 'url("' + (a.banner || a.cover) + '")';
    $('dCover').src = a.cover || '';
    $('dTitle').textContent = a.title;
    $('dMeta').innerHTML = (a.score ? '<span class="score">★ ' + esc(a.score) + '</span>' : '') +
      (movie ? [a.year, a.runtime] : [a.format, a.year, a.status ? a.status.replace(/_/g, ' ') : '', a.episodes ? a.episodes + ' episodes' : '']).filter(Boolean)
        .map(function (x) { return '<span>' + esc(x) + '</span>'; }).join('') + (movie ? '' : '<span class="tag">ENG SUB</span>');
    $('dGenres').innerHTML = (a.genres || []).map(function (g) { return '<span class="tag">' + esc(g) + '</span>'; }).join('') +
      (movie && a.cast && a.cast.length ? '<span class="tag cast">' + esc(a.cast.slice(0, 4).join(' · ')) + '</span>' : '');
    $('dDesc').textContent = a.description || 'No description available.';
    $('dBack').innerHTML = ic('back') + 'Back';
    $('detail').setAttribute('data-kind', movie ? 'movie' : 'anime');
    closeDrops(false); if (movie) renderDrops();
    paintDetailButtons();
    renderEpisodes();
    $('dScroll').scrollTop = 0;
    setFocus($('dPlay'));
  }
  // ----- movie dropdowns: Source and desired Quality (picked on the movie page, before Play) -----
  var MOVIE_SOURCES = [['auto', 'Auto (best)', 'public domain, else VidCore'], ['vidcore', 'VidCore', 'own subtitles · auto quality up to 4K'],
                       ['cinesrc', 'CineSrc', 'OpenSubtitles · ±10s · quality'], ['archive', 'Public domain', 'our own player']];
  var MOVIE_QUALITIES = [['auto', 'Auto (default)', 'best available'], ['2160', '4K (2160p)', ''], ['1440', '1440p', ''], ['1080', '1080p', ''], ['720', '720p', ''], ['480', '480p', '']];
  var DROPS = {
    src: { btn: 'dSrcBtn', list: 'dSrcList', label: 'Source', opts: MOVIE_SOURCES, get: function () { return state.mvia; }, set: function (v) { state.mvia = v; store.set('ea_msrc', v); } },
    q: { btn: 'dQBtn', list: 'dQList', label: 'Quality', opts: MOVIE_QUALITIES, get: function () { return String(state.mq); }, set: function (v) { state.mq = v; store.set('ea_mq', v); } }
  };
  function optName(opts, v) { for (var i = 0; i < opts.length; i++) if (opts[i][0] === v) return opts[i][1]; return opts[0][1]; }
  function movieSrcName(v) { return optName(MOVIE_SOURCES, v); }
  function renderDrops() { Object.keys(DROPS).forEach(function (k) { var d = DROPS[k]; $(d.btn).innerHTML = '<span>' + d.label + ': ' + esc(optName(d.opts, d.get())) + '</span><span>▾</span>'; }); }
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
    var a = state.anime, p = progOf(a), movie = a.kind === 'movie';
    $('dPlay').innerHTML = ic('play') + (movie ? (p ? 'Resume' + (p.time > 10 ? ' · ' + fmt(p.time) : '') : 'Play Movie')
      : (p ? 'Continue EP ' + p.ep + (p.time > 10 ? ' · ' + fmt(p.time) : '') : 'Play EP 1'));
    $('dList').innerHTML = ic(inList(a) ? 'check' : 'plus') + (inList(a) ? 'In My List' : 'My List');
    $('dRemove').innerHTML = '✕ Remove from Continue Watching';
    $('dRemove').style.display = p ? '' : 'none';
  }
  function renderEpisodes() {
    var a = state.anime, ranges = $('dRanges'), box = $('dEps');
    ranges.innerHTML = ''; box.innerHTML = '';
    if (a.kind === 'movie') return;
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
  function closeDetail() {
    state.view = state.tab;
    $('detail').className = 'hidden';
    if (state.tab === 'home' || state.tab === 'movies') renderContinue();
    if (state.tab === 'history') renderHistory();
    if (state.tab === 'list') renderList();
    var f = state.returnFocus;
    if (f && document.body.contains(f)) setFocus(f); else setFocus($('heroPlay'));
  }
  function startFromDetail() {
    var p = progOf(state.anime);
    play(state.anime, state.anime.kind === 'movie' ? 1 : (p ? p.ep : 1));
  }

  // ======================= Player =======================
  var video = $('video');
  function hud(show) {
    if (state.view !== 'player') return;
    var h = $('phud'); clearTimeout(state.hudTimer);
    if (show === false) { h.className = 'fade'; $('player').className = 'idle'; return; }
    h.className = ''; $('player').className = '';
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
    var tk = ++state.token, movie = a.kind === 'movie';
    state.srcSkip = skip || [];                                                   // sources already tried for this episode
    if (!keepVia) state.dubFailed = false;
    if (!keepVia && state.via && state.anime && state.anime.id !== a.id) state.via = 'auto';
    state.anime = a; state.ep = ep; state.view = 'player'; state.skip = null; hideEmbed();
    if (state.os.key !== osKey()) state.os = newOs(osKey());
    $('player').className = ''; $('player').setAttribute('data-kind', movie ? 'movie' : 'anime');
    $('skipBtn').className = 'skipbtn hidden';
    $('pTitle').textContent = movie ? a.title : a.title + ' — Episode ' + ep;
    stopVideo();
    var pr = progOf(a);
    if (startAt == null) startAt = pr && pr.ep === ep ? pr.time : 0;
    if (!keepVia) addHist(a, ep);
    pmsg(movie ? 'Finding a stream…' : state.srcSkip.length ? 'Trying more sources… (' + state.srcSkip.length + ' checked)' : 'Finding an English-subbed stream…', true);
    var req = movie ? api({ action: 'movie_sources', via: state.mvia || 'auto', id: a.id, title: a.title, year: a.year || '', quality: state.mq !== 'auto' ? state.mq : '', t: startAt > 5 ? Math.floor(startAt) : '' })
      : api({ action: 'sources', via: state.via || 'auto', audio: state.audioPref === 'dub' ? 'dub' : '', id: a.id, title: a.title, alt: a.titleRomaji || '', syn: (a.synonyms || []).join('|'), ep: ep, skip: state.srcSkip.join(',') });
    req.then(function (d) {
      if (tk !== state.token) return;
      if (movie && d.mode === 'embed' && d.embeds && d.embeds.length) { startEmbed(d.embeds[0].url); return; }
      if (!d.url) throw new Error(d.error || 'No stream found');
      startVideo(d, startAt, tk);
      if (!(d.subtitles && d.subtitles.length) && !d.hardsub) osFetchList(function () { if (tk === state.token) subAuto(); });   // OpenSubtitles automatically
      if (!movie && a.mal) api({ action: 'skip', mal: a.mal, ep: ep }).then(function (sk) { if (tk === state.token) state.skip = sk; }).catch(function () {});
    }).catch(function (e) {
      if (tk === state.token && !movie && e.data && e.data.retry && e.data.skip && state.srcSkip.length < 12) {   // server ran out of its per-call budget: continue with the remaining sources
        return play(a, ep, startAt, true, String(e.data.skip).split(','));
      }
      if (tk === state.token && !movie && state.audioPref === 'dub' && !state.dubFailed) {   // no English dub here: fall back to Japanese audio
        state.dubFailed = true; state.audioPref = 'sub'; toast('No English dub for this episode — using Japanese audio');
        return play(a, ep, startAt, true);
      }
      if (tk === state.token) { pmsg('Could not start playback: ' + e.message + '  (press Back to return)', false); }
    });
  }
  // Hosted embed player (iframe). Used for movies when no direct file exists; Back always exits.
  function startEmbed(url) {
    stopVideo();
    state.embed = true; state.embedKind = /cinesrc\.st/.test(url) ? 'cinesrc' : 'vidcore';
    state.cin = { t: 0, d: 0, paused: true, stamp: performance.now(), live: false };
    var f = $('embedFrame');
    f.className = 'show';
    f.src = url;
    pmsg('Loading player… (press Enter to focus it, Back to exit)', true);
    f.onload = function () { if (state.embed) pmsg('', false); };
    $('player').setAttribute('data-embed', '1');
    $('embedCtl').className = state.embedKind === 'cinesrc' ? '' : 'hidden';   // VidCore: shown once its player reports a clock
    setTimeout(function () { if (state.embed) pmsg('', false); }, 6000);
    startSubLoop();                                  // OpenSubtitles overlay, locked to the player clock
    osFetchList(function () { subAuto(); });
  }
  function hideEmbed() {
    state.embed = false; state.embedKind = null; $('player').removeAttribute('data-embed');
    $('embedSubs').textContent = ''; $('embedCtl').className = 'hidden';
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
    var movie = state.anime && state.anime.kind === 'movie';
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
      if (h.currentLevel === -1 || ((state.anime && state.anime.kind === 'movie' ? store.get('ea_mq', 'auto') : store.get('ea_q', 'auto')) === 'auto')) return 0;
      for (var i = 1; i < opts.length; i++) if (opts[i].label === h.levels[h.currentLevel].height + 'p') return i;
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
      var live = h.levels[h.currentLevel === -1 ? (h.loadLevel >= 0 ? h.loadLevel : h.levels.length - 1) : h.currentLevel];
      b.textContent = (h.currentLevel === -1 ? 'Auto ' : '') + (live ? live.height + 'p' : '');
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
  function osKey() { var a = state.anime; return a ? (a.kind === 'movie' ? 'm:' + a.id : 'a:' + a.id + ':' + state.ep) : ''; }
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
    var req = a.kind === 'movie' ? api({ action: 'subs', imdb: a.id }) : api({ action: 'subs', anilist: a.id, ep: state.ep });
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
      if (state.embedKind === 'vidcore') w.postMessage({ command: cmd, time: args && args.length ? args[0] : cinNow() }, VCO);
      else w.postMessage({ type: 'cinesrc:command', command: cmd, args: args || [] }, CIN);
    } catch (e) {}
  }
  function cinNow() { return state.cin.t + (state.cin.paused ? 0 : (performance.now() - state.cin.stamp) / 1000); }
  function cinSeek(delta) { var t = Math.max(0, cinNow() + delta); state.cin.t = t; state.cin.stamp = performance.now(); cinSend('seek', [t]); toast((delta > 0 ? '+' : '') + delta + 's'); }
  function cinToggle() {
    if (state.cin.paused) { cinSend('play'); state.cin.paused = false; state.cin.stamp = performance.now(); }
    else { state.cin.t = cinNow(); cinSend('pause'); state.cin.paused = true; }
  }
  window.addEventListener('message', function (e) {
    if (e.origin === VCO && state.embed && state.embedKind === 'vidcore' && e.data && typeof e.data === 'object') {
      var v = e.data, vd = v.data || {}, vc = state.cin;
      if (!vc.live && (v.type === 'timeupdate' || v.type === 'PLAYER_EVENT')) { vc.live = true; $('embedCtl').className = ''; pmsg('', false); }
      if (v.type === 'timeupdate') {
        var vt = +vd.currentTime || 0;
        if (Math.abs(vt - vc.t) > 0.05 && vt > vc.t) vc.paused = false;
        vc.t = vt; vc.d = +vd.duration || vc.d; vc.stamp = performance.now(); saveEmbedProgress();
      } else if (v.type === 'PLAYER_EVENT') {
        if (vd.currentTime != null) { vc.t = +vd.currentTime || 0; vc.stamp = performance.now(); }
        if (vd.event === 'play' || vd.event === 'playing') vc.paused = false;
        else if (vd.event === 'pause') vc.paused = true;
        else if (vd.event === 'ended') { removeProg(keyOf(state.anime)); closePlayer(); }
      } else if (v.type === 'ended') { removeProg(keyOf(state.anime)); closePlayer(); }
      return;
    }
    if (e.origin !== CIN || state.embedKind !== 'cinesrc' || !state.embed || !e.data || typeof e.data !== 'object') return;
    var m = e.data, c = state.cin;
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
      case 'cinesrc:ended': removeProg(keyOf(state.anime)); closePlayer(); break;
      case 'cinesrc:ready': pmsg('', false); break;
    }
  });
  function saveEmbedProgress() {
    var c = state.cin; if (!state.anime || Date.now() - state.lastSave < 5000 || c.t < 5 || !c.d) return;
    state.lastSave = Date.now(); setProg(state.anime, 1, c.t, c.d);
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

  var SOURCES = ['auto', 'animeparadise', 'anikoto', 'animegg', 'aniwaves', 'animenosub', 'animeheaven', 'gogoanime', 'anizone', 'kaa', 'senshi'];
  var SRC_NAMES = { auto: 'Auto (best)', animeparadise: 'AnimeParadise', anizone: 'AniZone', anikoto: 'AniKoto', animegg: 'AnimeGG', kaa: 'KickAssAnime', animenosub: 'Omega/Vidmoly', aniwaves: 'AniWaves', senshi: 'Senshi', animeheaven: 'AnimeHeaven', gogoanime: 'Gogoanime' };
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
  var SPEEDS = [0.75, 1, 1.25, 1.5, 2];
  function menuRows() {
    var opts = qualityOptions(), qi = curQualityIndex(opts);
    var movie = state.anime && state.anime.kind === 'movie';
    var vias = movie ? MOVIE_SOURCES.map(function (o) { return o[0]; }) : SOURCES, cur = movie ? (state.mvia || 'auto') : (state.via || 'auto'), vi = Math.max(0, vias.indexOf(cur));
    var names = movie ? (function () { var n = {}; MOVIE_SOURCES.forEach(function (o) { n[o[0]] = o[1]; }); return n; })() : SRC_NAMES;
    var srcRow = { key: 'source', label: 'Source', value: names[vias[vi]] || vias[vi],
      change: function (dir) {
        var nv = vias[(vi + dir + vias.length) % vias.length];
        if (movie) { state.mvia = nv; store.set('ea_msrc', nv); } else state.via = nv;
        var at = state.embed ? (isCin() ? cinNow() : 0) : video.currentTime; toast('Source: ' + (names[nv] || nv));
        closeMenu(); play(state.anime, movie ? 1 : state.ep, at > 5 ? at : 0, true);
      } };
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
      if (state.embedKind === 'vidcore') return isCin() ? [srcRow, subRow(), fileRow(), syncRow,
        { key: 'q', label: 'Quality', value: 'Auto (up to 4K)', change: function () { toast('VidCore picks quality automatically'); } }] : [srcRow,
        { key: 'subs', label: 'Subtitles', value: "Use player's CC", change: function () { toast('VidCore has its own subtitle button inside the player'); } },
        { key: 'q', label: 'Quality', value: 'Auto (up to 4K)', change: function () { toast('VidCore picks quality automatically'); } }];
      return [srcRow, subRow(), fileRow(), syncRow,
        { key: 'q', label: 'Quality', value: optName(MOVIE_QUALITIES, String(state.mq)),
          change: function (dir) {
            var qs = MOVIE_QUALITIES.map(function (o) { return o[0]; }), n = qs[(qs.indexOf(String(state.mq)) + dir + qs.length) % qs.length];
            state.mq = n; store.set('ea_mq', n); var at = cinNow(); closeMenu(); toast('Quality: ' + optName(MOVIE_QUALITIES, n)); play(state.anime, 1, at > 5 ? at : 0, true);
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
    state.src = d; state.triedProxy = false; state.startAt = startAt; state.qIdx = 0; state.menuOpen = false; $('pmenu').className = 'hidden';
    // Subtitle tracks from the stream are fetched through the API (CORS-open) and drawn by our overlay (exact sync)
    state.srcAudio = d.audio || 'sub';
    subSetStream(d.subtitles || []);
    subAuto();
    startSubLoop();
    state.hasSoftSubs = !!(d.subtitles && d.subtitles.length);
    if (state.hasSoftSubs) osFetchList(function () { subAuto(); });
    var isHls = d.type === 'hls' || /m3u8/i.test(d.url);
    if (isHls && window.Hls && Hls.isSupported()) {
      state.hls = newHls();
      state.hls.loadSource(d.url);
      state.hls.attachMedia(video);
      state.netRetry = 0; state.mediaRetry = 0;
      state.hls.on(Hls.Events.ERROR, function (_, e) {                       // self-heal before giving up
        if (!e.fatal) return;
        if (e.type === Hls.ErrorTypes.NETWORK_ERROR && state.netRetry++ < 3) { state.hls.startLoad(); return; }
        if (e.type === Hls.ErrorTypes.MEDIA_ERROR && state.mediaRetry++ < 3) { state.hls.recoverMediaError(); return; }
        if (!fallbackToProxy() && !nextSource()) pmsg('Playback error: ' + e.details, false);
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
      if (fallbackToProxy()) { toast('Slow source — switching route'); state.startTimer = setTimeout(startCheck, 20000); } else nextSource();
    }, 25000);
  }
  video.addEventListener('playing', function () { clearTimeout(state.waitTimer); pmsg('', false); paintPlayBtn(); });
  video.addEventListener('pause', function () { paintPlayBtn(); hud(); });
  video.addEventListener('waiting', function () {
    pmsg('', true);
    clearTimeout(state.waitTimer);                                           // stalled for 15s -> try the server relay once
    state.waitTimer = setTimeout(function () { if (state.view === 'player' && video.readyState < 3 && !video.paused) { if (fallbackToProxy()) toast('Slow connection — switching route'); } }, 15000);
  });
  video.addEventListener('volumechange', function () { store.set('ea_vol', { v: video.volume, m: video.muted }); });
  // This source's stream does not play here: ask the server for the next source (Auto mode only)
  function nextSource() {
    var d = state.src, a = state.anime;
    if (!d || !d.key || !a || a.kind === 'movie' || (state.via && state.via !== 'auto') || state.srcSkip.length >= 12) return false;
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
  video.addEventListener('error', function () {
    if (!video.getAttribute('src')) return;
    if (!fallbackToProxy() && !nextSource()) pmsg('Video error — the stream could not be played', false);
  });
  video.addEventListener('progress', function () {
    if (video.duration && video.buffered.length) $('seekBuf').style.width = video.buffered.end(video.buffered.length - 1) / video.duration * 100 + '%';
  });
  video.addEventListener('timeupdate', function () {
    var d = video.duration, t = video.currentTime;
    if (d) $('seekBar').style.width = t / d * 100 + '%';
    $('pTime').textContent = fmt(t) + ' / ' + fmt(d);
    if (Date.now() - state.lastSave > 5000 && t > 3 && d) { state.lastSave = Date.now(); setProg(state.anime, state.ep, t, d); }
    updateSkip(t);
  });
  // Skip intro / outro (AniSkip timestamps)
  function updateSkip(t) {
    var sk = state.skip, b = $('skipBtn'), hit = null;
    if (sk && sk.op && t >= sk.op.start - 1 && t < sk.op.end - 1) hit = { to: sk.op.end, label: 'Skip Intro' };
    else if (sk && sk.ed && t >= sk.ed.start - 1 && t < sk.ed.end - 1) hit = { to: sk.ed.end, label: 'Skip Outro' };
    if (hit) { state.skipTo = hit.to; b.innerHTML = hit.label + ' ' + ic('next'); if (b.className !== 'skipbtn show') b.className = 'skipbtn show'; }
    else if (b.className !== 'skipbtn hidden') b.className = 'skipbtn hidden';
  }
  function doSkip() { if (state.skipTo) { video.currentTime = state.skipTo; $('skipBtn').className = 'skipbtn hidden'; hud(); } }
  video.addEventListener('ended', function () {
    var a = state.anime;
    if (a.kind === 'movie') { removeProg(keyOf(a)); closePlayer(); return; }
    if (a.episodes && state.ep >= a.episodes) { setProg(a, state.ep, 0, 0); closePlayer(); return; }
    setProg(a, state.ep + 1, 0, 0);
    play(a, state.ep + 1, 0);
  });
  function stopVideo() {
    if (state.hls) { state.hls.destroy(); state.hls = null; }
    try { video.pause(); video.removeAttribute('src'); video.load(); } catch (e) {}
    clearTracks();
    $('seekBar').style.width = '0'; $('seekBuf').style.width = '0';
  }
  function closePlayer() {
    state.token++; state.menuOpen = false; $('pmenu').className = 'hidden'; $('skipBtn').className = 'skipbtn hidden'; hideEmbed();
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
    if (a === 'back10') cinSeek(-10); else if (a === 'fwd10') cinSeek(10); else if (a === 'toggle') cinToggle();
    else if (a === 'cc') { var so = subOptions(); so.opts[(so.cur + 1) % so.opts.length].apply(); }
    else if (a === 'syncm' || a === 'syncp') { state.os.off = Math.max(-15, Math.min(15, Math.round((state.os.off + (a === 'syncp' ? 0.5 : -0.5)) * 10) / 10)); toast('Subtitle sync ' + (state.os.off >= 0 ? '+' : '') + state.os.off.toFixed(1) + 's'); }
  });
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
    var rem = parseFloat(document.documentElement.style.fontSize) || 16;
    var anchor = up(e, 'row') || e, r = anchor.getBoundingClientRect(), er = e.getBoundingClientRect(), vr = root.getBoundingClientRect();
    var topSafe = vr.top + (root === $('dScroll') ? 1 : $('nav').offsetHeight) * (root === $('dScroll') ? rem : 1);
    if (er.top < topSafe || er.bottom > vr.bottom - rem) root.scrollTop += r.top - (topSafe + rem);
  }
  function candidates() {
    var roots = state.view === 'notice' ? [$('notice')] : state.view === 'detail' ? [$('detail')] : [$('nav'), activeView()], out = [];
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
    var c = center(cur), best = null, bestScore = Infinity;
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
    if (best) setFocus(best);
  }

  function activate(e) {
    if (e.tagName === 'INPUT') { e.focus(); return; }
    if (e.__tab) { showTab(e.__tab, e.__tab !== 'search'); if (e.__tab === 'search') setFocus($('searchInput')); return; }
    if (e.__stype) { state.smode = e.__stype; paintTypeChips(); $('searchGrid').innerHTML = ''; runSearch(); return; }
    if (e.id === 'heroPlay') { var h = state.hero[state.heroIdx]; if (h) { state.returnFocus = e; var p = progOf(h); play(h, h.kind === 'movie' ? 1 : (p ? p.ep : 1)); } return; }
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
    if (e.id === 'clearHist') { clearHist(); renderHistory(); toast('History cleared'); setFocus($('clearHist')); return; }
    if (e.id === 'dSrcBtn' || e.id === 'dQBtn') { var dk = e.id === 'dSrcBtn' ? 'src' : 'q'; openDropKey() === dk ? closeDrops(true) : openDrop(dk); return; }
    if (e.__dropval !== undefined) { pickDrop(e.__drop, e.__dropval); return; }
    if (e.id === 'dRemove') { removeProg(keyOf(state.anime)); paintDetailButtons(); renderEpisodes(); toast('Removed from Continue Watching'); setFocus($('dPlay')); return; }
    if (e.id === 'dBack') { closeDetail(); return; }
    if (e.id === 'dPlay') { startFromDetail(); return; }
    if (e.id === 'dList') { toggleList(state.anime); paintDetailButtons(); return; }
    if (e.__genre !== undefined) { state.genre = state.genre === e.__genre ? '' : e.__genre; paintChips(); runSearch(); return; }
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
    var f = state.tab === 'home' || state.tab === 'movies' ? $('heroPlay') : null; if (f) setFocus(f);
  }
  function paintTipsBtn() { var off = store.get('ea_notice_off', false); $('setTips').innerHTML = (off ? '✕ Startup tips: Off' : '✔ Startup tips: On'); }
  function goBack() {
    if (state.view === 'notice') { hideNotice(false); return; }
    if (state.view === 'player' && state.menuOpen) { closeMenu(); return; }          // Back closes the settings menu first
    if (state.view === 'detail' && anyDropOpen()) { closeDrops(true); return; }
    if (state.view === 'player') closePlayer();
    else if (state.view === 'detail') closeDetail();
    else if (state.tab !== 'home') showTab('home', true);
    else if (IS_TV && window.tizen && tizen.application) tizen.application.getCurrentApplication().exit();
  }

  document.addEventListener('keydown', function (e) {
    var k = e.keyCode;
    if (state.view === 'player') {
      e.preventDefault();
      if (state.embed && !state.menuOpen) {
        if (isBackKey(k) || k === KEY.STOP) { state.lastBack = Date.now(); closePlayer(); }
        else if (isCin() && (k === KEY.LEFT || k === KEY.RW)) cinSeek(-10);
        else if (isCin() && (k === KEY.RIGHT || k === KEY.FF)) cinSeek(10);
        else if (isCin() && (k === KEY.ENTER || k === KEY.SPACE || k === KEY.PLAYPAUSE || k === KEY.PLAY || k === KEY.PAUSE)) cinToggle();
        else if (isCin() && k === 404) { var so = subOptions(); so.opts[(so.cur + 1) % so.opts.length].apply(); }
        else if (k === KEY.ENTER) { try { $('embedFrame').focus(); } catch (e) {} toast('Player selected — press Back to exit'); }
        else if (k === KEY.UP || k === 81 || k === 83 || k === 403 || k === 457) openMenu();
        return;
      }
      if (state.menuOpen) { if (isBackKey(k)) { state.lastBack = Date.now(); closeMenu(); } else menuKey(k); return; }
      if (isBackKey(k) || k === KEY.STOP) { state.lastBack = Date.now(); closePlayer(); }
      else if (k === KEY.ENTER && $('skipBtn').className === 'skipbtn show') doSkip();
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
  document.addEventListener('mouseover', function (e) {
    if (state.view === 'player') return;
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
  ['viewHome', 'viewSearch', 'viewList', 'viewHistory', 'viewAccount', 'viewSettings'].forEach(function (id) {
    $(id).addEventListener('scroll', function () { $('nav').className = this.scrollTop > 40 ? 'solid' : ''; });
  });
  document.addEventListener('visibilitychange', function () { if (document.hidden && state.view === 'player') video.pause(); });

  // ======================= Init =======================
  try {
    if (window.tizen && tizen.tvinputdevice) {
      ['MediaPlayPause', 'MediaPlay', 'MediaPause', 'MediaStop', 'MediaFastForward', 'MediaRewind', 'ColorF0Red', 'ColorF1Green', 'Info'].forEach(function (n) {
        try { tizen.tvinputdevice.registerKey(n); } catch (e) {}
      });
    }
  } catch (e) {}
  // Tizen's hardware back event (fires when the key is pressed while an embedded iframe has focus); ignore it if keydown already handled the same press
  document.addEventListener('tizenhwkey', function (e) { if (e.keyName === 'back' && Date.now() - (state.lastBack || 0) > 500) { e.preventDefault && e.preventDefault(); goBack(); } });
  initPlayerIcons();
  buildChips();
  paintTabs();
  setFocus($('heroPlay'));
  loadHome();
  if (auth()) syncNow(false);
  if (!store.get('ea_notice_off', false)) showNotice();
})();
