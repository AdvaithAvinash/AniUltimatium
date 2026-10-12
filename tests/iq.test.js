'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const SourceIQ = require('../public/iq.js');

const MIN = 60 * 1000, HOUR = 60 * MIN, DAY = 24 * HOUR;
function make(start) {
  let t = start || 1700000000000, saved = null;
  const iq = SourceIQ.create({ get: () => saved, set: v => { saved = JSON.parse(JSON.stringify(v)); } }, () => t);
  return { iq, advance: ms => { t += ms; }, saved: () => saved, now: () => t, reload: () => SourceIQ.create({ get: () => saved, set: v => { saved = JSON.parse(JSON.stringify(v)); } }, () => t) };
}
const KEYS = SourceIQ.DEFAULT_ORDER;

test('no data: default order, every source is Untested (nothing is invented)', () => {
  const { iq } = make();
  assert.deepEqual(iq.order(KEYS), KEYS);
  KEYS.forEach(k => assert.equal(iq.status(k, KEYS).state, 'untested'));
});

test('observed playback outweighs the default preference', () => {
  const { iq, advance } = make();
  for (let i = 0; i < 6; i++) { iq.recordPlay('animex', false); advance(HOUR); }              // AnimeX keeps failing to play here...
  for (let i = 0; i < 4; i++) { iq.recordPlay('anikoto', true, 2500); advance(1000); }        // ...AniKoto keeps playing
  const o = iq.order(KEYS);
  assert.equal(o[0], 'anikoto'); assert.ok(o.indexOf('animex') > 0);
});

test('resolving a stream is not playing it: a source that resolves but never plays ranks below one that plays', () => {
  const { iq } = make();
  for (let i = 0; i < 5; i++) { iq.recordResolve('animex', 'ok', 900); iq.recordPlay('animex', i === 0, 0); }   // resolves every time, plays 1 in 5
  for (let i = 0; i < 5; i++) { iq.recordResolve('animeyubi', 'ok', 1800); iq.recordPlay('animeyubi', true, 3000); }
  const m1 = iq.metrics('animex'), m2 = iq.metrics('animeyubi');
  assert.ok(m1.R > 0.8 && m1.P < 0.4, 'resolve rate high, play rate low');
  assert.ok(iq.order(KEYS).indexOf('animeyubi') < iq.order(KEYS).indexOf('animex'));
});

test('content that a source does not have is not counted against it', () => {
  const { iq } = make();
  for (let i = 0; i < 10; i++) iq.recordResolve('animex', 'absent', 300);
  for (let i = 0; i < 10; i++) iq.recordResolve('animex', 'cancelled', 300);
  assert.equal(iq.metrics('animex').n, 0);
  assert.equal(iq.status('animex', KEYS).state, 'untested');
});

test('timeouts and failures count; the circuit breaker cools a failing source down and ranks it last', () => {
  const { iq } = make();
  iq.recordPlay('animex', false); iq.recordPlay('animex', false);                              // two playback failures in a row
  const st = iq.status('animex', KEYS);
  assert.equal(st.state, 'down'); assert.match(st.short, /Unavailable/);
  assert.equal(iq.order(KEYS)[KEYS.length - 1], 'animex');
  const m = make(); m.iq.recordResolve('anikoto', 'timeout', 9000); m.iq.recordResolve('anikoto', 'fail', 100); m.iq.recordResolve('anikoto', 'budget', 100);
  assert.equal(m.iq.status('anikoto', KEYS).state, 'down');
});

test('cool-down heals by itself, a relapse backs off longer, a success restores trust', () => {
  const m = make(), iq = m.iq;
  iq.recordPlay('animex', false); iq.recordPlay('animex', false);
  assert.equal(iq.status('animex', KEYS).state, 'down');
  assert.equal(iq.metrics('animex').downUntil - m.now(), 2 * MIN);                             // first cool-down: 2 minutes
  m.advance(2 * MIN + 1000);
  assert.notEqual(iq.status('animex', KEYS).state, 'down');                                    // available again by itself
  iq.recordPlay('animex', false);                                                              // one failure during probation trips it again...
  assert.equal(iq.status('animex', KEYS).state, 'down');
  assert.equal(iq.metrics('animex').downUntil - m.now(), 4 * MIN);                             // ...for twice as long
  m.advance(4 * MIN + 1000);
  assert.notEqual(iq.status('animex', KEYS).state, 'down');
  iq.recordPlay('animex', true, 2000);                                                          // works again: trust restored, strikes cleared
  assert.equal(iq.metrics('animex').downUntil, 0);
  iq.recordPlay('animex', false); iq.recordPlay('animex', false);
  assert.equal(iq.metrics('animex').downUntil - m.now(), 2 * MIN);                             // back to the short cool-down
});

test('cool-down is capped at 30 minutes', () => {
  const m = make(), iq = m.iq;
  let longest = 0;
  for (let i = 0; i < 12; i++) {
    iq.recordPlay('animex', false); iq.recordPlay('animex', false);
    longest = Math.max(longest, iq.metrics('animex').downUntil - m.now());
    m.advance(iq.metrics('animex').downUntil - m.now() + 1000);                                // wait it out, then relapse
  }
  assert.equal(longest, SourceIQ.COOL_MAX);
  assert.equal(SourceIQ.COOL_MAX, 30 * MIN);
});

test('old failures fade: three days later the source is treated as untested again', () => {
  const m = make();
  for (let i = 0; i < 3; i++) m.iq.recordPlay('animeyubi', false);
  m.advance(8 * DAY);
  const re = m.reload();
  assert.equal(re.metrics('animeyubi').n, 0);
  assert.equal(re.status('animeyubi', KEYS).state, 'untested');
});

test('labels: Recommended (best, healthy), Reliable, Unreliable', () => {
  const { iq, advance } = make();
  for (let i = 0; i < 6; i++) { iq.recordPlay('animex', true, 2500); iq.recordPlay('anikoto', true, 4000); advance(1000); }
  for (let i = 0; i < 8; i++) { iq.recordPlay('aniwaves', i < 2, 3000); advance(1000); iq.recordResolve('aniwaves', 'ok', 800); }
  assert.equal(iq.status('animex', KEYS).state, 'recommended');
  assert.equal(iq.status('anikoto', KEYS).state, 'reliable');
  assert.ok(['unreliable', 'down'].includes(iq.status('aniwaves', KEYS).state));
});

test('ordering is stable: small differences keep the default order', () => {
  const { iq } = make();
  iq.recordPlay('animex', true, 3000); iq.recordPlay('anikoto', true, 2900); iq.recordPlay('animeyubi', true, 3000);
  assert.deepEqual(iq.order(KEYS).slice(0, 3), ['animex', 'anikoto', 'animeyubi']);
});

test('recordTrace consumes the backend trace (ok / fail / timeout / absent / cancelled)', () => {
  const { iq } = make();
  iq.recordTrace([{ k: 'animex', ok: false, ms: 9000, kind: 'timeout' }, { k: 'animeyubi', ok: false, ms: 100, kind: 'absent' }, { k: 'anikoto', ok: false, ms: 50, kind: 'cancelled' }, { k: 'aniwaves', ok: true, ms: 1500, kind: 'ok' }]);
  assert.equal(iq.metrics('animex').n, 1); assert.equal(iq.metrics('animeyubi').n, 0); assert.equal(iq.metrics('anikoto').n, 0); assert.equal(iq.metrics('aniwaves').n, 1);
});

test('persistence: survives reload, is bounded, and stores no URLs', () => {
  const m = make();
  for (let i = 0; i < 40; i++) { m.iq.recordPlay('animex', i % 3 !== 0, 2000); m.advance(1000); m.iq.recordResolve('animex', 'ok', 700); }
  const re = m.reload();
  assert.ok(re.metrics('animex').n > 0 && re.metrics('animex').n <= SourceIQ.MAX_EVENTS);
  const blob = JSON.stringify(m.saved());
  assert.ok(!/https?:|token|cookie|\.m3u8|\.mp4/i.test(blob));
  assert.ok(blob.length < 4000, 'small: ' + blob.length);
});

test('survives corrupt or foreign stored data', () => {
  const iq = SourceIQ.create({ get: () => ({ v: 99, p: 'nope' }), set: () => { throw new Error('quota'); } }, () => Date.now());
  assert.deepEqual(iq.order(KEYS), KEYS);
  iq.recordPlay('animex', true, 1000);                                                          // set() throwing must not break playback
  assert.equal(iq.metrics('animex').n, 1);
});
