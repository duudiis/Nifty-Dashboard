import { useEffect, useRef } from "react";

import QueueItem from "./QueueItem.js";
import { useNifty } from "../../context/NiftyContext.js";
import Icon from "../Icon.js";
import { AnimatePresence, motion, EASE } from "../motion/index.js";

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
        className={`scroll-mt-16 px-2 pb-2 ${padTop} text-[13px] font-bold text-maintext`}
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

    // dense sidebar: smoothly bring the "Now playing" header to the top. Only
    // fires on a real cursor move and is deferred a frame so the section
    // reshape has laid out before the smooth scroll starts.
    const nowPlayingRef = useRef(null);
    const lastScrolledIndex = useRef(-1);
    useEffect(() => {
        if (!dense || currentIndex < 0) return;
        if (lastScrolledIndex.current === currentIndex) return;
        lastScrolledIndex.current = currentIndex;
        const id = requestAnimationFrame(() => {
            nowPlayingRef.current?.scrollIntoView({ block: "start", behavior: "smooth" });
        });
        return () => cancelAnimationFrame(id);
    }, [dense, currentIndex]);

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
    // `layout` so tracks slide smoothly when the cursor moves (and headers
    // appear/disappear between them).
    const hasCurrent = currentIndex >= 0 && currentIndex < tracks.length;
    const motionItem = (track) => (
        <motion.div
            key={`t-${track.track_id}-${track.songUrl}`}
            layout="position"
            transition={{ duration: 0.32, ease: EASE }}
        >
            <QueueItem track={track} index={track.track_id} isCurrent={isCurrent(track)} dense />
        </motion.div>
    );

    const rows = [];
    tracks.forEach((track, i) => {
        if (hasCurrent && i === currentIndex) {
            // tighter top padding when "Now playing" is the very first row
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
            rows.push(
                <SectionHeader key="hdr-next" id="hdr-next">Next from: Queue</SectionHeader>
            );
        }
        rows.push(motionItem(track));
    });

    return (
        <div className="flex flex-col gap-0.5">
            <AnimatePresence initial={false}>
                {rows}
            </AnimatePresence>
            {/* room below so even the last track can sit at the very top */}
            <div className="h-[80vh] shrink-0" aria-hidden />
        </div>
    );
}
