import { useEffect, useState } from "react";

import { useNifty } from "../../context/NiftyContext.js";
import { artworkOrFallback } from "../../lib/format.js";
import Icon from "../Icon.js";
import TrackRow from "./TrackRow.js";

// Album & playlist pages: a header (cover, title, queue-all controls) plus the
// full track list, where each row can be queued individually.
export default function CollectionPage({ id }) {
    const { play, selected, notify } = useNifty();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        let stale = false;
        setLoading(true);
        setData(null);
        fetch(`/api/browse?id=${encodeURIComponent(id)}`)
            .then((r) => r.json())
            .then((j) => !stale && setData(j))
            .catch(() => !stale && setData(null))
            .finally(() => !stale && setLoading(false));
        return () => {
            stale = true;
        };
    }, [id]);

    const tracks = data?.tracks || [];

    // Queue the whole collection in one request so the bot loads it in order
    // (and, for albums, as audio). The source hands back a ready play URL for
    // the collection; fall back to per-track only if it couldn't resolve one.
    const playUrl = data?.playUrl || null;
    const queueAll = () => {
        playUrl ? play(playUrl, "queue") : tracks.forEach((t) => play(t.playQuery || t.url, "queue"));
        if (data?.title) notify(`Added “${data.title}” to the queue`);
    };
    const playAll = () => {
        playUrl ? play(playUrl, "now") : tracks.forEach((t, i) => play(t.playQuery || t.url, i === 0 ? "now" : "queue"));
        if (data?.title) notify(`Now playing “${data.title}”`);
    };

    if (loading) {
        return (
            <div className="flex items-end gap-6 p-6">
                <div className="h-44 w-44 shrink-0 animate-pulse rounded-md bg-elevated" />
                <div className="flex flex-1 flex-col gap-3">
                    <div className="h-4 w-20 animate-pulse rounded bg-elevated" />
                    <div className="h-10 w-2/3 animate-pulse rounded bg-elevated" />
                    <div className="h-3 w-1/3 animate-pulse rounded bg-elevated" />
                </div>
            </div>
        );
    }

    if (!data?.title) {
        return <div className="p-8 text-center text-sm text-subtext">Couldn&apos;t load this {data?.type || "page"}.</div>;
    }

    return (
        <div className="flex flex-col">
            {/* header */}
            <div
                className="flex flex-col gap-6 px-6 pb-6 pt-10 sm:flex-row sm:items-end"
                style={{ background: "linear-gradient(180deg, rgb(var(--c-accent) / 0.35) -40%, transparent 100%)" }}
            >
                <img
                    src={artworkOrFallback(data.artwork)}
                    onError={(e) => (e.currentTarget.src = artworkOrFallback(null))}
                    className="h-44 w-44 shrink-0 rounded-md object-cover shadow-2xl"
                    alt=""
                />
                <div className="flex min-w-0 flex-col gap-2">
                    <span className="text-xs font-bold uppercase tracking-wide text-subtext">{data.type}</span>
                    <h1 className="text-4xl font-bold leading-tight sm:text-5xl">{data.title}</h1>
                    {data.subtitle && <span className="text-sm text-subtext">{data.subtitle}</span>}
                    <span className="text-xs text-subtext">{tracks.length} track{tracks.length === 1 ? "" : "s"}</span>
                </div>
            </div>

            {/* actions */}
            <div className="flex items-center gap-3 px-6 py-4">
                <button
                    onClick={playAll}
                    disabled={!selected || tracks.length === 0}
                    className="flex items-center gap-2 rounded-full bg-accent px-5 py-2 text-sm font-bold text-canvas transition hover:brightness-110 disabled:opacity-40"
                >
                    <Icon name="play" className="h-4 w-4" /> Play
                </button>
                <button
                    onClick={queueAll}
                    disabled={!selected || tracks.length === 0}
                    className="flex items-center gap-2 rounded-full bg-elevated px-5 py-2 text-sm font-bold text-maintext transition hover:bg-surface disabled:opacity-40"
                >
                    <Icon name="enqueue" className="h-4 w-4" /> Add all to queue
                </button>
            </div>

            {/* tracks */}
            <div className="flex flex-col gap-1 px-4 pb-6">
                {tracks.map((track, i) => (
                    <TrackRow key={`${track.videoId}-${i}`} track={track} index={i + 1} />
                ))}
            </div>
        </div>
    );
}
