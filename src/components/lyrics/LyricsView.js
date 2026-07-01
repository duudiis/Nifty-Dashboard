import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { useNifty } from "../../context/NiftyContext.js";
import Icon from "../Icon.js";
import { AnimatePresence, motion, EASE } from "../motion/index.js";

// Interpolates a smooth, ~frame-accurate playback position between the 1s
// progress pushes from the bot, so line/word highlighting lands on time.
function useSmoothProgress(player) {
    const base = useRef({ p: 0, t: 0, playing: false });
    const [ms, setMs] = useState(0);

    useEffect(() => {
        base.current = { p: player?.progress || 0, t: performance.now(), playing: !!player?.playing };
        setMs(player?.progress || 0);
    }, [player?.progress, player?.playing, player?.track?.songUrl]);

    // 100ms is plenty for line-level highlighting and far cheaper than redrawing
    // the whole list every animation frame. The per-word sweep is pure CSS.
    useEffect(() => {
        const id = setInterval(() => {
            const b = base.current;
            setMs(b.playing ? b.p + (performance.now() - b.t) : b.p);
        }, 100);
        return () => clearInterval(id);
    }, []);

    // Optimistically jump the clock on a click-to-seek so the active line updates
    // immediately — otherwise sync re-attaches and scrolls to the *old* line for
    // a beat before the bot's seek lands.
    const seek = useCallback((target) => {
        base.current = { p: target, t: performance.now(), playing: base.current.playing };
        setMs(target);
    }, []);

    return [ms, seek];
}

// Placeholder lines that mirror the real lyric layout exactly (same wrapper
// padding/spacing/line height), so content lands where the bars were.
function LyricsSkeleton() {
    const widths = ["70%", "52%", "84%", "61%", "45%", "76%", "58%", "68%"];
    return (
        <div className="space-y-9 px-8 pt-[42vh] sm:px-14">
            {widths.map((w, i) => (
                <div
                    key={i}
                    className="skeleton-shimmer h-9 rounded-md sm:h-10"
                    style={{ width: w, animationDelay: `${i * 0.18}s` }}
                />
            ))}
        </div>
    );
}

// Words light up ~120ms before their timestamp so the highlight lands with,
// rather than behind, the sung word (the bot clock is interpolated, not exact).
const WORD_LEAD = 120;

function Line({ line, state, ms, onClick, nodeRef }) {
    // state: "active" | "past" | "future". Words are always rendered as spans so
    // a line changing state only toggles a class — it never replaces DOM nodes
    // (which would drop the user's text selection / open menus).
    //
    // Word-timed lines (Enhanced LRC) carry `line.words` with per-word times; we
    // render those tokens directly and drive each word's highlight from the
    // clock. Plain lines split on whitespace and keep the fixed-stagger sweep.
    const tokens = useMemo(
        () =>
            line.words?.length
                ? line.words
                : line.text.split(/(\s+)/).map((text) => ({ text })),
        [line.words, line.text]
    );
    const timed = state === "active" && !!line.words?.length;

    return (
        <button
            ref={nodeRef}
            onClick={onClick}
            className={`block w-full text-balance text-left text-3xl font-extrabold leading-tight transition-all duration-500 sm:text-4xl ${
                state === "active"
                    ? `${timed ? "lyric-line-timed" : "lyric-line-active"} scale-[1.02] text-white`
                    : state === "past"
                    ? "text-white/25 hover:text-white/40"
                    : "text-white/30 hover:text-white/45"
            }`}
        >
            {tokens.map((tk, i) => {
                const sung = timed && tk.time != null && ms + WORD_LEAD >= tk.time;
                return (
                    <span
                        key={i}
                        className={`lyric-word${sung ? " lyric-word-sung" : ""}`}
                        style={!timed && state === "active" ? { animationDelay: `${i * 0.045}s` } : undefined}
                    >
                        {tk.text}
                    </span>
                );
            })}
        </button>
    );
}

export default function LyricsView() {
    const { player, selected, control } = useNifty();
    const track = player?.track || null;
    const [ms, seekMs] = useSmoothProgress(player);

    const [data, setData] = useState(null); // { synced, plain, instrumental, source }
    const [loading, setLoading] = useState(false);
    const [autoSync, setAutoSync] = useState(true);

    const scroller = useRef(null);
    const lineRefs = useRef([]);

    // Fetch (server-cached) lyrics whenever the track changes. Clear the old
    // lyrics immediately so the view never lingers on the previous song.
    useEffect(() => {
        if (!track?.title) {
            setData(null);
            return;
        }
        let stale = false;
        setData(null);
        setAutoSync(true);
        setLoading(true);
        const qs = new URLSearchParams({
            title: track.title,
            artist: track.artist || "",
            duration: String(track.duration || 0)
        });
        fetch(`/api/lyrics?${qs}`)
            .then((r) => r.json())
            .then((j) => {
                if (!stale) setData(j);
            })
            .catch(() => !stale && setData(null))
            .finally(() => !stale && setLoading(false));
        return () => {
            stale = true;
        };
    }, [track?.songUrl, track?.title]);

    const synced = data?.synced || [];

    // Bot time updates are coarse, so the position can wobble back a few hundred
    // ms between pushes. Don't let that walk the active line backwards — only
    // regress on a genuine seek (time landing well before the current line).
    const SEEK_BACK_MS = 1500;
    const activeRef = useRef(-1);
    const activeIndex = useMemo(() => {
        if (!synced.length) {
            activeRef.current = -1;
            return -1;
        }
        const t = ms + 250; // small lead so the line lights up just as it's sung
        let i = -1;
        while (i + 1 < synced.length && synced[i + 1].time <= t) i++;

        const prev = activeRef.current;
        if (i < prev && prev < synced.length && t > (synced[prev]?.time ?? 0) - SEEK_BACK_MS) {
            return prev; // small backward wobble — hold the current line
        }
        activeRef.current = i;
        return i;
    }, [synced, ms]);

    const scrollToActive = useCallback((behavior = "smooth") => {
        const el = lineRefs.current[activeIndex];
        const box = scroller.current;
        if (!el || !box) return;
        const top = el.offsetTop - box.clientHeight / 2 + el.clientHeight / 2;
        box.scrollTo({ top, behavior });
    }, [activeIndex]);

    // Keep the active line centred — unless the user has scrolled away.
    useEffect(() => {
        if (autoSync) scrollToActive();
    }, [activeIndex, autoSync, scrollToActive]);

    // A manual scroll/wheel/touch detaches sync until the user taps "Sync".
    const detach = () => setAutoSync(false);
    const resync = () => {
        setAutoSync(true);
        scrollToActive();
    };
    // Clicking a line to seek also re-attaches sync, so it follows along again.
    // Jump the local clock too so the active line is the clicked one right away
    // (no scroll to the previous line first).
    const seekTo = (timeMs) => {
        control("seek", { position: timeMs });
        seekMs(timeMs);
        setAutoSync(true);
    };

    const Centered = ({ children }) => (
        <div className="flex flex-1 flex-col items-center justify-center p-8 text-center">{children}</div>
    );

    // Decide what to show, then crossfade between states below.
    let mode;
    if (!selected || !track) mode = "notrack";
    else if (loading && !data) mode = "loading";
    else if (data?.instrumental) mode = "instrumental";
    else if (synced.length) mode = "synced";
    else if (data?.plain) mode = "plain";
    else mode = "empty";

    let body;
    if (mode === "loading") {
        body = (
            <div className="flex-1 overflow-hidden">
                <LyricsSkeleton />
            </div>
        );
    } else if (mode === "synced") {
        body = (
            <>
                <div
                    key={track.songUrl}
                    ref={scroller}
                    onWheel={detach}
                    onTouchMove={detach}
                    className="flex-1 space-y-9 overflow-y-auto px-8 py-[42vh] sm:px-14"
                >
                    {synced.map((line, i) => (
                        <Line
                            key={`${line.time}-${i}`}
                            line={line}
                            state={i === activeIndex ? "active" : i < activeIndex ? "past" : "future"}
                            ms={ms}
                            onClick={() => seekTo(line.time)}
                            nodeRef={(el) => (lineRefs.current[i] = el)}
                        />
                    ))}
                </div>

                <AnimatePresence>
                    {!autoSync && (
                        <motion.button
                            onClick={resync}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.16, ease: EASE }}
                            className="absolute bottom-4 right-4 flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-bold text-white shadow-lg backdrop-blur-md transition hover:bg-white/25"
                        >
                            <Icon name="sync" className="h-4 w-4" />
                            Sync
                        </motion.button>
                    )}
                </AnimatePresence>
            </>
        );
    } else if (mode === "plain") {
        body = (
            <div className="flex-1 overflow-y-auto px-8 py-12 sm:px-14">
                <pre className="whitespace-pre-wrap text-left font-unbounded text-2xl font-extrabold leading-relaxed text-white/85">
                    {data.plain}
                </pre>
            </div>
        );
    } else if (mode === "instrumental") {
        body = <Centered><p className="text-2xl font-extrabold text-white/80">Instrumental</p></Centered>;
    } else if (mode === "notrack") {
        body = <Centered><p className="text-lg font-bold text-white/70">No track playing</p></Centered>;
    } else {
        body = <Centered><p className="text-lg font-bold text-white/70">Lyrics not found</p></Centered>;
    }

    return (
        <div className="relative h-full overflow-hidden">
            {/* the cover-art backdrop is rendered by SlideTransition (pinned, so
                it doesn't slide with the view); only the lyric states live here */}
            <AnimatePresence initial={false}>
                <motion.div
                    key={mode}
                    className="absolute inset-0 flex flex-col"
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3, ease: EASE }}
                >
                    {body}
                </motion.div>
            </AnimatePresence>
        </div>
    );
}
