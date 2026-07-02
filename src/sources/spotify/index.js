// Spotify source, backed by the Web API (client-credentials flow) when
// SPOTIFY_CLIENT_ID / SPOTIFY_CLIENT_SECRET are configured. Without
// credentials it degrades to the public oEmbed endpoint: entity pages still
// render (title + artwork + whole-collection play URL that the bot expands),
// just without tracklists.

import { buildEntityId } from "../ids.js";

const ID = "spotify";
const API = "https://api.spotify.com/v1";

/* ------------------------------------------------------------------ auth */

let token = null; // { value, expiresAt }

function hasCredentials() {
    return !!(process.env.SPOTIFY_CLIENT_ID && process.env.SPOTIFY_CLIENT_SECRET);
}

async function getToken() {
    if (token && Date.now() < token.expiresAt) return token.value;

    const basic = Buffer.from(
        `${process.env.SPOTIFY_CLIENT_ID}:${process.env.SPOTIFY_CLIENT_SECRET}`
    ).toString("base64");

    const res = await fetch("https://accounts.spotify.com/api/token", {
        method: "POST",
        headers: {
            Authorization: `Basic ${basic}`,
            "Content-Type": "application/x-www-form-urlencoded"
        },
        body: "grant_type=client_credentials"
    });
    if (!res.ok) throw new Error(`Spotify token -> ${res.status}`);

    const json = await res.json();
    token = { value: json.access_token, expiresAt: Date.now() + (json.expires_in - 60) * 1000 };
    return token.value;
}

async function api(path) {
    const res = await fetch(`${API}${path}`, {
        headers: { Authorization: `Bearer ${await getToken()}` }
    });
    if (!res.ok) throw new Error(`Spotify ${path} -> ${res.status}`);
    return res.json();
}

/* --------------------------------------------------------------- helpers */

function clock(ms) {
    const s = Math.max(0, Math.floor((ms || 0) / 1000));
    const m = Math.floor((s % 3600) / 60);
    const sec = String(s % 60).padStart(2, "0");
    const h = Math.floor(s / 3600);
    return h > 0 ? `${h}:${String(m).padStart(2, "0")}:${sec}` : `${m}:${sec}`;
}

const art = (images) => images?.[0]?.url || null;
const external = (kind, id) => `https://open.spotify.com/${kind}/${id}`;

function track(t, albumArt = null) {
    const url = t.external_urls?.spotify || external("track", t.id);
    return {
        title: t.name,
        artist: (t.artists || []).map((a) => a.name).join(", ") || "Unknown artist",
        duration: clock(t.duration_ms),
        artwork: art(t.album?.images) || albumArt,
        url,
        playQuery: url
    };
}

/* ---------------------------------------------------- oEmbed fallback */

// Public, key-less: title + thumbnail for any Spotify URL. Used when the Web
// API credentials are missing so pasted links still resolve to something
// presentable — the bot expands the URL itself at queue time.
async function oembed(kind, id) {
    const res = await fetch(
        `https://open.spotify.com/oembed?url=${encodeURIComponent(external(kind, id))}`
    );
    if (!res.ok) throw new Error(`Spotify oembed -> ${res.status}`);
    const json = await res.json();
    return {
        type: kind,
        title: json.title || `Spotify ${kind}`,
        subtitle: "Spotify",
        artwork: json.thumbnail_url || null,
        url: external(kind, id),
        tracks: [],
        ...(kind !== "artist" ? { playUrl: external(kind, id) } : {})
    };
}

/* ---------------------------------------------------------------- browse */

async function browseCollection(kind, id) {
    if (!hasCredentials()) return oembed(kind, id);

    const data = await api(`/${kind}s/${id}`);
    const isAlbum = kind === "album";
    const artwork = art(data.images);

    const rawTracks = (data.tracks?.items || [])
        .map((entry) => (isAlbum ? entry : entry.track))
        .filter(Boolean);

    return {
        type: kind,
        title: data.name,
        subtitle: isAlbum
            ? (data.artists || []).map((a) => a.name).join(", ")
            : data.owner?.display_name || "",
        artwork,
        releaseDate: isAlbum ? data.release_date || null : null,
        url: data.external_urls?.spotify || external(kind, id),
        tracks: rawTracks.map((t) => track(t, artwork)),
        playUrl: data.external_urls?.spotify || external(kind, id)
    };
}

async function browseArtist(id) {
    if (!hasCredentials()) return oembed("artist", id);

    const [artist, top, albums] = await Promise.all([
        api(`/artists/${id}`),
        api(`/artists/${id}/top-tracks?market=US`).catch(() => ({ tracks: [] })),
        api(`/artists/${id}/albums?include_groups=album,single&limit=50`).catch(() => ({ items: [] }))
    ]);

    return {
        type: "artist",
        title: artist.name,
        subtitle: artist.followers?.total
            ? `${Intl.NumberFormat("en", { notation: "compact" }).format(artist.followers.total)} followers`
            : "",
        artwork: art(artist.images),
        url: artist.external_urls?.spotify || external("artist", id),
        topSongs: (top.tracks || []).map((t) => track(t)),
        albums: (albums.items || []).map((a) => ({
            title: a.name,
            subtitle: a.release_date ? a.release_date.slice(0, 4) : a.album_type || "",
            releaseDate: a.release_date || null,
            artwork: art(a.images),
            browseId: buildEntityId(ID, "album", a.id)
        }))
    };
}

export default {
    id: ID,

    // Spotify is used for links and entity pages; text search stays with the
    // default blended source.
    async search() {
        return { sections: [] };
    },

    browse(kind, id) {
        return kind === "artist" ? browseArtist(id) : browseCollection(kind, id);
    }
};
