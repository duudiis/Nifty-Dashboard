import { Fragment, useEffect, useRef, useState } from "react";

import QueueItem from "./QueueItem.js";
import { useNifty } from "../../context/NiftyContext.js";
import Icon from "../Icon.js";
import { Reorder } from "../motion/index.js";

const keyOf = (t) => `${t.track_id}-${t.songUrl}`;
const listKey = (arr) => arr.map(keyOf).join("|");

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

function SectionLabel({ children }) {
    return <div className="px-2 pb-1 pt-4 text-sm font-bold text-maintext">{children}</div>;
}

export default function QueueList({ dense = false }) {
    const { queue, selected, moveTrack } = useNifty();
    const tracks = queue.tracks || [];
    const position = queue.position ?? 0;

    // Local, reorderable copy of the queue. Re-synced from the bot whenever it
    // pushes a different list — but never while a drag is in progress.
    const [order, setOrder] = useState(tracks);
    const draggingRef = useRef(false);
    const tracksKey = listKey(tracks);
    useEffect(() => {
        if (!draggingRef.current) setOrder(tracks);
    }, [tracksKey]); // eslint-disable-line react-hooks/exhaustive-deps

    const onDragStart = () => { draggingRef.current = true; };
    // The dragged track is now at some index in `order`; tell the bot to move it
    // there (track_id is its old/authoritative index). The bot echo re-syncs us.
    const commit = (track) => {
        draggingRef.current = false;
        const to = order.findIndex((t) => keyOf(t) === keyOf(track));
        if (to >= 0 && to !== track.track_id) moveTrack(track.track_id, to);
    };

    if (!selected) {
        return <EmptyState icon="connect" title="No server selected" hint="Pick a server to see its queue." />;
    }
    if (tracks.length === 0) {
        return <EmptyState icon="queue" title="The queue is empty" hint="Search above to add a track and get the party started." />;
    }

    if (dense) {
        let nextLabelShown = false;
        return (
            <Reorder.Group as="div" axis="y" values={order} onReorder={setOrder} className="flex flex-col gap-0.5 pb-4">
                {order.map((track) => {
                    const isCurrent = track.track_id === position;
                    let label = null;
                    if (isCurrent) {
                        label = "Now playing";
                    } else if (track.track_id > position && !nextLabelShown) {
                        label = "Next from: Queue";
                        nextLabelShown = true;
                    }
                    return (
                        <Fragment key={keyOf(track)}>
                            {label && <SectionLabel>{label}</SectionLabel>}
                            <QueueItem
                                track={track}
                                isCurrent={isCurrent}
                                dense
                                onDragStart={onDragStart}
                                onDragEnd={() => commit(track)}
                            />
                        </Fragment>
                    );
                })}
            </Reorder.Group>
        );
    }

    return (
        <div className="flex flex-col gap-1">
            <ColumnHeader />
            <Reorder.Group as="div" axis="y" values={order} onReorder={setOrder} className="flex flex-col gap-1">
                {order.map((track, i) => (
                    <QueueItem
                        key={keyOf(track)}
                        track={track}
                        number={i + 1}
                        isCurrent={track.track_id === position}
                        dense={false}
                        onDragStart={onDragStart}
                        onDragEnd={() => commit(track)}
                    />
                ))}
            </Reorder.Group>
        </div>
    );
}
