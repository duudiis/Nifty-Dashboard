import { useEffect, useRef, useState } from "react";

import Icon from "../Icon.js";
import Loader from "../Loader.js";
import PlayItem from "./PlayItem.js";
import { AnimatePresence, motion, EASE } from "../motion/index.js";
import { formatTime, humanDuration } from "../../lib/format.js";

// A single voice-channel session: a summary card that reveals its play-by-play
// timeline on expand. Plays are fetched lazily (and once) the first time the
// card is opened, so a long history never loads every track up front.
export default function SessionGroup({ session, defaultOpen = false }) {
    const [open, setOpen] = useState(defaultOpen);
    const [plays, setPlays] = useState(null);   // null = not loaded yet
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);
    const fetched = useRef(false);

    useEffect(() => {
        if (!open || fetched.current) return;
        fetched.current = true;
        setLoading(true);
        setError(false);
        fetch(`/api/history?sessionId=${session.id}`, { cache: "no-store" })
            .then((r) => { if (!r.ok) throw new Error(); return r.json(); })
            .then((json) => setPlays(json.plays || []))
            .catch(() => { setError(true); fetched.current = false; })
            .finally(() => setLoading(false));
    }, [open, session.id]);

    // An orphaned session (bot never wrote ended_at) looks "open" but isn't —
    // treat it as live only when its last listening span reaches nearly to now.
    const effectiveEnd = session.endedAt || session.lastListen;
    const live = !session.endedAt && effectiveEnd && (Date.now() - new Date(effectiveEnd) < 120_000);
    const range = `${formatTime(session.startedAt)} – ${live ? "now" : formatTime(effectiveEnd)}`;
    const wallMs = (live ? Date.now() : new Date(effectiveEnd)) - new Date(session.startedAt);

    return (
        <div className="overflow-hidden rounded-xl border border-border bg-elevated/40">
            <button
                onClick={() => setOpen((o) => !o)}
                className="flex w-full items-center gap-3 px-4 py-3 text-left transition hover:bg-white/[0.03]"
            >
                <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-accent/15 text-accent">
                    <Icon name="boombox" className="h-5 w-5" />
                </span>

                <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-bold text-maintext">{range}</span>
                        {live && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2 py-0.5 text-[10px] font-semibold text-emerald-300">
                                <span className="h-1.5 w-1.5 rounded-full bg-emerald-400" /> Live
                            </span>
                        )}
                    </div>
                    <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[11px] text-subtext">
                        <span>{session.plays} track{session.plays === 1 ? "" : "s"}</span>
                        <span className="text-subtext/50">·</span>
                        <span>{session.distinctTracks} unique</span>
                        <span className="text-subtext/50">·</span>
                        <span className="text-maintext/80">{humanDuration(session.listenedMs)} listened</span>
                        <span className="text-subtext/50">·</span>
                        <span>{humanDuration(wallMs)} long</span>
                    </div>
                </div>

                <Icon
                    name="chevron-down"
                    className={`h-4 w-4 shrink-0 text-subtext transition-transform ${open ? "rotate-180" : ""}`}
                />
            </button>

            <AnimatePresence initial={false}>
                {open && (
                    <motion.div
                        initial={{ height: 0, opacity: 0 }}
                        animate={{ height: "auto", opacity: 1 }}
                        exit={{ height: 0, opacity: 0 }}
                        transition={{ duration: 0.24, ease: EASE }}
                        className="overflow-hidden"
                    >
                        <div className="px-3 pb-3">
                            {loading && (
                                <div className="flex items-center px-2 py-4">
                                    <Loader size="sm" />
                                </div>
                            )}
                            {error && (
                                <button
                                    onClick={() => { setOpen(false); requestAnimationFrame(() => setOpen(true)); }}
                                    className="px-2 py-4 text-xs text-rose-400 hover:underline"
                                >
                                    Couldn't load this session — retry
                                </button>
                            )}
                            {plays && plays.length > 0 && (
                                <ul className="pt-1">
                                    {plays.map((p) => <PlayItem key={p.id} play={p} />)}
                                </ul>
                            )}
                            {plays && plays.length === 0 && (
                                <div className="px-2 py-4 text-xs text-subtext">No tracks recorded for this session.</div>
                            )}
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
