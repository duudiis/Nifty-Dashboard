import { parse } from "cookie";

import { verifySession } from "../../lib/jwt.js";
import { buildEntityId } from "../../sources/ids.js";

// Resolves an artist NAME to a browsable artist page (Deezer's catalog is the
// authority). Lets any artist label in the UI open an artist page even when
// the underlying track didn't carry an artist id.
// GET /api/artist-lookup?name=...

const cache = new Map();
const TTL = 1000 * 60 * 60;

export default async function handler(req, res) {
    const cookies = parse(req.headers.cookie || "");
    if (!(await verifySession(cookies.session))) {
        return res.status(401).json({ message: "Not authenticated." });
    }

    const name = String(req.query.name || "").trim();
    if (!name) return res.status(400).json({ message: "Missing name." });

    const key = name.toLowerCase();
    const hit = cache.get(key);
    if (hit && Date.now() - hit.ts < TTL) {
        return res.status(200).json(hit.data);
    }

    try {
        const json = await fetch(
            `https://api.deezer.com/search/artist?q=${encodeURIComponent(name)}&limit=1`,
            { headers: { "User-Agent": "Nifty-Dashboard" } }
        ).then((r) => r.json());

        const artist = json?.data?.[0];
        const data = artist?.id
            ? { browseId: buildEntityId("deezer", "artist", artist.id), name: artist.name }
            : { browseId: null };

        cache.set(key, { data, ts: Date.now() });
        return res.status(200).json(data);
    } catch (error) {
        console.error("[Dashboard] Artist lookup failed:", error.message);
        return res.status(200).json({ browseId: null });
    }
}
