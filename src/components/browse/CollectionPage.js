import { useEffect, useState } from "react";

import { useNifty } from "../../context/NiftyContext.js";
import { artworkOrFallback } from "../../lib/format.js";
import Icon from "../Icon.js";
import TrackRow from "./TrackRow.js";
import Backdrop from "./Backdrop.js";
import { useEntityActions, entityExternalUrl, recordCollectionQueued } from "./useEntityActions.js";

// Album & playlist pages: an artwork-tinted header (cover, title, rich meta,
// queue/save/link controls) plus the full track list, where each row can be
// queued individually.

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

function RoundAction({ icon, title, onClick, active }) {
    return (
        <button
            onClick={onClick}
            title={title}
            className={`flex h-10 w-10 items-center justify-center rounded-full transition hover:scale-105 ${
                active ? "text-accent" : "text-subtext hover:text-maintext"
            }`}
        >
            <Icon name={icon} className="h-6 w-6" />
        </button>
    );
}

export default function CollectionPage({ id }) {
    const { play, selected, notify } = useNifty();
    const { saveEntity } = useEntityActions();
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [saved, setSaved] = useState(false);

    useEffect(() => {
        let stale = false;
        setLoading(true);
        setData(null);
        setSaved(false);
        fetch(`/api/browse?id=${encodeURIComponent(id)}`)
            .then((r) => r.json())
            .then((j) => !stale && setData(j))
            .catch(() => !stale && setData(null))
            .finally(() => !stale && setLoading(false));
        // Heart state rides on a separate, quiet request.
        fetch(`/api/library?refs=${encodeURIComponent(id)}`)
            .then((r) => r.json())
            .then((j) => !stale && setSaved((j.saved || []).includes(id)))
            .catch(() => {});
        return () => {
            stale = true;
        };
    }, [id]);

    const tracks = data?.tracks || [];
    const kind = data?.type || "collection";
    const item = { browseId: id, kind, title: data?.title, subtitle: data?.subtitle, artwork: data?.artwork };
    const externalLink = entityExternalUrl(item, data);

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

    const toggleSave = async () => {
        setSaved(await saveEntity(item, !saved, data));
    };

    const copyLink = async () => {
        if (!externalLink) return;
        try {
            await navigator.clipboard.writeText(externalLink);
            notify("Copied link to clipboard");
        } catch {
            notify("Couldn't copy the link");
        }
    };

    if (loading) {
        return (
            <div className="flex items-end gap-6 p-6">
                <div className="h-48 w-48 shrink-0 animate-pulse rounded-md bg-elevated" />
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

    const year = releaseYear(data.releaseDate);
    const length = totalDuration(tracks);
    const metaBits = [
        year,
        tracks.length ? `${tracks.length} track${tracks.length === 1 ? "" : "s"}` : null,
        length
    ].filter(Boolean);

    return (
        <div className="flex flex-col">
            {/* header — tinted by the artwork itself */}
            <div className="relative">
                <Backdrop artwork={data.artwork} />
                <div className="relative flex flex-col gap-6 px-6 pb-6 pt-14 sm:flex-row sm:items-end">
                    <img
                        src={artworkOrFallback(data.artwork)}
                        onError={(e) => (e.currentTarget.src = artworkOrFallback(null))}
                        className="h-48 w-48 shrink-0 rounded-md object-cover shadow-2xl ring-1 ring-white/10"
                        alt=""
                    />
                    <div className="flex min-w-0 flex-col gap-2 drop-shadow-sm">
                        <span className="text-xs font-bold uppercase tracking-wide text-maintext/80">{kind}</span>
                        <h1 className="text-4xl font-extrabold leading-tight sm:text-5xl">{data.title}</h1>
                        {data.subtitle && <span className="text-sm font-semibold text-maintext/90">{data.subtitle}</span>}
                        {metaBits.length > 0 && (
                            <span className="text-xs text-maintext/70">{metaBits.join(" · ")}</span>
                        )}
                    </div>
                </div>
            </div>

            {/* actions */}
            <div className="flex items-center gap-3 px-6 py-4">
                <button
                    onClick={playAll}
                    disabled={!selected || (tracks.length === 0 && !playUrl)}
                    className="flex items-center gap-2 rounded-full bg-accent px-5 py-2 text-sm font-bold text-canvas transition hover:scale-[1.03] hover:brightness-110 disabled:opacity-40"
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
                <RoundAction
                    icon={saved ? "heart-filled" : "heart"}
                    title={saved ? "Remove from your library" : "Save to your library"}
                    onClick={toggleSave}
                    active={saved}
                />
                {externalLink && (
                    <>
                        <RoundAction icon="open" title="Open in browser" onClick={() => window.open(externalLink, "_blank", "noopener,noreferrer")} />
                        <RoundAction icon="link" title="Copy link" onClick={copyLink} />
                    </>
                )}
            </div>

            {/* tracks */}
            <div className="flex flex-col gap-1 px-4 pb-6">
                {tracks.map((track, i) => (
                    <TrackRow key={`${track.videoId}-${i}`} track={track} index={i + 1} />
                ))}
                {tracks.length === 0 && playUrl && (
                    <div className="px-4 py-6 text-sm text-subtext">
                        Track list unavailable for this {kind} — Play still queues the whole thing.
                    </div>
                )}
            </div>
        </div>
    );
}
