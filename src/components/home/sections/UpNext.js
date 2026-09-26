import { useNifty } from "../../../context/NiftyContext.js";
import { artworkOrFallback, msToClock } from "../../../lib/format.js";
import Icon from "../../Icon.js";
import AddedBy from "../../AddedBy.js";
import { Stagger, StaggerItem } from "../../motion/index.js";
import Section, { Empty } from "../Section.js";

/* What the room is about to hear, on the way past.
 *
 * Every value here already rides the socket the context holds open — the queue,
 * the cursor, and the bot's autoplay buffer all arrive as deltas — so this
 * section fetches nothing and owns no timer. It is the only place on the page
 * that touches queue entries, which are the PLAYER shape (duration in ms, no
 * playQuery); TrackRow and Tile speak the search shape, so these rows are drawn
 * by hand rather than bent through a component that would print "213482" for a
 * duration and dead-click on the artwork.
 */

// The app's queue switch, close enough to the one over the real autoplay
// section that flipping it here feels like flipping it there.
function Switch({ on, onClick, title }) {
    return (
        <button
            onClick={onClick}
            title={title}
            role="switch"
            aria-checked={on}
            className={`relative h-4 w-7 shrink-0 rounded-full transition-colors ${on ? "bg-accent" : "bg-elevated"}`}
        >
            <span className={`absolute top-0.5 h-3 w-3 rounded-full bg-maintext shadow transition-all ${on ? "left-3.5" : "left-0.5"}`} />
        </button>
    );
}

export default function UpNext() {
    const { queue, selected, setView, playNow, playNextTrack, toggleAutoplay } = useNifty();

    const tracks = queue?.tracks || [];
    const position = queue?.position || 0;
    const autoplay = queue?.autoplay || {};
    const autoEnabled = !!autoplay.enabled;
    const suggestions = (autoplay.tracks || []).slice(0, 4);

    // The cursor is an id, not an array index: an entry's track_id IS its
    // position in the bot's list, and the two only move together on a bot push.
    // Comparing ids (rather than slicing the array) keeps this correct while a
    // drag on the queue page has the local order temporarily diverged.
    const upcoming = tracks
        .filter((t) => typeof t?.track_id === "number" && t.track_id > position)
        .sort((a, b) => a.track_id - b.track_id)
        .slice(0, 5);

    // No room selected means no queue to be next in, and a section that is
    // neither showing what follows nor offering autoplay has nothing to say —
    // both are silence rather than an empty shelf.
    if (!selected) return null;
    if (!upcoming.length && !autoEnabled) return null;

    const room = selected.guildName || "this server";

    const openQueue = (
        <button
            onClick={() => setView("queue")}
            className="rounded-full px-2 py-1 text-xs font-bold text-subtext transition-colors hover:text-maintext"
        >
            Open queue
        </button>
    );

    // The buffer is kept live on every page and shown nowhere else on home, so
    // this panel is a window on it, not a second set of controls: promoting,
    // reordering and dismissing a suggestion all stay on the queue page.
    const autoplayPanel = (
        <div className="flex flex-col gap-3 border-t border-border pt-4 lg:border-l lg:border-t-0 lg:pl-5 lg:pt-0">
            <div className="flex items-center justify-between gap-3">
                <span className="truncate text-[13px] font-bold text-maintext">
                    {autoEnabled ? "Next from: Autoplay" : "Autoplay"}
                </span>
                <Switch
                    on={autoEnabled}
                    onClick={toggleAutoplay}
                    title={autoEnabled ? "Turn off Autoplay" : "Turn on Autoplay"}
                />
            </div>

            {!autoEnabled ? (
                <p className="text-[11px] leading-relaxed text-subtext">
                    Turn it on and Nifty keeps the music going when the queue runs dry, matching what the room has been playing.
                </p>
            ) : suggestions.length === 0 ? (
                <Empty>Nothing lined up yet — Nifty picks from what the room has been playing, so give it a song or two first.</Empty>
            ) : (
                <div className="flex flex-col gap-2">
                    {suggestions.map((t, i) => (
                        <div key={t.auto_id ?? t.songUrl ?? i} className="flex items-center gap-2">
                            <img
                                src={artworkOrFallback(t.artwork)}
                                onError={(e) => (e.currentTarget.src = artworkOrFallback(null))}
                                className="h-8 w-8 shrink-0 rounded object-cover"
                                alt=""
                            />
                            <span className="flex min-w-0 flex-col leading-tight">
                                <span className="truncate text-[12px] text-maintext">{t.title}</span>
                                <span className="truncate text-[10px] text-subtext">{t.artist}</span>
                            </span>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );

    return (
        <Section id="up-next" title={`Up next in ${room}`} icon="queue" minHeight={240} actions={openQueue}>
            {upcoming.length === 0 ? (
                <div className="max-w-sm">{autoplayPanel}</div>
            ) : (
                <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
                    <Stagger className="flex flex-col gap-1" gap={0.03}>
                        {upcoming.map((t, i) => (
                            <StaggerItem key={t.track_id}>
                                <div className="group flex h-14 items-center gap-3 rounded-md px-2 transition-colors hover:bg-elevated">
                                    <span className="w-4 shrink-0 text-center text-xs text-subtext">{i + 1}</span>
                                    <img
                                        src={artworkOrFallback(t.artwork)}
                                        onError={(e) => (e.currentTarget.src = artworkOrFallback(null))}
                                        className="h-10 w-10 shrink-0 rounded object-cover"
                                        alt=""
                                    />
                                    {/* Plain text, not an ArtistLink: queue entries carry no
                                        artistBrowseId, so the link would have nowhere to go. */}
                                    <span className="flex min-w-0 flex-1 flex-col leading-tight">
                                        <span className="truncate text-[13px] text-maintext">{t.title}</span>
                                        <span className="truncate text-[11px] text-subtext">{t.artist}</span>
                                    </span>

                                    <AddedBy track={t} size={18} className="hidden w-28 shrink-0 text-[11px] text-subtext lg:flex" />

                                    {/* The controls sit on top of the duration rather than
                                        beside it, so a row never changes width on hover and
                                        the column stays a column. */}
                                    <span className="relative flex h-8 w-16 shrink-0 items-center justify-end">
                                        <span className="text-[11px] text-subtext transition-opacity group-hover:opacity-0">
                                            {msToClock(t.duration)}
                                        </span>
                                        <span className="absolute inset-y-0 right-0 flex items-center gap-1 opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                                            <button
                                                onClick={() => playNow(t.track_id)}
                                                title="Play now"
                                                className="flex h-7 w-7 items-center justify-center rounded-full text-subtext transition-colors hover:bg-surface hover:text-maintext"
                                            >
                                                <Icon name="play-now" className="h-4 w-4" />
                                            </button>
                                            <button
                                                onClick={() => playNextTrack(t.track_id)}
                                                title="Play next"
                                                className="flex h-7 w-7 items-center justify-center rounded-full text-subtext transition-colors hover:bg-surface hover:text-maintext"
                                            >
                                                <Icon name="play-next" className="h-4 w-4" />
                                            </button>
                                        </span>
                                    </span>
                                </div>
                            </StaggerItem>
                        ))}
                    </Stagger>

                    {autoplayPanel}
                </div>
            )}
        </Section>
    );
}
