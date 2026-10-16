// Durable Object (SQLite-backed, free plan) used as the app's storage on Cloudflare Workers.
// KV's free plan allows only 1,000 writes a day for the whole app, which phone pairing, AniList linking and account sync used up.
// A Durable Object allows 100,000 writes a day. Short-lived entries (pairing codes) are stored with a time limit and removed by an alarm.
const json = v => new Response(JSON.stringify(v === undefined ? null : v), { headers: { 'content-type': 'application/json' } });
const MAX_BYTES = 1800000;                                       // a Durable Object value may be up to 2 MB

export class PairBox {
  constructor(state) { this.s = state.storage; }

  async fetch(request) {
    let m;
    try { m = await request.json(); } catch (e) { return new Response('bad request', { status: 400 }); }
    const key = String((m && m.key) || '');
    if (!key || key.length > 200) return new Response('bad key', { status: 400 });
    const now = Date.now();
    if (m.op === 'get') {
      for (const k of ['t:' + key, key]) {                     // temporary entries first
        const e = await this.s.get(k);
        if (!e) continue;
        if (e.x && e.x < now) { await this.s.delete(k); continue; }
        return json(e.v);
      }
      return json(null);
    }
    if (m.op === 'set') {
      if (JSON.stringify(m.value === undefined ? null : m.value).length > MAX_BYTES) return new Response('too large', { status: 413 });
      const ttl = +m.ttl > 0 ? +m.ttl : 0;
      await this.s.put((ttl ? 't:' : '') + key, { v: m.value, x: ttl ? now + ttl : 0 });
      if (ttl) await this.schedule(ttl + 5000);
      return json(true);
    }
    if (m.op === 'del') { await this.s.delete('t:' + key); await this.s.delete(key); return json(true); }
    return new Response('unknown op', { status: 400 });
  }

  async schedule(ms) {
    const at = Date.now() + ms, cur = await this.s.getAlarm();
    if (!cur || cur > at) await this.s.setAlarm(at);
  }

  async alarm() {                                               // remove expired temporary entries; look again when the next one is due
    const all = await this.s.list({ prefix: 't:' }), now = Date.now();
    let next = 0;
    for (const [k, e] of all) {
      if (!e || !e.x || e.x < now) await this.s.delete(k);
      else if (!next || e.x < next) next = e.x;
    }
    if (next) await this.s.setAlarm(next + 1000);
  }
}
