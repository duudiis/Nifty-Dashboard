import { useNifty } from "../../../context/NiftyContext.js";
import { dayLabel } from "../../../lib/format.js";
import TrackRow from "../../browse/TrackRow.js";
import { useBulkQueue } from "../../browse/useEntityActions.js";
import Icon from "../../Icon.js";
import { Stagger, StaggerItem } from "../../motion/index.js";
import Section, { Empty } from "../Section.js";

/**
 * The liked songs that have never once come out of the bot.
 *
 * When the pile is empty the section is gone — no line, no badge, nothing.
 * Someone who has played everything they liked does not need to be told so on
 * a page with fifteen other shelves on it, and a congratulation here would be
 * the only row that celebrates the absence of music.
 *
 * The heading counts the whole pile; the queue button counts the rows on
 * screen. /api/home caps this list at fourteen, and a button offering three
 * hundred tracks it was never sent would be a promise the page cannot keep.
 */
export default function LikedUnheard({ home, loading }) {
    const { selected } = useNifty();
    const bulkQueue = useBulkQueue();

    const rows = home?.likedUnheard || [];
    const total = home?.likedUnheardTotal || 0;

    if (!loading && total === 0) return null;

    // The count is the headline, but it is zero until the payload lands — so
    // loading gets the sentence without the number rather than a confident
    // "0 liked songs" that flips a second later.
    const title = loading
        ? "Liked songs you've never played here"
        : `${total} liked song${total === 1 ? "" : "s"} you've never played here`;

    const actions = rows.length > 0 && (
        <button
            onClick={() => bulkQueue(rows)}
            disabled={!selected}
            title={selected ? "Add all of these to the queue" : "Select a server first"}
            className="flex items-center gap-2 rounded-full bg-accent px-5 py-2 text-sm font-bold text-canvas transition hover:brightness-110 disabled:opacity-40"
        >
            <Icon name="enqueue" className="h-4 w-4" />
            Queue {rows.length} track{rows.length === 1 ? "" : "s"}
        </button>
    );

    return (
        <Section
            id="liked-unheard"
            title={title}
            subtitle="The biggest pile of music you already told us you like."
            loading={loading}
            minHeight={340}
            actions={actions || null}
        >
            {rows.length === 0 ? (
                <Empty>Nothing came back to list — reload the page and they should be here.</Empty>
            ) : (
                <Stagger className="grid gap-x-6 lg:grid-cols-2" gap={0.03}>
                    {rows.map((t, i) => (
                        <StaggerItem key={t.url || t.playQuery || i}>
                            <TrackRow
                                track={t}
                                badge={<Icon name="heart-filled" className="h-3.5 w-3.5 text-accent" />}
                                meta={dayLabel(t.addedAt)}
                            />
                        </StaggerItem>
                    ))}
                </Stagger>
            )}
        </Section>
    );
}
