import { forwardRef, useRef, useState } from "react";
import { useReducedMotion } from "framer-motion";

import { useNifty } from "../../context/NiftyContext.js";
import { msToClock, artworkOrFallback, addedByOf } from "../../lib/format.js";
import Icon from "../Icon.js";
import AddedBy from "../AddedBy.js";
import { TRACK_ACTION_CLASS, TRACK_MENU_COLUMN_CLASS, TRACK_META_CLASS, TRACK_NUMBER_CLASS, TRACK_QUIET_ACTION_CLASS, TrackRowContent, trackRowClassName } from "../browse/trackTable.js";
import Equalizer from "../Equalizer.js";
import AlbumCell from "./AlbumCell.js";
import { Reorder, EASE, motion } from "../motion/index.js";
import { useContextMenu } from "../menu/ContextMenu.js";
import { useTrackMenu } from "../menu/trackMenu.js";

// All queue entries, including recommendations, share the collection row.
// Stable values keep a drag alive as it crosses the autoplay boundary.
const QueueItem = forwardRef(function QueueItem({ track, value = track, index, isCurrent, raised = false, dense, autoplay = false, reveal = true, onDragStart, onDragEnd }, ref) {
    const { control, player, jump, removeTrack, isLiked, toggleLike, autoplayPlay, autoplayRemove } = useNifty();
    const reduceMotion = useReducedMotion();
    // A loading result must keep its first-paint policy for this row's entire
    // lifetime, including the next server update or playback cursor change.
    const revealOnMount = useRef(reveal).current;
    const trackMenu = useTrackMenu();
    const { onContextMenu, active } = useContextMenu(() => {
        const addedBy = addedByOf(track).name;
        return [
            ...trackMenu(track, { source: autoplay ? "autoplay" : "queue" }),
            { separator: true },
            { label: <AlbumCell track={track} />, icon: "music", disabled: true },
            (autoplay || addedBy) && { label: autoplay ? "Recommended by Autoplay" : `Added by ${addedBy}`, icon: autoplay ? "sparkles" : "user", disabled: true }
        ].filter(Boolean);
    });
    const playing = isCurrent && player?.playing;
    const [dragging, setDragging] = useState(false);
    const draggedRef = useRef(false);

    const handleDragStart = (event) => {
        draggedRef.current = true;
        setDragging(true);
        onDragStart?.(value, event);
    };
    const handleDragEnd = () => {
        setDragging(false);
        onDragEnd?.(value);
        setTimeout(() => { draggedRef.current = false; }, 0);
    };
    const activate = (event) => {
        event?.stopPropagation?.();
        if (draggedRef.current) return;
        if (autoplay) autoplayPlay(track.auto_id);
        else if (isCurrent) control("togglePause");
        else jump(track.track_id);
    };
    const remove = (event) => {
        event.stopPropagation();
        if (autoplay) autoplayRemove(track.auto_id);
        else removeTrack(track.track_id);
    };
    const liked = isLiked(track);
    const like = (event) => {
        event.stopPropagation();
        toggleLike(track);
    };
    const playPauseTitle = playing ? "Pause" : isCurrent ? "Resume" : "Play";

    return (
        <Reorder.Item
            ref={ref}
            as="div"
            value={value}
            data-queue-key={typeof value === "string" ? value : undefined}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
            initial={false}
            layout="position"
            transition={{ layout: { duration: reduceMotion ? 0 : 0.24, ease: EASE } }}
            whileDrag={{ boxShadow: "0 12px 28px rgb(0 0 0 / 0.45)", cursor: "grabbing" }}
            onClick={activate}
            onContextMenu={onContextMenu}
            className={`relative w-full shrink-0 cursor-pointer select-none ${dense ? "h-12" : "h-14"} ${raised ? "!z-20" : ""}`}
        >
            {/* Layout projection owns the outer transform. Keeping reveals on
                this inner row prevents it from resetting opacity at the end
                of a reorder animation or immediately before an exit. */}
            <motion.div
                data-queue-row-content
                data-active={active || dragging || undefined}
                initial={revealOnMount && !reduceMotion ? { opacity: 0, x: 8 } : false}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: reduceMotion ? 0 : -8, transition: { duration: reduceMotion ? 0 : 0.16, ease: EASE } }}
                transition={{ opacity: { duration: reduceMotion ? 0 : 0.18, ease: EASE }, x: { duration: reduceMotion ? 0 : 0.24, ease: EASE } }}
                className={`${active || dragging ? "" : "bg-surface"} ${trackRowClassName({ dense, active: active || dragging })}`}
            >
            <TrackRowContent
                title={track.title}
                artist={track.artist}
                artistBrowseId={track.artistBrowseId}
                current={isCurrent}
                collection={!dense}
                leading={!dense && (
                    <span className={`relative ${TRACK_NUMBER_CLASS} ${isCurrent ? "text-accent" : "text-subtext"}`}>
                        <span className="flex items-center justify-center group-hover:opacity-0">
                            {isCurrent ? <Equalizer playing={playing} className="h-3.5 w-3.5" />
                                : autoplay ? <Icon name="sparkles" className="h-3.5 w-3.5" />
                                    : index + 1}
                        </span>
                        <Icon name="grip" className="absolute h-4 w-4 text-subtext opacity-0 group-hover:opacity-70" />
                    </span>
                )}
                artwork={<button
                    type="button"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={activate}
                    title={playPauseTitle}
                    aria-label={`${playPauseTitle} ${track.title}`}
                    className={`relative shrink-0 overflow-hidden rounded focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${dense ? "h-9 w-9" : "h-10 w-10"}`}
                >
                    <img src={artworkOrFallback(track.artwork)} onError={(event) => (event.currentTarget.src = artworkOrFallback(null))} className="h-full w-full object-cover" alt="" />
                    <span className="absolute inset-0 flex items-center justify-center bg-black/55 text-white opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100">
                        <Icon name={playing ? "pause" : "play"} className={dense ? "h-4 w-4" : "h-5 w-5"} />
                    </span>
                </button>}
                metadata={!dense && (autoplay
                    ? <span className={`${TRACK_META_CLASS} gap-1.5`}><Icon name="sparkles" className="h-4 w-4" />Autoplay</span>
                    : <AddedBy track={track} size={20} className={TRACK_META_CLASS} />)}
                like={dense ? (
                    <div className="relative flex h-8 w-5 shrink-0 items-center justify-center">
                        <span className={liked ? "invisible" : "group-hover:invisible group-focus-within:invisible"} title={autoplay ? "Recommended by Autoplay" : addedByOf(track).name || undefined}>
                            {autoplay ? <Icon name="sparkles" className="h-4 w-4 text-subtext/70" /> : <AddedBy track={track} size={16} showName={false} />}
                        </span>
                        <button
                            type="button"
                            onPointerDown={(event) => event.stopPropagation()}
                            onClick={like}
                            title={liked ? "Remove from Liked songs" : "Save to Liked songs"}
                            className={`absolute inset-0 flex items-center justify-center transition-colors ${liked ? "text-accent" : "text-subtext opacity-0 hover:text-maintext group-hover:opacity-100 group-focus-within:opacity-100"}`}
                        >
                            <Icon name={liked ? "heart-filled" : "heart"} className="h-4 w-4" />
                        </button>
                    </div>
                ) : (
                    <button
                        type="button"
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={like}
                        title={liked ? "Remove from Liked songs" : "Save to Liked songs"}
                        aria-label={liked ? `Remove ${track.title} from Liked songs` : `Save ${track.title} to Liked songs`}
                        className={`${TRACK_ACTION_CLASS} ${liked ? "text-accent" : `text-subtext hover:text-maintext ${TRACK_QUIET_ACTION_CLASS}`}`}
                    >
                        <Icon name={liked ? "heart-filled" : "heart"} className="h-4 w-4" />
                    </button>
                )}
                duration={<div className={`relative flex w-12 shrink-0 items-center ${dense ? "justify-center" : "justify-end"}`}>
                    <span className={`tabular-nums text-subtext ${dense ? "text-[11px] group-hover:invisible group-focus-within:invisible" : "text-xs"}`}>{msToClock(track.duration)}</span>
                    {dense && <button
                        type="button"
                        onPointerDown={(event) => event.stopPropagation()}
                        onClick={remove}
                        title={autoplay ? "Remove suggestion" : "Remove"}
                        className="absolute inset-0 flex items-center justify-center text-subtext opacity-0 transition-colors hover:text-red-400 group-hover:opacity-100 group-focus-within:opacity-100"
                    ><Icon name="trash" className="h-4 w-4" /></button>}
                </div>}
                menu={!dense && <button
                    type="button"
                    onPointerDown={(event) => event.stopPropagation()}
                    onClick={(event) => { event.stopPropagation(); onContextMenu(event); }}
                    aria-label={`More options for ${track.title}`}
                    className={`${TRACK_ACTION_CLASS} ${TRACK_MENU_COLUMN_CLASS} text-subtext hover:text-maintext ${TRACK_QUIET_ACTION_CLASS}`}
                ><Icon name="more" className="h-4 w-4" /></button>}
            />
            </motion.div>
        </Reorder.Item>
    );
});

export default QueueItem;
