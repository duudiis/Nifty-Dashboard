import { parse } from "cookie";

import { verifySession } from "../../lib/jwt.js";
import { parseLink, externalUrl } from "../../sources/links.js";
import { getSourceFor, buildEntityId } from "../../sources/index.js";

// Resolves a pasted platform link (YouTube / Deezer / Spotify) into one
// presentable search item: entities resolve through the browse layer (title,
// artwork, browseId to open the page), tracks through light metadata lookups.
// GET /api/resolve?url=...

const cache = new Map();
const TTL = 1000 * 60 * 30;

async function trackItem(link) {

    if (link.source === "deezer") {
        const res = await fetch(`https://api.deezer.com/track/${link.id}`);
        const t = await res.json();
        if (t?.error) throw new Error("deezer track");
        return {
            kind: "song",
            title: t.title_short || t.title,
            artist: t.artist?.name || "Unknown artist",
            artwork: t.album?.cover_xl || t.album?.cover_big || t.album?.cover_medium || null,
            url: link.url,
            playQuery: link.url
        };
    }

    // YouTube and Spotify both expose key-less oEmbed metadata.
    const oembedUrl = link.source === "spotify"
        ? `https://open.spotify.com/oembed?url=${encodeURIComponent(link.url)}`
        : `https://www.youtube.com/oembed?format=json&url=${encodeURIComponent(link.url)}`;

    const res = await fetch(oembedUrl);
    if (!res.ok) throw new Error(`oembed ${res.status}`);
    const meta = await res.json();

    return {
        kind: link.source === "youtube" ? "video" : "song",
        title: meta.title || "Track",
        artist: meta.author_name || "",
        artwork: meta.thumbnail_url || null,
        url: link.url,
        playQuery: link.url
    };

}

async function entityItem(link) {

    const browseId = buildEntityId(link.source, link.kind, link.id);
    const resolved = getSourceFor(browseId);
    if (!resolved) throw new Error("unroutable link");

    const data = await resolved.source.browse(resolved.kind, resolved.id);

    return {
        kind: link.kind,
        title: data.title,
        subtitle: data.subtitle || data.type,
        artwork: data.artwork || null,
        browseId,
        url: data.url || externalUrl(link.source, link.kind, link.id)
    };

}

export default async function handler(req, res) {

    const cookies = parse(req.headers.cookie || "");
    if (!(await verifySession(cookies.session))) {
        return res.status(401).json({ message: "Not authenticated." });
    }

    const link = parseLink(req.query.url || "");
    if (!link) {
        return res.status(200).json({ item: null });
    }

    const cacheKey = `${link.source}:${link.kind}:${link.id}`;
    const hit = cache.get(cacheKey);
    if (hit && Date.now() - hit.ts < TTL) {
        return res.status(200).json(hit.data);
    }

    try {
        const item = link.kind === "track" ? await trackItem(link) : await entityItem(link);
        const data = { item };
        cache.set(cacheKey, { data, ts: Date.now() });
        res.setHeader("Cache-Control", "no-store");
        return res.status(200).json(data);
    } catch (error) {
        console.error("[Dashboard] Resolve failed:", error.message);
        return res.status(200).json({ item: null });
    }

}
