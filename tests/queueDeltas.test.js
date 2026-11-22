import assert from "node:assert/strict";
import test from "node:test";
import { applyQueueDelta, isDense, slotPosition } from "../src/lib/queueDeltas.js";

const row = (name, track_id) => ({ entry_id: name, track_id });
const queue = (names, position, positions = names.map((_, i) => i)) => ({
    tracks: names.map((name, i) => row(name, positions[i])), position, autoplay: "kept"
});
const order = (q) => q.tracks.map((t) => t.entry_id).join("");
const ids = (q) => q.tracks.map((t) => t.track_id);
const current = (q) => q.tracks.find((t) => t.track_id === q.position)?.entry_id;

test("dense means every track_id is its index", () => {
    assert.equal(isDense([]), true);
    assert.equal(isDense(queue(["a", "b", "c"], 0).tracks), true);
    assert.equal(isDense(queue(["a", "b", "c"], 0, [0, 1, 3]).tracks), false);   // hole at 2
    assert.equal(isDense(queue(["a", "b", "c"], 0, [1, 2, 3]).tracks), false);   // hole at 0
});

test("play next on a later track: it lands after the current one, which stays current", () => {
    // bot: move(3 -> 2), cursor unchanged
    const next = applyQueueDelta(queue(["a", "B", "c", "d"], 1), "q_move", { from: 3, to: 2, cursor: 1 });
    assert.equal(order(next), "aBdc");
    assert.deepEqual(ids(next), [0, 1, 2, 3]);
    assert.equal(current(next), "B");
    assert.equal(next.autoplay, "kept");
});

test("play next on an earlier track: the cursor follows the current track down", () => {
    // bot: move(0 -> 2), cursor 2 -> 1
    const next = applyQueueDelta(queue(["a", "b", "C", "d"], 2), "q_move", { from: 0, to: 2, cursor: 1 });
    assert.equal(order(next), "bCad");
    assert.equal(current(next), "C");
});

test("adds and removes splice by position and take the bot's cursor", () => {
    let q = applyQueueDelta(queue(["a", "B"], 1), "q_add", { at: 2, tracks: [row("c", 2)], cursor: 1 });
    assert.equal(order(q), "aBc");
    q = applyQueueDelta(q, "q_add", { at: 0, tracks: [row("x", 0), row("y", 1)], cursor: 3 });
    assert.equal(order(q), "xyaBc");
    assert.deepEqual(ids(q), [0, 1, 2, 3, 4]);
    assert.equal(current(q), "B");
    q = applyQueueDelta(q, "q_remove", { at: 0, count: 2, cursor: 1 });
    assert.equal(order(q), "aBc");
    assert.equal(current(q), "B");
    // no cursor in the delta: keep ours
    assert.equal(applyQueueDelta(q, "q_remove", { at: 2 }).position, 1);
});

test("untouched rows keep their identity", () => {
    const q = queue(["a", "b", "c"], 0);
    const next = applyQueueDelta(q, "q_move", { from: 2, to: 1, cursor: 0 });
    assert.equal(next.tracks[0], q.tracks[0]);
    assert.notEqual(next.tracks[1], q.tracks[2]);
});

test("a queue with a hole is never patched by index — the caller refetches", () => {
    // The real case: positions 0,1,3,4 (hole at 2), "d" playing at position 3
    // and a stranded track after it. Patching by index would renumber the
    // stranded track onto the cursor and mark it as now playing.
    const holed = queue(["a", "b", "D", "ghost"], 3, [0, 1, 3, 4]);
    assert.equal(current(holed), "D");
    assert.equal(applyQueueDelta(holed, "q_add", { at: 4, tracks: [row("n", 4)], cursor: 3 }), null);
    assert.equal(applyQueueDelta(holed, "q_move", { from: 4, to: 0, cursor: 4 }), null);
    assert.equal(applyQueueDelta(holed, "q_remove", { at: 4, count: 1, cursor: 3 }), null);
});

test("a delta that points outside the local queue is refused too", () => {
    const q = queue(["a", "b"], 0);
    assert.equal(applyQueueDelta(q, "q_add", { at: 5, tracks: [row("z", 5)] }), null);
    assert.equal(applyQueueDelta(q, "q_remove", { at: 2 }), null);
    assert.equal(applyQueueDelta(q, "q_remove", { at: 1, count: 2 }), null);
    assert.equal(applyQueueDelta(q, "q_move", { from: 2, to: 0 }), null);
    assert.equal(applyQueueDelta(q, "q_move", { from: 0, to: 2 }), null);
    assert.equal(applyQueueDelta(q, "q_move", {}), null);
    assert.equal(applyQueueDelta(q, "q_unknown", {}), null);
    // an empty queue accepts its first tracks
    assert.equal(order(applyQueueDelta({ tracks: [], position: 0 }, "q_add", { at: 0, tracks: [row("a", 0)], cursor: 0 })), "a");
});

test("a drop into a slot addresses the position held there", () => {
    assert.equal(slotPosition(queue(["a", "b", "c"], 0).tracks, 1), 1);
    assert.equal(slotPosition(queue(["a", "b", "c"], 0, [0, 1, 3]).tracks, 2), 3);
    assert.equal(slotPosition(queue(["a", "b"], 0).tracks, 2), 2);   // past the end: append
});
