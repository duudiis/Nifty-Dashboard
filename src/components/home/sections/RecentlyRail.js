import { useState } from "react";

import { dayLabel } from "../../../lib/format.js";
import Tile from "../../browse/Tile.js";
import Rail from "../Rail.js";
import Section, { Empty } from "../Section.js";

// Two views of the same shelf. The empty line differs per tab because the way
// back from each is different: one is about listening, the other about adding.
const TABS = [
    { id: "heard", label: "Heard", empty: "Nothing heard through the bot yet." },
    { id: "queued", label: "Queued", empty: "Nothing queued yet — search up top and it shows up here." }
];

/**
 * The last handful of tracks, from either side of the bot.
 *
 * "Heard" is the half the app has been missing: every other recent surface
 * here lists what *you* queued, so on a shared bot everything a friend put on
 * passes through invisibly. This is where it shows up.
 *
 * The toggle is local state and nothing else — both arrays arrive in the one
 * /api/home payload, so switching tabs is free and must never refetch or wash.
 */
export default function RecentlyRail({ home, loading }) {
    const [tab, setTab] = useState("heard");

    const active = TABS.find((t) => t.id === tab) || TABS[0];
    const items = (tab === "heard" ? home?.recentHeard : home?.recentQueued) || [];

    const chips = (
        <div className="flex items-center gap-1.5">
            {TABS.map((t) => (
                <button
                    key={t.id}
                    onClick={() => setTab(t.id)}
                    className={`rounded-full px-3 py-1 text-xs font-bold transition ${
                        tab === t.id ? "bg-maintext text-canvas" : "bg-elevated text-subtext hover:text-maintext"
                    }`}
                >
                    {t.label}
                </button>
            ))}
        </div>
    );

    return (
        <Section id="recently" title="Recently" loading={loading} minHeight={260} actions={chips}>
            {items.length === 0 ? (
                <Empty>{active.empty}</Empty>
            ) : (
                <Rail itemClassName="w-[168px]">
                    {items.map((item, i) => (
                        // Keyed by tab as well as url: the same song can sit in
                        // both lists at different indices, and reusing its card
                        // across a switch would carry the wrong day label in.
                        <div key={`${tab}:${item.url || item.playQuery || i}`}>
                            <Tile item={item} />
                            {/* The day, not the clock time — at this size "Today"
                                answers the only question anyone asks of a
                                recents shelf, and it stays true all day. */}
                            <div className="truncate px-3 pb-1 text-[10px] text-subtext">
                                {dayLabel(item.heardAt || item.queuedAt)}
                            </div>
                        </div>
                    ))}
                </Rail>
            )}
        </Section>
    );
}
