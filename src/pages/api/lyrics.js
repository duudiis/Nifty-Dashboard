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

// mm:ss(.xx) -> milliseconds. `frac` is the optional sub-second group.
function tsToMs(min, sec, frac) {
    const f = frac ? Number(frac.padEnd(3, "0")) : 0;
    return Number(min) * 60000 + Number(sec) * 1000 + f;
}

// Extracts per-word timing from an Enhanced LRC ("A2") line body — the text
// left after the line-level [..] stamps are removed, e.g.
//   "<00:12.00>Never <00:12.40>gonna <00:12.90>give"
// Each word's text runs from its <..> tag up to the next tag (trailing space
// included, so spacing survives rendering). Returns null for plain LRC lines.
function parseWords(body) {
    const matches = [...body.matchAll(/<(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?>/g)];
    if (!matches.length) return null;
    const words = [];
    for (let i = 0; i < matches.length; i++) {
        const m = matches[i];
        const start = m.index + m[0].length;
        const end = i + 1 < matches.length ? matches[i + 1].index : body.length;
        const text = body.slice(start, end);
        if (text) words.push({ time: tsToMs(m[1], m[2], m[3]), text });
    }
    return words.length ? words : null;
}

// Parses an LRC string into sorted { time(ms), text, words? } lines. A single
// line may carry several timestamps ([..][..] text); we expand each into its
// own entry. Lines using the Enhanced LRC <..> word tags also get a `words`
// array; plain lines simply omit it (so the viewer falls back to line-level).
function parseLRC(lrc) {
    if (!lrc) return [];
    const out = [];
    for (const raw of lrc.split("\n")) {
        const stamps = [...raw.matchAll(/\[(\d{1,2}):(\d{2})(?:[.:](\d{1,3}))?\]/g)];
        if (!stamps.length) continue;
        const body = raw.replace(/\[[^\]]*\]/g, ""); // drop line stamps, keep <..>
        const words = parseWords(body);
        const text = body.replace(/<[^>]*>/g, "").trim();
        for (const s of stamps) {
            const entry = { time: tsToMs(s[1], s[2], s[3]), text };
            if (words) entry.words = words;
            out.push(entry);
        }
    }
    return out.sort((a, b) => a.time - b.time);
}

// A synced string carries word-by-word timing if it has Enhanced LRC <..> tags.
function hasWordTiming(synced) {
    return typeof synced === "string" && /<\d{1,2}:\d{2}(?:[.:]\d{1,3})?>/.test(synced);
}

// Rank how good a record is, so we can prefer the richest lyrics available:
//   3 = word-by-word synced, 2 = line synced, 1 = plain/instrumental, 0 = none.
function rank(rec) {
    if (!rec) return 0;
    if (hasWordTiming(rec.syncedLyrics)) return 3;
    if (rec.syncedLyrics) return 2;
    if (rec.plainLyrics || rec.instrumental) return 1;
    return 0;
}

// Keep the better of two records; ties keep `a` (the earlier/more authoritative).
function preferred(a, b) {
    return rank(b) > rank(a) ? b : a;
}

async function lrclibGet(base, params) {
    return fetchJson(`${base}/api/get?${params}`);
}

// /api/search returns several candidates; pick the highest-ranked (word-synced
// first), keeping search relevance order to break ties.
async function lrclibSearch(base, title, artist) {
    const qs = new URLSearchParams({ track_name: title, artist_name: artist });
    const arr = await fetchJson(`${base}/api/search?${qs}`);
    if (!Array.isArray(arr) || !arr.length) return null;
    return arr.reduce((best, cur) => preferred(best, cur));
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

        // Try each backend in turn (ours first, then lrclib.net). Within a
        // backend, prefer word-by-word lyrics: an exact /api/get can tie-break
        // onto a line-synced take when a word-synced one also matches, so unless
        // /api/get already gave us word timing we also check /api/search and
        // keep whichever ranks higher. The first backend with anything usable
        // wins, so lrclib.net stays a pure fallback (no extra calls when ours
        // already has the song).
        let record = null;
        for (const base of BASES) {
            const direct = await lrclibGet(base, params);
            if (rank(direct) === 3) {
                record = direct; // word-synced: best possible, no need to search
                break;
            }
            record = preferred(direct, await lrclibSearch(base, title, artist));
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
