import { memo, useRef, useState } from "react";

import { useNifty } from "../../context/NiftyContext.js";
import { artworkOrFallback } from "../../lib/format.js";
import { useContextMenu } from "../menu/ContextMenu.js";
import { useTrackMenu } from "../menu/trackMenu.js";
import QueueGlyph from "./QueueGlyph.js";
import ArtistLink from "./ArtistLink.js";
import Icon from "../Icon.js";

// A playable song/video row (search results, album/playlist/artist track lists).
// Click anywhere to add it to the queue; right-click for the full play/queue
// menu; the heart saves to Liked songs; the artist name opens their page.
//
// When `draggable` is set the row uses native HTML5 drag-and-drop for
// reordering — deliberately NOT framer's <Reorder>, whose per-item layout
// tracking is O(n) and grinds to a halt on lists of thousands. Memoized so a
// reorder only re-renders the couple of rows whose props actually change.
function TrackRow({
    track, index,
    draggable = false, dragging = false, indicator = false,
    onDragStart, onDragEnter, onDragEnd
}) {
    const { play, selected, isLiked, toggleLike } = useNifty();
    const trackMenu = useTrackMenu();
    const [done, setDone] = useState(false);
    // A drag can end with a stray click; ignore it so reordering never queues.
    const draggedRef = useRef(false);

    const liked = isLiked(track);

    const queue = () => {
        if (draggedRef.current) { draggedRef.current = false; return; }
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

    const dnd = draggable ? {
        draggable: true,
        onDragStart: (e) => {
            draggedRef.current = true;
            e.dataTransfer.effectAllowed = "move";
            // Firefox needs data set for a drag to begin.
            try { e.dataTransfer.setData("text/plain", String(index)); } catch {}
            onDragStart?.(index);
        },
        onDragEnter: () => onDragEnter?.(index),
        onDragOver: (e) => e.preventDefault(),
        onDragEnd: () => onDragEnd?.()
    } : {};

    return (
        <div
            onClick={queue}
            onContextMenu={onContextMenu}
            title={selected ? "Add to queue" : "Select a server first"}
            {...dnd}
            className={`group relative flex items-center gap-3 rounded-md p-2 transition-colors hover:bg-elevated ${selected ? "cursor-pointer" : ""} ${draggable ? "select-none" : ""} ${active ? "bg-elevated" : ""} ${dragging ? "opacity-40" : ""}`}
        >
            {indicator && <span className="pointer-events-none absolute inset-x-2 -top-0.5 h-0.5 rounded-full bg-accent" />}

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
        </div>
    );
}

export default memo(TrackRow);
