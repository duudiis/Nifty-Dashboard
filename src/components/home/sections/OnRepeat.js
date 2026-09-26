import { useState } from "react";

import { useNifty } from "../../../context/NiftyContext.js";
import { humanDuration } from "../../../lib/format.js";
import TrackRow from "../../browse/TrackRow.js";
import { useBulkQueue } from "../../browse/useEntityActions.js";
import Icon from "../../Icon.js";
import { Stagger, StaggerItem } from "../../motion/index.js";
import Section, { Empty } from "../Section.js";

// Two windows onto the same habit. The empty lines differ because a quiet
// month means something different from a quiet account.
const TABS = [
    { id: "30", label: "Last 30 days", empty: "Play something twice in a month and it lands here." },
    { id: "all", label: "All time", empty: "Nothing has come back around a second time yet." }
];

/**
 * The songs that keep coming back, with the count that makes the claim.
 *
 * Both windows ship in the one /api/home payload, so the toggle is local state
 * and nothing else — switching tabs must never refetch or wash. The play count
 * rides in the badge column rather than on the right, because the right-hand
 * slot is where a duration lives everywhere else in the app and "14" sitting
 * there reads as a running time.
 */
export default function OnRepeat({ home, loading }) {
    const { selected } = useNifty();
    const bulkQueue = useBulkQueue();
    const [picked, setPicked] = useState(null);

    const rows30 = home?.onRepeat30 || [];
    const rowsAll = home?.onRepeatAll || [];

    // One repeat is not a habit, so the month tab treats a single row as none.
    const month = rows30.length >= 2 ? rows30 : [];

    // Derived, not an effect: `home` lands after mount, so a default chosen at
    // mount would always be the empty one. The moment the user picks a tab,
    // their choice wins and the payload stops moving it.
    const tab = picked || (month.length === 0 && rowsAll.length > 0 ? "all" : "30");
    const active = TABS.find((t) => t.id === tab) || TABS[0];
    const rows = tab === "30" ? month : rowsAll;

    const chips = (
        <div className="flex flex-wrap items-center gap-1.5">
            {TABS.map((t) => (
                <button
                    key={t.id}
                    onClick={() => setPicked(t.id)}
                    className={`rounded-full px-3 py-1 text-xs font-bold transition ${
                        tab === t.id ? "bg-maintext text-canvas" : "bg-elevated text-subtext hover:text-maintext"
                    }`}
                >
                    {t.label}
                </button>
            ))}
        </div>
    );

    const actions = (
        <>
            {chips}
            {/* No button over an empty list: "Queue 0 tracks" is a control that
                cannot do anything, and the empty line already says why. */}
            {rows.length > 0 && (
                <button
                    onClick={() => bulkQueue(rows)}
                    disabled={!selected}
                    title={selected ? "Add all of these to the queue" : "Select a server first"}
                    className="flex items-center gap-2 rounded-full bg-accent px-5 py-2 text-sm font-bold text-canvas transition hover:brightness-110 disabled:opacity-40"
                >
                    <Icon name="enqueue" className="h-4 w-4" />
                    Queue {rows.length} track{rows.length === 1 ? "" : "s"}
                </button>
            )}
        </>
    );

    return (
        <Section
            id="on-repeat"
            title="On repeat"
            subtitle="What you actually keep playing"
            loading={loading}
            minHeight={340}
            actions={actions}
        >
            {rows.length === 0 ? (
                <Empty>{active.empty}</Empty>
            ) : (
                <Stagger className="grid gap-x-6 lg:grid-cols-2" gap={0.03}>
                    {rows.map((t, i) => (
                        // Keyed by tab as well: the same song sits in both lists
                        // at different indices, and a reused row would carry the
                        // other window's play count across the switch.
                        <StaggerItem key={`${tab}:${t.url || t.playQuery || i}`}>
                            <TrackRow
                                track={t}
                                badge={<span className="text-[11px] font-bold text-maintext">{t.plays || 0}</span>}
                                meta={humanDuration(t.ms || 0)}
                            />
                        </StaggerItem>
                    ))}
                </Stagger>
            )}
        </Section>
    );
}
