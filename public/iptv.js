/* IPTV core — playlist engine, storage, search and TV-guide helpers for the Live TV section.
 *
 * Nothing here ships channels: the user brings a playlist (M3U link or Xtream login from their own provider) or picks one of the
 * free public lists. The heavy work (download, parse, XMLTV guide) runs inside a Web Worker so a 50,000-channel list never blocks
 * the remote control; the same engine runs time-sliced on the main thread when a TV does not allow workers.
 * Channels are kept columnar (arrays of strings) and stored in IndexedDB in chunks of 2000, so a saved list opens in well under a second.
 *
 * ES5 on purpose (Tizen 4 = Chromium 56). Works in browsers (window.IPTV) and Node (module.exports) for tests.
 */
(function (root, factory) {
  var api = factory();
  if (typeof module === 'object' && module.exports) module.exports = api; else root.IPTV = api;
})(this, function () {
  'use strict';

  // ======================================================================================================================
  // engine(S): everything the worker runs. It must not use anything outside its own body (it is stringified into the worker).
  // Messages in : { id, kind: 'm3u'|'xtream'|'auth'|'xmltv', ... }  or { cancel: id }
  // Messages out: { id, t: 'chunk', cols } | { id, t: 'progress', got, total } | { id, t: 'done', result } | { id, t: 'error', message }
  // ======================================================================================================================
  function engine(S) {
    var CHUNK = 2000, cancelled = {};
    function delay(ms) { return new Promise(function (r) { setTimeout(r, ms); }); }
    function withTimeout(p, ms, msg) {
      return new Promise(function (res, rej) {
        var t = setTimeout(function () { rej(new Error(msg || 'timed out')); }, ms);
        p.then(function (v) { clearTimeout(t); res(v); }, function (e) { clearTimeout(t); rej(e); });
      });
    }
    function newCols() { return { n: [], g: [], u: [], l: [], o: [], e: [] }; }       // name, group, url-or-id, logo, number, epg id
    function pick(tries, i, full) { var t = tries[i]; return t.pre ? t.pre + encodeURIComponent(full) : full; }

    // ---- incremental M3U parser: push(text) as it streams in, end() at the finish ----
    function M3U(emit) {
      var carry = '', c = newCols(), groups = [], gmap = {}, total = 0, seq = 0, epgUrl = '', cur = null, grp = '', head = false, skipped = 0;
      function gid(name) {
        name = name || 'Other';
        var sc = name.indexOf(';'); if (sc > 0) name = name.slice(0, sc).trim() || 'Other';                    // "News;Public" -> "News": one tidy list of groups
        var k = '$' + name, v = gmap[k];
        if (v === undefined) { v = groups.length; gmap[k] = v; groups.push(name); }
        return v;
      }
      function attrs(s) {
        var o = {}, re = /([A-Za-z0-9_-]+)=(?:"([^"]*)"|'([^']*)'|([^\s,]+))/g, m;
        while ((m = re.exec(s))) o[m[1].toLowerCase()] = m[2] !== undefined ? m[2] : m[3] !== undefined ? m[3] : m[4];
        return o;
      }
      function nameOf(s) {                                                          // text after the first comma that is outside quotes
        var q = false, i, ch;
        for (i = 0; i < s.length; i++) { ch = s.charAt(i); if (ch === '"') q = !q; else if (ch === ',' && !q) return s.slice(i + 1).trim(); }
        return '';
      }
      function line(s) {
        if (!s) return;
        if (s.charCodeAt(s.length - 1) === 13) s = s.slice(0, -1);
        var f = s.charAt(0);
        if (f === '#') {
          if (s.indexOf('#EXTINF') === 0) {
            var body = s.slice(s.indexOf(':') + 1), a = attrs(body), nm = nameOf(body);
            cur = { n: nm || a['tvg-name'] || '', g: a['group-title'] || grp, l: a['tvg-logo'] || '', e: a['tvg-id'] || '', o: parseInt(a['tvg-chno'], 10) || 0 };
          } else if (s.indexOf('#EXTGRP:') === 0) grp = s.slice(8).trim();
          else if (s.indexOf('#EXTM3U') === 0 && !head) { head = true; var h = attrs(s); epgUrl = h['url-tvg'] || h['x-tvg-url'] || ''; }
          return;
        }
        if (!/^[A-Za-z][A-Za-z0-9+.-]*:\/\//.test(s)) return;                       // not a stream URL
        if (!/^https?:\/\//i.test(s)) { skipped++; cur = null; return; }               // rtmp / rtsp / udp: a TV browser cannot play these
        total++; seq++;
        var ch = cur || { n: '', g: grp, l: '', e: '', o: 0 };
        c.n.push(ch.n || ('Channel ' + total)); c.g.push(gid(ch.g)); c.u.push(s.trim()); c.l.push(ch.l); c.o.push(ch.o || seq); c.e.push(ch.e);
        cur = null;
        if (c.n.length >= CHUNK) { emit(c); c = newCols(); }
      }
      return {
        push: function (text) {
          var t = carry + text, i = 0, j;
          while ((j = t.indexOf('\n', i)) >= 0) { line(t.slice(i, j)); i = j + 1; }
          carry = t.slice(i);
        },
        end: function () { if (carry) line(carry); carry = ''; if (c.n.length) { emit(c); c = newCols(); } return { groups: groups, total: total, epgUrl: epgUrl, skipped: skipped }; }
      };
    }

    // stream a URL through onText; first block must look like a playlist
    function stream(url, id, onText, onProgress, maxBytes) {
      return withTimeout(fetch(url, { credentials: 'omit' }), 30000, 'The server did not answer in 30 s').then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        var total = +r.headers.get('content-length') || 0, got = 0;
        if (r.body && r.body.getReader && typeof TextDecoder !== 'undefined') {
          var rd = r.body.getReader(), dec = new TextDecoder('utf-8');
          return (function pump() {
            if (cancelled[id]) throw new Error('cancelled');
            return withTimeout(rd.read(), 30000, 'The download stalled').then(function (x) {
              if (x.done) { onText(dec.decode()); return; }
              got += x.value.length; onProgress(got, total);
              onText(dec.decode(x.value, { stream: true }));
              if (maxBytes && got > maxBytes) { try { rd.cancel(); } catch (e) { /* ignore */ } return; }          // a guide for the whole world: the first part is plenty
              return pump();
            });
          })();
        }
        return r.text().then(function (t) {                                         // no streaming: feed in slices so a TV can breathe
          var pos = 0;
          return (function next() {
            if (cancelled[id]) throw new Error('cancelled');
            if (pos >= t.length) return;
            onText(t.slice(pos, pos + 524288)); pos += 524288; onProgress(Math.min(pos, t.length), t.length);
            return delay(0).then(next);
          })();
        });
      });
    }
    function tryAll(tries, runOne) {                                                // direct first, then through the proxy
      var errs = [];
      function at(i) {
        if (i >= tries.length) { var e = new Error(errs[0] || 'Could not download'); e.all = errs; throw e; }
        return Promise.resolve().then(function () { return runOne(i); }).then(function (res) { return { via: tries[i].via, res: res }; }, function (err) {
          if (err && err.message === 'cancelled') throw err;
          errs.push((tries[i].via === 'proxy' ? 'via server: ' : '') + ((err && err.message) || err));
          return at(i + 1);
        });
      }
      return at(0);
    }

    function m3u(job) {
      var seen = false, size = 0;
      return tryAll(job.tries, function (i) {
        var P = M3U(function (cols) { S.postMessage({ id: job.id, t: 'chunk', cols: cols }); });
        seen = false;
        return stream(pick(job.tries, i, job.url), job.id, function (text) {
          if (!seen) { seen = true; if (text.indexOf('#EXTM3U') < 0 && text.indexOf('#EXTINF') < 0) throw new Error('That address is not an M3U playlist (it returned a web page or an error)'); }
          P.push(text);
        }, function (got, total) { size = got; S.postMessage({ id: job.id, t: 'progress', got: got, total: total }); }).then(function () {
          var r = P.end();
          if (!r.total) throw new Error(r.skipped ? 'This playlist only has RTMP/UDP/RTSP streams, which a TV browser cannot play' : 'The playlist has no channels');
          return r;
        });
      }).then(function (x) { x.res.via = x.via; x.res.bytes = size; return x.res; });
    }

    // ---- Xtream Codes (player_api.php) ----
    function xjson(job, extra) {
      var full = job.server + '/player_api.php?username=' + encodeURIComponent(job.user) + '&password=' + encodeURIComponent(job.pass) + (extra || '');
      return tryAll(job.tries, function (i) {
        return withTimeout(fetch(pick(job.tries, i, full), { credentials: 'omit' }), 40000, 'The server did not answer in 40 s').then(function (r) {
          if (!r.ok) throw new Error('HTTP ' + r.status);
          return r.text();
        }).then(function (t) {
          try { return JSON.parse(t); } catch (e) { throw new Error('The server did not return Xtream data (check the address)'); }
        });
      });
    }
    function auth(job) {
      return xjson(job, '').then(function (x) {
        var u = x.res.user_info || {}, s = x.res.server_info || {};
        if (!u.auth && u.auth !== undefined) throw new Error('Login refused (wrong username or password)');
        return { via: x.via, status: u.status || '', exp: +u.exp_date || 0, max: +u.max_connections || 0, active: +u.active_cons || 0, trial: u.is_trial === '1', url: s.url || '', ts: +s.timestamp_now || 0 };
      });
    }
    function xtream(job) {
      return xjson(job, '&action=get_live_categories').then(function (cx) {
        var cats = cx.res, names = {}, groups = [], gmap = {};
        if (!(cats instanceof Array)) cats = [];
        cats.forEach(function (k) { names['$' + k.category_id] = k.category_name || 'Other'; });
        function gid(name) { var k = '$' + name, v = gmap[k]; if (v === undefined) { v = groups.length; gmap[k] = v; groups.push(name); } return v; }
        cats.forEach(function (k) { gid(k.category_name || 'Other'); });
        job.tries = [job.tries[cx.via === 'proxy' ? job.tries.length - 1 : 0]].concat(job.tries);   // the route that just worked goes first
        return xjson(job, '&action=get_live_streams').then(function (sx) {
          var list = sx.res;
          if (!(list instanceof Array)) throw new Error(list && list.user_info === undefined && list.message ? list.message : 'The server returned no channels');
          var c = newCols(), total = 0, i, s;
          for (i = 0; i < list.length; i++) {
            s = list[i]; total++;
            c.n.push(String(s.name || ('Channel ' + total))); c.g.push(gid(names['$' + s.category_id] || 'Other')); c.u.push(String(s.stream_id));
            c.l.push(s.stream_icon || ''); c.o.push(+s.num || total); c.e.push(s.epg_channel_id || '');
            if (c.n.length >= CHUNK) { S.postMessage({ id: job.id, t: 'chunk', cols: c }); c = newCols(); }
          }
          if (c.n.length) S.postMessage({ id: job.id, t: 'chunk', cols: c });
          if (!total) throw new Error('This account has no live channels');
          return { groups: groups, total: total, via: sx.via, epgUrl: '' };
        });
      });
    }

    // ---- XMLTV guide: streamed, only what is needed (programmes ending soon-or-later, next ~30 h, channels in the list) ----
    function xmlDecode(s) {
      return s.replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
        .replace(/&#(\d+);/g, function (_, n) { return String.fromCharCode(+n); }).replace(/&amp;/g, '&').replace(/<[^>]+>/g, '').trim();
    }
    function xtime(s) {                                                             // 20261016120000 +0200
      var m = /^(\d{4})(\d\d)(\d\d)(\d\d)(\d\d)(\d\d)?\s*([+-])?(\d\d)?(\d\d)?/.exec(s || '');
      if (!m) return 0;
      var t = Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4], +m[5], +(m[6] || 0)) / 1000;
      if (m[7]) t -= (m[7] === '-' ? -1 : 1) * ((+m[8] || 0) * 3600 + (+m[9] || 0) * 60);
      return Math.floor(t);
    }
    function xmltv(job) {
      var want = null, now = Math.floor(Date.now() / 1000), from = now - 2 * 3600, to = now + 30 * 3600, out = {}, nprog = 0, carry = '';
      if (job.ids) { want = {}; (typeof job.ids === 'string' ? job.ids.split('\n') : job.ids).forEach(function (x) { want['$' + x] = 1; }); }
      function block(b) {
        var ch = /channel="([^"]*)"/.exec(b); if (!ch) return;
        var id = xmlDecode(ch[1]);
        if (want && !want['$' + id]) return;
        var s = xtime((/start="([^"]*)"/.exec(b) || [])[1]), e = xtime((/stop="([^"]*)"/.exec(b) || [])[1]);
        if (!s || !e || e < from || s > to) return;
        var t = /<title[^>]*>([\s\S]*?)<\/title>/.exec(b), d = /<desc[^>]*>([\s\S]*?)<\/desc>/.exec(b);
        var arr = out['$' + id] || (out['$' + id] = []);
        if (arr.length >= 14) return;
        arr.push([s, e, t ? xmlDecode(t[1]).slice(0, 120) : '', d && s < now + 5 * 3600 ? xmlDecode(d[1]).slice(0, 240) : '']); nprog++;
      }
      function feed(text) {
        var t = carry + text, i = 0, a, z;
        for (;;) {
          a = t.indexOf('<programme', i); if (a < 0) { i = Math.max(i, t.length - 12); break; }
          z = t.indexOf('</programme>', a); if (z < 0) { i = a; break; }
          block(t.slice(a, z)); i = z + 12;
        }
        carry = t.slice(i);
      }
      return tryAll(job.tries, function (i) {
        out = {}; nprog = 0; carry = '';
        return stream(pick(job.tries, i, job.url), job.id, feed, function (got, total) { S.postMessage({ id: job.id, t: 'progress', got: got, total: total }); }, job.maxBytes).then(function () {
          if (!nprog) throw new Error('The guide has no programmes for these channels');
        });
      }).then(function (x) {
        var shards = [], cur = {}, n = 0, k, arr;
        for (k in out) {
          arr = out[k]; arr.sort(function (p, q) { return p[0] - q[0]; });
          cur[k.slice(1)] = arr; n++;
          if (n >= 1500) { shards.push(JSON.stringify(cur)); cur = {}; n = 0; }
        }
        if (n) shards.push(JSON.stringify(cur));
        return { shards: shards, programmes: nprog, via: x.via, at: now };
      });
    }

    S.onmessage = function (e) {
      var m = e.data;
      if (m.cancel) { cancelled[m.cancel] = true; return; }
      var p = m.kind === 'm3u' ? m3u(m) : m.kind === 'xtream' ? xtream(m) : m.kind === 'xmltv' ? xmltv(m) : m.kind === 'auth' ? auth(m) : Promise.reject(new Error('unknown job'));
      p.then(function (res) { S.postMessage({ id: m.id, t: 'done', result: res }); }, function (err) { S.postMessage({ id: m.id, t: 'error', message: String((err && err.message) || err), all: err && err.all }); });
    };
  }

  // ======================================================================================================================
  // client: talks to the engine (Worker when possible, otherwise the same engine on the main thread)
  // ======================================================================================================================
  function createClient(env) {
    env = env || {};
    var seq = 0, pending = {}, worker = null, fake = null, heard = false, mode = '';
    function dispatch(m) {
      heard = true;
      var j = pending[m.id]; if (!j) return;
      if (m.t === 'chunk') { if (j.onChunk) j.onChunk(m.cols); }
      else if (m.t === 'progress') { if (j.onProgress) j.onProgress(m.got, m.total); }
      else if (m.t === 'done') { delete pending[m.id]; j.resolve(m.result); }
      else if (m.t === 'error') { delete pending[m.id]; var e = new Error(m.message); e.all = m.all; j.reject(e); }
    }
    function useMainThread() {
      mode = 'main';
      if (worker) { try { worker.terminate(); } catch (e) { /* ignore */ } worker = null; }
      fake = { onmessage: null, postMessage: function (m) { setTimeout(function () { dispatch(m); }, 0); } };
      engine(fake);
    }
    function startWorker() {
      try {
        if (env.noWorker || typeof Worker === 'undefined' || typeof Blob === 'undefined' || typeof URL === 'undefined' || !URL.createObjectURL) throw new Error('no worker');
        var url = URL.createObjectURL(new Blob(['(' + engine.toString() + ')(self)'], { type: 'text/javascript' }));
        worker = new Worker(url); mode = 'worker';
        worker.onmessage = function (e) { dispatch(e.data); };
        worker.onerror = function () {                                              // could not start: run the same engine here and replay waiting jobs
          if (heard) return;
          var waiting = []; Object.keys(pending).forEach(function (k) { waiting.push(pending[k]); });
          useMainThread(); waiting.forEach(function (j) { send(j.job); });
        };
      } catch (e) { useMainThread(); }
    }
    function send(job) { if (mode === 'worker') worker.postMessage(job); else fake.onmessage({ data: job }); }
    startWorker();
    function run(job, onChunk, onProgress) {
      job.id = ++seq;
      var p = new Promise(function (resolve, reject) { pending[job.id] = { resolve: resolve, reject: reject, onChunk: onChunk, onProgress: onProgress, job: job }; });
      send(job);
      p.cancel = function () { delete pending[job.id]; try { send({ cancel: job.id }); } catch (e) { /* ignore */ } };
      return p;
    }
    return { run: run, mode: function () { return mode; }, close: function () { if (worker) { try { worker.terminate(); } catch (e) { /* ignore */ } } } };
  }

  // ======================================================================================================================
  // IndexedDB: channel chunks and guide shards (falls back to "not saved" when the TV blocks it)
  // ======================================================================================================================
  function createDB(idb) {
    var dbp = null;
    function open() {
      if (dbp) return dbp;
      dbp = new Promise(function (resolve) {
        try {
          var rq = (idb || indexedDB).open('ea_iptv', 1);
          rq.onupgradeneeded = function () { var d = rq.result; if (!d.objectStoreNames.contains('ch')) d.createObjectStore('ch'); if (!d.objectStoreNames.contains('epg')) d.createObjectStore('epg'); };
          rq.onsuccess = function () { resolve(rq.result); };
          rq.onerror = function () { resolve(null); };
          rq.onblocked = function () { resolve(null); };
        } catch (e) { resolve(null); }
      });
      return dbp;
    }
    function range(pid) { return (typeof IDBKeyRange !== 'undefined' ? IDBKeyRange : root.IDBKeyRange).bound(pid + ':', pid + ':￿'); }
    function put(store, key, val) {
      return open().then(function (db) {
        if (!db) return false;
        return new Promise(function (res) {
          try { var tx = db.transaction(store, 'readwrite'); tx.objectStore(store).put(val, key); tx.oncomplete = function () { res(true); }; tx.onerror = tx.onabort = function () { res(false); }; } catch (e) { res(false); }
        });
      });
    }
    function clear(store, pid) {
      return open().then(function (db) {
        if (!db) return false;
        return new Promise(function (res) {
          try { var tx = db.transaction(store, 'readwrite'); tx.objectStore(store).delete(range(pid)); tx.oncomplete = function () { res(true); }; tx.onerror = tx.onabort = function () { res(false); }; } catch (e) { res(false); }
        });
      });
    }
    function all(store, pid, each) {                                                // each(value) per record in key order; resolves with the count
      return open().then(function (db) {
        if (!db) return 0;
        return new Promise(function (res) {
          var n = 0;
          try {
            var rq = db.transaction(store, 'readonly').objectStore(store).openCursor(range(pid));
            rq.onsuccess = function () { var c = rq.result; if (c) { each(c.value); n++; c.continue(); } else res(n); };
            rq.onerror = function () { res(n); };
          } catch (e) { res(n); }
        });
      });
    }
    function pad(i) { return ('0000' + i).slice(-4); }
    return {
      putChunk: function (pid, i, cols) { return put('ch', pid + ':' + pad(i), cols); },
      eachChunk: function (pid, each) { return all('ch', pid, each); },
      dropChannels: function (pid) { return clear('ch', pid); },
      putEpg: function (pid, i, json) { return put('epg', pid + ':' + pad(i), json); },
      eachEpg: function (pid, each) { return all('epg', pid, each); },
      dropEpg: function (pid) { return clear('epg', pid); }
    };
  }

  // ======================================================================================================================
  // small helpers shared by the UI and the tests
  // ======================================================================================================================
  var ADULT = /(^|[^a-z0-9])(xxx|porn[a-z]*|erotic[a-z]*|hentai|playboy|hustler|brazzers|redlight|adults? only|adult (movies?|channel|tv|content|xxx)|18\+|\+18)([^a-z0-9]|$)/i;
  function isAdultName(s) { return ADULT.test(s || ''); }

  // all words must appear in the (already lower-cased) name; names starting with the first word come first
  function search(low, q, max) {
    q = String(q || '').toLowerCase().trim();
    if (!q) return [];
    var w = q.split(/\s+/), a = [], b = [], i, k, s, ok, lim = max || 3000;
    for (i = 0; i < low.length && a.length + b.length < lim; i++) {
      s = low[i]; ok = true;
      for (k = 0; k < w.length; k++) if (s.indexOf(w[k]) < 0) { ok = false; break; }
      if (ok) (s.indexOf(w[0]) === 0 ? a : b).push(i);
    }
    return a.concat(b);
  }

  // programmes: [[start, stop, title, desc], ...] sorted; returns { now, next, pct }
  function nowNext(list, t) {
    if (!list || !list.length) return null;
    var i, cur = null, nxt = null;
    for (i = 0; i < list.length; i++) {
      if (list[i][0] <= t && t < list[i][1]) { cur = list[i]; nxt = list[i + 1] || null; break; }
      if (list[i][0] > t) { nxt = list[i]; break; }
    }
    if (!cur && !nxt) return null;
    return { now: cur, next: nxt, pct: cur ? Math.max(0, Math.min(100, (t - cur[0]) / (cur[1] - cur[0]) * 100)) : 0 };
  }
  function utf8b64(s) {                                                             // Xtream short-EPG titles are base64 UTF-8
    try { return decodeURIComponent(escape(atob(s))); } catch (e) { try { return atob(s); } catch (e2) { return s || ''; } }
  }
  function xtreamUrl(pl, id, ext) { return String(pl.server).replace(/\/+$/, '') + '/live/' + encodeURIComponent(pl.user) + '/' + encodeURIComponent(pl.pass) + '/' + id + '.' + (ext || pl.ext || 'm3u8'); }
  function normServer(s) {
    s = String(s || '').trim().replace(/\/+$/, '').replace(/\/(player_api|get|xmltv|panel_api)\.php.*$/i, '');
    if (s && !/^https?:\/\//i.test(s)) s = 'http://' + s;
    return s;
  }
  // "http://host:8080/get.php?username=U&password=P&type=m3u_plus" is really an Xtream login: spot it so the richer API is used
  function sniffXtream(url) {
    var m = /^(https?:\/\/[^\/?#]+(?:\/[^?#]*?)?)\/(?:get|player_api|xmltv|panel_api)\.php\?([^#]*)/i.exec(String(url || '').trim());
    if (!m) return null;
    var u = /(?:^|&)username=([^&]*)/.exec(m[2]), p = /(?:^|&)password=([^&]*)/.exec(m[2]);
    return u && p ? { server: m[1], user: decodeURIComponent(u[1]), pass: decodeURIComponent(p[1]) } : null;
  }

  return { engine: engine, createClient: createClient, createDB: createDB, search: search, nowNext: nowNext, isAdultName: isAdultName, utf8b64: utf8b64, xtreamUrl: xtreamUrl, normServer: normServer, sniffXtream: sniffXtream };
});
