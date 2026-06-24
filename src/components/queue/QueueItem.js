import { useNifty } from "../../context/NiftyContext.js";
import { msToClock, artworkOrFallback } from "../../lib/format.js";
import Icon from "../Icon.js";
import AddedBy from "../AddedBy.js";
import Equalizer from "../Equalizer.js";
import AlbumCell from "./AlbumCell.js";
import { Reorder } from "../motion/index.js";
import { useContextMenu } from "../menu/ContextMenu.js";
import { useTrackMenu } from "../menu/trackMenu.js";

export default function QueueItem({ track, index, isCurrent, dense, onDragStart, onDragEnd }) {
    const { control, player, removeTrack } = useNifty();
    const trackMenu = useTrackMenu();
    const { onContextMenu, active } = useContextMenu(() => trackMenu(track, { source: "queue" }));

    const playing = isCurrent && player?.playing;

    // Quick click anywhere plays/pauses; press and drag reorders (framer
    // suppresses the click when a real drag happened). stopPropagation on the
    // dedicated controls avoids a double-toggle.
    const activate = (e) => {
        e?.stopPropagation?.();
        if (isCurrent) control("togglePause");
        else control("jump", { trackId: track.track_id });
    };

    const playPauseTitle = playing ? "Pause" : isCurrent ? "Resume" : "Play";

    const remove = (e) => {
        e.stopPropagation();
        removeTrack(track.track_id);
    };

    return (
        <Reorder.Item
            as="div"
            value={track}
            onDragStart={() => onDragStart?.(track)}
            onDragEnd={() => onDragEnd?.(track)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            whileDrag={{ boxShadow: "0 12px 28px rgb(0 0 0 / 0.45)", cursor: "grabbing" }}
            onClick={activate}
            onContextMenu={onContextMenu}
            // transition-colors only — never `transition` (all), which would
            // animate the transform framer uses to track the cursor and make
            // dragging drift/stutter.
            className={`group relative flex w-full cursor-pointer select-none items-center gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-elevated ${active ? "bg-elevated" : ""}`}
        >
            {/* main list keeps a number / play-pause column; the dense sidebar
                drops it and puts the control over the cover instead */}
            {!dense && (
                <div className="flex w-6 shrink-0 items-center justify-center">
                    <span className={`flex items-center justify-center text-xs transition-colors duration-300 ${isCurrent ? "text-accent" : "text-subtext"} group-hover:hidden`}>
                        {isCurrent ? <Equalizer playing={playing} className="h-3.5 w-3.5" /> : index + 1}
                    </span>
                    <button onClick={activate} className="hidden text-maintext group-hover:block" title={playPauseTitle}>
                        <Icon name={playing ? "pause" : "play"} className="h-4 w-4" />
                    </button>
                </div>
            )}

            {/* artwork (with an overlaid play/pause control, and a now-playing
                equalizer in the dense sidebar) */}
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
                        className="absolute inset-0 flex items-center justify-center rounded bg-black/50 text-white opacity-0 transition-opacity group-hover:opacity-100"
                    >
                        <Icon name={playing ? "pause" : "play"} className="h-4 w-4" />
                    </button>
                )}
            </div>

            {/* title / artist */}
            <div className="flex min-w-0 flex-1 flex-col leading-tight">
                <span className={`truncate text-[13px] transition-colors duration-300 ${isCurrent ? "text-accent" : "text-maintext"}`}>{track.title}</span>
                <span className="truncate text-[11px] text-subtext">{track.artist}</span>
            </div>

            {/* album */}
            {!dense && (
                <AlbumCell track={track} className="hidden w-64 shrink-0 truncate text-[11px] text-subtext xl:block" />
            )}

            {/* added by — name + avatar on the main page, avatar only in the
                dense sidebar (sits just left of the duration) */}
            {!dense && (
                <AddedBy track={track} size={18} className="hidden w-28 shrink-0 text-[11px] text-subtext lg:flex" />
            )}
            {dense && <AddedBy track={track} size={16} showName={false} className="-mr-1.5 shrink-0" />}

            {/* duration, swapping to a remove (trash) button on hover */}
            <div className="flex w-12 shrink-0 items-center justify-center">
                <span className="text-[11px] text-subtext group-hover:hidden">{msToClock(track.duration)}</span>
                <button
                    onClick={remove}
                    title="Remove"
                    className="hidden text-subtext transition-colors hover:text-red-400 group-hover:block"
                >
                    <Icon name="trash" className="h-4 w-4" />
                </button>
            </div>
        </Reorder.Item>
    );
}
