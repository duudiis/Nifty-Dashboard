import { useNifty } from "../../context/NiftyContext.js";
import { msToClock, artworkOrFallback } from "../../lib/format.js";

export default function QueueItem({ track, index, isCurrent, dense }) {
    const { control } = useNifty();

    return (
        <div
            onDoubleClick={() => control("jump", { trackId: track.track_id })}
            className="group flex w-full items-center gap-3 rounded-md px-2 py-1.5 transition hover:bg-elevated"
        >
            {/* index / play */}
            <div className="flex w-6 shrink-0 items-center justify-center">
                <span className={`text-xs ${isCurrent ? "text-accent" : "text-subtext"} group-hover:hidden`}>
                    {isCurrent ? "♪" : index + 1}
                </span>
                <button
                    onClick={() => control("jump", { trackId: track.track_id })}
                    className="hidden group-hover:block"
                    title="Play"
                >
                    <svg viewBox="0 0 24 24" className="h-4 w-4 fill-maintext">
                        <path d="M8 5v14l11-7L8 5Z" />
                    </svg>
                </button>
            </div>

            {/* artwork */}
            {!dense && (
                <img
                    src={artworkOrFallback(track.artwork)}
                    onError={(e) => (e.currentTarget.src = artworkOrFallback(null))}
                    className="h-10 w-10 shrink-0 rounded object-cover"
                    alt=""
                />
            )}

            {/* title / artist */}
            <div className="flex min-w-0 flex-1 flex-col leading-tight">
                <span className={`truncate text-[13px] ${isCurrent ? "text-accent" : "text-maintext"}`}>{track.title}</span>
                <span className="truncate text-[11px] text-subtext">{track.artist}</span>
            </div>

            {/* added by */}
            {!dense && (
                <span className="hidden w-28 shrink-0 truncate text-[11px] text-subtext lg:block">
                    {track.added_by}
                </span>
            )}

            {/* duration */}
            <span className="w-12 shrink-0 text-right text-[11px] text-subtext">{msToClock(track.duration)}</span>

            {/* remove */}
            <button
                onClick={() => control("remove", { trackId: track.track_id })}
                className="shrink-0 opacity-0 transition group-hover:opacity-100"
                title="Remove from queue"
            >
                <svg viewBox="0 0 24 24" className="h-4 w-4 fill-subtext hover:fill-maintext">
                    <path d="M6 7h12l-1 14H7L6 7Zm9-3 1 2h4v2H4V6h4l1-2h6Z" />
                </svg>
            </button>
        </div>
    );
}
