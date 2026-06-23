import { useEffect, useRef } from "react";

import QueueItem from "./QueueItem.js";
import { useNifty } from "../../context/NiftyContext.js";
import Icon from "../Icon.js";

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
function SectionHeader({ children }) {
    return <div className="px-2 pb-2 pt-5 text-[13px] font-bold text-maintext">{children}</div>;
}

export default function QueueList({ dense = false }) {
    const { queue, player, selected } = useNifty();
    const tracks = queue.tracks || [];
    const position = queue.position ?? 0;

    // The cursor is purely the bot's position index (unique per row, so repeated
    // tracks don't all light up) — and only while something is actually loaded.
    // A stopped player (no track) marks nothing.
    const currentIndex = player?.track ? position : -1;
    const isCurrent = (track) => currentIndex >= 0 && track.track_id === currentIndex;

    // dense sidebar: keep the now-playing section pinned near the top
    const currentRef = useRef(null);
    useEffect(() => {
        if (dense && currentRef.current) {
            currentRef.current.scrollIntoView({ block: "start", behavior: "smooth" });
        }
    }, [dense, currentIndex]);

    if (!selected) {
        return <EmptyState icon="connect" title="No server selected" hint="Pick a server to see its queue." />;
    }

    if (tracks.length === 0) {
        return <EmptyState icon="queue" title="The queue is empty" hint="Search above to add a track and get the party started." />;
    }

    const item = (track) => (
        <QueueItem
            key={`${track.track_id}-${track.songUrl}`}
            track={track}
            index={track.track_id}
            isCurrent={isCurrent(track)}
            dense={dense}
        />
    );

    // Main queue page: flat table.
    if (!dense) {
        return (
            <div className="flex flex-col gap-1">
                <ColumnHeader />
                {tracks.map(item)}
            </div>
        );
    }

    // Dense sidebar: previous tracks above, then "Now playing", then the rest.
    const hasCurrent = currentIndex >= 0 && currentIndex < tracks.length;
    const previous = hasCurrent ? tracks.slice(0, currentIndex) : [];
    const current = hasCurrent ? tracks[currentIndex] : null;
    const upcoming = hasCurrent ? tracks.slice(currentIndex + 1) : tracks;

    return (
        <div className="flex flex-col gap-0.5">
            {previous.map(item)}

            {current && (
                <div ref={currentRef} className="flex scroll-mt-20 flex-col gap-0.5">
                    <SectionHeader>Now playing</SectionHeader>
                    {item(current)}
                </div>
            )}

            {upcoming.length > 0 && (
                <>
                    <SectionHeader>Next from: Queue</SectionHeader>
                    {upcoming.map(item)}
                </>
            )}

            {/* room below so even the last track can sit at the very top */}
            <div className="h-[80vh] shrink-0" aria-hidden />
        </div>
    );
}
