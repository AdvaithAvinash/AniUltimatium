const VERCEL_API_URL = "https://aniultimatium.vercel.app";

(function () {
  'use strict';

  // ======================= Constants & helpers =======================
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
    genre: '', epRange: 0, searchTimer: null, trackUrls: []
  };

  // ======================= Persistence =======================
  function slim(a) {
    return { id: a.id, title: a.title, titleRomaji: a.titleRomaji, cover: a.cover, banner: a.banner, color: a.color,
             description: (a.description || '').slice(0, 500), episodes: a.episodes, format: a.format, year: a.year,
             status: a.status, genres: a.genres || [], synonyms: a.synonyms || [], score: a.score };
  }
  function getProg() { return store.get('ea_progress', {}); }
  function setProg(a, ep, time, dur) {
    var p = getProg();
    p[a.id] = { anime: slim(a), ep: ep, time: time, dur: dur, ts: Date.now() };
    store.set('ea_progress', p);
  }
  function inList(a) { return store.get('ea_list', []).some(function (x) { return x.id === a.id; }); }
  function toggleList(a) {
    var l = store.get('ea_list', []), had = false;
    l = l.filter(function (x) { if (x.id === a.id) { had = true; return false; } return true; });
    if (!had) l.unshift(slim(a));
    store.set('ea_list', l);
    toast(had ? 'Removed from My List' : 'Added to My List');
    return !had;
  }
  function continueItems() {
    var p = getProg(), out = [];
    Object.keys(p).forEach(function (k) { out.push(p[k]); });
    out.sort(function (a, b) { return b.ts - a.ts; });
    return out.slice(0, 20);
  }

  // ======================= API =======================
  // Which backend to use: user-set server (Settings) > the local server that served this page > cloud (Vercel)
  function apiBase() {
    var custom = (store.get('ea_server', '') || '').trim();
    if (custom) return (/^https?:\/\//i.test(custom) ? custom : 'http://' + custom).replace(/\/+$/, '');
    if (/^https?:$/.test(location.protocol) && /^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/.test(location.hostname)) return location.origin;
    return VERCEL_API_URL.replace(/\/+$/, '');
  }
  function api(params) {
    var qs = Object.keys(params).map(function (k) { return k + '=' + encodeURIComponent(params[k]); }).join('&');
    return fetch(apiBase() + '/api?' + qs).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (j) {
        if (!r.ok) throw new Error(j.error || 'HTTP ' + r.status);
        return j;
      });
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
    var img = el('img'); img.alt = ''; img.loading = 'lazy'; img.src = a.cover || '';
    img.onerror = function () { img.style.display = 'none'; };
    p.appendChild(img);
    if (extra && extra.cont) {
      p.appendChild(el('div', 'badge ep', 'EP ' + extra.ep));
      if (extra.dur) p.appendChild(el('div', 'pbar', '<i style="width:' + Math.min(100, extra.time / extra.dur * 100) + '%"></i>'));
    } else if (a.score) p.appendChild(el('div', 'badge', '★ ' + esc(a.score)));
    c.appendChild(p);
    c.appendChild(el('div', 'ct', esc(a.title)));
    c.__anime = a;
    if (extra && extra.cont) { c.__cont = extra; }
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
  function loadHome() {
    $('homeMsg').innerHTML = '';
    skeletonRows();
    api({ action: 'home' }).then(function (d) {
      $('rows').innerHTML = '';
      var rows = d.rows || [];
      renderContinue();
      rows.forEach(function (r) { addRow(r.title, r.items); });
      var feat = [];
      (rows[0] ? rows[0].items : []).forEach(function (a) { if (a.banner && feat.length < 6) feat.push(a); });
      if (!feat.length && rows[0]) feat = rows[0].items.slice(0, 5);
      setHeroList(feat);
      if (state.tab === 'home' && state.view === 'home') setFocus($('heroPlay'));
    }).catch(function (e) {
      $('rows').innerHTML = '';
      var unset = VERCEL_API_URL.indexOf('YOUR_VERCEL') === 0;
      $('homeMsg').innerHTML = esc(unset ? 'Set VERCEL_API_URL in main.js' : 'Could not load anime: ' + e.message) +
        '<button class="retry focusable" id="retryHome">Retry</button>';
      if (state.tab === 'home') setFocus($('retryHome'));
    });
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
      $('heroTags').innerHTML = '<span class="tag hot">#' + (i + 1) + ' Trending</span>' +
        (a.genres || []).slice(0, 3).map(function (g) { return '<span class="tag">' + esc(g) + '</span>'; }).join('');
      $('heroTitle').textContent = a.title;
      $('heroMeta').innerHTML = (a.score ? '<span class="score">★ ' + esc(a.score) + '</span>' : '') +
        [a.format, a.year, a.episodes ? a.episodes + ' eps' : ''].filter(Boolean).map(esc).map(function (x) { return '<span>' + x + '</span>'; }).join('') +
        '<span class="tag">ENG SUB</span>';
      $('heroDesc').textContent = a.description;
      var p = getProg()[a.id];
      $('heroPlay').innerHTML = ic('play') + (p ? 'Continue EP ' + p.ep : 'Play EP 1');
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
  function paintTabs() {
    var tabs = document.querySelectorAll('.tab'), names = { home: 'Home', search: 'Search', list: 'My List', settings: 'Settings' };
    for (var i = 0; i < tabs.length; i++) {
      var t = tabs[i].getAttribute('data-tab');
      tabs[i].innerHTML = ic(t === 'settings' ? 'gear' : t === 'list' ? 'list' : t) + names[t];
      tabs[i].className = 'tab focusable' + (t === state.tab ? ' active' : '') + (tabs[i] === state.focusEl ? ' focused' : '');
      tabs[i].__tab = t;
    }
  }
  function showTab(t, focusContent) {
    state.tab = t; state.view = t;
    ['home', 'search', 'list', 'settings'].forEach(function (n) {
      $('view' + n.charAt(0).toUpperCase() + n.slice(1)).className = 'view' + (n === t ? '' : ' hidden');
    });
    $('nav').className = activeView().scrollTop > 40 ? 'solid' : '';
    paintTabs();
    if (t === 'home') { renderContinue(); if (state.hero[state.heroIdx]) showHero(state.heroIdx, true); }
    if (t === 'search') {
      if (!$('searchGrid').children.length && !$('searchMsg').textContent) runSearch();
      if (focusContent !== false) { setFocus($('searchInput')); if (!IS_TV) $('searchInput').focus(); }
    }
    if (t === 'list') renderList();
    if (t === 'settings') { $('serverInput').value = store.get('ea_server', ''); $('setUsing').textContent = 'Currently using: ' + apiBase(); $('setSave').innerHTML = ic('check') + 'Save'; $('setTest').innerHTML = ic('play') + 'Test streams'; $('setReset').innerHTML = 'Reset'; if (focusContent !== false) setFocus($('serverInput')); }
    if (focusContent && t === 'home') setFocus($('heroPlay'));
    if (focusContent && t === 'list') { var f = $('listGrid').firstChild; if (f) setFocus(f); }
  }
  function renderList() {
    var l = store.get('ea_list', []), g = $('listGrid'); g.innerHTML = '';
    $('listMsg').textContent = l.length ? '' : 'Your list is empty. Open an anime and choose “My List” to save it here.';
    l.forEach(function (a) { g.appendChild(card(a)); });
  }

  // ======================= Search =======================
  function buildChips() {
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
    var q = $('searchInput').value.trim(), g = state.genre;
    var grid = $('searchGrid'), msg = $('searchMsg'), tk = ++state.token;
    grid.innerHTML = '';
    msg.textContent = 'Searching…';
    api(q || g ? { action: 'search', q: q, genre: g } : { action: 'trending' }).then(function (d) {
      if (tk !== state.token) return;
      var list = d.results || [];
      msg.textContent = list.length ? (q || g ? '' : 'Popular right now') : 'No results found.';
      list.forEach(function (a) { grid.appendChild(card(a)); });
    }).catch(function (e) { if (tk === state.token) msg.textContent = 'Search failed: ' + e.message; });
  }

  // ======================= Detail =======================
  function openDetail(a) {
    state.anime = a; state.view = 'detail'; state.epRange = 0;
    state.returnFocus = state.focusEl;
    $('detail').className = '';
    $('dBg').style.backgroundImage = 'url("' + (a.banner || a.cover) + '")';
    $('dCover').src = a.cover || '';
    $('dTitle').textContent = a.title;
    $('dMeta').innerHTML = (a.score ? '<span class="score">★ ' + esc(a.score) + '</span>' : '') +
      [a.format, a.year, a.status ? a.status.replace(/_/g, ' ') : '', a.episodes ? a.episodes + ' episodes' : ''].filter(Boolean)
        .map(function (x) { return '<span>' + esc(x) + '</span>'; }).join('') + '<span class="tag">ENG SUB</span>';
    $('dGenres').innerHTML = (a.genres || []).map(function (g) { return '<span class="tag">' + esc(g) + '</span>'; }).join('');
    $('dDesc').textContent = a.description || 'No description available.';
    $('dBack').innerHTML = ic('back') + 'Back';
    paintDetailButtons();
    renderEpisodes();
    $('dScroll').scrollTop = 0;
    setFocus($('dPlay'));
  }
  function paintDetailButtons() {
    var a = state.anime, p = getProg()[a.id];
    $('dPlay').innerHTML = ic('play') + (p ? 'Continue EP ' + p.ep + (p.time > 10 ? ' · ' + fmt(p.time) : '') : 'Play EP 1');
    $('dList').innerHTML = ic(inList(a) ? 'check' : 'plus') + (inList(a) ? 'In My List' : 'My List');
  }
  function renderEpisodes() {
    var a = state.anime, n = a.episodes || 12, per = 50;
    var ranges = $('dRanges'), box = $('dEps');
    ranges.innerHTML = ''; box.innerHTML = '';
    if (n > per) {
      for (var r = 0; r * per < n; r++) {
        var b = el('button', 'chip focusable' + (r === state.epRange ? ' on' : ''), (r * per + 1) + '–' + Math.min(n, (r + 1) * per));
        b.__range = r; ranges.appendChild(b);
      }
    }
    var p = getProg()[a.id];
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
    if (state.tab === 'home') renderContinue();
    var f = state.returnFocus;
    if (f && document.body.contains(f)) setFocus(f); else setFocus($('heroPlay'));
  }
  function startFromDetail() {
    var p = getProg()[state.anime.id];
    play(state.anime, p ? p.ep : 1);
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
  function play(a, ep, startAt) {
    var tk = ++state.token;
    state.anime = a; state.ep = ep; state.view = 'player';
    $('player').className = '';
    $('pTitle').textContent = a.title + ' — Episode ' + ep;
    stopVideo();
    var pr = getProg()[a.id];
    if (startAt == null) startAt = pr && pr.ep === ep ? pr.time : 0;
    pmsg('Finding an English-subbed stream…', true);
    api({ action: 'sources', id: a.id, title: a.title, alt: a.titleRomaji || '', syn: (a.synonyms || []).join('|'), ep: ep }).then(function (d) {
      if (tk !== state.token) return;
      if (!d.url) throw new Error(d.error || 'No stream found');
      startVideo(d, startAt, tk);
    }).catch(function (e) {
      if (tk === state.token) { pmsg('Could not start playback: ' + e.message + '  (press Back to return)', false); }
    });
  }
  function clearTracks() {
    while (video.firstChild) video.removeChild(video.firstChild);
    state.trackUrls.forEach(function (u) { try { URL.revokeObjectURL(u); } catch (e) {} });
    state.trackUrls = [];
  }
  // Start at the best quality the connection can sustain (hls.js default starts low); Q cycles Auto/1080p/720p/360p
  function newHls() {
    var h = new Hls({ maxBufferLength: 40, abrEwmaDefaultEstimate: 10000000, startLevel: -1, capLevelToPlayerSize: false });
    h.on(Hls.Events.MANIFEST_PARSED, function () { setQualityLabel(); });
    h.on(Hls.Events.LEVEL_SWITCHED, function () { setQualityLabel(); });
    return h;
  }
  function setQualityLabel() {
    var b = document.querySelector('[data-act="quality"]'); if (!b) return;
    if (!state.hls || !state.hls.levels || !state.hls.levels.length) { b.textContent = 'HD'; return; }
    var cur = state.hls.currentLevel;
    b.textContent = cur === -1 ? 'Auto' + (state.hls.levels[state.hls.loadLevel] ? ' ' + state.hls.levels[state.hls.loadLevel].height + 'p' : '') : state.hls.levels[cur].height + 'p';
  }
  function cycleQuality() {
    var h = state.hls;
    if (!h || !h.levels || h.levels.length < 2) { toast('Quality: single stream'); return; }
    var heights = h.levels.map(function (l, i) { return { i: i, h: l.height }; }).sort(function (a, b) { return b.h - a.h; });
    var order = [-1].concat(heights.map(function (x) { return x.i; }));
    var pos = order.indexOf(h.currentLevel); h.currentLevel = order[(pos + 1) % order.length];
    setQualityLabel(); toast(h.currentLevel === -1 ? 'Quality: Auto' : 'Quality: ' + h.levels[h.currentLevel].height + 'p');
  }
  function startVideo(d, startAt, tk) {
    clearTracks();
    state.src = d; state.triedProxy = false; state.startAt = startAt;
    // Subtitles are fetched through the API (CORS-open) and attached as same-origin blobs
    (d.subtitles || []).forEach(function (s) {
      fetch(s.url).then(function (r) { return r.blob(); }).then(function (b) {
        if (tk !== state.token) return;
        var u = URL.createObjectURL(b); state.trackUrls.push(u);
        var t = document.createElement('track');
        t.kind = 'subtitles'; t.label = s.lang || 'English'; t.srclang = 'en'; t.src = u; t['default'] = true;
        video.appendChild(t);
        setTimeout(function () { if (video.textTracks.length) video.textTracks[0].mode = 'showing'; }, 100);
      }).catch(function () {});
    });
    state.hasSoftSubs = !!(d.subtitles && d.subtitles.length);
    var isHls = d.type === 'hls' || /m3u8/i.test(d.url);
    if (isHls && window.Hls && Hls.isSupported()) {
      state.hls = newHls();
      state.hls.loadSource(d.url);
      state.hls.attachMedia(video);
      state.hls.on(Hls.Events.ERROR, function (_, e) { if (e.fatal && !fallbackToProxy()) pmsg('Playback error: ' + e.details, false); });
    } else {
      video.src = d.url; // native HLS (Tizen/Safari) or mp4
    }
    video.onloadedmetadata = function () {
      if (startAt > 5 && startAt < video.duration - 30) video.currentTime = startAt;
    };
    var pr = video.play(); if (pr && pr.catch) pr.catch(function () { pmsg('Press Enter / Space to play', false); });
  }
  video.addEventListener('playing', function () { pmsg('', false); paintPlayBtn(); });
  video.addEventListener('pause', function () { paintPlayBtn(); hud(); });
  video.addEventListener('waiting', function () { pmsg('', true); });
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
    if (!fallbackToProxy()) pmsg('Video error — the stream could not be played', false);
  });
  video.addEventListener('progress', function () {
    if (video.duration && video.buffered.length) $('seekBuf').style.width = video.buffered.end(video.buffered.length - 1) / video.duration * 100 + '%';
  });
  video.addEventListener('timeupdate', function () {
    var d = video.duration, t = video.currentTime;
    if (d) $('seekBar').style.width = t / d * 100 + '%';
    $('pTime').textContent = fmt(t) + ' / ' + fmt(d);
    if (Date.now() - state.lastSave > 5000 && t > 3 && d) { state.lastSave = Date.now(); setProg(state.anime, state.ep, t, d); }
  });
  video.addEventListener('ended', function () {
    var a = state.anime;
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
    state.token++;
    if (video.duration && video.currentTime > 3) setProg(state.anime, state.ep, video.currentTime, video.duration);
    stopVideo();
    if (document.fullscreenElement && document.exitFullscreen) { try { document.exitFullscreen(); } catch (e) {} }
    $('player').className = 'hidden';
    state.view = 'detail';
    paintDetailButtons(); renderEpisodes();
    var cur = $('dEps').querySelector('.cur');
    setFocus(cur || $('dPlay'));
  }
  function seek(sec) { if (video.duration) { video.currentTime = Math.max(0, Math.min(video.duration, video.currentTime + sec)); } hud(); }
  function togglePlay() { if (video.paused) { var p = video.play(); if (p && p.catch) p.catch(function () {}); } else video.pause(); hud(); }
  function stepEp(d) {
    var a = state.anime, n = state.ep + d;
    if (n < 1 || (a.episodes && n > a.episodes)) { toast(d > 0 ? 'This is the last episode' : 'This is the first episode'); return; }
    play(a, n, 0);
  }
  function toggleCC() {
    var tt = video.textTracks;
    if (!tt || !tt.length) { toast(state.hasSoftSubs ? 'Loading subtitles…' : 'English subtitles are built into this video'); return; }
    var on = tt[0].mode !== 'showing';
    for (var i = 0; i < tt.length; i++) tt[i].mode = on ? 'showing' : 'hidden';
    toast(on ? 'Subtitles on' : 'Subtitles off');
  }
  function toggleFS() {
    var p = $('player');
    if (document.fullscreenElement) document.exitFullscreen();
    else if (p.requestFullscreen) p.requestFullscreen();
  }
  function playerAct(a) {
    ({ back: closePlayer, toggle: togglePlay, rew: function () { seek(-10); }, ff: function () { seek(10); },
       prev: function () { stepEp(-1); }, next: function () { stepEp(1); }, cc: toggleCC, fs: toggleFS, quality: cycleQuality })[a]();
  }
  $('player').addEventListener('click', function (e) {
    var b = up(e.target, 'pbtn');
    if (b) { playerAct(b.getAttribute('data-act')); return; }
    if (e.target.id === 'seek' || e.target.parentNode.id === 'seek') {
      var r = $('seek').getBoundingClientRect();
      if (video.duration) video.currentTime = Math.max(0, Math.min(1, (e.clientX - r.left) / r.width)) * video.duration;
      hud(); return;
    }
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
    var roots = state.view === 'detail' ? [$('detail')] : [$('nav'), activeView()], out = [];
    roots.forEach(function (r) {
      var all = r.querySelectorAll('.focusable');
      for (var i = 0; i < all.length; i++) out.push(all[i]);
    });
    return out;
  }
  function activeView() { return $('view' + state.tab.charAt(0).toUpperCase() + state.tab.slice(1)); }
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
    if (e.id === 'heroPlay') { var h = state.hero[state.heroIdx]; if (h) { state.returnFocus = e; var p = getProg()[h.id]; play(h, p ? p.ep : 1); } return; }
    if (e.id === 'heroInfo') { var h2 = state.hero[state.heroIdx]; if (h2) openDetail(h2); return; }
    if (e.id === 'setSave') { store.set('ea_server', $('serverInput').value.trim()); $('setUsing').textContent = 'Currently using: ' + apiBase(); toast('Saved'); loadHome(); return; }
    if (e.id === 'setReset') { store.set('ea_server', ''); $('serverInput').value = ''; $('setUsing').textContent = 'Currently using: ' + apiBase(); toast('Reset to default'); loadHome(); return; }
    if (e.id === 'setTest') { testStreams(); return; }
    if (e.id === 'retryHome') { loadHome(); return; }
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

  function goBack() {
    if (state.view === 'player') closePlayer();
    else if (state.view === 'detail') closeDetail();
    else if (state.tab !== 'home') showTab('home', true);
    else if (IS_TV && window.tizen && tizen.application) tizen.application.getCurrentApplication().exit();
  }

  document.addEventListener('keydown', function (e) {
    var k = e.keyCode;
    if (state.view === 'player') {
      e.preventDefault();
      if (k === KEY.BACK || k === KEY.ESC || k === KEY.BKSP || k === KEY.STOP) closePlayer();
      else if (k === KEY.ENTER || k === KEY.SPACE || k === KEY.PLAYPAUSE || k === KEY.PLAY || k === KEY.PAUSE) togglePlay();
      else if (k === KEY.LEFT || k === KEY.RW) seek(-10);
      else if (k === KEY.RIGHT || k === KEY.FF) seek(10);
      else if (k === KEY.UP) seek(60);
      else if (k === KEY.DOWN) seek(-60);
      else if (k === 70) toggleFS();
      else if (k === 77) { video.muted = !video.muted; toast(video.muted ? 'Muted' : 'Unmuted'); }
      else if (k === 67) toggleCC();
      else if (k === 81) cycleQuality();
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
    switch (k) {
      case KEY.UP: e.preventDefault(); move('up'); break;
      case KEY.DOWN: e.preventDefault(); move('down'); break;
      case KEY.LEFT: e.preventDefault(); move('left'); break;
      case KEY.RIGHT: e.preventDefault(); move('right'); break;
      case KEY.ENTER: e.preventDefault(); if (state.focusEl) activate(state.focusEl); break;
      case KEY.BACK: case KEY.ESC: case KEY.BKSP: e.preventDefault(); goBack(); break;
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
    var f = up(e.target, 'focusable');
    if (!f) return;
    if (f !== state.focusEl) setFocus(f, true);
    activate(f);
  });
  $('searchInput').addEventListener('input', function () {
    clearTimeout(state.searchTimer);
    state.searchTimer = setTimeout(runSearch, 450);
  });
  ['viewHome', 'viewSearch', 'viewList', 'viewSettings'].forEach(function (id) {
    $(id).addEventListener('scroll', function () { $('nav').className = this.scrollTop > 40 ? 'solid' : ''; });
  });
  document.addEventListener('visibilitychange', function () { if (document.hidden && state.view === 'player') video.pause(); });

  // ======================= Init =======================
  try {
    if (window.tizen && tizen.tvinputdevice) {
      ['MediaPlayPause', 'MediaPlay', 'MediaPause', 'MediaStop', 'MediaFastForward', 'MediaRewind'].forEach(function (n) {
        try { tizen.tvinputdevice.registerKey(n); } catch (e) {}
      });
    }
  } catch (e) {}
  initPlayerIcons();
  buildChips();
  paintTabs();
  setFocus($('heroPlay'));
  loadHome();
})();
