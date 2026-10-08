// Stand-in for Node-only / native packages that cannot run on Cloudflare Workers
// (@consumet/extensions, aniwatch, wreq-js). The code paths that use them are optional fallbacks and fail softly.
const fail = () => { throw new Error('not available on Cloudflare Workers'); };
export const createSession = fail;
export const HiAnime = {};
export const ANIME = {};
export const SubOrSub = {};
export default {};
