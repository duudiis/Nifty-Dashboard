import { useNifty } from "../../context/NiftyContext.js";
import { artworkOrFallback } from "../../lib/format.js";
import Icon from "../Icon.js";
import { useContextMenu } from "../menu/ContextMenu.js";
import { useTrackMenu } from "../menu/trackMenu.js";

// A playable song/video row (search results, album/playlist/artist track lists).
// Click the cover to queue; right-click for the full play/queue menu.
export default function TrackRow({ track, index }) {
    const { play, selected } = useNifty();
    const trackMenu = useTrackMenu();
    const { onContextMenu, active } = useContextMenu(() => trackMenu(track, { source: "search" }));

    return (
        <div
            onDoubleClick={() => selected && play(track.playQuery || track.url)}
            onContextMenu={onContextMenu}
            className={`group flex items-center gap-3 rounded-md p-2 transition hover:bg-elevated ${active ? "bg-elevated" : ""}`}
        >
            {index != null && (
                <span className="hidden w-5 shrink-0 text-center text-xs text-subtext sm:block">{index}</span>
            )}

            <div className="relative h-11 w-11 shrink-0">
                <img
                    src={artworkOrFallback(track.artwork)}
                    onError={(e) => (e.currentTarget.src = artworkOrFallback(null))}
                    className="h-11 w-11 rounded object-cover"
                    alt=""
                />
                <button
                    disabled={!selected}
                    onClick={() => play(track.playQuery || track.url)}
                    title={selected ? "Add to queue" : "Select a server first"}
                    className="absolute inset-0 flex items-center justify-center rounded bg-black/50 text-white opacity-0 transition group-hover:opacity-100 disabled:cursor-not-allowed"
                >
                    <Icon name="play" className="h-5 w-5" />
                </button>
            </div>

            <div className="flex min-w-0 flex-1 flex-col leading-tight">
                <span className="truncate text-[13px] text-maintext">{track.title}</span>
                <span className="truncate text-[11px] text-subtext">{track.artist}</span>
            </div>

            {track.duration && (
                <span className="w-12 shrink-0 text-center text-[11px] text-subtext">{track.duration}</span>
            )}
        </div>
    );
}
