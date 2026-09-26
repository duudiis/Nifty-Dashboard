import { parse } from "cookie";

import { verifySession } from "../../lib/jwt.js";
import { lookupArtist } from "../../lib/artistLookup.js";

// Resolves an artist NAME to a browsable artist page, so any artist label in
// the UI can open one even when the underlying track carried no artist id.
// Thin wrapper over lib/artistLookup.js, so this and the home screen's
// recommendations share one cache and one match guard.
//
// GET /api/artist-lookup?name=...
//
// Lenient by default: clicking an artist name should land somewhere plausible.
// The home screen asks for a strict match instead, because it captions its
// recommendations with the seed and must not be confidently wrong.

export default async function handler(req, res) {
    const cookies = parse(req.headers.cookie || "");
    if (!(await verifySession(cookies.session))) {
        return res.status(401).json({ message: "Not authenticated." });
    }

    const name = String(req.query.name || "").trim();
    if (!name) return res.status(400).json({ message: "Missing name." });

    const { browseId, name: resolved } = await lookupArtist(name, { strict: false });
    return res.status(200).json({ browseId, name: resolved });
}
