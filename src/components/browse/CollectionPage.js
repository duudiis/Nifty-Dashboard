import { useEffect, useRef, useState } from "react";

import { useNifty } from "../../context/NiftyContext.js";
import { artworkOrFallback } from "../../lib/format.js";
import { parseEntityId } from "../../sources/ids.js";
import Icon from "../Icon.js";
import TrackRow from "./TrackRow.js";
import ArtistLink from "./ArtistLink.js";
import { AnimatePresence, motion, Reorder, EASE } from "../motion/index.js";
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

// Mirrors the real header + actions + rows, so load -> loaded barely shifts.
export function CollectionSkeleton({ round = false }) {
    return (
        <div className="flex flex-col">
            <div className="flex items-end gap-6 px-6 pb-6 pt-14">
                <div className={`h-48 w-48 shrink-0 animate-pulse bg-elevated ${round ? "rounded-full" : "rounded-md"}`} />
                <div className="flex min-w-0 flex-1 flex-col gap-3 pb-1">
                    <div className="h-3 w-16 animate-pulse rounded bg-elevated" />
                    <div className="h-11 w-2/3 animate-pulse rounded bg-elevated" />
                    <div className="h-3 w-40 animate-pulse rounded bg-elevated" />
                </div>
            </div>
            <div className="flex items-center gap-3 px-6 py-4">
                <div className="h-9 w-24 animate-pulse rounded-full bg-elevated" />
                <div className="h-9 w-40 animate-pulse rounded-full bg-elevated" />
                <div className="h-9 w-9 animate-pulse rounded-full bg-elevated" />
            </div>
            <div className="flex flex-col gap-1 px-4 pb-6">
                {Array.from({ length: 7 }).map((_, i) => (
                    <div key={i} className="flex items-center gap-3 p-2">
                        <div className="h-11 w-11 shrink-0 animate-pulse rounded bg-elevated" />
                        <div className="flex flex-1 flex-col gap-1.5">
                            <div className="h-3 animate-pulse rounded bg-elevated" style={{ width: `${52 - i * 4}%` }} />
                            <div className="h-2.5 animate-pulse rounded bg-elevated" style={{ width: `${28 - i * 2}%` }} />
                        </div>
                    </div>
                ))}
            </div>
        </div>
    );
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

// The track table: a queue-style column header (both albums and playlists),
// plus — for playlists only — a persisted sort control and drag reordering of
// owned collections while in custom order.
function TrackList({ data, refId, kind, playUrl }) {
    const isPlaylist = data.type === "playlist";
    const reorderable = !!data.reorderable; // owned custom playlists + liked songs

    const [sort, setSort] = useState({ sortBy: "custom", sortDesc: false });
    const [order, setOrder] = useState(data.tracks || []);
    const orderRef = useRef(order);
    orderRef.current = order;

    // Mirror fresh data on load / navigation (unless we're the source of the change).
    useEffect(() => { setOrder(data.tracks || []); }, [data.tracks]);

    // Load the user's saved sort for this playlist.
    useEffect(() => {
        if (!isPlaylist) return;
        let stale = false;
        fetch(`/api/library?view=sort&ref=${encodeURIComponent(refId)}`)
            .then((r) => r.json())
            .then((j) => { if (!stale) setSort({ sortBy: j.sortBy || "custom", sortDesc: !!j.sortDesc }); })
            .catch(() => {});
        return () => { stale = true; };
    }, [isPlaylist, refId]);

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

    const dragEnabled = reorderable && sort.sortBy === "custom";
    const displayed = dragEnabled ? order : sortTracks(order, sort.sortBy, sort.sortDesc);

    const commitReorder = () => {
        const ids = orderRef.current.map((t) => t.entryId).filter(Boolean);
        if (!ids.length) return;
        const body = data.liked
            ? { action: "reorder_liked", order: ids }
            : { action: "reorder_playlist", playlistId: parseEntityId(refId)?.id, order: ids };
        fetch("/api/library", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(body)
        }).catch(() => {});
    };

    // "Date added" only makes sense when the tracks actually carry add dates
    // (owned playlists + imported liked songs).
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

    if (displayed.length === 0) {
        return (
            <div className="px-6 py-8 text-sm text-subtext">
                {playUrl
                    ? `Track list unavailable for this ${kind} — Play still queues the whole thing.`
                    : data.liked
                        ? "Songs you save with the heart will show up here."
                        : "This playlist is empty — right-click any track and pick “Add to playlist”."}
            </div>
        );
    }

    const rows = displayed.map((track, i) => (
        <TrackRow
            key={dragEnabled ? track.entryId : `${track.url}-${i}`}
            track={track}
            index={i + 1}
            dragValue={dragEnabled ? track : null}
            onDragCommit={commitReorder}
        />
    ));

    return (
        <div className="flex flex-col gap-1 px-4 pb-6">
            {/* column header */}
            <div className="flex items-center gap-3 border-b border-border/60 px-2 pb-2 text-[10px] font-bold uppercase tracking-wide text-subtext">
                <span className="hidden w-5 shrink-0 text-center sm:block">#</span>
                <span className="w-11 shrink-0" />
                <span className="min-w-0 flex-1">Title</span>
                {isPlaylist && (
                    <button
                        onClick={openSortMenu}
                        title="Sort"
                        className="flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-subtext transition-colors hover:bg-elevated hover:text-maintext"
                    >
                        <Icon name="list" className="h-3.5 w-3.5" />
                        {currentSortLabel}
                        {sort.sortBy !== "custom" && (
                            <Icon name="chevron-down" className={`h-3 w-3 transition-transform ${sort.sortDesc ? "" : "rotate-180"}`} />
                        )}
                    </button>
                )}
                <span className="w-12 shrink-0 text-center">Time</span>
            </div>

            {dragEnabled ? (
                <Reorder.Group as="div" axis="y" values={order} onReorder={setOrder} className="flex flex-col gap-1">
                    {rows}
                </Reorder.Group>
            ) : (
                <div className="flex flex-col gap-1">{rows}</div>
            )}
        </div>
    );
}

export default function CollectionPage({ id }) {
    const { play, selected, notify, setPageArt, isSaved, toggleSaveEntity, removePlaylist } = useNifty();
    const modal = useModal();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let stale = false;
        setLoading(true);
        setData(null);
        setPageArt(null);
        fetch(`/api/browse?id=${encodeURIComponent(id)}`)
            .then((r) => r.json())
            .then((j) => {
                if (stale) return;
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

    return (
        <AnimatePresence mode="popLayout" initial={false}>
            <motion.div
                key={loading ? "skeleton" : "content"}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.2, ease: EASE }}
            >
                {loading ? (
                    <CollectionSkeleton />
                ) : !data?.title ? (
                    <div className="p-8 text-center text-sm text-subtext">Couldn&apos;t load this {data?.type || "page"}.</div>
                ) : (
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
                        <TrackList data={data} refId={id} kind={kind} playUrl={playUrl} />
                    </div>
                )}
            </motion.div>
        </AnimatePresence>
    );
}
