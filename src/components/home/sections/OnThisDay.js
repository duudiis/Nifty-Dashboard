import { useNifty } from "../../../context/NiftyContext.js";
import { artworkOrFallback } from "../../../lib/format.js";
import { useBulkQueue } from "../../browse/useEntityActions.js";
import Icon from "../../Icon.js";
import Section from "../Section.js";
import { Pill } from "../pieces.js";

// The fan: a hand of covers, tilted the way a stack of records leans.
const TILT = ["-rotate-6", "rotate-0", "rotate-6"];

/**
 * Songs saved on this calendar day in an earlier year.
 *
 * Most days there is nothing, and that is the normal case, not a failure — so
 * there is no <Empty> and no reserved shimmer for it. A dashed box saying "you
 * saved nothing on a September 5th" would be a section-shaped apology sitting
 * under fifteen real ones, and washing space for something usually absent would
 * make the page bounce every load. It appears the days it has something, and is
 * gone the rest.
 *
 * The heading reads off the first row, so a payload that mixed years would be
 * quietly wrong about the others; those rows carry their own age instead.
 */
export default function OnThisDay({ home, loading }) {
    const { play, selected } = useNifty();
    const bulkQueue = useBulkQueue();

    // A row with nothing to play is a dead click, not a memory.
    const rows = (home?.onThisDay || []).filter((t) => t?.playQuery || t?.url);
    if (rows.length === 0) return null;

    const shown = rows.slice(0, 6);
    const extra = rows.length - shown.length;
    const years = shown[0].yearsAgo || 1;

    return (
        <Section id="on-this-day" loading={loading} minHeight={300}>
            <div className="relative grid gap-6 rounded-xl border border-border bg-elevated/40 p-5 lg:grid-cols-[auto_1fr]">
                <div className="flex shrink-0 items-center justify-center pl-8 lg:pl-0">
                    {shown.slice(0, 3).map((t, i) => (
                        <img
                            key={t.url || t.playQuery || i}
                            src={artworkOrFallback(t.artwork)}
                            onError={(e) => (e.currentTarget.src = artworkOrFallback(null))}
                            className={`h-24 w-24 rounded-md object-cover shadow-lg ${TILT[i]} ${i > 0 ? "-ml-8" : ""}`}
                            alt=""
                        />
                    ))}
                </div>

                <div className="flex min-w-0 flex-col gap-3">
                    <h3 className="flex items-center gap-2 text-lg font-bold text-maintext">
                        <Icon name="history" className="h-5 w-5 text-accent" />
                        <span className="truncate">
                            {years} year{years === 1 ? "" : "s"} ago you saved these
                        </span>
                    </h3>

                    <div className="flex flex-col">
                        {shown.map((t, i) => (
                            <button
                                key={t.url || t.playQuery || i}
                                onClick={() => { if (selected) play(t.playQuery || t.url, "queue", t.title); }}
                                title={selected ? "Add to queue" : "Select a server first"}
                                className="flex w-full items-center gap-3 rounded-md p-1.5 text-left transition-colors hover:bg-elevated"
                            >
                                <img
                                    src={artworkOrFallback(t.artwork)}
                                    onError={(e) => (e.currentTarget.src = artworkOrFallback(null))}
                                    className="h-8 w-8 shrink-0 rounded object-cover"
                                    alt=""
                                />
                                <span className="flex min-w-0 flex-1 flex-col leading-tight">
                                    <span className="truncate text-[13px] text-maintext">{t.title}</span>
                                    <span className="truncate text-[11px] text-subtext">{t.artist}</span>
                                </span>
                                {t.yearsAgo && t.yearsAgo !== years && (
                                    <Pill>{t.yearsAgo}y ago</Pill>
                                )}
                            </button>
                        ))}
                    </div>

                    <div className="flex flex-wrap items-center gap-3">
                        <button
                            onClick={() => bulkQueue(shown)}
                            disabled={!selected}
                            title={selected ? "Add them all to the queue" : "Select a server first"}
                            className="flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-xs font-bold text-canvas transition hover:brightness-110 disabled:opacity-40 disabled:hover:brightness-100"
                        >
                            <Icon name="enqueue" className="h-3.5 w-3.5" />
                            Queue {shown.length}
                        </button>
                        {extra > 0 && (
                            <span className="text-[11px] text-subtext">
                                {extra} more that day, in Liked songs.
                            </span>
                        )}
                    </div>
                </div>
            </div>
        </Section>
    );
}
