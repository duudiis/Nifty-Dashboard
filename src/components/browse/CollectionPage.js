import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { useNifty } from "../../context/NiftyContext.js";
import { parseEntityId } from "../../sources/ids.js";
import Icon from "../Icon.js";
import { CollectionSkeleton } from "../Loader.js";
import TrackRow from "./TrackRow.js";
import { CollectionHeader, formatCollectionDuration, TRACK_ACTIONS_CLASS, TRACK_ROW_HEIGHT, TRACK_TABLE_GUTTER_CLASS, TrackTableHeader } from "./trackTable.js";
import ArtistLink from "./ArtistLink.js";
import { LoadingSwap, Reorder } from "../motion/index.js";
import { useDragScroll, findScroller } from "../motion/useDragScroll.js";
import SortDropdown from "../menu/SortDropdown.js";
import { useModal } from "../modal/Modal.js";
import { entityExternalUrl, recordCollectionQueued } from "./useEntityActions.js";

// Album & playlist pages: an artwork-tinted header (the blur itself is pinned
// by CenterContent so it can't leak during the page fade), rich meta, play/
// save controls, then the full track list. Open-in-browser / copy-link live in
// the right-click menu, not here.

// "3:42" -> seconds; tolerant of h:mm:ss.
function clockToSeconds(str) {
    if (!str || typeof str !== "string") return 0;
    const parts = str.split(":").map((n) => parseInt(n, 10));
    if (parts.some(Number.isNaN)) return 0;
    return parts.reduce((total, part) => total * 60 + part, 0);
}

function totalDuration(tracks) {
    return formatCollectionDuration(tracks.reduce((sum, t) => sum + clockToSeconds(t.duration), 0));
}

function releaseYear(date) {
    const year = String(date || "").slice(0, 4);
    return /^\d{4}$/.test(year) ? year : null;
}

const BASE_SORT_OPTIONS = [
    { id: "custom", label: "Custom order", icon: "grip" },
    { id: "added", label: "Date added", icon: "history" },
    { id: "title", label: "Title", icon: "music" },
    { id: "artist", label: "Artist", icon: "user" },
    { id: "duration", label: "Duration", icon: "clock" }
];

function sortTracks(tracks, sortBy, sortDesc) {
    if (sortBy === "custom") return tracks;
    const dir = sortDesc ? -1 : 1;
    const key = {
        title: (t) => (t.title || "").toLowerCase(),
        artist: (t) => (t.artist || "").toLowerCase(),
        duration: (t) => clockToSeconds(t.duration),
        added: (t) => (t.addedAt ? new Date(t.addedAt).getTime() : 0)
    }[sortBy];
    if (!key) return tracks;
    return [...tracks].sort((a, b) => {
        const ka = key(a);
        const kb = key(b);
        if (ka < kb) return -dir;
        if (ka > kb) return dir;
        return 0;
    });
}

const useIsoEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

const LIKED_ID = "nifty:playlist:liked";

const ROW_H = TRACK_ROW_HEIGHT; // shared with live rows and loading placeholders
const OVERSCAN = 12;   // rows rendered beyond the viewport on each side

// Virtualized track table: only the rows near the viewport are mounted; the
// rest are represented by top/bottom spacers. A Liked list of thousands keeps
// a small, constant DOM/framer footprint no matter how far you scroll. framer's
// <Reorder> runs on that window; during a drag the window may only grow (never
// evict) so items stay mounted while you auto-scroll. The sort arrives with the
// page (initialSort), so the list is ordered on its first paint.
function TrackList({ data, refId, kind, playUrl, initialSort, actions }) {
    const { notify } = useNifty();
    const reorderable = !!data.reorderable;

    const [sort, setSort] = useState(initialSort || { sortBy: "custom", sortDesc: false });
    const [order, setOrder] = useState(data.tracks || []);
    const orderRef = useRef(order); orderRef.current = order;
    const beforeDrag = useRef(order);

    const wrapRef = useRef(null);          // spacers + rows; its top = logical row 0
    const scrollerRef = useRef(null);
    const draggingRef = useRef(false);
    const { start: startAutoscroll, stop: stopAutoscroll } = useDragScroll(wrapRef);

    const dragEnabled = reorderable && sort.sortBy === "custom";
    const displayed = useMemo(() => sortTracks(order, sort.sortBy, sort.sortDesc), [order, sort.sortBy, sort.sortDesc]);
    const rowKeys = useMemo(() => new Map(order.map((track, i) => [track,
        track.entryId != null ? `entry:${track.entryId}` : `track:${track.url || track.playQuery || track.title}:${i}`
    ])), [order]);
    const total = displayed.length;
    const totalRef = useRef(total); totalRef.current = total;

    const [range, setRange] = useState({ start: 0, end: 30 });
    const rangeRef = useRef(range); rangeRef.current = range;

    const recompute = useCallback(() => {
        const wrap = wrapRef.current;
        const scroller = scrollerRef.current || findScroller(wrap);
        scrollerRef.current = scroller;
        if (!wrap || !scroller) return;
        const sc = scroller.getBoundingClientRect();
        const rect = wrap.getBoundingClientRect();
        const past = sc.top - rect.top;             // px of the list scrolled above the viewport
        const n = totalRef.current;
        let start = Math.min(Math.max(0, n - 1), Math.max(0, Math.floor(past / ROW_H) - OVERSCAN));
        let end = Math.min(n, Math.ceil((past + sc.height) / ROW_H) + OVERSCAN);
        if (end <= start) end = Math.min(n, start + 1);
        const prev = rangeRef.current;
        if (draggingRef.current) {                  // never evict mid-drag
            start = Math.min(prev.start, start);
            end = Math.max(prev.end, end);
        }
        if (prev.start !== start || prev.end !== end) setRange({ start, end });
    }, []);

    // Keep the visible window at the current scroll position. Resetting to row
    // zero and measuring on the next frame briefly blanks a scrolled table.
    useIsoEffect(() => { setOrder(data.tracks || []); }, [data.tracks]);
    useIsoEffect(() => { if (initialSort) setSort(initialSort); }, [initialSort]);
    useIsoEffect(recompute, [total, sort.sortBy, sort.sortDesc, recompute]);

    // Measure before the first paint, then follow the page scroller.
    useIsoEffect(() => {
        const scroller = findScroller(wrapRef.current);
        scrollerRef.current = scroller;
        if (!scroller) return;
        recompute();
        scroller.addEventListener("scroll", recompute, { passive: true });
        window.addEventListener("resize", recompute);
        return () => {
            scroller.removeEventListener("scroll", recompute);
            window.removeEventListener("resize", recompute);
        };
    }, [recompute]);

    const persistSort = (next) => {
        setSort(next);
        fetch("/api/library", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "set_sort", ref: refId, sortBy: next.sortBy, sortDesc: next.sortDesc })
        }).then((response) => { if (!response.ok) throw new Error(); })
            .catch(() => notify("Couldn't save your sort preference"));
    };

    const chooseSort = (sortBy) => {
        persistSort({ sortBy, sortDesc: sortBy === "added" });
    };

    // framer <Reorder> reorders only the mounted window; splice it back into
    // the full order around the window bounds.
    const onReorder = (winRows) => {
        const { start, end } = rangeRef.current;
        const next = [...orderRef.current.slice(0, start), ...winRows, ...orderRef.current.slice(end)];
        orderRef.current = next;
        setOrder(next);
    };

    const onRowDragStart = () => { beforeDrag.current = orderRef.current; draggingRef.current = true; startAutoscroll(); };
    const onRowDragEnd = () => {
        draggingRef.current = false;
        stopAutoscroll();
        const ids = orderRef.current.map((t) => t.entryId).filter(Boolean);
        if (ids.length) {
            const body = data.liked
                ? { action: "reorder_liked", order: ids }
                : { action: "reorder_playlist", playlistId: parseEntityId(refId)?.id, order: ids };
            const committed = orderRef.current;
            const previous = beforeDrag.current;
            fetch("/api/library", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) })
                .then((response) => { if (!response.ok) throw new Error(); })
                .catch(() => {
                    if (orderRef.current === committed) { orderRef.current = previous; setOrder(previous); }
                    notify("Couldn't save that order. Please try again.");
                });
        }
        requestAnimationFrame(recompute); // collapse the grown window back to the viewport
    };

    const hasAddedDates = (data.tracks || []).some((t) => t.addedAt);
    const sortOptions = BASE_SORT_OPTIONS.filter((o) => o.id !== "added" || hasAddedDates);

    const header = (
        <>
            <div className={TRACK_ACTIONS_CLASS}>
                {actions}
                <SortDropdown options={sortOptions} value={sort.sortBy} onChange={chooseSort} descending={sort.sortDesc} onDirectionChange={(sortDesc) => persistSort({ ...sort, sortDesc })} />
            </div>
            <TrackTableHeader meta={hasAddedDates ? "Date added" : null} />
        </>
    );

    if (total === 0) {
        return (
            <div className={`flex flex-col pb-8 ${TRACK_TABLE_GUTTER_CLASS}`}>
                {header}
                <div className="px-3 py-14 text-center text-sm text-subtext">
                    {playUrl
                        ? `Track list unavailable for this ${kind} — Play still queues the whole thing.`
                        : data.liked
                            ? "Songs you save with the heart will show up here."
                            : "This playlist is empty — right-click any track and pick “Add to playlist”."}
                </div>
            </div>
        );
    }

    const winRows = displayed.slice(range.start, range.end);
    const rowEls = winRows.map((track, i) => (
        <TrackRow
            key={rowKeys.get(track)}
            track={track}
            collection
            showAdded={hasAddedDates}
            index={range.start + i + 1}
            dragValue={reorderable ? track : null}
            dragEnabled={dragEnabled}
            onDragStart={onRowDragStart}
            onDragEnd={onRowDragEnd}
        />
    ));
    const topPad = range.start * ROW_H;
    const botPad = Math.max(0, (total - range.end) * ROW_H);

    return (
        <div className={`flex flex-col pb-8 ${TRACK_TABLE_GUTTER_CLASS}`}>
            {header}
            <div ref={wrapRef} className="flex flex-col">
                {topPad > 0 && <div style={{ height: topPad }} aria-hidden />}
                {reorderable ? (
                    <Reorder.Group as="div" axis="y" values={winRows} onReorder={onReorder} className="flex flex-col">
                        {rowEls}
                    </Reorder.Group>
                ) : (
                    <div className="flex flex-col">{rowEls}</div>
                )}
                {botPad > 0 && <div style={{ height: botPad }} aria-hidden />}
            </div>
        </div>
    );
}

export default function CollectionPage({ id }) {
    const { play, selected, notify, setPageArt, isSaved, toggleSaveEntity, removePlaylist, libraryRevision } = useNifty();
    const modal = useModal();
    const [data, setData] = useState(null);
    const [sortPref, setSortPref] = useState(null);
    const [loading, setLoading] = useState(true);
    const [retry, setRetry] = useState(0);

    useEffect(() => {
        let stale = false;
        setLoading(true);
        setData(null);
        setSortPref(null);
        // Fetch the tracks and the saved sort together so the list is ordered
        // correctly on its first paint — no flash of custom order re-sorting
        // once a later sort request lands.
        Promise.all([
            fetch(`/api/browse?id=${encodeURIComponent(id)}`).then((r) => { if (!r.ok) throw new Error(); return r.json(); }),
            fetch(`/api/library?view=sort&ref=${encodeURIComponent(id)}`).then((r) => r.json()).catch(() => null)
        ])
            .then(([j, s]) => {
                if (stale) return;
                setSortPref(s && s.sortBy ? { sortBy: s.sortBy, sortDesc: !!s.sortDesc } : { sortBy: "custom", sortDesc: false });
                setData(j);
                // Liked songs gets the accent-tinted backdrop matching its
                // cover tile, never a track's artwork.
                setPageArt(j?.liked ? "accent" : j?.artwork || null, id);
            })
            .catch(() => !stale && setData(null))
            .finally(() => !stale && setLoading(false));
        return () => {
            stale = true;
        };
    }, [id, setPageArt, retry]);

    // A platform sync added songs while Liked songs is open: re-read the list
    // in place — no loading state, the new songs simply appear.
    const seenRevision = useRef(libraryRevision);
    useEffect(() => {
        if (libraryRevision === seenRevision.current) return;
        seenRevision.current = libraryRevision;
        if (id !== LIKED_ID) return;
        let stale = false;
        fetch(`/api/browse?id=${encodeURIComponent(id)}`)
            .then((r) => (r.ok ? r.json() : null))
            .then((fresh) => { if (!stale && fresh) setData(fresh); })
            .catch(() => {});
        return () => { stale = true; };
    }, [libraryRevision, id]);

    const tracks = data?.tracks || [];
    const kind = data?.type || "collection";
    const item = { browseId: id, kind, custom: data?.custom, title: data?.title, subtitle: data?.subtitle, artwork: data?.artwork, url: entityExternalUrl({ browseId: id }, data) };
    const saved = isSaved(id);

    // Queue the whole collection in one request so the bot loads it in order
    // (and, for albums, as audio). The source hands back a ready play URL for
    // the collection; fall back to per-track only if it couldn't resolve one.
    const playUrl = data?.playUrl || null;
    const queueAll = () => {
        playUrl ? play(playUrl, "queue") : tracks.forEach((t) => play(t.playQuery || t.url, "queue"));
        recordCollectionQueued(item, data);
        if (data?.title) notify(`Added “${data.title}” to the queue`);
    };
    const playAll = () => {
        playUrl ? play(playUrl, "now") : tracks.forEach((t, i) => play(t.playQuery || t.url, i === 0 ? "now" : "queue"));
        recordCollectionQueued(item, data);
        if (data?.title) notify(`Now playing “${data.title}”`);
    };

    const year = releaseYear(data?.releaseDate);
    const length = totalDuration(tracks);
    const metaBits = [
        year,
        `${tracks.length.toLocaleString()} song${tracks.length === 1 ? "" : "s"}`,
        length
    ].filter(Boolean);

    return (
        <LoadingSwap loading={loading} fallback={<CollectionSkeleton liked={id === LIKED_ID} />}>
            {data?.title ? <div className="flex flex-col">
                {/* header — the artwork blur behind it is pinned by CenterContent */}
                <CollectionHeader
                    artwork={data.artwork}
                    icon={data.liked ? "heart-filled" : null}
                    eyebrow={data.liked ? "Your collection" : kind === "album" ? "Album" : "Playlist"}
                    title={data.title}
                >
                    {data.subtitle && (
                        kind === "album" ? (
                            <ArtistLink
                                name={data.subtitle}
                                browseId={data.artistBrowseId}
                                className="text-sm font-semibold text-maintext"
                            />
                        ) : (
                            <span className="text-sm font-semibold text-maintext/90">{data.subtitle}</span>
                        )
                    )}
                    {metaBits.length > 0 && (
                        <span className="text-[13px] leading-relaxed text-maintext/70">{metaBits.join(" · ")}</span>
                    )}
                </CollectionHeader>

                <TrackList key={id} data={data} refId={id} kind={kind} playUrl={playUrl} initialSort={sortPref} actions={
                <div className="flex flex-wrap items-center gap-4">
                    <button
                        onClick={playAll}
                        disabled={!selected || (tracks.length === 0 && !playUrl)}
                        className="flex h-14 w-14 items-center justify-center rounded-full bg-accent text-canvas shadow-lg transition hover:scale-105 hover:brightness-110 active:scale-100 disabled:opacity-40"
                        title={`Play ${data.title}`}
                        aria-label={`Play ${data.title}`}
                    >
                        <Icon name="play" className="ml-0.5 h-6 w-6" />
                    </button>
                    <button
                        onClick={queueAll}
                        disabled={!selected || (tracks.length === 0 && !playUrl)}
                        className="flex h-9 items-center gap-2 rounded-full border border-maintext/20 px-4 text-xs font-semibold text-maintext transition-colors hover:border-maintext/50 hover:bg-maintext/[0.06] disabled:opacity-40"
                    >
                        <Icon name="enqueue" className="h-4 w-4" /> Add all to queue
                    </button>
                    {!data.custom && !data.liked && (
                        <button
                            onClick={() => toggleSaveEntity(item, data)}
                            title={saved ? "Remove from your library" : "Save to your library"}
                            aria-label={saved ? "Remove from your library" : "Save to your library"}
                            className={`flex h-10 w-10 items-center justify-center rounded-full transition-colors ${saved ? "text-accent" : "text-subtext hover:text-maintext"}`}
                        >
                            <Icon name={saved ? "heart-filled" : "heart"} className="h-6 w-6" />
                        </button>
                    )}
                    {data.custom && !data.liked && (
                        <button
                            onClick={async () => {
                                const sure = await modal.confirm({
                                    title: "Delete playlist?",
                                    message: `“${data.title}” and everything in it will be gone for good.`,
                                    confirmLabel: "Delete",
                                    danger: true
                                });
                                if (sure) removePlaylist(item);
                            }}
                            title="Delete this playlist"
                            aria-label="Delete this playlist"
                            className="flex h-10 w-10 items-center justify-center rounded-full text-subtext transition-colors hover:text-rose-400"
                        >
                            <Icon name="trash" className="h-5 w-5" />
                        </button>
                    )}
                </div>
                } />
            </div> : !loading ? (
                <div className="flex flex-col items-center gap-4 px-6 py-20 text-center text-sm text-subtext">
                    <p>Couldn&apos;t load this collection.</p>
                    <button onClick={() => setRetry((value) => value + 1)} className="rounded-md border border-border px-4 py-2 text-sm font-semibold text-maintext hover:border-subtext">Try again</button>
                </div>
            ) : null}
        </LoadingSwap>
    );
}
