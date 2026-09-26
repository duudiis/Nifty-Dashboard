import { useCallback, useEffect, useRef, useState } from "react";

import { useNifty } from "../../context/NiftyContext.js";
import { artworkOrFallback } from "../../lib/format.js";
import { parseEntityId } from "../../sources/ids.js";
import Icon from "../Icon.js";
import { PageLoader } from "../Loader.js";
import TrackRow from "./TrackRow.js";
import ArtistLink from "./ArtistLink.js";
import { motion, Reorder, EASE } from "../motion/index.js";
import { useDragScroll, findScroller } from "../motion/useDragScroll.js";
import { useContextMenu } from "../menu/ContextMenu.js";
import { useModal } from "../modal/Modal.js";
import { entityExternalUrl, recordCollectionQueued } from "./useEntityActions.js";

// Album & playlist pages: an artwork-tinted header (the blur itself is pinned
// by CenterContent so it can't leak during the page slide), rich meta, play/
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
    const total = tracks.reduce((sum, t) => sum + clockToSeconds(t.duration), 0);
    if (!total) return null;
    const h = Math.floor(total / 3600);
    const m = Math.round((total % 3600) / 60);
    return h > 0 ? `${h} hr ${m} min` : `${m} min`;
}

function releaseYear(date) {
    const year = String(date || "").slice(0, 4);
    return /^\d{4}$/.test(year) ? year : null;
}

const BASE_SORT_OPTIONS = [
    { id: "custom", label: "Custom order" },
    { id: "added", label: "Date added" },
    { id: "title", label: "Title" },
    { id: "artist", label: "Artist" },
    { id: "duration", label: "Duration" }
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

const ROW_H = 60;      // fixed row height (px); every track row is exactly h-[60px]
const OVERSCAN = 12;   // rows rendered beyond the viewport on each side

// Virtualized track table: only the rows near the viewport are mounted; the
// rest are represented by top/bottom spacers. A Liked list of thousands keeps
// a small, constant DOM/framer footprint no matter how far you scroll. framer's
// <Reorder> runs on that window; during a drag the window may only grow (never
// evict) so items stay mounted while you auto-scroll. The sort arrives with the
// page (initialSort), so the list is ordered on its first paint.
function TrackList({ data, refId, kind, playUrl, initialSort }) {
    const isPlaylist = data.type === "playlist";
    const reorderable = !!data.reorderable;

    const [sort, setSort] = useState(initialSort || { sortBy: "custom", sortDesc: false });
    const [order, setOrder] = useState(data.tracks || []);
    const orderRef = useRef(order); orderRef.current = order;

    const wrapRef = useRef(null);          // spacers + rows; its top = logical row 0
    const scrollerRef = useRef(null);
    const draggingRef = useRef(false);
    const { start: startAutoscroll, stop: stopAutoscroll } = useDragScroll(wrapRef);

    const dragEnabled = reorderable && sort.sortBy === "custom";
    const displayed = dragEnabled ? order : sortTracks(order, sort.sortBy, sort.sortDesc);
    const total = displayed.length;

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
        const n = orderRef.current.length;
        let start = Math.max(0, Math.floor(past / ROW_H) - OVERSCAN);
        let end = Math.min(n, Math.ceil((past + sc.height) / ROW_H) + OVERSCAN);
        if (end <= start) end = Math.min(n, start + 1);
        const prev = rangeRef.current;
        if (draggingRef.current) {                  // never evict mid-drag
            start = Math.min(prev.start, start);
            end = Math.max(prev.end, end);
        }
        if (prev.start !== start || prev.end !== end) setRange({ start, end });
    }, []);

    // Reset the window on data / sort change, then measure.
    useEffect(() => { setOrder(data.tracks || []); }, [data.tracks]);
    useEffect(() => { if (initialSort) setSort(initialSort); }, [initialSort]);
    useEffect(() => {
        setRange({ start: 0, end: 30 });
        const id = requestAnimationFrame(recompute);
        return () => cancelAnimationFrame(id);
    }, [total, sort.sortBy, recompute]);

    // Follow the page scroller.
    useEffect(() => {
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
        }).catch(() => {});
    };

    const chooseSort = (sortBy) => {
        if (sortBy === sort.sortBy && sortBy !== "custom") persistSort({ sortBy, sortDesc: !sort.sortDesc });
        else persistSort({ sortBy, sortDesc: false });
    };

    // framer <Reorder> reorders only the mounted window; splice it back into
    // the full order around the window bounds.
    const onReorder = (winRows) => {
        const { start, end } = rangeRef.current;
        setOrder([...orderRef.current.slice(0, start), ...winRows, ...orderRef.current.slice(end)]);
    };

    const onRowDragStart = () => { draggingRef.current = true; startAutoscroll(); };
    const onRowDragEnd = () => {
        draggingRef.current = false;
        stopAutoscroll();
        const ids = orderRef.current.map((t) => t.entryId).filter(Boolean);
        if (ids.length) {
            const body = data.liked
                ? { action: "reorder_liked", order: ids }
                : { action: "reorder_playlist", playlistId: parseEntityId(refId)?.id, order: ids };
            fetch("/api/library", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) }).catch(() => {});
        }
        requestAnimationFrame(recompute); // collapse the grown window back to the viewport
    };

    const hasAddedDates = (data.tracks || []).some((t) => t.addedAt);
    const sortOptions = BASE_SORT_OPTIONS.filter((o) => o.id !== "added" || hasAddedDates);

    const { onContextMenu: openSortMenu } = useContextMenu(() =>
        sortOptions.map((o) => ({
            label: o.id === sort.sortBy && o.id !== "custom"
                ? `${o.label} · ${sort.sortDesc ? "descending" : "ascending"}`
                : o.label,
            icon: o.id === sort.sortBy ? "check" : undefined,
            onClick: () => chooseSort(o.id)
        }))
    );

    const currentSortLabel = BASE_SORT_OPTIONS.find((o) => o.id === sort.sortBy)?.label || "Custom order";

    const header = (
        <div className="flex items-center gap-3 border-b border-border/60 px-2 pb-2 text-[10px] font-bold uppercase tracking-wide text-subtext">
            <span className="hidden w-5 shrink-0 text-center sm:block">#</span>
            <span className="w-11 shrink-0" />
            <span className="min-w-0 flex-1">Title</span>
            {isPlaylist && (
                <button onClick={openSortMenu} title="Sort" className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-subtext transition-colors hover:bg-elevated hover:text-maintext">
                    <Icon name="list" className="h-3.5 w-3.5" />
                    {currentSortLabel}
                    {sort.sortBy !== "custom" && <Icon name="chevron-down" className={`h-3 w-3 transition-transform ${sort.sortDesc ? "" : "rotate-180"}`} />}
                </button>
            )}
            <span className="w-12 shrink-0 text-center">Time</span>
        </div>
    );

    if (total === 0) {
        return (
            <div className="flex flex-col px-4 pb-6">
                {header}
                <div className="px-2 py-8 text-sm text-subtext">
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
            key={dragEnabled ? track.entryId : `${track.url}-${range.start + i}`}
            track={track}
            index={range.start + i + 1}
            dragValue={dragEnabled ? track : null}
            onDragStart={onRowDragStart}
            onDragEnd={onRowDragEnd}
        />
    ));
    const topPad = range.start * ROW_H;
    const botPad = Math.max(0, (total - range.end) * ROW_H);

    return (
        <div className="flex flex-col px-4 pb-6">
            {header}
            <div ref={wrapRef} className="flex flex-col">
                {topPad > 0 && <div style={{ height: topPad }} aria-hidden />}
                {dragEnabled ? (
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
    const { play, selected, notify, setPageArt, isSaved, toggleSaveEntity, removePlaylist } = useNifty();
    const modal = useModal();
    const [data, setData] = useState(null);
    const [sortPref, setSortPref] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let stale = false;
        setLoading(true);
        setData(null);
        setSortPref(null);
        setPageArt(null);
        // Fetch the tracks and the saved sort together so the list is ordered
        // correctly on its first paint — no flash of custom order re-sorting
        // once a later sort request lands.
        Promise.all([
            fetch(`/api/browse?id=${encodeURIComponent(id)}`).then((r) => r.json()),
            fetch(`/api/library?view=sort&ref=${encodeURIComponent(id)}`).then((r) => r.json()).catch(() => null)
        ])
            .then(([j, s]) => {
                if (stale) return;
                setSortPref(s && s.sortBy ? { sortBy: s.sortBy, sortDesc: !!s.sortDesc } : { sortBy: "custom", sortDesc: false });
                setData(j);
                // Liked songs gets the accent-tinted backdrop matching its
                // cover tile, never a track's artwork.
                setPageArt(j?.liked ? "accent" : j?.artwork || null);
            })
            .catch(() => !stale && setData(null))
            .finally(() => !stale && setLoading(false));
        return () => {
            stale = true;
            setPageArt(null);
        };
    }, [id, setPageArt]);

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
        tracks.length ? `${tracks.length} track${tracks.length === 1 ? "" : "s"}` : null,
        length
    ].filter(Boolean);

    if (loading) return <PageLoader />;
    if (!data?.title) {
        return <div className="p-8 text-center text-sm text-subtext">Couldn&apos;t load this {data?.type || "page"}.</div>;
    }

    return (
        // One-shot fade-in only — no AnimatePresence / popLayout wrapping the
        // track list, so framer never re-measures a thousands-long list during
        // a drag (that layout pass, absent on the queue page, was the lag).
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.2, ease: EASE }}>
                    <div className="flex flex-col">
                        {/* header — the artwork blur behind it is pinned by CenterContent */}
                        <div className="flex flex-col gap-6 px-6 pb-6 pt-14 sm:flex-row sm:items-end">
                            {data.liked ? (
                                <span className="flex h-48 w-48 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-accent to-accent/40 text-canvas shadow-2xl">
                                    <Icon name="heart-filled" className="h-20 w-20" />
                                </span>
                            ) : (
                                <img
                                    src={artworkOrFallback(data.artwork)}
                                    onError={(e) => (e.currentTarget.src = artworkOrFallback(null))}
                                    className="h-48 w-48 shrink-0 rounded-md object-cover shadow-2xl ring-1 ring-white/10"
                                    alt=""
                                />
                            )}
                            <div className="flex min-w-0 flex-col gap-2 drop-shadow-sm">
                                <span className="text-xs font-bold uppercase tracking-wide text-maintext/80">{kind}</span>
                                <h1 className="text-4xl font-extrabold leading-tight sm:text-5xl">{data.title}</h1>
                                {data.subtitle && (
                                    kind === "album" ? (
                                        <ArtistLink
                                            name={data.subtitle}
                                            browseId={data.artistBrowseId}
                                            className="text-sm font-semibold text-maintext/90"
                                        />
                                    ) : (
                                        <span className="text-sm font-semibold text-maintext/90">{data.subtitle}</span>
                                    )
                                )}
                                {metaBits.length > 0 && (
                                    <span className="text-xs text-maintext/70">{metaBits.join(" · ")}</span>
                                )}
                            </div>
                        </div>

                        {/* actions */}
                        <div className="flex items-center gap-3 px-6 py-4">
                            <button
                                onClick={playAll}
                                disabled={!selected || (tracks.length === 0 && !playUrl)}
                                className="flex items-center gap-2 rounded-full bg-accent px-5 py-2 text-sm font-bold text-canvas transition hover:brightness-110 disabled:opacity-40"
                            >
                                <Icon name="play" className="h-4 w-4" /> Play
                            </button>
                            <button
                                onClick={queueAll}
                                disabled={!selected || (tracks.length === 0 && !playUrl)}
                                className="flex items-center gap-2 rounded-full bg-elevated px-5 py-2 text-sm font-bold text-maintext transition hover:bg-surface disabled:opacity-40"
                            >
                                <Icon name="enqueue" className="h-4 w-4" /> Add all to queue
                            </button>
                            {!data.custom && (
                                <button
                                    onClick={() => toggleSaveEntity(item, data)}
                                    title={saved ? "Remove from your library" : "Save to your library"}
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
                                    className="flex h-10 w-10 items-center justify-center rounded-full text-subtext transition-colors hover:text-rose-400"
                                >
                                    <Icon name="trash" className="h-5 w-5" />
                                </button>
                            )}
                        </div>

                        {/* tracks */}
                        <TrackList data={data} refId={id} kind={kind} playUrl={playUrl} initialSort={sortPref} />
                    </div>
        </motion.div>
    );
}
