import { parse } from "cookie";

import { verifySession } from "../../lib/jwt.js";
import InnerTube from "../../innertube/index.js";

const innerTube = new InnerTube();

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

    try {
        const results = await innerTube.search(query);
        return res.status(200).json({ results });
    } catch (error) {
        console.error("[Dashboard] Search failed:", error);
        return res.status(502).json({ message: "Search failed.", code: "SEARCH_ERROR" });
    }
}
