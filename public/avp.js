// Samsung AVPlay engine for the <video id="video"> the rest of the app already drives (anime, movies, Live TV).
// AVPlay is the TV's own player: it plays HLS, MPEG-TS and MP4 natively (no hls.js / MediaSource), and its video plane sits BEHIND the web page,
// so while it runs the page around the video is made transparent. The element keeps its normal API (src, play, pause, currentTime, duration,
// paused, readyState, events) so the players need no AVPlay code of their own. If AVPlay is missing or fails before the first picture, the app
// falls back to the normal HTML5 player for the rest of the session. Setting: Settings -> Player engine (Auto = AVPlay on Tizen 4 only).
(function () {
  'use strict';
  var video = document.getElementById('video');
  if (!video || !window.HTMLMediaElement) return;
  var UA = navigator.userAgent, TIZEN = /Tizen/i.test(UA), CV = (UA.match(/Chrome\/(\d+)/) || [0, 0])[1] | 0;
  var failed = false, cur = null, vol = 1, muted = false, rate = 1;
  var proto = HTMLMediaElement.prototype;
  function nat(n) { return Object.getOwnPropertyDescriptor(proto, n); }
  var natSrc = nat('src'), natCT = nat('currentTime'), natDur = nat('duration'), natPaused = nat('paused'), natRS = nat('readyState'), natBuf = nat('buffered'),
      natVol = nat('volume'), natMut = nat('muted'), natRate = nat('playbackRate'), natVW = Object.getOwnPropertyDescriptor(HTMLVideoElement.prototype, 'videoWidth'), natVH = Object.getOwnPropertyDescriptor(HTMLVideoElement.prototype, 'videoHeight');

  if (TIZEN && !window.webapis) {                                                   // the Samsung web API library is provided by the TV at this path
    var sc = document.createElement('script'); sc.src = '$WEBAPIS/webapis/webapis.js'; sc.async = true; sc.onerror = function () {}; (document.head || document.documentElement).appendChild(sc);
  }
  function av() { try { return window.webapis && webapis.avplay ? webapis.avplay : null; } catch (e) { return null; } }
  function mode() { try { var m = JSON.parse(localStorage.getItem('ea_engine')); return m === 'html5' || m === 'avplay' ? m : 'auto'; } catch (e) { return 'auto'; } }
  function use() { var m = mode(); return !failed && !!av() && (m === 'avplay' || (m === 'auto' && TIZEN && CV > 0 && CV < 63)); }   // Auto: Tizen 4 (Chromium 56)
  function fire(n) { var e = document.createEvent('Event'); e.initEvent(n, false, false); video.dispatchEvent(e); }
  function rect() { try { av().setDisplayRect(0, 0, window.innerWidth || 1920, window.innerHeight || 1080); } catch (e) { /* ignore */ } }

  function flag(on) {
    [document.body, document.documentElement].forEach(function (e) { e.className = e.className.replace(/\s*\bavp-on\b/g, '') + (on ? ' avp-on' : ''); });
  }
  function endSession() {
    var s = cur; if (!s) return; cur = null; clearTimeout(s.wd);
    try { av().stop(); } catch (e) { /* ignore */ }
    try { av().close(); } catch (e2) { /* ignore */ }
    flag(false);
  }
  function fail(s, why) {
    if (cur !== s) return;
    if (!s.started) failed = true;                                                   // never showed a picture: use the HTML5 player from now on
    fire('error'); if (cur === s) endSession();
  }
  function doPlay(s) {
    try { av().play(); } catch (e) { fail(s, 'play'); return; }
    if (s.paused) { s.paused = false; fire('play'); }
  }
  function start(url) {
    endSession();
    var a = av(), s = cur = { url: url, paused: true, ready: false, pend: false, started: false, buf: false, t: 0, dur: 0, seek: -1, info: null };
    flag(true);
    try {
      a.open(url); rect();
      try { a.setDisplayMethod('PLAYER_DISPLAY_MODE_LETTER_BOX'); } catch (e0) { /* ignore */ }
      a.setListener({
        onbufferingstart: function () { if (cur !== s) return; s.buf = true; fire('waiting'); },
        onbufferingprogress: function () {},
        onbufferingcomplete: function () { if (cur !== s) return; s.buf = false; if (s.started) fire('playing'); },
        oncurrentplaytime: function (ms) {
          if (cur !== s) return; s.t = ms;
          if (!s.started && !s.paused) { s.started = true; clearTimeout(s.wd); fire('playing'); }
          fire('timeupdate');
        },
        onevent: function () {},
        onsubtitlechange: function () {},
        ondrmevent: function () {},
        onstreamcompleted: function () { if (cur !== s) return; s.paused = true; fire('ended'); },
        onerror: function () { fail(s, 'stream'); }
      });
      s.wd = setTimeout(function () { if (cur === s && !s.started) fail(s, 'timeout'); }, 15000);   // prepare / first picture took too long
      a.prepareAsync(function () {
        if (cur !== s) return; s.ready = true;
        try { s.dur = a.getDuration(); } catch (e1) { s.dur = 0; }
        try { var inf = a.getCurrentStreamInfo(); for (var i = 0; i < inf.length; i++) if (inf[i].type === 'VIDEO') { var x = JSON.parse(inf[i].extra_info); s.info = { w: +x.Width || 0, h: +x.Height || 0 }; } } catch (e2) { /* ignore */ }
        fire('loadedmetadata'); fire('durationchange'); fire('canplay');
        if (s.seek >= 0) { try { a.seekTo(s.seek, function () {}, function () {}); s.t = s.seek; } catch (e3) { /* ignore */ } s.seek = -1; }
        if (rate !== 1) { try { a.setSpeed(rate); } catch (e4) { /* ignore */ } }
        if (s.pend) doPlay(s);
      }, function () { fail(s, 'prepare'); });
    } catch (e) { fail(s, 'open'); }
  }

  function def(name, get, set) { try { Object.defineProperty(video, name, { configurable: true, get: get, set: set }); } catch (e) { /* ignore */ } }
  def('src', function () { return cur ? cur.url : natSrc.get.call(video); }, function (v) {
    if (v && use()) { start(String(v)); return; }
    endSession(); natSrc.set.call(video, v);
  });
  def('currentTime', function () { return cur ? (cur.seek >= 0 ? cur.seek : cur.t) / 1000 : natCT.get.call(video); }, function (v) {
    if (!cur) { natCT.set.call(video, v); return; }
    var ms = Math.max(0, Math.round(v * 1000)), s = cur;
    if (!s.ready) { s.seek = ms; return; }
    fire('seeking'); s.t = ms;
    try { av().seekTo(ms, function () { if (cur === s) { fire('seeked'); fire('timeupdate'); } }, function () { if (cur === s) fire('seeked'); }); } catch (e) { /* live streams cannot seek */ }
  });
  def('duration', function () { return cur ? (cur.ready ? (cur.dur > 0 ? cur.dur / 1000 : Infinity) : NaN) : natDur.get.call(video); });
  def('paused', function () { return cur ? cur.paused : natPaused.get.call(video); });
  def('readyState', function () { return cur ? (cur.ready && !cur.buf && cur.started ? 4 : cur.ready ? 2 : 1) : natRS.get.call(video); });
  def('buffered', function () { return cur ? { length: 0, start: function () { return 0; }, end: function () { return 0; } } : natBuf.get.call(video); });
  def('videoWidth', function () { return cur ? (cur.info ? cur.info.w : 0) : natVW.get.call(video); });
  def('videoHeight', function () { return cur ? (cur.info ? cur.info.h : 0) : natVH.get.call(video); });
  def('volume', function () { return cur ? vol : natVol.get.call(video); }, function (v) { vol = v; if (!cur) natVol.set.call(video, v); });   // AVPlay uses the TV's own volume
  def('muted', function () { return cur ? muted : natMut.get.call(video); }, function (v) { muted = !!v; if (!cur) natMut.set.call(video, v); });
  def('playbackRate', function () { return cur ? rate : natRate.get.call(video); }, function (v) {
    rate = v; if (!cur) { natRate.set.call(video, v); return; }
    if (cur.ready) { try { av().setSpeed(v); } catch (e) { /* ignore */ } }
  });
  video.play = function () {
    if (!cur) return proto.play.call(video);
    var s = cur; if (!s.ready) { s.pend = true; return Promise.resolve(); }
    doPlay(s); return Promise.resolve();
  };
  video.pause = function () {
    if (!cur) return proto.pause.call(video);
    var s = cur; s.pend = false; if (s.paused) return;
    if (s.ready) { try { av().pause(); } catch (e) { /* ignore */ } }
    s.paused = true; fire('pause');
  };
  video.load = function () { endSession(); return proto.load.call(video); };
  video.removeAttribute = function (n) { if (n === 'src') endSession(); return proto.removeAttribute ? Element.prototype.removeAttribute.call(video, n) : undefined; };
  video.getAttribute = function (n) { return n === 'src' && cur ? cur.url : Element.prototype.getAttribute.call(video, n); };

  document.addEventListener('visibilitychange', function () {                       // AVPlay must be suspended while the app is in the background
    var a = av(); if (!a || !cur) return;
    try { if (document.hidden) a.suspend(); else { a.restore(); rect(); } } catch (e) { /* ignore */ }
  });
  window.AVP = {
    use: use, mode: mode, active: function () { return !!cur; },
    available: function () { return !!av(); }, failed: function () { return failed; },
    _end: endSession, _reset: function () { failed = false; }
  };
}());
