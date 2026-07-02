import { parse } from "cookie";

import { verifySession } from "../../lib/jwt.js";
import { ensureUser, getRecentItems, recordQueuedCollection } from "../../lib/db.js";
import { parseEntityId } from "../../sources/ids.js";
import { externalUrl } from "../../sources/links.js";

// The user's recently queued items, and the write-side for collection-level
// enqueues (tracks are recorded by the bot in queue_history already).
//
//   GET  /api/recent                 -> { items: [...] }  (search-item shape)
//   POST /api/recent { browseId, kind, title, subtitle, artwork, url }

export default async function handler(req, res) {

    const cookies = parse(req.headers.cookie || "");
    const user = await verifySession(cookies.session);
    if (!user) {
        return res.status(401).json({ message: "Not authenticated." });
    }

    try {

        if (req.method === "POST") {
            const { browseId, kind, title, subtitle, artwork, url } = req.body || {};
            const parsed = parseEntityId(browseId);
            if (!parsed || !["album", "playlist", "artist"].includes(kind)) {
                return res.status(400).json({ message: "Invalid entity." });
            }

            await ensureUser(user);
            await recordQueuedCollection(user.id, {
                kind,
                source: parsed.source,
                sourceUrl: url || externalUrl(parsed.source, parsed.kind, parsed.id) || browseId,
                browseRef: browseId,
                name: title,
                subtitle,
                artwork
            });
            return res.status(200).json({ ok: true });
        }

        const items = await getRecentItems(user.id, 10);
        res.setHeader("Cache-Control", "no-store");
        return res.status(200).json({ items });

    } catch (error) {
        console.error("[Dashboard] /api/recent failed:", error.message);
        return res.status(500).json({ message: "Database unavailable." });
    }

}
