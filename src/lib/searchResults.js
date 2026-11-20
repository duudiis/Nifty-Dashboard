// Search APIs group by type, but the results view is a single ranked stream.
// Keep every returned result: filters narrow the stream instead of allocating
// a fixed number of slots to songs, artists, albums or playlists.
const fold = (value) => String(value || "").normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/[^\p{L}\p{N}]+/gu, " ").trim();

function match(query, value) {
    const text = fold(value);
    if (!query || !text) return 0;
    if (text === query) return 1;
    if (text.startsWith(query)) return 0.92 - Math.min(0.12, (text.length - query.length) / 200);
    if (text.includes(query)) return 0.78;
    const words = text.split(" ");
    const queryWords = query.split(" ");
    return queryWords.filter((word) => words.some((candidate) => candidate.startsWith(word))).length / queryWords.length * 0.72;
}

export function searchResultKey(item) {
    return `${item.kind}:${item.browseId || item.url || item.playQuery || item.videoId || `${item.title}:${item.artist || item.subtitle || ""}`}`;
}

export function rankSearchResults(query, sections = []) {
    const needle = fold(query);
    const seen = new Set();
    const results = [];
    for (const section of sections) {
        for (const [rank, raw] of (section.items || []).entries()) {
            if (!raw?.title) continue;
            const item = { ...raw, kind: raw.kind || section.kind };
            const key = searchResultKey(item);
            if (seen.has(key)) continue;
            seen.add(key);
            // Creators on playlists and fan-count metadata on artists are not
            // artist credits. Only track artists and album artists aid ranking.
            const artist = item.artist || (item.kind === "album" ? item.subtitle : "");
            const relevance = Math.max(
                match(needle, item.title),
                match(needle, artist) * 0.88,
                match(needle, `${item.title} ${artist}`) * 0.96,
                match(needle, `${artist} ${item.title}`) * 0.96
            );
            results.push({ item, relevance, rank, order: results.length });
        }
    }
    // Provider relevance breaks text-score ties. There are no type quotas,
    // and source order is stable when text and provider rank both agree.
    return results.sort((a, b) => b.relevance - a.relevance || a.rank - b.rank || a.order - b.order).map(({ item }) => item);
}
