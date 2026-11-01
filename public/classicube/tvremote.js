// TV remote -> ClassiCube controls (added by Aniultimatium; ClassiCube itself is unchanged apart from the texture pack address).
// A remote has arrows, OK, numbers, colour buttons and channel buttons but no WASD keys or mouse, so this turns them into the keys / mouse input ClassiCube uses:
//   Arrows: walk (W A S D)   OK: jump   Red: break block (left click)   Green: place block (right click)   Yellow / Blue: turn left / right
//   CH+ / CH-: look up / down   1-9: pick a block   Play/Pause: menu (Escape)
// Game pads are read by ClassiCube itself. Keyboard and mouse work as before. Plain ES5 (older TVs).
(function () {
  'use strict';
  var TV = /Tizen|SMART-?TV|Web0S|NetCast|AniUltimatiumTV|AFT[A-Z]/i.test(navigator.userAgent) || /[?&]tv=1/.test(location.search);
  var KEYS = { 37: ['KeyA', 'a', 65], 38: ['KeyW', 'w', 87], 39: ['KeyD', 'd', 68], 40: ['KeyS', 's', 83], 13: ['Space', ' ', 32],
               10252: ['Escape', 'Escape', 27], 415: ['Escape', 'Escape', 27], 19: ['Escape', 'Escape', 27] };
  for (var d = 1; d <= 9; d++) KEYS[48 + d] = ['Digit' + d, String(d), 48 + d];
  var TURN = { 405: [-1, 0], 406: [1, 0], 427: [0, -1], 428: [0, 1] };          // yellow, blue, CH+, CH-
  var CLICK = { 403: 0, 404: 2 };                                                 // red = left button, green = right button
  var turning = {}, timer = null;
  function canvas() { return document.getElementById('canvas'); }
  function key(type, k) {
    var ev;
    try { ev = new KeyboardEvent(type, { code: k[0], key: k[1], keyCode: k[2], which: k[2], bubbles: true, cancelable: true }); } catch (x) { return; }
    try { Object.defineProperty(ev, 'keyCode', { get: function () { return k[2]; } }); Object.defineProperty(ev, 'which', { get: function () { return k[2]; } }); } catch (x) { /* ignore */ }
    ev.__aniu = true; (canvas() || document).dispatchEvent(ev);
  }
  function mouse(type, button) {
    var c = canvas(); if (!c) return; var r = c.getBoundingClientRect();
    c.dispatchEvent(new MouseEvent(type, { bubbles: true, cancelable: true, button: button, buttons: type === 'mousedown' ? (button === 2 ? 2 : 1) : 0, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 }));
  }
  function look(dx, dy) {
    var c = canvas(); if (!c) return; var r = c.getBoundingClientRect();
    var ev = new MouseEvent('mousemove', { bubbles: true, cancelable: true, clientX: r.left + r.width / 2, clientY: r.top + r.height / 2 });
    try { Object.defineProperty(ev, 'movementX', { get: function () { return dx; } }); Object.defineProperty(ev, 'movementY', { get: function () { return dy; } }); } catch (x) { /* ignore */ }
    c.dispatchEvent(ev);
  }
  function tick() {
    var dx = 0, dy = 0, k;
    for (k in turning) if (turning[k]) { dx += TURN[k][0] * 14; dy += TURN[k][1] * 10; }
    if (dx || dy) look(dx, dy); else { clearInterval(timer); timer = null; }
  }
  function mine(e) {                                                              // a press that already carries a real key name (keyboard) is left alone
    return !e.__aniu && (e.keyCode in KEYS || e.keyCode in TURN || e.keyCode in CLICK) && !(e.code && /^(Key|Space|Escape|Digit)/.test(e.code) && !(e.keyCode in TURN) && !(e.keyCode in CLICK));
  }
  window.addEventListener('keydown', function (e) {
    if (!mine(e)) return; e.preventDefault(); e.stopImmediatePropagation();
    var k = e.keyCode;
    if (k in KEYS) { if (!e.repeat) key('keydown', KEYS[k]); return; }
    if (k in CLICK) { if (!e.repeat) mouse('mousedown', CLICK[k]); return; }
    if (k in TURN) { turning[k] = true; if (!timer) { tick(); timer = setInterval(tick, 33); } }
  }, true);
  window.addEventListener('keyup', function (e) {
    if (!mine(e)) return; e.preventDefault(); e.stopImmediatePropagation();
    var k = e.keyCode;
    if (k in KEYS) key('keyup', KEYS[k]);
    else if (k in CLICK) mouse('mouseup', CLICK[k]);
    else if (k in TURN) turning[k] = false;
  }, true);
  if (TV) { var h = document.getElementById('tvhint'); if (h) { h.style.display = 'block'; setTimeout(function () { h.style.display = 'none'; }, 12000); } }
})();
