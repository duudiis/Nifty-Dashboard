import {
    users,
    requestSessions,
    routeAction,
    hasBots
} from "./registry.js";

/**
 * A connected browser. Authenticated via the dashboard's own JWT session, so we
 * always know which Discord user it is and can inject that id server-side (the
 * browser can never spoof who queued a track).
 *
 * The browser reads player/queue state from the database via the HTTP API;
 * over the socket it only subscribes to nudges and sends control actions.
 *
 * Inbound user envelopes:
 *   { operation: "sessions_request" }
 *   { operation: "subscribe",   data: { botId, guildId } }
 *   { operation: "unsubscribe" }
 *   { operation: "action",      data: { botId, guildId, action, ...args } }
 */
export default class UserSocket {

    constructor(socket, user) {
        this.socket = socket;
        this.user = user;     // { id, username, avatar_url }
        this.guildId = null;  // currently selected guild
        this.botId = null;    // bot instance serving that guild

        users.add(this);
        this.socket.on("close", () => this.onClose());
    }

    send(operation, data = {}) {
        try {
            if (this.socket.readyState === this.socket.OPEN) {
                this.socket.send(JSON.stringify({ operation, data }));
            }
        } catch { /* ignore transport errors */ }
    }

    onMessage(message) {
        if (!message?.operation) return;

        switch (message.operation) {

            case "sessions_request": {
                // If no bots are online, tell the client immediately so it can
                // render an empty state instead of spinning forever.
                if (!hasBots()) {
                    this.send("sessions", { botId: null, botName: null, sessions: [] });
                    return;
                }
                requestSessions(this.user.id);
                return;
            }

            case "subscribe": {
                const guildId = message.data?.guildId;
                if (!guildId) return;
                this.guildId = String(guildId);
                this.botId = message.data?.botId ? String(message.data.botId) : null;
                return;
            }

            case "unsubscribe": {
                this.guildId = null;
                this.botId = null;
                return;
            }

            case "action": {
                const guildId = message.data?.guildId;
                const action = message.data?.action;
                if (!guildId || !action) return;

                const botId = message.data?.botId || this.botId;

                // Inject the authenticated user id (used by "play" for attribution).
                routeAction(botId, guildId, {
                    ...message.data,
                    botId: botId ? String(botId) : undefined,
                    guildId: String(guildId),
                    action,
                    userId: this.user.id
                });
                return;
            }

            default:
                return;
        }
    }

    onClose() {
        users.delete(this);
    }
}
