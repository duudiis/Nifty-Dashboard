import { parse } from "cookie";

import { verifySession } from "../../lib/jwt.js";

// Time-synced lyrics via LRCLIB. We query our own self-hosted instance first
// (over the internal Docker network — see /opt/lyrics-lrclib, served publicly
// at https://lyrics.dudis.space), then fall back to the public lrclib.net.
// Cached in-process and keyed by artist|title|duration, so upstream is hit at
// most once per song for the whole user base (until redeploy).
const cache = new Map();
const TTL = 1000 * 60 * 60 * 24 * 14; // 14 days
const UA = "Nifty-Dashboard (https://nifty.dudis.space)";

// Primary = our instance (override with LRCLIB_BASE); fallback = public LRCLIB.
const PRIMARY = (process.env.LRCLIB_BASE || "http://lrclib:3300").replace(/\/$/, "");
const FALLBACK = "https://lrclib.net";
const BASES = PRIMARY === FALLBACK ? [FALLBACK] : [PRIMARY, FALLBACK];

// A slow/cold primary shouldn't stall the request — bail and try the fallback.
async function fetchJson(url) {
    const ctrl = new AbortController();
    const timer = setTimeout(() => ctrl.abort(), 4000);
    try {
        const r = await fetch(url, { headers: { "User-Agent": UA }, signal: ctrl.signal });
        if (!r.ok) return null;
        return await r.json();
    } catch {
        return null;
    } finally {
        clearTimeout(timer);
    }
}

// Parses an LRC string into sorted { time(ms), text } lines. A single line may
// carry several timestamps ([..][..] text); we expand each into its own entry.
function parseLRC(lrc) {
    if (!lrc) return [];
    const out = [];
    for (const raw of lrc.split("\n")) {
        const stamps = [...raw.matchAll(/\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g)];
        if (!stamps.length) continue;
        const text = raw.replace(/\[[^\]]*\]/g, "").trim();
        for (const s of stamps) {
            const min = Number(s[1]);
            const sec = Number(s[2]);
            const frac = s[3] ? Number(s[3].padEnd(3, "0")) : 0;
            out.push({ time: min * 60000 + sec * 1000 + frac, text });
        }
    }
    return out.sort((a, b) => a.time - b.time);
}

async function lrclibGet(base, params) {
    return fetchJson(`${base}/api/get?${params}`);
}

async function lrclibSearch(base, title, artist) {
    const qs = new URLSearchParams({ track_name: title, artist_name: artist });
    const arr = await fetchJson(`${base}/api/search?${qs}`);
    return Array.isArray(arr) ? arr[0] : null;
}

export default async function handler(req, res) {
    const cookies = parse(req.headers.cookie || "");
    if (!(await verifySession(cookies.session))) {
        return res.status(401).json({ message: "Not authenticated." });
    }

    const title = (req.query.title || "").trim();
    const artist = (req.query.artist || "").trim();
    const album = (req.query.album || "").trim();
    const durationMs = Number(req.query.duration) || 0;
    const durationSec = durationMs ? Math.round(durationMs / 1000) : 0;
    if (!title || !artist) {
        return res.status(400).json({ message: "Missing title/artist." });
    }

    const key = `${artist}|${title}|${durationSec}`.toLowerCase();
    const hit = cache.get(key);
    if (hit && Date.now() - hit.ts < TTL) {
        return res.status(200).json(hit.data);
    }

    try {
        const params = new URLSearchParams({ track_name: title, artist_name: artist });
        if (album) params.set("album_name", album);
        if (durationSec) params.set("duration", String(durationSec));

        // Try each backend in turn (ours, then lrclib.net); first hit wins.
        let record = null;
        for (const base of BASES) {
            record = await lrclibGet(base, params);
            if (!record) record = await lrclibSearch(base, title, artist);
            if (record) break;
        }

        const data = record
            ? {
                  synced: parseLRC(record.syncedLyrics),
                  plain: record.plainLyrics || "",
                  instrumental: !!record.instrumental,
                  source: "lrclib"
              }
            : { synced: [], plain: "", instrumental: false, source: null };

        cache.set(key, { data, ts: Date.now() });
        return res.status(200).json(data);
    } catch (error) {
        console.error("[Dashboard] Lyrics lookup failed:", error);
        return res.status(200).json({ synced: [], plain: "", instrumental: false, source: null });
    }
}
