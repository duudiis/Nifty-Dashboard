import { useEffect, useRef, useState } from "react";

import { useNifty } from "../context/NiftyContext.js";
import { artworkOrFallback } from "../lib/format.js";
import AddedBy from "./AddedBy.js";
import SongInfo from "./SongInfo.js";
import Icon from "./Icon.js";
import PanelHeader from "./layout/PanelHeader.js";
import { AnimatePresence, motion, EASE, DUR } from "./motion/index.js";
import { useContextMenu } from "./menu/ContextMenu.js";
import { useTrackMenu } from "./menu/trackMenu.js";

// The bot briefly reports an empty player between tracks (skip stops the old
// track before starting the next). Ride out those gaps so the panel crossfades
// straight from one track to the next instead of flashing the empty state.
function useStableTrack(live) {
    const [shown, setShown] = useState(live || null);
    const timer = useRef();

    useEffect(() => {
        clearTimeout(timer.current);
        if (live) {
            setShown(live);
        } else {
            timer.current = setTimeout(() => setShown(null), 700);
        }
        return () => clearTimeout(timer.current);
    }, [live?.songUrl, live?.artwork]); // eslint-disable-line react-hooks/exhaustive-deps

    return shown;
}

// Cover-art gradient behind the header + cover. Rendered as the panel's pinned
// backdrop (by SlideTransition) so the panel slide can't expose the bare
// surface above it. The blurred art crossfades between tracks; with nothing
// playing there's no art, so the plain surface shows through.
export function NowPlayingBackdrop() {
    const { player } = useNifty();
    const track = useStableTrack(player?.track || null);
    const art = track ? artworkOrFallback(track.artwork) : null;

    return (
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[560px] overflow-hidden">
            <AnimatePresence initial={false}>
                {art && (
                    <motion.img
                        key={art}
                        src={art}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 0.55 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: DUR.slow, ease: EASE }}
                        className="absolute inset-0 h-full w-full scale-[1.7] object-cover blur-3xl saturate-150"
                        alt=""
                    />
                )}
            </AnimatePresence>
            {art && (
                <div
                    className="absolute inset-0"
                    style={{ background: "linear-gradient(180deg, rgb(var(--c-surface) / 0.1) 0%, rgb(var(--c-surface) / 0.45) 62%, rgb(var(--c-surface)) 100%)" }}
                />
            )}
        </div>
    );
}

function EmptyState({ icon, title, hint }) {
    return (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
            <Icon name={icon} className="h-9 w-9 text-subtext/70" />
            <p className="text-sm font-bold text-maintext">{title}</p>
            <p className="text-xs text-subtext">{hint}</p>
        </div>
    );
}

const panelFade = {
    initial: { opacity: 0 },
    animate: { opacity: 1 },
    exit: { opacity: 0 },
    transition: { duration: 0.28, ease: EASE }
};

export default function NowPlayingPanel() {
    const { player, queue, selected } = useNifty();
    const track = useStableTrack(player?.track || null);
    const trackMenu = useTrackMenu();
    const { onContextMenu } = useContextMenu(() => (track ? trackMenu(track, { source: "player" }) : []));

    const stateKey = !selected ? "noserver" : !track ? "empty" : "track";

    const art = track ? artworkOrFallback(track.artwork) : null;
    // Backfill "added by" from the matching queue entry if the player omitted it.
    const queued = track
        ? (queue.tracks || []).find((t) => t.track_id === queue.position || t.songUrl === track.songUrl)
        : null;
    const addedTrack = track ? { ...queued, ...track } : null;

    // One AnimatePresence so the not-playing states and a live track crossfade
    // into each other (and the cover + content crossfade between tracks).
    return (
        <AnimatePresence mode="wait" initial={false}>
            {stateKey === "noserver" ? (
                <motion.div key="noserver" {...panelFade} className="flex min-h-full">
                    <EmptyState icon="connect" title="Nothing selected" hint="Choose a server to see what's playing." />
                </motion.div>
            ) : stateKey === "empty" ? (
                <motion.div key="empty" {...panelFade} className="flex min-h-full">
                    <EmptyState icon="now-playing" title="Not playing" hint="Queue something to get started." />
                </motion.div>
            ) : (
                <motion.div key="track" {...panelFade} onContextMenu={onContextMenu} className="relative">
                    {/* the cover-art gradient backdrop is rendered by SlideTransition
                        (pinned, so it doesn't slide with the panel) */}

            {/* header lives inside the coloured area */}
            <div className="relative">
                <PanelHeader icon="now-playing" title="Now playing" />
            </div>

            {/* all the track content crossfades when the song changes.
                popLayout overlaps old + new (a true crossfade) and keeps timing
                identical whether the change came from us or from the bot. */}
            <div className="relative">
                <AnimatePresence mode="popLayout" initial={false}>
                    <motion.div
                        key={track.songUrl}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.28, ease: EASE }}
                        className="flex flex-col gap-4 p-4 pt-0"
                    >
                    <img
                        src={art}
                        onError={(e) => (e.currentTarget.src = artworkOrFallback(null))}
                        className="aspect-square w-full rounded-lg object-cover shadow-2xl"
                        alt=""
                    />

                    <div className="flex flex-col gap-1">
                        <a
                            href={track.songUrl}
                            target="_blank"
                            rel="noreferrer"
                            className="text-xl font-bold leading-tight text-maintext hover:underline"
                        >
                            {track.title}
                        </a>
                        <span className="text-sm text-subtext">{track.artist}</span>
                    </div>

                    <AddedBy track={addedTrack} size={22} className="text-xs text-subtext" />

                            <SongInfo track={track} />
                        </motion.div>
                    </AnimatePresence>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
