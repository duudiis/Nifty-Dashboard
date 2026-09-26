import { useNifty } from "../../../context/NiftyContext.js";
import { artworkOrFallback } from "../../../lib/format.js";
import { Stagger, StaggerItem } from "../../motion/index.js";
import Section, { Empty } from "../Section.js";
import { Avatar, Pill } from "../pieces.js";

// The two directions traffic runs in a shared room, written the same way on
// purpose: mirrored halves make the imbalance visible at a glance, which is the
// only thing anyone actually reads this section for.
const HALVES = {
    reach: {
        title: "What you put on that stuck",
        empty: "Nobody's heard your picks yet — queue something while the room's full."
    },
    brought: {
        title: "What the room gave you",
        empty: "Nothing new from the room yet."
    }
};

// Module scope, not nested in the section: HomeView re-renders on every player
// delta, and a component redeclared inside it is a new type each time, so every
// row would unmount and replay its stagger while the music was simply playing.
function Row({ track, selected, onQueue, trailing }) {
    return (
        <button
            onClick={() => onQueue(track)}
            title={selected ? "Add to queue" : "Select a server first"}
            className="flex w-full items-center gap-3 rounded-md p-1.5 text-left transition-colors hover:bg-elevated"
        >
            <img
                src={artworkOrFallback(track.artwork)}
                onError={(e) => (e.currentTarget.src = artworkOrFallback(null))}
                className="h-9 w-9 shrink-0 rounded object-cover"
                alt=""
            />
            <span className="flex min-w-0 flex-1 flex-col leading-tight">
                <span className="truncate text-[13px] text-maintext">{track.title}</span>
                <span className="truncate text-[11px] text-subtext">{track.artist}</span>
            </span>
            {trailing}
        </button>
    );
}

function Half({ half, rows, selected, onQueue, trailing }) {
    return (
        <div className="flex min-w-0 flex-col gap-3">
            <h4 className="text-sm font-bold text-maintext">{half.title}</h4>
            {rows.length === 0 ? (
                <Empty>{half.empty}</Empty>
            ) : (
                <Stagger className="flex flex-col" gap={0.03}>
                    {rows.map((t, i) => (
                        <StaggerItem key={t.url || t.playQuery || i}>
                            <Row track={t} selected={selected} onQueue={onQueue} trailing={trailing(t)} />
                        </StaggerItem>
                    ))}
                </Stagger>
            )}
        </div>
    );
}

// "3 listeners" is the whole claim on the left — how many people were in the
// room for it, not how often it played.
function listenerPill(track) {
    const n = track.listeners || 0;
    return <Pill>{n} listener{n === 1 ? "" : "s"}</Pill>;
}

// On the right the face is the claim, and the name rides with it: Discord
// avatars 404 the moment a member leaves, and a tooltip on a missing image
// names nobody.
function fromWho(track) {
    const by = track.by || {};
    return (
        <span className="flex shrink-0 items-center gap-1.5">
            <Avatar src={by.avatar} name={by.name} className="h-6 w-6" />
            <span className="max-w-[96px] truncate text-[11px] text-subtext">from {by.name || "someone"}</span>
        </span>
    );
}

/**
 * The give and take of a shared bot.
 *
 * Every other shelf on this page is about one person listening alone. This one
 * only exists because the queue is shared: on the left, songs the user picked
 * that somebody else stayed for; on the right, songs that arrived on someone
 * else's turn at the aux. A solo listener has neither, so the whole section is
 * gone rather than two dashed boxes explaining that nobody was around.
 *
 * The rows are built by hand instead of reusing TrackRow because that row locks
 * itself to a 60px pitch for the collection virtualizer — sixteen of them in two
 * columns would stand taller than anything else on home, and the right-hand slot
 * a listener count or a face needs is where TrackRow puts a duration.
 */
export default function TheExchange({ home, loading }) {
    const { play, selected } = useNifty();

    // A row with no play target is a dead click, and every row here is clickable.
    const playable = (list) => (list || []).filter((t) => t?.playQuery || t?.url);
    const reach = playable(home?.reach);
    const brought = playable(home?.brought);

    // Gated on !loading so the wash still reserves the section's height; once
    // the payload lands with nothing in either half there is no section.
    if (!loading && reach.length === 0 && brought.length === 0) return null;

    const queue = (t) => {
        if (!selected) return;
        play(t.playQuery || t.url, "queue", t.title);
    };

    return (
        <Section id="the-exchange" title="Your picks, their ears" loading={loading} minHeight={320}>
            <div className="grid gap-6 lg:grid-cols-2">
                <Half half={HALVES.reach} rows={reach} selected={selected} onQueue={queue} trailing={listenerPill} />
                <Half half={HALVES.brought} rows={brought} selected={selected} onQueue={queue} trailing={fromWho} />
            </div>
        </Section>
    );
}
