import { db } from "./db.js";
import { encrypt, decrypt } from "./crypto.js";
import { getProvider } from "../connect/providers.js";

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

export async function listConnections(userId) {
    const { rows } = await db.query(
        `SELECT provider, external_name, connected_at, last_synced_at, liked_count
         FROM music_connections WHERE user_id = $1`,
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

export async function deleteConnection(userId, provider) {
    await db.query(`DELETE FROM music_connections WHERE user_id = $1 AND provider = $2`, [userId, provider]);
}

// Returns a usable access token, refreshing (and persisting) it first if it's
// expired or about to be. Also returns the external account id (for Tidal).
async function getValidToken(userId, providerId) {
    const provider = getProvider(providerId);
    const { rows } = await db.query(
        `SELECT external_id, access_token, refresh_token, expires_at FROM music_connections
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

    return { accessToken, externalId: row.external_id };
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

const LIKED_REF = "nifty:playlist:liked";

/**
 * Imports the user's liked songs from a connected provider and merges them
 * into liked_tracks. Deduplicates against tracks they already have liked —
 * exactly (same catalog row) and cross-platform (same ISRC). New rows carry
 * the platform's own added date, so the "Date added" order is a true merge.
 */
export async function importLikedFromProvider(userId, providerId) {
    const provider = getProvider(providerId);
    if (!provider) throw new Error("Unknown provider.");

    const { accessToken, externalId } = await getValidToken(userId, providerId);
    const liked = await provider.fetchLiked(accessToken, externalId);

    // Oldest first, so appended positions and the timeline read chronologically.
    liked.sort((a, b) => new Date(a.addedAt || 0) - new Date(b.addedAt || 0));

    const client = await db.connect();
    let imported = 0;
    try {
        await client.query("BEGIN");

        // What the user already has liked (dedupe targets).
        const existing = await client.query(
            `SELECT lt.track_id, t.isrc FROM liked_tracks lt JOIN tracks t ON t.id = lt.track_id WHERE lt.user_id = $1`,
            [userId]
        );
        const likedIds = new Set(existing.rows.map((r) => String(r.track_id)));
        const likedIsrcs = new Set(existing.rows.map((r) => r.isrc).filter(Boolean));

        const posRow = await client.query(
            `SELECT COALESCE(MAX(position) + 1, 0) AS next FROM liked_tracks WHERE user_id = $1`,
            [userId]
        );
        let position = posRow.rows[0].next;

        // Resolve tracks in chunks, then insert the non-duplicates.
        for (let i = 0; i < liked.length; i += 300) {
            const chunk = liked.slice(i, i + 300);
            const idMap = await upsertTracks(client, chunk);

            for (const t of chunk) {
                const trackId = idMap.get(`${t.source}:${t.sourceId}`);
                if (!trackId) continue;
                if (likedIds.has(String(trackId))) continue;              // already liked (same row)
                if (t.isrc && likedIsrcs.has(t.isrc)) continue;           // same song on another platform

                await client.query(
                    `INSERT INTO liked_tracks (user_id, track_id, position, added_at)
                     VALUES ($1, $2, $3, $4)
                     ON CONFLICT (user_id, track_id) DO NOTHING`,
                    [userId, trackId, position, t.addedAt || new Date().toISOString()]
                );
                likedIds.add(String(trackId));
                if (t.isrc) likedIsrcs.add(t.isrc);
                position++;
                imported++;
            }
        }

        // Record the sync on the connection.
        await client.query(
            `UPDATE music_connections SET last_synced_at = now(), liked_count = $3 WHERE user_id = $1 AND provider = $2`,
            [userId, providerId, liked.length]
        );

        // Default the Liked songs view to the merged chronological timeline
        // (newest first) — but never override a sort the user already chose.
        await client.query(
            `INSERT INTO collection_sorting (user_id, collection_ref, sort_by, sort_desc)
             VALUES ($1, $2, 'added', TRUE)
             ON CONFLICT (user_id, collection_ref) DO NOTHING`,
            [userId, LIKED_REF]
        );

        await client.query("COMMIT");
    } catch (error) {
        await client.query("ROLLBACK");
        throw error;
    } finally {
        client.release();
    }

    return { imported, total: liked.length };
}
