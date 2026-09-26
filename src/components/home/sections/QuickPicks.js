import { useNifty } from "../../../context/NiftyContext.js";
import { artworkOrFallback } from "../../../lib/format.js";
import Icon from "../../Icon.js";
import { Stagger, StaggerItem } from "../../motion/index.js";
import Section from "../Section.js";

// The shelf is a real page in this app, not a client-side idea — the same
// synthetic id the sidebar and /api/browse both answer to.
const LIKED = { kind: "playlist", title: "Liked songs", browseId: "nifty:playlist:liked" };

/**
 * Eight one-click ways back in, blended from whatever has already loaded.
 *
 * The slots are filled in priority order — the shelf, then the library, then
 * what is on repeat, then what was heard last — and any slot that cannot be
 * built is dropped rather than drawn as a placeholder, because a row of
 * "nothing here yet" chips is worse than a shorter row. Under three real picks
 * there is no shortcut worth the heading, so the section removes itself; that
 * null is the empty state, and an <Empty> in its place would only be a fourth
 * kind of nothing above fifteen shelves that say it better.
 */
export default function QuickPicks({ home, loading }) {
    const { library, openEntity, play, selected } = useNifty();

    const slots = [];
    const seen = new Set();

    // Deduped on url || browseId: the same song is very often both a repeat and
    // the last thing heard, and two identical cards read as a bug.
    const add = (id, slot) => {
        if (!id || seen.has(id)) return;
        seen.add(id);
        slots.push({ ...slot, id });
    };

    // Search-shape tracks only. A pick with nothing to play is not a pick, so
    // one without a query is skipped rather than rendered into a dead click.
    const addTrack = (t) => {
        const query = t?.playQuery || t?.url;
        if (!query || !t.title) return;
        add(t.url || query, {
            track: true,
            title: t.title,
            subtitle: t.artist || "Song",
            artwork: t.artwork,
            onClick: () => { if (selected) play(query, "queue", t.title); }
        });
    };

    const addCollection = (item) => {
        if (!item?.browseId || !item.title) return;
        add(item.url || item.browseId, {
            title: item.title,
            subtitle: item.subtitle || item.kind,
            artwork: item.artwork,
            onClick: () => openEntity(item.kind, item.browseId)
        });
    };

    // 1 — the shelf, but only once there is something on it. An empty Liked
    // songs page is exactly the placeholder this grid is meant to avoid.
    const likedCount = (library?.likedUrls || []).length;
    if (likedCount > 0) {
        add(LIKED.browseId, {
            liked: true,
            title: LIKED.title,
            subtitle: `${likedCount} song${likedCount === 1 ? "" : "s"}`,
            onClick: () => openEntity(LIKED.kind, LIKED.browseId)
        });
    }

    // 2-3 — the top of the library, in the order the user arranged it.
    (library?.items || []).filter((i) => i?.browseId).slice(0, 2).forEach(addCollection);

    // 4-6 — a month of repeats where there is one, all time where there isn't.
    const repeats = (home?.onRepeat30 || []).length ? home.onRepeat30 : (home?.onRepeatAll || []);
    (repeats || []).slice(0, 3).forEach(addTrack);

    // 7-8 — and the last couple of things actually heard.
    (home?.recentHeard || []).slice(0, 2).forEach(addTrack);

    const cards = slots.slice(0, 8);

    // Only once the data has landed: hiding the section mid-load would drop the
    // reserved height and jolt everything below it upward.
    if (!loading && cards.length < 3) return null;

    return (
        <Section id="quick-picks" title="Start here" loading={loading} minHeight={180}>
            <Stagger className="grid grid-cols-1 gap-2 sm:grid-cols-2 xl:grid-cols-4" gap={0.03}>
                {cards.map((c) => (
                    <StaggerItem key={c.id}>
                                    <button
                                onClick={c.onClick}
                                title={c.track ? (selected ? "Add to queue" : "Select a server first") : `Open ${c.title}`}
                                className="group flex h-16 w-full items-center gap-3 overflow-hidden rounded-md bg-elevated/60 pr-3 text-left transition-colors hover:bg-elevated"
                            >
                                {/* The cover runs flush into the card's own
                                    corners — the card clips it, so nothing here
                                    is rounded a second time. */}
                                {c.liked ? (
                                    <span className="flex h-16 w-16 shrink-0 items-center justify-center bg-gradient-to-br from-accent to-accent/40 text-canvas">
                                        <Icon name="heart-filled" className="h-6 w-6" />
                                    </span>
                                ) : (
                                    <img
                                        src={artworkOrFallback(c.artwork)}
                                        onError={(e) => (e.currentTarget.src = artworkOrFallback(null))}
                                        className="h-16 w-16 shrink-0 object-cover"
                                        alt=""
                                    />
                                )}

                                <span className="flex min-w-0 flex-1 flex-col leading-tight">
                                    <span className="truncate text-[13px] font-bold text-maintext">{c.title}</span>
                                    <span className={`truncate text-[11px] text-subtext ${c.track ? "" : "capitalize"}`}>
                                        {c.subtitle}
                                    </span>
                                </span>

                                <Icon
                                    name={c.track ? "play" : "chevron-down"}
                                    className={`h-4 w-4 shrink-0 opacity-0 transition-opacity group-hover:opacity-100 ${
                                        c.track ? "text-accent" : "-rotate-90 text-subtext"
                                    }`}
                                />
                            </button>
                    </StaggerItem>
                ))}
            </Stagger>
        </Section>
    );
}
