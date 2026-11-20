import assert from "node:assert/strict";
import test from "node:test";
import { makeQueueRows, reorderQueueRows, queueDropAction } from "../src/components/queue/order.js";

const tracks = [
    { entry_id: "10", track_id: 0, songUrl: "same-recording" },
    { entry_id: "20", track_id: 1, songUrl: "same-recording" },
    { entry_id: "30", track_id: 2, songUrl: "another-recording" }
];
const recommendations = [{ auto_id: "40", songUrl: "recommended-a" }, { auto_id: "50", songUrl: "recommended-b" }];

test("duplicate recordings keep distinct row identities after reindexing", () => {
    const original = makeQueueRows(tracks, []);
    const moved = makeQueueRows([tracks[1], tracks[0], tracks[2]].map((track, track_id) => ({ ...track, track_id })), []);
    assert.equal(moved[0].key, original[1].key);
    assert.equal(moved[1].key, original[0].key);
    assert.notEqual(original[0].key, original[1].key);
});

test("an autoplay track can be inserted into every queue slot, including previous, current and append", () => {
    const source = makeQueueRows(tracks, recommendations);
    const dragged = source.find((row) => row.track?.auto_id === "50");
    for (let to = 0; to <= tracks.length; to++) {
        const order = source.filter((row) => row !== dragged);
        order.splice(to, 0, dragged);
        assert.deepEqual(queueDropAction(order, dragged, source, 1), { action: "autoplayQueue", id: "50", to });
    }
});

test("recommendations also insert into an empty queue", () => {
    const source = makeQueueRows([], recommendations);
    const dragged = source[2];
    const order = [dragged, ...source.filter((row) => row !== dragged)];
    assert.deepEqual(queueDropAction(order, dragged, source, 1), { action: "autoplayQueue", id: "50", to: 0 });
});

test("reordering recommendations stays within their own index space", () => {
    const source = makeQueueRows(tracks, recommendations);
    const dragged = source[4];
    const order = [...source.slice(0, 4), source[5], dragged];
    assert.deepEqual(queueDropAction(order, dragged, source, 0), { action: "autoplayMove", id: "40", to: 1 });
});

test("a queue entry cannot be dropped into the recommendation buffer", () => {
    const source = makeQueueRows(tracks, recommendations);
    const dragged = source[0];
    const requested = [...source.slice(1), dragged].map((row) => row.key);
    const result = reorderQueueRows(source, requested, dragged);
    assert.deepEqual(result.map((row) => row.key), ["queue:20", "queue:30", "queue:10", "autoplay-boundary", "autoplay:40", "autoplay:50"]);
    assert.deepEqual(queueDropAction(result, dragged, source, 0), { action: "move", id: 0, to: 2 });
});

test("server reindexing during a drag addresses the same entry, not its stale index", () => {
    const source = makeQueueRows(tracks, recommendations);
    const dragged = source[2];
    const live = makeQueueRows(tracks.slice(1).map((track, track_id) => ({ ...track, track_id })), recommendations);
    const order = [dragged, ...source.filter((row) => row !== dragged)];
    assert.deepEqual(queueDropAction(order, dragged, live, 2), { action: "move", id: 1, to: 0 });
});

test("a track removed during the drag produces no action", () => {
    const source = makeQueueRows(tracks, recommendations);
    const dragged = source[0];
    const live = source.filter((row) => row !== dragged);
    assert.equal(queueDropAction(source, dragged, live, 0), null);
});

test("dropping a track back at its original position produces no action", () => {
    const source = makeQueueRows(tracks, recommendations);
    assert.equal(queueDropAction(source, source[1], source, 1), null);
    assert.equal(queueDropAction(source, source[4], source, 0), null);
});
