import { useEffect, useRef, useState } from "react";

import QueueItem from "./QueueItem.js";
import { useNifty } from "../../context/NiftyContext.js";
import Loader from "../Loader.js";
import { Reorder } from "../motion/index.js";

// The "Next from: Autoplay" queue section: the bot's rolling recommendation
// buffer. Rendered under the real queue on both the main queue page and the
// dense sidebar. The header carries the on/off switch; rows reorder by drag
// (autoplayMove), remove by trash (negative feedback), and promote into the
// real queue on click or via their context menu.
//
// When autoplay is off the section collapses to just the header + switch, so
// enabling it is always one click away from the queue.

function Switch({ on, onClick, title }) {
    return (
        <button
            onClick={onClick}
            title={title}
            role="switch"
            aria-checked={on}
            className={`relative h-4 w-7 shrink-0 rounded-full transition-colors ${on ? "bg-accent" : "bg-elevated"}`}
        >
            <span
                className={`absolute top-0.5 h-3 w-3 rounded-full bg-maintext shadow transition-all ${on ? "left-3.5" : "left-0.5"}`}
            />
        </button>
    );
}

// One shared empty list. `tracks` feeds the mirror effect below, so a fresh
// `[]` per render would re-fire it every render — an endless update loop that
// also starves the page transitions, freezing the centre view.
const NO_TRACKS = [];

export default function AutoplaySection({ dense = false }) {
    const { queue, toggleAutoplay, autoplayMove } = useNifty();

    const enabled = queue.autoplay?.enabled ?? false;
    const tracks = queue.autoplay?.tracks ?? NO_TRACKS;

    // Local drag-reorderable mirror of the buffer, same contract as the main
    // queue list: the bot owns the order, we only diverge mid-drag.
    const [order, setOrder] = useState(tracks);
    const orderRef = useRef(order);
    orderRef.current = order;
    const draggingRef = useRef(false);
    const draggedRef = useRef(null);
    const fromRef = useRef(-1);

    useEffect(() => {
        if (!draggingRef.current) setOrder(tracks);
    }, [tracks]);

    const handleDragStart = (track) => {
        draggingRef.current = true;
        draggedRef.current = track;
        fromRef.current = orderRef.current.findIndex((t) => t === track);
    };

    const handleDragEnd = () => {
        const track = draggedRef.current;
        draggingRef.current = false;
        draggedRef.current = null;
        if (!track) return;
        const from = fromRef.current;
        const to = orderRef.current.findIndex((t) => t === track);
        if (from >= 0 && to >= 0 && to !== from) autoplayMove(track.auto_id, to);
        // The bot echoes an a_full; the sync effect reconciles `order`.
    };

    const header = (
        <div className={`flex w-full items-center justify-between gap-3 px-2 pb-2 pt-5 ${dense ? "" : "mt-2"}`}>
            <span className="flex items-center gap-1.5 text-[13px] font-bold text-maintext">
                {enabled ? "Next from: Autoplay" : "Autoplay"}
            </span>
            <Switch
                on={enabled}
                onClick={toggleAutoplay}
                title={enabled ? "Turn off Autoplay" : "Turn on Autoplay"}
            />
        </div>
    );

    if (!enabled) {
        return (
            <div className="flex flex-col">
                {header}
                <p className="px-2 text-[11px] leading-relaxed text-subtext">
                    Keep the music going — Nifty lines up songs matching what everyone&apos;s been listening to.
                </p>
            </div>
        );
    }

    return (
        <div className="flex flex-col">
            {header}
            {order.length === 0 ? (
                <div className="flex items-center gap-2.5 px-2 py-1.5 text-[12px] text-subtext">
                    <Loader size="sm" delay={0} className="text-current" />
                    Finding recommendations…
                </div>
            ) : (
                <Reorder.Group as="div" axis="y" values={order} onReorder={setOrder} className="flex flex-col">
                    {order.map((track, i) => (
                        <QueueItem
                            key={track.auto_id}
                            track={track}
                            index={i}
                            isCurrent={false}
                            dense={dense}
                            autoplay
                            onDragStart={handleDragStart}
                            onDragEnd={handleDragEnd}
                        />
                    ))}
                </Reorder.Group>
            )}
        </div>
    );
}
