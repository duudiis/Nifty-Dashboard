import { useEffect, useRef } from "react";

import { useNifty } from "../../context/NiftyContext.js";
import Icon from "../Icon.js";
import { totalDuration } from "../../lib/format.js";
import { SlideTransition, motion, entrance } from "../motion/index.js";
import { PageLoader } from "../Loader.js";

import SearchResults from "../search/SearchResults.js";
import QueueList from "../queue/QueueList.js";
import LyricsView from "../lyrics/LyricsView.js";
import WatchView from "../watch/WatchView.js";
import HistoryView from "../history/HistoryView.js";
import ArtBackdrop from "../ArtBackdrop.js";
import Backdrop from "../browse/Backdrop.js";
import CollectionPage from "../browse/CollectionPage.js";
import ArtistPage from "../browse/ArtistPage.js";
import HomeView from "../home/HomeView.js";
import Aurora from "../home/Aurora.js";

function QueueHeader() {
    const { queue, selected } = useNifty();
    const tracks = queue.tracks || [];

    return (
        <div
            className="flex items-end gap-6 px-6 pb-6 pt-10"
            style={{ background: "linear-gradient(180deg, rgb(var(--c-accent) / 0.35) -40%, transparent 100%)" }}
        >
            <span className="flex h-32 w-32 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-accent to-accent/40 text-canvas shadow-2xl">
                <Icon name="queue" className="h-14 w-14" />
            </span>
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

export default function CenterContent() {
    const { view, entityId, pageArt, ready, player } = useNifty();
    const scrollRef = useRef(null);

    // This box is the scroll container and is never remounted across view
    // changes, so without this, leaving a scrolled page and coming back to a
    // long one (the home screen runs to several thousand pixels) lands you
    // halfway down it.
    useEffect(() => {
        scrollRef.current?.scrollTo({ top: 0 });
    }, [view, entityId]);
    // Full-surface overlays (lyrics, watch): fixed height, pinned art backdrop,
    // the view manages its own scrolling.
    const isOverlay = view === "lyrics" || view === "watch";
    const isEntity = view === "album" || view === "playlist" || view === "artist";

    return (
        <motion.main ref={scrollRef} {...entrance(0.05)} layoutScroll className={`relative min-h-0 min-w-0 flex-1 rounded-lg bg-surface ${isOverlay ? "overflow-hidden" : "overflow-auto"}`}>
            {!ready && <PageLoader className="absolute inset-0" />}

            {/* The view mounts only once there is state to render it from, and
                sits directly in the box — nothing wraps it, so its own slide
                transition stays in charge of swapping pages. */}
            {ready && (
            <SlideTransition
                transitionKey={`${view}:${entityId || ""}`}
                // Regular pages grow downward from a full-height column, so a
                // page that is still loading can centre its loader in the box.
                className={isOverlay ? "h-full" : "flex min-h-full flex-col"}
                contentClassName={isOverlay ? "h-full" : "flex flex-1 flex-col"}
                backdrop={
                    // lyrics get the drifting cover-art lights; watch gets plain
                    // black so the video's letterboxing blends into the page;
                    // entity pages pin their artwork blur here so it never
                    // slides (and so never leaks past the header)
                    view === "lyrics" ? <ArtBackdrop />
                        : isOverlay ? <div className="absolute inset-0 bg-black" />
                        : isEntity ? <Backdrop artwork={pageArt} />
                        // Home gets an aurora in the colours of whatever is
                        // playing, falling back to the theme's accent.
                        : view === "home" ? <Aurora artwork={player?.track?.artwork} height={360} />
                        : null
                }
            >
                {view === "lyrics" ? (
                    <LyricsView />
                ) : view === "watch" ? (
                    <WatchView />
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
                ) : view === "history" ? (
                    <HistoryView />
                ) : (
                    <HomeView />
                )}
            </SlideTransition>
            )}
        </motion.main>
    );
}
