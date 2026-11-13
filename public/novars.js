/* Tizen 3.0 TVs (2017, Chromium 47) and other browsers older than Chromium 49 have no CSS variables, so every colour / size in styles.css that says var(--x) would be
   ignored and the app would look broken. This file runs in <head> before the style sheet: if variables work it just adds the normal <link>; if not it reads styles.css,
   writes the variables' values into it (the values of the first :root rule, plus the accent colour chosen in Settings) and adds that as a <style>.
   These engines always use the Classic look, which only needs the :root values. Plain ES5 (Chromium 47). Add ?novars=1 to the address to test it on any browser. */
(function () {
  'use strict';
  var d = document, ok = false;
  try { ok = !!(window.CSS && CSS.supports && CSS.supports('--a', '0')); } catch (e) { ok = false; }
  if (/[?&]novars=1/.test(location.search)) ok = false;
  function link() { d.write('<link rel="stylesheet" href="styles.css">'); }
  if (ok) { link(); return; }
  var src = '';
  try { var x = new XMLHttpRequest(); x.open('GET', 'styles.css', false); x.send(null); src = x.responseText || ''; } catch (e2) { src = ''; }
  if (!src) { link(); return; }
  var vars = {}, m = /:root\s*\{([^}]*)\}/.exec(src);
  if (m) m[1].split(';').forEach(function (p) { var i = p.indexOf(':'); if (i > 0) vars[p.slice(0, i).replace(/\s/g, '')] = p.slice(i + 1).trim(); });
  try { var a = JSON.parse(localStorage.getItem('ea_accent')), ACC = { pink: '255,61,127', cyan: '0,200,230', violet: '150,110,255', green: '61,220,151', orange: '255,150,50', red: '235,64,64', blue: '64,132,255', gold: '240,190,50', teal: '20,184,166', white: '230,230,238' };
    if (ACC[a]) { vars['--accent-rgb'] = ACC[a]; vars['--accent'] = 'rgb(' + ACC[a] + ')'; } } catch (e3) { /* default colour */ }
  var base = src.replace(/(^|[;{\s])--[\w-]+\s*:[^;}]*;?/g, '$1');                                    // the declarations of variables themselves are not needed any more
  function build() {
    var out = base, n = 0, re = /var\(\s*(--[\w-]+)\s*(?:,\s*([^()]*))?\)/g;
    while (n++ < 6 && /var\(/.test(out)) out = out.replace(re, function (all, name, fb) { return vars[name] != null ? vars[name] : (fb != null ? fb.trim() : 'inherit'); });
    return out;
  }
  var st = d.createElement('style'); st.id = 'legacyCss'; (d.head || d.documentElement).appendChild(st);
  function apply() { var css = build(); if (st.styleSheet) st.styleSheet.cssText = css; else st.textContent = css; }
  apply();
  window.EA_NOVARS = true;
  window.EA_setVars = function (o) { for (var k in o) if (o.hasOwnProperty(k)) vars[k] = o[k]; apply(); };          // main.js: the accent colour changed
})();
