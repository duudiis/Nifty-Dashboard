import { useNifty } from "../../context/NiftyContext.js";
import { msToClock, artworkOrFallback } from "../../lib/format.js";
import Icon from "../Icon.js";
import AddedBy from "../AddedBy.js";
import Equalizer from "../Equalizer.js";
import AlbumCell from "./AlbumCell.js";
import { useContextMenu } from "../menu/ContextMenu.js";
import { useTrackMenu } from "../menu/trackMenu.js";
import { Reorder } from "../motion/index.js";

// A single draggable queue row. Reorder.Item already handles the smooth drag +
// neighbours-shift animation; we don't add any extra layout/exit motion (that
// was what made it janky).
export default function QueueItem({ track, number, isCurrent, dense, onDragStart, onDragEnd }) {
    const { control, player, removeTrack } = useNifty();
    const trackMenu = useTrackMenu();
    const { onContextMenu, active } = useContextMenu(() => trackMenu(track, { source: "queue" }));

    const playing = isCurrent && player?.playing;

    const activate = () =>
        isCurrent ? control("togglePause") : control("jump", { trackId: track.track_id });
    const playPauseTitle = playing ? "Pause" : isCurrent ? "Resume" : "Play";

    const remove = (e) => {
        e.stopPropagation();
        removeTrack(track.track_id);
    };

    return (
        <Reorder.Item
            as="div"
            value={track}
            onDragStart={onDragStart}
            onDragEnd={onDragEnd}
            onDoubleClick={activate}
            onContextMenu={onContextMenu}
            className={`group flex w-full cursor-grab items-center gap-3 rounded-md px-2 py-1.5 transition hover:bg-elevated active:cursor-grabbing ${active ? "bg-elevated" : ""}`}
        >
            {!dense && (
                <div className="flex w-6 shrink-0 items-center justify-center">
                    <span className={`flex items-center justify-center text-xs ${isCurrent ? "text-accent" : "text-subtext"} group-hover:hidden`}>
                        {isCurrent ? <Equalizer playing={playing} className="h-3.5 w-3.5" /> : number}
                    </span>
                    <button onClick={activate} className="hidden text-maintext group-hover:block" title={playPauseTitle}>
                        <Icon name={playing ? "pause" : "play"} className="h-4 w-4" />
                    </button>
                </div>
            )}

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

            <div className="flex min-w-0 flex-1 flex-col leading-tight">
                <span className={`truncate text-[13px] ${isCurrent ? "text-accent" : "text-maintext"}`}>{track.title}</span>
                <span className="truncate text-[11px] text-subtext">{track.artist}</span>
            </div>

            {!dense && (
                <AlbumCell track={track} className="hidden w-64 shrink-0 truncate text-[11px] text-subtext xl:block" />
            )}

            {!dense ? (
                <AddedBy track={track} size={18} className="hidden w-28 shrink-0 text-[11px] text-subtext lg:flex" />
            ) : (
                <AddedBy track={track} size={18} showName={false} className="shrink-0" />
            )}

            {/* duration → trash on hover */}
            <div className="relative flex w-12 shrink-0 items-center justify-center">
                <span className="text-[11px] text-subtext transition group-hover:opacity-0">{msToClock(track.duration)}</span>
                <button
                    onClick={remove}
                    title="Remove from queue"
                    className="absolute inset-0 flex items-center justify-center text-subtext opacity-0 transition hover:text-maintext group-hover:opacity-100"
                >
                    <Icon name="trash" className="h-4 w-4" />
                </button>
            </div>
        </Reorder.Item>
    );
}
