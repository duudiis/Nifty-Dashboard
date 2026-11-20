import { parse } from "cookie";

import { verifySession } from "../../lib/jwt.js";
import { api, track, albumItem } from "../../sources/deezer/index.js";
import { GENRES } from "../../lib/genres.js";

// Genre browsing.
//
//   GET /api/genres            -> { genres: [{ id, name, artwork }] }
//   GET /api/genres?id=<id>    -> { id, name, songs, albums }
//
// Tracks and albums only. Deezer's two artist endpoints — /genre/{id}/artists
// and /chart/{id}/artists — ignore the genre outright: verified live, Metal,
// Jazz and Hip-Hop all return the same four names off the local pop chart. The
// track and album charts respect the genre. Localized editorial playlists
// are intentionally excluded: a genre opens actual music, not a playlist
// selected and named for the server's geographic location.

// A genre's shelves change on Deezer's schedule, not ours.
const TTL = 1000 * 60 * 60 * 6;
const cache = new Map();

export default async function handler(req, res) {

    const cookies = parse(req.headers.cookie || "");
    if (!(await verifySession(cookies.session))) {
        return res.status(401).json({ message: "Not authenticated." });
    }

    res.setHeader("Cache-Control", "no-store");

    const raw = String(req.query.id || "").trim();
    if (!raw) {
        return res.status(200).json({ genres: GENRES.map((g) => ({ ...g, id: String(g.id) })) });
    }

    const genre = GENRES.find((g) => String(g.id) === raw);
    if (!genre) return res.status(400).json({ message: "Unknown genre." });

    const hit = cache.get(raw);
    if (hit && Date.now() - hit.ts < TTL) return res.status(200).json(hit.data);

    try {
        const call = (path) => api(path).catch(() => null);
        const [songs, albums] = await Promise.all([
            call(`/chart/${genre.id}/tracks?limit=12`),
            call(`/chart/${genre.id}/albums?limit=12`)
        ]);

        const data = {
            id: String(genre.id),
            name: genre.name,
            songs: (songs?.data || []).map((song) => ({ kind: "song", ...track(song) })),
            albums: (albums?.data || []).map(albumItem)
        };

        cache.set(raw, { data, ts: Date.now() });
        return res.status(200).json(data);
    } catch (error) {
        console.error("[Dashboard] /api/genres failed:", error.message);
        return res.status(200).json({ id: raw, name: genre.name, songs: [], albums: [] });
    }
}
