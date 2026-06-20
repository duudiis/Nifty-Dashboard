import { useNifty } from "../context/NiftyContext.js";
import { artworkOrFallback } from "../lib/format.js";
import AddedBy from "./AddedBy.js";
import SongInfo from "./SongInfo.js";
import { useContextMenu } from "./menu/ContextMenu.js";
import { useTrackMenu } from "./menu/trackMenu.js";

export default function NowPlayingPanel() {
    const { player, queue, selected } = useNifty();
    const trackMenu = useTrackMenu();
    const { onContextMenu } = useContextMenu(() => (player?.track ? trackMenu(player.track, { source: "player" }) : []));

    if (!selected) {
        return (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
                <p className="text-sm font-bold text-maintext">Nothing selected</p>
                <p className="text-xs text-subtext">Choose a server to see what&apos;s playing.</p>
            </div>
        );
    }

    if (!player?.track) {
        return (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
                <p className="text-sm font-bold text-maintext">Not playing</p>
                <p className="text-xs text-subtext">Queue something to get started.</p>
            </div>
        );
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
                tall enough to sit behind the header and the cover */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-[560px] overflow-hidden">
                <img src={art} className="h-full w-full scale-[1.7] object-cover opacity-55 blur-3xl saturate-150" alt="" />
                <div
                    className="absolute inset-0"
                    style={{ background: "linear-gradient(180deg, rgb(var(--c-surface) / 0.1) 0%, rgb(var(--c-surface) / 0.45) 62%, rgb(var(--c-surface)) 100%)" }}
                />
            </div>

            {/* header lives inside the coloured area */}
            <div className="relative px-4 py-3 text-sm font-bold text-maintext">Now playing</div>

            <div className="relative flex flex-col gap-4 p-4 pt-1">
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
            </div>
        </div>
    );
}
