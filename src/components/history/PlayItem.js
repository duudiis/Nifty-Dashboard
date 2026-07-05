import { useState } from "react";

import Icon from "../Icon.js";
import { useNifty } from "../../context/NiftyContext.js";
import { AnimatePresence, motion, EASE } from "../motion/index.js";
import { artworkOrFallback, formatTime, humanDuration, msToClock } from "../../lib/format.js";
import { reasonInfo } from "./reasons.js";

function Pill({ label, cls }) {
    return (
        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold ring-1 ring-inset ${cls}`}>
            {label}
        </span>
    );
}

// One listening span within a play (a pause/leave splits a play into several).
function SegmentRow({ seg }) {
    const start = reasonInfo("segStart", seg.startReason);
    const end = reasonInfo("segEnd", seg.endReason);
    const listened = seg.endedAt ? new Date(seg.endedAt) - new Date(seg.startedAt) : null;

    return (
        <div className="flex flex-wrap items-center gap-x-2 gap-y-1 py-1 text-[11px] text-subtext">
            <span className="tabular-nums text-maintext/80">
                {formatTime(seg.startedAt)}{seg.endedAt ? ` – ${formatTime(seg.endedAt)}` : " – now"}
            </span>
            <Pill {...start} />
            <Icon name="play-next" className="h-2.5 w-2.5 text-subtext/60" />
            <Pill {...end} />
            {listened != null && <span className="tabular-nums text-subtext/80">· {humanDuration(listened)}</span>}
        </div>
    );
}

export default function PlayItem({ play }) {
    const { play: playTrack } = useNifty();
    const [openSegments, setOpenSegments] = useState(false);

    const { track } = play;
    const end = reasonInfo("playEnd", play.endReason);
    const via = play.via ? reasonInfo("via", play.via) : null;
    const multi = play.segments.length > 1;

    return (
        <li className="relative pl-8">
            {/* Timeline rail + node */}
            <span className="absolute left-[9px] top-2 bottom-0 w-px bg-border" aria-hidden />
            <span className="absolute left-1.5 top-[9px] h-2.5 w-2.5 rounded-full bg-accent ring-4 ring-surface" aria-hidden />

            <div className="rounded-lg px-2 py-2 transition hover:bg-white/[0.03]">
                <div className="flex items-start gap-3">
                    <button
                        onClick={() => track.url && playTrack(track.url, "now", track.title)}
                        title={track.url ? "Play now" : undefined}
                        className="group relative h-11 w-11 shrink-0 overflow-hidden rounded-md shadow"
                    >
                        <img
                            src={artworkOrFallback(track.artwork)}
                            onError={(e) => (e.currentTarget.src = artworkOrFallback(null))}
                            alt=""
                            className="h-full w-full object-cover"
                        />
                        {track.url && (
                            <span className="absolute inset-0 flex items-center justify-center bg-black/50 opacity-0 transition group-hover:opacity-100">
                                <Icon name="play" className="h-4 w-4 text-white" />
                            </span>
                        )}
                    </button>

                    <div className="min-w-0 flex-1">
                        <div className="flex items-baseline gap-2">
                            <span className="truncate text-sm font-semibold text-maintext">{track.title}</span>
                            <span className="shrink-0 tabular-nums text-[11px] text-subtext">{formatTime(play.startedAt)}</span>
                        </div>
                        {track.artist && <div className="truncate text-xs text-subtext">{track.artist}</div>}

                        <div className="mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-[11px] text-subtext">
                            <span className="inline-flex items-center gap-1 text-maintext/80">
                                <Icon name="now-playing" className="h-3 w-3 text-accent" />
                                <span className="tabular-nums">{humanDuration(play.listenedMs)} listened</span>
                            </span>
                            {track.durationMs != null && (
                                <span className="tabular-nums text-subtext/70">of {msToClock(track.durationMs)}</span>
                            )}
                            <Pill {...end} />
                            {via && <Pill {...via} />}
                            {play.queuedBy && (
                                <span className="inline-flex items-center gap-1">
                                    {play.queuedBy.avatar && (
                                        <img src={play.queuedBy.avatar} alt="" className="h-3.5 w-3.5 rounded-full object-cover" />
                                    )}
                                    <span className="truncate">{play.queuedBy.name || "someone"}</span>
                                </span>
                            )}
                        </div>

                        {multi && (
                            <button
                                onClick={() => setOpenSegments((o) => !o)}
                                className="mt-1.5 inline-flex items-center gap-1 text-[11px] font-medium text-subtext transition hover:text-maintext"
                            >
                                <Icon name="chevron-down" className={`h-3 w-3 transition-transform ${openSegments ? "rotate-180" : ""}`} />
                                {play.segments.length} listening spans
                            </button>
                        )}

                        <AnimatePresence initial={false}>
                            {multi && openSegments && (
                                <motion.div
                                    initial={{ height: 0, opacity: 0 }}
                                    animate={{ height: "auto", opacity: 1 }}
                                    exit={{ height: 0, opacity: 0 }}
                                    transition={{ duration: 0.2, ease: EASE }}
                                    className="overflow-hidden"
                                >
                                    <div className="mt-1 border-l border-border/70 pl-3">
                                        {play.segments.map((seg) => <SegmentRow key={seg.id} seg={seg} />)}
                                    </div>
                                </motion.div>
                            )}
                        </AnimatePresence>
                    </div>
                </div>
            </div>
        </li>
    );
}
