import { useEffect, useState } from "react";

import QueueItem from "./QueueItem.js";
import { useNifty } from "../../context/NiftyContext.js";
import Icon from "../Icon.js";
import { Reorder, AnimatePresence } from "../motion/index.js";

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

export default function QueueList({ dense = false }) {
    const { queue, selected, moveTrack } = useNifty();
    const tracks = queue.tracks || [];
    const position = queue.position ?? 0;

    // Local, reorderable copy of the queue. Re-synced whenever the bot pushes a
    // different list (after a move/remove commits, or playback advances).
    const [order, setOrder] = useState(tracks);
    const tracksKey = listKey(tracks);
    useEffect(() => { setOrder(tracks); }, [tracksKey]); // eslint-disable-line react-hooks/exhaustive-deps

    // The cursor is authoritative: exactly the track at queue.position is current
    // (so repeated tracks don't all light up, and the last track stays current
    // when the bot stops).
    const isCurrent = (t) => t.track_id === position;

    // A dragged track ended at its index within `arr`; map that to an absolute
    // queue index and ask the bot to move it (no-op if it didn't actually move).
    const commit = (track, arr, base = 0) => {
        const to = base + arr.findIndex((t) => keyOf(t) === keyOf(track));
        if (to >= 0 && to !== track.track_id) moveTrack(track.track_id, to);
    };

    if (!selected) {
        return <EmptyState icon="connect" title="No server selected" hint="Pick a server to see its queue." />;
    }
    if (tracks.length === 0) {
        return <EmptyState icon="queue" title="The queue is empty" hint="Search above to add a track and get the party started." />;
    }

    if (dense) {
        const current = tracks.find(isCurrent) || null;
        const upOrder = order.filter((t) => t.track_id > position);
        const setUpOrder = (next) => {
            const others = order.filter((t) => t.track_id <= position);
            setOrder([...others, ...next]);
        };

        return (
            <div className="flex flex-col pb-4">
                {current && (
                    <>
                        <div className="px-2 pb-1 pt-2 text-[11px] font-bold uppercase tracking-wide text-subtext">Now playing</div>
                        <QueueItem track={current} isCurrent dense draggable={false} />
                    </>
                )}

                {upOrder.length > 0 && (
                    <>
                        <div className="px-2 pb-1 pt-5 leading-tight">
                            <div className="text-[11px] text-subtext">Next from</div>
                            <div className="text-sm font-bold text-maintext">Queue</div>
                        </div>
                        <Reorder.Group as="div" axis="y" values={upOrder} onReorder={setUpOrder} className="flex flex-col gap-0.5">
                            <AnimatePresence mode="popLayout" initial={false}>
                                {upOrder.map((track) => (
                                    <QueueItem
                                        key={keyOf(track)}
                                        track={track}
                                        isCurrent={false}
                                        dense
                                        onDragEnd={() => commit(track, upOrder, position + 1)}
                                    />
                                ))}
                            </AnimatePresence>
                        </Reorder.Group>
                    </>
                )}
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-1">
            <ColumnHeader />
            <Reorder.Group as="div" axis="y" values={order} onReorder={setOrder} className="flex flex-col gap-1">
                <AnimatePresence mode="popLayout" initial={false}>
                    {order.map((track) => (
                        <QueueItem
                            key={keyOf(track)}
                            track={track}
                            number={track.track_id + 1}
                            isCurrent={isCurrent(track)}
                            dense={false}
                            onDragEnd={() => commit(track, order, 0)}
                        />
                    ))}
                </AnimatePresence>
            </Reorder.Group>
        </div>
    );
}
