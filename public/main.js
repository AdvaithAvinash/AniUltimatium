const VERCEL_API_URL = "YOUR_VERCEL_URL_HERE";

(function () {
  'use strict';
  var KEY = { UP: 38, DOWN: 40, LEFT: 37, RIGHT: 39, ENTER: 13, BACK: 10009, PLAY: 415, PAUSE: 19, PLAYPAUSE: 10252, STOP: 413, FF: 417, RW: 412 };
  var $ = function (id) { return document.getElementById(id); };
  var state = { view: 'home', focusEl: null, anime: null, ep: 1, hls: null, hudTimer: null };

  // ---------- API ----------
  function api(params) {
    var base = VERCEL_API_URL.replace(/\/+$/, '');
    var qs = Object.keys(params).map(function (k) { return k + '=' + encodeURIComponent(params[k]); }).join('&');
    return fetch(base + '/api?' + qs).then(function (r) {
      if (!r.ok) throw new Error('HTTP ' + r.status);
      return r.json();
    });
  }
  function setStatus(t) { $('status').textContent = t || ''; }

  // ---------- Home ----------
  function loadList(search) {
    setStatus('Loading...');
    $('grid').innerHTML = '';
    $('gridTitle').textContent = search ? 'Results for "' + search + '"' : 'Trending Now';
    var p = search ? api({ action: 'search', q: search }) : api({ action: 'trending' });
    p.then(function (d) {
      var list = d.results || [];
      setStatus(list.length ? '' : 'No results.');
      list.forEach(function (a) {
        var c = document.createElement('div');
        c.className = 'card focusable';
        c.innerHTML = '<img alt=""><div class="t"></div>';
        c.querySelector('img').src = a.cover || '';
        c.querySelector('.t').textContent = a.title;
        c.__anime = a;
        $('grid').appendChild(c);
      });
      var first = $('grid').firstChild;
      if (first) setFocus(first);
    }).catch(function (e) {
      setStatus(VERCEL_API_URL.indexOf('YOUR_VERCEL') === 0 ? 'Set VERCEL_API_URL in main.js' : 'Error: ' + e.message);
    });
  }

  // ---------- Detail ----------
  function openDetail(a) {
    state.anime = a;
    state.view = 'detail';
    $('home').classList.add('hidden');
    $('detail').classList.remove('hidden');
    $('detailCover').src = a.cover || '';
    $('detailTitle').textContent = a.title;
    $('detailMeta').textContent = [a.format, a.year, a.score ? '★ ' + a.score : ''].filter(Boolean).join('  •  ');
    $('detailDesc').textContent = a.description || '';
    var n = a.episodes || 12;
    var box = $('episodes');
    box.innerHTML = '';
    for (var i = 1; i <= n; i++) {
      var b = document.createElement('div');
      b.className = 'ep focusable';
      b.textContent = i;
      b.__ep = i;
      box.appendChild(b);
    }
    setFocus(box.firstChild || $('detailBack'));
  }
  function closeDetail() {
    state.view = 'home';
    $('detail').classList.add('hidden');
    $('home').classList.remove('hidden');
    var cards = $('grid').children, target = null;
    for (var i = 0; i < cards.length; i++) if (cards[i].__anime === state.anime) target = cards[i];
    setFocus(target || $('searchInput'));
  }

  // ---------- Player ----------
  function msg(t) { $('playerMsg').textContent = t || ''; showHud(); }
  function showHud() {
    var h = $('playerHud');
    h.classList.remove('fade');
    clearTimeout(state.hudTimer);
    state.hudTimer = setTimeout(function () { h.classList.add('fade'); }, 4000);
  }
  function play(ep) {
    state.ep = ep;
    state.view = 'player';
    $('player').classList.remove('hidden');
    $('playerTitle').textContent = state.anime.title + ' — Episode ' + ep;
    msg('Finding English-subbed stream...');
    api({ action: 'sources', title: state.anime.title, alt: state.anime.titleNative || '', ep: ep })
      .then(function (d) {
        if (!d.url) throw new Error(d.error || 'No stream found');
        startVideo(d);
      }).catch(function (e) { msg('Failed: ' + e.message + ' (Back to return)'); });
  }
  function startVideo(d) {
    var v = $('video');
    stopVideo(true);
    // clear old subtitle tracks
    while (v.firstChild) v.removeChild(v.firstChild);
    (d.subtitles || []).forEach(function (s) {
      var t = document.createElement('track');
      t.kind = 'subtitles'; t.label = s.lang || 'English'; t.srclang = 'en'; t.src = s.url;
      if (/english/i.test(s.lang || '') || s.default) t.default = true;
      v.appendChild(t);
    });
    var isHls = /\.m3u8|m3u8/i.test(d.url) || d.type === 'hls';
    if (isHls && window.Hls && Hls.isSupported()) {
      state.hls = new Hls({ maxBufferLength: 30 });
      state.hls.loadSource(d.url);
      state.hls.attachMedia(v);
      state.hls.on(Hls.Events.ERROR, function (_, e) { if (e.fatal) msg('Playback error: ' + e.details); });
    } else {
      v.src = d.url; // native HLS (Tizen) or mp4
    }
    v.onplaying = function () { msg(''); };
    v.onwaiting = function () { msg('Buffering...'); };
    v.onerror = function () { msg('Video error'); };
    v.ontimeupdate = function () { if (v.duration) $('progressBar').style.width = (v.currentTime / v.duration * 100) + '%'; };
    v.onended = function () { if (state.anime.episodes && state.ep < state.anime.episodes) play(state.ep + 1); };
    var pr = v.play(); if (pr && pr.catch) pr.catch(function () {});
  }
  function stopVideo(keepEl) {
    var v = $('video');
    if (state.hls) { state.hls.destroy(); state.hls = null; }
    try { v.pause(); v.removeAttribute('src'); v.load(); } catch (e) {}
  }
  function closePlayer() {
    stopVideo();
    $('player').classList.add('hidden');
    state.view = 'detail';
  }
  function seek(sec) { var v = $('video'); v.currentTime = Math.max(0, v.currentTime + sec); showHud(); }
  function togglePlay() { var v = $('video'); if (v.paused) v.play(); else v.pause(); showHud(); }

  // ---------- Spatial navigation ----------
  function setFocus(el) {
    if (!el) return;
    if (state.focusEl) state.focusEl.classList.remove('focused');
    if (document.activeElement === $('searchInput') && el !== $('searchInput')) $('searchInput').blur();
    state.focusEl = el;
    el.classList.add('focused');
    if (el.scrollIntoView && !el.classList.contains('ep')) {
      var g = $('grid');
      if (g.contains(el)) {
        var shift = Math.max(0, el.offsetTop - 20);
        var rowTop = el.offsetTop;
        g.style.transform = 'translateY(' + (-Math.max(0, rowTop - 20)) + 'px)';
      }
    }
  }
  function visibleFocusables() {
    var root = state.view === 'detail' ? $('detail') : $('app');
    var all = root.querySelectorAll('.focusable');
    var out = [];
    for (var i = 0; i < all.length; i++) {
      if (state.view === 'home' && $('detail').contains(all[i])) continue;
      out.push(all[i]);
    }
    return out;
  }
  function center(el) {
    var r = el.getBoundingClientRect();
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  }
  function move(dir) {
    var cur = state.focusEl;
    if (!cur) { var f = visibleFocusables()[0]; if (f) setFocus(f); return; }
    var c = center(cur), best = null, bestScore = Infinity;
    visibleFocusables().forEach(function (el) {
      if (el === cur) return;
      var p = center(el), dx = p.x - c.x, dy = p.y - c.y, main, off;
      if (dir === 'left') { main = -dx; off = Math.abs(dy); }
      else if (dir === 'right') { main = dx; off = Math.abs(dy); }
      else if (dir === 'up') { main = -dy; off = Math.abs(dx); }
      else { main = dy; off = Math.abs(dx); }
      if (main <= 1) return;
      var score = main + off * 3;
      if (score < bestScore) { bestScore = score; best = el; }
    });
    if (best) setFocus(best);
  }
  function activate(el) {
    if (el.id === 'searchInput') { el.focus(); return; }
    if (el.id === 'searchBtn') { var q = $('searchInput').value.trim(); loadList(q); return; }
    if (el.id === 'detailBack') { closeDetail(); return; }
    if (el.__anime) { openDetail(el.__anime); return; }
    if (el.__ep) { play(el.__ep); }
  }

  document.addEventListener('keydown', function (e) {
    var k = e.keyCode;
    if (state.view === 'player') {
      e.preventDefault();
      if (k === KEY.BACK || k === KEY.STOP) closePlayer();
      else if (k === KEY.ENTER || k === KEY.PLAYPAUSE || k === KEY.PLAY || k === KEY.PAUSE) togglePlay();
      else if (k === KEY.LEFT || k === KEY.RW) seek(-10);
      else if (k === KEY.RIGHT || k === KEY.FF) seek(10);
      else if (k === KEY.UP) seek(60);
      else if (k === KEY.DOWN) seek(-60);
      return;
    }
    var typing = document.activeElement === $('searchInput');
    if (typing) {
      if (k === KEY.ENTER) { e.preventDefault(); $('searchInput').blur(); loadList($('searchInput').value.trim()); return; }
      if (k === KEY.BACK) { e.preventDefault(); $('searchInput').blur(); return; }
      if (k === KEY.DOWN) { e.preventDefault(); $('searchInput').blur(); move('down'); }
      return; // let left/right/chars edit text
    }
    switch (k) {
      case KEY.UP: e.preventDefault(); move('up'); break;
      case KEY.DOWN: e.preventDefault(); move('down'); break;
      case KEY.LEFT: e.preventDefault(); move('left'); break;
      case KEY.RIGHT: e.preventDefault(); move('right'); break;
      case KEY.ENTER: e.preventDefault(); if (state.focusEl) activate(state.focusEl); break;
      case KEY.BACK:
        e.preventDefault();
        if (state.view === 'detail') closeDetail();
        else if ($('gridTitle').textContent !== 'Trending Now') loadList('');
        else if (window.tizen && tizen.application) tizen.application.getCurrentApplication().exit();
        break;
    }
  });

  // ---------- Init ----------
  try {
    if (window.tizen && tizen.tvinputdevice) {
      ['MediaPlayPause', 'MediaPlay', 'MediaPause', 'MediaStop', 'MediaFastForward', 'MediaRewind'].forEach(function (n) {
        try { tizen.tvinputdevice.registerKey(n); } catch (e) {}
      });
    }
  } catch (e) {}
  setFocus($('searchInput'));
  loadList('');
})();
