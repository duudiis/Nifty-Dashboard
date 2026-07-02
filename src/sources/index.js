// Search-source registry.
//
// Every source implements the same small interface so the API routes and the UI
// never care where results came from:
//
//   id                         unique source key, also the entity-id prefix
//   async search(query)        -> { sections: [{ kind, title, items }] }
//   async browse(kind, id)     -> album/playlist collection or artist page
//
// search() returns sections of normalized items. Track items carry a ready play
// URL (`url` / `playQuery`); album/artist/playlist items carry a namespaced
// `browseId`. browse() is handed the kind + native id parsed from that browseId.

import deezer from "./deezer/index.js";
import youtube from "./youtube/index.js";
import spotify from "./spotify/index.js";
import auto from "./auto/index.js";
import { SEARCH_SOURCE } from "./config.js";
import { parseEntityId } from "./ids.js";

export { buildEntityId, parseEntityId } from "./ids.js";

const SOURCES = {
    [deezer.id]: deezer,
    [youtube.id]: youtube,
    [spotify.id]: spotify,
    [auto.id]: auto
};

// The source used for new searches.
export function getActiveSource() {
    return SOURCES[SEARCH_SOURCE] || deezer;
}

// Resolve a namespaced browseId to the source that should handle it.
// Returns { source, kind, id } or null if it can't be routed.
export function getSourceFor(encoded) {
    const parsed = parseEntityId(encoded);
    if (!parsed) return null;
    const source = SOURCES[parsed.source];
    if (!source) return null;
    return { source, kind: parsed.kind, id: parsed.id };
}
