import { parse } from "cookie";

import { verifySession } from "../../../lib/jwt.js";
import { getProvider, listProviders } from "../../../connect/providers.js";
import { listConnections, getConnection, disconnectProvider } from "../../../lib/connections.js";
import {
    startSync, getSyncState, syncStatesFor, isSyncRunning, manualSyncAllowedAt, clearSync
} from "../../../connect/syncJobs.js";
import { AUTO_SYNC_AFTER_MS } from "../../../connect/syncPolicy.js";

// Connection status + management for the settings Connections tab.
//
//   GET  /api/connect
//     -> { providers, connections, autoSync: { everyMs }, now }
//        each connection carries `sync` (the job state, see connect/syncJobs.js)
//        and `nextSyncAt` (ISO; when a manual sync is allowed again, or null)
//   GET  /api/connect?view=progress
//     -> { sync: { <provider>: state } }   memory only — cheap to poll while a
//        sync is running
//   POST /api/connect { action: "sync", provider, full? }
//     -> 202 { ok, sync }                  started, or already running
//        404 not connected · 429 { message, nextSyncAt } cooling down
//   POST /api/connect { action: "disconnect", provider }
//     -> 200 { ok, removed } · 409 while that connection is syncing

const iso = (ms) => (ms ? new Date(ms).toISOString() : null);

function waitText(ms) {
    const seconds = Math.ceil(ms / 1000);
    return seconds >= 60 ? `${Math.floor(seconds / 60)}m ${seconds % 60}s` : `${seconds}s`;
}

export default async function handler(req, res) {
    const cookies = parse(req.headers.cookie || "");
    const user = await verifySession(cookies.session);
    if (!user) return res.status(401).json({ message: "Not authenticated." });

    try {
        if (req.method === "GET") {
            res.setHeader("Cache-Control", "no-store");
            if (req.query.view === "progress") {
                return res.status(200).json({ sync: syncStatesFor(user.id) });
            }

            const connections = (await listConnections(user.id)).map((connection) => ({
                ...connection,
                sync: getSyncState(user.id, connection.provider),
                nextSyncAt: iso(manualSyncAllowedAt(user.id, connection.provider, connection.lastSyncedAt))
            }));
            return res.status(200).json({
                providers: listProviders(),
                connections,
                autoSync: { everyMs: AUTO_SYNC_AFTER_MS },
                now: new Date().toISOString()
            });
        }

        if (req.method !== "POST") return res.status(405).json({ message: "Method not allowed." });

        const { action, provider, full } = req.body || {};
        if (!getProvider(provider)) return res.status(400).json({ message: "Unknown provider." });

        if (action === "disconnect") {
            if (isSyncRunning(user.id, provider)) {
                return res.status(409).json({ message: "A sync is running — try again when it finishes." });
            }
            const { removed } = await disconnectProvider(user.id, provider);
            clearSync(user.id, provider);
            return res.status(200).json({ ok: true, removed });
        }

        if (action === "sync") {
            const connection = await getConnection(user.id, provider);
            if (!connection) return res.status(404).json({ message: "Not connected." });

            if (!isSyncRunning(user.id, provider)) {
                const allowedAt = manualSyncAllowedAt(user.id, provider, connection.lastSyncedAt);
                const wait = allowedAt ? allowedAt - Date.now() : 0;
                if (wait > 0) {
                    res.setHeader("Retry-After", String(Math.ceil(wait / 1000)));
                    return res.status(429).json({
                        message: `Synced moments ago — try again in ${waitText(wait)}.`,
                        nextSyncAt: iso(allowedAt)
                    });
                }
                startSync(user.id, provider, { trigger: "manual", full: full === true });
            }
            return res.status(202).json({ ok: true, sync: getSyncState(user.id, provider) });
        }

        return res.status(400).json({ message: "Unknown action." });
    } catch (error) {
        console.error("[Dashboard] /api/connect failed:", error.message);
        return res.status(500).json({ message: error.message || "Failed." });
    }
}
