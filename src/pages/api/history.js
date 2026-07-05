import { parse } from "cookie";

import { verifySession } from "../../lib/jwt.js";
import { getListeningSessions, getSessionPlays } from "../../lib/db.js";

// The signed-in user's full listening history, read from the bot's nested log
// (queue_sessions → track_plays → listening_segments).
//
//   GET /api/history                        -> { sessions: [...], nextCursor }
//   GET /api/history?before=<cursor>        -> next page of sessions
//   GET /api/history?sessionId=<id>         -> { plays: [...] } for one session
//
// Sessions are keyset-paginated (newest first); a session's plays are loaded
// lazily when its card is expanded, so the page never fetches everything.

export default async function handler(req, res) {

    const cookies = parse(req.headers.cookie || "");
    const user = await verifySession(cookies.session);
    if (!user) {
        return res.status(401).json({ message: "Not authenticated." });
    }

    try {
        res.setHeader("Cache-Control", "no-store");

        const sessionId = req.query.sessionId;
        if (sessionId != null) {
            if (!/^\d+$/.test(String(sessionId))) {
                return res.status(400).json({ message: "Invalid session id." });
            }
            const plays = await getSessionPlays(user.id, String(sessionId));
            return res.status(200).json({ plays });
        }

        const before = req.query.before ? String(req.query.before) : null;
        const { sessions, nextCursor } = await getListeningSessions(user.id, { cursor: before, limit: 12 });
        return res.status(200).json({ sessions, nextCursor });

    } catch (error) {
        console.error("[Dashboard] /api/history failed:", error.message);
        return res.status(500).json({ message: "Database unavailable." });
    }

}
