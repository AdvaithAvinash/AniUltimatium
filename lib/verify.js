'use strict';
// Stream verification: before a stream is handed to the player, make sure it is really playable from this host.
//   MP4:  a small ranged read must return video bytes (not an HTML / JSON error page).
//   HLS:  the playlist must parse; a master playlist's first variant must list segments; the encryption key (if any) must be readable;
//         and the FIRST SEGMENT must download and look like media (MPEG-TS, fragmented MP4, AAC, or the image-wrapped segments some CDNs use).
// A stream that fails here never reaches the player, so a dead source costs a few hundred milliseconds instead of a black screen.
// Nothing is decrypted, unlocked or bypassed: this only reads what the player itself would read.
const UA = 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36';
const BAD_TYPE = /text\/html|application\/json|text\/xml|application\/xml|text\/plain/;

function headersOf(r, ua) {
  const h = Object.assign({ 'User-Agent': ua || UA }, r.headers || {});
  const ref = h.Referer || h.referer;
  if (ref && !h.Origin) { try { h.Origin = new URL(ref).origin; } catch (e) { /* ignore */ } }
  return h;
}
// Never fetch private addresses on behalf of an add-on or provider (the cloud server must not be a door into a network)
function publicUrl(u) {
  let h; try { h = new URL(u); } catch (e) { return false; }
  if (!/^https?:$/.test(h.protocol)) return false;
  if (process.env.ALLOW_PRIVATE_ADDONS) return true;
  const host = h.hostname.toLowerCase();
  return !(host === 'localhost' || host.endsWith('.local') || host.endsWith('.internal') || /^(127|10|0)\.|^192\.168\.|^169\.254\.|^172\.(1[6-9]|2\d|3[01])\.|^\[|^::/.test(host));
}
function sniff(b) {                                    // first bytes of a media segment / file -> kind or ''
  if (!b || !b.length) return '';
  if (b[0] === 0x47) return 'ts';
  const s4 = String.fromCharCode.apply(null, Array.prototype.slice.call(b, 4, 8));
  if (/^(ftyp|styp|moof|moov|mdat|sidx)$/.test(s4)) return 'mp4';
  if (b[0] === 0x49 && b[1] === 0x44 && b[2] === 0x33) return 'id3';                       // ID3 tag in front of AAC / MP3
  if (b[0] === 0xFF && (b[1] & 0xF0) === 0xF0) return 'aac';
  if (b[0] === 0x1A && b[1] === 0x45 && b[2] === 0xDF && b[3] === 0xA3) return 'webm';
  if (b[0] === 0x89 && b[1] === 0x50) return 'png';                                         // image-wrapped segments (the player strips the header)
  if (b[0] === 0xFF && b[1] === 0xD8) return 'jpeg';
  if (b[0] === 0x47 && b[1] === 0x49 && b[2] === 0x46) return 'gif';
  if (b[0] === 0x52 && b[1] === 0x49 && b[2] === 0x46 && b[3] === 0x46) return 'riff';
  return '';
}

async function read(url, o, extra) {                   // one bounded request -> { status, type, bytes (first chunk), text? }
  const ctl = new AbortController(); let late = false;
  const t = setTimeout(() => { late = true; ctl.abort(); }, o.timeout);
  try {
    const x = await o.fetch(url, { signal: ctl.signal, redirect: 'follow', headers: Object.assign({}, o.headers, extra && extra.headers || {}) });
    const type = (x.headers.get('content-type') || '').toLowerCase();
    if (extra && extra.text) { const text = await x.text(); return { status: x.status, ok: x.ok, type, text }; }
    let bytes = null;
    try { const buf = await x.arrayBuffer(); bytes = new Uint8Array(buf.slice(0, 2048)); } catch (e) { bytes = null; }
    return { status: x.status, ok: x.ok, type, bytes };
  } catch (e) { if (late) throw new Error('stream check timed out'); throw e; }
  finally { clearTimeout(t); }
}
const abs = (u, base) => new URL(u.trim(), base).href;
function firstUri(text) { return text.split('\n').map(l => l.trim()).find(l => l && l[0] !== '#') || ''; }

async function verifyStream(r, opts) {
  const o = Object.assign({ fetch: globalThis.fetch, timeout: 5000, deep: true, ua: UA }, opts || {});
  o.headers = headersOf(r, o.ua);
  const t0 = Date.now(), v = { level: 'playlist', variants: 0 };
  let res;
  if (!publicUrl(r.url)) throw new Error('stream address is not public');
  try {
    if (r.mp4) {
      res = await read(r.url, o, { headers: { Range: 'bytes=0-2047' } });
      if (!res.ok) throw new Error('stream HTTP ' + res.status);
      if (BAD_TYPE.test(res.type)) throw new Error('stream is not video');
      const k = sniff(res.bytes);
      if (!k && !/video|audio|octet-stream|mpeg|mp4/.test(res.type)) throw new Error('stream is not video');
      v.level = 'file'; v.kind = k || 'unknown';
    } else {
      res = await read(r.url, o, { text: true });
      if (!res.ok) throw new Error('stream HTTP ' + res.status);
      if (res.text.slice(0, 64).indexOf('#EXTM3U') < 0) throw new Error('stream is not a playlist');
      if (o.deep) {
        let media = res.text, base = r.url;
        if (/#EXT-X-STREAM-INF/.test(media)) {                                             // master playlist: look at its first variant
          const lines = media.split('\n').map(l => l.trim()), vars = [];
          for (let i = 0; i < lines.length; i++) if (/^#EXT-X-STREAM-INF/.test(lines[i])) { const u = firstUri(lines.slice(i + 1).join('\n')); if (u) vars.push(u); }
          v.variants = vars.length;
          if (!vars.length) throw new Error('playlist lists no streams');
          base = abs(vars[0], r.url);
          if (!publicUrl(base)) throw new Error('stream address is not public');
          const m = await read(base, o, { text: true });
          if (!m.ok) throw new Error('stream variant HTTP ' + m.status);
          if (m.text.slice(0, 64).indexOf('#EXTM3U') < 0) throw new Error('stream variant is not a playlist');
          media = m.text;
        }
        const seg = firstUri(media.split('\n').filter(l => !/^#EXT-X-MAP/.test(l)).join('\n'));
        if (!seg) throw new Error('playlist has no segments');
        const segUrl = abs(seg, base);
        if (!publicUrl(segUrl)) throw new Error('segment address is not public');
        const key = /#EXT-X-KEY:[^\n]*METHOD=(?!NONE)[^\n]*URI="([^"]+)"/.exec(media);
        if (key) {
          const kr = await read(abs(key[1], base), o, {});
          if (!kr.ok) throw new Error('encryption key HTTP ' + kr.status);
          if (BAD_TYPE.test(kr.type)) throw new Error('encryption key is not a key');
        }
        const sr = await read(segUrl, o, { headers: { Range: 'bytes=0-2047' } });
        if (!sr.ok) throw new Error('segment HTTP ' + sr.status);
        if (BAD_TYPE.test(sr.type)) throw new Error('segment is not media');
        if (!sr.bytes || !sr.bytes.length) throw new Error('segment is empty');
        const k = sniff(sr.bytes);
        if (!k && !/video|audio|octet-stream|mpeg|binary|image/.test(sr.type)) throw new Error('segment is not media');
        v.level = 'segment'; v.kind = k || 'unknown';
      }
    }
  } catch (e) {
    if (/subrequest/i.test(String(e && e.message))) return r;                           // Workers request budget used up: let the player try it
    throw e;
  }
  v.ms = Date.now() - t0;
  return Object.assign({}, r, { verified: v });
}

module.exports = { verifyStream, publicUrl, sniff, UA };
