// "Auto" search mode: Deezer and YouTube blended into one result set.
//
// Deezer stays the authority for music — its songs, albums, artists and
// playlists are shown as-is. YouTube adds what Deezer can't offer: normal
// YouTube videos and public playlists, plus any YouTube Music songs Deezer
// doesn't have (deduplicated by title + primary artist; Deezer always wins).
// YouTube Music albums and artists are dropped entirely.

import deezer from "../deezer/index.js";
import youtube from "../youtube/index.js";

const ID = "auto";

// How many unmatched YouTube songs may join the Songs section — enough to
// surface YouTube-only tracks without burying the section.
const MAX_EXTRA_SONGS = 10;

// Loose text normalization for cross-source matching: accents, parentheticals
// ("(feat. X)", "[Official Video]"), trailing feat/with clauses and punctuation
// all go, so "Song (feat. B)" by "A & B" meets "Song" by "A".
function normalize(text) {
    return String(text || "")
        .toLowerCase()
        .normalize("NFKD")
        .replace(/[\u0300-\u036f]/g, "")
        .replace(/[([{].*?[)\]}]/g, " ")
        .replace(/\s(?:feat|ft|with)\b.*$/, " ")
        .replace(/[^a-z0-9]+/g, " ")
        .trim();
}

function primaryArtist(artist) {
    return normalize(String(artist || "").split(/,|&|\sx\s|×/i)[0]);
}

function songKey(item) {
    const title = normalize(item.title);
    const artist = primaryArtist(item.artist);
    return title && artist ? `${title}|${artist}` : null;
}

const itemsOf = (result, kind) => result.sections.find((s) => s.kind === kind)?.items || [];

async function search(query) {
    const none = { sections: [] };
    const [dz, yt] = await Promise.all([
        deezer.search(query).catch(() => none),
        youtube.search(query).catch(() => none)
    ]);

    // Songs: all of Deezer's, then the YouTube songs it doesn't have.
    const songs = itemsOf(dz, "song");
    const seen = new Set(songs.map(songKey));
    const extras = itemsOf(yt, "song")
        .filter((item) => {
            const key = songKey(item);
            if (!key || seen.has(key)) return false;
            seen.add(key);
            return true;
        })
        .slice(0, MAX_EXTRA_SONGS);

    const sections = [];
    const push = (kind, title, items) => { if (items.length) sections.push({ kind, title, items }); };

    push("song", "Songs", [...songs, ...extras]);
    push("video", "Videos", itemsOf(yt, "video"));
    push("album", "Albums", itemsOf(dz, "album"));
    push("artist", "Artists", itemsOf(dz, "artist"));
    push("playlist", "Playlists", [...itemsOf(dz, "playlist"), ...itemsOf(yt, "playlist")]);

    return { sections };
}

export default {
    id: ID,
    search,
    // Auto never mints its own entity ids — every item keeps the deezer:/
    // youtube: namespaced browseId of the source it came from, so browsing
    // always routes to the owning source and this is never reached.
    browse() {
        throw new Error("The auto source has no browse of its own.");
    }
};
