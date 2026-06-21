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

export default function QueueList({ dense = false }) {
    const { queue, player, selected } = useNifty();
    const tracks = queue.tracks || [];

    // Cross-reference the player so the "now playing" highlight tracks playback
    // changes immediately, even before a fresh queue snapshot arrives.
    const current = player?.track;
    const isCurrent = (track) =>
        track.track_id === queue.position ||
        (current && ((current.songUrl && current.songUrl === track.songUrl) || current.track_id === track.track_id));

    const currentTrack = tracks.find(isCurrent);
    const currentId = currentTrack ? `${currentTrack.track_id}-${currentTrack.songUrl}` : null;

    // In the dense sidebar, keep the currently-playing track pinned to the top
    // (older tracks remain above — scroll up to see them).
    const currentRef = useRef(null);
    useEffect(() => {
        if (dense && currentRef.current) {
            currentRef.current.scrollIntoView({ block: "start", behavior: "smooth" });
        }
    }, [dense, currentId]);

    if (!selected) {
        return <EmptyState icon="connect" title="No server selected" hint="Pick a server to see its queue." />;
    }

    if (tracks.length === 0) {
        return <EmptyState icon="queue" title="The queue is empty" hint="Search above to add a track and get the party started." />;
    }

    return (
        <div className={`flex flex-col ${dense ? "gap-0.5" : "gap-1"}`}>
            {!dense && <ColumnHeader />}
            {tracks.map((track) => {
                const cur = isCurrent(track);
                return (
                    <QueueItem
                        key={`${track.track_id}-${track.songUrl}`}
                        innerRef={cur ? currentRef : undefined}
                        track={track}
                        index={track.track_id}
                        isCurrent={cur}
                        dense={dense}
                    />
                );
            })}
            {/* room below so even the last track can sit at the very top */}
            {dense && <div className="h-[80vh] shrink-0" aria-hidden />}
        </div>
    );
}
