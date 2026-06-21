import { useEffect, useState } from "react";

import { AnimatePresence, motion, EASE, DUR } from "./motion/index.js";

const fade = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: DUR.base, ease: EASE }
};

// Placeholder that mirrors the loaded "About" layout (facts grid + artist blurb).
function InfoSkeleton() {
    return (
        <div className="flex animate-pulse flex-col gap-4 border-t border-border/60 pt-4">
            <div className="flex flex-col gap-2.5">
                <div className="h-2.5 w-24 rounded bg-elevated" />
                <div className="grid grid-cols-[auto,1fr] gap-x-4 gap-y-2.5">
                    {[
                        ["w-12", "w-24"],
                        ["w-14", "w-16"],
                        ["w-16", "w-12"],
                        ["w-12", "w-20"]
                    ].map(([l, r], i) => (
                        <div key={i} className="contents">
                            <div className={`h-3 ${l} rounded bg-elevated`} />
                            <div className={`h-3 ${r} justify-self-end rounded bg-elevated`} />
                        </div>
                    ))}
                </div>
            </div>
            <div className="flex flex-col gap-2.5">
                <div className="h-2.5 w-24 rounded bg-elevated" />
                {["w-full", "w-full", "w-full", "w-2/3"].map((w, i) => (
                    <div key={i} className={`h-3 ${w} rounded bg-elevated`} />
                ))}
            </div>
        </div>
    );
}

// Fetches the server-cached extra song context (/api/songinfo): facts from
// iTunes plus a short artist blurb from Wikipedia. Shows a skeleton while it
// loads, then crossfades to the content (or nothing if there's none).
export default function SongInfo({ track }) {
    const [info, setInfo] = useState(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!track?.title) {
            setInfo(null);
            setLoading(false);
            return;
        }
        let stale = false;
        setLoading(true);
        setInfo(null);
        const qs = new URLSearchParams({ title: track.title, artist: track.artist || "" });
        fetch(`/api/songinfo?${qs}`)
            .then((r) => r.json())
            .then((j) => !stale && setInfo(j))
            .catch(() => !stale && setInfo(null))
            .finally(() => !stale && setLoading(false));
        return () => {
            stale = true;
        };
    }, [track?.songUrl, track?.title]);

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
        <AnimatePresence mode="wait" initial={false}>
            {loading ? (
                <motion.div key="skeleton" {...fade}>
                    <InfoSkeleton />
                </motion.div>
            ) : hasContent ? (
                <motion.div key="content" {...fade} className="flex flex-col gap-4 border-t border-border/60 pt-4">
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
                </motion.div>
            ) : null}
        </AnimatePresence>
    );
}
