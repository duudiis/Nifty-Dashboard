const AUTOPLAY_BOUNDARY = "autoplay-boundary";

// Database IDs distinguish repeated recordings and survive queue reindexing.
export function makeQueueRows(tracks, recommendations) {
    const seen = new Map();
    const queueRows = tracks.map((track) => {
        const occurrence = seen.get(track.songUrl) || 0;
        seen.set(track.songUrl, occurrence + 1);
        return {
            key: `queue:${track.entry_id ?? `${track.songUrl}#${occurrence}`}`,
            kind: "queue",
            track
        };
    });
    return [
        ...queueRows,
        { key: AUTOPLAY_BOUNDARY, kind: "boundary" },
        ...recommendations.map((track) => ({ key: `autoplay:${track.auto_id}`, kind: "autoplay", track }))
    ];
}

export function reorderQueueRows(order, keys, dragged) {
    const byKey = new Map(order.map((row) => [row.key, row]));
    const next = keys.map((key) => byKey.get(key)).filter(Boolean);
    // Existing queue entries cannot become recommendations. Recommendations
    // can cross the boundary freely; it is never directly draggable.
    if (dragged?.kind === "queue") {
        const index = next.findIndex((row) => row.key === dragged.key);
        const boundary = next.findIndex((row) => row.kind === "boundary");
        if (boundary >= 0 && index > boundary) {
            next.splice(index, 1);
            next.splice(boundary, 0, dragged);
        }
    }
    return next;
}

// Resolve against the latest server rows, even if they changed during a drag.
// A removed row is ignored and reindexed rows keep their original identity.
export function queueDropAction(order, dragged, sourceRows, from) {
    const liveRow = sourceRows.find((row) => row.key === dragged?.key);
    const index = order.findIndex((row) => row.key === dragged?.key);
    const boundary = order.findIndex((row) => row.kind === "boundary");
    if (!liveRow || index < 0 || boundary < 0) return null;
    const before = order.slice(0, index);
    if (dragged.kind === "autoplay" && index < boundary) {
        return { action: "autoplayQueue", id: liveRow.track.auto_id, to: before.length };
    }
    if (dragged.kind === "autoplay") {
        const to = before.filter((row) => row.kind === "autoplay").length;
        return to === from ? null : { action: "autoplayMove", id: liveRow.track.auto_id, to };
    }
    const to = before.filter((row) => row.kind === "queue").length;
    return to === from ? null : { action: "move", id: liveRow.track.track_id, to };
}
