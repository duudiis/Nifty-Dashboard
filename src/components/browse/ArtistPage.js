import { useEffect, useState } from "react";

import { useNifty } from "../../context/NiftyContext.js";
import { artworkOrFallback, onArtworkError } from "../../lib/format.js";
import Icon from "../Icon.js";
import TrackRow from "./TrackRow.js";
import Tile from "./Tile.js";

// Spotify-style artist page: big header, top songs, then a discography grid.
export default function ArtistPage({ id }) {
    const { play, selected } = useNifty();
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

    const topSongs = data.topSongs || [];
    const albums = (data.albums || []).map((a) => ({ ...a, kind: "album" }));
    const playTop = () => topSongs.forEach((t, i) => play(t.playQuery || t.url, i === 0 ? "now" : "queue"));

    return (
        <div className="flex flex-col">
            {/* header */}
            <div
                className="relative flex items-end gap-6 px-6 pb-6 pt-16"
                style={{ background: "linear-gradient(180deg, rgb(var(--c-accent) / 0.4) -20%, transparent 100%)" }}
            >
                <img
                    src={artworkOrFallback(data.artwork)}
                    onError={onArtworkError}
                    className="h-40 w-40 shrink-0 rounded-full object-cover shadow-2xl"
                    alt=""
                />
                <div className="flex min-w-0 flex-col gap-2">
                    <span className="text-xs font-bold uppercase tracking-wide text-subtext">Artist</span>
                    <h1 className="text-4xl font-bold leading-tight sm:text-6xl">{data.title}</h1>
                    {data.subtitle && <span className="text-sm text-subtext">{data.subtitle}</span>}
                </div>
            </div>

            {topSongs.length > 0 && (
                <button
                    onClick={playTop}
                    disabled={!selected}
                    className="mx-6 mt-4 flex w-fit items-center gap-2 rounded-full bg-accent px-5 py-2 text-sm font-bold text-canvas transition hover:brightness-110 disabled:opacity-40"
                >
                    <Icon name="play" className="h-4 w-4" /> Play
                </button>
            )}

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
