// Applying the bot's queue deltas (q_add / q_remove / q_move) to the local
// queue.
//
// The bot addresses the queue by POSITION: an entry's track_id is its position
// in the bot's list, the cursor (queue.position) is one too, and every delta
// speaks in them. Applying a delta by array index is only right while the two
// agree — while the queue is "dense": positions 0, 1, 2 … with no hole.
//
// They are meant to always agree, but the bot's list has been seen with a hole
// in it (a position nobody holds). Splicing by index then hits the wrong row
// and renumbering moves the "now playing" marker onto a neighbour. So a delta
// that doesn't fit the local queue is never guessed at: applyQueueDelta
// returns null and the caller re-reads the queue from the database instead.

/** True when every entry's track_id is its array index. `tracks` is in position order. */
export function isDense(tracks) {
    return tracks.length === 0
        || (tracks[0].track_id === 0 && tracks[tracks.length - 1].track_id === tracks.length - 1);
}

// Rewrites track_id to the array index, preserving object identity for rows
// that didn't move so memoized rows don't re-render.
function reindex(tracks) {
    return tracks.map((track, index) => (track.track_id === index ? track : { ...track, track_id: index }));
}

const isIndex = (value, length) => Number.isInteger(value) && value >= 0 && value < length;

/**
 * @param {{ tracks: object[], position: number }} queue   the local queue
 * @param {"q_add"|"q_remove"|"q_move"} operation
 * @param {object} data   the delta: { at, tracks, cursor } | { at, count, cursor } | { from, to, cursor }
 *                        (`tracks` already in the local row shape)
 * @returns the next queue, or null when the delta cannot be applied to this
 *          queue as it stands (a hole, or positions outside it) — refetch.
 */
export function applyQueueDelta(queue, operation, data = {}) {
    const tracks = queue.tracks || [];
    if (!isDense(tracks)) return null;

    const next = [...tracks];
    if (operation === "q_add") {
        const at = data.at ?? next.length;
        if (!Array.isArray(data.tracks) || !Number.isInteger(at) || at < 0 || at > next.length) return null;
        next.splice(at, 0, ...data.tracks);
    } else if (operation === "q_remove") {
        const count = data.count || 1;
        if (!isIndex(data.at, next.length) || data.at + count > next.length) return null;
        next.splice(data.at, count);
    } else if (operation === "q_move") {
        if (!isIndex(data.from, next.length) || !isIndex(data.to, next.length)) return null;
        const [moved] = next.splice(data.from, 1);
        next.splice(data.to, 0, moved);
    } else {
        return null;
    }

    return {
        ...queue,
        tracks: reindex(next),
        position: typeof data.cursor === "number" ? data.cursor : queue.position
    };
}

/**
 * The bot position of the row sitting in a given slot of the list — what a
 * drop "into slot N" has to say to the bot. The slot itself while dense.
 */
export function slotPosition(tracks, slot) {
    return tracks[slot]?.track_id ?? slot;
}
