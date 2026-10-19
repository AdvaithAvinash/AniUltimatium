// Sponsor ads, the honest kind: videos and pictures the project owner chose himself, listed in `sponsor.json` (repository root, edited on GitHub, no new release needed).
//   Pre-roll: one labelled "Ad" video before a title starts (anime: once per app session; movies / TV: once per different title). Skippable after `skipAfter` seconds (default 20).
//   Pause ad: a labelled picture shown for 15 s while the viewer has paused a video; it can be switched off in Settings.
// No ad network, no third-party script, no tracking, no click-through links (nothing here can open a page), nothing during playback. If the ad cannot load, playback simply starts.
// Plain ES5 (Tizen 4); the pure functions are also exported for the unit tests.
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api; else root.SponsorSlot = api;
})(this, function () {
  'use strict';
  var CONFIG_URL = 'https://raw.githubusercontent.com/AdvaithAvinash/AniUltimatium/main/sponsor.json';
  var TTL = 6 * 3600 * 1000, PAUSE_MS = 15000;

  function httpsUrl(u) { return typeof u === 'string' && /^https:\/\/[^\s"'<>]+$/i.test(u) && u.length < 1000; }
  function day(s) { var t = Date.parse(String(s || '') + 'T00:00:00'); return isNaN(t) ? null : t; }
  function inDates(it, now) {
    var f = day(it.from), t = day(it.to);
    if (f !== null && now < f) return false;
    if (t !== null && now >= t + 86400000) return false;                                 // `to` = the whole last day
    return true;
  }
  function validVideo(it, now) { return !!it && httpsUrl(it.video) && /\.(mp4|webm|m4v)(\?|#|$)/i.test(it.video) && inDates(it, now); }
  function validImage(it, now) { return !!it && httpsUrl(it.image) && inDates(it, now); }
  // Weighted random among the usable items (weight defaults to 1). rnd = a number in [0,1).
  function pickFrom(list, ok, now, rnd) {
    if (!list || !list.length) return null;
    var use = list.filter(function (x) { return ok(x, now); });
    if (!use.length) return null;
    var total = 0, i, w = function (x) { return Math.max(0, +x.weight || 1); };
    for (i = 0; i < use.length; i++) total += w(use[i]);
    var r = (rnd || 0) * total;
    for (i = 0; i < use.length; i++) { r -= w(use[i]); if (r < 0) return use[i]; }
    return use[use.length - 1];
  }
  function pickVideo(cfg, now, rnd) { return cfg && cfg.enabled === true ? pickFrom(cfg.preroll, validVideo, now, rnd) : null; }
  function pickImage(cfg, now, rnd) { return cfg && cfg.enabled === true ? pickFrom(cfg.pause, validImage, now, rnd) : null; }
  // A network banner (e.g. Adsterra "Banner", format iframe): { key: 32 hex, src: https script url, width, height }. It only ever runs inside a sandboxed frame (see showPause).
  function validBanner(b) {
    return !!b && /^[0-9a-f]{32}$/i.test(b.key || '') && httpsUrl(b.src) && b.src.indexOf(b.key) > 0 && +b.width >= 100 && +b.width <= 970 && +b.height >= 50 && +b.height <= 600;
  }
  // Where to show the banner: a page on the registered site (own origin: the ad script cannot reach the app's data) when the app runs from a different origin (TV / Android package),
  // otherwise null -> no network banner (a no-origin sandbox is refused by the network, and a page of the app's own origin would hand the ad script the app's storage). Never the page's own origin: allow-same-origin there would hand the ad script the app's storage.
  function framePage(b, origin) {
    if (!b || !httpsUrl(b.page) || !origin) return null;
    var m = /^(https:\/\/[^\/]+)\//i.exec(b.page); if (!m || m[1].toLowerCase() === String(origin).toLowerCase()) return null;
    return b.page;
  }
  // Is a pre-roll due for this title? seen = { anime: bool, last: 'kind:id' of the last movie / TV title that got one }
  function due(seen, kind, id) {
    if (kind === 'anime') return !seen.anime;
    return seen.last !== kind + ':' + id;
  }
  // Seconds before Skip appears: the ad's own setting (5..30, default 20), never more than the video is long
  function skipAfter(it, duration) {
    var s = +it.skipAfter; if (!(s >= 5 && s <= 30)) s = 20;
    if (duration && duration > 2) s = Math.min(s, Math.max(0, Math.floor(duration) - 1));
    return s;
  }
  var api = { framePage: framePage, validBanner: validBanner, validVideo: validVideo, validImage: validImage, pickVideo: pickVideo, pickImage: pickImage, due: due, skipAfter: skipAfter, httpsUrl: httpsUrl, CONFIG_URL: CONFIG_URL, PAUSE_MS: PAUSE_MS };

  if (typeof window === 'undefined' || !window.EA) return api;
  // ------------------------------------------------------------------ in the app
  var EA = window.EA, $ = EA.$, el = EA.el, esc = EA.esc, store = EA.store, state = EA.state, video = EA.video;
  var cfg = null, seen = { anime: false, last: '' };

  function pauseOn() { return store.get('ea_pauseads', true) !== false; }
  function getConfig(cb) {
    var c = store.get('ea_sponsor_cfg', null);
    if (c && Date.now() - c.t < TTL) { cfg = c.d; cb && cb(); return; }
    cfg = c && c.d || null;                                                              // offline: the last good copy, or nothing
    if (!window.fetch) { cb && cb(); return; }
    fetch(CONFIG_URL, { cache: 'no-store' }).then(function (r) { return r.ok ? r.json() : Promise.reject(new Error('x')); }).then(function (j) {
      if (j && typeof j === 'object') { cfg = j; store.set('ea_sponsor_cfg', { t: Date.now(), d: j }); }
      cb && cb();
    }).catch(function () { cb && cb(); });
  }
  function kindOf(a) { return a.kind === 'movie' ? 'movie' : a.kind === 'tv' ? 'tv' : 'anime'; }

  // ---- pre-roll ----
  var ad = null;
  function wants(a) {                                                                    // synchronous: the config is fetched at start-up, so a slow network never delays playback
    return !ad && !!pickVideo(cfg, Date.now(), 0.5) && due(seen, kindOf(a), a.id);
  }
  function preroll(a, done) {                                                            // done(true) = go on and play, done(false) = the viewer left
    var it = pickVideo(cfg, Date.now(), Math.random()); if (!it) { done(true); return; }
    var kind = kindOf(a), started = false, finished = false, last = 0, lastAt = Date.now(), t0 = Date.now(), skipAt = skipAfter(it, 0), timer;
    var box = el('div', 'adbox', '<video class="advid" playsinline></video><div class="ad-tag">Ad <span class="ad-left"></span></div><div class="ad-skip"></div><div class="ad-bar"><i></i></div>');
    var v = box.querySelector('video'), left = box.querySelector('.ad-left'), skipEl = box.querySelector('.ad-skip'), bar = box.querySelector('i');
    ad = box; document.body.appendChild(box); try { video.pause(); } catch (e) { /* ignore */ }
    function finish(go) {
      if (finished) return; finished = true; clearInterval(timer); document.removeEventListener('keydown', onKey, true);
      try { v.pause(); v.removeAttribute('src'); v.load(); } catch (e) { /* ignore */ }
      if (box.parentNode) box.parentNode.removeChild(box);
      ad = null; done(go);
    }
    function canSkip() { return started && v.currentTime >= skipAt; }
    function onKey(e) {
      e.preventDefault(); e.stopPropagation(); var k = e.keyCode;
      if (k === EA.KEY.ENTER || k === 13) { if (canSkip()) finish(true); }
      else if (EA.isBackKey(k) || k === EA.KEY.STOP) finish(false);
    }
    document.addEventListener('keydown', onKey, true);
    box.onclick = function () { if (canSkip()) finish(true); };
    v.addEventListener('playing', function () {
      if (!started) { started = true; seen.last = kind === 'anime' ? seen.last : kind + ':' + a.id; if (kind === 'anime') seen.anime = true; }    // only a shown ad counts
    });
    v.addEventListener('ended', function () { finish(true); });
    v.addEventListener('error', function () { finish(true); });                           // a broken ad never blocks playback
    timer = setInterval(function () {
      var t = v.currentTime || 0, d = v.duration || 0;
      if (t !== last) { last = t; lastAt = Date.now(); }
      if (!started && Date.now() - t0 > 10000) { finish(true); return; }                 // never started
      if (started && Date.now() - lastAt > 12000) { finish(true); return; }               // froze
      if (!started) return;
      skipAt = skipAfter(it, d);
      left.textContent = d ? '· ' + Math.max(0, Math.ceil(d - t)) + 's' : '';
      bar.style.width = (d ? Math.min(100, t / d * 100) : 0) + '%';
      skipEl.className = 'ad-skip' + (canSkip() ? ' ok' : '');
      skipEl.textContent = canSkip() ? 'Skip ad  (OK)' : 'You can skip in ' + Math.max(0, Math.ceil(skipAt - t)) + 's';
    }, 250);
    v.src = it.video; var p = v.play(); if (p && p.catch) p.catch(function () { finish(true); });
  }

  // ---- pause ad ----
  var pbox = null, ptimer = null, pwait = null, adMsg = null;
  function listenAd(frame, box) {
    if (adMsg) window.removeEventListener('message', adMsg);
    adMsg = function (e) { if (e.data === 'ea-ad:ok' && frame.contentWindow && e.source === frame.contentWindow && pbox === box) box.style.visibility = 'visible'; };
    window.addEventListener('message', adMsg);
  }
  function hidePause() { clearTimeout(ptimer); clearTimeout(pwait); if (pbox) { if (pbox.parentNode) pbox.parentNode.removeChild(pbox); pbox = null; document.removeEventListener('keydown', hidePause, true); }
    if (adMsg) { window.removeEventListener('message', adMsg); adMsg = null; } }
  function showPause() {
    if (pbox || !pauseOn() || state.view !== 'player' || state.liveOn || state.embed || !video.paused || video.ended || !video.currentTime) return;
    if (EA.lite && EA.lite()) return;
    var it = pickImage(cfg, Date.now(), Math.random()), bn = cfg && cfg.enabled === true && validBanner(cfg.banner) && framePage(cfg.banner, window.location.origin || 'null') ? cfg.banner : null;
    if (!it && !bn) return;
    if (it && bn && Math.random() < 0.5) it = null;                                    // both set: they take turns
    if (!it) {                                                                          // network banner: shown from the ad page in a frame with NO popups and NO top navigation, in an origin of its own
      var box = el('div', 'pausead', '<p class="pa-note">You can turn off these pause ads in settings.</p><div class="pa-card pa-net" style="width:' + (+bn.width) + 'px;height:' + (+bn.height) + 'px"><span class="ad-tag">Ad</span></div>');
      var f = document.createElement('iframe'); f.setAttribute('scrolling', 'no'); f.setAttribute('sandbox', 'allow-scripts allow-same-origin');   // same-origin = the ad page's OWN origin, not the app's
      f.style.cssText = 'border:0;width:' + (+bn.width) + 'px;height:' + (+bn.height) + 'px;display:block'; f.src = bn.page;
      box.querySelector('.pa-card').insertBefore(f, box.querySelector('.ad-tag'));
      box.style.width = (+bn.width) + 'px'; box.style.visibility = 'hidden';            // invisible until the network really delivered an ad: no black box, no note without an ad
      pbox = box; listenAd(f, box);
    } else {
      pbox = el('div', 'pausead', '<p class="pa-note">You can turn off these pause ads in settings.</p><div class="pa-card"><img alt="' + esc(it.alt || 'Sponsor') + '" src="' + esc(it.image) + '"><span class="ad-tag">Ad</span></div>');
      pbox.querySelector('img').onerror = hidePause;
    }
    document.body.appendChild(pbox); document.addEventListener('keydown', hidePause, true);   // any key puts it away (the key itself still reaches the player)
    ptimer = setTimeout(hidePause, PAUSE_MS);
  }
  video.addEventListener('pause', function () { hidePause(); pwait = setTimeout(showPause, 900); });    // a short wait so a seek's brief pause shows nothing
  video.addEventListener('play', hidePause);
  video.addEventListener('playing', hidePause);
  video.addEventListener('seeking', hidePause);

  EA.sponsor = { wants: wants, preroll: preroll, hidePause: hidePause, reload: getConfig };
  getConfig();
  return api;
});
