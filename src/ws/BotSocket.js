import {
    bots,
    setGuildOwner,
    clearGuildsForBot,
    emitToGuild,
    emitToUser
} from "./registry.js";

/**
 * A connected Nifty bot instance. Receives state pushes and session info from
 * the bot and fans them out to the relevant browsers; the bot is the source of
 * truth for everything.
 *
 * Inbound bot envelopes:
 *   { operation: "sessions",       data: { userId, sessions } }
 *   { operation: "refresh_player", guildId, data: { ...player... } }
 *   { operation: "refresh_queue",  guildId, data: { guildId, position, tracks } }
 */
export default class BotSocket {

    constructor(socket, botName) {
        this.socket = socket;
        this.botName = botName || "Nifty";

        bots.add(this);
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

            case "sessions": {
                const { userId, sessions } = message.data || {};
                if (!userId) return;

                // Remember which bot owns each guild, for later action routing.
                for (const session of sessions || []) {
                    if (session?.guildId) setGuildOwner(session.guildId, this);
                }

                emitToUser(userId, "sessions", {
                    botName: this.botName,
                    sessions: sessions || []
                });
                return;
            }

            case "refresh_player": {
                const guildId = message.guildId;
                if (!guildId) return;
                setGuildOwner(guildId, this);
                emitToGuild(guildId, "player", message.data || {});
                return;
            }

            case "refresh_queue": {
                const guildId = message.guildId || message.data?.guildId;
                if (!guildId) return;
                setGuildOwner(guildId, this);
                emitToGuild(guildId, "queue", message.data || {});
                return;
            }

            default:
                return;
        }
    }

    onClose() {
        bots.delete(this);
        clearGuildsForBot(this);
    }
}
