import { useEffect, useState } from "react";

import { useNifty } from "../../context/NiftyContext.js";
import { artworkOrFallback } from "../../lib/format.js";
import Icon from "../Icon.js";
import TrackRow from "./TrackRow.js";
import Tile from "./Tile.js";
import Backdrop from "./Backdrop.js";
import { useEntityActions, entityExternalUrl, recordCollectionQueued } from "./useEntityActions.js";

// Spotify-style artist page: artwork-tinted header, top songs, then the
// discography newest-first.
export default function ArtistPage({ id }) {
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
        fetch(`/api/library?refs=${encodeURIComponent(id)}`)
            .then((r) => r.json())
            .then((j) => !stale && setSaved((j.saved || []).includes(id)))
            .catch(() => {});
        return () => {
            stale = true;
        };
    }, [id]);

    if (loading) {
        return (
            <div className="flex flex-col gap-6 p-6">
                <div className="h-48 w-full animate-pulse rounded-xl bg-elevated" />
                <div className="h-6 w-40 animate-pulse rounded bg-elevated" />
            </div>
        );
    }

    if (!data?.title) {
        return <div className="p-8 text-center text-sm text-subtext">Couldn&apos;t load this artist.</div>;
    }

    const item = { browseId: id, kind: "artist", title: data.title, subtitle: data.subtitle, artwork: data.artwork };
    const externalLink = entityExternalUrl(item, data);

    const topSongs = data.topSongs || [];
    // Discography newest-first; entries without a release date sink to the end
    // in their original order.
    const albums = (data.albums || [])
        .map((a, i) => ({ ...a, kind: "album", _order: i }))
        .sort((a, b) => {
            if (a.releaseDate && b.releaseDate) return b.releaseDate.localeCompare(a.releaseDate);
            if (a.releaseDate) return -1;
            if (b.releaseDate) return 1;
            return a._order - b._order;
        });

    const playTop = () => {
        topSongs.forEach((t, i) => play(t.playQuery || t.url, i === 0 ? "now" : "queue"));
        recordCollectionQueued(item, data);
        if (data?.title) notify(`Playing ${data.title}`);
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

    return (
        <div className="flex flex-col">
            {/* header — tinted by the artist portrait */}
            <div className="relative">
                <Backdrop artwork={data.artwork} />
                <div className="relative flex items-end gap-6 px-6 pb-6 pt-20">
                    <img
                        src={artworkOrFallback(data.artwork)}
                        onError={(e) => (e.currentTarget.src = artworkOrFallback(null))}
                        className="h-44 w-44 shrink-0 rounded-full object-cover shadow-2xl ring-1 ring-white/10"
                        alt=""
                    />
                    <div className="flex min-w-0 flex-col gap-2 drop-shadow-sm">
                        <span className="text-xs font-bold uppercase tracking-wide text-maintext/80">Artist</span>
                        <h1 className="text-4xl font-extrabold leading-tight sm:text-6xl">{data.title}</h1>
                        {data.subtitle && <span className="text-sm font-semibold text-maintext/80">{data.subtitle}</span>}
                    </div>
                </div>
            </div>

            {/* actions */}
            <div className="flex items-center gap-3 px-6 py-4">
                {topSongs.length > 0 && (
                    <button
                        onClick={playTop}
                        disabled={!selected}
                        className="flex items-center gap-2 rounded-full bg-accent px-5 py-2 text-sm font-bold text-canvas transition hover:scale-[1.03] hover:brightness-110 disabled:opacity-40"
                    >
                        <Icon name="play" className="h-4 w-4" /> Play
                    </button>
                )}
                <button
                    onClick={toggleSave}
                    title={saved ? "Remove from your library" : "Save to your library"}
                    className={`flex h-10 w-10 items-center justify-center rounded-full transition hover:scale-105 ${saved ? "text-accent" : "text-subtext hover:text-maintext"}`}
                >
                    <Icon name={saved ? "heart-filled" : "heart"} className="h-6 w-6" />
                </button>
                {externalLink && (
                    <>
                        <button
                            onClick={() => window.open(externalLink, "_blank", "noopener,noreferrer")}
                            title="Open in browser"
                            className="flex h-10 w-10 items-center justify-center rounded-full text-subtext transition hover:scale-105 hover:text-maintext"
                        >
                            <Icon name="open" className="h-6 w-6" />
                        </button>
                        <button
                            onClick={copyLink}
                            title="Copy link"
                            className="flex h-10 w-10 items-center justify-center rounded-full text-subtext transition hover:scale-105 hover:text-maintext"
                        >
                            <Icon name="link" className="h-6 w-6" />
                        </button>
                    </>
                )}
            </div>

            {/* top songs */}
            {topSongs.length > 0 && (
                <div className="flex flex-col gap-1 px-4 py-4">
                    <h3 className="px-2 pb-2 text-lg font-bold text-maintext">Top songs</h3>
                    {topSongs.map((track, i) => (
                        <TrackRow key={`${track.videoId}-${i}`} track={track} index={i + 1} />
                    ))}
                </div>
            )}

            {/* discography */}
            {albums.length > 0 && (
                <div className="flex flex-col gap-3 px-6 pb-8">
                    <h3 className="text-lg font-bold text-maintext">Discography</h3>
                    <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                        {albums.map((a) => (
                            <Tile key={a.browseId} item={a} />
                        ))}
                    </div>
                </div>
            )}
        </div>
    );
}
