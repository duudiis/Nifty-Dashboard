import { useNifty } from "../context/NiftyContext.js";
import { artworkOrFallback } from "../lib/format.js";
import AddedBy from "./AddedBy.js";
import SongInfo from "./SongInfo.js";
import { NowPlayingSkeleton } from "./Loader.js";
import Icon from "./Icon.js";
import PanelHeader from "./layout/PanelHeader.js";
import { LoadingSwap, motion, useContentChange } from "./motion/index.js";
import { BackdropCrossfade, useDecodedArtwork } from "./artwork.js";
import { useContextMenu } from "./menu/ContextMenu.js";
import { useTrackMenu } from "./menu/trackMenu.js";

// The player context already retains short gaps between tracks. Artwork has a
// separate readiness boundary: don't replace painted pixels until the next
// image is decoded, even when its title has already arrived.
export function NowPlayingBackdrop() {
    const { player } = useNifty();
    const source = player?.track ? artworkOrFallback(player.track.artwork) : null;
    const art = useDecodedArtwork(source, { retainOnEmpty: false });

    return (
        <div className="pointer-events-none absolute inset-x-0 top-0 h-[560px] overflow-hidden">
            <BackdropCrossfade identity={art}>
                {art && <img src={art} className="absolute inset-0 h-full w-full scale-[1.7] object-cover opacity-[0.55] blur-3xl saturate-150" alt="" />}
            </BackdropCrossfade>
            <div className="absolute inset-0" style={{ background: "linear-gradient(180deg, rgb(var(--c-surface) / 0.1) 0%, rgb(var(--c-surface) / 0.45) 62%, rgb(var(--c-surface)) 100%)" }} />
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

export default function NowPlayingPanel() {
    const { player, queue, selected, ready, stateLoaded } = useNifty();
    const track = player?.track || null;
    const trackMenu = useTrackMenu();
    const { onContextMenu } = useContextMenu(() => (track ? trackMenu(track, { source: "player" }) : []));
    const art = useDecodedArtwork(track ? artworkOrFallback(track.artwork) : null, { fallback: artworkOrFallback(null), retainOnEmpty: false });
    const queued = track
        ? (queue.tracks || []).find((item) => item.songUrl === track.songUrl)
        : null;
    const addedTrack = track ? { ...queued, ...track } : null;
    const metadataY = useContentChange(track?.songUrl || track?.title, { duration: 0.3 });

    return (
        <LoadingSwap loading={!ready || (!!selected && stateLoaded === false)} fallback={<NowPlayingSkeleton />} className="flex min-h-full flex-col" contentClassName="flex flex-1 flex-col">
            {!selected ? (
                <EmptyState icon="connect" title="Nothing selected" hint="Choose a server to see what's playing." />
            ) : !track ? (
                <EmptyState icon="now-playing" title="Not playing" hint="Queue something to get started." />
            ) : (
                <div onContextMenu={onContextMenu} className="relative" data-now-playing-content>
                    <PanelHeader icon="now-playing" title="Now playing" />
                    {/* The decoded cover dissolves independently from the
                        metadata movement; fetched facts and menus stay mounted. */}
                    <div className="flex flex-col gap-4 p-4 pt-0">
                        <div className="relative aspect-square w-full overflow-hidden rounded-lg bg-elevated shadow-2xl" data-now-playing-art>
                            <BackdropCrossfade identity={art} duration={0.28}>
                                {art && <img src={art} className="h-full w-full object-cover" alt="" />}
                            </BackdropCrossfade>
                        </div>
                        <motion.div style={{ y: metadataY }} className="flex flex-col gap-4" data-now-playing-metadata>
                            <div className="flex flex-col gap-1">
                                <a href={track.songUrl} target="_blank" rel="noreferrer" className="text-xl font-bold leading-tight text-maintext hover:underline">
                                    {track.title}
                                </a>
                                <span className="text-sm text-subtext">{track.artist}</span>
                            </div>
                            <AddedBy track={addedTrack} size={22} className="text-xs text-subtext" />
                        </motion.div>
                        <SongInfo track={track} />
                    </div>
                </div>
            )}
        </LoadingSwap>
    );
}
