import { useEffect, useRef } from "react";

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
        const id = requestAnimationFrame(() => {
            const header = nowPlayingRef.current;
            const scroller = header && findScroller(header);
            if (!header || !scroller) return;
            const target = Math.max(0, header.offsetTop - scroller.offsetTop - SCROLL_OFFSET);
            if (isFirst) { scroller.scrollTop = target; return; }
            const controls = animate(scroller.scrollTop, target, {
                duration: SLIDE_DUR,
                ease: EASE,
                onUpdate: (v) => { scroller.scrollTop = v; }
            });
            return () => controls.stop?.();
        });
        return () => cancelAnimationFrame(id);
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
    // Keys are by songUrl (with a per-song occurrence counter so duplicates
    // don't collide). Critically NOT by track_id, which is just the index and
    // shifts for every track behind a removal — that would churn keys and
    // unmount everything below the removed row.
    const occurrences = new Map();

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

        const n = occurrences.get(track.songUrl) || 0;
        occurrences.set(track.songUrl, n + 1);
        rows.push(
            <motion.div
                key={`t-${track.songUrl}-${n}`}
                layout="position"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
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
