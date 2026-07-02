// Central in-memory registry + routing for the WebSocket hub.
//
// The hub is a control-plane relay between bot sockets (one per Nifty
// instance) and user sockets (browsers). Player and queue STATE never flows
// through here anymore — the bots write it to the shared database and the
// dashboard reads it back via /api/player and /api/queue. The hub carries:
//   bots -> users : change nudges (player_updated / queue_updated), sessions
//   users -> bots : control actions, session requests
//
// Several bots may be connected at once; routing is by botId (the bot's
// Discord user id), with guild-owner tracking as a legacy fallback for
// clients that don't send one.

export const bots = new Set();               // BotSocket
export const users = new Set();              // UserSocket
export const botsById = new Map();           // botId (string) -> BotSocket

// guildId (string) -> BotSocket that last reported that guild (fallback routing).
export const guildOwners = new Map();

export function registerBot(bot) {
    bots.add(bot);
    if (bot.botId) botsById.set(String(bot.botId), bot);
}

export function unregisterBot(bot) {
    bots.delete(bot);
    if (bot.botId && botsById.get(String(bot.botId)) === bot) {
        botsById.delete(String(bot.botId));
    }
    clearGuildsForBot(bot);
}

export function setGuildOwner(guildId, bot) {
    guildOwners.set(String(guildId), bot);
}

export function clearGuildsForBot(bot) {
    for (const [guildId, owner] of guildOwners) {
        if (owner === bot) guildOwners.delete(guildId);
    }
}

/**
 * Send to every browser currently viewing a given (bot, guild) pair. A missing
 * botId on either side matches everything, so single-bot setups keep working.
 */
export function emitToGuild(botId, guildId, operation, data) {
    const gid = String(guildId);
    const bid = botId ? String(botId) : null;
    for (const user of users) {
        if (user.guildId !== gid) continue;
        if (bid && user.botId && user.botId !== bid) continue;
        user.send(operation, data);
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

export function broadcastToUsers(operation, data) {
    for (const user of users) user.send(operation, data);
}

/**
 * Ask one (freshly connected) bot for the sessions of every browser that is
 * already here, so new bots appear in Connect lists without a manual refresh.
 */
export function requestSessionsFromBot(bot) {
    const seen = new Set();
    for (const user of users) {
        const uid = user.user?.id;
        if (!uid || seen.has(uid)) continue;
        seen.add(uid);
        bot.send("sessions_request", { userId: String(uid) });
    }
}

/**
 * Route a control action to one bot: by botId when the client sent one,
 * falling back to the guild's last-known owner, then to broadcast (bots that
 * aren't addressed simply no-op).
 */
export function routeAction(botId, guildId, data) {
    const byId = botId ? botsById.get(String(botId)) : null;
    if (byId) {
        byId.send("action", data);
        return;
    }
    const owner = guildOwners.get(String(guildId));
    if (owner) {
        owner.send("action", data);
    } else {
        broadcastToBots("action", data);
    }
}

/** Ask every connected bot which sessions a user can control. */
export function requestSessions(userId) {
    broadcastToBots("sessions_request", { userId: String(userId) });
}

export function hasBots() {
    return bots.size > 0;
}
