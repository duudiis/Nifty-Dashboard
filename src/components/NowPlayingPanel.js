import { useNifty } from "../context/NiftyContext.js";
import { artworkOrFallback } from "../lib/format.js";
import AddedBy from "./AddedBy.js";
import SongInfo from "./SongInfo.js";
import Icon from "./Icon.js";
import PanelHeader from "./layout/PanelHeader.js";
import { AnimatePresence, motion, EASE, DUR } from "./motion/index.js";
import { useContextMenu } from "./menu/ContextMenu.js";
import { useTrackMenu } from "./menu/trackMenu.js";

function EmptyState({ icon, title, hint }) {
    return (
        <div className="flex flex-1 flex-col items-center justify-center gap-3 p-8 text-center">
            <Icon name={icon} className="h-9 w-9 text-subtext/70" />
            <p className="text-sm font-bold text-maintext">{title}</p>
            <p className="text-xs text-subtext">{hint}</p>
        </div>
    );
}

export default function NowPlayingPanel() {
    const { player, queue, selected } = useNifty();
    const trackMenu = useTrackMenu();
    const { onContextMenu } = useContextMenu(() => (player?.track ? trackMenu(player.track, { source: "player" }) : []));

    if (!selected) {
        return <EmptyState icon="connect" title="Nothing selected" hint="Choose a server to see what's playing." />;
    }

    if (!player?.track) {
        return <EmptyState icon="now-playing" title="Not playing" hint="Queue something to get started." />;
    }

    const { track } = player;
    const art = artworkOrFallback(track.artwork);
    // Backfill "added by" from the matching queue entry if the player omitted it.
    const queued = (queue.tracks || []).find(
        (t) => t.track_id === queue.position || t.songUrl === track.songUrl
    );
    const addedTrack = { ...queued, ...track };

    return (
        <div onContextMenu={onContextMenu} className="relative">
            {/* large gradient backdrop drawn from the cover art's own colours,
                tall enough to sit behind the header and the cover. The blurred
                image crossfades between tracks. */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-[560px] overflow-hidden">
                <AnimatePresence initial={false}>
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
                </AnimatePresence>
                <div
                    className="absolute inset-0"
                    style={{ background: "linear-gradient(180deg, rgb(var(--c-surface) / 0.1) 0%, rgb(var(--c-surface) / 0.45) 62%, rgb(var(--c-surface)) 100%)" }}
                />
            </div>

            {/* header lives inside the coloured area */}
            <div className="relative">
                <PanelHeader icon="now-playing" title="Now playing" />
            </div>

            {/* all the track content crossfades when the song changes */}
            <AnimatePresence mode="wait">
                <motion.div
                    key={track.songUrl}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: DUR.base, ease: EASE }}
                    className="relative flex flex-col gap-4 p-4 pt-0"
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
    );
}
