import { useNifty } from "../../context/NiftyContext.js";
import { artworkOrFallback } from "../../lib/format.js";
import Icon from "../Icon.js";
import AddedBy from "../AddedBy.js";
import Marquee from "../Marquee.js";
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
                    ? "h-9 w-9 rounded-full bg-maintext text-canvas hover:scale-105 active:scale-95"
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
                <Icon name="shuffle" className="h-[17px] w-[17px]" />
            </IconButton>

            <IconButton onClick={() => control("back")} disabled={disabled} title="Previous">
                <Icon name="prev" className="h-[18px] w-[18px]" />
            </IconButton>

            <IconButton onClick={() => control("togglePause")} large disabled={disabled} title={playing ? "Pause" : "Play"}>
                <Icon name={playing ? "pause" : "play"} className="h-[17px] w-[17px]" />
            </IconButton>

            <IconButton onClick={() => control("skip")} disabled={disabled} title="Next">
                <Icon name="next" className="h-[18px] w-[18px]" />
            </IconButton>

            <IconButton onClick={() => control("loop")} active={loopActive} disabled={disabled} title={`Loop: ${player?.loop || "off"}`}>
                <Icon name={player?.loop === "track" ? "loop-one" : "loop"} className="h-[17px] w-[17px]" />
            </IconButton>
        </div>
    );
}

function Song({ track, idle }) {
    const trackMenu = useTrackMenu();
    const { onContextMenu, active } = useContextMenu(() => (track ? trackMenu(track, { source: "player" }) : []));

    return (
        <div
            onContextMenu={onContextMenu}
            className={`-mx-2 flex min-w-0 items-center gap-3 rounded-md px-2 py-1 transition ${active ? "bg-white/5" : ""}`}
        >
            <img
                src={artworkOrFallback(track?.artwork)}
                onError={(e) => (e.currentTarget.src = artworkOrFallback(null))}
                className={`h-14 w-14 shrink-0 rounded-md object-cover shadow-md transition ${idle ? "opacity-50 saturate-0" : ""}`}
                alt=""
            />
            <div className="flex min-w-0 max-w-[14rem] flex-col leading-tight">
                <Marquee
                    text={track?.title || "Nothing playing"}
                    className={`text-[13px] font-bold ${idle ? "text-subtext" : "text-maintext"}`}
                />
                <span className="truncate text-[11px] text-subtext">
                    {track?.artist || (idle ? "Pick a track to get started" : "—")}
                </span>
            </div>
            {!idle && (
                <AddedBy track={track} size={20} className="ml-3 w-24 shrink-0 text-[11px] text-subtext/80" />
            )}
        </div>
    );
}

/* ---- panel toggles (mirror Spotify's bottom-right controls) ---- */

function PanelToggles() {
    const { view, setView, settings, updateSettings } = useNifty();
    const rightPanel = settings.rightPanel;

    const Toggle = ({ icon, on, onClick, title }) => (
        <button
            onClick={onClick}
            title={title}
            className={`flex items-center justify-center transition ${on ? "text-accent" : "text-subtext hover:text-maintext"}`}
        >
            <Icon name={icon} className="h-[18px] w-[18px]" />
        </button>
    );

    return (
        <div className="flex items-center gap-3">
            <Toggle
                icon="lyrics"
                title="Lyrics"
                on={view === "lyrics"}
                onClick={() => setView(view === "lyrics" ? "home" : "lyrics")}
            />
            <Toggle
                icon="queue"
                title="Queue"
                on={rightPanel === "queue"}
                onClick={() => updateSettings({ rightPanel: "queue" })}
            />
            <Toggle
                icon="now-playing"
                title="Now playing"
                on={rightPanel === "nowplaying"}
                onClick={() => updateSettings({ rightPanel: "nowplaying" })}
            />
            <Toggle
                icon="connect"
                title="Connect to a server"
                on={rightPanel === "connect"}
                onClick={() => updateSettings({ rightPanel: "connect" })}
            />
        </div>
    );
}

/* ---- player bar (always present; transparent so it blends with the frame) ---- */

export default function Player() {
    const { player, queue, selected } = useNifty();
    const track = player?.track || null;
    const idle = !track;

    // The player payload may omit "added by"; backfill it from the matching
    // queue entry so we can still show who requested the current track.
    const queued = track && (queue.tracks || []).find(
        (t) => t.track_id === queue.position || t.songUrl === track.songUrl
    );
    const songTrack = track ? { ...queued, ...track } : null;

    return (
        <motion.div
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: DUR.slow, ease: EASE }}
            className="relative flex h-20 shrink-0 items-center gap-4 px-4"
        >
            <div className="flex min-w-0 flex-1 items-center">
                <Song track={songTrack} idle={idle} />
            </div>

            <div className="flex w-[40%] max-w-xl flex-col items-center gap-1.5">
                <Controls disabled={idle} />
                {idle ? (
                    <div className="h-1 w-full rounded-full bg-border/60" />
                ) : (
                    <ProgressBar />
                )}
            </div>

            <div className="flex flex-1 items-center justify-end gap-4">
                <PanelToggles />
                <Volume disabled={idle} />
            </div>

            {idle && !selected && (
                <span className="pointer-events-none absolute inset-x-0 bottom-0 text-center text-[10px] uppercase tracking-[0.2em] text-subtext/50">
                    Select a server
                </span>
            )}
        </motion.div>
    );
}
