import { parse } from "cookie";

import { verifySession } from "../../lib/jwt.js";
import { getHomeData } from "../../lib/db.js";
import { homeTrack } from "../../lib/homeShape.js";

// Everything the home screen reads from the database, in one request.
//
//   GET /api/home?tz=<IANA zone>&guilds=<comma-joined snowflakes>
//
// Per-user and already fast, so it is never cached. The client fetches it once
// per mount — the home screen adds no intervals; live player and queue state
// ride the WebSocket deltas the context already applies.

const isSnowflake = (s) => /^\d{5,20}$/.test(s);

// Postgres and Intl share the same zone database, so this rejects exactly what
// AT TIME ZONE would reject — and it matters: the same history peaks at 23:00
// read as UTC and 20:00 read as São Paulo, which is the difference between
// calling someone a night owl and an evening listener.
function safeZone(tz) {
    if (!tz) return "UTC";
    try {
        new Intl.DateTimeFormat(undefined, { timeZone: tz });
        return tz;
    } catch {
        return "UTC";
    }
}

export default async function handler(req, res) {

    const cookies = parse(req.headers.cookie || "");
    const user = await verifySession(cookies.session);
    if (!user) {
        return res.status(401).json({ message: "Not authenticated." });
    }

    const tz = safeZone(String(req.query.tz || "").trim());
    const guildIds = [...new Set(String(req.query.guilds || "").split(",").map((g) => g.trim()).filter(isSnowflake))].slice(0, 12);

    try {
        res.setHeader("Cache-Control", "no-store");
        const d = await getHomeData(user.id, { tz, guildIds });

        const arr = (v) => (Array.isArray(v) ? v : []);
        const person = (r) => ({
            id: r.uid || null,
            name: r.display_name || r.username || "Someone",
            avatar: r.avatar_url || null
        });

        return res.status(200).json({
            totals: d.totals || { today_ms: 0, week_ms: 0, prev_week_ms: 0, all_ms: 0, plays: 0, distinct_tracks: 0, sessions: 0 },
            firstSeenAt: d.first_seen_at || null,

            lastTrack: d.last_track
                ? { ...homeTrack(d.last_track), heardAt: d.last_track.seg_start }
                : null,

            topArtists: arr(d.top_artists).map((a) => ({
                name: a.name, ms: Number(a.ms) || 0, plays: a.plays, artwork: a.artwork || null
            })),

            onRepeat30: arr(d.on_repeat_30).map((r) => ({ ...homeTrack(r), plays: r.plays, ms: Number(r.ms) || 0 })),
            onRepeatAll: arr(d.on_repeat_all).map((r) => ({ ...homeTrack(r), plays: r.plays, ms: Number(r.ms) || 0 })),

            recentHeard: arr(d.recent_heard).map((r) => ({ ...homeTrack(r), heardAt: r.seg_start, guildId: r.guild_id != null ? String(r.guild_id) : null })),
            recentQueued: arr(d.recent_queued).map((r) => ({ ...homeTrack(r), queuedAt: r.queued_at })),

            likedUnheard: arr(d.liked_unheard).map((r) => ({ ...homeTrack(r), addedAt: r.added_at })),
            likedUnheardTotal: d.liked_unheard_total || 0,

            onThisDay: arr(d.on_this_day).map((r) => ({ ...homeTrack(r), addedAt: r.added_at, yearsAgo: r.years_ago })),

            clock: arr(d.clock).map((c) => ({ hour: c.h, ms: Number(c.ms) || 0 })),
            days: arr(d.days).map((r) => ({ date: r.d, ms: Number(r.ms) || 0, plays: r.plays })),

            feed: arr(d.feed).map((r) => ({
                queuedAt: r.queued_at,
                via: r.via || null,
                guildId: r.guild_id,
                isYou: !!r.is_you,
                by: person(r),
                track: homeTrack(r)
            })),

            leaders: arr(d.leaders).map((r) => ({
                id: r.uid, name: r.name, avatar: r.avatar_url || null,
                queues: r.queues, isYou: !!r.is_you,
                lastArt: r.last_art || null, lastTitle: r.last_title || null
            })),

            reach: arr(d.reach).map((r) => ({ ...homeTrack(r), listeners: r.listeners, plays: r.plays })),

            brought: arr(d.brought).map((r) => ({
                ...homeTrack(r), plays: r.plays,
                by: { name: r.by_name || "Someone", avatar: r.by_avatar || null }
            }))
        });

    } catch (error) {
        console.error("[Dashboard] /api/home failed:", error.message);
        return res.status(500).json({ message: "Database unavailable." });
    }
}
