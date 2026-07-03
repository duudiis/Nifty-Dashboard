// Tidal source, backed by the same api.tidal.com endpoints (and the same
// TIDAL_TOKEN) the bot's LavaSrc Tidal source uses. Without a token the
// source degrades gracefully: links still parse and queue (the bot resolves
// them itself), but entity pages can't list tracks.

import { buildEntityId } from "../ids.js";

const ID = "tidal";
const API = "https://api.tidal.com/v1";
const PAGE = 100;
const MAX_ITEMS = 1000;

function hasToken() {
    return !!process.env.TIDAL_TOKEN;
}

function country() {
    return process.env.TIDAL_COUNTRY_CODE || "US";
}

async function api(path, params = {}) {
    const query = new URLSearchParams({ countryCode: country(), ...params });
    const res = await fetch(`${API}${path}?${query}`, {
        headers: { "x-tidal-token": process.env.TIDAL_TOKEN }
    });
    if (!res.ok) throw new Error(`Tidal ${path} -> ${res.status}`);
    return res.json();
}

/* --------------------------------------------------------------- helpers */

function clock(seconds) {
    const s = Math.max(0, Math.floor(seconds || 0));
    const m = Math.floor((s % 3600) / 60);
    const sec = String(s % 60).padStart(2, "0");
    const h = Math.floor(s / 3600);
    return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

// Tidal image ids are dash-separated uuids mapped onto a CDN path.
function image(uuid, size = "640x640") {
    return uuid ? `https://resources.tidal.com/images/${String(uuid).replace(/-/g, "/")}/${size}.jpg` : null;
}

const external = (kind, id) => `https://tidal.com/browse/${kind}/${id}`;

function track(t) {
    const url = t.url || external("track", t.id);
    return {
        title: t.title,
        artist: (t.artists || []).map((a) => a.name).join(", ") || t.artist?.name || "Unknown artist",
        artistBrowseId: (t.artists?.[0]?.id || t.artist?.id)
            ? buildEntityId(ID, "artist", t.artists?.[0]?.id || t.artist.id)
            : null,
        duration: clock(t.duration),
        artwork: image(t.album?.cover),
        url,
        playQuery: url
    };
}

// Paged list endpoints ({ items, totalNumberOfItems }); entries may be raw
// tracks or { item, type } wrappers.
async function allItems(path) {
    const collected = [];
    for (let offset = 0; offset < MAX_ITEMS; offset += PAGE) {
        const json = await api(path, { limit: PAGE, offset });
        const items = (json.items || [])
            .map((entry) => entry.item || entry)
            .filter((entry) => !entry.type || String(entry.type).toLowerCase() === "track");
        collected.push(...items);
        if (collected.length >= (json.totalNumberOfItems ?? 0) || items.length === 0) break;
    }
    return collected;
}

/* ---------------------------------------------------------------- browse */

async function browseAlbum(id) {
    if (!hasToken()) throw new Error("TIDAL_TOKEN not configured.");

    const [album, items] = await Promise.all([
        api(`/albums/${id}`),
        allItems(`/albums/${id}/items`)
    ]);

    return {
        type: "album",
        title: album.title,
        subtitle: (album.artists || []).map((a) => a.name).join(", ") || album.artist?.name || "",
        artistBrowseId: (album.artists?.[0]?.id || album.artist?.id)
            ? buildEntityId(ID, "artist", album.artists?.[0]?.id || album.artist.id)
            : null,
        artwork: image(album.cover),
        releaseDate: album.releaseDate || null,
        url: external("album", id),
        tracks: items.map(track),
        playUrl: external("album", id)
    };
}

async function browsePlaylist(id) {
    if (!hasToken()) throw new Error("TIDAL_TOKEN not configured.");

    const [playlist, items] = await Promise.all([
        api(`/playlists/${id}`),
        allItems(`/playlists/${id}/items`)
    ]);

    return {
        type: "playlist",
        title: playlist.title,
        subtitle: playlist.creator?.name || "Tidal",
        artwork: image(playlist.squareImage || playlist.image, "750x750"),
        url: external("playlist", id),
        tracks: items.map(track),
        playUrl: external("playlist", id)
    };
}

async function browseArtist(id) {
    if (!hasToken()) throw new Error("TIDAL_TOKEN not configured.");

    const [artist, top, albums] = await Promise.all([
        api(`/artists/${id}`),
        api(`/artists/${id}/toptracks`, { limit: 10 }).catch(() => ({ items: [] })),
        api(`/artists/${id}/albums`, { limit: 50 }).catch(() => ({ items: [] }))
    ]);

    return {
        type: "artist",
        title: artist.name,
        subtitle: "Tidal artist",
        artwork: image(artist.picture, "750x750"),
        url: external("artist", id),
        topSongs: (top.items || []).map(track),
        albums: (albums.items || []).map((a) => ({
            title: a.title,
            subtitle: a.releaseDate ? a.releaseDate.slice(0, 4) : "",
            releaseDate: a.releaseDate || null,
            artwork: image(a.cover),
            browseId: buildEntityId(ID, "album", a.id)
        }))
    };
}

export default {
    id: ID,

    // Tidal is used for links and entity pages; text search stays with the
    // default blended source.
    async search() {
        return { sections: [] };
    },

    browse(kind, id) {
        if (kind === "artist") return browseArtist(id);
        if (kind === "playlist") return browsePlaylist(id);
        return browseAlbum(id);
    },

    // Used by /api/resolve for pasted track links.
    async trackItem(id) {
        if (!hasToken()) {
            return {
                kind: "song",
                title: "Tidal track",
                artist: "",
                artwork: null,
                url: external("track", id),
                playQuery: external("track", id)
            };
        }
        return { kind: "song", ...track(await api(`/tracks/${id}`)) };
    }
};
