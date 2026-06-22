import { useState } from "react";

import { useNifty } from "../../context/NiftyContext.js";
import { artworkOrFallback } from "../../lib/format.js";
import Icon from "../Icon.js";
import AddedBy from "../AddedBy.js";
import Marquee from "../Marquee.js";
import { AnimatePresence, motion, EASE, DUR } from "../motion/index.js";
import { useContextMenu } from "../menu/ContextMenu.js";
import { useTrackMenu } from "../menu/trackMenu.js";
import ProgressBar from "./ProgressBar.js";
import Volume from "./Volume.js";

// Placeholder "recommendations" — no algorithm yet, just a designed prompt.
const SUGGESTIONS = [
    { title: "Blinding Lights", artist: "The Weeknd" },
    { title: "Get Lucky", artist: "Daft Punk" },
    { title: "Levitating", artist: "Dua Lipa" },
    { title: "As It Was", artist: "Harry Styles" },
    { title: "Bohemian Rhapsody", artist: "Queen" },
    { title: "Sunflower", artist: "Post Malone" }
];

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

function Controls({ playing, onPlayPause, sideDisabled }) {
    const { player, control } = useNifty();
    const loopActive = player?.loop && player.loop !== "disabled";

    return (
        <div className="flex items-center justify-center gap-4">
            <IconButton onClick={() => control("shuffle")} active={player?.shuffle} disabled={sideDisabled} title="Shuffle">
                <Icon name="shuffle" className="h-[17px] w-[17px]" />
            </IconButton>

            <IconButton onClick={() => control("back")} disabled={sideDisabled} title="Previous">
                <Icon name="prev" className="h-[18px] w-[18px]" />
            </IconButton>

            <IconButton onClick={onPlayPause} large title={playing ? "Pause" : "Play"}>
                <Icon name={playing ? "pause" : "play"} className="h-[17px] w-[17px]" />
            </IconButton>

            <IconButton onClick={() => control("skip")} disabled={sideDisabled} title="Next">
                <Icon name="next" className="h-[18px] w-[18px]" />
            </IconButton>

            <IconButton onClick={() => control("loop")} active={loopActive} disabled={sideDisabled} title={`Loop: ${player?.loop || "off"}`}>
                <Icon name={player?.loop === "track" ? "loop-one" : "loop"} className="h-[17px] w-[17px]" />
            </IconButton>
        </div>
    );
}

function Song({ track }) {
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
                className="h-14 w-14 shrink-0 rounded-md object-cover shadow-md"
                alt=""
            />
            <div className="flex min-w-0 max-w-[14rem] flex-col leading-tight">
                <Marquee text={track?.title || ""} className="text-[13px] font-bold text-maintext" />
                <span className="truncate text-[11px] text-subtext">{track?.artist || "—"}</span>
            </div>
            <AddedBy track={track} size={20} className="ml-3 w-24 shrink-0 text-[11px] text-subtext/80" />
        </div>
    );
}

/* ---- panel toggles (mirror Spotify's bottom-right controls) ---- */

// Hoisted so it isn't a fresh component type each render (which would remount
// the buttons every progress tick and replay their hover transitions).
function Toggle({ icon, on, onClick, title }) {
    return (
        <button
            onClick={onClick}
            title={title}
            className={`flex items-center justify-center transition ${on ? "text-accent" : "text-subtext hover:text-maintext"}`}
        >
            <Icon name={icon} className="h-[18px] w-[18px]" />
        </button>
    );
}

function PanelToggles() {
    const { view, setView, settings, updateSettings } = useNifty();
    const rightPanel = settings.rightPanel;

    return (
        <div className="flex items-center gap-3">
            <Toggle icon="lyrics" title="Lyrics" on={view === "lyrics"} onClick={() => setView(view === "lyrics" ? "home" : "lyrics")} />
            <Toggle icon="queue" title="Queue" on={rightPanel === "queue"} onClick={() => updateSettings({ rightPanel: "queue" })} />
            <Toggle icon="now-playing" title="Now playing" on={rightPanel === "nowplaying"} onClick={() => updateSettings({ rightPanel: "nowplaying" })} />
            <Toggle icon="connect" title="Connect to a server" on={rightPanel === "connect"} onClick={() => updateSettings({ rightPanel: "connect" })} />
        </div>
    );
}

/* ---- contextual prompts (no track playing) ---- */

// A soft gray light glowing up from the bottom centre.
function Glow() {
    return (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="absolute bottom-0 left-1/2 h-28 w-[55%] -translate-x-1/2 translate-y-1/2 rounded-[100%] bg-white/10 blur-3xl" />
        </div>
    );
}

function Prompt({ mode }) {
    const { inviteUrl, summon, play, selected, updateSettings } = useNifty();
    const [summoning, setSummoning] = useState(false);

    const onSummon = () => {
        setSummoning(true);
        summon();
        setTimeout(() => setSummoning(false), 8000); // re-enable if it didn't take
    };

    if (mode === "invite") {
        return (
            <div className="flex flex-col items-center gap-2 text-center sm:flex-row sm:gap-3 sm:text-left">
                <div className="flex flex-col">
                    <span className="text-sm font-bold text-maintext">I can&apos;t see you anywhere!</span>
                    <span className="text-[11px] text-subtext">Invite Nifty to your server and hop into a voice channel.</span>
                </div>
                <a
                    href={inviteUrl || "#"}
                    target="_blank"
                    rel="noreferrer"
                    className={`shrink-0 rounded-full bg-accent px-4 py-2 text-xs font-bold text-canvas transition hover:brightness-110 ${inviteUrl ? "" : "pointer-events-none opacity-40"}`}
                >
                    Invite Nifty
                </a>
            </div>
        );
    }

    if (mode === "summon") {
        return (
            <div className="flex flex-col items-center gap-2 text-center sm:flex-row sm:gap-3 sm:text-left">
                <div className="flex flex-col">
                    <span className="text-sm font-bold text-maintext">Ready when you are</span>
                    <span className="text-[11px] text-subtext">
                        Nifty isn&apos;t in {selected?.voiceChannelName ? `#${selected.voiceChannelName}` : "your channel"} yet.{" "}
                        <button
                            onClick={() => updateSettings({ rightPanel: "connect" })}
                            className="font-bold text-maintext underline-offset-2 hover:underline"
                        >
                            Wrong channel?
                        </button>
                    </span>
                </div>
                <button
                    onClick={onSummon}
                    disabled={summoning}
                    className="flex shrink-0 items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-xs font-bold text-canvas transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {summoning && <Icon name="sync" className="h-3.5 w-3.5 animate-spin" />}
                    {summoning ? "Summoning…" : "Summon Nifty"}
                </button>
            </div>
        );
    }

    // recommend
    return (
        <div className="flex w-full flex-col items-center gap-1.5">
            <span className="text-[10px] font-bold uppercase tracking-wide text-subtext">Nothing queued — try one of these</span>
            <div className="flex max-w-full items-center gap-2 overflow-x-auto px-1 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                {SUGGESTIONS.map((s) => (
                    <button
                        key={`${s.title}-${s.artist}`}
                        onClick={() => play(`ytmsearch:${s.title} ${s.artist}`, "queue")}
                        className="group flex shrink-0 items-center gap-2 rounded-full bg-elevated px-3 py-1.5 text-left transition hover:bg-surface"
                    >
                        <Icon name="enqueue" className="h-3.5 w-3.5 text-subtext group-hover:text-accent" />
                        <span className="flex flex-col leading-tight">
                            <span className="text-[12px] font-bold text-maintext">{s.title}</span>
                            <span className="text-[10px] text-subtext">{s.artist}</span>
                        </span>
                    </button>
                ))}
            </div>
        </div>
    );
}

/* ---- player bar ---- */

export default function Player() {
    const { player, queue, selected, sessions, control } = useNifty();
    const track = player?.track || null;
    const tracks = queue.tracks || [];
    const hasQueue = tracks.length > 0;

    // Fresh session info for the selected guild (botActive / sameChannel).
    const session = sessions.find((s) => String(s.guildId) === String(selected?.guildId)) || selected;
    const botHere = !!(session && session.botActive && session.sameChannel);

    let mode;
    if (track) mode = "playing";
    else if (!sessions.length) mode = "invite";
    else if (!botHere) mode = "summon";
    else if (hasQueue) mode = "ended";
    else mode = "recommend";

    const contextual = mode === "invite" || mode === "summon" || mode === "recommend";

    // "playing" uses the live track; "ended" pins the first queued track, paused
    // at 0:00, where Play restarts the queue (jump, not unpause).
    const queued = track && tracks.find((t) => t.track_id === queue.position || t.songUrl === track.songUrl);
    const songTrack = track ? { ...queued, ...track } : mode === "ended" ? tracks[0] : null;
    const ended = mode === "ended";
    const onPlayPause = ended
        ? () => control("jump", { trackId: tracks[0]?.track_id ?? 0 })
        : () => control("togglePause");

    return (
        <motion.div
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: DUR.slow, ease: EASE }}
            className="relative h-20 shrink-0"
        >
            <AnimatePresence initial={false}>
                <motion.div
                    key={mode}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25, ease: EASE }}
                    className="absolute inset-0 flex items-center gap-4 px-4"
                >
                    {contextual ? (
                        <>
                            <Glow />
                            <div className="relative flex min-w-0 flex-1 items-center justify-center">
                                <Prompt mode={mode} />
                            </div>
                            <div className="relative flex shrink-0 items-center justify-end gap-4">
                                <PanelToggles />
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="flex min-w-0 flex-1 items-center">
                                <Song track={songTrack} />
                            </div>

                            <div className="flex w-[40%] max-w-xl flex-col items-center gap-1.5">
                                <Controls playing={!ended && player?.playing} onPlayPause={onPlayPause} sideDisabled={ended} />
                                {ended ? (
                                    <ProgressBar progress={0} duration={songTrack?.duration || 0} disabled />
                                ) : (
                                    <ProgressBar />
                                )}
                            </div>

                            <div className="flex flex-1 items-center justify-end gap-4">
                                <PanelToggles />
                                <Volume disabled={ended} />
                            </div>
                        </>
                    )}
                </motion.div>
            </AnimatePresence>
        </motion.div>
    );
}
