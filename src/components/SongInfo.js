import { useEffect, useState } from "react";

// Fetches the server-cached extra song context (/api/songinfo) for the given
// track and renders a compact "About" block: facts from iTunes plus a short
// artist blurb from Wikipedia. Renders nothing until something useful arrives.
export default function SongInfo({ track }) {
    const [info, setInfo] = useState(null);

    useEffect(() => {
        if (!track?.title) {
            setInfo(null);
            return;
        }
        let stale = false;
        const qs = new URLSearchParams({ title: track.title, artist: track.artist || "" });
        fetch(`/api/songinfo?${qs}`)
            .then((r) => r.json())
            .then((j) => !stale && setInfo(j))
            .catch(() => !stale && setInfo(null));
        return () => {
            stale = true;
        };
    }, [track?.songUrl, track?.title]);

    const it = info?.itunes;
    const artist = info?.artist;
    if (!it && !artist) return null;

    const year = it?.releaseDate ? new Date(it.releaseDate).getFullYear() : null;

    const facts = [
        it?.album && { label: "Album", value: it.album, href: it.albumUrl },
        it?.genre && { label: "Genre", value: it.genre },
        year && { label: "Released", value: String(year) },
        it?.country && { label: "Country", value: it.country }
    ].filter(Boolean);

    return (
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
    );
}
