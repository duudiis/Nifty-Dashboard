import { humanDuration } from "../../../lib/format.js";
import { Stagger, StaggerItem } from "../../motion/index.js";
import Icon from "../../Icon.js";
import Section from "../Section.js";
import { StatTile } from "../pieces.js";

// The five numbers worth a glance before the shelves start.
export default function PulseStrip({ home, loading, onRefresh }) {
    const totals = home?.totals || {};
    const plays = totals.plays || 0;
    const week = totals.week_ms || 0;
    const prev = totals.prev_week_ms || 0;

    // A week with no plays behind it has nothing to compare against, and a
    // percentage off zero is either infinity or a lie.
    const delta = prev > 0 ? ((week - prev) / prev) * 100 : null;

    // FirstRun owns the nothing-yet case; five zeroes above it would only
    // repeat, in a colder voice, what that section already says warmly.
    if (plays === 0 && !loading) return null;

    const refresh = (
        <button
            onClick={onRefresh}
            title="Refresh"
            className="flex h-8 w-8 items-center justify-center rounded-full text-subtext transition hover:bg-elevated hover:text-maintext"
        >
            <Icon name="sync" className={`h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        </button>
    );

    const tiles = [
        {
            label: "Listened",
            value: humanDuration(week),
            delta,
            hint: prev > 0 ? `${humanDuration(prev)} the week before` : undefined
        },
        { label: "Tracks played", value: plays.toLocaleString() },
        { label: "Different tracks", value: (totals.distinct_tracks || 0).toLocaleString() },
        { label: "Sessions", value: (totals.sessions || 0).toLocaleString() },
        { label: "All time", value: humanDuration(totals.all_ms || 0) }
    ];

    return (
        <Section id="pulse" title="This week" loading={loading} minHeight={140} actions={refresh}>
            <Stagger className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5" gap={0.03}>
                {tiles.map((t) => (
                    // grid, not block: StatTile is a button and would otherwise
                    // shrink to its own text, leaving five ragged boxes. As a
                    // lone grid child it fills the cell in both directions, so
                    // the tile with a delta line doesn't stand taller.
                    <StaggerItem key={t.label} className="grid">
                        <StatTile label={t.label} value={t.value} delta={t.delta ?? null} hint={t.hint} />
                    </StaggerItem>
                ))}
            </Stagger>
        </Section>
    );
}
