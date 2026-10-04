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
    try { await handler(req, res); } catch (e) { res.statusCode = 500; res.end(JSON.stringify({ error: e.message })); }
    return;
  }
  const file = path.join(PUBLIC, u.pathname === '/' ? 'index.html' : path.normalize(u.pathname).replace(/^(\.\.[/\\])+/, ''));
  if (!file.startsWith(PUBLIC)) { res.statusCode = 403; return res.end(); }
  fs.readFile(file, (err, data) => {
    if (err) { res.statusCode = 404; return res.end('Not found'); }
    res.setHeader('Content-Type', MIME[path.extname(file)] || 'application/octet-stream');
    res.setHeader('Accept-Ranges', 'bytes');
    const m = /^bytes=(\d*)-(\d*)$/.exec(req.headers.range || '');
    if (m) {                                            // Range support (video seeking)
      const start = m[1] ? parseInt(m[1], 10) : 0, end = m[2] ? Math.min(parseInt(m[2], 10), data.length - 1) : data.length - 1;
      res.statusCode = 206;
      res.setHeader('Content-Range', `bytes ${start}-${end}/${data.length}`);
      res.setHeader('Content-Length', end - start + 1);
      return res.end(data.subarray(start, end + 1));
    }
    res.end(data);
  });
}).listen(PORT, '0.0.0.0', () => {
  console.log('\nAniultimatium local server running\n');
  console.log('  Laptop : http://localhost:' + PORT);
  Object.values(os.networkInterfaces()).flat().filter(i => i && i.family === 'IPv4' && !i.internal)
    .forEach(i => console.log('  TV     : http://' + i.address + ':' + PORT + '   <- enter this in the TV app: Settings > Stream server'));
  console.log('');
});
