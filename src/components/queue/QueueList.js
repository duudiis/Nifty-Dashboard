import { useEffect, useLayoutEffect, useMemo, useRef, useState, forwardRef } from "react";

import QueueItem from "./QueueItem.js";
import { useNifty } from "../../context/NiftyContext.js";
import Icon from "../Icon.js";
import { AnimatePresence, Reorder, motion, EASE } from "../motion/index.js";

// Row slide duration (cursor change). Removal uses just the fade — no slide.
const SLIDE_DUR = 0.32;
const EXIT_DUR = 0.15;

// Hide a bit more of the previous track behind the sticky bar's opaque area
// (its gradient otherwise lets a sliver bleed through).
const PREV_HIDE = 32;

// useLayoutEffect on the client (so scroll runs synchronously before paint —
// no visible "starts at top then jumps" on panel open) and useEffect on the
// server (avoids the SSR warning).
const useIsoEffect = typeof window !== "undefined" ? useLayoutEffect : useEffect;

// Nearest scrollable ancestor of `node`.
function findScroller(node) {
    let p = node?.parentElement;
    while (p) {
        const oy = getComputedStyle(p).overflowY;
        if (oy === "auto" || oy === "scroll") return p;
        p = p.parentElement;
    }
    return null;
}

// Height of the sticky panel header (its full bar — opaque + gradient). We
// measure it at runtime so the scroll target tracks any padding tweaks.
function getStickyPad(scroller) {
    const bar = scroller?.querySelector(":scope > .sticky, :scope > * > .sticky");
    return bar?.offsetHeight || 72;
}

// Stable per-track keys: songUrl + how many identical songUrls precede it. They
// stay constant across a reorder (a pure permutation keeps each occurrence's
// rank), so rows don't remount when the bot echoes a drag back — and duplicate
// songs in the queue still get distinct keys.
function buildKeys(list) {
    const seen = new Map();
    return list.map((t) => {
        const n = seen.get(t.songUrl) || 0;
        seen.set(t.songUrl, n + 1);
        return `${t.songUrl}#${n}`;
    });
}

function ColumnHeader() {
    return (
        <div className="flex w-full items-center gap-3 border-b border-border/60 px-2 pb-2 text-[10px] font-bold uppercase tracking-wide text-subtext">
            <span className="w-3.5 shrink-0" />
            <span className="w-6 shrink-0 text-center">#</span>
            <span className="w-10 shrink-0" />
            <span className="min-w-0 flex-1">Title</span>
            <span className="hidden w-64 shrink-0 xl:block">Album</span>
            <span className="hidden w-28 shrink-0 lg:block">Added by</span>
            <span className="w-12 shrink-0 text-center">Time</span>
        </div>
    );
}

function EmptyState({ icon, title, hint }) {
    return (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
            <Icon name={icon} className="h-9 w-9 text-subtext/70" />
            <p className="text-sm font-bold text-maintext">{title}</p>
            <p className="text-xs text-subtext">{hint}</p>
        </div>
    );
}

// Spotify-style section label: white, normal case. Animated (fades in/out and
// slides into position). scroll-mt reserves a small gap above when
// scrollIntoView lands here, so the previous track tucks behind the sticky
// panel header.
const SectionHeader = forwardRef(({ children, innerRef, padTop = "pt-5", id, ...props }, ref) => (
    <motion.div
        layout="position"
        ref={(node) => {
            if (typeof ref === "function") ref(node);
            else if (ref) ref.current = node;

            if (typeof innerRef === "function") innerRef(node);
            else if (innerRef) innerRef.current = node;
        }}
        key={id}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{
            layout: { duration: SLIDE_DUR, ease: EASE },
            opacity: { duration: EXIT_DUR, ease: EASE }
        }}
        className={`w-full px-2 pb-2 mb-0.5 ${padTop} text-[13px] font-bold text-maintext`}
        {...props}
    >
        {children}
    </motion.div>
));

export default function QueueList({ dense = false }) {
    const { queue, player, selected, moveTrack } = useNifty();
    const tracks = queue.tracks || [];
    const position = queue.position ?? 0;

    // Local, drag-reorderable copy of the queue. The bot stays the source of
    // truth: we mirror its queue here, except while the user is mid-drag (so a
    // queue push can't yank rows out from under the pointer). On drop we send the
    // move and keep the optimistic order; the bot's echo then reconciles it.
    const [order, setOrder] = useState(tracks);
    const orderRef = useRef(order);
    orderRef.current = order;
    const draggingRef = useRef(false);
    const draggedRef = useRef(null);
    const fromRef = useRef(-1);

    useEffect(() => {
        if (!draggingRef.current) setOrder(tracks);
    }, [tracks]);

    const keys = useMemo(() => buildKeys(order), [order]);

    const handleDragStart = (track) => {
        draggingRef.current = true;
        draggedRef.current = track;
        // `order` mirrors what the bot already has (our prior moves were sent), so
        // the start index here is the entry's real index in the bot's queue.
        fromRef.current = orderRef.current.findIndex((t) => t === track);
    };

    const handleDragEnd = () => {
        const track = draggedRef.current;
        draggingRef.current = false;
        draggedRef.current = null;
        if (!track) return;
        const from = fromRef.current;
        const to = orderRef.current.findIndex((t) => t === track); // new index
        if (from >= 0 && to >= 0 && to !== from) moveTrack(from, to);
        // The bot echoes the move; the sync effect then reconciles `order`.
    };

    // The cursor is purely the bot's position index. We locate the current row by
    // matching that index against each track's track_id (which is its index in
    // the bot's queue) — this still points at the right row during an optimistic
    // reorder, since track_id and `position` only update together on a bot push.
    const currentIndex = player?.track ? order.findIndex((t) => t.track_id === position) : -1;
    const isCurrent = (track) => currentIndex >= 0 && track.track_id === position;

    // dense sidebar: bring "Now playing" to the top of the panel. Only fires when
    // the actually-playing song changes (not on reindexing), and waits until the
    // queue's `position` has caught up with the player's song before measuring.
    const nowPlayingRef = useRef(null);
    const lastScrolledSongRef = useRef(null);
    const playingSongUrl = player?.track?.songUrl || null;
    const layoutSong = order[currentIndex]?.songUrl || null;
    const layoutSettled = !!playingSongUrl && playingSongUrl === layoutSong;
    useIsoEffect(() => {
        if (!dense) return;
        if (!playingSongUrl) { lastScrolledSongRef.current = null; return; }
        if (!layoutSettled) return;
        if (lastScrolledSongRef.current === playingSongUrl) return;

        const isFirst = lastScrolledSongRef.current === null;
        lastScrolledSongRef.current = playingSongUrl;

        const header = nowPlayingRef.current;
        const scroller = header && findScroller(header);
        if (!header || !scroller) return;

        if (isFirst) {
            // Sync calculation for initial mount (no exiting ghost elements exist
            // yet) so we avoid the visual "starts at top then jumps" flash.
            const pad = getStickyPad(scroller);
            const target = Math.max(0, header.offsetTop - scroller.offsetTop - pad + PREV_HIDE);
            scroller.scrollTop = target;
            return;
        }

        // Song change: defer the calculation to rAF so Framer Motion's popLayout
        // can apply `position: absolute` to exiting rows before we measure.
        const id = requestAnimationFrame(() => {
            const pad = getStickyPad(scroller);
            const target = Math.max(0, header.offsetTop - scroller.offsetTop - pad + PREV_HIDE);
            scroller.scrollTo({ top: target, behavior: "smooth" });
        });

        return () => cancelAnimationFrame(id);
    }, [dense, playingSongUrl, layoutSettled]);

    if (!selected) {
        return <EmptyState icon="connect" title="No server selected" hint="Pick a server to see its queue." />;
    }

    if (order.length === 0) {
        return <EmptyState icon="queue" title="The queue is empty" hint="Search above to add a track and get the party started." />;
    }

    const item = (track, i) => (
        <QueueItem
            key={keys[i]}
            track={track}
            index={i}
            isCurrent={isCurrent(track)}
            dense={dense}
            onDragStart={handleDragStart}
            onDragEnd={handleDragEnd}
        />
    );

    // Main queue page: flat, drag-reorderable table.
    if (!dense) {
        return (
            <div className="flex flex-col gap-1">
                <ColumnHeader />
                <Reorder.Group as="div" axis="y" values={order} onReorder={setOrder} className="flex flex-col gap-1">
                    {order.map(item)}
                </Reorder.Group>
            </div>
        );
    }

    // Dense sidebar: one drag-reorderable list with interleaved section headers.
    // Headers aren't reorderable items — they're positioned from the current
    // cursor each render, so they follow the now-playing track.
    const hasCurrent = currentIndex >= 0 && currentIndex < order.length;

    const rows = [];
    order.forEach((track, i) => {
        if (hasCurrent && i === currentIndex) {
            rows.push(
                <SectionHeader key="hdr-now" id="hdr-now" innerRef={nowPlayingRef} padTop="pt-5">
                    Now playing
                </SectionHeader>
            );
        } else if (hasCurrent && i === currentIndex + 1) {
            rows.push(<SectionHeader key="hdr-next" id="hdr-next">Next from: Queue</SectionHeader>);
        }

        rows.push(item(track, i));
    });

    return (
        <Reorder.Group as="div" axis="y" values={order} onReorder={setOrder} className="flex flex-col">
            <AnimatePresence initial={false} mode="popLayout">
                {rows}
            </AnimatePresence>
            {/* room below so even the last track can sit at the very top */}
            <div className="h-[80vh] shrink-0" aria-hidden />
        </Reorder.Group>
    );
}
