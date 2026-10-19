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
  function rankMedia(files) {
    return (files || []).filter(function (f) {
      return f && httpsUrl(f.url) && String(f.delivery || 'progressive').toLowerCase() !== 'streaming' && /^video\/(mp4|webm|x-m4v)$/.test(String(f.type || '').toLowerCase());
    }).map(function (f) {
      var t = String(f.type).toLowerCase();
      return { f: f, sc: Math.abs((+f.height || 720) - 720) * 10 + (t === 'video/webm' ? 100000 : 0) + (+f.bitrate || 0) / 1000 };
    }).sort(function (a, b) { return a.sc - b.sc; }).map(function (x) { return x.f; });
  }
  function pickMedia(files) { return rankMedia(files)[0] || null; }
  // A VAST ad can hold several creatives (e.g. 1:33 and 0:20): use ONE of them, the first with a playable file that is 45 s or shorter, else the shortest. cands: [{ dur (s), media: [...], track: {...} }]
  function chooseLinear(cands) {
    var best = null, bf = null, bs = 1e9;
    (cands || []).forEach(function (c, i) {
      var f = pickMedia(c.media); if (!f) return;
      var sc = (c.dur > 45 ? 1000 + c.dur : 0) + i; if (!c.dur) sc = 500 + i;
      if (sc < bs) { bs = sc; best = c; bf = f; }
    });
    return best ? { cand: best, file: bf, files: rankMedia(best.media) } : null;
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
  var api = { rankMedia: rankMedia, chooseLinear: chooseLinear, pickMedia: pickMedia, fillMacros: fillMacros, frameSandbox: frameSandbox, validBanner: validBanner, validVideo: validVideo, validImage: validImage, pickVideo: pickVideo, pickImage: pickImage, due: due, skipAfter: skipAfter, httpsUrl: httpsUrl, CONFIG_URL: CONFIG_URL, PAUSE_MS: PAUSE_MS };

  if (typeof window === 'undefined' || !window.EA) return api;
  // ------------------------------------------------------------------ in the app
  var EA = window.EA, $ = EA.$, el = EA.el, esc = EA.esc, store = EA.store, state = EA.state, video = EA.video;
  var cfg = null, seen = { animeDay: store.get('ea_ad_day', ''), last: '' };
  function today() { var d = new Date(); return d.getFullYear() + '-' + (d.getMonth() + 1) + '-' + d.getDate(); }
  function note(kind, what) { var l = store.get('ea_ad_log', {}) || {}; l[kind] = { t: Date.now(), what: what }; store.set('ea_ad_log', l); }
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
  function qrUrl() { var u = cfg && cfg.enabled === true && cfg.support && cfg.support.url; return httpsUrl(u) ? u : null; }
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
  // In the TV / Android app the page is a local file: an ad request sent from it carries no site address and the network answers with no ad.
  // There the request goes through vastrelay.html on the registered site (hidden frame, its own origin); on the website it is sent directly.
  var relay = null, relayQ = {}, relayN = 0;
  function relayUrl() { var r = cfg && cfg.vast && cfg.vast.relay; return httpsUrl(r) && frameSandbox({ page: r }, window.location.origin) === 'allow-scripts allow-same-origin' ? r : null; }
  function relayFrame(cb) {
    var u = relayUrl(); if (!u) { cb(null); return; }
    if (relay && relay.url === u) { if (relay.ready) cb(relay.f); else relay.wait.push(cb); return; }
    if (relay && relay.f.parentNode) relay.f.parentNode.removeChild(relay.f);
    var f = document.createElement('iframe'); f.setAttribute('sandbox', 'allow-scripts allow-same-origin'); f.setAttribute('aria-hidden', 'true');
    f.style.cssText = 'position:absolute;left:-9999px;top:0;width:1px;height:1px;border:0;visibility:hidden';
    relay = { url: u, f: f, ready: false, wait: [cb] };
    var r0 = relay, fail = setTimeout(function () { if (!r0.ready) { var w = r0.wait; r0.wait = []; if (relay === r0) relay = null; if (f.parentNode) f.parentNode.removeChild(f); w.forEach(function (x) { x(null); }); } }, 5000);
    r0.go = function () { if (r0.ready) return; r0.ready = true; clearTimeout(fail); var w = r0.wait; r0.wait = []; w.forEach(function (x) { x(f); }); };
    f.src = u; document.body.appendChild(f);
  }
  window.addEventListener('message', function (e) {
    var d = e.data; if (!d || !relay || e.source !== relay.f.contentWindow) return;
    if (d.t === 'vast-ready' && relay.go) relay.go();
    if (d.t === 'vast-r' && relayQ[d.id]) { var cb = relayQ[d.id]; delete relayQ[d.id]; cb(d.ok ? null : (d.why || 'failed'), d.text); }
  });
  function getText(url, cb) {                                                           // cb(error or null, text)
    relayFrame(function (f) {
      if (f) {
        var id = ++relayN; relayQ[id] = cb;
        try { f.contentWindow.postMessage({ t: 'vast', id: id, url: url }, '*'); } catch (e) { delete relayQ[id]; cb('relay unavailable'); }
        return;
      }
      if (relayUrl()) { cb('the ad relay page did not load (is vastrelay.html deployed on the site?)'); return; }
      fetch(fillMacros(url), { credentials: 'omit', cache: 'no-store' }).then(function (r) { return r.ok ? r.text() : Promise.reject(new Error('HTTP ' + r.status)); })
        .then(function (t) { cb(null, t); }).catch(function (e) { cb(String(e && e.message || 'blocked')); });
    });
  }
  function fetchVast(url, depth, acc, cb) {
    var done = false, timer = setTimeout(function () { vastWhy = vastWhy || 'the ad server did not answer in time'; fin(null); }, 9000);
    function fin(r) { if (done) return; done = true; clearTimeout(timer); cb(r); }
    if (!window.DOMParser || depth > 3) { vastWhy = 'this device cannot read VAST'; fin(null); return; }
    getText(url, function (err, t) {
      if (done) return;
      if (err) { vastWhy = 'the request failed: ' + err; fin(null); return; }
      var v = parseVast(t); if (!v) { vastWhy = 'the ad server sent an empty answer (' + (String(t || '').replace(/\s+/g, ' ').slice(0, 90) || 'nothing at all') + ')'; fin(null); return; }
      acc.imps = acc.imps.concat(v.imps); acc.errors = acc.errors.concat(v.errors);
      acc.wtrack = acc.wtrack.concat(v.lin.map(function (c) { return c.track; }));                // a wrapper's tracking events also count
      var pick = chooseLinear(v.lin);
      if (v.next && !pick) { clearTimeout(timer); done = true; fetchVast(v.next, depth + 1, acc, cb); return; }
      if (!pick) { vastWhy = 'the ad has no playable video file'; fin(null); return; }
      var track = {}; acc.wtrack.concat([pick.cand.track]).forEach(function (tk) { Object.keys(tk).forEach(function (e) { track[e] = (track[e] || []).concat(tk[e]); }); });
      fin({ video: pick.file.url, files: pick.files, vast: { imps: acc.imps, errors: acc.errors, track: track } });
    });
  }
  // A video ad fetched ahead of time, so the pre-roll can start the moment Play is pressed. Fetching is not an impression: tracking only fires when it plays.
  var ready = null, fetching = false, READY_MS = 4 * 60 * 1000;
  function prefetch() {
    var u = vastUrl(); if (!u || fetching || (ready && Date.now() - ready.t < READY_MS)) return;
    fetching = true;
    fetchVast(u, 0, { imps: [], errors: [], wtrack: [] }, function (r) { fetching = false; if (r) ready = { r: r, t: Date.now() }; });
  }
  function resolveAd(cb) {                                                               // a VAST ad (ready, or asked for now) if the network fills, else one of the owner's own videos, else nothing
    var done = false;
    function give(r) { if (done) return; done = true; clearTimeout(cap); cb(r); setTimeout(prefetch, 3000); }
    function own() { give(pickVideo(cfg, Date.now(), Math.random())); }
    var cap = setTimeout(function () { vastWhy = vastWhy || 'the ad network took longer than 5 s'; own(); }, 5000);   // never keep the viewer on "Loading ad" for long
    if (ready && Date.now() - ready.t < READY_MS) { var r0 = ready.r; ready = null; give(r0); return; }
    var u = vastUrl(); if (!u) { own(); return; }
    fetchVast(u, 0, { imps: [], errors: [], wtrack: [] }, function (r) { if (done) { if (r) ready = { r: r, t: Date.now() }; return; } if (r) give(r); else own(); });   // a late answer is kept for the next play
  }

  function preroll(a, done) {                                                            // done(true) = go on and play, done(false) = the viewer left
    var kind = kindOf(a), started = false, finished = false, last = 0, lastAt = Date.now(), t0 = Date.now(), it = null, skipAt = 20, timer, sent = {}, vast = null, skipped = false;
    var box = el('div', 'adbox', '<video class="advid" playsinline></video><div class="ad-tag">Ad <span class="ad-left"></span></div><div class="ad-skip">Loading ad…</div><div class="ad-bar"><i></i></div>');
    var v = box.querySelector('video'), left = box.querySelector('.ad-left'), skipEl = box.querySelector('.ad-skip'), bar = box.querySelector('i');
    ad = box; document.body.appendChild(box);
    try { if (EA.stopVideo) EA.stopVideo(); else video.pause(); } catch (e) { /* ignore */ }      // Samsung TVs have one video decoder: the app's player must let go of it first
    var files = [], fi = 0;
    function ev(name) { if (!vast || sent[name]) return; sent[name] = 1; (vast.track[name] || []).forEach(beacon); }
    function finish(go, code) {
      if (finished) return; finished = true; clearInterval(timer); document.removeEventListener('keydown', onKey, true);
      if (go && started) { if (kind === 'anime') { seen.animeDay = today(); store.set('ea_ad_day', seen.animeDay); } else seen.last = kind + ':' + a.id; }   // the ad only counts once it was watched (or skipped after the minimum): leaving with Back keeps it due
      if (vast && !started && code) vast.errors.forEach(function (u) { beacon(fillMacros(u, code)); });
      if (skipped) ev('skip');
      try { v.pause(); v.removeAttribute('src'); v.load(); } catch (e) { /* ignore */ }
      if (box.parentNode) box.parentNode.removeChild(box);
      ad = null; done(go);
    }
    function canSkip() { return started && v.currentTime >= skipAt; }
    // Always-available ad: a labelled card with a QR code to the sponsor offer (Monetag link in sponsor.json). Nothing opens on the TV; it continues by itself.
    function qrCard() {
      var u = qrUrl(); if (!u || finished) return false;
      clearInterval(timer); try { v.pause(); v.removeAttribute('src'); v.load(); } catch (e) { /* ignore */ }
      v.style.display = 'none'; bar.parentNode.style.display = '';
      var card = el('div', 'adqr', '<h3>Sponsored</h3><p>Scan with your phone to see this offer</p><div class="adqr-code"></div>');
      box.appendChild(card); if (EA.qr) EA.qr(card.querySelector('.adqr-code'), u);
      started = true;
      note('video', 'showed the sponsor QR card (no network video)');
      var t0q = Date.now(), need = 20;
      timer = setInterval(function () {
        var t = (Date.now() - t0q) / 1000;
        left.textContent = '· ' + Math.max(0, Math.ceil(need - t)) + 's'; bar.style.width = Math.min(100, t / need * 100) + '%';
        skipEl.className = 'ad-skip'; skipEl.textContent = 'Continues in ' + Math.max(0, Math.ceil(need - t)) + 's';
        if (t >= need) finish(true);
      }, 250);
      return true;
    }
    function onKey(e) {
      e.preventDefault(); e.stopPropagation(); var k = e.keyCode;
      if (k === EA.KEY.ENTER || k === 13) { if (canSkip()) { skipped = true; finish(true); } }
      else if (EA.isBackKey(k) || k === EA.KEY.STOP) finish(false);
    }
    document.addEventListener('keydown', onKey, true);
    box.onclick = function () { if (canSkip()) { skipped = true; finish(true); } };
    v.addEventListener('playing', function () {
      if (started) return; started = true;                                              // only a shown ad counts
      if (vast) { vast.imps.forEach(beacon); ev('creativeView'); ev('start'); }
      note('video', 'shown');
    });
    v.addEventListener('ended', function () { ev('complete'); finish(true); });
    function nextFile(why) {                                                            // this file did not play: try the ad's other sizes / formats before giving up
      if (finished || started) return;
      if (++fi < files.length && fi < 4) { t0 = Date.now(); try { v.src = files[fi].url; var p2 = v.play(); if (p2 && p2.catch) p2.catch(function () {}); } catch (e) { /* ignore */ } return; }
      note('video', 'the ad video would not play on this device (' + why + ')');
      if (!qrCard()) finish(true, 405);
    }
    v.addEventListener('error', function () { nextFile('error ' + (v.error && v.error.code || '')); });      // a broken ad never blocks playback
    resolveAd(function (r) {
      if (finished) return;
      if (!r) { note('video', 'no network ad (' + (vastWhy || 'nothing set up') + ')'); if (!qrCard()) finish(true, 303); return; }   // no network ad: the sponsor QR card, else just play
      it = r; vast = r.vast || null; t0 = Date.now(); skipAt = skipAfter(it, 0); files = r.files && r.files.length ? r.files : [{ url: r.video }];
      timer = setInterval(function () {
        var t = v.currentTime || 0, d = v.duration || 0;
        if (t !== last) { last = t; lastAt = Date.now(); }
        if (!started && Date.now() - t0 > 15000) { nextFile('did not start in 15 s'); return; }   // never started
        if (started && Date.now() - lastAt > 12000) { finish(true); return; }            // froze
        if (!started) return;
        skipAt = skipAfter(it, d);
        if (d) { if (t >= d * 0.25) ev('firstQuartile'); if (t >= d * 0.5) ev('midpoint'); if (t >= d * 0.75) ev('thirdQuartile'); }
        left.textContent = d ? '· ' + Math.max(0, Math.ceil(d - t)) + 's' : '';
        bar.style.width = (d ? Math.min(100, t / d * 100) : 0) + '%';
        skipEl.className = 'ad-skip' + (canSkip() ? ' ok' : '');
        skipEl.textContent = canSkip() ? 'Skip ad  (OK)' : 'You can skip in ' + Math.max(0, Math.ceil(skipAt - t)) + 's';
      }, 250);
      v.src = files[0].url; var pr = v.play(); if (pr && pr.catch) pr.catch(function (e) { if (!started && v.error) nextFile('play refused: ' + (e && e.name || '')); });
    });
  }

  // ---- pause ad ----
  var pbox = null, ptimer = null, pwait = null, adMsg = null;
  function listenAd(frame, box, shown) {
    if (adMsg) window.removeEventListener('message', adMsg);
    var drew = false;
    adMsg = function (e) { if (e.data === 'ea-ad:ok' && frame.contentWindow && e.source === frame.contentWindow && pbox === box && !drew) { drew = true; shown(); note('banner', 'shown (network banner)'); } };
    setTimeout(function () { if (pbox === box && !drew) note('banner', 'the network drew no banner this time' + (box.querySelector('.pa-qr') ? ' (the QR card stayed)' : '')); }, 9000);
    window.addEventListener('message', adMsg);
  }
  var pvid = null, SAMSUNG = /Tizen/i.test(navigator.userAgent);
  function stopPauseVideo() { if (!pvid) return; clearInterval(pvid.timer); try { pvid.v.pause(); pvid.v.removeAttribute('src'); pvid.v.load(); } catch (e) { /* ignore */ } pvid = null; }
  function hidePause() { clearTimeout(ptimer); clearTimeout(pwait); stopPauseVideo(); if (pbox) { if (pbox.parentNode) pbox.parentNode.removeChild(pbox); pbox = null; document.removeEventListener('keydown', hidePause, true); }
    if (adMsg) { window.removeEventListener('message', adMsg); adMsg = null; } }
  // Network banner page (Monetag In-Page Push) in a frame with NO popups and NO top navigation, in an origin of its own. While it loads (and if the network
  // draws nothing) the sponsor QR card is shown in its place; the moment the network really draws an ad, the banner replaces the card.
  function frameBanner(bn, q) {
    var box = el('div', 'pausead', '<div class="pa-card pa-net" style="width:' + (+bn.width) + 'px;height:' + (+bn.height) + 'px"><span class="ad-tag">Ad</span></div>');
    var net = box.querySelector('.pa-net'), qr = null;
    var f = document.createElement('iframe'); f.setAttribute('scrolling', 'no'); f.setAttribute('sandbox', frameSandbox(bn, window.location.origin));   // never the app's own origin: the website gets a no-origin sandbox, the TV / Android app the ad page's own origin
    f.style.cssText = 'border:0;width:' + (+bn.width) + 'px;height:' + (+bn.height) + 'px;display:block'; f.src = bn.page;
    net.insertBefore(f, net.querySelector('.ad-tag'));
    box.style.width = (+bn.width) + 'px';
    if (q) {
      qr = el('div', 'pa-card pa-qr', '<div class="pa-qrcode"></div><p>Scan for this offer</p><span class="ad-tag">Ad</span>');
      if (EA.qr) EA.qr(qr.querySelector('.pa-qrcode'), q);
      box.insertBefore(qr, net);
      net.style.position = 'absolute'; net.style.top = '0'; net.style.right = '0'; net.style.visibility = 'hidden';   // laid out (so the ad can draw) but not seen yet
      box.style.width = ''; note('banner', 'shown (sponsor QR card, waiting for the network banner)');
    } else box.style.visibility = 'hidden';                                             // no card: invisible until the network really delivered an ad
    listenAd(f, box, function () { if (qr && qr.parentNode) qr.parentNode.removeChild(qr); net.style.position = ''; net.style.visibility = 'visible'; box.style.width = (+bn.width) + 'px'; box.style.visibility = 'visible'; });
    return box;
  }
  function qrBanner(u) {                                                               // always-available pause ad: labelled card with a QR code to the sponsor offer
    var box = el('div', 'pausead', '<div class="pa-card pa-qr"><div class="pa-qrcode"></div><p>Scan for this offer</p><span class="ad-tag">Ad</span></div>');
    if (EA.qr) EA.qr(box.querySelector('.pa-qrcode'), u);
    note('banner', 'shown (sponsor QR card)');
    return box;
  }
  function imageBanner(it) {
    var box = el('div', 'pausead', '<div class="pa-card"><img alt="' + esc(it.alt || 'Sponsor') + '" src="' + esc(it.image) + '"><span class="ad-tag">Ad</span></div>');
    box.querySelector('img').onerror = hidePause;
    return box;
  }
  // The video ad (VAST tag) as a small, muted, labelled picture in the banner spot. Network "banner" pages such as Monetag's Vignette only draw after a click or
  // a page change, which never happens on a paused player, so this is the network ad that can really appear here. Same tracking as the pre-roll.
  function videoBanner(fallback) {
    var box = el('div', 'pausead', '<div class="pa-card pa-vid" style="width:320px;height:180px"><video muted playsinline style="width:320px;height:180px;display:block;background:#000"></video><span class="ad-tag">Ad</span></div>');
    box.style.width = '320px'; box.style.visibility = 'hidden';
    var v = box.querySelector('video'), me = { v: v, sent: {}, timer: null }; v.muted = true; pvid = me;
    function gone() { return pvid !== me || pbox !== box; }
    function giveUp(why) {
      if (gone()) return; note('banner', why); stopPauseVideo();
      var nb = fallback(); if (box.parentNode) box.parentNode.removeChild(box); pbox = nb;
      if (nb) document.body.appendChild(nb);
    }
    vastWhy = '';
    fetchVast(vastUrl(), 0, { imps: [], errors: [], wtrack: [] }, function (r) {
      if (gone()) return;
      if (!r) { giveUp('no video ad: ' + (vastWhy || 'nothing to show')); return; }
      var files = r.files && r.files.length ? r.files : [{ url: r.video }], fi = 0, started = false, vast = r.vast;
      function ev(n) { if (me.sent[n]) return; me.sent[n] = 1; (vast.track[n] || []).forEach(beacon); }
      function go() { var pr = v.play(); if (pr && pr.catch) pr.catch(function () { /* the error event decides */ }); }
      v.addEventListener('error', function () { if (gone() || started) return; if (++fi < files.length && fi < 4) { v.src = files[fi].url; go(); } else giveUp('the video ad would not play on this device'); });
      v.addEventListener('playing', function () {
        if (started || gone()) return; started = true; box.style.visibility = 'visible';
        vast.imps.forEach(beacon); ev('creativeView'); ev('start'); note('banner', 'shown (video ad)');
      });
      v.addEventListener('ended', function () { if (!gone()) { ev('complete'); hidePause(); } });
      me.timer = setInterval(function () { var t = v.currentTime || 0, d = v.duration || 0; if (d) { if (t >= d * 0.25) ev('firstQuartile'); if (t >= d * 0.5) ev('midpoint'); if (t >= d * 0.75) ev('thirdQuartile'); } }, 250);
      v.src = files[0].url; go();
    });
    return box;
  }
  function showPause() {
    if (pbox || state.view !== 'player' || state.liveOn || state.embed || !video.paused || video.ended || !video.currentTime) return;
    var it = pickImage(cfg, Date.now(), Math.random()), bn = cfg && cfg.enabled === true && validBanner(cfg.banner) && frameSandbox(cfg.banner, window.location.origin) ? cfg.banner : null;
    var q = qrUrl();
    var fallback = function () { return it ? imageBanner(it) : bn ? frameBanner(bn, q) : q ? qrBanner(q) : null; };
    if (it && (Math.random() < 0.5 || (!vastUrl() && !bn && !q))) pbox = imageBanner(it);   // the owner's own pictures take turns with the network ads
    else if (vastUrl() && !SAMSUNG) pbox = videoBanner(fallback);                       // Samsung TVs have one video decoder: a second video while the show is paused could break resuming it
    else if (bn) pbox = frameBanner(bn, q);                                             // network banner, with the QR card in its place until it draws
    else if (q) pbox = qrBanner(q);
    else if (it) pbox = imageBanner(it);
    else return;
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
      var lg = store.get('ea_ad_log', {}) || {}, ago = function (x) { return x ? Math.round((Date.now() - x.t) / 60000) + ' min ago: ' + x.what : 'nothing yet'; };
      lines.push('Last video ad: ' + ago(lg.video)); lines.push('Last pause banner: ' + ago(lg.banner)); lines.push('Video ad route: ' + (relayUrl() ? 'through the site (app mode)' : 'direct (website mode)') + ', page: ' + (window.location.origin || 'none')); lines.push('Device: ' + navigator.userAgent.replace(/^Mozilla\/5\.0 /, '').slice(0, 90));
      lines.push('Anime ad (this profile): ' + (seen.animeDay === today() ? 'already shown today (next one tomorrow)' : 'due on the next anime play'));
      var u = vastUrl();
      var banner = function () {
        var b = cfg && cfg.banner;
        if (!b || !validBanner(b)) { lines.push('Banner: not set up'); out(); return; }
        var sb = frameSandbox(b, window.location.origin); lines.push('Banner (pause screen): ' + (!sb ? 'not usable here' : sb === 'allow-scripts' ? 'website mode: the ad runs without storage, so most ad scripts stay blank here. It is meant for the TV and Android app.' : 'app mode (own origin)')); out();
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
  getConfig(function () { setTimeout(prefetch, 4000); });
  setInterval(prefetch, READY_MS + 15000);
  return api;
});
