import { parse } from "cookie";

import { verifySession } from "../../lib/jwt.js";
import InnerTube from "../../innertube/index.js";

const innerTube = new InnerTube();

// Each search now fans out to 5 type-filtered requests, so cache results
// briefly (shared across users) to avoid re-hitting YouTube for repeat queries.
const cache = new Map();
const TTL = 1000 * 60 * 5; // 5 minutes

export default async function handler(req, res) {
    // Search is only for logged-in users.
    const cookies = parse(req.headers.cookie || "");
    const user = await verifySession(cookies.session);
    if (!user) {
        return res.status(401).json({ message: "Not authenticated." });
    }

    const query = (req.query.query || req.body?.query || "").trim();
    if (!query) {
        return res.status(400).json({ message: "Missing query.", code: "MISSING_QUERY" });
    }

    const key = query.toLowerCase();
    const hit = cache.get(key);
    if (hit && Date.now() - hit.ts < TTL) {
        return res.status(200).json(hit.data);
    }

    try {
        const { sections } = await innerTube.search(query);
        const data = { sections };
        cache.set(key, { data, ts: Date.now() });
        return res.status(200).json(data);
    } catch (error) {
        console.error("[Dashboard] Search failed:", error);
        return res.status(502).json({ message: "Search failed.", code: "SEARCH_ERROR" });
    }
}
