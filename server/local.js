// Local server: runs the SAME scrapers as the Vercel function, but from your own (residential) IP,
// which the streaming sites don't block. Also serves the web app, so a laptop just opens the URL.
//   npm install && npm start        ->  http://localhost:3000
// On the TV: Settings tab -> Stream server -> http://<this-computer-LAN-IP>:3000
const http = require('http');
const fs = require('fs');
const os = require('os');
const path = require('path');
const handler = require('../api/index.js');

const PORT = parseInt(process.env.PORT, 10) || 3000;
const PUBLIC = path.join(__dirname, '..', 'public');
const MIME = { '.html': 'text/html; charset=utf-8', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.svg': 'image/svg+xml', '.xml': 'text/xml', '.json': 'application/json' };

http.createServer(async (req, res) => {
  const u = new URL(req.url, 'http://' + (req.headers.host || 'localhost'));
  if (u.pathname === '/api') {
    // Vercel-style shims so the serverless handler runs unchanged
    req.query = Object.fromEntries(u.searchParams);
    if (req.method === 'POST') {                       // parse JSON bodies like Vercel does
      const chunks = []; for await (const c of req) chunks.push(c);
      try { req.body = JSON.parse(Buffer.concat(chunks).toString() || '{}'); } catch (e) { req.body = {}; }
    }
    res.status = c => { res.statusCode = c; return res; };
    res.json = b => { res.setHeader('Content-Type', 'application/json'); res.end(JSON.stringify(b)); return res; };
    res.send = b => { res.end(b); return res; };
    const ac = new AbortController(); req.signal = ac.signal;          // client left (app closed the player / changed episode): cancel the scraping work
    res.on('close', () => { if (!res.writableEnded) ac.abort(); });
    try { await handler(req, res); } catch (e) { console.error('api error:', e && e.message); if (!res.headersSent) res.statusCode = 500; res.end(JSON.stringify({ error: 'Server error' })); }
    return;
  }
  // Static files: only what is inside ./public, sent as a stream (a large file is never read into memory whole)
  let rel; try { rel = decodeURIComponent(u.pathname); } catch (e) { res.statusCode = 400; return res.end(); }
  if (rel === '/') rel = '/index.html';
  let file = path.join(PUBLIC, path.normalize(rel));
  if (file !== PUBLIC && !file.startsWith(PUBLIC + path.sep)) { res.statusCode = 403; return res.end(); }
  if (!path.extname(file) && fs.existsSync(file + '.html')) file += '.html';      // /about, /link, /add like the hosted site
  fs.stat(file, (err, st) => {
    if (err || !st.isFile()) { res.statusCode = 404; return res.end('Not found'); }
    res.setHeader('Content-Type', MIME[path.extname(file)] || 'application/octet-stream');
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('Accept-Ranges', 'bytes');
    const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
    let start = 0, end = st.size - 1;
    if (m && (m[1] || m[2])) {                          // Range support (video seeking)
      if (m[1]) { start = parseInt(m[1], 10); if (m[2]) end = Math.min(parseInt(m[2], 10), end); } else start = Math.max(0, st.size - parseInt(m[2], 10));
      if (start > end || start >= st.size) { res.statusCode = 416; res.setHeader('Content-Range', `bytes */${st.size}`); return res.end(); }
      res.statusCode = 206;
      res.setHeader('Content-Range', `bytes ${start}-${end}/${st.size}`);
    }
    res.setHeader('Content-Length', end - start + 1);
    if (req.method === 'HEAD' || st.size === 0) return res.end();
    const stream = fs.createReadStream(file, { start, end });
    stream.on('error', () => res.destroy());
    res.on('close', () => stream.destroy());
    stream.pipe(res);
  });
}).listen(PORT, '0.0.0.0', () => {
  console.log('\nAniultimatium local server running\n');
  console.log('  Laptop : http://localhost:' + PORT);
  Object.values(os.networkInterfaces()).flat().filter(i => i && i.family === 'IPv4' && !i.internal)
    .forEach(i => console.log('  TV     : http://' + i.address + ':' + PORT + '   <- enter this in the TV app: Settings > Stream server'));
  console.log('');
});
