/**
 * Shared track-shape transforms. Kept free of any server-only imports (no `pg`)
 * so both the database layer (full fetches) and the client (WebSocket deltas)
 * can turn a raw catalog row into the exact same track object — the two paths
 * can never drift.
 */

/**
 * Splits a raw "Artist - Title" string the same way the bot's dashboard
 * payloads used to, so titles keep rendering as title + artist.
 */
export function splitTitle(title, artist) {
    if (title && title.includes(" - ")) {
        const [left, right] = title.split(/-(.+)/, 2).map((s) => s.trim());
        return { title: right || title, artist: left || artist };
    }
    return { title, artist };
}

/**
 * Turns a raw row (catalog columns from either the DB query or a bot delta)
 * into the track shape the UI consumes.
 */
export function trackRow(row) {
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
