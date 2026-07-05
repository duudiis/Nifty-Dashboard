import {
    registerBot,
    unregisterBot,
    setGuildOwner,
    emitToGuild,
    emitToUser,
    broadcastToUsers,
    requestSessionsFromBot
} from "./registry.js";

/**
 * A connected Nifty bot instance. State lives in the shared database; over the
 * socket the bot only sends session info and lightweight change nudges, which
 * are fanned out to the relevant browsers so they re-read the database.
 *
 * Inbound bot envelopes:
 *   { operation: "sessions",       data: { userId, sessions } }
 *   { operation: "player_updated", botId, guildId }              (legacy nudge)
 *   { operation: "queue_updated",  botId, guildId }              (legacy nudge)
 *   { operation: "p_full",  botId, guildId, data: {...} }        (player snapshot)
 *   { operation: "q_add",   botId, guildId, data: { at, tracks, cursor } }
 *   { operation: "q_remove",botId, guildId, data: { at, count, cursor } }
 *   { operation: "q_move",  botId, guildId, data: { from, to, cursor } }
 *   { operation: "q_clear", botId, guildId, data: {} }
 *   { operation: "q_resync",botId, guildId, data: {} }
 *
 * The p_*/q_* deltas carry the actual change (never full state) and are fanned
 * out verbatim to the guild's browsers, which apply them to local state — a
 * dashboard far from the database never refetches per change. The legacy
 * refresh_player / refresh_queue payload pushes from older bot builds are
 * translated into nudges (their payloads are ignored).
 */
export default class BotSocket {

    constructor(socket, botName, botId) {
        this.socket = socket;
        this.botName = botName || "Nifty";
        this.botId = botId ? String(botId) : null;

        registerBot(this);
        this.socket.on("close", () => this.onClose());

        // Browsers already connected should learn about this bot right away.
        requestSessionsFromBot(this);
    }

    send(operation, data = {}) {
        try {
            if (this.socket.readyState === this.socket.OPEN) {
                this.socket.send(JSON.stringify({ operation, data }));
            }
        } catch { /* ignore transport errors */ }
    }

    nudge(operation, guildId) {
        if (!guildId) return;
        setGuildOwner(guildId, this);
        emitToGuild(this.botId, guildId, operation, {
            botId: this.botId,
            guildId: String(guildId)
        });
    }

    // Fans a data-carrying change delta out to the guild's browsers verbatim.
    relayDelta(operation, message) {
        const guildId = message.guildId;
        if (!guildId) return;
        setGuildOwner(guildId, this);
        emitToGuild(this.botId, guildId, operation, {
            botId: this.botId,
            guildId: String(guildId),
            ...(message.data || {})
        });
    }

    onMessage(message) {
        if (!message?.operation) return;

        switch (message.operation) {

            case "sessions": {
                const { userId, sessions } = message.data || {};
                if (!userId) return;

                // Remember which bot owns each guild, for fallback action routing.
                for (const session of sessions || []) {
                    if (session?.guildId) setGuildOwner(session.guildId, this);
                }

                emitToUser(userId, "sessions", {
                    botId: this.botId,
                    botName: this.botName,
                    sessions: sessions || []
                });
                return;
            }

            case "player_updated":
                return this.nudge("player_updated", message.guildId);

            case "queue_updated":
                return this.nudge("queue_updated", message.guildId);

            // Granular, data-carrying deltas — relayed straight to the browsers.
            case "p_full":
            case "q_add":
            case "q_remove":
            case "q_move":
            case "q_clear":
            case "q_resync":
                return this.relayDelta(message.operation, message);

            // Older bot builds push full state; treat them as nudges.
            case "refresh_player":
                return this.nudge("player_updated", message.guildId);

            case "refresh_queue":
                return this.nudge("queue_updated", message.guildId || message.data?.guildId);

            default:
                return;
        }
    }

    onClose() {
        unregisterBot(this);
        // Its sessions are gone — tell every browser so none keep ghosts.
        broadcastToUsers("bot_disconnected", { botId: this.botId, botName: this.botName });
    }
}
