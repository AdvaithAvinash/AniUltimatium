// Stand-in for Node-only / native packages that cannot run on Cloudflare Workers
// (@consumet/extensions, aniwatch, wreq-js). The code paths that use them are optional fallbacks and fail softly.
// wreq-js (browser-like TLS) is replaced by the platform fetch, with a tiny cookie jar per session.
export const createSession = async () => {
  const jar = new Map();
  return {
    async fetch(url, init = {}) {
      const headers = new Headers(init.headers || {});
      if (jar.size && !headers.has('cookie')) headers.set('cookie', [...jar].map(([k, v]) => k + '=' + v).join('; '));
      const r = await fetch(url, { ...init, headers });
      const list = typeof r.headers.getSetCookie === 'function' ? r.headers.getSetCookie() : [];
      for (const c of list) { const kv = c.split(';')[0], i = kv.indexOf('='); if (i > 0) jar.set(kv.slice(0, i).trim(), kv.slice(i + 1)); }
      return r;
    },
    close() {},
  };
};
export const HiAnime = {};
export const ANIME = {};
export const SubOrSub = {};
export default {};
