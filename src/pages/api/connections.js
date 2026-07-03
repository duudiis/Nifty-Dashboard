import { parse } from "cookie";

import { verifySession } from "../../lib/jwt.js";

// Which platform integrations this deployment has configured — powers the
// settings modal's Connections section. Booleans only; never the secrets.
export default async function handler(req, res) {
    const cookies = parse(req.headers.cookie || "");
    if (!(await verifySession(cookies.session))) {
        return res.status(401).json({ message: "Not authenticated." });
    }

    return res.status(200).json({
        deezer: true,   // key-less public API
        youtube: true,  // InnerTube needs no credentials
        spotify: !!(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET),
        tidal: !!process.env.TIDAL_TOKEN
    });
}
