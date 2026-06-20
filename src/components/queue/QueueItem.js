import { useNifty } from "../../context/NiftyContext.js";
import { msToClock, artworkOrFallback } from "../../lib/format.js";
import Icon from "../Icon.js";
import { useContextMenu } from "../menu/ContextMenu.js";
import { useTrackMenu } from "../menu/trackMenu.js";

export default function QueueItem({ track, index, isCurrent, dense }) {
    const { control } = useNifty();
    const trackMenu = useTrackMenu();
    const onContextMenu = useContextMenu(() => trackMenu(track, { source: "queue" }));

    return (
        <div
            onDoubleClick={() => control("jump", { trackId: track.track_id })}
            onContextMenu={onContextMenu}
            className="group flex w-full items-center gap-3 rounded-md px-2 py-1.5 transition hover:bg-elevated"
        >
            {/* index / play */}
            <div className="flex w-6 shrink-0 items-center justify-center">
                <span className={`text-xs ${isCurrent ? "text-accent" : "text-subtext"} group-hover:hidden`}>
                    {isCurrent ? "♪" : index + 1}
                </span>
                <button
                    onClick={() => control("jump", { trackId: track.track_id })}
                    className="hidden text-maintext group-hover:block"
                    title="Play"
                >
                    <Icon name="play" className="h-4 w-4" />
                </button>
            </div>

            {/* artwork — shown everywhere, including the dense right-sidebar queue */}
            <img
                src={artworkOrFallback(track.artwork)}
                onError={(e) => (e.currentTarget.src = artworkOrFallback(null))}
                className={`${dense ? "h-9 w-9" : "h-10 w-10"} shrink-0 rounded object-cover`}
                alt=""
            />

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
        </div>
    );
}
