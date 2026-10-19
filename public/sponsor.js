// Sponsor ads, the honest kind: videos and pictures the project owner chose himself, listed in `sponsor.json` (repository root, edited on GitHub, no new release needed).
//   Pre-roll: one labelled "Ad" video before a title starts (anime: once per app session; movies / TV: once per different title). Skippable after `skipAfter` seconds (default 20).
//   Pause ad: a labelled picture shown for 15 s while the viewer has paused a video.
// No ad network, no third-party script, no tracking, no click-through links (nothing here can open a page), nothing during playback. If the ad cannot load, playback simply starts.
// Plain ES5 (Tizen 4); the pure functions are also exported for the unit tests.
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api; else root.SponsorSlot = api;
})(this, function () {
  'use strict';
  var CONFIG_URL = 'https://raw.githubusercontent.com/AdvaithAvinash/AniUltimatium/main/sponsor.json';
  var TTL = 10 * 60 * 1000, PAUSE_MS = 15000;

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
  // A network banner: { page: https url of the ad page on the registered site (the network's tag lives in that page, never in the app), width, height }. It only ever runs inside a sandboxed frame (see showPause).
  function validBanner(b) {
    return !!b && httpsUrl(b.page) && +b.width >= 100 && +b.width <= 970 && +b.height >= 50 && +b.height <= 600;
  }
  // The banner is shown from a real page on the registered site (`page`), never from srcdoc (the network refuses a frame with no address).
  // Another origin than the app (TV / Android package): the page keeps its own origin. The website itself: the page would share the app's origin, so the frame is sandboxed WITHOUT
  // allow-same-origin there (opaque origin: the ad script cannot read the app's storage). Never allow-popups / allow-top-navigation.
  function frameSandbox(b, origin) {
    if (!b || !httpsUrl(b.page)) return null;
    var m = /^(https:\/\/[^\/]+)\//i.exec(b.page); if (!m) return null;
    return origin && m[1].toLowerCase() === String(origin).toLowerCase() ? 'allow-scripts' : 'allow-scripts allow-same-origin';
  }
  // Is a pre-roll due? seen = { animeDay: 'YYYY-MM-DD' of the last anime ad, last: 'kind:id' of the last movie / TV title that got one }.
  // Anime: one ad per day. Movies / TV: one per different title (not per episode).
  function due(seen, kind, id, today) {
    if (kind === 'anime') return seen.animeDay !== today;
    return seen.last !== kind + ':' + id;
  }
  // VAST: which video file to play. Progressive MP4 (or WebM) over https, the one closest to 720p, MP4 before WebM. No streaming (HLS / DASH) files.
  function pickMedia(files) {
    var best = null, bestScore = 1e9;
    (files || []).forEach(function (f) {
      if (!f || !httpsUrl(f.url) || String(f.delivery || 'progressive').toLowerCase() === 'streaming') return;
      var t = String(f.type || '').toLowerCase(); if (!/^video\/(mp4|webm|x-m4v)$/.test(t)) return;
      var sc = Math.abs((+f.height || 720) - 720) * 10 + (t === 'video/webm' ? 100000 : 0) + (+f.bitrate || 0) / 1000;
      if (sc < bestScore) { bestScore = sc; best = f; }
    });
    return best;
  }
  // A VAST ad can hold several creatives (e.g. 1:33 and 0:20): use ONE of them, the first with a playable file that is 45 s or shorter, else the shortest. cands: [{ dur (s), media: [...], track: {...} }]
  function chooseLinear(cands) {
    var best = null, bf = null, bs = 1e9;
    (cands || []).forEach(function (c, i) {
      var f = pickMedia(c.media); if (!f) return;
      var sc = (c.dur > 45 ? 1000 + c.dur : 0) + i; if (!c.dur) sc = 500 + i;
      if (sc < bs) { bs = sc; best = c; bf = f; }
    });
    return best ? { cand: best, file: bf } : null;
  }
  function fillMacros(u, code) {                                                       // the VAST macros a tag or a tracking url may contain
    var now = String(Date.now());
    return String(u).replace(/\[(TIMESTAMP|CACHEBUSTING|RANDOM)\]|%5B(TIMESTAMP|CACHEBUSTING|RANDOM)%5D/gi, now).replace(/\[ERRORCODE\]|%5BERRORCODE%5D/gi, String(code || 900)).replace(/\[CONTENTPLAYHEAD\]|%5BCONTENTPLAYHEAD%5D/gi, '00:00:00.000');
  }
  // Seconds before Skip appears: the ad's own setting (5..30, default 20), never more than the video is long
  function skipAfter(it, duration) {
    var s = +it.skipAfter; if (!(s >= 5 && s <= 30)) s = 20;
    if (duration && duration > 2) s = Math.min(s, Math.max(0, Math.floor(duration) - 1));
    return s;
  }
  var api = { chooseLinear: chooseLinear, pickMedia: pickMedia, fillMacros: fillMacros, frameSandbox: frameSandbox, validBanner: validBanner, validVideo: validVideo, validImage: validImage, pickVideo: pickVideo, pickImage: pickImage, due: due, skipAfter: skipAfter, httpsUrl: httpsUrl, CONFIG_URL: CONFIG_URL, PAUSE_MS: PAUSE_MS };

  if (typeof window === 'undefined' || !window.EA) return api;
  // ------------------------------------------------------------------ in the app
  var EA = window.EA, $ = EA.$, el = EA.el, esc = EA.esc, store = EA.store, state = EA.state, video = EA.video;
  var cfg = null, seen = { animeDay: store.get('ea_ad_day', ''), last: '' };
  function today() { var d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function beacon(u) { if (!httpsUrl(u)) return; try { new Image().src = fillMacros(u); } catch (e) { /* ignore */ } }      // VAST tracking pixel: what the ad network counts and pays for

  function getConfig(cb, force) {
    var c = store.get('ea_sponsor_cfg', null);
    if (!force && c && Date.now() - c.t < TTL) { cfg = c.d; cb && cb(); return; }
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
  function vastUrl() { return cfg && cfg.enabled === true && cfg.vast && httpsUrl(cfg.vast.url) ? cfg.vast.url : null; }
  function wants(a) {                                                                    // synchronous: the config is fetched at start-up, so a slow network never delays playback
    if (ad || !cfg || cfg.enabled !== true) return false;
    return (!!vastUrl() || !!pickVideo(cfg, Date.now(), 0.5)) && due(seen, kindOf(a), a.id, today());
  }
  // ---- VAST 2 / 3 (wrappers followed up to 3 deep). Only the video file and the tracking pixels are used: no click-through, no ad scripts, no verification code is run. ----
  function parseVast(text) {
    var doc; try { doc = new DOMParser().parseFromString(text, 'text/xml'); } catch (e) { return null; }
    var ad0 = doc.getElementsByTagName('Ad')[0]; if (!ad0) return null;
    var txt = function (n) { return String(n.textContent || '').replace(/^\s+|\s+$/g, ''); }, out = { imps: [], errors: [], lin: [], next: '' }, i, n;
    n = ad0.getElementsByTagName('VASTAdTagURI')[0]; if (n) out.next = txt(n);
    var list = ad0.getElementsByTagName('Impression'); for (i = 0; i < list.length; i++) out.imps.push(txt(list[i]));
    list = ad0.getElementsByTagName('Error'); for (i = 0; i < list.length; i++) out.errors.push(txt(list[i]));
    var lin = ad0.getElementsByTagName('Linear'), j, k;
    for (i = 0; i < lin.length; i++) {                                                   // one candidate per creative: its files, its duration, its own tracking events
      var c = { dur: 0, media: [], track: {} }, d = lin[i].getElementsByTagName('Duration')[0], hms = d ? /(\d+):(\d+):(\d+)/.exec(txt(d)) : null;
      if (hms) c.dur = +hms[1] * 3600 + +hms[2] * 60 + +hms[3];
      var tr = lin[i].getElementsByTagName('Tracking'); for (j = 0; j < tr.length; j++) { var ev = tr[j].getAttribute('event'); if (ev) (c.track[ev] = c.track[ev] || []).push(txt(tr[j])); }
      var mf = lin[i].getElementsByTagName('MediaFile'); for (k = 0; k < mf.length; k++) { var m = mf[k]; c.media.push({ url: txt(m), type: m.getAttribute('type'), delivery: m.getAttribute('delivery'), width: +m.getAttribute('width'), height: +m.getAttribute('height'), bitrate: +m.getAttribute('bitrate') }); }
      out.lin.push(c);
    }
    return out;
  }
  var vastWhy = '';
  function fetchVast(url, depth, acc, cb) {
    var done = false, timer = setTimeout(function () { vastWhy = vastWhy || 'the ad server did not answer in time'; fin(null); }, 6000);
    function fin(r) { if (done) return; done = true; clearTimeout(timer); cb(r); }
    if (!window.fetch || !window.DOMParser || depth > 3) { vastWhy = 'this browser cannot read VAST'; fin(null); return; }
    fetch(fillMacros(url), { credentials: 'omit', cache: 'no-store' }).then(function (r) { return r.ok ? r.text() : Promise.reject(new Error('x')); }).then(function (t) {
      var v = parseVast(t); if (!v) { vastWhy = 'the ad server answered with no ad (nothing to show right now)'; fin(null); return; }
      acc.imps = acc.imps.concat(v.imps); acc.errors = acc.errors.concat(v.errors);
      acc.wtrack = acc.wtrack.concat(v.lin.map(function (c) { return c.track; }));                // a wrapper's tracking events also count
      var pick = chooseLinear(v.lin);
      if (v.next && !pick) { clearTimeout(timer); done = true; fetchVast(v.next, depth + 1, acc, cb); return; }
      if (!pick) { vastWhy = 'the ad has no playable video file'; fin(null); return; }
      var track = {}; acc.wtrack.concat([pick.cand.track]).forEach(function (t) { Object.keys(t).forEach(function (e) { track[e] = (track[e] || []).concat(t[e]); }); });
      fin({ video: pick.file.url, vast: { imps: acc.imps, errors: acc.errors, track: track } });
    }).catch(function () { vastWhy = vastWhy || 'the request was blocked or failed (ad blocker, network, or the ad server refused it)'; fin(null); });
  }
  function resolveAd(cb) {                                                               // a VAST ad if the tag is set and fills, else one of the owner's own videos, else nothing
    function own() { cb(pickVideo(cfg, Date.now(), Math.random())); }
    var u = vastUrl(); if (!u) { own(); return; }
    fetchVast(u, 0, { imps: [], errors: [], wtrack: [] }, function (r) { if (r) cb(r); else own(); });
  }
  function preroll(a, done) {                                                            // done(true) = go on and play, done(false) = the viewer left
    var kind = kindOf(a), started = false, finished = false, last = 0, lastAt = Date.now(), t0 = Date.now(), it = null, skipAt = 20, timer, sent = {}, vast = null, skipped = false;
    var box = el('div', 'adbox', '<video class="advid" playsinline></video><div class="ad-tag">Ad <span class="ad-left"></span></div><div class="ad-skip">Loading ad…</div><div class="ad-bar"><i></i></div>');
    var v = box.querySelector('video'), left = box.querySelector('.ad-left'), skipEl = box.querySelector('.ad-skip'), bar = box.querySelector('i');
    ad = box; document.body.appendChild(box); try { video.pause(); } catch (e) { /* ignore */ }
    function ev(name) { if (!vast || sent[name]) return; sent[name] = 1; (vast.track[name] || []).forEach(beacon); }
    function finish(go, code) {
      if (finished) return; finished = true; clearInterval(timer); document.removeEventListener('keydown', onKey, true);
      if (vast && !started && code) vast.errors.forEach(function (u) { beacon(fillMacros(u, code)); });
      if (skipped) ev('skip');
      try { v.pause(); v.removeAttribute('src'); v.load(); } catch (e) { /* ignore */ }
      if (box.parentNode) box.parentNode.removeChild(box);
      ad = null; done(go);
    }
    function canSkip() { return started && v.currentTime >= skipAt; }
    function onKey(e) {
      e.preventDefault(); e.stopPropagation(); var k = e.keyCode;
      if (k === EA.KEY.ENTER || k === 13) { if (canSkip()) { skipped = true; finish(true); } }
      else if (EA.isBackKey(k) || k === EA.KEY.STOP) finish(false);
    }
    document.addEventListener('keydown', onKey, true);
    box.onclick = function () { if (canSkip()) { skipped = true; finish(true); } };
    v.addEventListener('playing', function () {
      if (started) return; started = true;                                              // only a shown ad counts
      if (kind === 'anime') { seen.animeDay = today(); store.set('ea_ad_day', seen.animeDay); } else seen.last = kind + ':' + a.id;
      if (vast) { vast.imps.forEach(beacon); ev('creativeView'); ev('start'); }
    });
    v.addEventListener('ended', function () { ev('complete'); finish(true); });
    v.addEventListener('error', function () { finish(true, 405); });                      // a broken ad never blocks playback
    resolveAd(function (r) {
      if (finished) return;
      if (!r) { finish(true, 303); return; }                                              // no ad to show: just play
      it = r; vast = r.vast || null; t0 = Date.now(); skipAt = skipAfter(it, 0);
      timer = setInterval(function () {
        var t = v.currentTime || 0, d = v.duration || 0;
        if (t !== last) { last = t; lastAt = Date.now(); }
        if (!started && Date.now() - t0 > 10000) { finish(true, 402); return; }          // never started
        if (started && Date.now() - lastAt > 12000) { finish(true); return; }            // froze
        if (!started) return;
        skipAt = skipAfter(it, d);
        if (d) { if (t >= d * 0.25) ev('firstQuartile'); if (t >= d * 0.5) ev('midpoint'); if (t >= d * 0.75) ev('thirdQuartile'); }
        left.textContent = d ? '· ' + Math.max(0, Math.ceil(d - t)) + 's' : '';
        bar.style.width = (d ? Math.min(100, t / d * 100) : 0) + '%';
        skipEl.className = 'ad-skip' + (canSkip() ? ' ok' : '');
        skipEl.textContent = canSkip() ? 'Skip ad  (OK)' : 'You can skip in ' + Math.max(0, Math.ceil(skipAt - t)) + 's';
      }, 250);
      v.src = it.video; var pr = v.play(); if (pr && pr.catch) pr.catch(function () { finish(true, 405); });
    });
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
    if (pbox || state.view !== 'player' || state.liveOn || state.embed || !video.paused || video.ended || !video.currentTime) return;
    if (EA.lite && EA.lite()) return;
    var it = pickImage(cfg, Date.now(), Math.random()), bn = cfg && cfg.enabled === true && validBanner(cfg.banner) && frameSandbox(cfg.banner, window.location.origin) ? cfg.banner : null;
    if (!it && !bn) return;
    if (it && bn && Math.random() < 0.5) it = null;                                    // both set: they take turns
    if (!it) {                                                                          // network banner: shown from the ad page in a frame with NO popups and NO top navigation, in an origin of its own
      var box = el('div', 'pausead', '<div class="pa-card pa-net" style="width:' + (+bn.width) + 'px;height:' + (+bn.height) + 'px"><span class="ad-tag">Ad</span></div>');
      var f = document.createElement('iframe'); f.setAttribute('scrolling', 'no'); f.setAttribute('sandbox', frameSandbox(bn, window.location.origin));   // never the app's own origin: the website gets a no-origin sandbox, the TV / Android app the ad page's own origin
      f.style.cssText = 'border:0;width:' + (+bn.width) + 'px;height:' + (+bn.height) + 'px;display:block'; f.src = bn.page;
      box.querySelector('.pa-card').insertBefore(f, box.querySelector('.ad-tag'));
      box.style.width = (+bn.width) + 'px'; box.style.visibility = 'hidden';            // invisible until the network really delivered an ad: no black box, no note without an ad
      pbox = box; listenAd(f, box);
    } else {
      pbox = el('div', 'pausead', '<div class="pa-card"><img alt="' + esc(it.alt || 'Sponsor') + '" src="' + esc(it.image) + '"><span class="ad-tag">Ad</span></div>');
      pbox.querySelector('img').onerror = hidePause;
    }
    document.body.appendChild(pbox); document.addEventListener('keydown', hidePause, true);   // any key puts it away (the key itself still reaches the player)
    ptimer = setTimeout(hidePause, PAUSE_MS);
  }
  video.addEventListener('pause', function () { hidePause(); pwait = setTimeout(showPause, 900); });    // a short wait so a seek's brief pause shows nothing
  video.addEventListener('play', hidePause);
  video.addEventListener('playing', hidePause);
  video.addEventListener('seeking', hidePause);

  // ---- Ad check (Settings): what the ad setup can do on THIS device right now, so a missing ad can be explained ----
  function check() {
    closeSupport();
    modal = el('div', 'sponmodal', '<div class="sm-box"><h3>Ad check</h3><div id="adChk" style="text-align:left;font-size:1.3rem;line-height:1.7;color:#cfcfd6">Checking…</div><p class="sm-hint">Press OK or Back to close</p></div>');
    document.body.appendChild(modal); document.addEventListener('keydown', supKey, true); modal.onclick = closeSupport;
    var lines = [], out = function () { var n = $('adChk'); if (n) n.innerHTML = lines.map(esc).join('<br>'); };
    getConfig(function () {
      lines.push(cfg ? 'Settings file: loaded, ads ' + (cfg.enabled === true ? 'ON' : 'OFF') : 'Settings file: NOT loaded (offline or blocked)'); out();
      lines.push('Anime ad: ' + (seen.animeDay === today() ? 'already shown today (next one tomorrow)' : 'due on the next anime play'));
      var u = vastUrl();
      var banner = function () {
        var b = cfg && cfg.banner;
        if (!b || !validBanner(b)) { lines.push('Banner: not set up'); out(); return; }
        lines.push('Banner (pause screen): ' + (frameSandbox(b, window.location.origin) ? 'set up' : 'not usable here')); out();
        if (window.fetch) fetch(b.page, { mode: 'no-cors', cache: 'no-store' }).then(function () { lines.push('Banner page: reachable'); out(); }).catch(function () { lines.push('Banner page: NOT reachable (site not deployed or blocked)'); out(); });
      };
      if (!u) { lines.push('Video ad: no ad tag set'); out(); banner(); return; }
      lines.push('Video ad: asking the ad server…'); out();
      vastWhy = ''; fetchVast(u, 0, { imps: [], errors: [], wtrack: [] }, function (r) { lines[lines.length - 1] = 'Video ad: ' + (r ? 'READY (an ad is available)' : 'NO AD, ' + (vastWhy || 'unknown reason')); out(); banner(); });
    }, true);
  }
  // ---- "Support the app" (Settings): a QR code for the viewer's phone. Nothing opens by itself; the link is an ad partner's offer, labelled as such ----
  var modal = null;
  function closeSupport() { if (modal) { document.removeEventListener('keydown', supKey, true); if (modal.parentNode) modal.parentNode.removeChild(modal); modal = null; if (state.focusEl && document.body.contains(state.focusEl)) EA.setFocus(state.focusEl, true); } }
  function supKey(e) { if (!modal) return; e.preventDefault(); e.stopPropagation(); var k = e.keyCode; if (k === 13 || EA.isBackKey(k) || k === EA.KEY.STOP) closeSupport(); }
  function support(again) {
    var u = cfg && cfg.support && cfg.support.url;
    if (!httpsUrl(u) && !again) { EA.toast('Loading…'); getConfig(function () { support(true); }, true); return; }   // a copy saved before the link existed: fetch the current file once
    if (!httpsUrl(u)) { EA.toast('Not available right now'); return; }
    closeSupport();
    modal = el('div', 'sponmodal', '<div class="sm-box"><h3>Support the app</h3><p>Scan with your phone. This opens a sponsor offer chosen by our ad partner (it is an ad).</p><div class="sm-qr" id="smQr"></div><p class="sm-url">' + esc(u.replace(/^https:\/\//, '')) + '</p><p class="sm-hint">Press OK or Back to close</p></div>');
    document.body.appendChild(modal); document.addEventListener('keydown', supKey, true); modal.onclick = closeSupport;
    if (EA.qr) EA.qr($('smQr'), u);
  }
  EA.sponsor = { check: check, support: function () { support(false); }, wants: wants, preroll: preroll, hidePause: hidePause, reload: getConfig };
  getConfig();
  return api;
});
