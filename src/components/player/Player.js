import { useNifty } from "../../context/NiftyContext.js";
import { artworkOrFallback } from "../../lib/format.js";
import Icon from "../Icon.js";
import { motion, EASE, DUR } from "../motion/index.js";
import { useContextMenu } from "../menu/ContextMenu.js";
import { useTrackMenu } from "../menu/trackMenu.js";
import ProgressBar from "./ProgressBar.js";
import Volume from "./Volume.js";

/* ---- control buttons ---- */

function IconButton({ onClick, active, title, large, disabled, children }) {
    return (
        <button
            onClick={onClick}
            title={title}
            disabled={disabled}
            className={`flex items-center justify-center transition disabled:cursor-not-allowed disabled:opacity-40 ${
                large
                    ? "h-10 w-10 rounded-full bg-maintext text-canvas hover:scale-105 active:scale-95"
                    : active
                    ? "text-accent"
                    : "text-subtext hover:text-maintext"
            }`}
        >
            {children}
        </button>
    );
}

function Controls({ disabled }) {
    const { player, control } = useNifty();
    const playing = player?.playing;
    const loopActive = player?.loop && player.loop !== "disabled";

    return (
        <div className="flex items-center justify-center gap-4">
            <IconButton onClick={() => control("shuffle")} active={player?.shuffle} disabled={disabled} title="Shuffle">
                <Icon name="shuffle" className="h-[18px] w-[18px]" />
            </IconButton>

            <IconButton onClick={() => control("back")} disabled={disabled} title="Previous">
                <Icon name="prev" className="h-5 w-5" />
            </IconButton>

            <IconButton onClick={() => control("togglePause")} large disabled={disabled} title={playing ? "Pause" : "Play"}>
                <Icon name={playing ? "pause" : "play"} className="h-[18px] w-[18px]" />
            </IconButton>

            <IconButton onClick={() => control("skip")} disabled={disabled} title="Next">
                <Icon name="next" className="h-5 w-5" />
            </IconButton>

            <IconButton onClick={() => control("loop")} active={loopActive} disabled={disabled} title={`Loop: ${player?.loop || "off"}`}>
                <Icon name={player?.loop === "track" ? "loop-one" : "loop"} className="h-[18px] w-[18px]" />
            </IconButton>
        </div>
    );
}

function Song({ track, idle }) {
    const trackMenu = useTrackMenu();
    const onContextMenu = useContextMenu(() => (track ? trackMenu(track, { source: "player" }) : []));

    return (
        <div onContextMenu={onContextMenu} className="flex min-w-0 items-center gap-3">
            <img
                src={artworkOrFallback(track?.artwork)}
                onError={(e) => (e.currentTarget.src = artworkOrFallback(null))}
                className={`h-14 w-14 shrink-0 rounded-md object-cover shadow-md transition ${idle ? "opacity-50 saturate-0" : ""}`}
                alt=""
            />
            <div className="flex min-w-0 flex-col leading-tight">
                <span className={`truncate text-[13px] font-bold ${idle ? "text-subtext" : "text-maintext"}`}>
                    {track?.title || "Nothing playing"}
                </span>
                <span className="truncate text-[11px] text-subtext">
                    {track?.artist || (idle ? "Pick a track to get started" : "—")}
                </span>
            </div>
        </div>
    );
}

/* ---- player bar (always present, as a rounded surface box) ---- */

export default function Player() {
    const { player, selected } = useNifty();
    const track = player?.track || null;
    const idle = !track;

    return (
        <motion.div
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: DUR.slow, ease: EASE }}
            className="relative flex h-24 shrink-0 items-center gap-4 overflow-hidden rounded-lg bg-surface px-4"
        >
            <div className="w-[30%] min-w-0">
                <Song track={track} idle={idle} />
            </div>

            <div className="flex flex-1 flex-col items-center gap-2">
                <Controls disabled={idle} />
                {idle ? (
                    <div className="h-1 w-full max-w-xl rounded-full bg-border/60" />
                ) : (
                    <ProgressBar />
                )}
            </div>

            <div className="flex w-[30%] items-center justify-end gap-4">
                <Volume disabled={idle} />
            </div>

            {/* faint hint strip when nothing's playing */}
            {idle && (
                <span className="pointer-events-none absolute inset-x-0 bottom-1.5 text-center text-[10px] uppercase tracking-[0.2em] text-subtext/50">
                    {selected ? "Idle" : "Select a server"}
                </span>
            )}
        </motion.div>
    );
}
