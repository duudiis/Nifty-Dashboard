import { useNifty } from "../context/NiftyContext.js";
import { msToClock, artworkOrFallback } from "../lib/format.js";

export default function NowPlayingPanel() {
    const { player, selected } = useNifty();

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

    return (
        <div className="flex flex-col gap-4 p-4">
            <img
                src={artworkOrFallback(track.artwork)}
                onError={(e) => (e.currentTarget.src = artworkOrFallback(null))}
                className="aspect-square w-full rounded-lg object-cover shadow-xl"
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
        </div>
    );
}
