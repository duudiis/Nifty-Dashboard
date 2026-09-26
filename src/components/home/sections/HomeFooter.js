import { useNifty } from "../../../context/NiftyContext.js";
import { dayLabel, humanDuration } from "../../../lib/format.js";

/**
 * The last line on the page: how long this has been going on, in one sentence.
 *
 * Not a <Section> — a section is a shelf with a heading and a reserved height,
 * and this is a rule with a sentence under it. It renders nothing at all while
 * the payload is in flight, so there is nothing to reserve: a footer that
 * shimmered into place under sixteen real ones would be the loudest thing on a
 * page that had just finished loading.
 *
 * The numbers are the point, so they are the only things set in the main text
 * colour; the sentence around them stays quiet.
 */
export default function HomeFooter({ home, loading }) {
    const { setView } = useNifty();

    if (loading) return null;

    const totals = home?.totals || {};
    const plays = totals.plays || 0;
    const since = home?.firstSeenAt ? dayLabel(home.firstSeenAt) : null;

    // No plays and no first day on record is a brand-new account, and there is
    // no true sentence to write about it. FirstRun already has that page.
    if (plays === 0 && !since) return null;

    return (
        <div className="border-t border-border pt-6 pb-2 text-center">
            {plays === 0 ? (
                <p className="text-sm text-subtext">
                    Nifty started listening with you{" "}
                    <span className="font-bold text-maintext">{since}</span>. Nothing recorded yet.
                </p>
            ) : (
                <p className="text-sm text-subtext">
                    Nifty has been listening with you
                    {since ? (
                        <> since <span className="font-bold text-maintext">{since}</span></>
                    ) : null}
                    {" — "}
                    <span className="font-bold text-maintext">{plays.toLocaleString()}</span>{" "}
                    track{plays === 1 ? "" : "s"} played,{" "}
                    <span className="font-bold text-maintext">
                        {(totals.distinct_tracks || 0).toLocaleString()}
                    </span>{" "}
                    of them different,{" "}
                    <span className="font-bold text-maintext">{humanDuration(totals.all_ms || 0)}</span>{" "}
                    in total.
                </p>
            )}

            {/* Only where there is one. Under "nothing recorded yet" this would
                be a door onto an empty room. */}
            {plays > 0 && (
                <button
                    onClick={() => setView("history")}
                    className="mt-2 rounded-full px-2 py-1 text-xs font-bold text-subtext transition-colors hover:text-maintext"
                >
                    See your full history
                </button>
            )}
        </div>
    );
}
