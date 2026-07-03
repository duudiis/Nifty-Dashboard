import { useEffect, useState } from "react";

import { useNifty } from "../../context/NiftyContext.js";
import { artworkOrFallback } from "../../lib/format.js";
import Icon from "../Icon.js";
import TrackRow from "./TrackRow.js";
import ArtistLink from "./ArtistLink.js";
import { AnimatePresence, motion, EASE } from "../motion/index.js";
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

export default function CollectionPage({ id }) {
    const { play, selected, notify, setPageArt, isSaved, toggleSaveEntity } = useNifty();
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
                setPageArt(j?.artwork || null);
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
                        </div>

                        {/* tracks */}
                        <div className="flex flex-col gap-1 px-4 pb-6">
                            {tracks.map((track, i) => (
                                <TrackRow key={`${track.url}-${i}`} track={track} index={i + 1} />
                            ))}
                            {tracks.length === 0 && playUrl && (
                                <div className="px-4 py-6 text-sm text-subtext">
                                    Track list unavailable for this {kind} — Play still queues the whole thing.
                                </div>
                            )}
                            {tracks.length === 0 && !playUrl && data.custom && (
                                <div className="px-4 py-6 text-sm text-subtext">
                                    {data.liked
                                        ? "Songs you save with the heart will show up here."
                                        : "This playlist is empty — right-click any track and pick “Add to playlist”."}
                                </div>
                            )}
                        </div>
                    </div>
                )}
            </motion.div>
        </AnimatePresence>
    );
}
