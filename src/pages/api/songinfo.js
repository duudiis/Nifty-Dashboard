import { parse } from "cookie";

import { verifySession } from "../../lib/jwt.js";

// Extra song context from free, key-less APIs:
//   • iTunes Search  → album, genre, release date, country (the "facts")
//   • Wikipedia REST → a short artist blurb ("fun facts" / bio)
// Cached in-process per artist|title so each song is looked up once for everyone.
const cache = new Map();
const TTL = 1000 * 60 * 60 * 24 * 14; // 14 days
const UA = "Nifty-Dashboard (https://nifty.dudis.space)";

async function itunes(title, artist) {
    try {
        const term = encodeURIComponent(`${artist} ${title}`);
        const r = await fetch(`https://itunes.apple.com/search?term=${term}&entity=song&limit=1`);
        if (!r.ok) return null;
        const j = await r.json();
        const t = j.results?.[0];
        if (!t) return null;
        return {
            track: t.trackName,
            artist: t.artistName,
            album: t.collectionName,
            genre: t.primaryGenreName,
            releaseDate: t.releaseDate,
            country: t.country,
            artwork: t.artworkUrl100?.replace("100x100bb", "600x600bb") || null,
            albumUrl: t.collectionViewUrl || null
        };
    } catch {
        return null;
    }
}

async function wikipedia(artist) {
    try {
        const r = await fetch(
            `https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(artist)}?redirect=true`,
            { headers: { "User-Agent": UA } }
        );
        if (!r.ok) return null;
        const j = await r.json();
        if (!j.extract || j.type === "disambiguation") return null;
        return {
            extract: j.extract,
            url: j.content_urls?.desktop?.page || null,
            thumbnail: j.thumbnail?.source || null
        };
    } catch {
        return null;
    }
}

export default async function handler(req, res) {
    const cookies = parse(req.headers.cookie || "");
    if (!(await verifySession(cookies.session))) {
        return res.status(401).json({ message: "Not authenticated." });
    }

    const title = (req.query.title || "").trim();
    const artist = (req.query.artist || "").trim();
    if (!title || !artist) {
        return res.status(400).json({ message: "Missing title/artist." });
    }

    const key = `${artist}|${title}`.toLowerCase();
    const hit = cache.get(key);
    if (hit && Date.now() - hit.ts < TTL) {
        return res.status(200).json(hit.data);
    }

    const [itunesInfo, artistInfo] = await Promise.all([itunes(title, artist), wikipedia(artist)]);
    const data = { itunes: itunesInfo, artist: artistInfo };

    cache.set(key, { data, ts: Date.now() });
    return res.status(200).json(data);
}
