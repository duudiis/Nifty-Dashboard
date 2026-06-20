// Central in-memory registry + routing for the WebSocket hub.
//
// The dashboard owns no database. It is a stateless relay between two kinds of
// peers: bot sockets (one per Nifty instance) and user sockets (browsers).
// Several bots may be connected at once, so every guild is routed to whichever
// bot reported it last.

export const bots = new Set();   // BotSocket
export const users = new Set();  // UserSocket

// guildId (string) -> BotSocket that currently owns that guild's player.
export const guildOwners = new Map();

export function setGuildOwner(guildId, bot) {
    guildOwners.set(String(guildId), bot);
}

export function clearGuildsForBot(bot) {
    for (const [guildId, owner] of guildOwners) {
        if (owner === bot) guildOwners.delete(guildId);
    }
}

/** Send to every browser currently viewing a given guild. */
export function emitToGuild(guildId, operation, data) {
    const gid = String(guildId);
    for (const user of users) {
        if (user.guildId === gid) user.send(operation, data);
    }
}

/** Send to every browser logged in as a given Discord user. */
export function emitToUser(userId, operation, data) {
    const uid = String(userId);
    for (const user of users) {
        if (user.user?.id === uid) user.send(operation, data);
    }
}

export function broadcastToBots(operation, data) {
    for (const bot of bots) bot.send(operation, data);
}

/** Route a control action to the bot that owns the guild (fallback: broadcast). */
export function routeAction(guildId, data) {
    const owner = guildOwners.get(String(guildId));
    if (owner) {
        owner.send("action", data);
    } else {
        // Unknown owner: broadcast. Bots that don't own the guild simply no-op.
        broadcastToBots("action", data);
    }
}

/** Ask every connected bot which sessions a user can control. */
export function requestSessions(userId) {
    broadcastToBots("sessions_request", { userId: String(userId) });
}

/** Ask the owning bot to push fresh player + queue for a guild. */
export function subscribeToGuild(guildId) {
    const owner = guildOwners.get(String(guildId));
    if (owner) {
        owner.send("subscribe", { guildId: String(guildId) });
    } else {
        broadcastToBots("subscribe", { guildId: String(guildId) });
    }
}

export function hasBots() {
    return bots.size > 0;
}
