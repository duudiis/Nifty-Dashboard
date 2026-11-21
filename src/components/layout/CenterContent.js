import { useEffect, useLayoutEffect, useRef } from "react";

import { useNifty } from "../../context/NiftyContext.js";
import { ViewTransition, motion } from "../motion/index.js";

import SearchResults from "../search/SearchResults.js";
import QueuePage from "../queue/QueuePage.js";
import LyricsView from "../lyrics/LyricsView.js";
import WatchView from "../watch/WatchView.js";
import HistoryView from "../history/HistoryView.js";
import CollectionPage from "../browse/CollectionPage.js";
import ArtistPage from "../browse/ArtistPage.js";
import HomeView from "../home/HomeView.js";
import CenterBackdrop from "./CenterBackdrop.js";

const useBeforePaint = typeof window === "undefined" ? useEffect : useLayoutEffect;

export default function CenterContent() {
    const { view, entityId, pageArt, player } = useNifty();
    const scrollRef = useRef(null);

    // This box is the scroll container and is never remounted across view
    // changes, so without this, leaving a scrolled page and coming back to a
    // long one (the home screen runs to several thousand pixels) lands you
    // halfway down it.
    useBeforePaint(() => {
        scrollRef.current?.scrollTo({ top: 0 });
    }, [view, entityId]);
    // Full-surface overlays (lyrics, watch): fixed height, pinned art backdrop,
    // the view manages its own scrolling.
    const isOverlay = view === "lyrics" || view === "watch";

    return (
        <motion.main ref={scrollRef} layoutScroll data-scroll-viewport className={`relative min-h-0 min-w-0 flex-1 rounded-lg bg-surface ${isOverlay ? "overflow-hidden" : "overflow-auto [overflow-anchor:none]"}`}>
            {/* Mount the route once, including its loading state. Data arriving
                fades inside this same shell and never replays its entrance. */}
            <ViewTransition
                transitionKey={`${view}:${entityId || ""}`}
                // Regular pages grow downward from a full-height column, so a
                // page that is still loading can centre its loader in the box.
                className={isOverlay ? "h-full" : "flex min-h-full flex-col"}
                contentClassName={isOverlay ? "h-full" : "flex flex-1 flex-col"}
                backdrop={<CenterBackdrop view={view} pageArt={pageArt} artwork={player?.track?.artwork} />}
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
                    <QueuePage />
                ) : view === "search" ? (
                    <div className="p-6">
                        <SearchResults />
                    </div>
                ) : view === "history" ? (
                    <HistoryView />
                ) : (
                    <HomeView />
                )}
            </ViewTransition>
        </motion.main>
    );
}
