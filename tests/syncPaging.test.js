import assert from "node:assert/strict";
import test from "node:test";
import { collectPages, dedupeBySourceId, isCaughtUp, makeIsSettled } from "../src/connect/paging.js";

// A fake newest-first liked list: ids n-1 … 0, served `pageSize` at a time.
function fakeList(count, pageSize, { offsetPaged = true, scannedPerPage } = {}) {
    const all = Array.from({ length: count }, (_, i) => ({ sourceId: String(count - 1 - i) }));
    const calls = [];
    const fetchPage = async (cursor) => {
        const offset = Number(cursor || 0);
        calls.push(offset);
        const items = all.slice(offset, offset + pageSize);
        const more = offset + pageSize < count;
        return {
            items,
            total: count,
            next: more ? (offsetPaged ? offset + pageSize : String(offset + pageSize)) : null,
            ...(scannedPerPage ? { scanned: scannedPerPage } : {})
        };
    };
    return { fetchPage, calls, all };
}

test("a full read returns every entry of an offset-paged list", async () => {
    const list = fakeList(230, 50);
    const progress = [];
    const result = await collectPages({ fetchPage: list.fetchPage, pageSize: 50, offsetPaged: true, onProgress: (p) => progress.push(p) });
    assert.equal(result.items.length, 230);
    assert.equal(result.scanned, 230);
    assert.equal(result.caughtUp, false);
    assert.deepEqual([...list.calls].sort((a, b) => a - b), [0, 50, 100, 150, 200]);
    assert.deepEqual(progress.at(-1), { done: 230, total: 230 });
});

test("a full read fetches the remaining offset pages side by side", async () => {
    let inFlight = 0, peak = 0;
    const list = fakeList(500, 50);
    const fetchPage = async (cursor) => {
        inFlight++; peak = Math.max(peak, inFlight);
        await new Promise((resolve) => setTimeout(resolve, 5));
        inFlight--;
        return list.fetchPage(cursor);
    };
    const result = await collectPages({ fetchPage, pageSize: 50, offsetPaged: true, concurrency: 4 });
    assert.equal(result.items.length, 500);
    assert.equal(peak, 4);
});

test("a token-paged list is walked one page after another", async () => {
    const list = fakeList(120, 50, { offsetPaged: false });
    const result = await collectPages({ fetchPage: list.fetchPage, pageSize: 50, offsetPaged: false });
    assert.equal(result.items.length, 120);
    assert.deepEqual(list.calls, [0, 50, 100]);
});

test("an incremental read stops at the first page with nothing new", async () => {
    // 230 liked; the 200 oldest (ids 0-199) were imported before, 30 are new.
    const list = fakeList(230, 50);
    const isKnown = (t) => Number(t.sourceId) < 200;
    const result = await collectPages({ fetchPage: list.fetchPage, pageSize: 50, offsetPaged: true, incremental: true, isKnown });
    assert.deepEqual(list.calls, [0, 50]);                 // page 2 is all known -> stop
    assert.equal(result.caughtUp, true);
    assert.equal(result.items.filter((t) => !isKnown(t)).length, 30);
});

test("an incremental read with nothing new costs a single page", async () => {
    const list = fakeList(900, 50);
    const result = await collectPages({ fetchPage: list.fetchPage, pageSize: 50, offsetPaged: true, incremental: true, isKnown: () => true });
    assert.deepEqual(list.calls, [0]);
    assert.equal(result.caughtUp, true);
});

test("an incremental read of an all-new list reads to the end", async () => {
    const list = fakeList(120, 50);
    const result = await collectPages({ fetchPage: list.fetchPage, pageSize: 50, offsetPaged: true, incremental: true, isKnown: () => false });
    assert.equal(result.items.length, 120);
    assert.equal(result.caughtUp, false);
});

test("an empty page (nothing importable on it) does not count as caught up", async () => {
    assert.equal(isCaughtUp([], () => true), false);
    assert.equal(isCaughtUp([{ sourceId: "a" }], () => true), true);
    assert.equal(isCaughtUp([{ sourceId: "a" }, { sourceId: "b" }], (t) => t.sourceId === "a"), false);

    // Page 1 has no music at all, page 2 has one new song, page 3 only known ones.
    const pages = {
        0: { items: [], total: 150, next: "50", scanned: 50 },
        50: { items: [{ sourceId: "new" }, { sourceId: "old-1" }], total: 150, next: "100", scanned: 50 },
        100: { items: [{ sourceId: "old-2" }], total: 150, next: null, scanned: 50 }
    };
    const calls = [];
    const result = await collectPages({
        fetchPage: async (cursor) => { calls.push(Number(cursor || 0)); return pages[Number(cursor || 0)]; },
        pageSize: 50, incremental: true, isKnown: (t) => t.sourceId.startsWith("old")
    });
    assert.deepEqual(calls, [0, 50, 100]);
    assert.equal(result.scanned, 150);                     // progress counts what was read, not what was kept
    assert.deepEqual(result.items.map((t) => t.sourceId), ["new", "old-1", "old-2"]);
});

test("the read stops at the limit", async () => {
    const list = fakeList(1000, 50, { offsetPaged: false });
    const result = await collectPages({ fetchPage: list.fetchPage, pageSize: 50, limit: 200 });
    assert.equal(result.items.length, 200);

    const offsets = fakeList(1000, 50);
    const capped = await collectPages({ fetchPage: offsets.fetchPage, pageSize: 50, offsetPaged: true, limit: 200 });
    assert.equal(capped.items.length, 200);
});

test("repeated entries are kept once", () => {
    const items = [{ sourceId: "a", n: 1 }, { sourceId: "b" }, { sourceId: "a", n: 2 }];
    assert.deepEqual(dedupeBySourceId(items), [{ sourceId: "a", n: 1 }, { sourceId: "b" }]);
});

test("a failing page fails the read", async () => {
    const list = fakeList(200, 50);
    const fetchPage = async (cursor) => {
        if (cursor === 100) throw new Error("Spotify liked 500");
        return list.fetchPage(cursor);
    };
    await assert.rejects(collectPages({ fetchPage, pageSize: 50, offsetPaged: true }), /Spotify liked 500/);
});

test("a re-sync leaves alone what was liked before the previous sync", () => {
    const since = Date.parse("2026-08-29T00:00:00Z");
    const isKnown = (t) => t.sourceId === "liked-here";
    const isSettled = makeIsSettled({ isKnown, since });
    assert.equal(isSettled({ sourceId: "liked-here", addedAt: "2026-11-01T00:00:00Z" }), true);   // already in Liked songs
    assert.equal(isSettled({ sourceId: "new", addedAt: "2026-11-01T00:00:00Z" }), false);         // liked since: import
    assert.equal(isSettled({ sourceId: "removed-here", addedAt: "2026-03-01T00:00:00Z" }), true); // seen before, removed here: stays out
    assert.equal(isSettled({ sourceId: "undated", addedAt: null }), false);                       // no date: can't rule it out

    // A first or full import has no "before": only what is already liked is skipped.
    const first = makeIsSettled({ isKnown });
    assert.equal(first({ sourceId: "removed-here", addedAt: "2026-03-01T00:00:00Z" }), false);
    assert.equal(first({ sourceId: "liked-here", addedAt: "2026-03-01T00:00:00Z" }), true);
});

test("a re-sync stops at the first page older than the previous sync, even past a removed song", async () => {
    // Newest-first: 3 new likes, then songs from before the last sync — one of which was removed here.
    const day = (n) => new Date(Date.parse("2026-08-29T00:00:00Z") + n * 86_400_000).toISOString();
    const all = [
        { sourceId: "n3", addedAt: day(30) }, { sourceId: "n2", addedAt: day(20) }, { sourceId: "n1", addedAt: day(10) },
        { sourceId: "o1", addedAt: day(-5) }, { sourceId: "removed", addedAt: day(-10) }, { sourceId: "o2", addedAt: day(-20) },
        { sourceId: "o3", addedAt: day(-30) }, { sourceId: "o4", addedAt: day(-40) }
    ];
    const calls = [];
    const fetchPage = async (offset) => { calls.push(offset); return { items: all.slice(offset, offset + 2), total: all.length, next: offset + 2 < all.length ? offset + 2 : null }; };
    const isSettled = makeIsSettled({ isKnown: (t) => /^o\d/.test(t.sourceId), since: Date.parse(day(0)) });
    const result = await collectPages({ fetchPage, pageSize: 2, offsetPaged: true, incremental: true, isKnown: isSettled });
    assert.deepEqual(calls, [0, 2, 4]);   // third page (removed, o2) is all settled
    assert.deepEqual(result.items.filter((t) => !isSettled(t)).map((t) => t.sourceId), ["n3", "n2", "n1"]);
});
