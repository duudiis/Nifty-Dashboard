import { parse } from "cookie";

import { verifySession } from "../../lib/jwt.js";
import { api, playlistItem, albumItem } from "../../sources/deezer/index.js";

// Genre browsing.
//
//   GET /api/genres            -> { genres: [{ id, name, artwork }] }
//   GET /api/genres?id=<id>    -> { id, name, playlists, albums }
//
// Playlists and albums only. Deezer's two artist endpoints — /genre/{id}/artists
// and /chart/{id}/artists — ignore the genre outright: verified live, Metal,
// Jazz and Hip-Hop all return the same four names off the local pop chart. The
// playlist and album shelves do respect it (Metallica and Mastodon under Metal,
// Sinatra and João Gilberto under Jazz), so those are what this serves.
//
// The names are ours, not Deezer's. Deezer localises by request IP and this
// host geolocates to Brazil, so its own list comes back as "Todos" / "Música
// Religiosa" and, worse, reorders itself between deploys. The ids are stable
// and global, so pinning our own ordered set of them gives a shelf that reads
// the same everywhere and never surprises us.
const GENRES = [
    { id: 132, name: "Pop" },
    { id: 116, name: "Hip-Hop" },
    { id: 152, name: "Rock" },
    { id: 113, name: "Dance" },
    { id: 106, name: "Electronic" },
    { id: 165, name: "R&B" },
    { id: 85, name: "Alternative" },
    { id: 464, name: "Metal" },
    { id: 129, name: "Jazz" },
    { id: 169, name: "Soul & Funk" },
    { id: 144, name: "Reggae" },
    { id: 98, name: "Classical" },
    { id: 173, name: "Film & Games" },
    { id: 466, name: "Folk" },
    { id: 122, name: "Reggaeton" },
    { id: 153, name: "Blues" }
];

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
        const [playlists, albums] = await Promise.all([
            call(`/chart/${genre.id}/playlists?limit=12`),
            call(`/chart/${genre.id}/albums?limit=12`)
        ]);

        const data = {
            id: String(genre.id),
            name: genre.name,
            playlists: (playlists?.data || []).map(playlistItem),
            albums: (albums?.data || []).map(albumItem)
        };

        cache.set(raw, { data, ts: Date.now() });
        return res.status(200).json(data);
    } catch (error) {
        console.error("[Dashboard] /api/genres failed:", error.message);
        return res.status(200).json({ id: raw, name: genre.name, playlists: [], albums: [] });
    }
}
