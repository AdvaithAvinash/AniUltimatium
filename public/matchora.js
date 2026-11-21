/* Matchora data module — everything that knows about the Matchora API lives here, and nothing else does.
 *   https://matchora.pro   (matchora.to is not used)
 *   GET /api/v1/live            { count, events: [event] }        matches that are on now
 *   GET /api/v1/schedule        { count, events: [event] }        ~9 days; ?date=YYYY-MM-DD (UTC day) returns one day
 *   GET /api/v1/channels        { count, channels: [{ name, countries[], quality, featured, feeds[{label,country,quality,embed_url}] }] }
 *   GET /api/v1/events/{id}     one event; an unknown id answers HTTP 502 {"error":"... unknown fixture"}
 * event   = { id, home, away, league, sport, watching, home_badge, away_badge, league_badge, kickoff (unix seconds), status, minute, score ("1-1" | null),
 *             live, finished, channel_count, channels[], embed_url, page_url }
 * channel = { id, name, country (flag emoji), quality, lang, watching, playing, dead, embed_url }
 * These shapes were captured from the real API (tests/fixtures/matchora). The API has no direct stream URLs: playback is Matchora's own embed page (https://matchora.pro/embed/...).
 *
 * What this module adds: tolerant parsing (a bad item is skipped, a bad document is an error), caching, one retry on 502/503/504, back-off on 429, timeouts,
 * stale-while-error, local-day handling, filters, league grouping, channel ordering / de-duplication and embed address validation.
 * ES5 on purpose (Tizen 3 = Chromium 47, Tizen 4 = Chromium 56): no arrow functions, no AbortController, no URL / URLSearchParams.
 * Works in browsers (window.Matchora) and in Node (module.exports) for the tests. */
(function (root) {
  'use strict';
  var BASE = 'https://matchora.pro';
  var TTL = { live: 30000, day: 120000, today: 45000, event: 20000, channels: 600000 };        // the API itself caches for 15-20 s
  var TIMEOUT = 12000, RETRY_MS = 700, BACKOFF_DEFAULT = 30000, BACKOFF_MAX = 120000, PENALTY_MS = 3 * 60000;
  var LIVE_STATUS = /^(LIVE|1H|2H|HT|ET|BT|Q[1-4]|OT|P[1-3]|PEN|INT|SO)$/i;
  var DONE_STATUS = /^(FT|AET|AP|AOT|AW|WO|CANC|PST|ABD)$/i;

  function str(v) { return typeof v === 'string' ? v.replace(/\s+/g, ' ').replace(/^ | $/g, '') : (typeof v === 'number' && isFinite(v) ? String(v) : ''); }
  function int(v) { var n = typeof v === 'number' ? v : parseInt(v, 10); return isFinite(n) && n > 0 ? Math.floor(n) : 0; }

  // ---------------------------------------------------------------- errors
  function MatchoraError(kind, message, extra) {
    var e = new Error(message); e.name = 'MatchoraError'; e.kind = kind;                          // kinds: rate, upstream, timeout, offline, malformed, unknown, http
    if (extra) for (var k in extra) if (extra.hasOwnProperty(k)) e[k] = extra[k];
    return e;
  }
  var MESSAGES = {
    rate: 'Matchora is busy right now (too many requests). Showing the last list; it will try again shortly.',
    upstream: 'Matchora did not answer properly (server error). Try again in a moment.',
    timeout: 'Matchora took too long to answer. Check your connection and try again.',
    offline: 'Could not reach Matchora. Check your internet connection.',
    malformed: 'Matchora sent data this app could not read.',
    unknown: 'Matchora does not know this match any more.',
    http: 'Matchora could not give this list.'
  };

  // ---------------------------------------------------------------- embed addresses
  // Matchora's embed pages live on matchora.pro and its two-letter language sub-domains (es.matchora.pro). The /channels endpoint still returns matchora.to
  // addresses for some feeds; the same /embed/ path answers on matchora.pro (checked), so those are rewritten to .pro and matchora.to is never loaded.
  var EMBED_RE = /^https:\/\/((?:[a-z]{2}\.)?matchora\.(?:pro|to))(\/embed\/[A-Za-z0-9_\/-]{1,120})(\?[A-Za-z0-9_=&.%-]{0,200})?$/i;
  function safeEmbed(u) {
    var m = EMBED_RE.exec(typeof u === 'string' ? u.replace(/^\s+|\s+$/g, '') : '');
    if (!m) return null;
    return 'https://' + m[1].toLowerCase().replace(/\.to$/, '.pro') + m[2] + (m[3] || '');
  }
  function embedHost(u) { var m = /^https:\/\/([^\/?#]+)/.exec(u || ''); return m ? m[1] : ''; }
  var BADGE_RE = /^https:\/\/(?:[a-z]{2}\.)?matchora\.pro\/img\?k=[A-Za-z0-9_-]{8,600}$/;
  function safeBadge(u) { return typeof u === 'string' && BADGE_RE.test(u) ? u : ''; }                // team crests are only drawn from Matchora's own image proxy

  // ---------------------------------------------------------------- normalising what the API sends
  function normChannel(c) {
    if (!c || typeof c !== 'object') return null;
    var id = str(c.id); if (!/^[A-Za-z0-9_-]{1,24}$/.test(id)) return null;
    return { id: id, name: str(c.name) || 'Channel ' + id, country: str(c.country), quality: str(c.quality), lang: str(c.lang), watching: int(c.watching),
      playing: c.playing === true, dead: c.dead === true, embed: safeEmbed(c.embed_url) };
  }
  function parseScore(s) {
    if (typeof s !== 'string' || !s.replace(/\s/g, '')) return null;
    var m = /^\s*(\d{1,3})\s*[-:–]\s*(\d{1,3})\s*$/.exec(s);
    return m ? { h: parseInt(m[1], 10), a: parseInt(m[2], 10), raw: s } : { h: null, a: null, raw: str(s) };
  }
  function normEvent(r) {
    if (!r || typeof r !== 'object') return null;
    var id = str(r.id); if (!/^[A-Za-z0-9_-]{1,24}$/.test(id)) return null;
    var home = str(r.home), away = str(r.away); if (!home && !away) return null;
    var status = str(r.status).toUpperCase(), chans = [], i, c;
    if (r.channels instanceof Array) for (i = 0; i < r.channels.length; i++) { c = normChannel(r.channels[i]); if (c) chans.push(c); }
    var live = r.live === true || (r.live !== false && LIVE_STATUS.test(status)), cancelled = /^(CANC|PST|ABD)$/.test(status);
    var finished = !live && (r.finished === true || DONE_STATUS.test(status));
    var minute = str(r.minute);
    return { id: id, home: home, away: away, league: str(r.league), sport: str(r.sport) || 'Other', watching: int(r.watching), kickoff: int(r.kickoff),
      status: status, minute: /^[0-9]{1,3}(\+[0-9]{1,2})?$/.test(minute) ? minute : '', score: parseScore(r.score), live: live, finished: finished, cancelled: cancelled,
      badges: { home: safeBadge(r.home_badge), away: safeBadge(r.away_badge), league: safeBadge(r.league_badge) },
      channels: chans, embed: safeEmbed(r.embed_url), page: str(r.page_url) };
  }
  // A document is { events: [...] } (the list endpoints) or a single event object. A bad item is skipped and counted; a document of the wrong shape is an error.
  function parseList(doc) {
    if (!doc || typeof doc !== 'object' || !(doc.events instanceof Array)) throw MatchoraError('malformed', MESSAGES.malformed);
    var out = [], skipped = 0, seen = {};
    for (var i = 0; i < doc.events.length; i++) {
      var e = normEvent(doc.events[i]);
      if (!e) { skipped++; continue; }
      if (seen[e.id]) { skipped++; continue; }
      seen[e.id] = 1; out.push(e);
    }
    if (doc.events.length && !out.length) throw MatchoraError('malformed', MESSAGES.malformed);
    return { events: out, skipped: skipped };
  }
  function parseOne(doc) {
    var e = normEvent(doc);
    if (!e) throw MatchoraError('malformed', MESSAGES.malformed);
    return e;
  }

  // ---------------------------------------------------------------- local days (the schedule picker)
  function pad(n) { return (n < 10 ? '0' : '') + n; }
  function utcKey(ms) { var d = new Date(ms); return d.getUTCFullYear() + '-' + pad(d.getUTCMonth() + 1) + '-' + pad(d.getUTCDate()); }
  function localKey(ms) { var d = new Date(ms); return d.getFullYear() + '-' + pad(d.getMonth() + 1) + '-' + pad(d.getDate()); }
  var DAYN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'], MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  // n days starting with the viewer's today, each as [start, end) in local time. A local day can touch two UTC days; `utc` lists the ones to ask the API for.
  function weekDays(nowMs, n) {
    var out = [], d0 = new Date(nowMs), i;
    for (i = 0; i < (n || 7); i++) {
      var s = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate() + i, 0, 0, 0, 0), e = new Date(d0.getFullYear(), d0.getMonth(), d0.getDate() + i + 1, 0, 0, 0, 0);
      var a = utcKey(s.getTime()), b = utcKey(e.getTime() - 1);
      out.push({ key: localKey(s.getTime()), start: s.getTime(), end: e.getTime(), utc: a === b ? [a] : [a, b], today: i === 0,
        label: i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : DAYN[s.getDay()], sub: s.getDate() + ' ' + MON[s.getMonth()] });
    }
    return out;
  }
  function inDay(ev, day) { var t = ev.kickoff * 1000; return t >= day.start && t < day.end; }
  function fmtClock(sec, clock12) {
    var d = new Date(sec * 1000), h = d.getHours(), m = pad(d.getMinutes());
    if (clock12) { var ap = h >= 12 ? ' PM' : ' AM'; h = h % 12 || 12; return h + ':' + m + ap; }
    return pad(h) + ':' + m;
  }
  var LIVE_TEXT = { HT: 'HT', ET: 'ET', BT: 'Break', Q1: 'Q1', Q2: 'Q2', Q3: 'Q3', Q4: 'Q4', OT: 'OT', P1: 'P1', P2: 'P2', P3: 'P3', PEN: 'PEN', SO: 'SO', INT: 'INT' };
  // What the card shows in its status corner.
  function statusInfo(ev, nowMs, clock12) {
    if (ev.live) return { kind: 'live', text: ev.minute ? ev.minute + "'" : (LIVE_TEXT[ev.status] || ''), label: 'LIVE' };
    if (ev.cancelled) return { kind: 'cancelled', text: '', label: ev.status === 'PST' ? 'POSTPONED' : 'CANCELLED' };
    if (ev.finished) return { kind: 'finished', text: '', label: ev.status === 'AP' ? 'AP' : 'FT' };
    if (!ev.kickoff) return { kind: 'unknown', text: '', label: 'TBA' };
    var diff = ev.kickoff * 1000 - nowMs, mins = Math.round(diff / 60000);
    if (diff > 0 && mins < 360) return { kind: 'soon', text: mins < 60 ? 'in ' + Math.max(1, mins) + ' min' : 'in ' + Math.floor(mins / 60) + 'h' + (mins % 60 ? ' ' + (mins % 60) + 'm' : ''), label: fmtClock(ev.kickoff, clock12) };
    if (diff <= 0 && !ev.finished) return { kind: 'started', text: '', label: fmtClock(ev.kickoff, clock12) };   // kick-off passed but the API has not marked it live
    return { kind: 'upcoming', text: '', label: fmtClock(ev.kickoff, clock12) };
  }

  // ---------------------------------------------------------------- feeds (channels)
  var Q_RANK = { FHD: 3, HD: 2, SD: 1 };
  var GENERIC = { hd: 1, fhd: 1, uhd: 1, sd: 1, '4k': 1, '1080p': 1, '720p': 1, '1080': 1, '720': 1, live: 1, channel: 1, tv: 1, the: 1, hevc: 1, hdr: 1 };
  function nameTokens(name) {
    var s = String(name || '').toLowerCase();
    try { s = s.normalize('NFD').replace(/[̀-ͯ]/g, ''); } catch (e) { /* old engine */ }
    s = s.replace(/\([^)]*\)|\[[^\]]*\]/g, ' ').replace(/\+/g, ' plus ').replace(/&/g, ' and ').replace(/[^a-z0-9]+/g, ' ');
    var parts = s.split(' '), out = [], i;
    for (i = 0; i < parts.length; i++) if (parts[i] && !GENERIC[parts[i]]) out.push(parts[i]);
    if (!out.length) for (i = 0; i < parts.length; i++) if (parts[i]) out.push(parts[i]);        // a name made only of tags (e.g. "HD") still compares
    return out;
  }
  function normName(name) { return nameTokens(name).join(' '); }
  // 1 = same channel, 0 = unrelated. "Sky Sports" vs "Sky Sports Main Event" is deliberately NOT a match (they are different channels).
  function nameScore(a, b) {
    var ta = nameTokens(a), tb = nameTokens(b);
    if (!ta.length || !tb.length) return 0;
    var sa = {}, sb = {}, i, inter = 0, uni = 0;
    for (i = 0; i < ta.length; i++) sa[ta[i]] = 1;
    for (i = 0; i < tb.length; i++) sb[tb[i]] = 1;
    for (var k in sa) if (sa.hasOwnProperty(k)) { uni++; if (sb[k]) inter++; }
    for (k in sb) if (sb.hasOwnProperty(k) && !sa[k]) uni++;
    if (ta.join('') === tb.join('')) return 1;                                                    // "Sky Sports" == "SkySports"
    return uni ? inter / uni : 0;
  }
  // The feeds worth showing for an event: not dead, with a verified embed address, one entry per real channel, best first.
  // `penalties` (id -> expiry ms) only moves a feed that just failed to the end for a few minutes; nothing is ever hidden for good.
  function feedsOf(ev, penalties, nowMs) {
    var seen = {}, byKey = {}, out = [], i, c, k;
    nowMs = nowMs || Date.now(); penalties = penalties || {};
    for (i = 0; i < ev.channels.length; i++) {
      c = ev.channels[i];
      if (c.dead || !c.embed) continue;
      if (seen[c.embed]) continue; seen[c.embed] = 1;
      k = normName(c.name) + '|' + c.country + '|' + c.lang;
      if (byKey[k] !== undefined) { if (c.watching > out[byKey[k]].watching) out[byKey[k]] = c; continue; }
      byKey[k] = out.length; out.push(c);
    }
    for (i = 0; i < out.length; i++) out[i] = withPenalty(out[i], penalties, nowMs);
    out.sort(function (a, b) {
      if (a.penalized !== b.penalized) return a.penalized ? 1 : -1;
      if (a.playing !== b.playing) return a.playing ? -1 : 1;
      if (a.watching !== b.watching) return b.watching - a.watching;
      var qa = Q_RANK[a.quality.toUpperCase()] || 0, qb = Q_RANK[b.quality.toUpperCase()] || 0;
      return qb - qa || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
    });
    return out;
  }
  function withPenalty(c, penalties, nowMs) { var o = {}; for (var k in c) if (c.hasOwnProperty(k)) o[k] = c[k]; o.penalized = (penalties[c.id] || 0) > nowMs; return o; }
  function channelTerms(ev, max) {                                                                // distinct channel names to look for in the viewer's add-ons
    var feeds = feedsOf(ev), seen = {}, out = [];
    for (var i = 0; i < feeds.length && out.length < (max || 6); i++) { var n = normName(feeds[i].name); if (n && !seen[n]) { seen[n] = 1; out.push(feeds[i].name); } }
    return out;
  }

  // ---------------------------------------------------------------- filters and grouping
  var SPORT_ORDER = ['Soccer'];
  function sportsOf(events) {
    var cnt = {}, out = [], i;
    for (i = 0; i < events.length; i++) cnt[events[i].sport] = (cnt[events[i].sport] || 0) + 1;
    for (var k in cnt) if (cnt.hasOwnProperty(k)) out.push({ name: k, n: cnt[k] });
    out.sort(function (a, b) { var pa = SPORT_ORDER.indexOf(a.name), pb = SPORT_ORDER.indexOf(b.name); if (pa !== pb) return (pa < 0 ? 99 : pa) - (pb < 0 ? 99 : pb); return b.n - a.n || (a.name < b.name ? -1 : 1); });
    return out;
  }
  // The saved choice is kept as it is; it simply does not apply on a day that has no such sport.
  function effectiveSport(saved, sports) { if (!saved || saved === 'all') return 'all'; for (var i = 0; i < sports.length; i++) if (sports[i].name === saved) return saved; return 'all'; }
  function applyFilters(events, f) {
    f = f || {}; var out = [];
    for (var i = 0; i < events.length; i++) {
      var e = events[i];
      if (f.sport && f.sport !== 'all' && e.sport !== f.sport) continue;
      if (f.live && !e.live) continue;
      if (f.withChannels && !feedsOf(e).length) continue;
      out.push(e);
    }
    return out;
  }
  function sortEvents(a, b) { if (a.live !== b.live) return a.live ? -1 : 1; return (a.kickoff || 9e12) - (b.kickoff || 9e12) || (a.id < b.id ? -1 : 1); }
  function groupByLeague(events) {
    var map = {}, groups = [], i, e, k;
    for (i = 0; i < events.length; i++) {
      e = events[i]; k = e.league || 'Other';
      if (!map[k]) { map[k] = { league: k, sport: e.sport, badge: e.badges.league, events: [], live: 0, first: 9e12 }; groups.push(map[k]); }
      map[k].events.push(e); if (e.live) map[k].live++; if (!map[k].badge) map[k].badge = e.badges.league;
      if ((e.kickoff || 9e12) < map[k].first) map[k].first = e.kickoff || 9e12;
    }
    for (i = 0; i < groups.length; i++) groups[i].events.sort(sortEvents);
    groups.sort(function (a, b) { if (!!a.live !== !!b.live) return a.live ? -1 : 1; return a.first - b.first || (a.league < b.league ? -1 : 1); });
    return groups;
  }
  function mergeLive(events, liveEvents) {                                                        // the live list is fresher than the schedule: it wins for the same match
    var byId = {}, i, out = [];
    for (i = 0; i < liveEvents.length; i++) byId[liveEvents[i].id] = liveEvents[i];
    for (i = 0; i < events.length; i++) { out.push(byId[events[i].id] || events[i]); delete byId[events[i].id]; }
    return out;
  }

  // ---------------------------------------------------------------- client: caching, retries, back-off
  function createClient(opts) {
    opts = opts || {};
    var fetchFn = opts.fetch || (typeof fetch === 'function' ? function (u, i) { return fetch(u, i); } : null);
    var nowFn = opts.now || function () { return Date.now(); }, base = opts.base || BASE, timeout = opts.timeout || TIMEOUT, retryMs = opts.retryDelay != null ? opts.retryDelay : RETRY_MS;
    var wait = opts.wait || function (ms) { return new Promise(function (res) { setTimeout(res, ms); }); };
    var cache = {}, inflight = {}, blockedUntil = 0, penalties = {}, stats = { requests: 0 };

    function raceTimeout(p) {
      return new Promise(function (resolve, reject) {
        var t = setTimeout(function () { reject(MatchoraError('timeout', MESSAGES.timeout)); }, timeout);
        p.then(function (v) { clearTimeout(t); resolve(v); }, function (e) { clearTimeout(t); reject(e); });
      });
    }
    function once(path) {
      stats.requests++;
      return raceTimeout(Promise.resolve().then(function () { return fetchFn(base + path, { headers: { Accept: 'application/json' } }); })).then(function (r) {
        return r.text().then(function (text) { return { status: r.status, ok: r.ok, text: text, retryAfter: r.headers && r.headers.get ? r.headers.get('Retry-After') : null }; }, function () { return { status: r.status, ok: r.ok, text: '', retryAfter: null }; });
      }, function (e) { if (e && e.kind) throw e; throw MatchoraError('offline', MESSAGES.offline); });
    }
    function load(path, validate) {
      function attempt(n) {
        return once(path).then(function (r) {
          if (r.status === 429) { var ra = parseFloat(r.retryAfter), ms = isFinite(ra) && ra > 0 ? ra * 1000 : BACKOFF_DEFAULT; blockedUntil = nowFn() + Math.min(ms, BACKOFF_MAX); throw MatchoraError('rate', MESSAGES.rate, { retryAt: blockedUntil }); }
          if (/unknown (fixture|event)/i.test(r.text) || r.status === 404) throw MatchoraError('unknown', MESSAGES.unknown);
          if (r.status === 502 || r.status === 503 || r.status === 504) {
            if (n < 1) return wait(retryMs).then(function () { return attempt(n + 1); });
            throw MatchoraError('upstream', MESSAGES.upstream, { status: r.status });
          }
          if (!r.ok) throw MatchoraError('http', MESSAGES.http, { status: r.status });
          var doc; try { doc = JSON.parse(r.text); } catch (e) { throw MatchoraError('malformed', MESSAGES.malformed); }
          return validate(doc);
        });
      }
      return attempt(0);
    }
    function get(key, path, ttl, force, validate) {
      var hit = cache[key], now = nowFn();
      if (hit && !force && now - hit.at < ttl) return Promise.resolve({ data: hit.data, at: hit.at, cached: true, stale: false });
      if (inflight[key]) return inflight[key];
      if (blockedUntil > now) {                                                                    // told to slow down: no request until then
        if (hit) return Promise.resolve({ data: hit.data, at: hit.at, cached: true, stale: true, error: MatchoraError('rate', MESSAGES.rate, { retryAt: blockedUntil }) });
        return Promise.reject(MatchoraError('rate', MESSAGES.rate, { retryAt: blockedUntil }));
      }
      var p = load(path, validate).then(function (data) {
        cache[key] = { data: data, at: nowFn() };
        var ks = Object.keys(cache); if (ks.length > 24) { ks.sort(function (a, b) { return cache[a].at - cache[b].at; }); delete cache[ks[0]]; }
        delete inflight[key];
        return { data: data, at: cache[key].at, cached: false, stale: false };
      }, function (e) {
        delete inflight[key];
        if (hit && e.kind !== 'unknown') return { data: hit.data, at: hit.at, cached: true, stale: true, error: e };      // an old list beats an empty screen
        throw e;
      });
      inflight[key] = p; return p;
    }
    var api = {
      live: function (o) { return get('live', '/api/v1/live', TTL.live, o && o.force, parseList); },
      day: function (day, o) {                                                                     // one local day: the UTC day(s) it touches, cut to the local day
        var force = o && o.force, ttl = day.today ? TTL.today : TTL.day;
        return Promise.all(day.utc.map(function (k) { return get('day:' + k, '/api/v1/schedule?date=' + k, ttl, force, parseList); })).then(function (rs) {
          var seen = {}, list = [], stale = false, at = Infinity, err = null, cached = true;
          rs.forEach(function (r) { stale = stale || r.stale; cached = cached && r.cached; at = Math.min(at, r.at); err = err || r.error || null; r.data.events.forEach(function (e) { if (!seen[e.id] && inDay(e, day)) { seen[e.id] = 1; list.push(e); } }); });
          return { data: { events: list, skipped: 0 }, at: at, cached: cached, stale: stale, error: err };
        });
      },
      event: function (id, o) {
        if (!/^[A-Za-z0-9_-]{1,24}$/.test(String(id))) return Promise.reject(MatchoraError('unknown', MESSAGES.unknown));
        return get('event:' + id, '/api/v1/events/' + encodeURIComponent(id), TTL.event, o && o.force, parseOne);
      },
      channels: function (o) {
        return get('channels', '/api/v1/channels', TTL.channels, o && o.force, function (doc) {
          if (!doc || !(doc.channels instanceof Array)) throw MatchoraError('malformed', MESSAGES.malformed);
          var out = [];
          doc.channels.forEach(function (c) {
            if (!c || typeof c !== 'object' || !str(c.name)) return;
            var feeds = []; (c.feeds instanceof Array ? c.feeds : []).forEach(function (f) { var u = f && safeEmbed(f.embed_url); if (u) feeds.push({ label: str(f.label) || str(c.name), country: str(f.country), quality: str(f.quality), embed: u }); });
            out.push({ name: str(c.name), countries: c.countries instanceof Array ? c.countries.map(str).filter(Boolean) : [], quality: str(c.quality), featured: c.featured === true, feeds: feeds });
          });
          return { channels: out };
        });
      },
      // A feed that failed to play is moved down the list for a few minutes. It is never removed: the next refresh, or the next visit, offers it again.
      penalize: function (id) { penalties[id] = nowFn() + PENALTY_MS; },
      penalties: function () { return penalties; },
      forget: function () { cache = {}; inflight = {}; },
      blockedUntil: function () { return blockedUntil; },
      stats: stats
    };
    return api;
  }

  var api = { BASE: BASE, TTL: TTL, MESSAGES: MESSAGES, MatchoraError: MatchoraError, safeEmbed: safeEmbed, safeBadge: safeBadge, embedHost: embedHost,
    normEvent: normEvent, normChannel: normChannel, parseList: parseList, parseOne: parseOne, parseScore: parseScore,
    weekDays: weekDays, inDay: inDay, fmtClock: fmtClock, statusInfo: statusInfo, localKey: localKey, utcKey: utcKey,
    feedsOf: feedsOf, channelTerms: channelTerms, normName: normName, nameScore: nameScore,
    sportsOf: sportsOf, effectiveSport: effectiveSport, applyFilters: applyFilters, groupByLeague: groupByLeague, mergeLive: mergeLive, sortEvents: sortEvents,
    createClient: createClient };
  if (typeof module === 'object' && module.exports) module.exports = api; else root.Matchora = api;
})(typeof window !== 'undefined' ? window : this);
