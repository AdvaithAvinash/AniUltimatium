// Movies and TV shows: metadata from Cinemeta (free, key-less catalog). Playback:
//   1) Internet Archive public-domain films (direct MP4, played in our own player)
//   2) Hosted embed players (CineSrc, VidFast, VidCore, Videasy + VidLink on request) shown in an iframe
//   3) Optional extras the viewer sets up: Stremio/Nuvio add-ons, a debrid account, a CinePro Core server (all optional; direct streams play in our own player)
const verify = require('./verify');
const { jget, UA } = require('./http');
const CINEMETA = 'https://v3-cinemeta.strem.io';
const { home, search, seriesMeta } = require('./cinemeta');
const { addonBase, rankStream, directOf, firstReadable, viaAddons, addonSubs, addonInfo } = require('./addons');

const norm = s => (s || '').toLowerCase().replace(/&amp;/g, '&').replace(/[^a-z0-9]+/g, ' ').trim();

// Hosted embed players: VidCore -> https://vidcore.io/movie/{imdbId} (moved from vidcore.org, whose certificate broke), CineSrc by TMDB id
async function tmdbId(imdb, type) {
  const d = await jget(`${CINEMETA}/meta/${type === 'series' ? 'series' : 'movie'}/${encodeURIComponent(imdb)}.json`);
  const id = d.meta && d.meta.moviedb_id;
  if (!id) throw new Error('no TMDB id');
  return id;
}
// `quality` is only understood by CineSrc; both take a resume time (CineSrc `t`, VidCore `startAt`). VidCore auto-selects quality itself.
const EMBEDS = [                               // Auto tries them in this order; all post their playback clock to our page
  { key: 'cinesrc', name: 'CineSrc', url: (id, o) => `https://cinesrc.st/embed/movie/${id}?seek=10&autoplay=true&controls=true&prioritize=true`
      + (o.quality ? `&quality=${encodeURIComponent(o.quality)}` : '') + (o.t > 5 ? `&t=${Math.floor(o.t)}&continueprompt=false` : '') },
  // VidFast: same player API family as VidCore; its player code handles {command:'play'|'pause'|'seek',time}
  { key: 'vidfast', name: 'VidFast', imdb: true, url: (id, o) => `https://vidfast.vc/movie/${id}?autoPlay=true&title=false&poster=false&chromecast=false` + (o.t > 5 ? `&startAt=${Math.floor(o.t)}` : '') },
  { key: 'vidcore', name: 'VidCore', imdb: true, url: (id, o) => `https://vidcore.io/movie/${id}?autoPlay=true&title=false&chromecast=false` + (o.t > 5 ? `&startAt=${Math.floor(o.t)}` : '') },
  { key: 'videasy', name: 'Videasy', url: (id, o) => `https://player.videasy.to/movie/${id}?color=ff3d7f` + (o.t > 5 ? `&progress=${Math.floor(o.t)}` : '') },
  // Extra hosted players, tried by Auto after the ones above. They only take an id and show a player page, so they are played inside the popup-blocking frame (see "Block popups" in Settings).
  { key: '2embed', name: '2Embed', url: id => `https://www.2embed.cc/embed/${id}` },
  { key: 'superembed', name: 'SuperEmbed', imdb: true, url: id => `https://multiembed.mov/?video_id=${id}` },
  { key: 'vidsrcto', name: 'VidSrc.to', url: id => `https://vidsrc.to/embed/movie/${id}` },
  { key: 'vidsrcme', name: 'VidSrc.me', url: id => `https://vidsrc.me/embed/movie?tmdb=${id}` },
  { key: 'vidsrccc', name: 'VidSrc.cc', url: id => `https://vidsrc.cc/v2/embed/movie/${id}` },
  { key: 'vidzee', name: 'VidZee', url: id => `https://player.vidzee.wtf/embed/movie/${id}` },
  { key: 'vidrock', name: 'VidRock', url: id => `https://vidrock.net/movie/${id}` },
  { key: '111movies', name: '111Movies', url: id => `https://111movies.com/movie/${id}` },
  { key: 'cinemaos', name: 'CinemaOS', url: id => `https://cinemaos.tech/player/${id}` },
  { key: 'nontongo', name: 'NontonGo', url: id => `https://nontongo.win/embed/movie/${id}` },
  { key: 'rive', name: 'Rive', url: id => `https://www.rivestream.app/embed?type=movie&id=${id}` },
  { key: 'vidsrcsu', name: 'VidSrc.su', url: id => `https://vidsrc.su/movie/${id}` },
  // Optional: never used by Auto (low chance of working on many networks); only when picked as the Source
  { key: 'vidlink', name: 'VidLink', optional: true, url: id => `https://vidlink.pro/movie/${id}` },
];
// The same players' TV-episode pages (season s, episode e)
const TV_EMBEDS = [
  { key: 'cinesrc', name: 'CineSrc', url: (id, o) => `https://cinesrc.st/embed/tv/${id}?s=${o.s}&e=${o.e}&seek=10&autoplay=true&controls=true&prioritize=true`
      + (o.quality ? `&quality=${encodeURIComponent(o.quality)}` : '') + (o.t > 5 ? `&t=${Math.floor(o.t)}&continueprompt=false` : '') },
  { key: 'vidfast', name: 'VidFast', imdb: true, url: (id, o) => `https://vidfast.vc/tv/${id}/${o.s}/${o.e}?autoPlay=true&title=false&poster=false&chromecast=false&nextButton=false&autoNext=false` + (o.t > 5 ? `&startAt=${Math.floor(o.t)}` : '') },
  { key: 'vidcore', name: 'VidCore', imdb: true, url: (id, o) => `https://vidcore.io/tv/${id}/${o.s}/${o.e}?autoPlay=true&title=false&chromecast=false` + (o.t > 5 ? `&startAt=${Math.floor(o.t)}` : '') },
  { key: 'videasy', name: 'Videasy', url: (id, o) => `https://player.videasy.to/tv/${id}/${o.s}/${o.e}?color=ff3d7f` + (o.t > 5 ? `&progress=${Math.floor(o.t)}` : '') },
  { key: '2embed', name: '2Embed', url: (id, o) => `https://www.2embed.cc/embedtv/${id}&s=${o.s}&e=${o.e}` },
  { key: 'superembed', name: 'SuperEmbed', imdb: true, url: (id, o) => `https://multiembed.mov/?video_id=${id}&s=${o.s}&e=${o.e}` },
  { key: 'vidsrcto', name: 'VidSrc.to', url: (id, o) => `https://vidsrc.to/embed/tv/${id}/${o.s}/${o.e}` },
  { key: 'vidsrcme', name: 'VidSrc.me', url: (id, o) => `https://vidsrc.me/embed/tv?tmdb=${id}&season=${o.s}&episode=${o.e}` },
  { key: 'vidsrccc', name: 'VidSrc.cc', url: (id, o) => `https://vidsrc.cc/v2/embed/tv/${id}/${o.s}/${o.e}` },
  { key: 'vidzee', name: 'VidZee', url: (id, o) => `https://player.vidzee.wtf/embed/tv/${id}/${o.s}/${o.e}` },
  { key: 'vidrock', name: 'VidRock', url: (id, o) => `https://vidrock.net/tv/${id}/${o.s}/${o.e}` },
  { key: '111movies', name: '111Movies', url: (id, o) => `https://111movies.com/tv/${id}/${o.s}/${o.e}` },
  { key: 'cinemaos', name: 'CinemaOS', url: (id, o) => `https://cinemaos.tech/player/${id}/${o.s}/${o.e}` },
  { key: 'nontongo', name: 'NontonGo', url: (id, o) => `https://nontongo.win/embed/tv/${id}/${o.s}/${o.e}` },
  { key: 'rive', name: 'Rive', url: (id, o) => `https://www.rivestream.app/embed?type=tv&id=${id}&season=${o.s}&episode=${o.e}` },
  { key: 'vidsrcsu', name: 'VidSrc.su', url: (id, o) => `https://vidsrc.su/tv/${id}/${o.s}/${o.e}` },
  { key: 'vidlink', name: 'VidLink', optional: true, url: (id, o) => `https://vidlink.pro/tv/${id}/${o.s}/${o.e}` },
];

// Internet Archive: public-domain feature films (direct MP4)
async function viaArchive(title, year) {
  const q = `title:("${title.replace(/["()]/g, ' ').trim()}") AND mediatype:movies`;
  const d = await jget(`https://archive.org/advancedsearch.php?q=${encodeURIComponent(q)}&fl%5B%5D=identifier&fl%5B%5D=title&fl%5B%5D=year&fl%5B%5D=downloads&rows=15&sort%5B%5D=downloads+desc&output=json`);
  const docs = (d.response && d.response.docs) || [];
  const want = norm(title);
  const ok = docs.filter(x => norm(x.title) === want && (!year || !x.year || Math.abs(parseInt(x.year, 10) - year) <= 1));
  if (!ok.length) throw new Error('not in the public-domain archive');
  for (const hit of ok.slice(0, 3)) {
    const meta = await jget(`https://archive.org/metadata/${encodeURIComponent(hit.identifier)}`);
    // feature films only: reject trailers/clips (needs a known runtime of 50+ minutes) and require the year to match
    if (!year || !hit.year || Math.abs(parseInt(hit.year, 10) - year) > 1) continue;
    const files = (meta.files || []).filter(f => /\.(mp4|m4v)$/i.test(f.name) && f.source !== 'metadata' && /h\.?264|mpeg4|mp4/i.test(f.format || '') && parseFloat(f.length) >= 3000);
    if (!files.length) continue;
    files.sort((a, b) => (parseInt(b.size, 10) || 0) - (parseInt(a.size, 10) || 0));
    const f = files.find(x => (parseInt(x.size, 10) || 0) < 4e9) || files[0];
    const base = `https://${meta.d1 || meta.server}${meta.dir}`;
    const subs = (meta.files || []).filter(x => /\.(vtt|srt)$/i.test(x.name) && /en|eng/i.test(x.name)).slice(0, 1).map(x => ({ lang: 'English', url: `${base}/${encodeURIComponent(x.name)}` }));
    return { url: `https://archive.org/download/${encodeURIComponent(hit.identifier)}/${encodeURIComponent(f.name)}`, headers: {}, subtitles: subs, mp4: true, quality: 'Public domain', matched: 'archive.org: ' + hit.title, provider: 'archive' };
  }
  throw new Error('no playable file');
}

// Stream add-on (the open Stremio add-on protocol): the user gives the address of an add-on they chose (for example one set up with their own debrid account).
// Its answer is a plain video file or HLS address, which plays in our own player, so it also works on old TV browsers that cannot run the hosted players.
// Only streams that are ready to play over http(s) are used (torrent-only entries are skipped); nothing is decrypted or unlocked here.
// CinePro Core (open-source OMSS streaming API, self-hosted by whoever runs it): { sources:[{url,type,quality,provider}], subtitles:[{url,label}] }
async function viaCinepro(raw, q, tv, quality, vf) {
  const base = addonBase(raw);
  if (!base) throw new Error('The CinePro Core address is not valid');
  if (!q.tmdbId) throw new Error('CinePro Core needs a TMDB id this title does not have');
  const path = tv ? `/v1/tv/${q.tmdbId}/seasons/${Math.max(1, parseInt(q.s, 10) || 1)}/episodes/${Math.max(1, parseInt(q.e, 10) || 1)}` : `/v1/movies/${q.tmdbId}`;
  const d = await jget(base + path, 25000);
  const abs = u => { try { return new URL(u, base + '/').href; } catch (e) { return ''; } };
  const list = (d.sources || []).map(x => ({ url: abs(x.url), type: String(x.type || ''), q: parseInt(String(x.quality || '').replace(/\D/g, ''), 10) || 0, who: x.provider && (x.provider.name || x.provider.id) || '' }))
    .filter(x => /^https?:\/\//.test(x.url) && !/dash|mpd/i.test(x.type));
  if (!list.length) throw new Error('CinePro Core found no stream for this title');
  const score = x => (quality ? -Math.abs((x.q || 720) - quality) / 10 : x.q === 1080 ? 30 : x.q === 720 ? 24 : x.q ? 8 : 10) + (/hls|m3u8/i.test(x.type + x.url) || /mp4/i.test(x.type) ? 12 : 0);
  const ranked = list.sort((a, b) => score(b) - score(a)).slice(0, 2);
  const subs = (d.subtitles || []).filter(x => x && x.url).slice(0, 8).map(x => ({ lang: x.label || x.lang || 'Subtitles', url: abs(x.url) }));
  return firstReadable(ranked.map(top => ({ url: top.url, headers: {}, subtitles: subs, mp4: !/hls|m3u8/i.test(top.type + top.url), quality: top.q ? top.q + 'p' : 'auto', matched: 'CinePro Core' + (top.who ? ': ' + top.who : ''), provider: 'cinepro' })), vf);
}

// Returns { direct, embeds }. `via`: 'auto' | 'archive' | an embed key (vidcore / cinesrc).
// The chosen embed is moved to the front of `embeds`; with 'auto' a public-domain direct file wins, otherwise CineSrc.
async function sources(q, ctx = {}) {
  const p2p = q.p2p === '1' || q.p2p === 1;
  const tv = q.type === 'series', year = parseInt(q.year, 10) || null, list = tv ? TV_EMBEDS : EMBEDS;
  let addons = []; try { addons = q.addons ? JSON.parse(q.addons) : q.addon ? [q.addon] : []; } catch (e) { addons = []; }
  addons = (Array.isArray(addons) ? addons : []).map(String).filter(Boolean).slice(0, 12);
  const cinepro = q.cinepro ? String(q.cinepro) : '', haveExtra = addons.length > 0 || !!cinepro;
  let via = String(q.via || 'auto'); if (via === 'addon' && !haveExtra) via = 'auto';
  const imdbOk = /^tt\d+$/.test(q.id || ''), extraOn = imdbOk && haveExtra && (via === 'auto' || via === 'addon');
  const wantEmbed = !extraOn && (tv || list.some(e => e.key === via));
  const skipped = () => Promise.reject(new Error('skipped'));
  const quality = parseInt(q.quality, 10) || 0;
  const vf = ctx.verify || ((r, o) => verify.verifyStream(r, o));
  const adP = extraOn && addons.length ? viaAddons(addons, q, tv, quality, ctx.debrid || null, vf, p2p) : skipped();
  adP.catch(() => {});
  const [tm, ar] = await Promise.allSettled([
    via === 'archive' && !tv ? skipped() : tmdbId(q.id, tv ? 'series' : 'movie'),
    wantEmbed || tv || via === 'addon' ? skipped() : viaArchive(q.title || '', year),
  ]);
  const cpP = extraOn && cinepro && tm.status === 'fulfilled' ? viaCinepro(cinepro, Object.assign({}, q, { tmdbId: tm.value }), tv, quality, vf) : skipped();
  const [ad, cp] = await Promise.allSettled([adP, cpP]);
  const opts = { quality, t: parseFloat(q.t) || 0, s: Math.max(1, parseInt(q.s, 10) || 1), e: Math.max(1, parseInt(q.e, 10) || 1) };
  let embeds = list.filter(e => !e.optional || e.key === via).filter(e => e.imdb ? imdbOk : tm.status === 'fulfilled')
    .map(e => ({ key: e.key, name: e.name, url: e.url(e.imdb ? q.id : tm.value, opts) }));
  if (wantEmbed) embeds = embeds.slice().sort((a, b) => ((b.key === via) ? 1 : 0) - ((a.key === via) ? 1 : 0));
  const direct = ad.status === 'fulfilled' ? ad.value : cp.status === 'fulfilled' ? cp.value : ar.status === 'fulfilled' ? ar.value : null;
  const torrents = !direct && ad.status === 'rejected' && ad.reason.torrents ? ad.reason.torrents : null;
  if (torrents) ad.reason.message = 'skipped';
  if (direct && addons.length && imdbOk) { try { const extra = await addonSubs(addons, q, tv); if (extra.length) direct.subtitles = (direct.subtitles || []).concat(extra).slice(0, 14); } catch (e) { /* subtitles are optional */ } }
  if (torrents) { let subtitles = []; try { subtitles = await addonSubs(addons, q, tv); } catch (e) { /* optional */ } return { direct: null, embeds: [], torrents, subtitles, tmdb: tm.status === 'fulfilled' ? tm.value : null, addonError: null }; }
  const addonError = extraOn && !direct ? [ad, cp].filter(r => r.status === 'rejected' && r.reason.message !== 'skipped').map(r => r.reason.message).join(' · ') || null : null;
  if (via === 'addon' && !direct && !embeds.length) { const err = new Error(addonError || 'The add-ons gave no stream'); err.status = 502; throw err; }
  if (via === 'archive' && !direct && !tv) {
    const err = new Error('This movie is not in the public-domain archive. Pick another source.');
    err.status = 502; throw err;
  }
  if (!direct && !embeds.length) {
    const err = new Error('No stream was found for this ' + (tv ? 'episode.' : 'movie.'));
    err.status = 502; err.detail = [tm, ar].map(r => r.reason && r.reason.message).filter(Boolean).join(' | ');
    throw err;
  }
  return { direct, embeds, tmdb: tm.status === 'fulfilled' ? tm.value : null, addonError };
}

module.exports = { home, search, sources, seriesMeta, addonBase, rankStream, addonInfo };
