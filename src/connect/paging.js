// Reads a provider's liked list page by page. Pure: the provider supplies
// `fetchPage(cursor)`, which resolves to
//
//   { items, total, next, scanned }
//     items    normalized tracks on this page
//     total    how many entries the list holds (null when the platform won't say)
//     next     cursor of the following page, or null at the end
//     scanned  entries this page consumed (defaults to items.length; larger
//              when the provider filters a page, e.g. YouTube's non-music)
//
// Two ways to walk the list:
//
//   full         every page. Offset-addressed lists (`offsetPaged`) are read
//                several pages at a time once the first page reports a total.
//   incremental  for newest-first lists that were fully read before: stop at
//                the first page holding nothing new (see makeIsSettled).
//                Everything after it is older, so it was covered by the
//                earlier sync.

export const LIKED_LIMIT = 10_000;

// A re-sync looks this far back past the previous sync, so a song liked while
// that sync was running (or stamped by a slightly different clock) isn't lost.
export const RESYNC_OVERLAP_MS = 60 * 60 * 1000;

// Which entries need no work. Always: the ones already in Liked songs
// (`isKnown`). On a re-sync (`since` = previous sync minus the overlap) also
// the ones liked on the platform before that — the previous sync saw them, so
// one that is missing now was removed here on purpose and stays removed.
export function makeIsSettled({ isKnown, since = null }) {
    return (item) =>
        isKnown(item) || (since != null && item.addedAt != null && Date.parse(item.addedAt) < since);
}

// A page proves we've caught up when it has entries and all of them are known.
// An empty page (a YouTube page with no music on it) proves nothing.
export function isCaughtUp(items, isKnown) {
    return items.length > 0 && items.every(isKnown);
}

// Lists that shift while being read can repeat an entry; keep the first.
export function dedupeBySourceId(items) {
    const seen = new Set();
    return items.filter((item) => {
        if (seen.has(item.sourceId)) return false;
        seen.add(item.sourceId);
        return true;
    });
}

// Runs `work` over `inputs`, at most `size` at a time.
async function pool(inputs, size, work) {
    let index = 0;
    const worker = async () => {
        while (index < inputs.length) await work(inputs[index++]);
    };
    await Promise.all(Array.from({ length: Math.min(size, inputs.length) }, worker));
}

export async function collectPages({
    fetchPage,
    pageSize,
    offsetPaged = false,
    incremental = false,
    isKnown = () => false,
    limit = LIKED_LIMIT,
    concurrency = 4,
    onProgress = () => {}
}) {
    const items = [];
    let scanned = 0;
    let total = null;

    const take = (page) => {
        items.push(...page.items);
        scanned += page.scanned ?? page.items.length;
        if (page.total != null) total = page.total;
        onProgress({ done: scanned, total });
    };
    const result = (caughtUp) => ({ items: dedupeBySourceId(items), scanned, total, caughtUp });

    const first = await fetchPage(offsetPaged ? 0 : null);
    take(first);
    if (incremental && isCaughtUp(first.items, isKnown)) return result(true);

    // Full read of an offset-addressed list: the remaining pages are known up
    // front, so fetch them side by side.
    if (!incremental && offsetPaged && total != null) {
        const offsets = [];
        for (let offset = pageSize; offset < Math.min(total, limit); offset += pageSize) offsets.push(offset);
        await pool(offsets, concurrency, async (offset) => take(await fetchPage(offset)));
        return result(false);
    }

    let cursor = first.next;
    while (cursor != null && scanned < limit) {
        const page = await fetchPage(cursor);
        take(page);
        if (incremental && isCaughtUp(page.items, isKnown)) return result(true);
        cursor = page.next;
    }
    return result(false);
}
