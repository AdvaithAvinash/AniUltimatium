/* Live Sports sources — every match / stream provider besides Matchora (which has its own module, matchora.js).
 *   sportsrc      SportSRC v3 (api.sportsrc.org): football matches with streams; the licence key lives on OUR server (action=sportsrc), never in the app
 *   streamcenter  StreamCenter (streamcenter.st/api): matches of all sports, streams resolved when a match is opened
 *   embedsportex  EmbedSportex (api.esportex.site/api/streams): live and upcoming matches with ready iframe servers
 *   TheSportsDB   not a stream source: free team badges for matches whose source has none (looked up one at a time, remembered on the device)
 * (VIPStreams has no match list any more: its live-TV catalogue answers "disabled", and its stream route needs ids that only other sites know, so it cannot be offered.)
 * Every source returns the SAME event shape as Matchora (see matchora.js), so the Sports screen does not care where a match came from.
 * Embed addresses are validated here: https only, a real host name, no credentials or ports; EmbedSportex only on its own domain.
 * ES5 on purpose (Tizen 3 / 4). Works in browsers (window.SportProviders) and in Node for the tests. */
(function (root) {
  'use strict';
  var M = root.Matchora || (typeof require === 'function' ? require('./matchora.js') : null);
  var TTL = { sc_all: 120000, sc_live: 45000, sc_stream: 60000, es: 60000, ss_live: 120000, ss_day: 600000, ss_detail: 120000 };

  // ---------------------------------------------------------------- shared checks
  var SAFE_URL = /^https:\/\/([a-z0-9-]+(?:\.[a-z0-9-]+)+)(\/[A-Za-z0-9_\-.~%\/?=&#+:,;@!*]{0,500})?$/i;
  function safeHttps(u, hostRe) {
    u = typeof u === 'string' ? u.replace(/^\s+|\s+$/g, '') : '';
    if (u.length > 600) return null;
    var m = SAFE_URL.exec(u); if (!m) return null;
    var h = m[1].toLowerCase();
    if (/^\d+(\.\d+){3}$/.test(h) || h === 'localhost' || /\.(local|internal|localhost)$/.test(h)) return null;
    if (hostRe && !hostRe.test(h)) return null;
    return u;
  }
  var ES_HOST = /(^|\.)esportex\.site$/;
  var IMG_OK = [/^https:\/\/img\.sportsrc\.org\/v3\/assets\/[A-Za-z0-9_-]{8,200}\.(png|svg|webp|jpg)$/, /^https:\/\/streamcenter\.st\/api\/images\/(badge|poster)\/[A-Za-z0-9-]{8,64}\.webp$/,
    /^https:\/\/(r2|www)\.thesportsdb\.com\/images\/[A-Za-z0-9_\/.-]{4,160}$/];
  function safeImg(u) {                                                                           // team crests: only from the sources' own image hosts
    if (typeof u !== 'string') return '';
    if (M.safeBadge(u)) return u;
    for (var i = 0; i < IMG_OK.length; i++) if (IMG_OK[i].test(u)) return u;
    return '';
  }
  var SPORT = { football: 'Soccer', soccer: 'Soccer', basketball: 'Basketball', hockey: 'Ice Hockey', 'ice-hockey': 'Ice Hockey', icehockey: 'Ice Hockey', amfootball: 'American Football', 'american-football': 'American Football',
    baseball: 'Baseball', tennis: 'Tennis', boxing: 'Fighting', mma: 'Fighting', fighting: 'Fighting', ufc: 'Fighting', racing: 'Motorsport', race: 'Motorsport', motorsport: 'Motorsport', f1: 'Motorsport',
    cricket: 'Cricket', rugby: 'Rugby', golf: 'Golf', volleyball: 'Volleyball', badminton: 'Badminton', darts: 'Darts', snooker: 'Snooker' };
  function sportName(k) { k = String(k || '').toLowerCase().replace(/^\s+|\s+$/g, ''); if (SPORT[k]) return SPORT[k]; return k ? k.charAt(0).toUpperCase() + k.slice(1) : 'Other'; }
  function str(v) { return typeof v === 'string' ? v.replace(/\s+/g, ' ').replace(/^ | $/g, '') : (typeof v === 'number' && isFinite(v) ? String(v) : ''); }
  function safeId(v) { v = str(v); return /^[A-Za-z0-9_.:\/-]{1,160}$/.test(v) ? v : ''; }
  function mkEvent(o) {
    var kick = typeof o.kickoff === 'number' && isFinite(o.kickoff) && o.kickoff > 0 ? Math.floor(o.kickoff) : 0;
    return { id: o.src + ':' + o.rid, rid: o.rid, src: o.src, home: o.home || '', away: o.away || '', league: o.league || '', sport: o.sport || 'Other', watching: 0, kickoff: kick,
      status: o.status || '', minute: o.minute || '', note: o.note || '', score: o.score || null, live: !!o.live, finished: !!o.finished, cancelled: !!o.cancelled,
      badges: { home: safeImg(o.bh), away: safeImg(o.ba), league: safeImg(o.bl) }, channels: o.channels || [], embed: null, page: '', lazy: !!o.lazy, groups: o.groups || null };
  }
  function mkChannel(src, rid, n, name, embed, q, lang, hostRe) {
    return { id: src + ':' + rid + ':' + n, name: name, country: '', quality: q || '', lang: lang && lang !== 'Unknown' ? lang : '', watching: 0, playing: false, dead: false, embed: safeHttps(embed, hostRe) };
  }
  function splitTitle(t) { var m = /^(.+?)\s+(?:vs\.?|v|at|-)\s+(.+)$/i.exec(str(t)); return m ? [m[1], m[2]] : [str(t), '']; }
  function score(h, a) { return typeof h === 'number' && typeof a === 'number' ? { h: h, a: a, raw: h + '-' + a } : null; }
  function bad(msg) { return M.MatchoraError('malformed', msg || M.MESSAGES.malformed); }
  function listOf(doc, what) { if (!(doc instanceof Array)) throw bad(); return doc; }

  // ---------------------------------------------------------------- SportSRC
  function ssStatus(s, detail) {
    var st = String(s || ''), r = { status: '', live: false, finished: false, cancelled: false, note: str(detail) };
    if (st === 'inprogress') { r.live = true; r.status = 'LIVE'; }
    else if (st === 'finished') { r.finished = true; r.status = 'FT'; r.note = ''; }
    else if (st === 'canceled') { r.cancelled = true; r.status = 'CANC'; }
    else if (st === 'postponed') { r.cancelled = true; r.status = 'PST'; }
    else if (st === 'suspended' || st === 'interrupted') { r.status = st === 'suspended' ? 'SUSP' : 'INT'; r.note = r.note || st; }
    return r;
  }
  function ssParse(doc) {
    if (!doc || doc.success === false || !(doc.data instanceof Array)) throw bad();
    var out = [], skipped = 0, seen = {};
    doc.data.forEach(function (lg) {
      if (!lg || !(lg.matches instanceof Array)) { skipped++; return; }
      var L = lg.league || {}, name = str(L.name) + (L.country ? '' : '');
      lg.matches.forEach(function (m) {
        var id = m && safeId(m.id), t = m && m.teams || {}, h = str(t.home && t.home.name), a = str(t.away && t.away.name);
        if (!id || (!h && !a) || seen[id]) { skipped++; return; }
        seen[id] = 1;
        var s = ssStatus(m.status, m.status_detail), sc = m.score && m.score.current, ev;
        ev = mkEvent({ src: 'ss', rid: id, home: h, away: a, league: name, sport: 'Soccer', kickoff: typeof m.timestamp === 'number' ? m.timestamp / 1000 : 0, status: s.status, note: s.note,
          score: sc ? score(sc.home, sc.away) : null, live: s.live, finished: s.finished, cancelled: s.cancelled, bh: t.home && t.home.badge, ba: t.away && t.away.badge, bl: L.logo, lazy: true });
        out.push(ev);
      });
    });
    return { events: out, skipped: skipped };
  }
  function ssDetail(ev, doc) {
    var d = doc && doc.data, srcs = d && d.sources;
    if (!(srcs instanceof Array)) throw bad();
    var ch = [];
    srcs.forEach(function (s, i) {
      var c = s && mkChannel('ss', ev.rid, s.streamNo || i + 1, 'Stream ' + (s.streamNo || i + 1) + (s.source ? ' · ' + str(s.source) : ''), s.embedUrl, s.hd ? 'HD' : '', str(s.language));
      if (c && c.embed) ch.push(c);
    });
    var o = {}; for (var k in ev) if (ev.hasOwnProperty(k)) o[k] = ev[k];
    o.channels = ch; o.lazy = false; return o;
  }

  // ---------------------------------------------------------------- StreamCenter
  var SC = 'https://streamcenter.st';
  function scBadge(id) { return typeof id === 'string' && /^[A-Za-z0-9-]{8,64}$/.test(id) ? SC + '/api/images/badge/' + id + '.webp' : ''; }
  function scParse(doc, liveIds) {
    listOf(doc); var out = [], skipped = 0, seen = {};
    doc.forEach(function (m) {
      var id = m && safeId(m.id); if (!id || seen[id] || !(m.sources instanceof Array)) { skipped++; return; }
      var t = m.teams || {}, h = str(t.home && t.home.name), a = str(t.away && t.away.name), tt = splitTitle(m.title);
      if (!h && !a) { h = tt[0]; a = tt[1]; }
      if (!h && !a) { skipped++; return; }
      seen[id] = 1;
      var groups = m.sources.map(function (g) { return g && { source: safeId(g.source), id: safeId(g.id) }; }).filter(function (g) { return g && g.source && g.id; });
      var live = !!(liveIds && liveIds[id]), sport = sportName(m.category);
      out.push(mkEvent({ src: 'sc', rid: id, home: h, away: a, league: sport, sport: sport, kickoff: typeof m.date === 'number' ? m.date / 1000 : 0, status: live ? 'LIVE' : '', live: live,
        bh: t.home && scBadge(t.home.badge), ba: t.away && scBadge(t.away.badge), lazy: groups.length > 0, groups: groups }));
    });
    return { events: out, skipped: skipped };
  }

  // ---------------------------------------------------------------- EmbedSportex (times are WIB = UTC+7)
  function esTime(s) { var m = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})/.exec(String(s || '')); return m ? Date.UTC(+m[1], +m[2] - 1, +m[3], +m[4] - 7, +m[5]) / 1000 : 0; }
  function esParse(doc, nowMs) {
    if (!doc || typeof doc !== 'object' || doc.success === false) throw bad();
    var out = [], skipped = 0, seen = {}, now = nowMs / 1000;
    Object.keys(doc).forEach(function (k) {
      if (!(doc[k] instanceof Array)) return;
      doc[k].forEach(function (m) {
        var slug = m && safeId(m.slug), tt = m && splitTitle(m.tag); if (!slug || !tt[0] || !(m.iframes instanceof Array)) { skipped++; return; }
        var rid = k + '/' + slug; if (seen[rid]) { skipped++; return; } seen[rid] = 1;
        var ko = esTime(m.kickoff), end = esTime(m.endTime) || (ko ? ko + 9000 : 0), live = ko > 0 && now >= ko && now < end, fin = end > 0 && now >= end;
        var ch = []; m.iframes.forEach(function (f, i) { var c = f && mkChannel('ex', rid, i + 1, str(f.server) || 'Server ' + (i + 1), f.url, '', '', ES_HOST); if (c && c.embed) ch.push(c); });
        out.push(mkEvent({ src: 'ex', rid: rid, home: tt[0], away: tt[1], league: str(m.league), sport: sportName(k), kickoff: ko, status: live ? 'LIVE' : fin ? 'FT' : '', live: live, finished: fin, channels: ch }));
      });
    });
    return { events: out, skipped: skipped };
  }

  // ---------------------------------------------------------------- the provider objects
  function create(env) {
    env = env || {};
    var now = env.now || function () { return Date.now(); };
    var apiBase = env.apiBase || function () { return ''; };
    function fx(extra) { var o = { fetch: env.fetch, now: env.now, timeout: env.timeout, retryDelay: env.retryDelay, wait: env.wait }; for (var k in extra) if (extra.hasOwnProperty(k)) o[k] = extra[k]; return M.createFetcher(o); }
    var ssF = fx({}), scF = fx({}), esF = fx({});
    function wrap(r, data) { return { data: data, at: r.at, cached: r.cached, stale: r.stale, error: r.error || null }; }
    function dayOf(r, day) { var seen = {}, list = []; r.forEach(function (x) { x.data.events.forEach(function (e) { if (!seen[e.id] && M.inDay(e, day)) { seen[e.id] = 1; list.push(e); } }); }); return list; }
    function ssUrl(q) { return apiBase() + '/api?action=sportsrc&' + q; }
    var P = {};

    P.matchora = (function () {
      var c = env.matchora || M.createClient({ fetch: env.fetch, now: env.now, timeout: env.timeout, retryDelay: env.retryDelay, wait: env.wait });
      return { id: 'matchora', name: 'Matchora', note: 'All sports · channels listed', embedTrust: 'matchora', client: c,
        live: function (o) { return c.live(o); }, day: function (d, o) { return c.day(d, o); },
        event: function (ev, o) { return c.event(ev.id, o).then(function (r) { return wrap(r, r.data); }); } };
    })();

    P.sportsrc = { id: 'sportsrc', name: 'SportSRC', note: 'Football · needs the app server', embedTrust: 'provider',
      live: function (o) { return ssF.get('ss:live', ssUrl('type=matches&sport=football&status=inprogress'), TTL.ss_live, o && o.force, ssParse).then(function (r) { return wrap(r, r.data); }); },
      day: function (day, o) {
        return Promise.all(day.utc.map(function (k) { return ssF.get('ss:day:' + k, ssUrl('type=matches&sport=football&date=' + k), TTL.ss_day, o && o.force, ssParse); })).then(function (rs) {
          var r0 = { at: Infinity, cached: true, stale: false, error: null };
          rs.forEach(function (r) { r0.at = Math.min(r0.at, r.at); r0.cached = r0.cached && r.cached; r0.stale = r0.stale || r.stale; r0.error = r0.error || r.error; });
          return wrap(r0, { events: dayOf(rs, day), skipped: 0 });
        });
      },
      event: function (ev, o) {
        return ssF.get('ss:detail:' + ev.rid, ssUrl('type=detail&id=' + encodeURIComponent(ev.rid)), TTL.ss_detail, o && o.force, function (doc) { return ssDetail(ev, doc); }).then(function (r) { return wrap(r, r.data); });
      } };

    function scAll(o) { return scF.get('sc:all', SC + '/api/matches/all', TTL.sc_all, o && o.force, function (d) { return listOf(d); }); }
    function scLive(o) { return scF.get('sc:live', SC + '/api/matches/live', TTL.sc_live, o && o.force, function (d) { return listOf(d); }); }
    P.streamcenter = { id: 'streamcenter', name: 'StreamCenter', note: 'All sports · streams found when you open a match', embedTrust: 'provider',
      live: function (o) { return scLive(o).then(function (r) { var ids = {}; r.data.forEach(function (m) { if (m && m.id) ids[m.id] = 1; }); return wrap(r, scParse(r.data, ids)); }); },
      day: function (day, o) {
        return Promise.all([scAll(o), scLive(o).then(function (r) { return r; }, function () { return { data: [], at: 0 }; })]).then(function (rs) {
          var ids = {}; rs[1].data.forEach(function (m) { if (m && m.id) ids[m.id] = 1; });
          var p = scParse(rs[0].data, ids), seen = {}, list = [];
          p.events.forEach(function (e) { if (!seen[e.id] && M.inDay(e, day)) { seen[e.id] = 1; list.push(e); } });
          return wrap(rs[0], { events: list, skipped: p.skipped });
        });
      },
      event: function (ev, o) {
        var gs = (ev.groups || []).slice(0, 3);
        if (!gs.length) return Promise.reject(bad('This match has no streams'));
        return Promise.all(gs.map(function (g) {
          return scF.get('sc:stream:' + g.source + '/' + g.id, SC + '/api/stream/' + encodeURIComponent(g.source) + '/' + encodeURIComponent(g.id), TTL.sc_stream, o && o.force, function (d) { return listOf(d); }).then(function (r) { return r; }, function () { return null; });
        })).then(function (rs) {
          var ch = [], at = 0, any = false;
          rs.forEach(function (r) { if (!r) return; any = true; at = Math.max(at, r.at); r.data.forEach(function (s, i) { var c = s && mkChannel('sc', ev.rid, (s.source || '') + (s.streamNo || i + 1), 'Stream ' + (s.streamNo || i + 1) + (s.source ? ' · ' + str(s.source) : ''), s.embedUrl, s.hd ? 'HD' : '', str(s.language)); if (c && c.embed) ch.push(c); }); });
          if (!any) throw M.MatchoraError('upstream', M.MESSAGES.upstream);
          var out = {}; for (var k in ev) if (ev.hasOwnProperty(k)) out[k] = ev[k]; out.channels = ch; out.lazy = false;
          return { data: out, at: at, cached: false, stale: false, error: null };
        });
      } };

    function esAll(o) { return esF.get('es:all', 'https://api.esportex.site/api/streams', TTL.es, o && o.force, function (d) { return esParse(d, now()); }); }
    P.embedsportex = { id: 'embedsportex', name: 'EmbedSportex', note: 'Football, basketball, racing... · iframe servers listed', embedTrust: 'provider',
      live: function (o) { return esAll(o).then(function (r) { return wrap(r, { events: r.data.events.filter(function (e) { return e.live; }), skipped: r.data.skipped }); }); },
      day: function (day, o) { return esAll(o).then(function (r) { return wrap(r, { events: r.data.events.filter(function (e) { return M.inDay(e, day); }), skipped: r.data.skipped }); }); },
      event: function (ev) { return Promise.resolve({ data: ev, at: now(), cached: true, stale: false, error: null }); } };      // its servers are listed with the match: nothing to look up
    return P;
  }

  // ---------------------------------------------------------------- TheSportsDB badges (not a stream source)
  var TSDB = 'https://www.thesportsdb.com/api/v1/json/123/searchteams.php?t=';
  function createBadges(env) {
    env = env || {};
    var store = env.store || { get: function (k, d) { return d; }, set: function () {} }, fetchFn = env.fetch || (typeof fetch === 'function' ? function (u) { return fetch(u); } : null);
    var gap = env.gap != null ? env.gap : 2300, timer = env.timer || function (fn, ms) { return setTimeout(fn, ms); }, memo = null, queue = [], running = false, asked = {};
    function load() { if (!memo) { memo = store.get('ea_sp_bdg', {}); if (!memo || typeof memo !== 'object') memo = {}; } return memo; }
    function save() { var m = load(), ks = Object.keys(m); if (ks.length > 400) { ks.slice(0, ks.length - 400).forEach(function (k) { delete m[k]; }); } store.set('ea_sp_bdg', m); }
    function key(n) { return M.normName(n); }
    function lookup(name) {
      return Promise.resolve().then(function () { return fetchFn(TSDB + encodeURIComponent(name)); }).then(function (r) { if (!r.ok) throw new Error('http'); return r.json(); }).then(function (d) {
        var t = d && d.teams instanceof Array ? d.teams : [], i, best = '';
        for (i = 0; i < t.length; i++) if (t[i] && M.nameScore(name, t[i].strTeam) >= 0.8) { best = safeImg(t[i].strBadge || ''); if (best) break; }
        return best;
      });
    }
    function pump() {
      if (running || !queue.length) return; running = true;
      var job = queue.shift();
      lookup(job.name).then(function (u) { load()[job.k] = u || 'x'; save(); job.done(u); }, function () { /* try again another time */ }).then(function () { running = false; timer(pump, gap); });
    }
    return {
      // Fills in missing crests of the given events from the saved list at once, and from TheSportsDB (a few per call) in the background; onChange runs when something was found.
      fill: function (events, onChange, max) {
        var m = load(), budget = max == null ? 6 : max, changed = false;
        events.forEach(function (ev) {
          ['home', 'away'].forEach(function (side) {
            var n = ev[side]; if (!n || ev.badges[side]) return;
            var k = key(n), v = m[k];
            if (v && v !== 'x') { ev.badges[side] = safeImg(v); changed = changed || !!ev.badges[side]; return; }
            if (v === 'x' || asked[k] || budget <= 0 || !fetchFn) return;
            asked[k] = 1; budget--;
            queue.push({ name: n, k: k, done: function (u) { if (u) { ev.badges[side] = safeImg(u); if (onChange) onChange(); } } });
          });
        });
        if (changed && onChange) onChange();
        pump();
      },
      _memo: load
    };
  }

  var api = { create: create, createBadges: createBadges, safeHttps: safeHttps, safeImg: safeImg, sportName: sportName, ES_HOST: ES_HOST,
    parse: { sportsrc: ssParse, sportsrcDetail: ssDetail, streamcenter: scParse, embedsportex: esParse }, esTime: esTime, TTL: TTL,
    ORDER: ['matchora', 'sportsrc', 'streamcenter', 'embedsportex'] };
  if (typeof module === 'object' && module.exports) module.exports = api; else root.SportProviders = api;
})(typeof window !== 'undefined' ? window : this);
