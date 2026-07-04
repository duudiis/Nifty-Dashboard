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

/** Saves a collection to the user's library shelf (idempotent). */
export async function saveCollection(userId, entity) {
    const { rows } = await db.query(
        `INSERT INTO saved_collections (user_id, kind, source, source_url, browse_ref, name, subtitle, artwork_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
         ON CONFLICT (user_id, source_url) DO UPDATE
             SET name = EXCLUDED.name, subtitle = EXCLUDED.subtitle, artwork_url = EXCLUDED.artwork_url,
                 browse_ref = EXCLUDED.browse_ref
         RETURNING id`,
        [userId, entity.kind, entity.source, entity.sourceUrl, entity.browseRef || null,
         entity.name || null, entity.subtitle || null, entity.artwork || null]
    );

    await db.query(
        `INSERT INTO library_items (user_id, position, saved_id)
         SELECT $1, COALESCE(MAX(position) + 1, 0), $2 FROM library_items WHERE user_id = $1
         ON CONFLICT (user_id, playlist_id, saved_id) DO NOTHING`,
        [userId, rows[0].id]
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

/* ===================== library shelf, playlists ===================== */

function clockFromMs(ms) {
    if (ms == null) return null;
    const total = Math.floor(Number(ms) / 1000);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const sec = String(total % 60).padStart(2, "0");
    return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

/** The user's ordered library shelf (custom playlists + saved collections). */
export async function listLibrary(userId) {
    const { rows } = await db.query(
        `SELECT li.id AS item_id, li.position, li.added_at,
                p.id AS playlist_id, p.name AS playlist_name, p.artwork_url AS playlist_art,
                sc.kind AS saved_kind, sc.name AS saved_name, sc.subtitle AS saved_subtitle,
                sc.artwork_url AS saved_art, sc.browse_ref, sc.source_url, sc.source
         FROM library_items li
         LEFT JOIN playlists p ON p.id = li.playlist_id
         LEFT JOIN saved_collections sc ON sc.id = li.saved_id
         WHERE li.user_id = $1
         ORDER BY li.position ASC`,
        [userId]
    );

    return rows.map((r) => r.playlist_id
        ? {
            itemId: String(r.item_id),
            kind: "playlist",
            custom: true,
            browseId: `nifty:playlist:${r.playlist_id}`,
            title: r.playlist_name,
            subtitle: "Playlist · by you",
            artwork: r.playlist_art,
            addedAt: r.added_at
        }
        : {
            itemId: String(r.item_id),
            kind: r.saved_kind,
            browseId: r.browse_ref,
            title: r.saved_name,
            subtitle: r.saved_subtitle || `${r.saved_kind} · ${r.source}`,
            artwork: r.saved_art,
            url: r.source_url,
            addedAt: r.added_at
        });
}

/** Everything the client caches for instant heart/menu states. */
export async function getLibraryState(userId) {
    const [saved, liked, playlists] = await Promise.all([
        db.query(`SELECT browse_ref FROM saved_collections WHERE user_id = $1 AND browse_ref IS NOT NULL`, [userId]),
        db.query(`SELECT t.url FROM liked_tracks lt JOIN tracks t ON t.id = lt.track_id WHERE lt.user_id = $1`, [userId]),
        db.query(`SELECT id, name FROM playlists WHERE owner_id = $1 ORDER BY created_at ASC`, [userId])
    ]);
    return {
        savedRefs: saved.rows.map((r) => r.browse_ref),
        likedUrls: liked.rows.map((r) => r.url).filter(Boolean),
        playlists: playlists.rows.map((r) => ({ id: r.id, name: r.name }))
    };
}

/** Creates a custom playlist and shelves it. */
export async function createPlaylist(userId, name) {
    const client = await db.connect();
    try {
        await client.query("BEGIN");
        const { rows } = await client.query(
            `INSERT INTO playlists (owner_id, name) VALUES ($1, $2) RETURNING id, name`,
            [userId, name]
        );
        await client.query(
            `INSERT INTO library_items (user_id, position, playlist_id)
             SELECT $1, COALESCE(MAX(position) + 1, 0), $2 FROM library_items WHERE user_id = $1`,
            [userId, rows[0].id]
        );
        await client.query("COMMIT");
        return rows[0];
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

/**
 * Appends tracks to one of the user's own playlists. Tracks are upserted into
 * the shared catalog first (parsed platform link required per track).
 */
export async function addTracksToPlaylist(userId, playlistId, tracks) {
    const owner = await db.query(`SELECT owner_id FROM playlists WHERE id = $1`, [playlistId]);
    if (!owner.rows[0] || String(owner.rows[0].owner_id) !== String(userId)) {
        throw new Error("Not your playlist.");
    }

    let added = 0;
    for (const { item, parsedLink } of tracks) {
        const trackId = await upsertTrackFromItem(item, parsedLink);
        const { rowCount } = await db.query(
            `INSERT INTO playlist_tracks (playlist_id, position, track_id, added_by)
             SELECT $1, COALESCE(MAX(position) + 1, 0), $2, $3 FROM playlist_tracks WHERE playlist_id = $1`,
            [playlistId, trackId, userId]
        );
        added += rowCount;
    }

    await db.query(`UPDATE playlists SET updated_at = now() WHERE id = $1`, [playlistId]);
    return added;
}

/** Moves a shelf entry to a new index (same shift pattern as the queue). */
export async function reorderLibrary(userId, itemId, toIndex) {
    const client = await db.connect();
    try {
        await client.query("BEGIN");
        const { rows } = await client.query(
            `SELECT position FROM library_items WHERE id = $1 AND user_id = $2`,
            [itemId, userId]
        );
        if (!rows[0]) { await client.query("ROLLBACK"); return; }
        const from = rows[0].position;
        if (from === toIndex) { await client.query("ROLLBACK"); return; }

        if (toIndex > from) {
            await client.query(
                `UPDATE library_items SET position = position - 1
                 WHERE user_id = $1 AND position > $2 AND position <= $3`,
                [userId, from, toIndex]
            );
        } else {
            await client.query(
                `UPDATE library_items SET position = position + 1
                 WHERE user_id = $1 AND position >= $3 AND position < $2`,
                [userId, from, toIndex]
            );
        }
        await client.query(`UPDATE library_items SET position = $2 WHERE id = $1`, [itemId, toIndex]);
        await client.query("COMMIT");
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

/** Backs the "nifty" source: a custom playlist page read straight from the db. */
export async function browsePlaylistFromDb(playlistId) {
    const [meta, tracks] = await Promise.all([
        db.query(
            `SELECT p.name, p.artwork_url, u.display_name AS owner_name
             FROM playlists p LEFT JOIN users u ON u.id = p.owner_id WHERE p.id = $1`,
            [playlistId]
        ),
        db.query(
            `SELECT pt.id AS entry_id, pt.added_at, t.title, t.artist, t.duration_ms, t.artwork_url, t.url
             FROM playlist_tracks pt JOIN tracks t ON t.id = pt.track_id
             WHERE pt.playlist_id = $1 ORDER BY pt.position ASC`,
            [playlistId]
        )
    ]);

    const p = meta.rows[0];
    if (!p) throw new Error("Playlist not found.");

    return {
        type: "playlist",
        custom: true,
        reorderable: true,
        title: p.name,
        subtitle: p.owner_name ? `by ${p.owner_name}` : "",
        artwork: p.artwork_url || tracks.rows[0]?.artwork_url || null,
        tracks: tracks.rows.map((t) => ({
            entryId: String(t.entry_id),
            title: t.title,
            artist: t.artist,
            duration: clockFromMs(t.duration_ms),
            artwork: t.artwork_url,
            url: t.url,
            playQuery: t.url,
            addedAt: t.added_at
        })),
        playUrl: null
    };
}

/** The user's Liked songs as a browsable collection page. */
export async function browseLikedFromDb(userId) {
    const { rows } = await db.query(
        `SELECT lt.track_id, lt.added_at, t.title, t.artist, t.duration_ms, t.artwork_url, t.url
         FROM liked_tracks lt JOIN tracks t ON t.id = lt.track_id
         WHERE lt.user_id = $1 ORDER BY lt.position ASC`,
        [userId]
    );

    return {
        type: "playlist",
        custom: true,
        liked: true,
        reorderable: true,
        title: "Liked songs",
        subtitle: `${rows.length} song${rows.length === 1 ? "" : "s"}`,
        artwork: rows[0]?.artwork_url || null,
        tracks: rows.map((t) => ({
            entryId: String(t.track_id),
            title: t.title,
            artist: t.artist,
            duration: clockFromMs(t.duration_ms),
            artwork: t.artwork_url,
            url: t.url,
            playQuery: t.url,
            addedAt: t.added_at
        })),
        playUrl: null
    };
}

/* ===================== per-playlist sort preference + reordering ===================== */

const SORT_KEYS = ["custom", "added", "title", "artist", "duration"];

/** The user's saved sort choice for a collection (default: custom order). */
export async function getCollectionSort(userId, ref) {
    const { rows } = await db.query(
        `SELECT sort_by, sort_desc FROM collection_sorting WHERE user_id = $1 AND collection_ref = $2`,
        [userId, ref]
    );
    const row = rows[0];
    return { sortBy: row?.sort_by || "custom", sortDesc: !!row?.sort_desc };
}

/** Persists the user's sort choice for a collection. */
export async function setCollectionSort(userId, ref, sortBy, sortDesc) {
    const by = SORT_KEYS.includes(sortBy) ? sortBy : "custom";
    await db.query(
        `INSERT INTO collection_sorting (user_id, collection_ref, sort_by, sort_desc)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (user_id, collection_ref) DO UPDATE SET sort_by = EXCLUDED.sort_by, sort_desc = EXCLUDED.sort_desc`,
        [userId, ref, by, !!sortDesc]
    );
}

/**
 * Rewrites a custom playlist's track order to the given entry ids (0..n-1).
 * Owner-checked; ids that aren't in the playlist are ignored. Rewriting the
 * whole order is gap-proof — no shift math, no stale-index hazard.
 */
export async function reorderPlaylistTracks(userId, playlistId, orderedEntryIds) {
    const owner = await db.query(`SELECT owner_id FROM playlists WHERE id = $1`, [playlistId]);
    if (!owner.rows[0] || String(owner.rows[0].owner_id) !== String(userId)) {
        throw new Error("Not your playlist.");
    }

    const client = await db.connect();
    try {
        await client.query("BEGIN");
        // Park positions out of range first so the unique (playlist, position)
        // index can't collide mid-rewrite.
        await client.query(
            `UPDATE playlist_tracks SET position = position + 1000000 WHERE playlist_id = $1`,
            [playlistId]
        );
        let pos = 0;
        for (const entryId of orderedEntryIds) {
            const { rowCount } = await client.query(
                `UPDATE playlist_tracks SET position = $1 WHERE id = $2 AND playlist_id = $3`,
                [pos, entryId, playlistId]
            );
            if (rowCount) pos++;
        }
        // Anything not named (added elsewhere since load) is appended in its
        // existing relative order — collision-free.
        await client.query(
            `WITH ranked AS (
                 SELECT id, row_number() OVER (ORDER BY position) - 1 + $2 AS newpos
                 FROM playlist_tracks WHERE playlist_id = $1 AND position >= 1000000
             )
             UPDATE playlist_tracks pt SET position = ranked.newpos
             FROM ranked WHERE pt.id = ranked.id`,
            [playlistId, pos]
        );
        await client.query(`UPDATE playlists SET updated_at = now() WHERE id = $1`, [playlistId]);
        await client.query("COMMIT");
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

/** Rewrites the user's Liked songs order to the given track ids (0..n-1). */
export async function reorderLikedTracks(userId, orderedTrackIds) {
    const client = await db.connect();
    try {
        await client.query("BEGIN");
        await client.query(
            `UPDATE liked_tracks SET position = position + 1000000 WHERE user_id = $1`,
            [userId]
        );
        let pos = 0;
        for (const trackId of orderedTrackIds) {
            const { rowCount } = await client.query(
                `UPDATE liked_tracks SET position = $1 WHERE user_id = $2 AND track_id = $3`,
                [pos, userId, trackId]
            );
            if (rowCount) pos++;
        }
        await client.query(
            `WITH ranked AS (
                 SELECT track_id, row_number() OVER (ORDER BY position) - 1 + $2 AS newpos
                 FROM liked_tracks WHERE user_id = $1 AND position >= 1000000
             )
             UPDATE liked_tracks lt SET position = ranked.newpos
             FROM ranked WHERE lt.track_id = ranked.track_id AND lt.user_id = $1`,
            [userId, pos]
        );
        await client.query("COMMIT");
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

/** Deletes one of the user's own playlists (tracks + shelf entry cascade). */
export async function deletePlaylist(userId, playlistId) {
    const { rows } = await db.query(
        `DELETE FROM playlists WHERE id = $1 AND owner_id = $2 RETURNING name`,
        [playlistId, userId]
    );
    if (!rows[0]) throw new Error("Not your playlist.");
    return rows[0];
}
