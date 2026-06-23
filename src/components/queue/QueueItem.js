import { Reorder, motion } from "framer-motion";

import { useNifty } from "../../context/NiftyContext.js";
import { msToClock, artworkOrFallback } from "../../lib/format.js";
import { EASE } from "../motion/index.js";
import Icon from "../Icon.js";
import AddedBy from "../AddedBy.js";
import Equalizer from "../Equalizer.js";
import AlbumCell from "./AlbumCell.js";
import { useContextMenu } from "../menu/ContextMenu.js";
import { useTrackMenu } from "../menu/trackMenu.js";

// Collapse-and-fade when a row leaves (removed from the queue).
const exit = { opacity: 0, height: 0, paddingTop: 0, paddingBottom: 0, marginTop: 0 };
const enter = { initial: { opacity: 0 }, animate: { opacity: 1 }, exit, transition: { duration: 0.18, ease: EASE } };

// `accent` = this row is (a copy of) the playing song → accent colour. `playing`
// = it's actually playing right now → animate the equaliser. Both are derived in
// QueueList so duplicates all light up and the cursor never guesses.
export default function QueueItem({ track, number, accent, playing, dense, innerRef, draggable, onDrop }) {
    const { control, removeTrack } = useNifty();
    const trackMenu = useTrackMenu();
    const { onContextMenu, active } = useContextMenu(() => trackMenu(track, { source: "queue" }));

    const activate = () => (accent ? control("togglePause") : control("jump", { trackId: track.track_id }));
    const playPauseTitle = playing ? "Pause" : accent ? "Resume" : "Play";
    const stop = (e) => e.stopPropagation();

    const content = (
        <>
            {/* main list: number / equaliser / hover play-pause */}
            {!dense && (
                <div className="flex w-6 shrink-0 items-center justify-center">
                    <span className={`flex items-center justify-center text-xs ${accent ? "text-accent" : "text-subtext"} group-hover:hidden`}>
                        {accent ? <Equalizer playing={playing} className="h-3.5 w-3.5" /> : number}
                    </span>
                    <button onPointerDown={stop} onClick={(e) => { stop(e); activate(); }} className="hidden text-maintext group-hover:block" title={playPauseTitle}>
                        <Icon name={playing ? "pause" : "play"} className="h-4 w-4" />
                    </button>
                </div>
            )}

            {/* artwork (with overlaid play/pause in the dense sidebar) */}
            <div className={`relative shrink-0 ${dense ? "h-9 w-9" : "h-10 w-10"}`}>
                <img
                    src={artworkOrFallback(track.artwork)}
                    onError={(e) => (e.currentTarget.src = artworkOrFallback(null))}
                    className="h-full w-full rounded object-cover"
                    alt=""
                />
                {dense && (
                    <button
                        onPointerDown={stop}
                        onClick={(e) => { stop(e); activate(); }}
                        title={playPauseTitle}
                        className="absolute inset-0 flex items-center justify-center rounded bg-black/50 text-white opacity-0 transition group-hover:opacity-100"
                    >
                        <Icon name={playing ? "pause" : "play"} className="h-4 w-4" />
                    </button>
                )}
            </div>

            {/* title / artist */}
            <div className="flex min-w-0 flex-1 flex-col leading-tight">
                <span className={`truncate text-[13px] ${accent ? "text-accent" : "text-maintext"}`}>{track.title}</span>
                <span className="truncate text-[11px] text-subtext">{track.artist}</span>
            </div>

            {/* album + added-by (name) on the wide main list */}
            {!dense && <AlbumCell track={track} className="hidden w-64 shrink-0 truncate text-[11px] text-subtext xl:block" />}
            {!dense && <AddedBy track={track} size={18} className="hidden w-28 shrink-0 text-[11px] text-subtext lg:flex" />}

            {/* dense sidebar: just the adder's avatar, left of the duration */}
            {dense && <AddedBy track={track} size={18} showName={false} className="shrink-0" />}

            {/* duration → trash on hover */}
            <span className="relative flex w-12 shrink-0 items-center justify-center">
                <span className="text-[11px] text-subtext transition group-hover:opacity-0">{msToClock(track.duration)}</span>
                <button
                    onPointerDown={stop}
                    onClick={(e) => { stop(e); removeTrack(track.track_id); }}
                    title="Remove from queue"
                    className="absolute inset-0 m-auto hidden h-7 w-7 items-center justify-center rounded-full text-subtext transition hover:text-maintext group-hover:flex"
                >
                    <Icon name="trash" className="h-4 w-4" />
                </button>
            </span>
        </>
    );

    const className = `group flex w-full items-center gap-3 rounded-md px-2 py-1.5 transition hover:bg-elevated ${dense ? "scroll-mt-20" : ""} ${active ? "bg-elevated" : ""} ${draggable ? "cursor-grab active:cursor-grabbing" : ""}`;

    if (draggable) {
        return (
            <Reorder.Item
                as="div"
                value={track}
                ref={innerRef}
                onDoubleClick={activate}
                onContextMenu={onContextMenu}
                onDragEnd={() => onDrop?.(track)}
                layout
                {...enter}
                className={className}
            >
                {content}
            </Reorder.Item>
        );
    }

    return (
        <motion.div ref={innerRef} onDoubleClick={activate} onContextMenu={onContextMenu} layout {...enter} className={className}>
            {content}
        </motion.div>
    );
}
