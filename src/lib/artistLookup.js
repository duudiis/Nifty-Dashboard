import { buildEntityId } from "../sources/ids.js";

// Resolves an artist NAME to Deezer's catalog — the authority for artist pages.
//
// Deezer's search always answers with SOMETHING, which is the trap: it happily
// returns ZZ Top for "CCTK" and a 24-fan account for "BagelLox". A caption like
// "Because you played CCTK" over a shelf of ZZ Top is worse than no shelf at
// all, so a match only counts when the name matches after normalisation AND the
// artist is popular enough to be the real one rather than a soundalike upload.
const MIN_FANS = 1000;

const cache = new Map();
const TTL = 1000 * 60 * 60;

const norm = (s) =>
    String(s || "")
        .toLowerCase()
        .normalize("NFD")
        .replace(/\p{M}/gu, "")
        .replace(/[^a-z0-9]/g, "");

/**
 * { browseId, name, artistId, fans } for a confident match, or
 * { browseId: null } for anything we would only be guessing at.
 */
export async function lookupArtist(rawName, { strict = true } = {}) {
    // Multi-artist credits arrive comma-joined ("Riton, Nightcrawlers, Mufasa")
    // and match nothing as a whole; the lead artist is the one worth resolving.
    const name = String(rawName || "").split(",")[0].trim();
    if (!name) return { browseId: null };

    const key = `${strict ? "s" : "l"}:${name.toLowerCase()}`;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.ts < TTL) return hit.data;

    let data = { browseId: null };
    try {
        const json = await fetch(
            `https://api.deezer.com/search/artist?q=${encodeURIComponent(name)}&limit=5`,
            { headers: { "User-Agent": "Nifty-Dashboard", "Accept-Language": "en" } }
        ).then((r) => r.json());

        const wanted = norm(name);
        const candidates = json?.data || [];
        const exact = candidates.find((a) => norm(a.name) === wanted);
        const artist = strict
            ? (exact && (exact.nb_fan ?? 0) >= MIN_FANS ? exact : null)
            : (exact || candidates[0]);

        if (artist?.id) {
            data = {
                browseId: buildEntityId("deezer", "artist", artist.id),
                artistId: String(artist.id),
                name: artist.name,
                fans: artist.nb_fan ?? 0,
                artwork: artist.picture_xl || artist.picture_big || artist.picture || null
            };
        }
    } catch { /* an unresolved artist is a missing link, never an error */ }

    cache.set(key, { data, ts: Date.now() });
    return data;
}
