// Deezer search source, backed by Deezer's public, key-less JSON API
// (https://api.deezer.com). Returns the same normalized shapes every source
// produces. Playback is handled by the bot: it resolves the deezer.com URLs we
// hand back through its LavaSrc Deezer source (which needs an arl + master key
// configured bot-side to stream full tracks).

import { buildEntityId } from "../ids.js";

const ID = "deezer";
const API = "https://api.deezer.com";

async function api(path) {
    const res = await fetch(`${API}${path}`, { headers: { "User-Agent": "Nifty-Dashboard" } });
    if (!res.ok) throw new Error(`Deezer ${path} -> ${res.status}`);
    const json = await res.json();
    // Deezer signals errors in-body with HTTP 200 (e.g. quota, bad id).
    if (json?.error) throw new Error(`Deezer ${path} -> ${json.error.message || json.error.type || "error"}`);
    return json;
}

/* ---------------------------------------------------------------- helpers */

// Whole seconds -> m:ss / h:mm:ss (the UI renders duration as a string).
function clock(seconds) {
    const s = Math.max(0, Math.floor(seconds || 0));
    const m = Math.floor((s % 3600) / 60);
    const sec = String(s % 60).padStart(2, "0");
    const h = Math.floor(s / 3600);
    return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

// 5167294 -> "5.2M", 12000 -> "12K".
function compact(n) {
    if (n >= 1e6) return `${(n / 1e6).toFixed(1).replace(/\.0$/, "")}M`;
    if (n >= 1e3) return `${(n / 1e3).toFixed(1).replace(/\.0$/, "")}K`;
    return `${n}`;
}

// Best square art from a Deezer object, else built from its md5 image hash.
// `type` is the CDN image folder: "cover" (tracks/albums), "artist", "playlist".
function art(obj, type = "cover") {
    if (!obj) return null;
    return (
        obj.cover_xl || obj.cover_big || obj.cover_medium || obj.cover ||
        obj.picture_xl || obj.picture_big || obj.picture_medium || obj.picture ||
        (obj.md5_image
            ? `https://cdn-images.dzcdn.net/images/${type}/${obj.md5_image}/500x500-000000-80-0-0.jpg`
            : null)
    );
}

function link(kind, id, fallbackUrl) {
    return fallbackUrl || `https://www.deezer.com/${kind}/${id}`;
}

/* ------------------------------------------------------------ normalizers */

function track(t) {
    const url = link("track", t.id, t.link);
    return {
        title: t.title_short || t.title,
        artist: t.artist?.name || "Unknown artist",
        duration: clock(t.duration),
        artwork: art(t.album, "cover") || art(t, "cover"),
        url,
        // The bot resolves the deezer.com URL directly — no search fallback needed.
        playQuery: url
    };
}

function albumItem(a) {
    return {
        kind: "album",
        title: a.title,
        subtitle: a.artist?.name || "",
        artwork: art(a, "cover"),
        browseId: buildEntityId(ID, "album", a.id)
    };
}

function artistItem(a) {
    return {
        kind: "artist",
        title: a.name,
        subtitle: a.nb_fan ? `${compact(a.nb_fan)} fans` : "Artist",
        artwork: art(a, "artist"),
        browseId: buildEntityId(ID, "artist", a.id)
    };
}

function playlistItem(p) {
    return {
        kind: "playlist",
        title: p.title,
        subtitle: p.user?.name || p.creator?.name || `${p.nb_tracks || 0} tracks`,
        artwork: art(p, "playlist"),
        browseId: buildEntityId(ID, "playlist", p.id)
    };
}

/* ---------------------------------------------------------------- search */

async function search(query) {
    const q = encodeURIComponent(query);
    const empty = { data: [] };
    const [tracks, albums, artists, playlists] = await Promise.all([
        api(`/search/track?q=${q}&limit=25`).catch(() => empty),
        api(`/search/album?q=${q}&limit=20`).catch(() => empty),
        api(`/search/artist?q=${q}&limit=20`).catch(() => empty),
        api(`/search/playlist?q=${q}&limit=20`).catch(() => empty)
    ]);

    const sections = [];
    const push = (kind, title, items) => { if (items.length) sections.push({ kind, title, items }); };

    push("song", "Songs", (tracks.data || []).map((t) => ({ kind: "song", ...track(t) })));
    push("album", "Albums", (albums.data || []).map(albumItem));
    push("artist", "Artists", (artists.data || []).map(artistItem));
    push("playlist", "Playlists", (playlists.data || []).map(playlistItem));

    return { sections };
}

/* ---------------------------------------------------------------- browse */

// Album & playlist pages share one collection shape.
async function browseCollection(kind, id) {
    const data = await api(`/${kind}/${id}`);
    const isAlbum = kind === "album";
    return {
        type: kind,
        title: data.title,
        subtitle: isAlbum
            ? data.artist?.name || ""
            : data.creator?.name || data.user?.name || "",
        artwork: art(data, isAlbum ? "cover" : "playlist"),
        releaseDate: isAlbum ? data.release_date || null : null,
        url: link(kind, id, data.link),
        tracks: (data.tracks?.data || []).map(track),
        // Queue the whole collection in one go: the bot loads the Deezer URL and
        // expands it server-side, so the entire (possibly long) list plays in order.
        playUrl: link(kind, id, data.link)
    };
}

async function browseArtist(id) {
    const empty = { data: [] };
    const [artist, top, albums] = await Promise.all([
        api(`/artist/${id}`),
        api(`/artist/${id}/top?limit=10`).catch(() => empty),
        api(`/artist/${id}/albums?limit=50`).catch(() => empty)
    ]);

    return {
        type: "artist",
        title: artist.name,
        subtitle: artist.nb_fan ? `${compact(artist.nb_fan)} fans` : "",
        artwork: art(artist, "artist"),
        url: link("artist", id, artist.link),
        topSongs: (top.data || []).map(track),
        albums: (albums.data || []).map((a) => ({
            title: a.title,
            subtitle: a.release_date ? a.release_date.slice(0, 4) : a.record_type || "",
            releaseDate: a.release_date || null,
            artwork: art(a, "cover"),
            browseId: buildEntityId(ID, "album", a.id)
        }))
    };
}

export default {
    id: ID,
    search,
    browse(kind, id) {
        return kind === "artist" ? browseArtist(id) : browseCollection(kind, id);
    }
};
