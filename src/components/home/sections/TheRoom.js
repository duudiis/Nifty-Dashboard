import { Stagger, StaggerItem } from "../../motion/index.js";
import Section, { Empty } from "../Section.js";
import { Avatar, PeopleRow } from "../pieces.js";

/**
 * Who has been picking the music, ranked by how much of it was theirs.
 *
 * The bars carry the claim, not the counts: "four of us queued this week and
 * half of it was Sam" is a fact about the room that no number on its own says.
 *
 * Which is exactly why one queuer gets a sentence instead. A lone bar is
 * always full, so it measures nothing — it would only dress up "you were the
 * only one here" as a chart.
 */
export default function TheRoom({ home, loading }) {
    const rows = (home?.leaders || []).slice(0, 5);

    // The leader sets the scale, and the floor of 1 keeps a week of zeroes from
    // dividing by nothing.
    const top = Math.max(1, ...rows.map((p) => p.queues || 0));
    const solo = rows.length === 1 ? rows[0] : null;
    const soloQueues = solo ? solo.queues || 0 : 0;

    return (
        <Section
            id="the-room"
            title="Who's running the aux"
            subtitle="Last seven days"
            loading={loading}
            minHeight={280}
        >
            {rows.length === 0 ? (
                <Empty>Nobody&apos;s queued anything this week.</Empty>
            ) : solo ? (
                <div className="flex items-center gap-3 rounded-xl bg-elevated/40 p-2">
                    <Avatar src={solo.avatar} name={solo.name} className="h-9 w-9" />
                    <p className="min-w-0 text-[13px] text-subtext">
                        <span className={`font-bold ${solo.isYou ? "text-accent" : "text-maintext"}`}>
                            {solo.name || "Someone"}
                        </span>
                        {" has been carrying the aux this week — "}
                        {soloQueues} track{soloQueues === 1 ? "" : "s"}.
                    </p>
                </div>
            ) : (
                <Stagger className="rounded-xl bg-elevated/40 p-2" gap={0.03}>
                    {rows.map((p, i) => (
                        <StaggerItem key={p.id || i}>
                            <PeopleRow
                                person={{ name: p.name || "Someone", avatar: p.avatar, isYou: p.isYou }}
                                rank={i + 1}
                                fraction={(p.queues || 0) / top}
                                meta={
                                    <span className="flex flex-col items-end gap-0.5 leading-tight">
                                        <span className="font-bold text-maintext">{p.queues || 0} queued</span>
                                        {/* Last pick is the colour, not the point:
                                            it goes when the row gets narrow enough
                                            that it would crowd the bar. */}
                                        {p.lastTitle && (
                                            <span className="hidden max-w-[180px] truncate sm:block">{p.lastTitle}</span>
                                        )}
                                    </span>
                                }
                            />
                        </StaggerItem>
                    ))}
                </Stagger>
            )}
        </Section>
    );
}
