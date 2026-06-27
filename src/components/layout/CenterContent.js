import { useNifty } from "../../context/NiftyContext.js";
import { totalDuration, artworkOrFallback } from "../../lib/format.js";
import { SlideTransition, motion } from "../motion/index.js";
import { useContextMenu } from "../menu/ContextMenu.js";
import { useTrackMenu } from "../menu/trackMenu.js";

import SearchResults from "../search/SearchResults.js";
import QueueList from "../queue/QueueList.js";
import LyricsView, { LyricsBackdrop } from "../lyrics/LyricsView.js";
import CollectionPage from "../browse/CollectionPage.js";
import ArtistPage from "../browse/ArtistPage.js";

function QueueHeader() {
    const { queue, selected } = useNifty();
    const tracks = queue.tracks || [];

    return (
        <div
            className="flex items-end gap-6 px-6 pb-6 pt-10"
            style={{ background: "linear-gradient(180deg, rgb(var(--c-accent) / 0.35) -40%, transparent 100%)" }}
        >
            <img src="/images/queue.png" alt="" className="h-32 w-32 rounded-md object-cover shadow-2xl" />
            <div className="flex flex-col gap-2">
                <span className="text-xs font-bold uppercase tracking-wide text-subtext">Queue</span>
                <h1 className="text-5xl font-bold">{selected ? selected.guildName : "Queue"}</h1>
                <span className="text-xs text-subtext">
                    {tracks.length} track{tracks.length === 1 ? "" : "s"} · {totalDuration(tracks)}
                </span>
            </div>
        </div>
    );
}

function Home() {
    const { selected, player, setView } = useNifty();
    const trackMenu = useTrackMenu();
    const track = player?.track || null;
    const { onContextMenu, active } = useContextMenu(() => (track ? trackMenu(track, { source: "player" }) : []));

    return (
        <div className="flex flex-col gap-6 p-6">
            <h1 className="text-3xl font-bold">
                {selected ? <>Now in <span className="text-accent">{selected.guildName}</span></> : "Welcome to Nifty"}
            </h1>

            {!selected ? (
                <p className="max-w-md text-sm text-subtext">
                    Select a server from the top bar or your library to start controlling playback.
                </p>
            ) : track ? (
                <div onContextMenu={onContextMenu} className={`flex items-center gap-5 rounded-xl p-5 transition ${active ? "bg-elevated" : "bg-elevated/60"}`}>
                    <img
                        src={artworkOrFallback(track.artwork)}
                        onError={(e) => (e.currentTarget.src = artworkOrFallback(null))}
                        className="h-28 w-28 rounded-lg object-cover shadow-lg"
                        alt=""
                    />
                    <div className="flex flex-col gap-1">
                        <span className="text-xs font-bold uppercase tracking-wide text-subtext">Now playing</span>
                        <span className="text-2xl font-bold">{track.title}</span>
                        <span className="text-sm text-subtext">{track.artist}</span>
                        <button
                            onClick={() => setView("queue")}
                            className="mt-2 w-fit rounded-full bg-accent px-4 py-1.5 text-xs font-bold text-canvas transition hover:brightness-110"
                        >
                            View queue
                        </button>
                    </div>
                </div>
            ) : (
                <p className="text-sm text-subtext">Nothing is playing. Search above to queue a track.</p>
            )}
        </div>
    );
}

export default function CenterContent() {
    const { view, entityId } = useNifty();
    const isLyrics = view === "lyrics";

    return (
        <motion.main layoutScroll className={`min-h-0 flex-1 rounded-lg bg-surface ${isLyrics ? "overflow-hidden" : "overflow-auto"}`}>
            <SlideTransition
                transitionKey={`${view}:${entityId || ""}`}
                className={isLyrics ? "h-full" : undefined}
                contentClassName={isLyrics ? "h-full" : undefined}
                backdrop={isLyrics ? <LyricsBackdrop /> : null}
            >
                {isLyrics ? (
                    <LyricsView />
                ) : view === "album" || view === "playlist" ? (
                    <CollectionPage id={entityId} />
                ) : view === "artist" ? (
                    <ArtistPage id={entityId} />
                ) : view === "queue" ? (
                    <>
                        <QueueHeader />
                        <div className="px-4">
                            <QueueList />
                        </div>
                    </>
                ) : view === "search" ? (
                    <div className="p-6">
                        <SearchResults />
                    </div>
                ) : (
                    <Home />
                )}
            </SlideTransition>
        </motion.main>
    );
}
