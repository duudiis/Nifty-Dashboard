import { useNifty } from "../../context/NiftyContext.js";
import { artworkOrFallback } from "../../lib/format.js";

export default function SearchResults() {
    const { search, play, selected } = useNifty();
    const { query, results, loading } = search;

    return (
        <div className="flex flex-col gap-3">
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
            ) : results.length === 0 ? (
                <p className="text-sm text-subtext">{query ? "No results found." : "Type something above to search."}</p>
            ) : (
                <div className="flex flex-col gap-1">
                    {results.map((result, i) => (
                        <div
                            key={`${result.url}-${i}`}
                            onDoubleClick={() => selected && play(result.url)}
                            className="group flex items-center gap-3 rounded-md p-2 transition hover:bg-elevated"
                        >
                            <div className="relative h-11 w-11 shrink-0">
                                <img
                                    src={artworkOrFallback(result.artwork)}
                                    onError={(e) => (e.currentTarget.src = artworkOrFallback(null))}
                                    className="h-11 w-11 rounded object-cover"
                                    alt=""
                                />
                                <button
                                    disabled={!selected}
                                    onClick={() => play(result.url)}
                                    className="absolute inset-0 flex items-center justify-center rounded bg-black/50 opacity-0 transition group-hover:opacity-100 disabled:cursor-not-allowed"
                                    title={selected ? "Add to queue" : "Select a server first"}
                                >
                                    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-white">
                                        <path d="M8 5v14l11-7L8 5Z" />
                                    </svg>
                                </button>
                            </div>

                            <div className="flex min-w-0 flex-1 flex-col leading-tight">
                                <span className="truncate text-[13px] text-maintext">{result.title}</span>
                                <span className="truncate text-[11px] text-subtext">{result.artist}</span>
                            </div>

                            <span className="shrink-0 rounded-full bg-elevated px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-subtext">
                                {result.type}
                            </span>
                            <span className="w-12 shrink-0 text-right text-[11px] text-subtext">{result.duration}</span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
