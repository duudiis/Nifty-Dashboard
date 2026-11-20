import { useMemo, useState } from "react";

import { useNifty } from "../../context/NiftyContext.js";
import { rankSearchResults, searchResultKey } from "../../lib/searchResults.js";
import Icon from "../Icon.js";
import { GridSkeleton, TrackListSkeleton } from "../Loader.js";
import { LoadingSwap } from "../motion/index.js";
import Tile from "../browse/Tile.js";
import TrackRow from "../browse/TrackRow.js";
import EntityRow from "../browse/EntityRow.js";
import { MUSIC_GRID_CLASS } from "../skeletonLayout.js";

const LABELS = { song: "Songs", video: "Videos", album: "Albums", artist: "Artists", playlist: "Playlists" };
const KINDS = { song: "Song", video: "Video", album: "Album", artist: "Artist", playlist: "Playlist" };
const PAGE_SIZE = 40;

function FilterBar({ kinds, type, setType, display, setDisplay }) {
    return (
        <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2" aria-label="Result types">
                {["all", ...kinds].map((kind) => (
                    <button key={kind} onClick={() => setType(kind)} aria-pressed={type === kind}
                        className={`min-h-9 rounded-full px-4 text-xs font-bold transition-colors ${type === kind ? "bg-maintext text-canvas" : "bg-elevated text-subtext hover:text-maintext"}`}>
                        {kind === "all" ? "All" : LABELS[kind] || kind}
                    </button>
                ))}
            </div>
            <div className="flex items-center gap-1 rounded-full bg-elevated/60 p-1" aria-label="Results display">
                {["list", "grid"].map((mode) => (
                    <button key={mode} onClick={() => setDisplay(mode)} aria-pressed={display === mode}
                        title={mode === "list" ? "List view" : "Grid view"} aria-label={mode === "list" ? "List view" : "Grid view"}
                        className={`flex h-8 w-8 items-center justify-center rounded-full transition-colors ${display === mode ? "bg-surface text-maintext" : "text-subtext hover:text-maintext"}`}>
                        <Icon name={mode} className="h-4 w-4" />
                    </button>
                ))}
            </div>
        </div>
    );
}

export default function SearchResults() {
    const { search, selected } = useNifty();
    const { query, sections = [], loading } = search;
    // Scope filters/pagination to the submitted query without an effect that
    // could briefly hide a new query behind the previous query's filter.
    const [selection, setSelection] = useState({ query: "", type: "all", limit: PAGE_SIZE });
    const [display, setDisplay] = useState("list");
    const results = useMemo(() => rankSearchResults(query, sections), [query, sections]);
    const kinds = Object.keys(LABELS);
    const type = selection.query === query && kinds.includes(selection.type) ? selection.type : "all";
    const limit = selection.query === query ? selection.limit : PAGE_SIZE;
    const filtered = type === "all" ? results : results.filter((item) => item.kind === type);
    const visible = filtered.slice(0, limit);
    const setType = (next) => setSelection({ query, type: next, limit: PAGE_SIZE });

    return (
        <div className="flex min-w-0 flex-col gap-6">
            <div className="flex flex-col gap-2">
                <h1 className="text-2xl font-extrabold tracking-tight text-maintext sm:text-3xl">
                    {query ? <>Results for <span className="break-words">“{query}”</span></> : "Find your next favorite"}
                </h1>
                {!selected && <p className="text-xs text-subtext">Choose a server in the top bar to add songs to its queue.</p>}
            </div>

            {(loading || results.length > 0) && <FilterBar kinds={kinds} type={type} setType={setType} display={display} setDisplay={setDisplay} />}
            {(loading || results.length > 0) && (
                <div className="flex h-4 items-center justify-between text-xs text-subtext">
                    <span>{type === "all" ? "Best matches" : LABELS[type]}</span>
                    <span>{loading ? "Searching…" : `${filtered.length} results`}</span>
                </div>
            )}
            <LoadingSwap loading={loading} contentClassName="flex min-w-0 flex-col gap-6" fallback={
                display === "grid" ? <GridSkeleton label="Loading search results" />
                    : <TrackListSkeleton rows={8} rowHeight={60} rowGap={4} fill label="Loading search results" />
            }>
            {!results.length ? (
                <div className="flex min-h-[260px] flex-col items-center justify-center gap-3 text-center">
                    <Icon name="search" className="h-9 w-9 text-subtext" />
                    <p className="text-lg font-bold text-maintext">{query ? "No matches found" : "A song, an artist, a whole new mood"}</p>
                    <p className="max-w-sm text-sm text-subtext">{query ? "Try a different name or check the spelling." : "Search above to discover songs, artists, albums and playlists."}</p>
                </div>
            ) : (
                <>
                    <div key={`${query}:${type}:${display}`} className={display === "grid" ? MUSIC_GRID_CLASS : "flex flex-col gap-1"}>
                        {visible.map((item) => (
                            display === "grid" ? <Tile key={searchResultKey(item)} item={item} /> : (
                                <div key={searchResultKey(item)} className="flex min-w-0 items-center gap-2">
                                    <div className="min-w-0 flex-1">
                                        {item.kind === "song" || item.kind === "video" ? <TrackRow track={item} /> : <EntityRow item={item} />}
                                    </div>
                                    <span className="hidden w-16 shrink-0 pr-2 text-right text-[11px] text-subtext sm:block">{KINDS[item.kind]}</span>
                                </div>
                            )
                        ))}
                    </div>
                    {visible.length < filtered.length && (
                        <button onClick={() => setSelection({ query, type, limit: limit + PAGE_SIZE })} className="mx-auto min-h-10 rounded-full border border-border px-6 text-sm font-bold text-maintext transition hover:bg-elevated">Show more results</button>
                    )}
                </>
            )}
            </LoadingSwap>
        </div>
    );
}
