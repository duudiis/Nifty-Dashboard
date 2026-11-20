import { useNifty } from "../../../context/NiftyContext.js";
import { artworkOrFallback } from "../../../lib/format.js";
import Icon from "../../Icon.js";

function greeting() {
    const hour = new Date().getHours();
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
}

export function HomeGreeting() {
    const { user } = useNifty();
    const name = user?.display_name || user?.username;
    return (
        <h1 className="text-2xl font-extrabold tracking-tight text-maintext sm:text-3xl">
            {greeting()}{name ? `, ${name}` : ""}
        </h1>
    );
}

export default function QuickPicks({ home, discover }) {
    const { library, openEntity, play, selected } = useNifty();
    const slots = [];
    const seen = new Set();
    const add = (id, slot) => {
        if (!id || seen.has(id)) return;
        seen.add(id);
        slots.push({ ...slot, id });
    };
    const addTrack = (track) => {
        const query = track?.playQuery || track?.url;
        if (!query || !track.title) return;
        add(track.url || query, {
            track: true, title: track.title, subtitle: track.artist || "Song", artwork: track.artwork,
            onClick: () => play(query, "queue", track.title)
        });
    };
    const addCollection = (item) => {
        if (!item?.browseId || !item.title) return;
        add(item.browseId, {
            title: item.title, subtitle: item.kind, artwork: item.artwork,
            onClick: () => openEntity(item.kind, item.browseId)
        });
    };

    add("nifty:playlist:liked", {
        liked: true, title: "Liked songs", subtitle: "Your favorites",
        onClick: () => openEntity("playlist", "nifty:playlist:liked")
    });
    (library?.items || []).slice(0, 3).forEach(addCollection);
    (home?.onRepeat30?.length ? home.onRepeat30 : home?.onRepeatAll || []).slice(0, 4).forEach(addTrack);
    (home?.recentHeard || []).forEach(addTrack);
    (home?.recentQueued || []).forEach(addTrack);
    (discover?.songs || []).forEach(addTrack);
    (discover?.playlists || []).forEach(addCollection);

    return (
        <section id="quick-picks" className="flex flex-col gap-5">
            <div className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr))]">
                {slots.slice(0, 8).map((card) => (
                    <button
                        key={card.id}
                        onClick={card.onClick}
                        disabled={card.track && !selected}
                        title={card.track ? (selected ? "Add to queue" : "Select a server first") : `Open ${card.title}`}
                        className="group relative flex h-[72px] min-w-0 items-center gap-3 overflow-hidden rounded-lg bg-elevated/65 pr-3 text-left transition-colors hover:bg-elevated focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent disabled:cursor-default"
                    >
                        {card.liked ? (
                            <span className="flex h-[72px] w-[72px] shrink-0 items-center justify-center bg-gradient-to-br from-accent to-accent/40 text-canvas">
                                <Icon name="heart-filled" className="h-7 w-7" />
                            </span>
                        ) : (
                            <img src={artworkOrFallback(card.artwork)} onError={(event) => { event.currentTarget.src = artworkOrFallback(null); }} className="h-[72px] w-[72px] shrink-0 object-cover" alt="" />
                        )}
                        <span className="flex min-w-0 flex-1 flex-col gap-1">
                            <span className="truncate text-[13px] font-bold text-maintext">{card.title}</span>
                            <span className="truncate text-xs text-subtext">{card.subtitle}</span>
                        </span>
                        <span className={`flex w-5 shrink-0 items-center justify-center opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100 ${card.track ? "text-accent" : "text-subtext"}`}>
                            <Icon name={card.track ? "enqueue" : "chevron-down"} className={`h-4 w-4 ${card.track ? "" : "-rotate-90"}`} />
                        </span>
                    </button>
                ))}
            </div>
        </section>
    );
}
