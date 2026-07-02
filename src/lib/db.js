import pg from "pg";

// The shared Nifty PostgreSQL database — the source of truth for player and
// queue state (the bot writes, we read). Connection details come from
// DATABASE_URL (internal docker network, no TLS needed).
//
// The pool survives dev hot-reloads via globalThis so we never leak clients.

const globalForDb = globalThis;

export const db =
    globalForDb.__niftyDbPool ??
    new pg.Pool({
        connectionString: process.env.DATABASE_URL,
        max: 5,
        idleTimeoutMillis: 30_000,
        connectionTimeoutMillis: 5_000
    });

if (!globalForDb.__niftyDbPool) globalForDb.__niftyDbPool = db;

/**
 * Splits a raw "Artist - Title" string the same way the bot's dashboard
 * payloads used to, so titles keep rendering as title + artist.
 */
function splitTitle(title, artist) {
    if (title && title.includes(" - ")) {
        const [left, right] = title.split(/-(.+)/, 2).map((s) => s.trim());
        return { title: right || title, artist: left || artist };
    }
    return { title, artist };
}

function trackRow(row) {
    const { title, artist } = splitTitle(row.title, row.artist);
    return {
        title,
        artist,
        artwork: row.artwork_url || null,
        songUrl: row.url || null,
        duration: row.duration_ms != null ? Number(row.duration_ms) : 0,
        added_by_id: row.queued_by != null ? String(row.queued_by) : "0",
        added_by: row.added_by || (row.queued_by != null ? String(row.queued_by) : "?"),
        ...(row.added_by_avatar ? { added_by_avatar: row.added_by_avatar } : {})
    };
}

/**
 * Reads a guild's live player state (players row + the current track) for one
 * bot instance. Returns null when the player is idle or absent.
 *
 * Playback progress is derived from the wall-clock anchor the bot writes on
 * events: position_ms + (now - position_at) while playing.
 */
export async function getPlayerState(botId, guildId) {

    const { rows } = await db.query(
        `SELECT p.playing, p.track_loaded, p.queue_position, p.loop_mode, p.shuffle, p.volume, p.speed,
                p.position_ms,
                (EXTRACT(EPOCH FROM (now() - p.position_at)) * 1000)::bigint AS elapsed_ms,
                t.title, t.artist, t.artwork_url, t.url, t.duration_ms,
                qt.queued_by, u.display_name AS added_by, u.avatar_url AS added_by_avatar
         FROM players p
         LEFT JOIN queue_tracks qt
                ON qt.bot_id = p.bot_id AND qt.guild_id = p.guild_id AND qt.position = p.queue_position
         LEFT JOIN tracks t ON t.id = qt.track_id
         LEFT JOIN users u ON u.id = qt.queued_by
         WHERE p.bot_id = $1 AND p.guild_id = $2`,
        [botId, guildId]
    );

    const row = rows[0];
    if (!row || !row.track_loaded || !row.title) return null;

    const speed = Number(row.speed) || 1;
    const duration = row.duration_ms != null ? Number(row.duration_ms) : 0;
    let progress = Number(row.position_ms);
    if (row.playing) progress += Number(row.elapsed_ms) * speed;
    if (duration > 0) progress = Math.min(progress, duration);

    return {
        progress: Math.max(0, progress),
        playing: row.playing,
        shuffle: row.shuffle === "enabled",
        loop: row.loop_mode,
        volume: row.volume,
        speed,
        position: row.queue_position,
        track: trackRow(row)
    };

}

/**
 * Reads a guild's full queue for one bot instance, oldest position first.
 * Each entry's track_id is its queue position — the id the control actions
 * (jump/move/remove) address.
 */
export async function getQueue(botId, guildId) {

    const [{ rows }, { rows: playerRows }] = await Promise.all([
        db.query(
            `SELECT qt.id, qt.position, qt.queued_by,
                    t.title, t.artist, t.artwork_url, t.url, t.duration_ms,
                    u.display_name AS added_by, u.avatar_url AS added_by_avatar
             FROM queue_tracks qt
             JOIN tracks t ON t.id = qt.track_id
             LEFT JOIN users u ON u.id = qt.queued_by
             WHERE qt.bot_id = $1 AND qt.guild_id = $2
             ORDER BY qt.position ASC`,
            [botId, guildId]
        ),
        db.query(
            `SELECT queue_position FROM players WHERE bot_id = $1 AND guild_id = $2`,
            [botId, guildId]
        )
    ]);

    return {
        position: playerRows[0]?.queue_position ?? 0,
        tracks: rows.map((row) => ({ track_id: row.position, entry_id: String(row.id), ...trackRow(row) }))
    };

}
