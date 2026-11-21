import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, forwardRef } from "react";

import QueueItem from "./QueueItem.js";
import AutoplaySection from "./AutoplaySection.js";
import { makeQueueRows, reorderQueueRows, queueDropAction } from "./order.js";
import { useNifty } from "../../context/NiftyContext.js";
import Icon from "../Icon.js";
import { Skeleton, TrackListSkeleton } from "../Loader.js";
import { TrackTableHeader } from "../browse/trackTable.js";
import { Reorder, motion, EASE, AnimatePresence, LoadingSwap } from "../motion/index.js";

// Match row movement and section headers when the playback cursor advances.
const SLIDE_DUR = 0.24;
const SECTION_HEADER_CLASS = "w-full px-2 pb-2 mb-0.5 text-[13px] leading-[1.5] font-bold text-maintext";

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

// Compare document-layout offsets, not viewport boxes while rows are being
// projected by Framer. The header and scroller have different offset parents.
function layoutTop(node) {
    let top = 0;
    for (let current = node; current; current = current.offsetParent) top += current.offsetTop;
    return top;
}

// Height of the sticky panel header (its full bar — opaque + gradient). We
// measure it at runtime so the scroll target tracks any padding tweaks.
function getStickyPad(scroller) {
    const bar = scroller?.querySelector(":scope > .sticky, :scope > * > .sticky");
    return bar?.offsetHeight || 72;
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
        data-queue-section={id}
        key={id}
        initial={false}
        transition={{ layout: { duration: SLIDE_DUR, ease: EASE } }}
        className="w-full"
        {...props}
    >
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18, ease: EASE }} className={`${SECTION_HEADER_CLASS} ${padTop}`}>
            {children}
        </motion.div>
    </motion.div>
));

function QueueSkeleton({ dense }) {
    if (!dense) return <TrackListSkeleton rows={9} fill label="Loading queue" />;
    return (
        <div role="status" aria-label="Loading queue" className="w-full shrink-0">
            <div className={`${SECTION_HEADER_CLASS} pt-5`}><Skeleton className="h-[1.5em] w-24" /></div>
            <TrackListSkeleton rows={1} dense />
            <div className={`${SECTION_HEADER_CLASS} pt-5`}><Skeleton className="h-[1.5em] w-32" /></div>
            <TrackListSkeleton rows={4} dense />
            <div className="flex h-12 items-center px-2"><Skeleton className="h-5 w-36" /></div>
            <TrackListSkeleton rows={3} dense fill />
        </div>
    );
}

// Stable fallback: both arrays are memo dependencies.
const NO_TRACKS = [];

export default function QueueList({ dense = false }) {
    const { queue, player, selected, ready, stateLoaded, moveTrack, autoplayMove, autoplayQueue } = useNifty();
    const loading = !ready || (!!selected && stateLoaded === false);
    const tracks = queue.tracks ?? NO_TRACKS;
    const recommendations = queue.autoplay?.enabled ? queue.autoplay.tracks ?? NO_TRACKS : NO_TRACKS;
    const position = queue.position ?? 0;

    // A single reorder group lets a recommendation cross the section boundary
    // and settle anywhere among previous, current, and upcoming queue entries.
    const rawSourceRows = useMemo(() => makeQueueRows(tracks, recommendations), [tracks, recommendations]);
    const promotionIdentityRef = useRef(null);
    const promotedKeysRef = useRef(new Map());
    const sourceRows = useMemo(() => {
        const queuedKeys = new Set(rawSourceRows.filter((row) => row.kind === "queue").map((row) => row.key));
        for (const key of promotedKeysRef.current.keys()) {
            if (!queuedKeys.has(key)) promotedKeysRef.current.delete(key);
        }
        const promotion = promotionIdentityRef.current;
        // The bot gives a promoted recommendation a new queue entry ID. Keep
        // the dragged row's React identity once that exact new entry arrives;
        // animating it as a removal plus insertion would flash at the drop.
        if (promotion && !rawSourceRows.some((row) => row.key === promotion.key && row.kind === "autoplay")) {
            const candidates = rawSourceRows.filter((row) => row.kind === "queue"
                && !promotion.queuedKeys.has(row.key) && row.track.songUrl === promotion.songUrl);
            const entry = candidates.find((row) => row.track.track_id === promotion.to) || candidates[0];
            if (entry) {
                promotedKeysRef.current.set(entry.key, promotion.key);
                promotionIdentityRef.current = null;
            }
        }
        return rawSourceRows.map((row) => promotedKeysRef.current.has(row.key)
            ? { ...row, key: promotedKeysRef.current.get(row.key) } : row);
    }, [rawSourceRows]);
    const [draftOrder, setOrder] = useState(sourceRows);
    const draftSourceRef = useRef(sourceRows);
    const [raisedRow, setRaisedRow] = useState(null);
    const raisedTimerRef = useRef(null);
    const draggingRef = useRef(false);
    const draggedRef = useRef(null);
    const fromRef = useRef(-1);
    const pendingPromotionRef = useRef(null);
    const promotionTimerRef = useRef(null);
    const sourceRowsRef = useRef(sourceRows);
    sourceRowsRef.current = sourceRows;
    const order = draggingRef.current || pendingPromotionRef.current || draftSourceRef.current === sourceRows ? draftOrder : sourceRows;
    const orderRef = useRef(order);
    orderRef.current = order;

    useIsoEffect(() => {
        if (draggingRef.current) return;
        const pending = pendingPromotionRef.current;
        // Promotion is echoed as queue add/move followed by the updated
        // recommendation buffer. Keep the dropped row in place across those
        // intermediate messages instead of flashing it back to Autoplay.
        if (pending && (promotionIdentityRef.current || sourceRows.some((row) => row.key === pending && row.kind === "autoplay"))) return;
        pendingPromotionRef.current = null;
        clearTimeout(promotionTimerRef.current);
        const previous = draftSourceRef.current;
        // A server move has the same entries in a new order. Keep the entry
        // travelling furthest above its neighbours while their slots settle;
        // otherwise its artwork/text is clipped behind each opaque row it
        // crosses. Insert/remove updates need no extra stacking layer.
        if (previous.length === sourceRows.length) {
            const previousIndices = new Map(previous.map((row, index) => [row.key, index]));
            if (sourceRows.every((row) => previousIndices.has(row.key))) {
                let distance = 0;
                let key = null;
                sourceRows.forEach((row, index) => {
                    const delta = Math.abs(index - previousIndices.get(row.key));
                    if (row.kind !== "boundary" && delta > distance) { distance = delta; key = row.key; }
                });
                if (key) {
                    clearTimeout(raisedTimerRef.current);
                    setRaisedRow(key);
                    raisedTimerRef.current = setTimeout(() => setRaisedRow(null), SLIDE_DUR * 1000 + 50);
                }
            }
        }
        draftSourceRef.current = sourceRows;
        setOrder(sourceRows);
    }, [sourceRows]);
    useEffect(() => () => {
        clearTimeout(promotionTimerRef.current);
        clearTimeout(raisedTimerRef.current);
    }, []);

    const handleReorder = (keys) => {
        const next = reorderQueueRows(orderRef.current, keys, draggedRef.current);
        orderRef.current = next;
        setOrder(next);
    };

    /* ---- edge auto-scroll while dragging ---- */
    // Hold a track near the top/bottom of the scroll area and it scrolls that
    // way, so you can drag a track anywhere in a long queue. Works in both the
    // page and the sidebar (we just scroll whichever container holds the list).
    const listRef = useRef(null);
    const scrollerRef = useRef(null);
    const pointerYRef = useRef(0);       // real pointer Y (where the cursor sits)
    const lastPointerRef = useRef(null); // last *real* pointer event
    const accScrollRef = useRef(0);      // total auto-scroll since this drag began
    const rafRef = useRef(0);

    // Re-emit the last real pointer position shifted by everything we've
    // auto-scrolled. framer's drag offset is pointer-minus-origin, and scrolling
    // moves the origin out from under the held row; adding the accumulated scroll
    // back into the reported pointer keeps the row pinned to the cursor.
    const emitCompensated = useCallback(() => {
        const le = lastPointerRef.current;
        if (!le) return;
        const ev = new PointerEvent("pointermove", {
            clientX: le.clientX,
            clientY: le.clientY + accScrollRef.current,
            pointerId: le.pointerId,
            pointerType: le.pointerType || "mouse",
            isPrimary: true,
            bubbles: true,
            cancelable: true,
            view: window
        });
        ev.__auto = true;
        document.dispatchEvent(ev);
    }, []);

    // Capture-phase so we run before framer's own (bubble-phase) window listener.
    // Once the list has scrolled, every real move must be compensated for the rest
    // of the drag — not just while at the edge — or the row snaps back the moment
    // the cursor leaves the edge. We swallow the raw move and re-emit a shifted one.
    const onPointerCapture = useCallback((e) => {
        if (e.__auto) return; // our compensated event → let it reach framer
        lastPointerRef.current = e;
        pointerYRef.current = e.clientY;
        if (accScrollRef.current !== 0) {
            e.stopImmediatePropagation();
            emitCompensated();
        }
    }, [emitCompensated]);

    const startAutoscroll = useCallback((event) => {
        const scroller = findScroller(listRef.current);
        scrollerRef.current = scroller;
        accScrollRef.current = 0;
        if (!scroller) return;
        const rect = scroller.getBoundingClientRect();
        pointerYRef.current = event?.clientY ?? (rect.top + rect.bottom) / 2;
        lastPointerRef.current = event || null;
        window.addEventListener("pointermove", onPointerCapture, true);
        const EDGE = 80;  // px from an edge where scrolling kicks in
        const MAX = 7;    // px per frame at the very edge (gentle)
        const tick = () => {
            const sc = scrollerRef.current;
            if (!sc) return;
            const r = sc.getBoundingClientRect();
            const y = pointerYRef.current;
            let dy = 0;
            if (y < r.top + EDGE) dy = -MAX * Math.min(1, (r.top + EDGE - y) / EDGE);
            else if (y > r.bottom - EDGE) dy = MAX * Math.min(1, (y - (r.bottom - EDGE)) / EDGE);
            if (dy) {
                const before = sc.scrollTop;
                sc.scrollTop += dy;
                const applied = sc.scrollTop - before; // real movement (0 at the ends)
                if (applied) {
                    accScrollRef.current += applied;
                    emitCompensated(); // keep the row pinned while the cursor is parked
                }
            }
            rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
    }, [onPointerCapture, emitCompensated]);

    const stopAutoscroll = useCallback(() => {
        window.removeEventListener("pointermove", onPointerCapture, true);
        cancelAnimationFrame(rafRef.current);
        scrollerRef.current = null;
        accScrollRef.current = 0;
    }, [onPointerCapture]);

    useEffect(() => stopAutoscroll, [stopAutoscroll]); // clean up if unmounted mid-drag

    const handleDragStart = (key, event) => {
        const row = orderRef.current.find((entry) => entry.key === key);
        if (!row) return;
        draftSourceRef.current = sourceRowsRef.current;
        setOrder(orderRef.current);
        draggingRef.current = true;
        draggedRef.current = row;
        fromRef.current = orderRef.current.filter((entry) => entry.kind === row.kind).findIndex((entry) => entry.key === key);
        startAutoscroll(event);
    };

    const handleDragEnd = () => {
        stopAutoscroll();
        const row = draggedRef.current;
        draggingRef.current = false;
        draggedRef.current = null;
        if (!row) return;
        const drop = queueDropAction(orderRef.current, row, sourceRows, fromRef.current);
        let sent;
        if (drop?.action === "autoplayQueue") {
            sent = autoplayQueue(drop.id, drop.to);
            if (sent !== false) {
                promotionIdentityRef.current = {
                    key: row.key,
                    songUrl: row.track.songUrl,
                    to: drop.to,
                    queuedKeys: new Set(rawSourceRows.filter((entry) => entry.kind === "queue").map((entry) => entry.key))
                };
                pendingPromotionRef.current = row.key;
                clearTimeout(promotionTimerRef.current);
                promotionTimerRef.current = setTimeout(() => {
                    pendingPromotionRef.current = null;
                    promotionIdentityRef.current = null;
                    if (!draggingRef.current) setOrder(sourceRowsRef.current);
                }, 2500);
            }
        } else if (drop?.action === "autoplayMove") sent = autoplayMove(drop.id, drop.to);
        else if (drop?.action === "move") sent = moveTrack(drop.id, drop.to);
        if (!drop || sent === false) setOrder(sourceRows);
    };

    // Locate the current entry by its stable key, so a queue update received
    // during a drag cannot shift the playing marker to a different song.
    const currentKey = player?.track ? sourceRows.find((row) => row.kind === "queue" && row.track.track_id === position)?.key : null;
    const currentIndex = order.findIndex((row) => row.key === currentKey);
    const isCurrent = (row) => row.key === currentKey;

    // dense sidebar: bring "Now playing" to the top of the panel. Only fires when
    // the actually-playing song changes (not on reindexing), and waits until the
    // queue's `position` has caught up with the player's song before measuring.
    const nowPlayingRef = useRef(null);
    const lastScrolledSongRef = useRef(null);
    const playingSongUrl = player?.track?.songUrl || null;
    const layoutSong = order[currentIndex]?.track?.songUrl || null;
    const layoutSettled = !!playingSongUrl && playingSongUrl === layoutSong;
    useIsoEffect(() => {
        if (!dense || loading) return;
        if (!playingSongUrl) { lastScrolledSongRef.current = null; return; }
        if (!layoutSettled || lastScrolledSongRef.current === playingSongUrl) return;
        const header = nowPlayingRef.current;
        const scroller = header && findScroller(header);
        if (!header || !scroller) return;

        const first = lastScrolledSongRef.current === null;
        lastScrolledSongRef.current = playingSongUrl;
        const target = Math.max(0, layoutTop(header) - layoutTop(scroller) - getStickyPad(scroller) + PREV_HIDE);
        // Start with the same commit as the position-only row transition.
        // Mark the song as aligned only once its actual header is mounted;
        // LoadingSwap used to consume that first alignment while showing a
        // skeleton, then the next song unexpectedly scrolled the whole panel.
        scroller.scrollTo({ top: target, behavior: first ? "instant" : "smooth" });
    }, [dense, loading, playingSongUrl, layoutSettled]);

    const boundary = order.findIndex((row) => row.kind === "boundary");
    // Keep the empty-state height stable while the first recommendation is
    // being dragged across the boundary; collapsing it would move the target.
    const hasQueueTracks = order.some((row) => row.kind === "queue");
    const hasAutoplayTracks = order.some((row) => row.kind === "autoplay");
    const [retainQueueFrame, setRetainQueueFrame] = useState(hasQueueTracks);
    useIsoEffect(() => {
        if (loading) setRetainQueueFrame(false);
        else if (hasQueueTracks) setRetainQueueFrame(true);
    }, [loading, hasQueueTracks]);
    const showQueueFrame = hasQueueTracks || retainQueueFrame;
    const autoplayLoading = !!queue.autoplay?.enabled && !hasAutoplayTracks;
    const autoplayWasLoading = useRef(autoplayLoading);
    useIsoEffect(() => { autoplayWasLoading.current = autoplayLoading; }, [autoplayLoading]);
    const rows = [];
    let queueIndex = 0;
    let autoplayIndex = 0;
    order.forEach((row, i) => {
        if (row.kind === "boundary") {
            rows.push(
                <Reorder.Item key={row.key} value={row.key} as="div" drag={false} layout="position" transition={{ layout: { duration: SLIDE_DUR, ease: EASE } }} className="relative h-12 shrink-0">
                    <AutoplaySection />
                </Reorder.Item>
            );
            // The first recommendations are already opaque beneath this
            // outgoing surface. Only the placeholder fades, so receiving the
            // result cannot dim the list or replay each row's entrance.
            if (autoplayLoading) rows.push(
                <motion.div key="autoplay-loading" initial={false} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.2, ease: EASE }} className="pointer-events-none relative z-10 w-full bg-surface">
                    <TrackListSkeleton rows={3} dense={dense} label="Finding autoplay recommendations" />
                </motion.div>
            );
            if (!queue.autoplay?.enabled) rows.push(
                <motion.p key="autoplay-hint" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.18, ease: EASE }} className="px-2 pb-2 text-xs text-subtext">
                    Keep the music going with songs picked for your queue.
                </motion.p>
            );
            return;
        }
        if (dense && currentIndex >= 0 && i === currentIndex) {
            rows.push(
                <SectionHeader key="hdr-now" id="hdr-now" innerRef={nowPlayingRef} padTop="pt-5">
                    Now playing
                </SectionHeader>
            );
        } else if (dense && currentIndex >= 0 && i === currentIndex + 1 && i < boundary) {
            rows.push(<SectionHeader key="hdr-next" id="hdr-next">Next from: Queue</SectionHeader>);
        }
        rows.push(
            <QueueItem
                key={row.key}
                value={row.key}
                track={row.track}
                index={row.kind === "queue" ? queueIndex++ : autoplayIndex++}
                isCurrent={isCurrent(row)}
                raised={row.key === raisedRow}
                dense={dense}
                autoplay={row.kind === "autoplay"}
                reveal={row.kind !== "autoplay" || !autoplayWasLoading.current}
                onDragStart={handleDragStart}
                onDragEnd={handleDragEnd}
            />
        );
    });

    return (
        <LoadingSwap loading={loading} fallback={<QueueSkeleton dense={dense} />}>
            {!selected ? <EmptyState icon="connect" title="No server selected" hint="Pick a server to see its queue." /> : <div className="queue-track-list flex flex-col">
                <AnimatePresence initial={false}>
                    {!showQueueFrame && <motion.div key="empty" initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: "auto" }} exit={{ opacity: 0, height: 0 }} transition={{ duration: 0.2, ease: EASE }} className="overflow-hidden">
                        <EmptyState icon="queue" title="The queue is empty" hint="Add a song from search, or drag a recommendation into your queue." />
                    </motion.div>}
                </AnimatePresence>
                {!dense && showQueueFrame && <TrackTableHeader meta="Added by" />}
                <Reorder.Group ref={listRef} as="div" axis="y" values={order.map((row) => row.key)} onReorder={handleReorder} className="relative isolate flex flex-col">
                    <AnimatePresence initial={false} mode="popLayout" onExitComplete={() => { if (!hasQueueTracks) setRetainQueueFrame(false); }}>{rows}</AnimatePresence>
                </Reorder.Group>
                {/* Room below so even the last track can sit at the very top. */}
                {dense && showQueueFrame && <div className="h-[80vh] shrink-0" aria-hidden />}
            </div>}
        </LoadingSwap>
    );
}
