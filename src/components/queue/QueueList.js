import { useEffect, useMemo, useRef } from "react";

import QueueItem from "./QueueItem.js";
import { useNifty } from "../../context/NiftyContext.js";
import Icon from "../Icon.js";
import { AnimatePresence, animate, motion, EASE } from "../motion/index.js";

// Row slide duration (kept in sync with the scroll animation below).
const SLIDE_DUR = 0.32;
// Pixels above the "Now playing" header reserved when auto-scrolling, so the
// previous track sits comfortably tucked away under the sticky panel header.
const SCROLL_OFFSET = 8;

// Walk up to the nearest scrollable ancestor of `node`.
function findScroller(node) {
    let p = node?.parentElement;
    while (p) {
        const oy = getComputedStyle(p).overflowY;
        if (oy === "auto" || oy === "scroll") return p;
        p = p.parentElement;
    }
    return null;
}

function ColumnHeader() {
    return (
        <div className="flex w-full items-center gap-3 border-b border-border/60 px-2 pb-2 text-[10px] font-bold uppercase tracking-wide text-subtext">
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

// Spotify-style section label: white, normal case.
// Animated section header (fades in/out and slides into position).
const SectionHeader = ({ children, innerRef, padTop = "pt-5", id }) => (
    <motion.div
        layout="position"
        ref={innerRef}
        key={id}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.22, ease: EASE }}
        className={`px-2 pb-2 ${padTop} text-[13px] font-bold text-maintext`}
    >
        {children}
    </motion.div>
);

export default function QueueList({ dense = false }) {
    const { queue, player, selected } = useNifty();
    const tracks = queue.tracks || [];
    const position = queue.position ?? 0;

    // Stable per-row instance IDs that survive a single removal/insertion —
    // including with duplicate songs in the queue (where a songUrl-based key
    // would otherwise fade the wrong copy). Falls back to fresh IDs for any
    // shape change we can't trivially diff.
    const instancesRef = useRef([]);
    const nextIdRef = useRef(0);
    const instances = useMemo(() => {
        const old = instancesRef.current;
        const sameShape =
            old.length === tracks.length &&
            old.every((inst, i) => inst.songUrl === tracks[i].songUrl);
        if (sameShape) return old;
        // Single removal: find the diverging slot and drop just that instance.
        if (old.length === tracks.length + 1) {
            let p = old.length - 1;
            for (let i = 0; i < tracks.length; i++) {
                if (old[i].songUrl !== tracks[i].songUrl) { p = i; break; }
            }
            let ok = true;
            for (let i = p; i < tracks.length; i++) {
                if (old[i + 1]?.songUrl !== tracks[i].songUrl) { ok = false; break; }
            }
            if (ok) {
                const next = [...old.slice(0, p), ...old.slice(p + 1)];
                instancesRef.current = next;
                return next;
            }
        }
        // Single insertion: splice in a fresh instance at the diverging slot.
        if (old.length === tracks.length - 1) {
            let p = old.length;
            for (let i = 0; i < old.length; i++) {
                if (old[i].songUrl !== tracks[i].songUrl) { p = i; break; }
            }
            let ok = true;
            for (let i = p; i < old.length; i++) {
                if (old[i].songUrl !== tracks[i + 1].songUrl) { ok = false; break; }
            }
            if (ok) {
                const next = [
                    ...old.slice(0, p),
                    { id: ++nextIdRef.current, songUrl: tracks[p].songUrl },
                    ...old.slice(p)
                ];
                instancesRef.current = next;
                return next;
            }
        }
        // Fallback: regenerate (no animation continuity for this change).
        const next = tracks.map((t) => ({ id: ++nextIdRef.current, songUrl: t.songUrl }));
        instancesRef.current = next;
        return next;
    }, [tracks]);

    // The cursor is purely the bot's position index (unique per row, so repeated
    // tracks don't all light up) — and only while something is actually loaded.
    // A stopped player (no track) marks nothing.
    const currentIndex = player?.track ? position : -1;
    const isCurrent = (track) => currentIndex >= 0 && track.track_id === currentIndex;

    // dense sidebar: bring "Now playing" to the top of the panel. Only fires
    // when the actually-playing song changes (not when reindexing happens —
    // e.g. a track is removed before the cursor — which would cause a big
    // unrelated jump). And we wait until the queue's `position` has caught up
    // with the player's song before measuring, so we don't animate to the OLD
    // header position (player + queue WS arrive in two separate updates).
    const nowPlayingRef = useRef(null);
    const lastScrolledSongRef = useRef(null);
    const playingSongUrl = player?.track?.songUrl || null;
    const layoutSong = tracks[currentIndex]?.songUrl || null;
    const layoutSettled = !!playingSongUrl && playingSongUrl === layoutSong;
    useEffect(() => {
        if (!dense) return;
        if (!playingSongUrl) { lastScrolledSongRef.current = null; return; }
        if (!layoutSettled) return;
        if (lastScrolledSongRef.current === playingSongUrl) return;
        const isFirst = lastScrolledSongRef.current === null;
        lastScrolledSongRef.current = playingSongUrl;
        let controls = null;
        const id = requestAnimationFrame(() => {
            const header = nowPlayingRef.current;
            const scroller = header && findScroller(header);
            if (!header || !scroller) return;
            const target = Math.max(0, header.offsetTop - scroller.offsetTop - SCROLL_OFFSET);
            if (isFirst) { scroller.scrollTop = target; return; }
            controls = animate(scroller.scrollTop, target, {
                duration: SLIDE_DUR,
                ease: EASE,
                onUpdate: (v) => { scroller.scrollTop = v; }
            });
        });
        // Cancel both the pending rAF and any in-flight scroll animation, so a
        // rapid sequence of song changes can't leave two scrolls racing.
        return () => {
            cancelAnimationFrame(id);
            controls?.stop?.();
        };
    }, [dense, playingSongUrl, layoutSettled]);

    if (!selected) {
        return <EmptyState icon="connect" title="No server selected" hint="Pick a server to see its queue." />;
    }

    if (tracks.length === 0) {
        return <EmptyState icon="queue" title="The queue is empty" hint="Search above to add a track and get the party started." />;
    }

    const plainItem = (track) => (
        <QueueItem
            key={`${track.track_id}-${track.songUrl}`}
            track={track}
            index={track.track_id}
            isCurrent={isCurrent(track)}
            dense={dense}
        />
    );

    // Main queue page: flat table, no motion.
    if (!dense) {
        return (
            <div className="flex flex-col gap-1">
                <ColumnHeader />
                {tracks.map(plainItem)}
            </div>
        );
    }

    // Dense sidebar: one flat sibling list. Each row is a motion.div with
    // `layout` so tracks slide smoothly when the cursor moves; removed tracks
    // fade out via AnimatePresence (mode="popLayout" lets other rows slide
    // into the gap while the removed one finishes its fade).
    const hasCurrent = currentIndex >= 0 && currentIndex < tracks.length;

    const rows = [];
    tracks.forEach((track, i) => {
        if (hasCurrent && i === currentIndex) {
            rows.push(
                <SectionHeader
                    key="hdr-now"
                    id="hdr-now"
                    innerRef={nowPlayingRef}
                    padTop={i === 0 ? "pt-1" : "pt-5"}
                >
                    Now playing
                </SectionHeader>
            );
        } else if (hasCurrent && i === currentIndex + 1) {
            rows.push(<SectionHeader key="hdr-next" id="hdr-next">Next from: Queue</SectionHeader>);
        }

        rows.push(
            <motion.div
                key={`t-${instances[i].id}`}
                layout="position"
                // Only animate on exit (fade out on removal). No initial/animate
                // so per-second player ticks don't re-trigger a fade-in on the
                // existing rows — that's what was causing the flicker.
                exit={{ opacity: 0 }}
                transition={{ duration: SLIDE_DUR, ease: EASE }}
            >
                <QueueItem track={track} index={track.track_id} isCurrent={isCurrent(track)} dense />
            </motion.div>
        );
    });

    return (
        <div className="flex flex-col gap-0.5">
            <AnimatePresence mode="popLayout" initial={false}>
                {rows}
            </AnimatePresence>
            {/* room below so even the last track can sit at the very top */}
            <div className="h-[80vh] shrink-0" aria-hidden />
        </div>
    );
}
