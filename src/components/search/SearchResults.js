import { useState } from "react";

import { useNifty } from "../../context/NiftyContext.js";
import Icon from "../Icon.js";
import { Stagger, StaggerItem } from "../motion/index.js";
import Tile from "../browse/Tile.js";
import TrackRow from "../browse/TrackRow.js";
import EntityRow from "../browse/EntityRow.js";

function FilterBar({ sections, type, setType, display, setDisplay }) {
    const types = [{ kind: "all", title: "All" }, ...sections.map((s) => ({ kind: s.kind, title: s.title }))];
    return (
        <div className="flex items-center justify-between gap-3">
            <div className="flex flex-wrap gap-1.5">
                {types.map((t) => (
                    <button
                        key={t.kind}
                        onClick={() => setType(t.kind)}
                        className={`rounded-full px-3 py-1 text-xs font-bold transition ${
                            type === t.kind ? "bg-maintext text-canvas" : "bg-elevated text-subtext hover:text-maintext"
                        }`}
                    >
                        {t.title}
                    </button>
                ))}
            </div>
            <div className="flex shrink-0 items-center gap-1 rounded-full bg-elevated p-1">
                {["list", "grid"].map((d) => (
                    <button
                        key={d}
                        onClick={() => setDisplay(d)}
                        title={d === "list" ? "List" : "Tiles"}
                        className={`flex h-7 w-7 items-center justify-center rounded-full transition ${
                            display === d ? "bg-surface text-maintext" : "text-subtext hover:text-maintext"
                        }`}
                    >
                        <Icon name={d} className="h-4 w-4" />
                    </button>
                ))}
            </div>
        </div>
    );
}

function Section({ section, display }) {
    const isTrack = section.kind === "song" || section.kind === "video";
    return (
        <div className="flex flex-col gap-3">
            <h3 className="text-lg font-bold text-maintext">{section.title}</h3>
            {display === "grid" ? (
                <Stagger className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
                    {section.items.map((item, i) => (
                        <StaggerItem key={item.videoId || item.browseId || i}>
                            <Tile item={item} />
                        </StaggerItem>
                    ))}
                </Stagger>
            ) : (
                <Stagger className="flex flex-col gap-1">
                    {section.items.map((item, i) => (
                        <StaggerItem key={item.videoId || item.browseId || i}>
                            {isTrack ? <TrackRow track={item} /> : <EntityRow item={item} />}
                        </StaggerItem>
                    ))}
                </Stagger>
            )}
        </div>
    );
}

export default function SearchResults() {
    const { search, selected } = useNifty();
    const { query, sections, loading } = search;
    const [type, setType] = useState("all");
    const [display, setDisplay] = useState("list");

    const visible = type === "all" ? sections : sections.filter((s) => s.kind === type);

    return (
        <div className="flex flex-col gap-5">
            <h2 className="text-2xl font-bold">
                {query ? <>Results for <span className="text-accent">{query}</span></> : "Search"}
            </h2>

            {!selected && (
                <p className="rounded-lg bg-elevated/60 px-4 py-3 text-xs text-subtext">
                    Select a server in the top bar first — that&apos;s where tracks will be queued.
                </p>
            )}

            {loading ? (
                <div className="flex flex-col gap-2">
                    {Array.from({ length: 8 }).map((_, i) => (
                        <div key={i} className="flex animate-pulse items-center gap-3 rounded-md p-2">
                            <div className="h-11 w-11 rounded bg-elevated" />
                            <div className="flex flex-1 flex-col gap-1.5">
                                <div className="h-3 w-1/3 rounded bg-elevated" />
                                <div className="h-2.5 w-1/4 rounded bg-elevated" />
                            </div>
                        </div>
                    ))}
                </div>
            ) : sections.length === 0 ? (
                <p className="text-sm text-subtext">{query ? "No results found." : "Type something above to search."}</p>
            ) : (
                <>
                    <FilterBar sections={sections} type={type} setType={setType} display={display} setDisplay={setDisplay} />
                    {visible.map((section) => (
                        <Section key={section.kind} section={section} display={display} />
                    ))}
                </>
            )}
        </div>
    );
}
