import { useEffect, useRef, useState } from "react";

import Icon from "../Icon.js";
import { useNifty } from "../../context/NiftyContext.js";
import { AnimatePresence, motion, EASE } from "../motion/index.js";
import { artworkOrFallback, formatTime, humanDuration, msToClock } from "../../lib/format.js";
import { useContextMenu } from "../menu/ContextMenu.js";
import { useTrackMenu } from "../menu/trackMenu.js";
import ArtistLink from "../browse/ArtistLink.js";
import { reasonInfo } from "./reasons.js";

function SegmentRow({ seg }) {
    const start = reasonInfo("segStart", seg.startReason);
    const end = reasonInfo("segEnd", seg.endReason);
    const listened = seg.endedAt ? new Date(seg.endedAt) - new Date(seg.startedAt) : null;
    return (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 py-1.5 text-[11px] text-subtext">
            <span className="tabular-nums">{formatTime(seg.startedAt)} – {seg.endedAt ? formatTime(seg.endedAt) : "now"}</span>
            <span aria-hidden>·</span><span>{start.label}</span>
            <Icon name="play-next" className="h-3 w-3 opacity-50" /><span>{end.label}</span>
            {listened != null && <span className="tabular-nums">· {humanDuration(listened)}</span>}
        </div>
    );
}

export default function PlayItem({ play }) {
    const { play: playTrack, selected } = useNifty();
    const [details, setDetails] = useState(false);
    const [queued, setQueued] = useState(false);
    const resetTimer = useRef(null);
    useEffect(() => () => clearTimeout(resetTimer.current), []);
    const trackMenu = useTrackMenu();
    const track = { ...play.track, duration: play.track?.durationMs != null ? msToClock(play.track.durationMs) : null };
    const end = reasonInfo("playEnd", play.endReason);
    const via = play.via ? reasonInfo("via", play.via) : null;
    const segments = play.segments || [];
    const queue = () => {
        if (!selected || !track.url || queued) return;
        playTrack(track.url, "queue", track.title);
        setQueued(true);
        clearTimeout(resetTimer.current);
        resetTimer.current = setTimeout(() => setQueued(false), 1400);
    };
    const { onContextMenu, active } = useContextMenu(() => trackMenu(track, { source: "search", onAdd: queue }));

    return (
        <li className={`group rounded-lg transition-colors hover:bg-elevated/70 ${active ? "bg-elevated" : ""}`} onContextMenu={onContextMenu}>
            <div className="flex min-h-[76px] items-center gap-3 px-2 py-3 sm:gap-4 sm:px-3">
                <button
                    type="button"
                    onClick={() => selected && track.url && playTrack(track.url, "now", track.title)}
                    disabled={!selected || !track.url}
                    title={selected ? "Play now" : "Select a server to play"}
                    aria-label={`Play ${track.title}`}
                    className="relative h-11 w-11 shrink-0 overflow-hidden rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
                >
                    <img src={artworkOrFallback(track.artwork)} onError={(event) => (event.currentTarget.src = artworkOrFallback(null))} alt="" loading="lazy" className="h-full w-full object-cover" />
                    <span className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition-opacity group-hover:opacity-100 group-focus-within:opacity-100"><Icon name="play" className="h-4 w-4 text-white" /></span>
                </button>
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <span className="truncate text-sm font-medium text-maintext">{track.title}</span>
                    <ArtistLink name={track.artist} browseId={track.artistBrowseId} className="text-xs text-subtext" />
                </div>
                <span className="hidden shrink-0 text-right text-[11px] tabular-nums text-subtext md:block">{formatTime(play.startedAt)}</span>
                <span className="hidden w-12 shrink-0 text-right text-xs tabular-nums text-subtext sm:block">{track.duration || "—"}</span>
                <button type="button" onClick={queue} disabled={!selected || !track.url || queued} aria-label={queued ? `${track.title} added to queue` : `Add ${track.title} to queue`} title={queued ? "Added to queue" : selected ? "Add to queue" : "Select a server to queue"} className={`flex h-9 w-9 shrink-0 items-center justify-center transition-colors disabled:opacity-40 ${queued ? "text-accent" : "text-subtext hover:text-maintext"}`}><Icon name={queued ? "check" : "enqueue"} className="h-[18px] w-[18px]" /></button>
                <button type="button" onClick={() => setDetails((value) => !value)} aria-expanded={details} aria-label={`Listening details for ${track.title}`} title="Listening details" className={`flex h-8 w-8 shrink-0 items-center justify-center transition-colors hover:text-maintext ${details ? "text-maintext" : "text-subtext"}`}><Icon name="info" className="h-4 w-4" /></button>
                <button type="button" onClick={onContextMenu} aria-label={`More options for ${track.title}`} className="flex h-8 w-8 shrink-0 items-center justify-center text-subtext transition-colors hover:text-maintext"><Icon name="more" className="h-4 w-4" /></button>
            </div>
            <AnimatePresence initial={false}>
                {details && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.2, ease: EASE }} className="overflow-hidden">
                        <div className="ml-[68px] mr-3 border-t border-border/50 pb-4 pt-3 sm:ml-[72px]">
                            <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-[11px] text-subtext">
                                <span className="tabular-nums">{formatTime(play.startedAt)} · {humanDuration(play.listenedMs)} listened</span>
                                <span className="inline-flex items-center gap-1.5"><Icon name={end.icon} className="h-3.5 w-3.5" />{end.label}</span>
                                {via && <span className="inline-flex items-center gap-1.5"><Icon name={via.icon} className="h-3.5 w-3.5" />{via.label}</span>}
                                {play.queuedBy && <span>Added by {play.queuedBy.name || "someone"}</span>}
                            </div>
                            {segments.length > 1 && <div className="mt-3 border-l border-border pl-3">{segments.map((seg) => <SegmentRow key={seg.id} seg={seg} />)}</div>}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </li>
    );
}
