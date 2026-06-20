import { useNifty } from "../context/NiftyContext.js";
import { msToClock, artworkOrFallback } from "../lib/format.js";
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
            {/* gradient backdrop drawn from the cover art's own colours */}
            <div className="pointer-events-none absolute inset-x-0 top-0 h-80 overflow-hidden">
                <img src={art} className="h-full w-full scale-[1.6] object-cover opacity-50 blur-2xl saturate-150" alt="" />
                <div
                    className="absolute inset-0"
                    style={{ background: "linear-gradient(180deg, rgb(var(--c-surface) / 0.2) 0%, rgb(var(--c-surface) / 0.7) 55%, rgb(var(--c-surface)) 100%)" }}
                />
            </div>

            <div className="relative flex flex-col gap-4 p-4">
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

                <div className="flex items-center justify-between text-[11px] text-subtext">
                    <span>{msToClock(player.progress)}</span>
                    <span>{msToClock(track.duration)}</span>
                </div>

                <div className="flex flex-wrap gap-2 text-[11px]">
                    {player.loop && player.loop !== "disabled" && (
                        <span className="rounded-full bg-elevated px-2 py-1 text-subtext">Loop: {player.loop}</span>
                    )}
                    {player.shuffle && (
                        <span className="rounded-full bg-elevated px-2 py-1 text-subtext">Shuffle on</span>
                    )}
                    <span className="rounded-full bg-elevated px-2 py-1 text-subtext">Volume {player.volume}%</span>
                </div>

                <SongInfo track={track} />
            </div>
        </div>
    );
}
