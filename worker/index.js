// Cloudflare Workers entry: serves the static app from ./public (ASSETS binding) and runs the same
// /api handler that used to live on Vercel, via a small Node-style req/res shim.
import avWorker from 'all-api/index.js';
import handler from '../api/index.js';

globalThis.__AV_WORKER = avWorker;                      // Anivexa aggregator (fetch handler) bundled in-process

function syncEnv(env) {
  globalThis.__ENV = env;
  try {                                                  // make string vars / secrets visible as process.env.X
    if (typeof process !== 'undefined' && process.env) for (const k of Object.keys(env)) if (typeof env[k] === 'string') process.env[k] = env[k];
  } catch (e) { /* ignore */ }
}

function makeRes() {
  const headers = new Headers();
  let body = null, finished = false, resolve;
  const done = new Promise(r => { resolve = r; });
  const res = {
    statusCode: 200,
    headersSent: false,
    setHeader(k, v) { headers.set(k, String(v)); return res; },
    getHeader(k) { return headers.get(k); },
    status(c) { res.statusCode = c; return res; },
    json(b) { headers.set('content-type', 'application/json'); return res.end(JSON.stringify(b)); },
    send(b) { return res.end(b); },
    end(b) { if (finished) return res; if (b !== undefined && b !== null) body = b; finished = true; resolve(); return res; },
    on() { return res; },
    sendWebStream(stream) { body = stream; finished = true; resolve(); return res; },
  };
  res.whenDone = done;
  res.toResponse = () => {
    const nullBody = res.statusCode === 204 || res.statusCode === 304;
    return new Response(nullBody ? null : body, { status: res.statusCode, headers });
  };
  return res;
}

async function runApi(request) {
  const url = new URL(request.url);
  const headers = {};
  request.headers.forEach((v, k) => { headers[k.toLowerCase()] = v; });
  headers['x-forwarded-proto'] = 'https';
  let body;
  if (request.method === 'POST') { try { body = await request.json(); } catch (e) { body = {}; } }
  const req = { method: request.method, url: url.pathname + url.search, query: Object.fromEntries(url.searchParams), headers, body };
  const res = makeRes();
  try { await handler(req, res); } catch (e) { res.status(500).json({ error: String((e && e.message) || e) }); }
  await res.whenDone;
  return res.toResponse();
}

export default {
  async fetch(request, env, ctx) {
    syncEnv(env);
    const url = new URL(request.url);
    if (url.pathname === '/api' || url.pathname === '/api/') return runApi(request);
    return env.ASSETS.fetch(request);                    // everything else: the static app in ./public
  },
};
