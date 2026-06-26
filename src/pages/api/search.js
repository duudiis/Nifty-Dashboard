import { parse } from "cookie";

import { verifySession } from "../../lib/jwt.js";
import { getActiveSource } from "../../sources/index.js";

const source = getActiveSource();

// Results are cached briefly (shared across users) to avoid re-hitting the
// upstream source for repeat queries. Keyed by source so swapping the active
// source never serves stale cross-source hits.
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

    const key = `${source.id}:${query.toLowerCase()}`;
    const hit = cache.get(key);
    if (hit && Date.now() - hit.ts < TTL) {
        return res.status(200).json(hit.data);
    }

    try {
        const { sections } = await source.search(query);
        const data = { sections, source: source.id };
        cache.set(key, { data, ts: Date.now() });
        return res.status(200).json(data);
    } catch (error) {
        console.error("[Dashboard] Search failed:", error);
        return res.status(502).json({ message: "Search failed.", code: "SEARCH_ERROR" });
    }
}
