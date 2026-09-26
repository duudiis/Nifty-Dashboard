import { splitTitle } from "./trackShape.js";
import { msToClock } from "./format.js";

/**
 * Turns a home-query row into the SEARCH item shape — deliberately not
 * trackShape's trackRow().
 *
 * The two shapes differ in exactly the ways that matter here: trackRow emits
 * `songUrl` and a numeric millisecond duration, while Tile reads
 * `playQuery || url` and TrackRow prints `duration` straight into a 12px
 * column. Feeding a trackRow into them yields a dead click and the literal
 * text "213482". Home renders through the search components, so it speaks
 * their shape.
 */
export function homeTrack(row) {
    if (!row) return null;
    const { title, artist } = splitTitle(row.d_title ?? row.title, row.d_artist ?? row.artist);
    return {
        kind: row.source === "youtube" && !artist ? "video" : "song",
        title,
        artist: artist || "",
        artistBrowseId: null,
        artwork: row.artwork_url || null,
        url: row.url,
        playQuery: row.url,
        duration: msToClock(Number(row.duration_ms) || 0)
    };
}
