import { humanDuration } from "../../../lib/format.js";
import Section from "../Section.js";

const WEEKS = 13;
const SPAN = WEEKS * 7;

// Four marks is all a 24-bar axis can carry without the labels colliding.
const HOUR_MARKS = [0, 6, 12, 18];

// None, then three steps of the accent. Written out rather than built, because
// Tailwind only ships the classes it can find as whole strings in the source.
const TONE = ["bg-elevated", "bg-accent/30", "bg-accent/60", "bg-accent"];

// Neither half is worth drawing from a handful of points: eight lit hours is
// where the clock stops being three spikes and starts being a shape, and ten
// lit days is where the grid stops being a scatter of dots.
const MIN_HOURS = 8;
const MIN_DAYS = 10;

// Locale-aware, the same way format.js reads clock times — a 24-hour region
// should see "20", not "8 PM". The date is arbitrary; only the hour is shown.
function hourLabel(hour) {
    return new Date(2000, 0, 1, hour).toLocaleTimeString([], { hour: "numeric" });
}

// Local "YYYY-MM-DD", matching the keys /api/home builds from the tz the page
// sends it. Not dayKey() from lib/format (that one is 0-based and unpadded, a
// different shape entirely) and never toISOString(), which would shift every
// date by a day for anyone west of Greenwich.
function dayKeyOf(date) {
    const m = String(date.getMonth() + 1).padStart(2, "0");
    const d = String(date.getDate()).padStart(2, "0");
    return `${date.getFullYear()}-${m}-${d}`;
}

/**
 * When the listening happens — the hour of the day, and the last thirteen weeks.
 *
 * Both halves are built from dates rather than from the arrays they came in:
 * /api/home sends only the hours and days that have something in them, so
 * reading them positionally would silently slide a quiet Tuesday into a
 * neighbour's square and shift the whole grid.
 *
 * There is no <Empty> here on purpose. A histogram of two bars and a grid of
 * four dots are not an empty state, they are a wrong claim about a habit — so
 * each half has a floor it has to clear, and a section that clears neither is
 * gone rather than apologising in a dashed box.
 */
export default function YourRhythm({ home, loading }) {
    const hours = Array(24).fill(0);
    for (const entry of home?.clock || []) {
        const h = Number(entry?.hour);
        if (Number.isInteger(h) && h >= 0 && h < 24) hours[h] += entry.ms || 0;
    }

    const peakMs = Math.max(0, ...hours);
    const peak = hours.indexOf(peakMs);
    const litHours = hours.filter((ms) => ms > 0).length;

    const byDay = new Map();
    for (const day of home?.days || []) {
        if (day?.date) byDay.set(day.date, (byDay.get(day.date) || 0) + (day.ms || 0));
    }

    // Walk backwards from today so the last cell is always today, whatever the
    // payload did or didn't contain.
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const cells = [];
    for (let back = SPAN - 1; back >= 0; back--) {
        const date = new Date(today);
        date.setDate(date.getDate() - back);
        const key = dayKeyOf(date);
        cells.push({ key, ms: byDay.get(key) || 0 });
    }

    const lit = cells.filter((c) => c.ms > 0);

    // Quartiles over the days that have something, not a share of the biggest
    // day: one Saturday spent on a nine-hour playlist would push every ordinary
    // evening into the palest step and the grid would read as a blank quarter
    // with a single bright square in it.
    const ranked = lit.map((c) => c.ms).sort((a, b) => a - b);
    const p33 = ranked[Math.floor(ranked.length * 0.33)] || 0;
    const p66 = ranked[Math.floor(ranked.length * 0.66)] || 0;
    const level = (ms) => (ms <= 0 ? 0 : ms <= p33 ? 1 : ms <= p66 ? 2 : 3);

    // Today counts, but a silent today does not break the run: a streak that
    // dies at midnight and only comes back once you press play would read as
    // broken every morning.
    let streak = 0;
    let cursor = cells.length - 1;
    if (cells[cursor].ms <= 0) cursor -= 1;
    while (cursor >= 0 && cells[cursor].ms > 0) {
        streak++;
        cursor--;
    }

    const showClock = litHours >= MIN_HOURS;
    const showDays = lit.length >= MIN_DAYS;
    if (!loading && !showClock && !showDays) return null;

    // The heading is the finding. Without enough of the clock there is no
    // finding, only a shelf name.
    const title = showClock ? `You listen most around ${hourLabel(peak)}` : "Your rhythm";

    return (
        <Section id="your-rhythm" title={title} loading={loading} minHeight={260}>
            <div className="rounded-xl border border-border bg-elevated/40 p-5">
                <div className={`grid gap-6 ${showClock && showDays ? "lg:grid-cols-[2fr_1fr]" : ""}`}>
                    {showClock && (
                        <div className="flex min-w-0 flex-col gap-2">
                            <span className="text-[10px] font-bold uppercase tracking-wide text-subtext">By hour</span>

                            <div className="flex h-28 items-end gap-1">
                                {hours.map((ms, h) => (
                                    <div
                                        key={h}
                                        title={`${hourLabel(h)} — ${humanDuration(ms)}`}
                                        // An hour with anything in it keeps a
                                        // visible bar; an empty one keeps a tick,
                                        // so the row still reads as a whole day.
                                        style={{ height: `${ms > 0 ? Math.max(6, Math.round((ms / peakMs) * 100)) : 2}%` }}
                                        className={`flex-1 rounded-t ${h === peak ? "bg-accent" : "bg-accent/40"}`}
                                    />
                                ))}
                            </div>

                            {/* Positioned at each mark's own share of the axis
                                rather than laid out in 24 cells — a cell is
                                twenty pixels wide and "12 AM" is not. */}
                            <div className="relative h-4">
                                {HOUR_MARKS.map((h) => (
                                    <span
                                        key={h}
                                        style={{ left: `${((h + 0.5) / 24) * 100}%` }}
                                        className="absolute -translate-x-1/2 whitespace-nowrap text-[10px] text-subtext"
                                    >
                                        {hourLabel(h)}
                                    </span>
                                ))}
                            </div>
                        </div>
                    )}

                    {showDays && (
                        <div className="flex flex-col gap-2">
                            <span className="text-[10px] font-bold uppercase tracking-wide text-subtext">
                                Last {WEEKS} weeks
                            </span>

                            {/* Seven rows, filled downward, so each column is a
                                consecutive week and today is the last square. */}
                            <div
                                className="grid grid-flow-col justify-start gap-1"
                                style={{ gridTemplateRows: "repeat(7, auto)" }}
                            >
                                {cells.map((c) => (
                                    <span
                                        key={c.key}
                                        title={`${c.key} — ${humanDuration(c.ms)}`}
                                        className={`h-3 w-3 rounded-[3px] ${TONE[level(c.ms)]}`}
                                    />
                                ))}
                            </div>

                            <span className="text-[13px] text-subtext">
                                {streak > 0 ? (
                                    <>
                                        <span className="font-bold text-maintext">{streak}-day</span> streak
                                    </>
                                ) : (
                                    "No streak right now"
                                )}
                            </span>
                        </div>
                    )}
                </div>
            </div>
        </Section>
    );
}
