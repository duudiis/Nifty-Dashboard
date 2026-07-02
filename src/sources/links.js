// Detects platform links (YouTube, Deezer, Spotify) and maps them onto the
// source/kind/id space the browse layer already speaks. Isomorphic — the
// client uses it to switch the search bar into link mode, the server to
// resolve the link into a presentable item.

const PATTERNS = [
    // Spotify: open.spotify.com/[intl-xx/]{track|album|playlist|artist}/{id}
    {
        source: "spotify",
        re: /^https?:\/\/open\.spotify\.com\/(?:intl-[a-z]{2}\/)?(track|album|playlist|artist)\/([A-Za-z0-9]+)/i,
        map: (m) => ({ kind: m[1].toLowerCase(), id: m[2] })
    },
    // Deezer: deezer.com/[lang/]{track|album|playlist|artist}/{id}
    {
        source: "deezer",
        re: /^https?:\/\/(?:www\.)?deezer\.com\/(?:[a-z]{2}\/)?(track|album|playlist|artist)\/(\d+)/i,
        map: (m) => ({ kind: m[1].toLowerCase(), id: m[2] })
    },
    // YouTube / YouTube Music playlist (also covers OLAK5uy_ album lists)
    {
        source: "youtube",
        re: /^https?:\/\/(?:www\.|music\.)?youtube\.com\/playlist\?(?:.*&)?list=([A-Za-z0-9_-]+)/i,
        map: (m) => ({ kind: "playlist", id: m[1] })
    },
    // YouTube channel (artist) by id
    {
        source: "youtube",
        re: /^https?:\/\/(?:www\.|music\.)?youtube\.com\/channel\/(UC[A-Za-z0-9_-]+)/i,
        map: (m) => ({ kind: "artist", id: m[1] })
    },
    // YouTube watch URLs (plain video or music)
    {
        source: "youtube",
        re: /^https?:\/\/(?:www\.|music\.|m\.)?youtube\.com\/watch\?(?:.*&)?v=([A-Za-z0-9_-]{6,})/i,
        map: (m) => ({ kind: "track", id: m[1] })
    },
    // youtu.be short links
    {
        source: "youtube",
        re: /^https?:\/\/youtu\.be\/([A-Za-z0-9_-]{6,})/i,
        map: (m) => ({ kind: "track", id: m[1] })
    }
];

/** Quick test: does this look like a link at all? */
export function looksLikeUrl(text) {
    return /^https?:\/\/\S+$/i.test((text || "").trim());
}

/**
 * Parses a platform link into { source, kind, id, url }.
 * kind is track | album | playlist | artist. Returns null when the link
 * doesn't belong to a supported platform entity.
 */
export function parseLink(text) {
    const url = (text || "").trim();
    if (!looksLikeUrl(url)) return null;

    for (const { source, re, map } of PATTERNS) {
        const m = url.match(re);
        if (m) return { source, url, ...map(m) };
    }

    return null;
}

/** Canonical public URL for an entity on its platform. */
export function externalUrl(source, kind, id) {
    switch (source) {
        case "spotify": return `https://open.spotify.com/${kind}/${id}`;
        case "deezer": return `https://www.deezer.com/${kind}/${id}`;
        case "youtube":
            if (kind === "artist") return `https://www.youtube.com/channel/${id}`;
            if (kind === "track") return `https://www.youtube.com/watch?v=${id}`;
            return `https://www.youtube.com/playlist?list=${id.replace(/^VL/, "")}`;
        default: return null;
    }
}
