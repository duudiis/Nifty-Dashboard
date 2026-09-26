import { parse } from "cookie";

import { verifySession } from "../../lib/jwt.js";
import { lookupArtist } from "../../lib/artistLookup.js";
import { api, track, albumItem, artistItem, playlistItem } from "../../sources/deezer/index.js";

// The home screen's recommendation half.
//
//   GET /api/discover?seeds=<up to 3 comma-joined artist names>
//
// Deliberately its own route, separate from /api/home: Deezer is a third party
// with a real rate limit, and a bad minute there must never blank the personal
// half of the page or hold up its first paint. Seeds arrive from the client
// (they came out of /api/home), so this route makes no database round trip.
//
// Rate limit is ~50 requests / 5s per IP and is reported as HTTP 200 with an
// error in the body — api() already throws on that — so the fan-out is capped
// and every call degrades to null on its own.

const TTL = 1000 * 60 * 60 * 6;
const MAX_ENTRIES = 200;

// Unlike the app's other content caches this one keys on an open-ended space
// (every artist anyone has ever played), so it evicts instead of growing.
const cache = new Map();

function cached(key) {
    const hit = cache.get(key);
    if (hit && Date.now() - hit.ts < TTL) return hit.data;
    if (hit) cache.delete(key);
    return null;
}

function remember(key, data) {
    if (cache.size >= MAX_ENTRIES) cache.delete(cache.keys().next().value);
    cache.set(key, { data, ts: Date.now() });
    return data;
}

// A year, not six months. Measured against this user's real top artists, a
// 180-day window returned nothing at all — the most recent release among them
// was 220 days old — so the rail would simply never appear. Every tile carries
// its release date, so a wider window stays honest.
const RECENT_MS = 1000 * 60 * 60 * 24 * 365;

const isRecent = (dateStr) => {
    if (!dateStr) return false;
    const t = Date.parse(dateStr);
    return Number.isFinite(t) && Date.now() - t < RECENT_MS;
};

// One seed's whole bundle: radio picks, related artists, recent releases.
async function bundleFor(seed) {
    const key = `artist:${seed.artistId}`;
    const hit = cached(key);
    if (hit) return hit;

    const call = (path) => api(path).catch(() => null);
    const [radio, related, albums] = await Promise.all([
        call(`/artist/${seed.artistId}/radio`),
        call(`/artist/${seed.artistId}/related?limit=20`),
        call(`/artist/${seed.artistId}/albums?limit=25`)
    ]);

    return remember(key, {
        seed: { name: seed.name, browseId: seed.browseId, artwork: seed.artwork },
        songs: (radio?.data || []).slice(0, 10).map((t) => ({ kind: "song", ...track(t) })),
        artists: (related?.data || []).slice(0, 12).map(artistItem),
        releases: (albums?.data || [])
            .filter((a) => isRecent(a.release_date))
            .slice(0, 8)
            .map((a) => ({ ...albumItem({ ...a, artist: { name: seed.name } }), releaseDate: a.release_date }))
    });
}

// With no seed we can still be useful, just not personal — and the page says so
// rather than pretending the charts were picked for you.
async function charts() {
    const hit = cached("charts");
    if (hit) return hit;
    const json = await api("/chart?limit=12").catch(() => null);
    return remember("charts", {
        songs: (json?.tracks?.data || []).map((t) => ({ kind: "song", ...track(t) })),
        playlists: (json?.playlists?.data || []).map(playlistItem),
        artists: (json?.artists?.data || []).map(artistItem),
        albums: (json?.albums?.data || []).map(albumItem)
    });
}

export default async function handler(req, res) {

    const cookies = parse(req.headers.cookie || "");
    if (!(await verifySession(cookies.session))) {
        return res.status(401).json({ message: "Not authenticated." });
    }

    // The client sends a run of candidates rather than a fixed three: the most
    // listened-to name is often something the catalogue has never heard of —
    // "Nightcore", an uploader alias, a track title mistaken for an artist —
    // and stopping at the top three would hand back charts to someone whose
    // fourth and seventh artists resolve perfectly well.
    const names = String(req.query.seeds || "")
        .split(",")
        .map((s) => s.trim())
        .filter((s) => s && s.length <= 80)
        .slice(0, 10);

    try {
        res.setHeader("Cache-Control", "no-store");

        // Only artists we can identify with confidence become seeds — a shelf
        // captioned "Because you played X" has to actually be about X.
        const resolved = (await Promise.all(names.map((n) => lookupArtist(n).catch(() => ({ browseId: null })))))
            .filter((r) => r.browseId)
            .slice(0, 3);

        if (!resolved.length) {
            const c = await charts();
            return res.status(200).json({ personalized: false, seeds: [], bundles: [], ...c });
        }

        const bundles = (await Promise.all(resolved.map((s) => bundleFor(s).catch(() => null)))).filter(Boolean);

        if (!bundles.length) {
            const c = await charts();
            return res.status(200).json({ personalized: false, seeds: [], bundles: [], ...c });
        }

        // Releases are merged across seeds: one rail of "new from artists you
        // play" reads better than one rail per artist.
        const seenAlbums = new Set();
        const releases = bundles
            .flatMap((b) => b.releases)
            .filter((a) => !seenAlbums.has(a.browseId) && seenAlbums.add(a.browseId))
            .sort((a, b) => Date.parse(b.releaseDate) - Date.parse(a.releaseDate))
            .slice(0, 14);

        return res.status(200).json({
            personalized: true,
            seeds: bundles.map((b) => b.seed),
            bundles: bundles.map((b) => ({ seed: b.seed, songs: b.songs, artists: b.artists })),
            releases
        });

    } catch (error) {
        console.error("[Dashboard] /api/discover failed:", error.message);
        return res.status(200).json({ personalized: false, seeds: [], bundles: [], songs: [], playlists: [], artists: [], albums: [], releases: [] });
    }
}
