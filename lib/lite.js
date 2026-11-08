// AniUltimatium Lite playback. Lite ships no content source: it only plays what the viewer added themselves
// (their Stremio / Nuvio add-ons, their debrid account, their own P2P streaming server; IPTV and direct streams play on the TV).
// This module deliberately uses lib/addons.js only: no hosted players, no scrapers, no built-in catalogue of streams.
const { viaAddons, addonSubs } = require('./addons');
const verify = require('./verify');

async function sources(q, ctx = {}) {
  let list = []; try { list = q.addons ? JSON.parse(q.addons) : []; } catch (e) { list = []; }
  list = (Array.isArray(list) ? list : []).map(String).filter(Boolean).slice(0, 12);
  if (!/^tt\d+$/.test(q.id || '')) { const e = new Error('Add-ons need an IMDb id this title does not have'); e.status = 400; throw e; }
  if (!list.length) { const e = new Error('No add-ons yet. Add one in Settings → Extra sources → Add-ons (or sign in to Stremio from your phone).'); e.status = 502; throw e; }
  const tv = q.type === 'series', quality = parseInt(q.quality, 10) || 0, p2p = q.p2p === '1' || q.p2p === 1;
  const vf = ctx.verify || ((r, o) => verify.verifyStream(r, o));
  try {
    const direct = await viaAddons(list, q, tv, quality, ctx.debrid || null, vf, p2p);
    try { const extra = await addonSubs(list, q, tv); if (extra.length) direct.subtitles = (direct.subtitles || []).concat(extra).slice(0, 14); } catch (e) { /* subtitles are optional */ }
    return { direct };
  } catch (err) {
    if (err.torrents) { let subtitles = []; try { subtitles = await addonSubs(list, q, tv); } catch (e) { /* optional */ } return { direct: null, torrents: err.torrents, subtitles }; }
    const e = new Error(err.message || 'Your add-ons have no stream for this title'); e.status = 502; throw e;
  }
}

module.exports = { sources };
