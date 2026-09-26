import pg from "pg";

import { trackRow, splitTitle } from "./trackShape.js";

// The shared Nifty PostgreSQL database — the source of truth for player and
// queue state (the bot writes, we read). Connection details come from
// DATABASE_URL. When the server is remote it runs over TLS with a self-signed
// cert (sslmode=require in the URL) — we encrypt but skip CA verification, so
// enable ssl with rejectUnauthorized:false in that case. A local internal
// connection (no sslmode) needs no TLS.
//
// The pool survives dev hot-reloads via globalThis so we never leak clients.

const globalForDb = globalThis;

// Newer node-postgres treats sslmode=require in the URL as strict CA
// verification, which rejects our self-signed cert. Strip sslmode and drive
// TLS entirely through the ssl option: encrypt, but skip CA verification.
const rawUrl = process.env.DATABASE_URL || "";
const usesTls = /[?&]sslmode=require/i.test(rawUrl);
const connectionString = rawUrl.replace(/[?&]sslmode=require/i, "");

// The DB is now remote over TLS: a cold connection costs ~1.3s (handshake +
// SCRAM over the internet), so keep connections warm and pooled rather than
// re-establishing per burst, and allow more of them for the many concurrent
// reads a page load fires. keepAlive stops NAT from silently dropping idles.
function makePool() {
    const pool = new pg.Pool({
        connectionString,
        ssl: usesTls ? { rejectUnauthorized: false } : false,
        max: 20,
        idleTimeoutMillis: 300_000,        // 5 min — reuse warm connections across bursts
        connectionTimeoutMillis: 15_000,   // tolerate the ~1.3s cold handshake under contention
        keepAlive: true,
        keepAliveInitialDelayMillis: 10_000
    });
    // Never let a stuck query hold a pooled connection forever.
    pool.on("connect", (client) => client.query("SET statement_timeout = 20000").catch(() => {}));
    // A background client error shouldn't crash the server.
    pool.on("error", (err) => console.error("[Dashboard] pg pool error:", err.message));
    return pool;
}

export const db = globalForDb.__niftyDbPool ?? makePool();

if (!globalForDb.__niftyDbPool) globalForDb.__niftyDbPool = db;

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
 *
 * Also carries the autoplay section: the enabled flag from the players row
 * plus the bot's recommendation buffer ("Next from: Autoplay"), addressed by
 * the stable auto_id.
 */
export async function getQueue(botId, guildId) {

    const [{ rows }, { rows: playerRows }, { rows: autoplayRows }] = await Promise.all([
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
            `SELECT queue_position, autoplay FROM players WHERE bot_id = $1 AND guild_id = $2`,
            [botId, guildId]
        ),
        db.query(
            `SELECT at.id, t.title, t.artist, t.artwork_url, t.url, t.duration_ms
             FROM autoplay_tracks at
             JOIN tracks t ON t.id = at.track_id
             WHERE at.bot_id = $1 AND at.guild_id = $2
             ORDER BY at.position ASC`,
            [botId, guildId]
        )
    ]);

    return {
        position: playerRows[0]?.queue_position ?? 0,
        tracks: rows.map((row) => ({ track_id: row.position, entry_id: String(row.id), ...trackRow(row) })),
        autoplay: {
            enabled: playerRows[0]?.autoplay === "enabled",
            tracks: autoplayRows.map((row) => ({ auto_id: String(row.id), ...trackRow(row) }))
        }
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
        ...tracks.rows.map((r) => {
            // Same split every other surface applies, so a track doesn't read
            // "Nightcore - Lush Life" here and "Lush Life · Nightcore" next to it.
            const { title, artist } = splitTitle(r.title, r.artist);
            return {
                queuedAt: r.queued_at,
                kind: r.source === "youtube" && !artist ? "video" : "song",
                title,
                artist,
                artwork: r.artwork_url,
                url: r.url,
                playQuery: r.url
            };
        }),
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

/* ===================== listening history ===================== */

// The bot logs three nested layers of history, and the timeline reads all of
// them for one user, newest first:
//   queue_sessions     — one voice-channel sitting (started/ended)
//   track_plays        — each track that actually played inside a session
//   listening_segments — the spans THIS user was present for within a play
//                        (a play splits into several when they pause/leave)
//
// "How long you listened" is the wall-clock sum of your segments — but a
// segment can never sensibly outlast (a) its own recorded end, (b) the play it
// belongs to, (c) the track's own duration, or (d) the present moment. Clamping
// against all four means an unclosed segment on an orphaned session can't run to
// now() and report hours of phantom listening. This SEG_END/SEG_MS pair is the
// single source of that clamp; it references ls, tp and t, so every query that
// uses it must have those three in scope.
export const SEG_END = `LEAST(
    COALESCE(ls.ended_at, now()),
    COALESCE(tp.ended_at, now()),
    ls.started_at + make_interval(secs => COALESCE(NULLIF(t.duration_ms, 0), 2147483647)::double precision / 1000.0),
    now()
)`;
export const SEG_MS = `GREATEST(EXTRACT(EPOCH FROM (${SEG_END} - ls.started_at)) * 1000, 0)`;

/* The UI splits a raw "Artist - Title" catalog title client-side (splitTitle in
   trackShape.js), so aggregates that GROUP BY the raw columns rank a different
   set of artists than the rows they sit next to render. These fragments do the
   same split in SQL — including splitTitle's quirk of cutting at the FIRST
   hyphen once " - " is present — so a top-artists shelf and the track rows
   beneath it agree. */
export const DISPLAY_ARTIST = `CASE WHEN t.title LIKE '% - %'
    THEN btrim(split_part(t.title, '-', 1)) ELSE t.artist END`;
export const DISPLAY_TITLE = `CASE WHEN t.title LIKE '% - %'
    THEN COALESCE(NULLIF(btrim(substr(t.title, position('-' in t.title) + 1)), ''), t.title)
    ELSE t.title END`;

/**
 * One page of the user's listening sessions, newest first. Keyset-paginated on
 * (started_at, id) so it stays stable as new sessions are written. Pass the
 * previous page's `cursor` ("<iso>|<id>") to get the next; omit for page one.
 * Returns { sessions, nextCursor }. `lastListen` is the clamped end of the last
 * span, which the client uses to tell a genuinely live session from an orphan.
 */
export async function getListeningSessions(userId, { cursor = null, limit = 12 } = {}) {
    const [beforeAt, beforeId] = cursor ? splitCursor(cursor) : [null, null];

    const { rows } = await db.query(
        `SELECT s.id, s.bot_id, s.guild_id, s.voice_channel_id, s.started_at, s.ended_at,
                count(DISTINCT tp.id)::int        AS plays,
                count(ls.id)::int                 AS segments,
                count(DISTINCT tp.track_id)::int  AS distinct_tracks,
                COALESCE(sum(${SEG_MS}), 0)::bigint AS listened_ms,
                max(${SEG_END}) AS last_listen
         FROM queue_sessions s
         JOIN track_plays tp ON tp.session_id = s.id
         JOIN tracks t ON t.id = tp.track_id
         JOIN listening_segments ls ON ls.play_id = tp.id AND ls.user_id = $1
         WHERE ($2::timestamptz IS NULL OR (s.started_at, s.id) < ($2, $3::bigint))
         GROUP BY s.id
         ORDER BY s.started_at DESC, s.id DESC
         LIMIT $4`,
        [userId, beforeAt, beforeId, limit + 1]
    );

    const hasMore = rows.length > limit;
    const page = hasMore ? rows.slice(0, limit) : rows;
    const last = page[page.length - 1];
    const nextCursor = hasMore && last
        ? `${new Date(last.started_at).toISOString()}|${last.id}`
        : null;

    return {
        sessions: page.map((r) => ({
            id: String(r.id),
            botId: String(r.bot_id),
            guildId: String(r.guild_id),
            voiceChannelId: r.voice_channel_id != null ? String(r.voice_channel_id) : null,
            startedAt: r.started_at,
            endedAt: r.ended_at,
            plays: r.plays,
            segments: r.segments,
            distinctTracks: r.distinct_tracks,
            listenedMs: Number(r.listened_ms),
            lastListen: r.last_listen
        })),
        nextCursor
    };
}

/**
 * Every play the user listened to in one session, newest first, each with its
 * track, who queued it (and how, via queue_history), the play's own timing/end
 * reason, and the user's own listening segments broken out.
 */
export async function getSessionPlays(userId, sessionId) {
    const [plays, segments] = await Promise.all([
        db.query(
            `SELECT tp.id, tp.track_id, tp.started_at, tp.ended_at, tp.played_ms, tp.end_reason,
                    tp.queued_by, u.display_name AS queued_by_name, u.avatar_url AS queued_by_avatar,
                    t.title, t.artist, t.artwork_url, t.url, t.duration_ms, t.source,
                    (SELECT COALESCE(sum(${SEG_MS}), 0)::bigint
                     FROM listening_segments ls WHERE ls.play_id = tp.id AND ls.user_id = $1) AS listened_ms,
                    (SELECT qh.via FROM queue_history qh
                     WHERE qh.session_id = tp.session_id AND qh.track_id = tp.track_id
                     ORDER BY qh.queued_at DESC LIMIT 1) AS via
             FROM track_plays tp
             JOIN tracks t ON t.id = tp.track_id
             LEFT JOIN users u ON u.id = tp.queued_by
             WHERE tp.session_id = $2
               AND EXISTS (SELECT 1 FROM listening_segments ls
                           WHERE ls.play_id = tp.id AND ls.user_id = $1)
             ORDER BY tp.started_at DESC, tp.id DESC`,
            [userId, sessionId]
        ),
        db.query(
            `SELECT ls.id, ls.play_id, ls.started_at, ls.ended_at, ls.start_reason, ls.end_reason
             FROM listening_segments ls
             JOIN track_plays tp ON tp.id = ls.play_id
             WHERE tp.session_id = $2 AND ls.user_id = $1
             ORDER BY ls.started_at ASC`,
            [userId, sessionId]
        )
    ]);

    const segsByPlay = new Map();
    for (const s of segments.rows) {
        const key = String(s.play_id);
        if (!segsByPlay.has(key)) segsByPlay.set(key, []);
        segsByPlay.get(key).push({
            id: String(s.id),
            startedAt: s.started_at,
            endedAt: s.ended_at,
            startReason: s.start_reason,
            endReason: s.end_reason
        });
    }

    return plays.rows.map((r) => ({
        id: String(r.id),
        startedAt: r.started_at,
        endedAt: r.ended_at,
        playedMs: r.played_ms != null ? Number(r.played_ms) : null,
        listenedMs: r.listened_ms != null ? Number(r.listened_ms) : 0,
        endReason: r.end_reason,
        via: r.via,
        queuedBy: r.queued_by
            ? { id: String(r.queued_by), name: r.queued_by_name, avatar: r.queued_by_avatar }
            : null,
        track: {
            title: r.title,
            artist: r.artist,
            artwork: r.artwork_url,
            url: r.url,
            durationMs: r.duration_ms != null ? Number(r.duration_ms) : null,
            source: r.source
        },
        segments: segsByPlay.get(String(r.id)) || []
    }));
}

// Cursor is "<iso timestamp>|<session id>"; anything malformed pages from the top.
function splitCursor(cursor) {
    const idx = String(cursor).lastIndexOf("|");
    if (idx === -1) return [null, null];
    const at = cursor.slice(0, idx);
    const id = cursor.slice(idx + 1);
    if (!at || !id || Number.isNaN(Date.parse(at))) return [null, null];
    return [at, id];
}

/** Records a whole-collection enqueue for the recents feed. */
/* ===================== home screen ===================== */

// Everything the home screen needs from the database, in ONE statement.
//
// The database is remote: a round trip costs ~170ms whatever the query does,
// and a cold pooled connection costs ~1.3s of TLS + SCRAM. Firing the fifteen
// aggregates below as separate queries would claim several connections and pay
// that floor several times, so they share one statement, one connection and
// one `seg` scan. Every duration goes through SEG_MS — skipping the clamp
// inflates all-time totals by orders of magnitude wherever the bot left a
// segment unclosed on an orphaned session.
//
//   tz        IANA zone, already validated by the caller — decides what
//             "today", "this hour" and each heatmap cell mean
//   guildIds  optional filter; always intersected with the guilds this user
//             has provably taken part in, so a guessed snowflake reads nothing
export async function getHomeData(userId, { tz = "UTC", guildIds = [] } = {}) {

    const ids = Array.isArray(guildIds) && guildIds.length ? guildIds : null;

    const { rows } = await db.query(
        `WITH scope AS (
            SELECT g FROM (
                SELECT DISTINCT qh.guild_id AS g FROM queue_history qh WHERE qh.user_id = $1
                UNION
                SELECT DISTINCT tp.guild_id FROM track_plays tp
                  JOIN listening_segments ls ON ls.play_id = tp.id
                 WHERE ls.user_id = $1
            ) mine
            WHERE $3::bigint[] IS NULL OR g = ANY($3::bigint[])
        ),
        seg AS (
            SELECT ls.started_at                AS seg_start,
                   tp.id                        AS play_id,
                   tp.session_id, tp.guild_id, tp.track_id, tp.queued_by,
                   tp.started_at                AS play_start,
                   t.source, t.url, t.artwork_url, t.duration_ms, t.title, t.artist,
                   ${DISPLAY_TITLE}             AS d_title,
                   ${DISPLAY_ARTIST}            AS d_artist,
                   ${SEG_MS}                    AS seg_ms
              FROM listening_segments ls
              JOIN track_plays tp ON tp.id = ls.play_id
              JOIN tracks t ON t.id = tp.track_id
             WHERE ls.user_id = $1
        ),
        heard AS (SELECT DISTINCT track_id FROM seg),
        totals AS (
            SELECT COALESCE(sum(seg_ms) FILTER (
                       WHERE (seg_start AT TIME ZONE $2)::date = (now() AT TIME ZONE $2)::date), 0)::bigint AS today_ms,
                   COALESCE(sum(seg_ms) FILTER (WHERE seg_start >= now() - interval '7 days'), 0)::bigint   AS week_ms,
                   COALESCE(sum(seg_ms) FILTER (
                       WHERE seg_start >= now() - interval '14 days'
                         AND seg_start <  now() - interval '7 days'), 0)::bigint                            AS prev_week_ms,
                   COALESCE(sum(seg_ms), 0)::bigint          AS all_ms,
                   count(DISTINCT play_id)::int              AS plays,
                   count(DISTINCT track_id)::int             AS distinct_tracks,
                   count(DISTINCT session_id)::int           AS sessions
              FROM seg
        ),
        top_artists AS (
            SELECT btrim(split_part(COALESCE(d_artist, ''), ',', 1)) AS name,
                   sum(seg_ms)::bigint                              AS ms,
                   count(DISTINCT play_id)::int                     AS plays,
                   (array_agg(artwork_url ORDER BY seg_start DESC) FILTER (WHERE artwork_url IS NOT NULL))[1] AS artwork
              FROM seg
             WHERE btrim(COALESCE(d_artist, '')) <> ''
             GROUP BY 1 ORDER BY 2 DESC LIMIT 14
        ),
        on_repeat_30 AS (
            SELECT * FROM (
                SELECT track_id, count(DISTINCT play_id)::int AS plays, sum(seg_ms)::bigint AS ms,
                       min(d_title) AS d_title, min(d_artist) AS d_artist, min(url) AS url,
                       min(artwork_url) AS artwork_url, min(duration_ms) AS duration_ms, min(source) AS source
                  FROM seg WHERE seg_start >= now() - interval '30 days'
                 GROUP BY track_id
            ) r WHERE plays >= 2 ORDER BY plays DESC, ms DESC LIMIT 12
        ),
        on_repeat_all AS (
            SELECT track_id, count(DISTINCT play_id)::int AS plays, sum(seg_ms)::bigint AS ms,
                   min(d_title) AS d_title, min(d_artist) AS d_artist, min(url) AS url,
                   min(artwork_url) AS artwork_url, min(duration_ms) AS duration_ms, min(source) AS source
              FROM seg GROUP BY track_id ORDER BY plays DESC, ms DESC LIMIT 12
        ),
        recent_heard AS (
            SELECT * FROM (
                SELECT DISTINCT ON (track_id)
                       track_id, seg_start, d_title, d_artist, url, artwork_url, duration_ms, source, guild_id
                  FROM seg ORDER BY track_id, seg_start DESC
            ) h ORDER BY seg_start DESC LIMIT 16
        ),
        recent_queued AS (
            SELECT * FROM (
                SELECT DISTINCT ON (qh.track_id)
                       qh.queued_at, qh.track_id, t.url, t.artwork_url, t.duration_ms, t.source,
                       ${DISPLAY_TITLE} AS d_title, ${DISPLAY_ARTIST} AS d_artist
                  FROM queue_history qh
                  JOIN tracks t ON t.id = qh.track_id
                 WHERE qh.user_id = $1
                 ORDER BY qh.track_id, qh.queued_at DESC
            ) q ORDER BY queued_at DESC LIMIT 16
        ),
        clock AS (
            SELECT EXTRACT(HOUR FROM (seg_start AT TIME ZONE $2))::int AS h,
                   sum(seg_ms)::bigint AS ms
              FROM seg GROUP BY 1
        ),
        days AS (
            SELECT (seg_start AT TIME ZONE $2)::date AS d, sum(seg_ms)::bigint AS ms,
                   count(DISTINCT play_id)::int AS plays
              FROM seg
             WHERE seg_start >= now() - interval '91 days'
             GROUP BY 1 ORDER BY 1
        ),
        last_track AS (
            SELECT d_title, d_artist, url, artwork_url, duration_ms, source, seg_start
              FROM seg ORDER BY seg_start DESC LIMIT 1
        ),
        liked_unheard AS (
            SELECT t.title, t.artist, t.url, t.artwork_url, t.duration_ms, t.source, lt.added_at,
                   ${DISPLAY_TITLE} AS d_title, ${DISPLAY_ARTIST} AS d_artist
              FROM liked_tracks lt
              JOIN tracks t ON t.id = lt.track_id
             WHERE lt.user_id = $1 AND lt.track_id NOT IN (SELECT track_id FROM heard)
             ORDER BY lt.added_at DESC LIMIT 14
        ),
        liked_unheard_total AS (
            SELECT count(*)::int AS n FROM liked_tracks lt
             WHERE lt.user_id = $1 AND lt.track_id NOT IN (SELECT track_id FROM heard)
        ),
        on_this_day AS (
            SELECT t.title, t.artist, t.url, t.artwork_url, t.duration_ms, t.source, lt.added_at,
                   ${DISPLAY_TITLE} AS d_title, ${DISPLAY_ARTIST} AS d_artist,
                   EXTRACT(YEAR FROM age(now(), lt.added_at))::int AS years_ago
              FROM liked_tracks lt
              JOIN tracks t ON t.id = lt.track_id
             WHERE lt.user_id = $1
               AND lt.added_at < date_trunc('year', now())
               AND EXTRACT(MONTH FROM (lt.added_at AT TIME ZONE $2)) = EXTRACT(MONTH FROM (now() AT TIME ZONE $2))
               AND EXTRACT(DAY   FROM (lt.added_at AT TIME ZONE $2)) = EXTRACT(DAY   FROM (now() AT TIME ZONE $2))
             ORDER BY lt.added_at DESC LIMIT 8
        ),
        feed AS (
            SELECT qh.queued_at, qh.via, qh.guild_id::text AS guild_id,
                   u.id::text AS uid, u.display_name, u.username, u.avatar_url,
                   t.title, t.artist, t.url, t.artwork_url, t.duration_ms, t.source,
                   ${DISPLAY_TITLE} AS d_title, ${DISPLAY_ARTIST} AS d_artist,
                   (qh.user_id = $1) AS is_you
              FROM queue_history qh
              JOIN tracks t ON t.id = qh.track_id
              LEFT JOIN users u ON u.id = qh.user_id
             WHERE qh.guild_id IN (SELECT g FROM scope)
             ORDER BY qh.queued_at DESC LIMIT 24
        ),
        leaders AS (
            SELECT u.id::text AS uid, COALESCE(u.display_name, u.username, 'Someone') AS name,
                   u.avatar_url, count(*)::int AS queues,
                   (array_agg(t.artwork_url ORDER BY qh.queued_at DESC) FILTER (WHERE t.artwork_url IS NOT NULL))[1] AS last_art,
                   (array_agg(${DISPLAY_TITLE} ORDER BY qh.queued_at DESC))[1] AS last_title,
                   (u.id = $1) AS is_you
              FROM queue_history qh
              JOIN tracks t ON t.id = qh.track_id
              LEFT JOIN users u ON u.id = qh.user_id
             WHERE qh.guild_id IN (SELECT g FROM scope)
               AND qh.queued_at >= now() - interval '7 days'
               AND u.id IS NOT NULL
             GROUP BY u.id, u.display_name, u.username, u.avatar_url
             ORDER BY queues DESC LIMIT 6
        ),
        reach AS (
            SELECT tp.track_id,
                   count(DISTINCT ls.user_id)::int AS listeners,
                   count(DISTINCT tp.id)::int      AS plays,
                   min(${DISPLAY_TITLE}) AS d_title, min(${DISPLAY_ARTIST}) AS d_artist,
                   min(t.url) AS url, min(t.artwork_url) AS artwork_url,
                   min(t.duration_ms) AS duration_ms, min(t.source) AS source
              FROM track_plays tp
              JOIN tracks t ON t.id = tp.track_id
              JOIN listening_segments ls ON ls.play_id = tp.id AND ls.user_id <> $1
             WHERE tp.queued_by = $1
             GROUP BY tp.track_id
             ORDER BY listeners DESC, plays DESC LIMIT 8
        ),
        brought AS (
            SELECT s.track_id, count(DISTINCT s.play_id)::int AS plays,
                   min(s.d_title) AS d_title, min(s.d_artist) AS d_artist, min(s.url) AS url,
                   min(s.artwork_url) AS artwork_url, min(s.duration_ms) AS duration_ms, min(s.source) AS source,
                   (array_agg(COALESCE(u.display_name, u.username, 'Someone') ORDER BY s.play_start DESC))[1] AS by_name,
                   (array_agg(u.avatar_url ORDER BY s.play_start DESC))[1] AS by_avatar
              FROM seg s
              LEFT JOIN users u ON u.id = s.queued_by
             WHERE s.queued_by IS NOT NULL AND s.queued_by <> $1
             GROUP BY s.track_id
             ORDER BY plays DESC LIMIT 8
        )
        SELECT (SELECT row_to_json(x) FROM totals x)                    AS totals,
               (SELECT json_agg(x) FROM top_artists x)                  AS top_artists,
               (SELECT json_agg(x) FROM on_repeat_30 x)                 AS on_repeat_30,
               (SELECT json_agg(x) FROM on_repeat_all x)                AS on_repeat_all,
               (SELECT json_agg(x) FROM recent_heard x)                 AS recent_heard,
               (SELECT json_agg(x) FROM recent_queued x)                AS recent_queued,
               (SELECT json_agg(x) FROM clock x)                        AS clock,
               (SELECT json_agg(x) FROM days x)                         AS days,
               (SELECT row_to_json(x) FROM last_track x)                AS last_track,
               (SELECT json_agg(x) FROM liked_unheard x)                AS liked_unheard,
               (SELECT n FROM liked_unheard_total)                      AS liked_unheard_total,
               (SELECT json_agg(x) FROM on_this_day x)                  AS on_this_day,
               (SELECT json_agg(x) FROM feed x)                         AS feed,
               (SELECT json_agg(x) FROM leaders x)                      AS leaders,
               (SELECT json_agg(x) FROM reach x)                        AS reach,
               (SELECT json_agg(x) FROM brought x)                      AS brought,
               (SELECT first_seen_at FROM users WHERE id = $1)          AS first_seen_at`,
        [userId, tz, ids]
    );

    return rows[0] || {};
}

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

/**
 * The user's saved sort choice for a collection. Default is custom order,
 * except Liked songs, which default to Date-added newest-first so freshly
 * liked/imported songs surface at the top.
 */
export async function getCollectionSort(userId, ref) {
    const { rows } = await db.query(
        `SELECT sort_by, sort_desc FROM collection_sorting WHERE user_id = $1 AND collection_ref = $2`,
        [userId, ref]
    );
    const row = rows[0];
    if (!row) {
        return ref === "nifty:playlist:liked"
            ? { sortBy: "added", sortDesc: true }
            : { sortBy: "custom", sortDesc: false };
    }
    return { sortBy: row.sort_by, sortDesc: row.sort_desc };
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
