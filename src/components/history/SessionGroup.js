import { useEffect, useRef, useState } from "react";

import Icon from "../Icon.js";
import { TrackListSkeleton } from "../Loader.js";
import PlayItem from "./PlayItem.js";
import { AnimatePresence, motion, EASE, LoadingSwap } from "../motion/index.js";
import { formatTime } from "../../lib/format.js";

// Sessions are light separators in one track list. Fetch their tracks only as
// they approach the viewport, keeping a long history cheap to open.
export default function SessionGroup({ session, defaultOpen = true }) {
    const [open, setOpen] = useState(defaultOpen);
    const [visible, setVisible] = useState(false);
    const [plays, setPlays] = useState(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);
    const [retry, setRetry] = useState(0);
    const container = useRef(null);

    useEffect(() => {
        if (!container.current || visible) return;
        if (typeof IntersectionObserver === "undefined") { setVisible(true); return; }
        const observer = new IntersectionObserver((entries) => {
            if (entries.some((entry) => entry.isIntersecting)) { setVisible(true); observer.disconnect(); }
        }, { rootMargin: "240px" });
        observer.observe(container.current);
        return () => observer.disconnect();
    }, [visible]);

    useEffect(() => {
        if (!open || !visible || plays != null) return;
        const controller = new AbortController();
        setLoading(true);
        setError(false);
        fetch(`/api/history?sessionId=${encodeURIComponent(session.id)}`, { cache: "no-store", signal: controller.signal })
            .then((response) => { if (!response.ok) throw new Error(); return response.json(); })
            .then((json) => { setPlays(json.plays || []); setLoading(false); })
            .catch((error) => { if (error.name !== "AbortError") setError(true); })
            .finally(() => { if (!controller.signal.aborted) setLoading(false); });
        return () => controller.abort();
    }, [open, visible, session.id, retry, plays]);

    const effectiveEnd = session.endedAt || session.lastListen;
    const live = !session.endedAt && effectiveEnd && (Date.now() - new Date(effectiveEnd) < 120_000);
    const range = `${formatTime(session.startedAt)}${live ? " – now" : effectiveEnd ? ` – ${formatTime(effectiveEnd)}` : ""}`;

    return (
        <section ref={container} className="mb-5">
            <button type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open} className="mb-1 flex min-h-11 w-full items-center gap-3 border-b border-border/50 px-3 text-left text-xs text-subtext transition-colors hover:text-maintext">
                <span className="font-medium tabular-nums">{range}</span>
                <span className="text-subtext/60">·</span>
                <span>{session.plays} song{session.plays === 1 ? "" : "s"}</span>
                {live && <span className="text-subtext">Listening now</span>}
                <Icon name="chevron-down" className={`ml-auto h-3.5 w-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />
            </button>
            <AnimatePresence initial={false}>
                {open && (
                    <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} transition={{ duration: 0.22, ease: EASE }} className="overflow-hidden">
                        <LoadingSwap loading={plays == null && !error} fallback={<TrackListSkeleton rows={session.plays || 3} rowHeight={76} label="Loading listening history" />}>
                        {error && <button type="button" onClick={() => setRetry((value) => value + 1)} className="my-5 rounded-full border border-border px-4 py-2 text-xs text-subtext hover:text-maintext">Couldn&apos;t load this session. Try again</button>}
                        {plays?.length > 0 && <ul>{plays.map((play) => <PlayItem key={play.id} play={play} />)}</ul>}
                        {plays?.length === 0 && <p className="px-3 py-6 text-xs text-subtext">No songs recorded for this session.</p>}
                        </LoadingSwap>
                    </motion.div>
                )}
            </AnimatePresence>
        </section>
    );
}
