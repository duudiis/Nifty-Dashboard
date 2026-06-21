import { parse } from "cookie";

import { verifySession } from "../../lib/jwt.js";
import InnerTube from "../../innertube/index.js";

const innerTube = new InnerTube();

// In-process cache: album/playlist/artist pages change rarely, so one lookup
// per id serves the whole user base for a while.
const cache = new Map();
const TTL = 1000 * 60 * 30; // 30 minutes

export default async function handler(req, res) {
    const cookies = parse(req.headers.cookie || "");
    if (!(await verifySession(cookies.session))) {
        return res.status(401).json({ message: "Not authenticated." });
    }

    const id = (req.query.id || "").trim();
    if (!id) {
        return res.status(400).json({ message: "Missing id." });
    }

    const hit = cache.get(id);
    if (hit && Date.now() - hit.ts < TTL) {
        return res.status(200).json(hit.data);
    }

    try {
        const data = await innerTube.browse(id);
        cache.set(id, { data, ts: Date.now() });
        return res.status(200).json(data);
    } catch (error) {
        console.error("[Dashboard] Browse failed:", error);
        return res.status(502).json({ message: "Browse failed." });
    }
}
