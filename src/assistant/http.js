// The assistant API: three HTTP endpoints for a trusted service (a Discord
// voice assistant, not a browser) to do what a logged-in dashboard user can —
// read a server's player and queue, send the same control actions, and search.
//
//   GET  /assistant/state?guildId=<id>[&botId=<id>]
//   POST /assistant/action    { guildId, userId, action, botId?, ...args }
//   GET  /assistant/search?query=<text>
//
// Authenticated with a shared secret (Authorization: Bearer <ASSISTANT_TOKEN>);
// with no token configured the whole API answers 404.
//
// It is served by the custom server, never as a Next API route: actions need
// the hub's live bot sockets, and a Next route gets its own (empty) copy of
// the registry module.
//
// This file has no dependencies of its own — everything it talks to is handed
// in (see ./index.js), which also makes it testable without a database.

import { createHash, timingSafeEqual } from "crypto";

export const ASSISTANT_PREFIX = "/assistant/";
const MAX_BODY_BYTES = 16 * 1024;
const SNOWFLAKE = /^\d+$/;
const EMPTY_QUEUE = { position: 0, tracks: [], autoplay: { enabled: false, tracks: [] } };

// An error with an HTTP status: thrown anywhere below, answered as JSON.
class Reply extends Error {
    constructor(status, message) {
        super(message);
        this.status = status;
    }
}

// Ids are Discord snowflakes — too large for a JSON number, so only numeric
// strings are accepted (a number would already have lost its last digits).
const isId = (value) => typeof value === "string" && SNOWFLAKE.test(value);

// Hashing first gives timingSafeEqual the equal lengths it needs.
const digest = (value) => createHash("sha256").update(String(value)).digest();
const sameSecret = (given, expected) => timingSafeEqual(digest(given), digest(expected));

function send(res, status, body) {
    res.writeHead(status, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-store" });
    res.end(JSON.stringify(body));
}

function readJson(req) {
    return new Promise((resolve, reject) => {
        const chunks = [];
        let size = 0;
        let rejected = false;
        req.on("data", (chunk) => {
            if (rejected) return;
            size += chunk.length;
            if (size > MAX_BODY_BYTES) {
                rejected = true;
                reject(new Reply(413, "Body too large."));
                return;
            }
            chunks.push(chunk);
        });
        req.on("error", () => reject(new Reply(400, "Invalid body.")));
        req.on("end", () => {
            if (rejected) return;
            try {
                const body = JSON.parse(Buffer.concat(chunks).toString("utf8"));
                if (!body || typeof body !== "object" || Array.isArray(body)) throw new Error("not an object");
                resolve(body);
            } catch {
                reject(new Reply(400, "Invalid JSON."));
            }
        });
    });
}

/**
 * @param {object}   deps
 * @param {string}   deps.token              the shared secret; empty disables the API
 * @param {object}   deps.registry           the hub's { botsById, guildOwners, routeAction }
 * @param {function} deps.getPlayerState     (botId, guildId) -> player | null
 * @param {function} deps.getQueue           (botId, guildId) -> queue
 * @param {function} deps.listGuildPlayers   (guildId) -> [{ botId, trackLoaded }]
 * @param {function} deps.search             (query) -> { sections, source }
 */
export function createAssistantHandler({ token, registry, getPlayerState, getQueue, listGuildPlayers, search }) {

    const isConnected = (botId) => registry.botsById.has(String(botId));

    // Which bot serves a guild, when the caller didn't say: the connected bot
    // that last reported it; else a bot with a player row for it (one with a
    // track loaded first, then one that is connected); else the only bot here.
    async function findBot(guildId) {
        const owner = registry.guildOwners.get(String(guildId));
        if (owner?.botId) return String(owner.botId);

        const rank = (row) => (row.trackLoaded ? 2 : 0) + (isConnected(row.botId) ? 1 : 0);
        const [best] = (await listGuildPlayers(guildId)).sort((a, b) => rank(b) - rank(a));
        if (best) return String(best.botId);

        if (registry.botsById.size === 1) return [...registry.botsById.keys()][0];
        return null;
    }

    async function state(url) {
        const guildId = url.searchParams.get("guildId") || "";
        const givenBot = url.searchParams.get("botId");
        if (!isId(guildId)) throw new Reply(400, "guildId is required.");
        if (givenBot !== null && !isId(givenBot)) throw new Reply(400, "botId must be numeric.");

        const botId = givenBot || await findBot(guildId);
        if (!botId) {
            return { ok: true, connected: false, botId: null, botName: null, player: null, queue: EMPTY_QUEUE };
        }

        const [player, queue] = await Promise.all([getPlayerState(botId, guildId), getQueue(botId, guildId)]);
        return {
            ok: true,
            connected: isConnected(botId),
            botId,
            botName: registry.botsById.get(botId)?.botName ?? null,
            player,
            queue
        };
    }

    async function action(req) {
        const body = await readJson(req);
        const { guildId, userId, action: name } = body;
        if (!isId(guildId) || !isId(userId)) throw new Reply(400, "guildId and userId are required.");
        if (typeof name !== "string" || !name) throw new Reply(400, "action is required.");
        if (body.botId != null && !isId(body.botId)) throw new Reply(400, "botId must be numeric.");

        // A bot acts on any action that doesn't name another bot, so with
        // several connected an unaddressed one would run on each of them.
        // Address it whenever the guild's bot can be worked out; if the lookup
        // fails, route it unaddressed exactly as a browser's would be.
        const botId = body.botId || await findBot(guildId).catch(() => null);

        // Forwarded exactly as UserSocket forwards a browser's action — except
        // that the user is named by the (trusted) caller, not by a session.
        const delivered = registry.routeAction(botId, guildId, {
            ...body,
            botId: botId ? String(botId) : undefined,
            guildId,
            action: name,
            userId
        });
        return { ok: true, delivered };
    }

    async function searchFor(url) {
        const query = (url.searchParams.get("query") || "").trim();
        if (!query) throw new Reply(400, "Missing query.");
        try {
            return await search(query);
        } catch (error) {
            console.error("[Assistant] Search failed:", error);
            throw new Reply(502, "Search failed.");
        }
    }

    const ROUTES = {
        state: { method: "GET", run: (req, url) => state(url) },
        action: { method: "POST", run: (req) => action(req) },
        search: { method: "GET", run: (req, url) => searchFor(url) }
    };

    return async function handleAssistant(req, res) {
        try {
            if (!token) throw new Reply(404, "Not found.");

            const [scheme, given] = (req.headers.authorization || "").split(" ");
            if (scheme?.toLowerCase() !== "bearer" || !given || !sameSecret(given, token)) {
                throw new Reply(401, "Unauthorized.");
            }

            const url = new URL(req.url, "http://assistant.local");
            const route = ROUTES[url.pathname.slice(ASSISTANT_PREFIX.length)];
            if (!route) throw new Reply(404, "Not found.");
            if (req.method !== route.method) throw new Reply(405, "Method not allowed.");

            send(res, 200, await route.run(req, url));
        } catch (error) {
            if (error instanceof Reply) return send(res, error.status, { message: error.message });
            console.error("[Assistant] Request failed:", error);
            send(res, 500, { message: "Internal error." });
        }
    };
}
