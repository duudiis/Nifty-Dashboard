import { db } from "./db.js";
import { encrypt, decrypt } from "./crypto.js";
import { getProvider } from "../connect/providers.js";
import { collectPages, makeIsSettled, RESYNC_OVERLAP_MS } from "../connect/paging.js";

// Stores linked music accounts and imports their liked songs into the shared
// liked_tracks, merged by the platform's own "date added".

/* ------------------------------------------------------------ connections */

export async function upsertConnection(userId, provider, data) {
    const expiresAt = data.expiresIn ? new Date(Date.now() + data.expiresIn * 1000) : null;
    await db.query(
        `INSERT INTO music_connections
           (user_id, provider, external_id, external_name, access_token, refresh_token, expires_at, scopes, connected_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $8, now())
         ON CONFLICT (user_id, provider) DO UPDATE SET
           external_id = EXCLUDED.external_id, external_name = EXCLUDED.external_name,
           access_token = EXCLUDED.access_token,
           refresh_token = COALESCE(EXCLUDED.refresh_token, music_connections.refresh_token),
           expires_at = EXCLUDED.expires_at, scopes = EXCLUDED.scopes, connected_at = now()`,
        [userId, provider, data.externalId || null, data.externalName || null,
         encrypt(data.accessToken), encrypt(data.refreshToken), expiresAt, data.scope || null]
    );
}

// likedCount is live: the songs imported from that account that are still in
// the user's Liked songs.
export async function listConnections(userId) {
    const { rows } = await db.query(
        `SELECT mc.provider, mc.external_name, mc.connected_at, mc.last_synced_at,
                (SELECT count(*) FROM liked_tracks lt
                  WHERE lt.user_id = mc.user_id AND lt.imported_from = mc.provider)::int AS liked_count
         FROM music_connections mc WHERE mc.user_id = $1`,
        [userId]
    );
    return rows.map((r) => ({
        provider: r.provider,
        externalName: r.external_name,
        connectedAt: r.connected_at,
        lastSyncedAt: r.last_synced_at,
        likedCount: r.liked_count
    }));
}

// When one connection last synced: { lastSyncedAt }, or null if not connected.
export async function getConnection(userId, provider) {
    const { rows } = await db.query(
        `SELECT last_synced_at FROM music_connections WHERE user_id = $1 AND provider = $2`,
        [userId, provider]
    );
    return rows[0] ? { lastSyncedAt: rows[0].last_synced_at } : null;
}

// Every connection with when it last synced — what the auto-sync scheduler
// picks stale ones from.
export async function listAllConnections() {
    const { rows } = await db.query(`SELECT user_id, provider, last_synced_at FROM music_connections`);
    return rows.map((r) => ({ userId: String(r.user_id), provider: r.provider, lastSyncedAt: r.last_synced_at }));
}

/**
 * Disconnects a provider and removes every liked song imported from it,
 * leaving natively-liked songs (imported_from IS NULL) and those imported
 * from other still-connected accounts untouched. Returns how many were
 * removed. Remaining liked positions are renumbered contiguous.
 */
export async function disconnectProvider(userId, provider) {
    const client = await db.connect();
    try {
        await client.query("BEGIN");

        const { rowCount: removed } = await client.query(
            `DELETE FROM liked_tracks WHERE user_id = $1 AND imported_from = $2`,
            [userId, provider]
        );

        if (removed > 0) {
            await client.query(
                `WITH ranked AS (
                     SELECT track_id, row_number() OVER (ORDER BY position) - 1 AS newpos
                     FROM liked_tracks WHERE user_id = $1
                 )
                 UPDATE liked_tracks lt SET position = ranked.newpos
                 FROM ranked WHERE lt.track_id = ranked.track_id AND lt.user_id = $1`,
                [userId]
            );
        }

        await client.query(
            `DELETE FROM music_connections WHERE user_id = $1 AND provider = $2`,
            [userId, provider]
        );

        await client.query("COMMIT");
        return { removed };
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }
}

// Returns a usable access token, refreshing (and persisting) it first if it's
// expired or about to be. Also returns the external account id (for Tidal).
async function getValidToken(userId, providerId) {
    const provider = getProvider(providerId);
    const { rows } = await db.query(
        `SELECT external_id, access_token, refresh_token, expires_at, last_synced_at FROM music_connections
         WHERE user_id = $1 AND provider = $2`,
        [userId, providerId]
    );
    const row = rows[0];
    if (!row) throw new Error("Not connected.");

    let accessToken = decrypt(row.access_token);
    const refreshToken = decrypt(row.refresh_token);
    const expired = row.expires_at && new Date(row.expires_at).getTime() - Date.now() < 60_000;

    if (expired && refreshToken) {
        const refreshed = await provider.refresh(refreshToken);
        if (refreshed?.accessToken) {
            accessToken = refreshed.accessToken;
            const expiresAt = refreshed.expiresIn ? new Date(Date.now() + refreshed.expiresIn * 1000) : null;
            await db.query(
                `UPDATE music_connections SET access_token = $3, expires_at = $4 WHERE user_id = $1 AND provider = $2`,
                [userId, providerId, encrypt(accessToken), expiresAt]
            );
        }
    }

    return { accessToken, externalId: row.external_id, lastSyncedAt: row.last_synced_at };
}

/* ------------------------------------------------------------ import + merge */

// Upserts a batch of normalized tracks into the catalog, returning a
// "source:sourceId" -> track id map.
async function upsertTracks(client, batch) {
    if (!batch.length) return new Map();

    const values = [];
    const params = [];
    batch.forEach((t, i) => {
        const b = i * 8;
        values.push(`($${b + 1}, $${b + 2}, $${b + 3}, $${b + 4}, $${b + 5}, $${b + 6}, $${b + 7}, $${b + 8})`);
        params.push(t.source, t.sourceId, t.title || "Unknown", t.artist || "",
            t.durationMs || null, t.url || null, t.artwork || null, t.isrc || null);
    });

    const { rows } = await client.query(
        `INSERT INTO tracks (source, source_id, title, artist, duration_ms, url, artwork_url, isrc)
         VALUES ${values.join(", ")}
         ON CONFLICT (source, source_id) DO UPDATE SET
           title = EXCLUDED.title, artist = EXCLUDED.artist,
           artwork_url = COALESCE(EXCLUDED.artwork_url, tracks.artwork_url),
           isrc = COALESCE(EXCLUDED.isrc, tracks.isrc)
         RETURNING id, source, source_id`,
        params
    );

    const map = new Map();
    for (const r of rows) map.set(`${r.source}:${r.source_id}`, r.id);
    return map;
}

// What the user already has liked, as lookup sets: catalog ids, ISRCs, and the
// ids those songs carry on one platform.
async function loadLikedIndex(queryable, userId, providerId) {
    const { rows } = await queryable.query(
        `SELECT lt.track_id, t.isrc, t.source, t.source_id
         FROM liked_tracks lt JOIN tracks t ON t.id = lt.track_id WHERE lt.user_id = $1`,
        [userId]
    );
    return {
        trackIds: new Set(rows.map((r) => String(r.track_id))),
        isrcs: new Set(rows.map((r) => r.isrc).filter(Boolean)),
        sourceIds: new Set(rows.filter((r) => r.source === providerId).map((r) => r.source_id))
    };
}

const WRITE_CHUNK = 500;

/**
 * Imports the user's liked songs from a connected provider and merges them
 * into liked_tracks. Deduplicates against tracks they already have liked —
 * exactly (same catalog row) and cross-platform (same ISRC). New rows carry
 * the platform's own added date, so the "Date added" order is a true merge.
 *
 * A connection that has synced before only reads the newest pages, stopping
 * at the first one with nothing new, and imports what was liked on the
 * platform since that sync — so a song removed from Liked songs here is not
 * brought back (providers that list newest-first; see connect/paging.js).
 * The first import, or `full: true`, reads and imports everything.
 *
 * onProgress receives { phase: "reading" | "saving", done, total } as it goes.
 * Resolves to { imported, scanned, mode: "full" | "incremental" }.
 */
export async function importLikedFromProvider(userId, providerId, { full = false, onProgress = () => {} } = {}) {
    const provider = getProvider(providerId);
    if (!provider) throw new Error("Unknown provider.");

    onProgress({ phase: "reading", done: 0, total: null });
    const { accessToken, externalId, lastSyncedAt } = await getValidToken(userId, providerId);
    const known = await loadLikedIndex(db, userId, providerId);
    const incremental = !full && provider.newestFirst && lastSyncedAt != null;
    const isSettled = makeIsSettled({
        isKnown: (t) => known.sourceIds.has(t.sourceId) || (!!t.isrc && known.isrcs.has(t.isrc)),
        since: incremental ? new Date(lastSyncedAt).getTime() - RESYNC_OVERLAP_MS : null
    });
    const ctx = { externalId };
    const { items, scanned } = await collectPages({
        fetchPage: (cursor) => provider.likedPage(accessToken, cursor, ctx),
        pageSize: provider.pageSize,
        offsetPaged: provider.offsetPaged,
        incremental,
        isKnown: isSettled,
        onProgress: ({ done, total }) => onProgress({ phase: "reading", done, total })
    });

    // Only songs that look new are written; oldest first, so appended
    // positions and the timeline read chronologically.
    const fresh = items
        .filter((t) => !isSettled(t))
        .sort((a, b) => new Date(a.addedAt || 0) - new Date(b.addedAt || 0));
    onProgress({ phase: "saving", done: 0, total: fresh.length });

    const client = await db.connect();
    let imported = 0;
    try {
        await client.query("BEGIN");

        // One import per user at a time: two providers finishing together
        // would otherwise hand out the same positions.
        await client.query(`SELECT pg_advisory_xact_lock(hashtext('nifty.liked_import'), hashtext($1::text))`, [userId]);

        // Disconnected while we were reading? Then there is nothing to import into.
        const still = await client.query(
            `SELECT 1 FROM music_connections WHERE user_id = $1 AND provider = $2 FOR UPDATE`,
            [userId, providerId]
        );
        if (!still.rowCount) throw new Error("Not connected.");

        if (fresh.length) {
            // Re-read the dedupe targets under the lock; the copy above only
            // steered the paging.
            const liked = await loadLikedIndex(client, userId, providerId);
            const posRow = await client.query(
                `SELECT COALESCE(MAX(position) + 1, 0) AS next FROM liked_tracks WHERE user_id = $1`,
                [userId]
            );
            let position = posRow.rows[0].next;

            for (let i = 0; i < fresh.length; i += WRITE_CHUNK) {
                const chunk = fresh.slice(i, i + WRITE_CHUNK);
                const idMap = await upsertTracks(client, chunk);

                const trackIds = [], positions = [], addedAts = [];
                for (const t of chunk) {
                    const trackId = idMap.get(`${t.source}:${t.sourceId}`);
                    if (!trackId) continue;
                    if (liked.trackIds.has(String(trackId))) continue;      // already liked (same row)
                    if (t.isrc && liked.isrcs.has(t.isrc)) continue;        // same song on another platform
                    liked.trackIds.add(String(trackId));
                    if (t.isrc) liked.isrcs.add(t.isrc);
                    trackIds.push(trackId);
                    positions.push(position++);
                    addedAts.push(t.addedAt || new Date().toISOString());
                }

                // One statement per chunk rather than one per song.
                if (trackIds.length) {
                    const { rowCount } = await client.query(
                        `INSERT INTO liked_tracks (user_id, track_id, position, added_at, imported_from)
                         SELECT $1, incoming.track_id, incoming.position, incoming.added_at, $5
                         FROM unnest($2::bigint[], $3::int[], $4::timestamptz[]) AS incoming(track_id, position, added_at)
                         ON CONFLICT (user_id, track_id) DO NOTHING`,
                        [userId, trackIds, positions, addedAts, providerId]
                    );
                    imported += rowCount;
                }
                onProgress({ phase: "saving", done: Math.min(i + WRITE_CHUNK, fresh.length), total: fresh.length });
            }
        }

        // Record the sync on the connection.
        await client.query(
            `UPDATE music_connections SET last_synced_at = now(),
                    liked_count = (SELECT count(*) FROM liked_tracks WHERE user_id = $1 AND imported_from = $2)
             WHERE user_id = $1 AND provider = $2`,
            [userId, providerId]
        );

        // The Liked songs view already defaults to Date-added newest-first (see
        // getCollectionSort), so imports surface at the top without persisting
        // a sort row that would freeze the user's later choices.

        await client.query("COMMIT");
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }

    return { imported, scanned, mode: incremental ? "incremental" : "full" };
}
