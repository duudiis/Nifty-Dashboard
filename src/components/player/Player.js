import { useEffect, useRef, useState } from "react";
import { useTransform } from "framer-motion";

import { useNifty } from "../../context/NiftyContext.js";
import { artworkOrFallback } from "../../lib/format.js";
import { getYouTubeVideoId } from "../../lib/youtube.js";
import Icon from "../Icon.js";
import AddedBy from "../AddedBy.js";
import ArtistLink from "../browse/ArtistLink.js";
import { BackdropCrossfade, useDecodedArtwork } from "../artwork.js";
import Marquee from "../Marquee.js";
import { AnimatePresence, motion, useEntrance, EASE, useContentChange, useCrossfadeWeights } from "../motion/index.js";
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
                className="flex h-8 w-8 items-center justify-center rounded-full bg-maintext text-canvas transition active:scale-95 disabled:opacity-40"
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

    // First press restarts the current track; press again near the start to go to
    // the previous track (Spotify-style ~3s threshold).
    const onBack = () => {
        if ((player?.progress || 0) > 3000) control("seek", { position: 0 });
        else control("back");
    };

    return (
        <div className="flex items-center justify-center gap-4">
            <IconButton onClick={() => control("shuffle")} active={player?.shuffle} disabled={sideDisabled} title="Shuffle" className="mr-2">
                <Icon name="shuffle" className="h-[17px] w-[17px]" />
            </IconButton>

            <IconButton onClick={onBack} disabled={sideDisabled} title="Previous">
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
    const { isLiked, toggleLike } = useNifty();
    const trackMenu = useTrackMenu();
    const { onContextMenu, active } = useContextMenu(() => (track ? trackMenu(track, { source: "player" }) : []));

    const liked = track ? isLiked(track) : false;
    const art = useDecodedArtwork(artworkOrFallback(track?.artwork), { fallback: artworkOrFallback(null) });
    // Keep the title, artist link and requester mounted while the next song
    // settles into place. No opacity reset or second entrance after loading.
    const metadataY = useContentChange(track?.songUrl || track?.title, { distance: 6, duration: 0.28 });

    return (
        <div
            onContextMenu={onContextMenu}
            className={`group -mx-2 flex min-w-0 items-center gap-3 rounded-md px-2 py-1 transition ${active ? "bg-maintext/5" : ""}`}
        >
            <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-md bg-elevated shadow-md" data-player-art>
                <BackdropCrossfade identity={art} duration={0.2}>
                    {art && <img src={art} className="h-full w-full object-cover" alt="" />}
                </BackdropCrossfade>
            </div>
            <motion.div style={{ y: metadataY }} className="flex min-w-0 max-w-[14rem] flex-col leading-tight" data-player-metadata>
                <Marquee key={track?.songUrl || track?.title} text={track?.title || ""} className="text-[13px] font-bold text-maintext" />
                <ArtistLink name={track?.artist || "—"} className="text-[11px] text-subtext" />
            </motion.div>
            <button
                onClick={() => track && toggleLike(track)}
                title={liked ? "Remove from Liked songs" : "Save to Liked songs"}
                className={`shrink-0 transition-colors ${liked ? "text-accent" : "text-subtext hover:text-maintext"}`}
            >
                <Icon name={liked ? "heart-filled" : "heart"} className="h-4 w-4" />
            </button>
            <motion.div style={{ y: metadataY }} className="shrink-0">
                <AddedBy track={track} size={20} className="ml-2 w-24 text-[11px] text-subtext/80" />
            </motion.div>
        </div>
    );
}

/* ---- panel toggles + fullscreen ---- */

// Hoisted so it isn't a fresh component type each render (which would remount
// the buttons every progress tick and replay their hover transitions).
function Toggle({ icon, on, onClick, title, disabled }) {
    return (
        <button
            onClick={onClick}
            title={title}
            disabled={disabled}
            className={`relative flex items-center justify-center transition disabled:cursor-not-allowed disabled:opacity-40 ${on ? "text-accent" : "text-subtext hover:text-maintext"}`}
        >
            <Icon name={icon} className="h-[18px] w-[18px]" />
            {on && <ActiveDot />}
        </button>
    );
}

function PanelToggles() {
    const { view, setView, closeOverlay, settings, updateSettings, player } = useNifty();
    const rightPanel = settings.rightPanel;
    // Toggling a panel that's already open returns to the default (now playing).
    const togglePanel = (p) => updateSettings({ rightPanel: rightPanel === p ? "nowplaying" : p });
    // Watch only works for YouTube tracks; the toggle stays put regardless and
    // just disables — unless the view is already open, so it can be closed.
    const watchable = !!getYouTubeVideoId(player?.track?.songUrl);

    return (
        <div className="flex items-center gap-4">
            <Toggle icon="lyrics" title="Lyrics" on={view === "lyrics"} onClick={() => (view === "lyrics" ? closeOverlay() : setView("lyrics"))} />
            <Toggle
                icon="video"
                title={watchable || view === "watch" ? "Watch" : "Watch — YouTube tracks only"}
                on={view === "watch"}
                disabled={!watchable && view !== "watch"}
                onClick={() => (view === "watch" ? closeOverlay() : setView("watch"))}
            />
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
            <div className="absolute bottom-0 left-1/2 h-28 w-[55%] -translate-x-1/2 translate-y-1/2 rounded-[100%] bg-maintext/10 blur-3xl" />
        </div>
    );
}

function Prompt({ mode }) {
    const { inviteUrl, summon, selected, updateSettings } = useNifty();
    const [summoning, setSummoning] = useState(false);
    const summonTimer = useRef(null);

    useEffect(() => () => clearTimeout(summonTimer.current), []);

    const onSummon = () => {
        setSummoning(true);
        if (summon() === false) {
            setSummoning(false);
            return;
        }
        clearTimeout(summonTimer.current);
        summonTimer.current = setTimeout(() => setSummoning(false), 8000);
    };

    if (mode === "invite") {
        return (
            <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:gap-8 sm:text-left">
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
            <div className="flex flex-col items-center gap-3 text-center sm:flex-row sm:gap-8 sm:text-left">
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

function PromptFrame({ mode, current, weights }) {
    const opacity = useTransform(weights, (value) => value[mode] || 0);
    const visibility = useTransform(opacity, (value) => value <= 0 ? "hidden" : "visible");
    return (
        <motion.div
            style={{ opacity, visibility, mixBlendMode: "plus-lighter" }}
            className="pointer-events-none absolute inset-x-4 inset-y-0 flex items-center justify-center md:right-[21rem] xl:left-[21rem]"
            data-player-prompt={mode}
            aria-hidden={!current || undefined}
        >
            <div className={current ? "pointer-events-auto" : "pointer-events-none"}><Prompt mode={mode} /></div>
        </motion.div>
    );
}

// One clock controls every visible prompt. Independent enter/exit animations
// started on different frames and briefly dimmed (or brightened) the text.
// An interrupted dissolve starts from its actual painted mixture, preserving
// the opacity and identity of the layers already on screen.
function PromptSwap({ mode }) {
    const weights = useCrossfadeWeights(mode, { duration: 0.2 });
    return <div className="isolate">{["invite", "summon", "recommend"].map((name) => <PromptFrame key={name} mode={name} current={mode === name} weights={weights} />)}</div>;
}

export default function Player() {
    const reveal = useEntrance();
    const { player, queue, selected, sessions, control, jump, ready } = useNifty();
    const track = player?.track || null;
    const tracks = queue.tracks || [];
    const hasQueue = tracks.length > 0;

    const session = sessions.find((s) => String(s.guildId) === String(selected?.guildId)
        && String(s.botId || s.botName) === String(selected?.botId || selected?.botName)) || selected;
    const botHere = !!(session && session.botActive && session.sameChannel);

    let mode;
    if (track) mode = "playing";
    else if (!sessions.length) mode = "invite";
    else if (!botHere) mode = "summon";
    else if (hasQueue) mode = "ended";
    else mode = "recommend";

    const contextual = mode === "invite" || mode === "summon" || mode === "recommend";

    const queued = track ? tracks.find((t) => t.track_id === queue.position) : null;
    const songTrack = track ? { ...queued, ...track } : mode === "ended" ? tracks[0] : null;
    const ended = mode === "ended";
    const onPlayPause = ended
        ? () => jump(tracks[0]?.track_id ?? 0)
        : () => control("togglePause");

    return (
        <motion.div {...reveal} className="relative h-20 shrink-0">
            {ready && (
                <div className="absolute inset-0" data-player-mode={mode}>
                    {/* These layers stay mounted through every mode change.
                        Replacing the entire bar used to fade two glows and two
                        sets of panel buttons over one another. */}
                    <motion.div initial={false} animate={{ opacity: contextual ? 1 : 0 }} transition={{ duration: 0.2, ease: EASE }} className="pointer-events-none absolute inset-0">
                        <Glow />
                    </motion.div>

                    <div className="absolute inset-0 flex items-center gap-4 px-4">
                        <div className="relative flex h-16 min-w-0 flex-1 items-center">
                            <AnimatePresence initial={false}>
                                {!contextual && (
                                    <motion.div key="song" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, pointerEvents: "none" }} transition={{ duration: 0.18, ease: EASE }} className="absolute inset-x-0" data-player-song>
                                        <Song track={songTrack} />
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        <div className="relative h-14 w-[40%] max-w-xl">
                            <AnimatePresence initial={false}>
                                {!contextual && (
                                    <motion.div key="controls" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, pointerEvents: "none" }} transition={{ duration: 0.2, ease: EASE }} className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                                        <Controls
                                            playing={!ended && player?.playing}
                                            onPlayPause={onPlayPause}
                                            sideDisabled={ended}
                                            playDisabled={false}
                                        />
                                        <ProgressBar
                                            progress={ended ? 0 : undefined}
                                            duration={ended ? songTrack?.duration || 0 : undefined}
                                            disabled={ended}
                                        />
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>

                        <div className={`relative z-10 flex flex-1 items-center justify-end gap-4 ${contextual ? "invisible pointer-events-none md:visible md:pointer-events-auto" : ""}`}>
                            <PanelToggles />
                            <motion.div initial={false} animate={{ opacity: contextual ? 0 : 1 }} transition={{ duration: 0.2, ease: EASE }} className={contextual ? "pointer-events-none" : ""} aria-hidden={contextual}>
                                <Volume disabled={contextual || ended} />
                            </motion.div>
                            <FullscreenButton />
                        </div>
                    </div>

                    {/* Only the prompt text changes between Summon and Empty
                        queue. Its fixed box never participates in bar layout. */}
                    <PromptSwap mode={contextual ? mode : null} />
                </div>
            )}
        </motion.div>
    );
}
