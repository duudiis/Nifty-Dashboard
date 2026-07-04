import { parse } from "cookie";

import { verifySession } from "../../../lib/jwt.js";
import { listProviders } from "../../../connect/providers.js";
import { listConnections, disconnectProvider, importLikedFromProvider } from "../../../lib/connections.js";

// Connection status + management for the settings Connections tab.
//
//   GET  /api/connect                 -> { providers, connections }
//   POST /api/connect { action: "disconnect" | "sync", provider }

export default async function handler(req, res) {
    const cookies = parse(req.headers.cookie || "");
    const user = await verifySession(cookies.session);
    if (!user) return res.status(401).json({ message: "Not authenticated." });

    try {
        if (req.method === "GET") {
            const [connections] = await Promise.all([listConnections(user.id)]);
            res.setHeader("Cache-Control", "no-store");
            return res.status(200).json({ providers: listProviders(), connections });
        }

        const { action, provider } = req.body || {};

        if (action === "disconnect") {
            const { removed } = await disconnectProvider(user.id, provider);
            return res.status(200).json({ ok: true, removed });
        }

        if (action === "sync") {
            const result = await importLikedFromProvider(user.id, provider);
            return res.status(200).json({ ok: true, ...result });
        }

        return res.status(400).json({ message: "Unknown action." });
    } catch (error) {
        console.error("[Dashboard] /api/connect failed:", error.message);
        return res.status(500).json({ message: error.message || "Failed." });
    }
}
