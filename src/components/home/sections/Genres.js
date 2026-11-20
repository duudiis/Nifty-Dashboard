import { useEffect, useRef, useState } from "react";

import Icon from "../../Icon.js";
import { CardsSkeleton } from "../../Loader.js";
import { LoadingSwap } from "../../motion/index.js";
import { GENRES } from "../../../lib/genres.js";
import Section, { Empty } from "../Section.js";
import Rail from "../Rail.js";
import Tile from "../../browse/Tile.js";

export default function Genres({ initialShelf = null }) {
    const [picked, setPicked] = useState("132");
    const [shelf, setShelf] = useState(initialShelf);
    const [loading, setLoading] = useState(!initialShelf);
    const cache = useRef(new Map(initialShelf ? [["132", initialShelf]] : []));

    useEffect(() => {
        const controller = new AbortController();
        const cached = cache.current.get(picked);
        if (cached) {
            setShelf(cached);
            setLoading(false);
            return () => controller.abort();
        }
        setLoading(true);
        setShelf(null);
        fetch(`/api/genres?id=${encodeURIComponent(picked)}`, { signal: controller.signal })
            .then((res) => res.ok ? res.json() : null)
            .then((json) => {
                if (controller.signal.aborted || !json) return;
                cache.current.set(picked, json);
                setShelf(json);
            })
            .catch(() => {})
            .finally(() => { if (!controller.signal.aborted) setLoading(false); });
        return () => controller.abort();
    }, [picked]);

    const items = [...(shelf?.songs || []), ...(shelf?.albums || [])];
    const name = GENRES.find((genre) => genre.id === picked)?.name;
    return (
        <Section id="genres" title="Explore your next mood" subtitle="Find a new direction, or stay with a favorite">
            <div className="grid gap-2 [grid-template-columns:repeat(auto-fit,minmax(min(100%,144px),1fr))]" aria-label="Browse by genre">
                {GENRES.map((genre) => (
                    <button
                        key={genre.id}
                        type="button"
                        onClick={() => {
                            if (genre.id === picked) return;
                            const cached = cache.current.get(genre.id);
                            setShelf(cached || null);
                            setLoading(!cached);
                            setPicked(genre.id);
                        }}
                        aria-pressed={picked === genre.id}
                        style={{ backgroundColor: genre.color }}
                        className={`flex h-14 items-center gap-2.5 rounded-md border px-3 text-left text-xs font-bold text-white transition-[filter,border-color] hover:brightness-110 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent ${picked === genre.id ? "border-white/80" : "border-transparent"}`}
                    >
                        <Icon name="music" className="h-4 w-4 shrink-0 text-white/75" />
                        <span className="min-w-0 truncate">{genre.name}</span>
                    </button>
                ))}
            </div>
            <div className="mt-1" aria-busy={loading}>
                <h3 className="mb-2 text-sm font-bold text-maintext">Discover {name}</h3>
                <LoadingSwap loading={loading} fallback={<CardsSkeleton />} contentClassName="min-h-[216px] sm:min-h-[236px]">
                    {items.length ? (
                        <Rail>{items.map((item) => <Tile key={item.browseId || item.url} item={item} />)}</Rail>
                    ) : <Empty>More music is on its way. Try another genre.</Empty>}
                </LoadingSwap>
            </div>
        </Section>
    );
}
