import { useEffect, useRef, useState } from "react";

import { LoadingSwap } from "./motion/index.js";
import { SongInfoSkeleton } from "./Loader.js";

// Fetches the server-cached extra song context (/api/songinfo): facts from
// iTunes plus a short artist blurb from Wikipedia. Shows a skeleton while it
// loads, then crossfades to the content (or nothing if there's none).
export default function SongInfo({ track }) {
    const key = track?.title ? JSON.stringify([track.title, track.artist || ""]) : null;
    const cache = useRef(new Map());
    const [result, setResult] = useState(null);
    const known = key && (result?.key === key || cache.current.has(key));
    const info = result?.key === key ? result.info : cache.current.get(key);
    const loading = !!key && !known;

    useEffect(() => {
        if (!key || cache.current.has(key)) return;
        const controller = new AbortController();
        const qs = new URLSearchParams({ title: track.title, artist: track.artist || "" });
        const publish = (info) => {
            if (controller.signal.aborted) return;
            cache.current.set(key, info);
            if (cache.current.size > 24) cache.current.delete(cache.current.keys().next().value);
            setResult({ key, info });
        };
        fetch(`/api/songinfo?${qs}`, { signal: controller.signal })
            .then((r) => r.ok ? r.json() : null)
            .then(publish)
            .catch(() => publish(null));
        return () => controller.abort();
    }, [key]);

    const it = info?.itunes;
    const artist = info?.artist;
    const hasContent = !!(it || artist);

    const year = it?.releaseDate ? new Date(it.releaseDate).getFullYear() : null;
    const facts = [
        it?.album && { label: "Album", value: it.album, href: it.albumUrl },
        it?.genre && { label: "Genre", value: it.genre },
        year && { label: "Released", value: String(year) },
        it?.country && { label: "Country", value: it.country }
    ].filter(Boolean);

    return (
        <LoadingSwap loading={loading} fallback={<SongInfoSkeleton />}>
            {hasContent ? (
                <div className="flex flex-col gap-4 border-t border-border/60 pt-4">
                    {facts.length > 0 && (
                        <div className="flex flex-col gap-2">
                            <span className="text-[10px] font-bold uppercase tracking-wide text-subtext">About this song</span>
                            <dl className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-1.5 text-[12px]">
                                {facts.map((f) => (
                                    <div key={f.label} className="contents">
                                        <dt className="text-subtext">{f.label}</dt>
                                        <dd className="truncate text-right text-maintext">
                                            {f.href ? (
                                                <a href={f.href} target="_blank" rel="noreferrer" className="hover:underline">
                                                    {f.value}
                                                </a>
                                            ) : (
                                                f.value
                                            )}
                                        </dd>
                                    </div>
                                ))}
                            </dl>
                        </div>
                    )}

                    {artist?.extract && (
                        <div className="flex flex-col gap-1.5">
                            <span className="text-[10px] font-bold uppercase tracking-wide text-subtext">About the artist</span>
                            <p className="text-[12px] leading-relaxed text-subtext">
                                <span className="line-clamp-5">{artist.extract}</span>
                            </p>
                            {artist.url && (
                                <a
                                    href={artist.url}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="w-fit text-[11px] font-bold text-accent hover:underline"
                                >
                                    Read more on Wikipedia
                                </a>
                            )}
                        </div>
                    )}
                </div>
            ) : null}
        </LoadingSwap>
    );
}
