import { useEffect, useRef, useState } from "react";

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

/* ---- control buttons ---- */

// Small accent dot under active toggles (Spotify-style); absolute so it never
// shifts the icon's position. Same size/offset everywhere it's used.
function ActiveDot() {
    return <span className="absolute -bottom-2 left-1/2 h-[3px] w-[3px] -translate-x-1/2 rounded-full bg-accent" />;
}

function IconButton({ onClick, active, title, large, disabled, className = "", children }) {
    if (large) {
        return (
            <button
                onClick={onClick}
                title={title}
                disabled={disabled}
                className="flex h-8 w-8 items-center justify-center rounded-full bg-maintext text-canvas transition hover:scale-105 active:scale-95 disabled:opacity-40 disabled:hover:scale-100"
            >
                {children}
            </button>
        );
    }
    return (
        <button
            onClick={onClick}
            title={title}
            disabled={disabled}
            className={`relative flex items-center justify-center transition disabled:cursor-not-allowed disabled:opacity-40 ${
                active ? "text-accent" : "text-subtext hover:text-maintext"
            } ${className}`}
        >
            {children}
            {active && <ActiveDot />}
        </button>
    );
}

function Controls({ playing, onPlayPause, sideDisabled, playDisabled }) {
    const { player, control } = useNifty();
    const loopActive = player?.loop && player.loop !== "disabled";

    return (
        <div className="flex items-center justify-center gap-4">
            <IconButton onClick={() => control("shuffle")} active={player?.shuffle} disabled={sideDisabled} title="Shuffle" className="mr-2">
                <Icon name="shuffle" className="h-[17px] w-[17px]" />
            </IconButton>

            <IconButton onClick={() => control("back")} disabled={sideDisabled} title="Previous">
                <Icon name="prev" className="h-[18px] w-[18px]" />
            </IconButton>

            <IconButton onClick={onPlayPause} large disabled={playDisabled} title={playing ? "Pause" : "Play"}>
                <Icon name={playing ? "pause" : "play"} className="h-[19px] w-[19px]" />
            </IconButton>

            <IconButton onClick={() => control("skip")} disabled={sideDisabled} title="Next">
                <Icon name="next" className="h-[18px] w-[18px]" />
            </IconButton>

            <IconButton onClick={() => control("loop")} active={loopActive} disabled={sideDisabled} title={`Loop: ${player?.loop || "off"}`} className="ml-2">
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

// Matches the Song layout (art + title + artist) for the brief stopped-state load.
function SongSkeleton() {
    return (
        <div className="-mx-2 flex min-w-0 items-center gap-3 px-2 py-1">
            <div className="h-14 w-14 shrink-0 animate-pulse rounded-md bg-elevated" />
            <div className="flex min-w-0 max-w-[14rem] flex-col gap-2">
                <div className="h-3 w-32 animate-pulse rounded bg-elevated" />
                <div className="h-2.5 w-20 animate-pulse rounded bg-elevated" />
            </div>
        </div>
    );
}

/* ---- panel toggles + fullscreen ---- */

// Hoisted so it isn't a fresh component type each render (which would remount
// the buttons every progress tick and replay their hover transitions).
function Toggle({ icon, on, onClick, title }) {
    return (
        <button
            onClick={onClick}
            title={title}
            className={`relative flex items-center justify-center transition ${on ? "text-accent" : "text-subtext hover:text-maintext"}`}
        >
            <Icon name={icon} className="h-[18px] w-[18px]" />
            {on && <ActiveDot />}
        </button>
    );
}

function PanelToggles() {
    const { view, setView, settings, updateSettings } = useNifty();
    const rightPanel = settings.rightPanel;
    // Toggling a panel that's already open returns to the default (now playing).
    const togglePanel = (p) => updateSettings({ rightPanel: rightPanel === p ? "nowplaying" : p });

    return (
        <div className="flex items-center gap-4">
            <Toggle icon="lyrics" title="Lyrics" on={view === "lyrics"} onClick={() => setView(view === "lyrics" ? "home" : "lyrics")} />
            <Toggle icon="queue" title="Queue" on={rightPanel === "queue"} onClick={() => togglePanel("queue")} />
            <Toggle icon="connect" title="Connect to a server" on={rightPanel === "connect"} onClick={() => togglePanel("connect")} />
        </div>
    );
}

function FullscreenButton() {
    const [fs, setFs] = useState(false);

    useEffect(() => {
        const handler = () => setFs(!!document.fullscreenElement);
        document.addEventListener("fullscreenchange", handler);
        return () => document.removeEventListener("fullscreenchange", handler);
    }, []);

    const toggle = () => {
        if (document.fullscreenElement) document.exitFullscreen?.();
        else document.documentElement.requestFullscreen?.();
    };

    return (
        <button
            onClick={toggle}
            title={fs ? "Exit fullscreen" : "Fullscreen"}
            className="flex items-center justify-center text-subtext transition hover:text-maintext"
        >
            <Icon name={fs ? "fullscreen-exit" : "fullscreen"} className="h-[18px] w-[18px]" />
        </button>
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
    const { inviteUrl, summon, selected, updateSettings } = useNifty();
    const [summoning, setSummoning] = useState(false);

    const onSummon = () => {
        setSummoning(true);
        summon();
        setTimeout(() => setSummoning(false), 8000); // re-enable if it didn't take
    };

    if (mode === "invite") {
        return (
            <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:gap-32 sm:text-left">
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
            <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:gap-32 sm:text-left">
                <div className="flex flex-col">
                    <span className="text-sm font-bold text-maintext">Ready when you are</span>
                    <span className="text-[11px] text-subtext">
                        Nifty isn&apos;t in{" "}
                        {selected?.voiceChannelName ? (
                            <span className="inline-flex items-center gap-0.5 align-middle font-medium text-maintext">
                                <Icon name="voice" className="h-3 w-3" /> {selected.voiceChannelName}
                            </span>
                        ) : (
                            "your channel"
                        )}{" "}
                        yet.{" "}
                        <button onClick={() => updateSettings({ rightPanel: "connect" })} className="text-subtext/50 transition hover:text-maintext">
                            Wrong channel?
                        </button>
                    </span>
                </div>
                <button
                    onClick={onSummon}
                    disabled={summoning}
                    className="flex shrink-0 items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-xs font-bold text-canvas transition hover:brightness-110 disabled:cursor-not-allowed disabled:opacity-60"
                >
                    {summoning && <Icon name="spinner" className="h-3.5 w-3.5 animate-spin" />}
                    {summoning ? "Summoning…" : "Summon Nifty"}
                </button>
            </div>
        );
    }

    // recommend (connected, queue empty)
    return (
        <div className="flex flex-col items-center gap-1 text-center">
            <span className="text-sm font-bold text-maintext">Nothing in the queue</span>
            <span className="text-[11px] text-subtext">
                Use{" "}
                <button
                    onClick={() => document.getElementById("nifty-search")?.focus()}
                    className="inline-flex items-center gap-1 align-middle font-medium text-maintext hover:underline"
                >
                    <Icon name="search" className="h-2.5 w-2.5" /> search
                </button>{" "}
                to add a song, album or artist.
            </span>
        </div>
    );
}

/* ---- player bar ---- */

export default function Player() {
    const { player, queue, selected, sessions, control } = useNifty();
    const track = player?.track || null;
    const tracks = queue.tracks || [];
    const hasQueue = tracks.length > 0;

    const session = sessions.find((s) => String(s.guildId) === String(selected?.guildId)) || selected;
    const botHere = !!(session && session.botActive && session.sameChannel);

    let mode;
    if (track) mode = "playing";
    else if (!sessions.length) mode = "invite";
    else if (!botHere) mode = "summon";
    else if (hasQueue) mode = "ended";
    else mode = "recommend";

    // Switching servers clears player/queue until the new server's data lands.
    // Hold a brief loading state so we don't flash an empty "Nothing in the
    // queue" prompt in that gap.
    const [switching, setSwitching] = useState(false);
    const prevGuild = useRef(selected?.guildId);
    useEffect(() => {
        if (prevGuild.current !== selected?.guildId) {
            prevGuild.current = selected?.guildId;
            if (selected?.guildId) setSwitching(true);
        }
    }, [selected?.guildId]);
    useEffect(() => {
        if (!switching) return;
        if (track || hasQueue) {
            setSwitching(false);
            return;
        }
        const t = setTimeout(() => setSwitching(false), 1000);
        return () => clearTimeout(t);
    }, [switching, track, hasQueue]);

    const contextual = !switching && (mode === "invite" || mode === "summon" || mode === "recommend");

    const queued = track && tracks.find((t) => t.track_id === queue.position || t.songUrl === track.songUrl);
    const songTrack = track ? { ...queued, ...track } : mode === "ended" ? tracks[0] : null;
    const ended = mode === "ended";
    const onPlayPause = ended
        ? () => control("jump", { trackId: tracks[0]?.track_id ?? 0 })
        : () => control("togglePause");

    // Brief skeleton when the queue stops, in case the bot is still settling.
    const [endedLoading, setEndedLoading] = useState(false);
    useEffect(() => {
        if (mode !== "ended") {
            setEndedLoading(false);
            return;
        }
        setEndedLoading(true);
        const t = setTimeout(() => setEndedLoading(false), 1000);
        return () => clearTimeout(t);
    }, [mode, tracks[0]?.songUrl]);

    const showSkeleton = (ended && endedLoading) || switching;

    return (
        <motion.div
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ duration: DUR.slow, ease: EASE }}
            className="relative h-20 shrink-0"
        >
            <AnimatePresence initial={false}>
                <motion.div
                    // playing and ended share one key so starting playback from
                    // the stopped state is seamless (no crossfade blink).
                    key={contextual ? mode : "player"}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.25, ease: EASE }}
                    className="absolute inset-0 flex items-center gap-4 px-4"
                >
                    {contextual ? (
                        <>
                            <Glow />
                            {/* equal flex-1 spacers on both sides keep the prompt in the
                                true centre of the bar, not just the space left of the toggles */}
                            <div className="flex-1" />
                            <div className="relative flex shrink-0 items-center justify-center">
                                <Prompt mode={mode} />
                            </div>
                            <div className="relative flex flex-1 items-center justify-end gap-4">
                                <PanelToggles />
                                <FullscreenButton />
                            </div>
                        </>
                    ) : (
                        <>
                            <div className="flex min-w-0 flex-1 items-center">
                                {/* skeleton <-> song crossfade (popLayout overlaps them);
                                    playing and loaded-ended share the "song" key, so
                                    switching between them doesn't re-animate. */}
                                <AnimatePresence mode="popLayout" initial={false}>
                                    {showSkeleton ? (
                                        <motion.div key="skeleton" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3, ease: EASE }} className="w-full">
                                            <SongSkeleton />
                                        </motion.div>
                                    ) : (
                                        <motion.div key="song" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} transition={{ duration: 0.3, ease: EASE }} className="w-full">
                                            <Song track={songTrack} />
                                        </motion.div>
                                    )}
                                </AnimatePresence>
                            </div>

                            <div className="flex w-[40%] max-w-xl flex-col items-center gap-2">
                                <Controls
                                    playing={!ended && player?.playing}
                                    onPlayPause={onPlayPause}
                                    sideDisabled={ended}
                                    playDisabled={showSkeleton}
                                />
                                {ended ? (
                                    <ProgressBar progress={0} duration={songTrack?.duration || 0} disabled />
                                ) : (
                                    <ProgressBar />
                                )}
                            </div>

                            <div className="flex flex-1 items-center justify-end gap-4">
                                <PanelToggles />
                                <Volume disabled={ended} />
                                <FullscreenButton />
                            </div>
                        </>
                    )}
                </motion.div>
            </AnimatePresence>
        </motion.div>
    );
}
