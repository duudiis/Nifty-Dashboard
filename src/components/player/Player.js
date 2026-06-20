import { useNifty } from "../../context/NiftyContext.js";
import { artworkOrFallback } from "../../lib/format.js";
import ProgressBar from "./ProgressBar.js";
import Volume from "./Volume.js";

/* ---- control buttons ---- */

function IconButton({ onClick, active, title, large, children }) {
    return (
        <button
            onClick={onClick}
            title={title}
            className={`flex items-center justify-center transition ${large ? "h-9 w-9 rounded-full bg-maintext text-canvas hover:scale-105" : `${active ? "text-accent" : "text-subtext hover:text-maintext"}`}`}
        >
            {children}
        </button>
    );
}

function Controls({ compact }) {
    const { player, control } = useNifty();
    const playing = player?.playing;
    const loopActive = player?.loop && player.loop !== "disabled";

    return (
        <div className="flex items-center justify-center gap-3">
            {!compact && (
                <IconButton onClick={() => control("shuffle")} active={player?.shuffle} title="Shuffle">
                    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
                        <path d="M17 3h4v4l-1.5-1.5L7 18H3v-2h3.2L18.6 4.5 17 3Zm-9.8 4.6L3 4l1.4-1.4 4.2 4.2L7.2 7.6ZM21 17v4h-4l1.5-1.5L15 16.4l1.4-1.4 3.1 3.1L21 17Z" />
                    </svg>
                </IconButton>
            )}

            <IconButton onClick={() => control("back")} title="Previous">
                <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
                    <path d="M7 6h2v12H7V6Zm3.5 6 8.5 6V6l-8.5 6Z" />
                </svg>
            </IconButton>

            <IconButton onClick={() => control("togglePause")} large title={playing ? "Pause" : "Play"}>
                {playing ? (
                    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
                        <path d="M7 5h3v14H7V5Zm7 0h3v14h-3V5Z" />
                    </svg>
                ) : (
                    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
                        <path d="M8 5v14l11-7L8 5Z" />
                    </svg>
                )}
            </IconButton>

            <IconButton onClick={() => control("skip")} title="Next">
                <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
                    <path d="M15 6h2v12h-2V6ZM5 6l8.5 6L5 18V6Z" />
                </svg>
            </IconButton>

            {!compact && (
                <IconButton onClick={() => control("loop")} active={loopActive} title={`Loop: ${player?.loop || "off"}`}>
                    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
                        <path d="M7 7h10v3l4-4-4-4v3H5v6h2V7Zm10 10H7v-3l-4 4 4 4v-3h12v-6h-2v4Z" />
                        {player?.loop === "track" && <circle cx="12" cy="12" r="2.2" />}
                    </svg>
                </IconButton>
            )}
        </div>
    );
}

function Song({ track, compact }) {
    return (
        <div className="flex min-w-0 items-center gap-3">
            <img
                src={artworkOrFallback(track?.artwork)}
                onError={(e) => (e.currentTarget.src = artworkOrFallback(null))}
                className={`shrink-0 rounded object-cover ${compact ? "h-10 w-10" : "h-14 w-14"}`}
                alt=""
            />
            <div className="flex min-w-0 flex-col leading-tight">
                <span className="truncate text-[13px] font-bold text-maintext">{track?.title || "Nothing playing"}</span>
                <span className="truncate text-[11px] text-subtext">{track?.artist || "—"}</span>
            </div>
        </div>
    );
}

/* ---- player bar ---- */

export default function Player() {
    const { player, selected, settings, updateSettings } = useNifty();

    // No bar until a server is chosen.
    if (!selected) return null;

    const track = player?.track || null;
    const compact = settings.compact;

    const CompactToggle = (
        <button
            onClick={() => updateSettings({ compact: !compact })}
            title={compact ? "Expand player" : "Compact player"}
            className="text-subtext transition hover:text-maintext"
        >
            <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
                {compact ? (
                    <path d="M4 9V4h5L7 6l3 3-1.4 1.4-3-3L4 9Zm16 6v5h-5l2-2-3-3 1.4-1.4 3 3L20 15Z" />
                ) : (
                    <path d="M9 4 7 6l3 3-1.4 1.4-3-3L4 9V4h5Zm6 16 2-2-3-3 1.4-1.4 3 3L20 15v5h-5Z" />
                )}
            </svg>
        </button>
    );

    if (compact) {
        return (
            <div className="player-slide-in relative shrink-0 border-t border-border bg-surface">
                <div className="absolute left-0 right-0 top-0">
                    <ProgressBar showTimes={false} thin />
                </div>
                <div className="flex h-14 items-center justify-between gap-4 px-4 pt-1">
                    <div className="w-1/3 min-w-0"><Song track={track} compact /></div>
                    <Controls compact />
                    <div className="flex w-1/3 items-center justify-end gap-3">
                        <Volume />
                        {CompactToggle}
                    </div>
                </div>
            </div>
        );
    }

    return (
        <div className="player-slide-in flex h-24 shrink-0 items-center gap-4 border-t border-border bg-surface px-4">
            <div className="w-[30%] min-w-0">
                <Song track={track} />
            </div>

            <div className="flex flex-1 flex-col items-center gap-2">
                <Controls />
                <ProgressBar />
            </div>

            <div className="flex w-[30%] items-center justify-end gap-4">
                <Volume />
                {CompactToggle}
            </div>
        </div>
    );
}
