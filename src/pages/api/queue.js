import { parse } from "cookie";

import { verifySession } from "../../lib/jwt.js";
import { getQueue } from "../../lib/db.js";

/**
 * GET /api/queue?botId=...&guildId=...
 *
 * A guild's full queue, read straight from the shared database (the bot is
 * the writer). Shape mirrors the old WebSocket payload: { position, tracks }.
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
        const queue = await getQueue(botId, guildId);
        res.setHeader("Cache-Control", "no-store");
        return res.status(200).json(queue);
    } catch (error) {
        console.error("[Dashboard] /api/queue failed:", error.message);
        return res.status(500).json({ message: "Database unavailable." });
    }

}
