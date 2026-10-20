// Start-up: opening animation, profiles, optional 4-digit lock, "connect your list", look (Classic / Modern), crash-loop safe mode.
// Runs BEFORE the app: the app scripts are loaded from here once the profile is known, so every per-profile key (history, list, progress, AniList link)
// is read from the right profile from the very first line. Plain ES5 (Tizen 4 / Chromium 56).
(function () {
  'use strict';
  var LS = window.localStorage, UA = navigator.userAgent, CV = +((UA.match(/Chrome\/(\d+)/) || [0, 0])[1]);
  var APP = ['avp.js', 'iq.js', 'qr.js', 'iptv.js', 'main.js', 'feed.js', 'sponsor.js', 'live.js'];
  function get(k, d) { try { var v = LS.getItem(k); return v ? JSON.parse(v) : d; } catch (e) { return d; } }
  function set(k, v) { try { LS.setItem(k, JSON.stringify(v)); } catch (e) { /* storage full or blocked */ } }
  function del(k) { try { LS.removeItem(k); } catch (e) { /* ignore */ } }
  function el(tag, cls, html) { var e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  var LOWEND = CV > 0 && CV < 69;
  function scale() { var w = window.innerWidth, h = window.innerHeight; document.documentElement.style.fontSize = Math.max(12, Math.min(w / 96, h / 54)) + 'px'; }      // same sizing rule as main.js (it has not loaded yet)
  scale(); window.addEventListener('resize', scale);
  var NOINTRO = /[?&]nointro=1/.test(location.search);                       // the Android shell asks for this after the web view crashed                       // Tizen 4 (Chromium 56) and Tizen 5 (Chromium 63): no animation, straight to the profile step

  // ------------------------------------------------------------------ crash-loop safe mode
  // main.js clears ea_boot when it has started properly. Three starts in a row that never got that far -> Classic look, Lite mode, no animation.
  var boots = (get('ea_boot', 0) | 0) + 1; set('ea_boot', boots);
  window.EA_SAFE = false;
  if (boots >= 4) { window.EA_SAFE = true; set('ea_ui', 'classic'); set('ea_lite', true); set('ea_intro', false); set('ea_boot', 1); }

  // ------------------------------------------------------------------ profiles
  var PERP = /^(ea_list|ea_hist|ea_progress|ea_anilist|ea_al_auto|ea_auth|ea_del|ea_lastsub|ea_ad_day)$/;    // the keys that belong to one profile (the first profile keeps the old, unsuffixed names)
  function profiles() { var l = get('ea_profiles', []); return Array.isArray(l) ? l : []; }
  function byId(id) { var l = profiles(); for (var i = 0; i < l.length; i++) if (l[i].id === id) return l[i]; return null; }
  function hash(pin, id) { var h = 2166136261, s = 'aniu|' + id + '|' + pin; for (var i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619) >>> 0; } return h.toString(16); }   // a casual lock for the family, not security
  function nextId() { var n = 1, l = profiles(); while (byId('p' + n)) n++; return 'p' + n; }
  function activate(id) { var p = byId(id); window.EA_PROFILE = p ? { id: p.id, name: p.name, av: p.av, img: p.img, lock: !!p.pin } : { id: 'p1', name: 'Me', av: 'ninja', lock: false }; set('ea_profile', window.EA_PROFILE.id); }

  // ------------------------------------------------------------------ original avatars (archetypes, not existing characters)
  var AV = [
    { id: 'ninja', n: 'Ninja', k: 'Anime', bg: '#1d2b53', skin: '#f1c9a5', hair: '#14141c', out: '#2a2f4a', hairS: 'spiky', acc: 'ninja' },
    { id: 'samurai', n: 'Samurai', k: 'Anime', bg: '#5b1a1a', skin: '#efc29b', hair: '#1a1a1a', out: '#8e2b2b', hairS: 'knot', acc: 'band' },
    { id: 'mage', n: 'Mage', k: 'Anime', bg: '#2d2150', skin: '#f6d9c0', hair: '#d9dcff', out: '#5a49a8', hairS: 'long', acc: 'circlet' },
    { id: 'pirate', n: 'Pirate', k: 'Anime', bg: '#0f4c5c', skin: '#e0a97e', hair: '#7a2a14', out: '#a3392b', hairS: 'wild', acc: 'pirate' },
    { id: 'cat', n: 'Cat', k: 'Anime', bg: '#7a3b5c', skin: '#fbd8c4', hair: '#ffb3c8', out: '#ffffff', hairS: 'bob', acc: 'cat' },
    { id: 'fox', n: 'Fox spirit', k: 'Anime', bg: '#7a4a12', skin: '#fbe0c6', hair: '#f2872e', out: '#e9e3d6', hairS: 'long', acc: 'fox' },
    { id: 'detective', n: 'Detective', k: 'Movie', bg: '#3a3a3a', skin: '#e8b995', hair: '#4a3626', out: '#8a7355', hairS: 'short', acc: 'fedora' },
    { id: 'ranger', n: 'Space ranger', k: 'Movie', bg: '#0b1530', skin: '#f0c9a6', hair: '#2b2b2b', out: '#d9d9e6', hairS: 'none', acc: 'helmet' },
    { id: 'wizard', n: 'Wizard', k: 'Movie', bg: '#23324f', skin: '#efd0b3', hair: '#e8e8ee', out: '#3b4a86', hairS: 'long', acc: 'wizard' },
    { id: 'vampire', n: 'Vampire', k: 'Movie', bg: '#2a0c14', skin: '#f2e6e6', hair: '#151515', out: '#6b0f24', hairS: 'slick', acc: 'vamp' },
    { id: 'robot', n: 'Robot', k: 'Movie', bg: '#244a3d', skin: '#b9c4cc', hair: '#b9c4cc', out: '#7d8a93', hairS: 'none', acc: 'robot' },
    { id: 'hero', n: 'Hero', k: 'Movie', bg: '#1c3d7a', skin: '#e9bd98', hair: '#2a1d12', out: '#c8202f', hairS: 'short', acc: 'mask' }
  ];
  function avOf(id) { for (var i = 0; i < AV.length; i++) if (AV[i].id === id) return AV[i]; return AV[0]; }
  function avatarOf(p) {
    if (p && p.img) return '<img class="avimg" src="' + esc(p.img) + '" alt="" onerror="this.style.visibility=\'hidden\'">';
    return avatar(p && p.av);
  }
  // Popular anime characters from AniList (their pictures are loaded from AniList's own image server, nothing is bundled). Cached for a week; the drawn avatars are the offline fallback.
  function loadChars(cb) {
    var c = get('ea_chars', null);
    if (c && c.l && c.l.length && c.at > Date.now() - 7 * 86400000) { cb(c.l); return; }
    if (!window.fetch) { cb(c && c.l || []); return; }
    var done = false, t = setTimeout(function () { if (!done) { done = true; cb(c && c.l || []); } }, 7000);
    fetch('https://graphql.anilist.co', { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify({ query: 'query{Page(page:1,perPage:36){characters(sort:FAVOURITES_DESC){id name{first full} image{medium}}}}' }) })
      .then(function (r) { return r.json(); }).then(function (j) {
        var l = (((j.data || {}).Page || {}).characters || []).filter(function (x) { return x.image && x.image.medium; }).map(function (x) { return { id: 'c' + x.id, n: x.name.first || x.name.full, full: x.name.full, k: 'Anime', img: x.image.medium }; });
        if (l.length) set('ea_chars', { at: Date.now(), l: l });
        if (!done) { done = true; clearTimeout(t); cb(l.length ? l : (c && c.l || [])); }
      }).catch(function () { if (!done) { done = true; clearTimeout(t); cb(c && c.l || []); } });
  }
  function avatar(id) {
    var a = avOf(id), s = '<svg viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg"><defs><clipPath id="c' + a.id + '"><circle cx="50" cy="50" r="50"/></clipPath></defs><g clip-path="url(#c' + a.id + ')">';
    s += '<rect width="100" height="100" fill="' + a.bg + '"/><circle cx="50" cy="118" r="52" fill="rgba(255,255,255,.06)"/>';
    if (a.acc === 'wizard' || a.hairS === 'long') s += '<path d="M24 52 Q22 92 30 100 H70 Q78 92 76 52Z" fill="' + a.hair + '"/>';          // hair behind the shoulders
    s += '<path d="M14 100 Q16 70 50 68 Q84 70 86 100Z" fill="' + a.out + '"/>';                                                                                                // shoulders
    if (a.acc === 'vamp') s += '<path d="M30 100 L38 66 L50 80 L62 66 L70 100Z" fill="#111"/><path d="M38 66 L50 86 L62 66" fill="none" stroke="#8c1c33" stroke-width="2"/>';
    if (a.acc === 'hero') s += '<path d="M44 100 L50 78 L56 100Z" fill="#f5c518"/>';
    if (a.acc === 'detective') s += '<path d="M36 70 L50 90 L64 70 L58 68 L50 78 L42 68Z" fill="#c9b48a"/>';
    s += '<rect x="43" y="58" width="14" height="14" rx="4" fill="' + a.skin + '"/>';                                                                                             // neck
    if (a.acc === 'robot') s += '<rect x="26" y="22" width="48" height="42" rx="9" fill="' + a.skin + '"/><rect x="48" y="12" width="4" height="10" fill="#8a97a0"/><circle cx="50" cy="11" r="4" fill="#ff5a4d"/>';
    else s += '<ellipse cx="50" cy="44" rx="22" ry="24" fill="' + a.skin + '"/>';                                                                                                  // head
    // hair (front)
    var h = a.hair;
    if (a.hairS === 'spiky') s += '<path d="M27 40 Q24 14 40 20 L44 8 L52 19 L62 7 L64 20 Q78 16 73 40 Q66 28 50 29 Q34 28 27 40Z" fill="' + h + '"/>';
    if (a.hairS === 'knot') s += '<circle cx="50" cy="13" r="8" fill="' + h + '"/><path d="M28 40 Q28 18 50 18 Q72 18 72 40 Q64 30 50 30 Q36 30 28 40Z" fill="' + h + '"/>';
    if (a.hairS === 'long') s += '<path d="M27 46 Q22 14 50 14 Q78 14 73 46 Q70 30 58 28 Q50 34 42 28 Q30 30 27 46Z" fill="' + h + '"/>';
    if (a.hairS === 'wild') s += '<path d="M26 42 Q18 22 34 18 Q38 8 50 14 Q62 6 68 18 Q84 22 74 42 Q66 30 50 30 Q34 30 26 42Z" fill="' + h + '"/>';
    if (a.hairS === 'bob') s += '<path d="M25 56 Q18 14 50 14 Q82 14 75 56 Q72 36 62 30 Q50 38 38 30 Q28 36 25 56Z" fill="' + h + '"/>';
    if (a.hairS === 'short') s += '<path d="M28 38 Q28 16 50 16 Q72 16 72 38 Q64 28 50 28 Q36 28 28 38Z" fill="' + h + '"/>';
    if (a.hairS === 'slick') s += '<path d="M28 38 Q30 14 52 16 Q70 18 72 38 Q64 26 48 26 Q34 28 28 38Z" fill="' + h + '"/>';
    // face
    if (a.acc !== 'robot') {
      s += '<ellipse cx="40" cy="47" rx="3.4" ry="5" fill="#1b1b24"/><ellipse cx="60" cy="47" rx="3.4" ry="5" fill="#1b1b24"/><circle cx="41.2" cy="45" r="1.3" fill="#fff"/><circle cx="61.2" cy="45" r="1.3" fill="#fff"/>';
      s += '<path d="M44 59 Q50 63 56 59" fill="none" stroke="#7a3d3d" stroke-width="1.8" stroke-linecap="round"/><ellipse cx="34" cy="55" rx="4" ry="2.4" fill="rgba(255,120,120,.28)"/><ellipse cx="66" cy="55" rx="4" ry="2.4" fill="rgba(255,120,120,.28)"/>';
    } else s += '<rect x="34" y="38" width="12" height="9" rx="3" fill="#33e0ff"/><rect x="54" y="38" width="12" height="9" rx="3" fill="#33e0ff"/><rect x="40" y="54" width="20" height="5" rx="2" fill="#4a565e"/><path d="M44 54 V59 M50 54 V59 M56 54 V59" stroke="#b9c4cc" stroke-width="1"/>';
    // accessories
    if (a.acc === 'ninja') s += '<path d="M28 52 Q50 62 72 52 L72 66 Q50 74 28 66Z" fill="#222a44"/><rect x="27" y="28" width="46" height="8" rx="2" fill="#2e4aa8"/><rect x="44" y="28.5" width="12" height="7" rx="1.5" fill="#cfd6e6"/>';
    if (a.acc === 'band') s += '<rect x="27" y="30" width="46" height="6" rx="2" fill="#f2f2f2"/><circle cx="50" cy="33" r="3" fill="#c22"/>';
    if (a.acc === 'circlet') s += '<path d="M31 32 Q50 24 69 32" fill="none" stroke="#ffd86b" stroke-width="2.4"/><circle cx="50" cy="27.5" r="3.4" fill="#6ee7ff"/>';
    if (a.acc === 'pirate') s += '<path d="M26 36 Q50 20 74 36 L74 31 Q50 12 26 31Z" fill="#b02a2a"/><circle cx="76" cy="52" r="2.6" fill="#ffd86b"/><rect x="34" y="42" width="12" height="11" rx="5" fill="#15151b"/><path d="M28 36 L46 44" stroke="#15151b" stroke-width="1.6"/>';
    if (a.acc === 'cat') s += '<path d="M28 28 L31 6 L44 20Z" fill="' + h + '"/><path d="M72 28 L69 6 L56 20Z" fill="' + h + '"/><path d="M31 12 L34 22 L40 19Z" fill="#ff8fab"/><path d="M69 12 L66 22 L60 19Z" fill="#ff8fab"/>';
    if (a.acc === 'fox') s += '<path d="M27 30 L24 4 L44 18Z" fill="' + h + '"/><path d="M73 30 L76 4 L56 18Z" fill="' + h + '"/><path d="M28 12 L31 20 L38 18Z" fill="#3a1c0a"/><path d="M72 12 L69 20 L62 18Z" fill="#3a1c0a"/><path d="M30 56 L38 58 M70 56 L62 58" stroke="#d6442b" stroke-width="2" stroke-linecap="round"/>';
    if (a.acc === 'fedora') s += '<ellipse cx="50" cy="28" rx="30" ry="6" fill="#4a3a28"/><path d="M33 28 Q34 8 50 8 Q66 8 67 28Z" fill="#5b4833"/><rect x="33" y="22" width="34" height="5" fill="#2b2118"/>';
    if (a.acc === 'helmet') s += '<path d="M24 46 Q22 12 50 11 Q78 12 76 46 Q76 62 62 64 H38 Q24 62 24 46Z" fill="#e4e6f2"/><path d="M32 40 Q32 30 50 30 Q68 30 68 40 L66 54 Q50 60 34 54Z" fill="#1d2a52"/><path d="M38 36 Q46 32 52 34" stroke="rgba(255,255,255,.5)" stroke-width="2" fill="none"/>';
    if (a.acc === 'wizard') s += '<path d="M20 32 Q50 24 80 32 L74 28 Q62 4 52 -4 Q42 4 26 28Z" fill="#3b4a86"/><ellipse cx="50" cy="31" rx="31" ry="5.5" fill="#33407a"/><path d="M36 58 Q50 92 64 58 Q50 70 36 58Z" fill="#e8e8ee"/>';
    if (a.acc === 'vamp') s += '<path d="M46 60 L47.4 65 L49 60Z M51 60 L52.6 65 L54 60Z" fill="#fff"/>';
    if (a.acc === 'mask') s += '<path d="M28 40 Q50 32 72 40 L70 50 Q60 46 50 50 Q40 46 30 50Z" fill="#c8202f"/><ellipse cx="40" cy="45" rx="4.2" ry="3.2" fill="#fff"/><ellipse cx="60" cy="45" rx="4.2" ry="3.2" fill="#fff"/>';
    return s + '</g></svg>';
  }

  // ------------------------------------------------------------------ overlay + keys
  var root = null, active = null, cur = null, onDone = null;
  function ensureRoot() { if (!root) { root = el('div'); root.id = 'start'; document.body.appendChild(root); } root.className = ''; root.style.display = ''; return root; }
  function closeRoot() { active = null; if (root) { root.className = 'out'; var r = root; setTimeout(function () { if (r.parentNode && root === r && !active) { r.parentNode.removeChild(r); root = null; } }, 280); } }
  function keyOf(e) { var k = e.keyCode; return k === 38 ? 'up' : k === 40 ? 'down' : k === 37 ? 'left' : k === 39 ? 'right' : k === 13 || k === 29443 ? 'ok' : (k === 10009 || k === 27 || k === 8 || k === 461 || k === 166 || k === 10182) ? 'back' : (k >= 48 && k <= 57) ? 'd' + (k - 48) : (k >= 96 && k <= 105) ? 'd' + (k - 96) : ''; }
  document.addEventListener('keydown', function (e) {
    if (!active) return;
    var typing = document.activeElement && document.activeElement.tagName === 'INPUT';
    var k = keyOf(e);
    if (typing) { if (k === 'ok') { e.preventDefault(); e.stopPropagation(); document.activeElement.blur(); } else if (k === 'back' && e.keyCode !== 8) { e.preventDefault(); e.stopPropagation(); document.activeElement.blur(); } else if (k === 'up' || k === 'down') { document.activeElement.blur(); e.preventDefault(); e.stopPropagation(); move(k); } else e.stopPropagation(); return; }
    e.stopPropagation(); if (!k) return;
    e.preventDefault();
    if (active.onKey && active.onKey(k)) return;
    if (k === 'ok') press(); else if (k === 'back') { if (active.back) active.back(); } else move(k);
  }, true);
  document.addEventListener('tizenhwkey', function (e) { if (active && e.keyName === 'back') { e.preventDefault(); if (active.back) active.back(); } }, true);
  document.addEventListener('click', function (e) { if (!active) return; var t = e.target; while (t && t !== root) { if (t.__go) { focusAt(t); press(); return; } t = t.parentNode; } }, true);

  // A screen = { rows: [[el,...],...], back: fn, onKey: fn }. Focus is (r,c).
  function focusAt(t) { for (var r = 0; r < active.rows.length; r++) for (var c = 0; c < active.rows[r].length; c++) if (active.rows[r][c] === t) { setFocus(r, c); return; } }
  function setFocus(r, c) {
    var rows = active.rows; if (!rows.length) return; r = Math.max(0, Math.min(rows.length - 1, r)); c = Math.max(0, Math.min(rows[r].length - 1, c));
    if (active.cur) active.cur.className = active.cur.className.replace(/\s*\bsf\b/g, '');
    active.r = r; active.c = c; active.cur = rows[r][c]; active.cur.className += ' sf';
    var cu = active.cur; try { if (cu.scrollIntoViewIfNeeded) cu.scrollIntoViewIfNeeded(false); else cu.scrollIntoView(false); } catch (e) { /* ignore */ }
    if (active.cur.tagName === 'INPUT' && !/Tizen|Android/.test(UA)) active.cur.focus();
  }
  function move(k) {
    if (!active || !active.rows.length) return; var r = active.r, c = active.c, rows = active.rows;
    if (k === 'left') c = c > 0 ? c - 1 : c; else if (k === 'right') c = c < rows[r].length - 1 ? c + 1 : c;
    else if (k === 'up' && r > 0) { r--; c = Math.min(c, rows[r].length - 1); } else if (k === 'down' && r < rows.length - 1) { r++; c = Math.min(c, rows[r].length - 1); }
    setFocus(r, c);
  }
  function press() { var t = active && active.cur; if (!t) return; if (t.tagName === 'INPUT') { t.focus(); return; } if (t.__go) t.__go(); }
  function screen(rows, opts) {
    active = { rows: rows, back: opts && opts.back, onKey: opts && opts.onKey, r: 0, c: 0, cur: null };
    var start = opts && opts.start || [0, 0]; setFocus(start[0], start[1]);
  }
  function btn(label, fn, cls) { var b = el('button', 'sbtn' + (cls ? ' ' + cls : ''), label); b.__go = fn; return b; }
  function panel(cls) { var r = ensureRoot(); r.innerHTML = ''; var p = el('div', 'sp ' + (cls || '')); r.appendChild(p); return p; }

  // ------------------------------------------------------------------ intro animation
  function letters(w) { var o = ''; for (var i = 0; i < w.length; i++) o += '<u style="animation-delay:' + (1.95 + i * 0.06).toFixed(2) + 's">' + w.charAt(i) + '</u>'; return o; }
  function intro(done, light) {
    var r = ensureRoot(), fin = false;
    r.innerHTML = '<div class="in-bloom"></div><div class="in-wrap' + (light ? ' light' : '') + '"><div class="in-logo"><svg class="in-ring" viewBox="0 0 120 120"><circle cx="60" cy="60" r="56"/></svg><img src="logo.svg" alt=""></div>' +
      '<div class="in-word"><span class="w1">' + letters('ANI') + '</span><span class="w2">' + letters('ULTIMATIUM') + '</span></div><div class="in-tag">Anime · Movies · Live TV</div></div>';
    set('ea_ifail', (get('ea_ifail', 0) | 0) + 1);                                      // cleared when the animation ends: if the page dies during it, the next start uses a lighter one (then none)
    function end() { if (fin) return; fin = true; clearTimeout(t); set('ea_ifail', 0); active = null; r.className = 'out'; setTimeout(function () { r.innerHTML = ''; done(); }, 260); }
    var t = setTimeout(end, 3300);
    active = { rows: [], onKey: function () { end(); return true; }, back: end };
    r.onclick = end;
  }

  // ------------------------------------------------------------------ screens
  function stepDots(n, of) { var s = '<div class="sdots">'; for (var i = 1; i <= of; i++) s += '<i' + (i === n ? ' class="on"' : '') + '></i>'; return s + '</div>'; }

  function chooseAvatar(ctx) {                                                    // "Choose your profile"
    var p = panel('wide'); p.innerHTML = (ctx.steps ? stepDots(1, ctx.steps) : '') + '<h1>Choose your profile</h1><p class="ssub">Pick a character. Everyone who watches gets their own list, history and AniList.</p><div class="agrid"></div>';
    var g = p.querySelector('.agrid'), chars = ctx.chars || [], gone = false;
    function perRow() { var rem = parseFloat(document.documentElement.style.fontSize) || 16; return Math.max(2, Math.min(7, Math.floor(Math.min(86, window.innerWidth / rem * 0.94) / 12.8))); }
    function render() {
      if (gone) return; var all = chars.concat(AV), n = perRow(), rows = [], row = null, keep = ctx.picked, start = [0, 0]; g.innerHTML = '';
      all.forEach(function (a, i) {
        var t = el('button', 'atile', '<span class="av">' + avatarOf(a.img ? { img: a.img } : { av: a.id }) + '</span><b>' + esc(a.n) + '</b><i>' + a.k + '</i>');
        t.__go = function () { ctx.av = a.id; ctx.picked = a.id; ctx.img = a.img || null; ctx.defName = a.n; nameStep(ctx); };
        g.appendChild(t); if (i % n === 0) { row = []; rows.push(row); } row.push(t); if (a.id === keep) start = [rows.length - 1, row.length - 1];
      });
      screen(rows, { start: start, back: function () { ctx.stopGrid(); if (ctx.cancel) ctx.cancel(); } });
    }
    ctx.stopGrid = function () { gone = true; window.removeEventListener('resize', render); };
    render(); window.addEventListener('resize', render);
    if (!chars.length) loadChars(function (l) { if (!l.length || gone || !g.parentNode) return; chars = l; ctx.chars = l; render(); });
  }
  function nameStep(ctx) {
    if (ctx.stopGrid) ctx.stopGrid();
    var dn = ctx.defName || avOf(ctx.av).n;
    var p = panel(); p.innerHTML = (ctx.steps ? stepDots(1, ctx.steps) : '') + '<div class="bigav">' + avatarOf({ av: ctx.av, img: ctx.img }) + '</div><h1>What should we call you?</h1><input id="sname" maxlength="16" autocomplete="off" spellcheck="false" placeholder="' + esc(dn) + '">';
    var inp = p.querySelector('input'); inp.value = ctx.name || '';
    var row = el('div', 'srow'); var next = btn('Continue', function () { ctx.name = (inp.value.trim() || dn).slice(0, 16); ctx.afterName(ctx); }, 'pri'), back = btn('Change character', function () { chooseAvatar(ctx); });
    row.appendChild(next); row.appendChild(back); p.appendChild(row);
    screen([[inp], [next, back]], { start: [0, 0], back: function () { chooseAvatar(ctx); } });
  }

  // 4-digit pad. mode 'set' (enter twice) or 'ask' (verify against hash); calls ok(pin) / skip()
  function pinPad(o) {
    var p = panel(), pin = '', first = null;
    p.innerHTML = (o.steps ? stepDots(o.stepNo, o.steps) : '') + '<h1>' + esc(o.title) + '</h1><p class="ssub">' + esc(o.sub || '') + '</p><div class="pdots"><i></i><i></i><i></i><i></i></div><div class="pmsg"></div><div class="ppad"></div>';
    var pad = p.querySelector('.ppad'), dots = p.querySelectorAll('.pdots i'), msg = p.querySelector('.pmsg'), rows = [];
    function paint() { for (var i = 0; i < 4; i++) dots[i].className = i < pin.length ? 'on' : ''; }
    function bad(t) { msg.textContent = t; msg.className = 'pmsg bad'; var d = p.querySelector('.pdots'); d.className = 'pdots shake'; setTimeout(function () { d.className = 'pdots'; }, 400); pin = ''; paint(); }
    function digit(n) {
      if (pin.length >= 4) return; pin += n; paint(); msg.textContent = ''; msg.className = 'pmsg';
      if (pin.length < 4) return;
      setTimeout(function () {
        if (o.mode === 'set') { if (first === null) { first = pin; pin = ''; paint(); p.querySelector('h1').textContent = 'Enter it once more'; return; } if (first !== pin) { first = null; p.querySelector('h1').textContent = o.title; bad('Those did not match. Start again.'); return; } o.ok(pin); }
        else if (o.check(pin)) o.ok(pin); else bad('Wrong PIN');
      }, 120);
    }
    var keys = [['1', '2', '3'], ['4', '5', '6'], ['7', '8', '9'], ['⌫', '0', 'Clear']];
    keys.forEach(function (kr) { var line = el('div', 'prow'), cells = []; kr.forEach(function (k) { var b = btn(k, function () { if (k === '⌫') { pin = pin.slice(0, -1); paint(); } else if (k === 'Clear') { pin = ''; paint(); } else digit(k); }, 'pk'); line.appendChild(b); cells.push(b); }); pad.appendChild(line); rows.push(cells); });
    var ex = el('div', 'srow'), br = [];
    if (o.skip) { var sk = btn(o.skipLabel || 'Skip for now', o.skip); ex.appendChild(sk); br.push(sk); }
    if (o.cancel) { var ca = btn('Cancel', o.cancel); ex.appendChild(ca); br.push(ca); }
    if (br.length) { p.appendChild(ex); rows.push(br); }
    screen(rows, { start: [1, 1], back: o.cancel || o.skip, onKey: function (k) { if (/^d\d$/.test(k)) { digit(k.charAt(1)); return true; } if (k === 'back' && pin.length) { pin = pin.slice(0, -1); paint(); return true; } return false; } });
  }

  function lockStep(ctx) {                                                         // "Add a 4-digit lock"
    pinPad({ mode: 'set', title: 'Add a 4-digit lock', sub: 'Keeps this profile private. You can turn it off any time in Settings.', steps: ctx.steps, stepNo: 2, skipLabel: 'Skip for now',
      ok: function (pin) { ctx.pin = pin; ctx.afterLock(ctx); }, skip: function () { ctx.pin = null; ctx.afterLock(ctx); }, cancel: null, back: null });
    active.back = function () { nameStep(ctx); };
  }
  function listStep(ctx) {                                                         // "Connect to your list!"
    var p = panel(); p.innerHTML = (ctx.steps ? stepDots(3, ctx.steps) : '') + '<div class="alico"><svg viewBox="0 0 64 64"><rect x="8" y="10" width="48" height="44" rx="8" fill="#1f6feb" opacity=".25"/><path d="M20 24h24M20 32h24M20 40h14" stroke="#6aa6ff" stroke-width="4" stroke-linecap="round"/><circle cx="48" cy="44" r="9" fill="#3ddc97"/><path d="M43.5 44.2l3.2 3.2 5.8-6" stroke="#06241a" stroke-width="3" fill="none" stroke-linecap="round" stroke-linejoin="round"/></svg></div><h1>Connect to your list!</h1><p class="ssub">Link AniList to keep your watchlist and episode progress in step with your other apps. It is optional, and you can do it later under Account.</p>';
    var row = el('div', 'srow'), a = btn('Connect AniList', function () { ctx.al = true; ctx.afterList(ctx); }, 'pri'), b = btn('Maybe later', function () { ctx.al = false; ctx.afterList(ctx); });
    row.appendChild(a); row.appendChild(b); p.appendChild(row);
    screen([[a, b]], { back: function () { if (ctx.afterLockBack) ctx.afterLockBack(ctx); else lockStep(ctx); } });
  }
  function lookStep(ctx, done) {                                                   // "Choose your look"
    var p = panel('wide'); p.innerHTML = (ctx.steps ? stepDots(4, ctx.steps) : '') + '<h1>Choose your look</h1><p class="ssub">You can switch any time in Settings.</p><div class="looks"></div>';
    var box = p.querySelector('.looks'), cl, mo;
    function card(kind, title, cap, mock) { var b = el('button', 'look', '<div class="mock ' + kind + '">' + mock + '</div><b>' + title + '</b><i>' + cap + '</i>'); b.__go = function () { set('ea_ui', kind); done(); }; box.appendChild(b); return b; }
    cl = card('classic', 'Classic', 'For low-end devices', '<u class="m-top"></u><u class="m-hero"></u><u class="m-row"></u><u class="m-row"></u>');
    mo = card('modern', 'Modern', 'For a better looking UI', '<u class="m-rail"></u><u class="m-hero"></u><u class="m-row"></u><u class="m-row"></u>');
    screen([[cl, mo]], { start: [0, LOWEND || get('ea_lite', false) ? 0 : 1], back: function () { listStep(ctx); } });
  }

  // ------------------------------------------------------------------ profile creation flows
  function createFlow(opts, finished) {                                            // opts.first: first profile of this device (also picks the look); opts.cancel: back out (adding another profile)
    var first = !!opts.first, ctx = { av: opts.av || 'ninja', name: '', pin: null, al: false, steps: first ? 4 : 3, cancel: opts.cancel };
    function save() {
      var l = profiles(), id = first && !byId('p1') ? 'p1' : nextId(), p = { id: id, name: ctx.name, av: ctx.av };
      if (ctx.img) p.img = ctx.img;
      if (ctx.pin) p.pin = hash(ctx.pin, id);
      l.push(p); set('ea_profiles', l); set('ea_onboard', true);
      if (ctx.al) { try { sessionStorage.setItem('ea_al_go', '1'); } catch (e) { /* ignore */ } }
      finished(id);
    }
    ctx.afterName = function () { lockStep(ctx); };
    ctx.afterLock = function () { listStep(ctx); };
    ctx.afterList = function () { if (first) lookStep(ctx, save); else save(); };
    chooseAvatar(ctx);
  }

  // ------------------------------------------------------------------ picker + PIN check
  function askPin(p, ok, cancel) {
    pinPad({ mode: 'ask', title: 'Enter the PIN for ' + p.name, sub: '', check: function (pin) { return hash(pin, p.id) === p.pin; }, ok: ok, cancel: cancel });
  }
  function picker(chosen, opts) {
    opts = opts || {};
    var l = profiles(), edit = !!opts.edit && l.length > 1, pn = panel('wide');
    pn.innerHTML = edit ? '<h1>Manage profiles</h1><p class="ssub">Choose a profile to remove.</p><div class="agrid pick"></div>' : '<h1>Who\'s watching?</h1><div class="agrid pick"></div>';
    var g = pn.querySelector('.agrid'), row = [], cur = get('ea_profile', 'p1'), startC = 0;
    l.forEach(function (p, i) {
      var t = el('button', 'atile' + (edit ? ' rm' : ''), '<span class="av">' + avatarOf(p) + (p.pin ? '<s class="lk"></s>' : '') + (edit ? '<u class="rmx">&times;</u>' : '') + '</span><b>' + esc(p.name) + '</b>' + (edit ? '<i>Remove</i>' : '')); if (p.id === cur) startC = i;
      t.__go = edit ? function () { confirmRemove(p, function () { picker(chosen, opts); }, function () { if (opts.removed) opts.removed(p.id); if (opts.only && profiles().length < 2) { opts.cancel(); return; } picker(chosen, profiles().length > 1 ? opts : { cancel: opts.cancel }); }); }
        : function () { if (p.pin) askPin(p, function () { chosen(p.id); }, function () { picker(chosen, opts); }); else chosen(p.id); };
      g.appendChild(t); row.push(t);
    });
    if (!edit && l.length < 6) { var add = el('button', 'atile add', '<span class="av"><em>+</em></span><b>Add profile</b>'); add.__go = function () { createFlow({ first: false, cancel: function () { picker(chosen, opts); } }, function (id) { chosen(id); }); }; g.appendChild(add); row.push(add); }
    var rows = [row];
    if (l.length > 1) {                                                            // add / remove: "Manage profiles" switches the tiles to remove mode
      var bar = el('div', 'srow'), mg = btn(edit ? 'Done' : 'Manage profiles', edit && opts.only ? opts.cancel : function () { var o = {}; for (var k in opts) o[k] = opts[k]; o.edit = !edit; picker(chosen, o); });
      bar.appendChild(mg); pn.appendChild(bar); rows.push([mg]);
    }
    screen(rows, { start: [0, startC], back: edit && !opts.only ? function () { var o = {}; for (var k in opts) o[k] = opts[k]; o.edit = false; picker(chosen, o); } : opts.cancel });
  }
  // Remove one profile (asks its PIN if it has one). Its list, history, progress and AniList link on this device go with it; the last profile cannot be removed.
  function confirmRemove(p, back, removed) {
    var pn = panel();
    pn.innerHTML = '<div class="bigav">' + avatarOf(p) + '</div><h1>Remove ' + esc(p.name) + '?</h1><p class="ssub">Its list, history, progress and AniList link on this TV are deleted. This cannot be undone.</p>';
    var row = el('div', 'srow'), no = btn('Cancel', back), yes = btn('Remove profile', function () {
      var go = function () {
        var wasCurrent = (window.EA_PROFILE || {}).id === p.id;
        if (!window.EA_PROF.remove(p.id)) { back(); return; }
        if (wasCurrent) { try { sessionStorage.removeItem('ea_switch'); } catch (e) { /* ignore */ } location.reload(); return; }   // the open profile is gone: start over at "Who's watching?"
        removed();
      };
      if (p.pin) askPin(p, go, back); else go();
    }, 'pri');
    row.appendChild(no); row.appendChild(yes); pn.appendChild(row);
    screen([[no, yes]], { start: [0, 0], back: back });
  }


  // ------------------------------------------------------------------ app loading
  function loadApp() {
    var i = 0;
    (function next() {
      if (i >= APP.length) { closeRoot(); return; }
      var s = document.createElement('script'); s.src = APP[i++]; s.async = false;
      s.onload = next; s.onerror = function () { fatal('Could not load ' + s.src.replace(/^.*\//, '')); };
      document.body.appendChild(s);
    }());
  }
  function boot(id) {
    activate(id);
    var r = ensureRoot(); r.innerHTML = '<div class="in-load"><img src="logo.svg" alt=""></div>'; active = null;
    loadApp();
  }
  // Fatal start-up problem: a clear screen with a way out instead of a black page
  var dead = false;
  function fatal(msg) {
    if (dead) return; dead = true;
    var p = panel(); p.innerHTML = '<h1>The app could not start</h1><p class="ssub">' + esc(String(msg || 'Unknown problem').slice(0, 160)) + '</p>';
    var row = el('div', 'srow'), a = btn('Try again', function () { location.reload(); }, 'pri'), b = btn('Start in safe mode', function () { set('ea_ui', 'classic'); set('ea_lite', true); set('ea_intro', false); location.reload(); });
    row.appendChild(a); row.appendChild(b); p.appendChild(row); screen([[a, b]]);
  }
  window.addEventListener('error', function (e) { if (!window.EA) fatal(e && e.message); });
  window.EA_fatal = fatal;

  // ------------------------------------------------------------------ public API (Settings uses this)
  window.EA_PROF = {
    list: profiles, avatar: avatar, avatarOf: avatarOf, avatars: AV, lowEnd: LOWEND,
    current: function () { return byId((window.EA_PROFILE || {}).id) || profiles()[0] || null; },
    switchTo: function () { picker(function (id) { set('ea_profile', id); try { sessionStorage.setItem('ea_switch', '1'); } catch (e) { /* ignore */ } location.reload(); }, { cancel: function () { closeRoot(); } }); },
    manage: function (done) { picker(function (id) { set('ea_profile', id); try { sessionStorage.setItem('ea_switch', '1'); } catch (e) { /* ignore */ } location.reload(); }, { edit: true, only: true, cancel: function () { closeRoot(); if (done) done(); }, removed: function () { if (done) done(); } }); },
    add: function () { createFlow({ first: false, cancel: function () { closeRoot(); } }, function (id) { set('ea_profile', id); try { sessionStorage.setItem('ea_switch', '1'); } catch (e) { /* ignore */ } location.reload(); }); },
    setPin: function (done) {                                                      // set or change the lock of the current profile
      var p = this.current(); if (!p) return;
      function setNew() { pinPad({ mode: 'set', title: 'New 4-digit lock', sub: 'Asked when this profile is opened.', ok: function (pin) { var l = profiles(); l.forEach(function (x) { if (x.id === p.id) x.pin = hash(pin, p.id); }); set('ea_profiles', l); closeRoot(); if (done) done(); }, cancel: function () { closeRoot(); } }); }
      if (p.pin) askPin(p, setNew, function () { closeRoot(); }); else setNew();
    },
    clearPin: function (done) {                                                    // turn the lock off (needs the current PIN)
      var p = this.current(); if (!p || !p.pin) { if (done) done(); return; }
      askPin(p, function () { var l = profiles(); l.forEach(function (x) { if (x.id === p.id) delete x.pin; }); set('ea_profiles', l); closeRoot(); if (done) done(); }, function () { closeRoot(); });
    },
    remove: function (id) {
      var l = profiles().filter(function (x) { return x.id !== id; }); if (!l.length) return false; set('ea_profiles', l);
      Object.keys(LS).forEach(function (k) { if (id === 'p1' ? PERP.test(k) : k.slice(-(id.length + 1)) === '@' + id) del(k); });   // its list, history and progress go with it (the first profile keeps them under the plain names)
      if ((window.EA_PROFILE || {}).id === id) set('ea_profile', l[0].id);
      return true;
    },
    verify: function (done) { var p = this.current(); if (!p || !p.pin) { done(); return; } askPin(p, function () { closeRoot(); done(); }, function () { closeRoot(); }); },
    rename: function (name) { var l = profiles(), id = (window.EA_PROFILE || {}).id; l.forEach(function (x) { if (x.id === id) x.name = String(name).slice(0, 16); }); set('ea_profiles', l); },
    setAvatar: function (av) { var l = profiles(), id = (window.EA_PROFILE || {}).id; l.forEach(function (x) { if (x.id === id) x.av = av; }); set('ea_profiles', l); },
    perProfile: PERP
  };

  // ------------------------------------------------------------------ run
  function run() {
    var l = profiles(), done = !!get('ea_onboard', false) && l.length > 0, switching = false;
    try { switching = sessionStorage.getItem('ea_switch') === '1'; sessionStorage.removeItem('ea_switch'); } catch (e) { /* ignore */ }
    var ifail = get('ea_ifail', 0) | 0;
    var animate = get('ea_intro', true) !== false && !LOWEND && !get('ea_lite', false) && !window.EA_SAFE && !switching && !NOINTRO && ifail < 2;
    function afterIntro() {
      if (window.EA_SAFE) { boot(done ? get('ea_profile', l[0].id) : 'p1'); return; }
      if (!done) {
        // an upgrade keeps the old data: the first profile is p1 and uses the old, unsuffixed keys
        createFlow({ first: true }, function (id) { boot(id); }); return;
      }
      var cur = byId(get('ea_profile', '')) || l[0];
      if (switching) { boot(cur.id); return; }
      if (l.length > 1) { picker(function (id) { set('ea_profile', id); boot(id); }); return; }
      if (cur.pin) { askPin(cur, function () { boot(cur.id); }); return; }
      boot(cur.id);
    }
    if (animate) intro(afterIntro, ifail === 1); else afterIntro();
  }
  if (document.body) run(); else document.addEventListener('DOMContentLoaded', run);
}());
