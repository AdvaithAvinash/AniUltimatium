// TV remote -> OmniRift keys (added by Aniultimatium; the game itself is unchanged).
// A TV remote has arrows, OK, numbers, colour buttons and Play/Pause but no letter keys, and some TVs send arrow / OK presses without a key name.
// This turns those buttons into the keys the game already uses for player 1 (arrows, Enter, , . / ; ' [ ] \), so a fight can be played with the remote.
//   Arrows: move   OK: jump   1 / Red: light   2 / Green: heavy   3 / Blue: block (hold)   4 / Yellow: special   5: dash   6: smash   7: counter   0: soul   Play/Pause: pause
// A gamepad, keyboard, mouse or touch screen work as before. Plain ES5 (older TVs).
(function () {
  'use strict';
  var BY_KEYCODE = {
    37: 'ArrowLeft', 38: 'ArrowUp', 39: 'ArrowRight', 40: 'ArrowDown', 13: 'Enter',     // only used when the TV sends them without a key name
    49: 'Comma', 50: 'Period', 51: 'Slash', 52: 'Semicolon', 53: 'Quote', 54: 'BracketLeft', 55: 'Backslash', 48: 'BracketRight',
    403: 'Comma', 404: 'Period', 405: 'Semicolon', 406: 'Slash',                          // Samsung colour buttons: red, green, yellow, blue
    10252: 'Escape', 415: 'Escape', 19: 'Escape'                                          // Play/Pause, Play, Pause
  };
  var NAMED_ONLY = { 37: 1, 38: 1, 39: 1, 40: 1, 13: 1 };                                 // arrows / OK that already carry a key name are left alone
  function code(e) {
    var c = BY_KEYCODE[e.keyCode];
    if (!c || e.__aniu) return null;
    if (NAMED_ONLY[e.keyCode] && e.code) return null;
    if (e.code && /^(Key|Arrow|Enter|Space|Escape|Comma|Period|Slash|Semicolon|Quote|Bracket|Backslash|Numpad)/.test(e.code) && !/^Digit/.test(e.code)) return null;
    return c;
  }
  function send(type, c, repeat) {
    var ev;
    try { ev = new KeyboardEvent(type, { code: c, key: c, bubbles: true, cancelable: true, repeat: !!repeat }); }
    catch (x) { return; }
    ev.__aniu = true;
    window.dispatchEvent(ev);
  }
  window.addEventListener('keydown', function (e) { var c = code(e); if (!c) return; e.preventDefault(); send('keydown', c, e.repeat); }, true);
  window.addEventListener('keyup', function (e) { var c = code(e); if (!c) return; e.preventDefault(); send('keyup', c); }, true);
})();
