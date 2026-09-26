import { useEffect, useRef, useState } from "react";

import Tile from "../../browse/Tile.js";
import { Stagger, StaggerItem } from "../../motion/index.js";
import Section, { Empty } from "../Section.js";
import Rail from "../Rail.js";

/* Somewhere to go when nothing on the rest of the page is what you want.
   The genre list is ours rather than Deezer's — theirs is localised by request
   IP and reorders itself between calls — and each genre shows playlists and
   albums, the two shelves that actually change with the genre. */

const DEFAULT_GENRE = "132"; // Pop — the one shelf that is never thin

export default function Genres() {
    const [genres, setGenres] = useState([]);
    const [picked, setPicked] = useState(DEFAULT_GENRE);
    const [shelf, setShelf] = useState(null);
    const [loading, setLoading] = useState(true);

    // Genre shelves are cached for hours server-side, so a browsed genre stays
    // instant on the way back to it.
    const seen = useRef(new Map());

    useEffect(() => {
        let live = true;
        fetch("/api/genres")
            .then((r) => (r.ok ? r.json() : { genres: [] }))
            .then((j) => { if (live) setGenres(j.genres || []); })
            .catch(() => {});
        return () => { live = false; };
    }, []);

    useEffect(() => {
        let live = true;
        const cached = seen.current.get(picked);
        if (cached) {
            setShelf(cached);
            setLoading(false);
            return;
        }

        setLoading(true);
        fetch(`/api/genres?id=${encodeURIComponent(picked)}`)
            .then((r) => (r.ok ? r.json() : null))
            .then((j) => {
                if (!live || !j) return;
                seen.current.set(picked, j);
                setShelf(j);
            })
            .catch(() => {})
            .finally(() => { if (live) setLoading(false); });

        return () => { live = false; };
    }, [picked]);

    const items = [...(shelf?.playlists || []), ...(shelf?.albums || [])];

    const chips = (
        <div className="flex flex-wrap gap-1.5">
            {genres.map((g) => (
                <button
                    key={g.id}
                    type="button"
                    onClick={() => setPicked(g.id)}
                    className={`rounded-full px-3 py-1 text-xs font-bold transition ${
                        picked === g.id ? "bg-maintext text-canvas" : "bg-elevated text-subtext hover:text-maintext"
                    }`}
                >
                    {g.name}
                </button>
            ))}
        </div>
    );

    return (
        <Section
            id="genres"
            title="Browse by genre"
            subtitle={shelf?.name ? `Playlists and albums across ${shelf.name}` : "Somewhere else to start"}
            minHeight={340}
        >
            <div className="flex flex-col gap-4">
                {chips}

                {loading ? (
                    // The chips stay live while a shelf loads — the wash would
                    // take them with it, and switching genres is the point.
                    <Stagger className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-6" gap={0.03}>
                        {Array.from({ length: 6 }).map((_, i) => (
                            <StaggerItem key={i}>
                                <div className="aspect-square w-full animate-pulse rounded-md bg-elevated" />
                            </StaggerItem>
                        ))}
                    </Stagger>
                ) : items.length ? (
                    <Rail itemClassName="w-[168px]">
                        {items.map((item, i) => (
                            <Tile key={item.browseId || i} item={item} />
                        ))}
                    </Rail>
                ) : (
                    <Empty>Nothing came back for that genre — try another.</Empty>
                )}
            </div>
        </Section>
    );
}
