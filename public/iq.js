/* SourceIQ — adaptive source ranking learned from this device's real outcomes.
 *
 * Records, per source, (a) resolution outcomes reported by the backend (found a stream / failed / timed out) and
 * (b) playback outcomes measured here (first frame reached, time to first frame, errors, stalls). Ranks sources with
 * smoothed recent success rates + latency, puts failing sources in a short cool-down that grows on repeated failures and
 * heals by itself, and never fabricates numbers: with no data every source is "Untested" and the default order is used.
 *
 * Stored only on the device (key `ea_iq`): source names, counters, timestamps and millisecond timings. No URLs, cookies or titles.
 * ES5 on purpose (Tizen 4 = Chromium 56). Works in browsers (window.SourceIQ) and Node (module.exports) for tests.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api; else root.SourceIQ = api;
})(this, function () {
  'use strict';

  var VERSION = 1;
  var DEFAULT_ORDER = ['animex', 'anikoto', 'animeyubi', 'aniwaves'];
  // Starting preference when nothing has been observed yet (user reports from Samsung TVs). Real outcomes outweigh it after a few samples.
  var PRIOR = { animex: 0.2, anikoto: 0.12, animeyubi: 0.06, aniwaves: 0 };
  var MAX_EVENTS = 16;                     // recent events kept per source
  var HALF_LIFE = 24 * 3600 * 1000;        // evidence loses half its weight per day
  var KEEP_MS = 7 * 24 * 3600 * 1000;      // events older than this are dropped
  var COOL_BASE = 2 * 60 * 1000, COOL_MAX = 30 * 60 * 1000;
  var MIN_EVIDENCE = 3;                    // fewer events than this => "Untested"
  var TIE = 0.03;                          // scores closer than this keep the default order (no flip-flopping)

  function clamp(x, a, b) { return x < a ? a : x > b ? b : x; }
  function median(a) { if (!a.length) return null; var s = a.slice().sort(function (x, y) { return x - y; }); return s[Math.floor(s.length / 2)]; }
  function idx(key) { var i = DEFAULT_ORDER.indexOf(key); return i < 0 ? 99 : i; }

  function create(storage, clock) {
    var now = clock || function () { return Date.now(); };
    var data = null;

    function blank() { return { v: VERSION, p: {} }; }
    function load() {
      if (data) return data;
      var raw = null;
      try { raw = storage && storage.get ? storage.get() : null; } catch (e) { raw = null; }
      data = raw && raw.v === VERSION && raw.p && typeof raw.p === 'object' ? raw : blank();
      var t = now();
      Object.keys(data.p).forEach(function (k) {                        // forget old evidence
        var s = data.p[k]; s.ev = (s.ev || []).filter(function (e) { return t - e[1] < KEEP_MS; }).slice(-MAX_EVENTS);
      });
      return data;
    }
    function save() { try { if (storage && storage.set) storage.set(data); } catch (e) { /* storage full / blocked: stats just stay in memory */ } }
    function src(key) {
      var d = load();
      return d.p[key] || (d.p[key] = { ev: [], ps: 0, rs: 0, strikes: 0, downUntil: 0, probation: false, lastFail: 0 });
    }
    function push(s, type, ok, ms, t) { s.ev.push([type, t, ok ? 1 : 0, Math.round(ms) || 0]); if (s.ev.length > MAX_EVENTS) s.ev.shift(); }

    // consecutive failures trip a cool-down; while cooling the source is ranked last (still available as a last resort / manual pick)
    function trip(s, t) {
      if (t - s.lastFail > 24 * 3600 * 1000) s.strikes = 0;
      var hit = s.ps >= 2 || s.rs >= 3 || (s.probation && (s.ps >= 1 || s.rs >= 1));
      if (hit && t >= s.downUntil) {
        s.strikes++;
        s.downUntil = t + Math.min(COOL_MAX, COOL_BASE * Math.pow(2, s.strikes - 1));
        s.ps = 0; s.rs = 0; s.probation = true;
      }
      s.lastFail = t;
    }

    // backend resolution result for one source. kind: ok | fail | timeout | budget | absent | cancelled
    function recordResolve(key, kind, ms) {
      if (!key || kind === 'absent' || kind === 'cancelled') return;      // "the show is not on that source" / "lost the race" say nothing about reliability
      var t = now(), s = src(key);
      if (kind === 'ok') { push(s, 'r', true, ms, t); s.rs = 0; }
      else { push(s, 'r', false, ms, t); s.rs++; trip(s, t); }
      save();
    }
    // playback outcome measured on this device. ms = time to first frame for successes
    function recordPlay(key, ok, ms) {
      if (!key) return;
      var t = now(), s = src(key);
      if (ok) { push(s, 'p', true, ms, t); s.ps = 0; s.rs = 0; s.strikes = 0; s.downUntil = 0; s.probation = false; }
      else { push(s, 'p', false, 0, t); s.ps++; trip(s, t); }
      save();
    }
    function recordTrace(trace) {
      (trace || []).forEach(function (x) { if (x && x.k) recordResolve(x.k, x.ok ? 'ok' : x.kind, x.ms); });
    }

    function metrics(key) {
      var s = src(key), t = now(), pw = 0, pk = 0, rw = 0, rk = 0, pl = [], rl = [], n = s.ev.length;
      s.ev.forEach(function (e) {
        var w = Math.pow(0.5, (t - e[1]) / HALF_LIFE);
        if (e[0] === 'p') { pw += w; if (e[2]) { pk += w; pl.push(e[3]); } }
        else { rw += w; if (e[2]) { rk += w; rl.push(e[3]); } }
      });
      var P = (pk + 1) / (pw + 2), R = (rk + 1) / (rw + 2);               // Laplace smoothing: no data => 0.5, never an invented 0% or 100%
      var ms = median(pl); if (ms === null) ms = median(rl);
      var L = ms === null ? 0.5 : clamp(1 - (ms - 2000) / 10000, 0, 1);
      var priorW = 1 / (1 + n / 4);
      var score = 0.5 * P + 0.25 * R + 0.15 * L + (PRIOR[key] || 0) * priorW;
      var plays = s.ev.filter(function (e) { return e[0] === 'p'; }).length;
      return { key: key, n: n, plays: plays, P: P, R: R, ms: ms, score: score, down: t < s.downUntil, downUntil: s.downUntil, probation: !!s.probation && t >= s.downUntil && s.downUntil > 0 };
    }

    // keys ordered best first; sources in cool-down go last (by who recovers first), ties keep the default order
    function rank(keys) {
      var m = {};
      keys.forEach(function (k) { m[k] = metrics(k); });
      return keys.slice().sort(function (a, b) {
        var x = m[a], y = m[b];
        if (x.down !== y.down) return x.down ? 1 : -1;
        if (x.down && y.down) return x.downUntil - y.downUntil;
        if (Math.abs(x.score - y.score) > TIE) return y.score - x.score;
        return idx(a) - idx(b);
      });
    }
    function order(keys) { return rank(keys || DEFAULT_ORDER); }

    // { state, label, short, pct } for the source picker. State: down | untested | recommended | reliable | ok | unreliable
    function status(key, keys) {
      var m = metrics(key), t = now();
      if (m.down) { var mins = Math.max(1, Math.ceil((m.downUntil - t) / 60000)); return { state: 'down', label: 'Temporarily unavailable', short: 'Unavailable · ' + mins + ' min', mins: mins }; }
      if (m.n < MIN_EVIDENCE) return { state: 'untested', label: 'Untested', short: 'Untested' };
      var pct = Math.round((m.plays >= 2 ? m.P : m.R) * 100);
      var best = rank(keys || DEFAULT_ORDER)[0] === key;
      var rate = m.plays >= 2 ? m.P : m.R;
      if (best && rate >= 0.6) return { state: 'recommended', label: 'Recommended', short: 'Recommended', pct: pct };
      if (rate >= 0.75) return { state: 'reliable', label: 'Reliable', short: 'Reliable ' + pct + '%', pct: pct };
      if (rate < 0.5) return { state: 'unreliable', label: 'Unreliable', short: 'Unreliable ' + pct + '%', pct: pct };
      return { state: 'ok', label: 'OK', short: 'OK ' + pct + '%', pct: pct };
    }
    function summary(keys) {
      return (keys || DEFAULT_ORDER).map(function (k) { var m = metrics(k); return { key: k, events: m.n, play: Math.round(m.P * 100), resolve: Math.round(m.R * 100), ms: m.ms, score: Math.round(m.score * 100) / 100, status: status(k, keys).short }; });
    }
    function reset() { data = blank(); save(); }
    return { recordResolve: recordResolve, recordPlay: recordPlay, recordTrace: recordTrace, rank: rank, order: order, status: status, summary: summary, metrics: metrics, reset: reset };
  }

  return { create: create, DEFAULT_ORDER: DEFAULT_ORDER, PRIOR: PRIOR, MAX_EVENTS: MAX_EVENTS, COOL_BASE: COOL_BASE, COOL_MAX: COOL_MAX };
});
