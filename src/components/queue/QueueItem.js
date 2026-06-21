import { useNifty } from "../../context/NiftyContext.js";
import { msToClock, artworkOrFallback } from "../../lib/format.js";
import Icon from "../Icon.js";
import AddedBy from "../AddedBy.js";
import { useContextMenu } from "../menu/ContextMenu.js";
import { useTrackMenu } from "../menu/trackMenu.js";

export default function QueueItem({ track, index, isCurrent, dense, innerRef }) {
    const { control, player } = useNifty();
    const trackMenu = useTrackMenu();
    const { onContextMenu, active } = useContextMenu(() => trackMenu(track, { source: "queue" }));

    const playing = isCurrent && player?.playing;

    // The current track toggles pause/resume in place; others jump to play.
    const activate = () =>
        isCurrent ? control("togglePause") : control("jump", { trackId: track.track_id });

    const playPauseTitle = playing ? "Pause" : isCurrent ? "Resume" : "Play";

    return (
        <div
            ref={innerRef}
            onDoubleClick={activate}
            onContextMenu={onContextMenu}
            className={`group flex w-full items-center gap-3 rounded-md px-2 py-1.5 transition hover:bg-elevated ${dense ? "scroll-mt-20" : ""} ${active ? "bg-elevated" : ""}`}
        >
            {/* main list keeps a number / play-pause column; the dense sidebar
                drops it and puts the control over the cover instead */}
            {!dense && (
                <div className="flex w-6 shrink-0 items-center justify-center">
                    <span className={`text-xs ${isCurrent ? "text-accent" : "text-subtext"} group-hover:hidden`}>
                        {isCurrent ? "♪" : index + 1}
                    </span>
                    <button onClick={activate} className="hidden text-maintext group-hover:block" title={playPauseTitle}>
                        <Icon name={playing ? "pause" : "play"} className="h-4 w-4" />
                    </button>
                </div>
            )}

            {/* artwork (with an overlaid play/pause control in the dense sidebar) */}
            <div className={`relative shrink-0 ${dense ? "h-9 w-9" : "h-10 w-10"}`}>
                <img
                    src={artworkOrFallback(track.artwork)}
                    onError={(e) => (e.currentTarget.src = artworkOrFallback(null))}
                    className="h-full w-full rounded object-cover"
                    alt=""
                />
                {dense && (
                    <button
                        onClick={activate}
                        title={playPauseTitle}
                        className="absolute inset-0 flex items-center justify-center rounded bg-black/50 text-white opacity-0 transition group-hover:opacity-100"
                    >
                        <Icon name={playing ? "pause" : "play"} className="h-4 w-4" />
                    </button>
                )}
            </div>

            {/* title / artist */}
            <div className="flex min-w-0 flex-1 flex-col leading-tight">
                <span className={`truncate text-[13px] ${isCurrent ? "text-accent" : "text-maintext"}`}>{track.title}</span>
                <span className="truncate text-[11px] text-subtext">{track.artist}</span>
            </div>

            {/* added by (avatar + name) */}
            {!dense && (
                <AddedBy track={track} size={18} className="hidden w-28 shrink-0 text-[11px] text-subtext lg:flex" />
            )}

            {/* duration */}
            <span className="w-12 shrink-0 text-right text-[11px] text-subtext">{msToClock(track.duration)}</span>
        </div>
    );
}
