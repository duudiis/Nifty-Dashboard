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

/* ===================== library & recents (dashboard-owned) ===================== */

/**
 * Makes sure the dashboard user exists in the shared users table (they may
 * never have queued anything through the bot yet).
 */
export async function ensureUser(user) {
    await db.query(
        `INSERT INTO users (id, username, display_name, avatar_url, last_seen_at)
         VALUES ($1, $2, $3, $4, now())
         ON CONFLICT (id) DO UPDATE SET last_seen_at = now()`,
        [user.id, user.username || null, user.username || null, user.avatar_url || null]
    );
}

/**
 * The user's recently queued items — individual tracks from queue_history
 * plus whole collections from queued_collections — newest first, deduped.
 * Items come back in the search-result shape the suggestion dropdown renders.
 */
export async function getRecentItems(userId, limit = 10) {

    const [tracks, collections] = await Promise.all([
        db.query(
            `SELECT * FROM (
                SELECT DISTINCT ON (qh.track_id)
                       qh.queued_at, t.title, t.artist, t.artwork_url, t.url, t.source
                FROM queue_history qh
                JOIN tracks t ON t.id = qh.track_id
                WHERE qh.user_id = $1
                ORDER BY qh.track_id, qh.queued_at DESC
             ) recent ORDER BY queued_at DESC LIMIT $2`,
            [userId, limit]
        ),
        db.query(
            `SELECT * FROM (
                SELECT DISTINCT ON (COALESCE(browse_ref, source_url))
                       queued_at, kind, name, subtitle, artwork_url, source_url, browse_ref
                FROM queued_collections
                WHERE user_id = $1
                ORDER BY COALESCE(browse_ref, source_url), queued_at DESC
             ) recent ORDER BY queued_at DESC LIMIT $2`,
            [userId, limit]
        )
    ]);

    const items = [
        ...tracks.rows.map((r) => ({
            queuedAt: r.queued_at,
            kind: r.source === "youtube" && !r.artist ? "video" : "song",
            title: r.title,
            artist: r.artist,
            artwork: r.artwork_url,
            url: r.url,
            playQuery: r.url
        })),
        ...collections.rows.map((r) => ({
            queuedAt: r.queued_at,
            kind: r.kind,
            title: r.name,
            subtitle: r.subtitle || r.kind,
            artwork: r.artwork_url,
            url: r.source_url,
            browseId: r.browse_ref
        }))
    ];

    items.sort((a, b) => new Date(b.queuedAt) - new Date(a.queuedAt));
    return items.slice(0, limit).map(({ queuedAt, ...item }) => item);

}

/** Records a whole-collection enqueue for the recents feed. */
export async function recordQueuedCollection(userId, entity) {
    await db.query(
        `INSERT INTO queued_collections (user_id, kind, source, source_url, browse_ref, name, subtitle, artwork_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
        [userId, entity.kind, entity.source, entity.sourceUrl, entity.browseRef || null,
         entity.name || null, entity.subtitle || null, entity.artwork || null]
    );
}

/** Saves a collection to the user's library (idempotent). */
export async function saveCollection(userId, entity) {
    await db.query(
        `INSERT INTO saved_collections (user_id, kind, source, source_url, browse_ref, name, subtitle, artwork_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (user_id, source_url) DO UPDATE
             SET name = EXCLUDED.name, subtitle = EXCLUDED.subtitle, artwork_url = EXCLUDED.artwork_url,
                 browse_ref = EXCLUDED.browse_ref`,
        [userId, entity.kind, entity.source, entity.sourceUrl, entity.browseRef || null,
         entity.name || null, entity.subtitle || null, entity.artwork || null]
    );
}

export async function unsaveCollection(userId, sourceUrl) {
    await db.query(
        `DELETE FROM saved_collections WHERE user_id = $1 AND source_url = $2`,
        [userId, sourceUrl]
    );
}

/** Which of these browse refs the user has saved (for heart states). */
export async function getSavedRefs(userId, refs) {
    if (!refs.length) return [];
    const { rows } = await db.query(
        `SELECT browse_ref FROM saved_collections WHERE user_id = $1 AND browse_ref = ANY($2)`,
        [userId, refs]
    );
    return rows.map((r) => r.browse_ref);
}

/**
 * Upserts a track the dashboard knows only from a platform link into the
 * shared catalog. Source/source_id come from the link, matching the ids the
 * bot's lavaplayer sources use, so rows dedupe against bot-written ones.
 */
async function upsertTrackFromItem(item, parsedLink) {
    const durationMs = typeof item.duration === "number"
        ? item.duration
        : parseClock(item.duration);

    const { rows } = await db.query(
        `INSERT INTO tracks (source, source_id, title, artist, duration_ms, url, artwork_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         ON CONFLICT (source, source_id) DO UPDATE
             SET title = EXCLUDED.title, artist = EXCLUDED.artist,
                 artwork_url = COALESCE(EXCLUDED.artwork_url, tracks.artwork_url)
         RETURNING id`,
        [parsedLink.source, parsedLink.id, item.title || "Unknown", item.artist || "",
         durationMs, item.url, item.artwork || null]
    );
    return rows[0].id;
}

function parseClock(str) {
    if (!str || typeof str !== "string") return null;
    const parts = str.split(":").map((n) => parseInt(n, 10));
    if (parts.some(Number.isNaN)) return null;
    return parts.reduce((total, part) => total * 60 + part, 0) * 1000;
}

/** Likes a track (appends to the user's liked list). Returns false if it already was. */
export async function likeTrack(userId, item, parsedLink) {
    const trackId = await upsertTrackFromItem(item, parsedLink);
    const { rowCount } = await db.query(
        `INSERT INTO liked_tracks (user_id, track_id, position)
         SELECT $1, $2, COALESCE(MAX(position) + 1, 0)
         FROM liked_tracks WHERE user_id = $1
         ON CONFLICT (user_id, track_id) DO NOTHING`,
        [userId, trackId]
    );
    return rowCount > 0;
}

export async function unlikeTrack(userId, parsedLink) {
    await db.query(
        `DELETE FROM liked_tracks WHERE user_id = $1 AND track_id =
            (SELECT id FROM tracks WHERE source = $2 AND source_id = $3)`,
        [userId, parsedLink.source, parsedLink.id]
    );
}
