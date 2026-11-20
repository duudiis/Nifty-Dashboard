import { memo, useEffect, useRef, useState } from "react";

import { useNifty } from "../../context/NiftyContext.js";
import { artworkOrFallback } from "../../lib/format.js";
import { useContextMenu } from "../menu/ContextMenu.js";
import { useTrackMenu } from "../menu/trackMenu.js";
import { Reorder, EASE } from "../motion/index.js";
import QueueGlyph from "./QueueGlyph.js";
import { TRACK_ACTION_CLASS, TRACK_NUMBER_CLASS, TrackRowContent, trackRowClassName } from "./trackTable.js";
import Icon from "../Icon.js";

// Collection rows have an exact shared pitch for virtualization; compact rows
// elsewhere keep their 60px pitch. Playback, likes and menus stay shared.
function TrackRow({ track, index, badge = null, meta = null, collection = false, dragValue = null, dragEnabled = true, onDragStart, onDragEnd }) {
    const { play, selected, isLiked, toggleLike } = useNifty();
    const trackMenu = useTrackMenu();
    const [done, setDone] = useState(false);
    const [dragging, setDragging] = useState(false);
    const draggedRef = useRef(false);
    const resetTimer = useRef(null);
    useEffect(() => () => clearTimeout(resetTimer.current), []);

    const liked = isLiked(track);
    const reorderItem = dragValue != null;
    const draggable = reorderItem && dragEnabled;
    const playable = !!(track.playQuery || track.url);
    const queue = () => {
        if (draggedRef.current || !selected || !playable || done) return;
        play(track.playQuery || track.url, "queue", track.title);
        setDone(true);
        clearTimeout(resetTimer.current);
        resetTimer.current = setTimeout(() => setDone(false), 1000);
    };
    const { onContextMenu, active } = useContextMenu(() => trackMenu(track, { source: "search", onAdd: queue }));
    const base = `${collection && !active && !dragging ? "bg-surface" : ""} ${trackRowClassName({ collection, active: active || dragging })} ${selected && playable ? "cursor-pointer" : ""}`;

    const inner = (
        <TrackRowContent
            title={track.title}
            artist={track.artist}
            artistBrowseId={track.artistBrowseId}
            collection={collection}
            leading={(badge != null || index != null) && (
                <span className={`relative shrink-0 items-center justify-center text-center text-xs tabular-nums text-subtext ${collection ? TRACK_NUMBER_CLASS : "hidden w-7 sm:flex"}`}>
                    <span className={draggable ? "group-hover:opacity-0" : ""}>{badge ?? index}</span>
                    {draggable && <Icon name="grip" className="absolute h-4 w-4 opacity-0 group-hover:opacity-70" />}
                </span>
            )}
            artwork={<button
                type="button"
                disabled={!selected || !playable}
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => { event.stopPropagation(); queue(); }}
                aria-label={done ? `${track.title} added to queue` : `Add ${track.title} to queue`}
                className={`relative shrink-0 overflow-hidden rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${collection ? "h-10 w-10" : "h-11 w-11"}`}
            >
                <img
                    src={artworkOrFallback(track.artwork)}
                    onError={(event) => (event.currentTarget.src = artworkOrFallback(null))}
                    className="h-full w-full object-cover"
                    alt=""
                    loading="lazy"
                />
                <span className={`absolute inset-0 flex items-center justify-center bg-black/55 text-white transition-opacity ${done ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100"}`}>
                    <QueueGlyph done={done} className="h-5 w-5" />
                </span>
            </button>}
            like={<button
                type="button"
                onPointerDown={(event) => event.stopPropagation()}
                onClick={(event) => { event.stopPropagation(); toggleLike(track); }}
                title={liked ? "Remove from Liked songs" : "Save to Liked songs"}
                aria-label={liked ? `Remove ${track.title} from Liked songs` : `Save ${track.title} to Liked songs`}
                className={`${TRACK_ACTION_CLASS} ${liked ? "text-accent" : "text-subtext hover:text-maintext"}`}
            >
                <Icon name={liked ? "heart-filled" : "heart"} className="h-4 w-4" />
            </button>}
            duration={<span className={`${meta != null ? "shrink-0" : "w-12 shrink-0"} text-right text-xs tabular-nums text-subtext`}>
                {meta ?? track.duration ?? "—"}
            </span>}
            menu={collection && (
                <button
                    type="button"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => { event.stopPropagation(); onContextMenu(event); }}
                    aria-label={`More options for ${track.title}`}
                    className={`${TRACK_ACTION_CLASS} text-subtext hover:text-maintext`}
                >
                    <Icon name="more" className="h-4 w-4" />
                </button>
            )}
        />
    );

    if (!reorderItem) return <div onClick={queue} onContextMenu={onContextMenu} className={base}>{inner}</div>;

    return (
        <Reorder.Item
            as="div"
            value={dragValue}
            drag={draggable ? "y" : false}
            layout={draggable ? "position" : false}
            initial={false}
            transition={{ layout: { duration: 0.24, ease: EASE } }}
            onDragStart={() => { draggedRef.current = true; setDragging(true); onDragStart?.(); }}
            onDragEnd={() => {
                setDragging(false);
                onDragEnd?.();
                setTimeout(() => { draggedRef.current = false; }, 0);
            }}
            whileDrag={{ boxShadow: "0 12px 28px rgb(0 0 0 / 0.45)", cursor: "grabbing" }}
            onClick={queue}
            onContextMenu={onContextMenu}
            className={`select-none ${base}`}
        >
            {inner}
        </Reorder.Item>
    );
}

export default memo(TrackRow);
