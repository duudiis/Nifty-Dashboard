import { parse } from "cookie";

import { verifySession } from "../../lib/jwt.js";
import { getPlayerState } from "../../lib/db.js";

/**
 * GET /api/player?botId=...&guildId=...
 *
 * The live player state for a guild, read straight from the shared database
 * (the bot is the writer). Returns {} when nothing is loaded so the client
 * can clear its player, mirroring the old WebSocket payload shape.
 */
export default async function handler(req, res) {

    const cookies = parse(req.headers.cookie || "");
    const user = await verifySession(cookies.session);
    if (!user) {
        return res.status(401).json({ message: "Not authenticated." });
    }

    const { botId, guildId } = req.query;
    if (!/^\d+$/.test(botId || "") || !/^\d+$/.test(guildId || "")) {
        return res.status(400).json({ message: "botId and guildId are required." });
    }

    try {
        const player = await getPlayerState(botId, guildId);
        res.setHeader("Cache-Control", "no-store");
        return res.status(200).json(player || {});
    } catch (error) {
        console.error("[Dashboard] /api/player failed:", error.message);
        return res.status(500).json({ message: "Database unavailable." });
    }

}
