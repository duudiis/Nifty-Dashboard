import { useEffect, useRef, useState } from "react";
import { Reorder, AnimatePresence } from "framer-motion";

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

function SectionLabel({ children }) {
    return (
        <div className="px-2 pb-1 pt-3 text-[11px] font-bold uppercase tracking-wide text-subtext/80">{children}</div>
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
    const { queue, player, selected, moveTrack } = useNifty();
    const tracks = queue.tracks || [];

    // The cursor is the bot's authoritative `position` index — no guessing. The
    // track at that index is the canonical current one; every copy of its song
    // (duplicates in the queue) is highlighted, and on stop the position stays
    // put so the last track keeps showing as current.
    const position = typeof queue.position === "number" ? queue.position : 0;
    const currentTrack = tracks.find((t) => t.track_id === position) || null;
    const currentSongUrl = currentTrack?.songUrl;
    const accentOf = (t) => !!currentSongUrl && t.songUrl === currentSongUrl;
    const playing = !!player?.playing;

    const previous = tracks.filter((t) => t.track_id < position);
    const upcoming = tracks.filter((t) => t.track_id > position);

    // Local copy of the upcoming list so drag-reorder feels instant; it resyncs
    // whenever the server pushes a changed queue.
    const [order, setOrder] = useState(upcoming);
    const sig = upcoming.map((t) => `${t.track_id}:${t.songUrl}`).join("|");
    useEffect(() => { setOrder(upcoming); }, [sig]); // eslint-disable-line react-hooks/exhaustive-deps
    const orderRef = useRef(order);
    orderRef.current = order;

    const onDrop = (track) => {
        const i = orderRef.current.findIndex((t) => t === track);
        if (i < 0) return;
        const toAbsolute = position + 1 + i; // upcoming starts right after the cursor
        if (toAbsolute !== track.track_id) moveTrack(track.track_id, toAbsolute);
    };

    // Keep the playing track pinned to the top of the dense sidebar.
    const currentRef = useRef(null);
    const currentKey = currentTrack ? `${currentTrack.track_id}-${currentTrack.songUrl}` : null;
    useEffect(() => {
        if (dense && currentRef.current) {
            currentRef.current.scrollIntoView({ block: "start", behavior: "smooth" });
        }
    }, [dense, currentKey]);

    if (!selected) {
        return <EmptyState icon="connect" title="No server selected" hint="Pick a server to see its queue." />;
    }
    if (tracks.length === 0) {
        return <EmptyState icon="queue" title="The queue is empty" hint="Search above to add a track and get the party started." />;
    }

    const staticRow = (t) => (
        <QueueItem
            key={`${t.track_id}-${t.songUrl}`}
            innerRef={t === currentTrack ? currentRef : undefined}
            track={t}
            number={t.track_id + 1}
            accent={accentOf(t)}
            playing={accentOf(t) && playing}
            dense={dense}
        />
    );

    const gap = dense ? "gap-0.5" : "gap-1";

    return (
        <div className={`flex flex-col ${gap}`}>
            {!dense && <ColumnHeader />}

            {/* already-played tracks stay above */}
            <AnimatePresence initial={false}>{previous.map(staticRow)}</AnimatePresence>

            {/* now playing */}
            {currentTrack && (
                <>
                    {dense && <SectionLabel>Now playing</SectionLabel>}
                    <AnimatePresence initial={false}>{staticRow(currentTrack)}</AnimatePresence>
                </>
            )}

            {/* upcoming — draggable */}
            {order.length > 0 && (
                <>
                    {dense && <SectionLabel>Next from: Queue</SectionLabel>}
                    <Reorder.Group as="div" axis="y" values={order} onReorder={setOrder} className={`flex flex-col ${gap}`}>
                        <AnimatePresence initial={false}>
                            {order.map((t) => (
                                <QueueItem
                                    key={`${t.songUrl}-${t.track_id}`}
                                    track={t}
                                    number={t.track_id + 1}
                                    accent={accentOf(t)}
                                    playing={accentOf(t) && playing}
                                    dense={dense}
                                    draggable
                                    onDrop={onDrop}
                                />
                            ))}
                        </AnimatePresence>
                    </Reorder.Group>
                </>
            )}

            {/* room below so even the last track can sit at the very top */}
            {dense && <div className="h-[80vh] shrink-0" aria-hidden />}
        </div>
    );
}
