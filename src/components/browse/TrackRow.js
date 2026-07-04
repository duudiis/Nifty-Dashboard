import { memo, useRef, useState } from "react";

import { useNifty } from "../../context/NiftyContext.js";
import { artworkOrFallback } from "../../lib/format.js";
import { useContextMenu } from "../menu/ContextMenu.js";
import { useTrackMenu } from "../menu/trackMenu.js";
import { Reorder } from "../motion/index.js";
import QueueGlyph from "./QueueGlyph.js";
import ArtistLink from "./ArtistLink.js";
import Icon from "../Icon.js";

// A playable song/video row (search results, album/playlist/artist track lists).
// Click anywhere to add it to the queue; right-click for the full play/queue
// menu; the heart saves to Liked songs; the artist name opens their page.
//
// When `dragValue` is set the row is a framer <Reorder.Item> — the parent
// paginates so only ~100 rows are ever mounted, keeping the reorder snappy.
// Memoized so a reorder re-renders only the rows whose props actually change.
function TrackRow({ track, index, dragValue = null, onDragStart, onDragEnd }) {
    const { play, selected, isLiked, toggleLike } = useNifty();
    const trackMenu = useTrackMenu();
    const [done, setDone] = useState(false);
    const [dragging, setDragging] = useState(false);
    // A drag ends with a stray click; ignore it so reordering never queues.
    const draggedRef = useRef(false);

    const liked = isLiked(track);
    const draggable = dragValue != null;

    const queue = () => {
        if (draggedRef.current) return;
        if (!selected || done) return;
        play(track.playQuery || track.url, "queue", track.title);
        setDone(true);
        setTimeout(() => setDone(false), 1000);
    };

    const like = (e) => {
        e.stopPropagation();
        toggleLike(track);
    };

    const { onContextMenu, active } = useContextMenu(() => trackMenu(track, { source: "search", onAdd: queue }));

    const base = `group flex items-center gap-3 rounded-md p-2 transition-colors hover:bg-elevated ${selected ? "cursor-pointer" : ""} ${active ? "bg-elevated" : ""}`;

    const inner = (
        <>
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
                <span
                    className={`absolute inset-0 flex items-center justify-center rounded bg-black/50 text-white transition ${done ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
                >
                    <QueueGlyph done={done} className="h-5 w-5" />
                </span>
            </div>

            <div className="flex min-w-0 flex-1 items-center gap-3">
                <div className="flex min-w-0 flex-col leading-tight">
                    <span className="truncate text-[13px] text-maintext">{track.title}</span>
                    <ArtistLink name={track.artist} browseId={track.artistBrowseId} className="text-[11px] text-subtext" />
                </div>
                <button
                    onClick={like}
                    title={liked ? "Remove from Liked songs" : "Save to Liked songs"}
                    className={`shrink-0 transition-colors ${liked ? "text-accent" : "text-subtext hover:text-maintext"}`}
                >
                    <Icon name={liked ? "heart-filled" : "heart"} className="h-4 w-4" />
                </button>
            </div>

            {track.duration && (
                <span className="w-12 shrink-0 text-center text-[11px] text-subtext">{track.duration}</span>
            )}
        </>
    );

    if (!draggable) {
        return (
            <div onClick={queue} onContextMenu={onContextMenu} title={selected ? "Add to queue" : "Select a server first"} className={base}>
                {inner}
            </div>
        );
    }

    return (
        <Reorder.Item
            as="div"
            value={dragValue}
            // transition-colors only — never `transition` (all), which framer
            // would apply to the drag transform and make dragging stutter.
            onDragStart={() => { draggedRef.current = true; setDragging(true); onDragStart?.(); }}
            onDragEnd={() => {
                setDragging(false);
                onDragEnd?.();
                setTimeout(() => { draggedRef.current = false; }, 0);
            }}
            whileDrag={{ boxShadow: "0 12px 28px rgb(0 0 0 / 0.45)", cursor: "grabbing" }}
            onClick={queue}
            onContextMenu={onContextMenu}
            className={`select-none ${base} ${dragging ? "bg-elevated" : ""}`}
        >
            {inner}
        </Reorder.Item>
    );
}

export default memo(TrackRow);
