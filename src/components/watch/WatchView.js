import { useEffect, useRef, useState } from "react";

import { useNifty } from "../../context/NiftyContext.js";
import { getYouTubeVideoId, loadYouTubeIframeAPI } from "../../lib/youtube.js";
import Icon from "../Icon.js";
import { AnimatePresence, motion, EASE } from "../motion/index.js";

// The bot stays the single source of truth: the embed only mirrors the player
// state it already pushes (play/pause/seek/track changes plus the 1s progress
// updates) — no timers of our own. A correction only fires once the embed has
// drifted noticeably, so a healthy stream is never interrupted.
const DRIFT_MS = 1200;

// YT.PlayerState values (the enum object isn't available until the API loads).
const YT_ENDED = 0;
const YT_PLAYING = 1;
const YT_BUFFERING = 3;
const YT_CUED = 5;

export default function WatchView() {
    const { player, selected } = useNifty();
    const track = player?.track || null;
    const videoId = getYouTubeVideoId(track?.songUrl);
    const playing = !!player?.playing;
    const progress = player?.progress || 0;

    const hostRef = useRef(null); // wrapper the API replaces with its iframe
    const ytRef = useRef(null);   // YT.Player instance
    const [ready, setReady] = useState(false);
    const [failed, setFailed] = useState(false); // embedding disabled / bad id
    // Muted by default — the audio everyone hears comes from Discord.
    const [muted, setMuted] = useState(true);

    // Latest playback state for the async player callbacks.
    const liveRef = useRef({ videoId, playing, progress });
    liveRef.current = { videoId, playing, progress };

    // Create the player the first time a YouTube track is on screen. It's then
    // reused across track changes (load/cue) and destroyed only on unmount.
    useEffect(() => {
        if (!videoId || ytRef.current) return;
        let stale = false;
        loadYouTubeIframeAPI().then((YT) => {
            if (stale || ytRef.current || !hostRef.current) return;
            const mount = document.createElement("div");
            hostRef.current.appendChild(mount);
            ytRef.current = new YT.Player(mount, {
                width: "100%",
                height: "100%",
                host: "https://www.youtube-nocookie.com",
                videoId: liveRef.current.videoId,
                playerVars: {
                    // No native controls / keyboard / fullscreen: playback is
                    // driven from the dashboard's player bar so everyone stays
                    // on the bot's clock.
                    controls: 0,
                    disablekb: 1,
                    fs: 0,
                    rel: 0,
                    iv_load_policy: 3,
                    playsinline: 1,
                    origin: window.location.origin
                },
                events: {
                    onReady: (e) => {
                        const live = liveRef.current;
                        e.target.mute();
                        if (live.playing) {
                            e.target.seekTo(live.progress / 1000, true);
                            e.target.playVideo();
                        } else {
                            // Re-cue at the bot position — seeking a cued video
                            // would start it playing.
                            e.target.cueVideoById({ videoId: live.videoId, startSeconds: live.progress / 1000 });
                        }
                        setReady(true);
                    },
                    onError: () => setFailed(true)
                }
            });
        });
        return () => { stale = true; };
    }, [videoId]);

    useEffect(() => () => {
        try { ytRef.current?.destroy(); } catch {}
        ytRef.current = null;
    }, []);

    // Follow track changes once the player exists.
    useEffect(() => {
        const yt = ytRef.current;
        if (!yt || !ready) return;
        if (!videoId) {
            // Bot moved on to a non-YouTube track — don't keep playing hidden.
            try { yt.stopVideo(); } catch {}
            return;
        }
        setFailed(false);
        if (getYouTubeVideoId(yt.getVideoUrl?.()) === videoId) return;
        const target = { videoId, startSeconds: liveRef.current.progress / 1000 };
        if (liveRef.current.playing) yt.loadVideoById(target);
        else yt.cueVideoById(target);
    }, [videoId, ready]);

    // Mirror play / pause.
    useEffect(() => {
        const yt = ytRef.current;
        if (!yt || !ready) return;
        const state = yt.getPlayerState?.();
        if (playing) {
            if (state !== YT_PLAYING) yt.playVideo?.();
        } else if (state === YT_PLAYING || state === YT_BUFFERING) {
            yt.pauseVideo?.();
        }
    }, [playing, ready]);

    // Keep the embed on the bot's clock. `progress` moves once a second while
    // playing (and on seeks), so every update is a correction opportunity.
    useEffect(() => {
        const yt = ytRef.current;
        if (!yt || !ready || failed) return;
        const state = yt.getPlayerState?.();
        if (state === YT_ENDED) return; // video shorter than the track — let it sit
        const actual = (yt.getCurrentTime?.() || 0) * 1000;
        if (Math.abs(actual - progress) <= DRIFT_MS) return;
        if (state === YT_CUED) {
            yt.cueVideoById({ videoId: liveRef.current.videoId, startSeconds: progress / 1000 });
        } else {
            yt.seekTo(progress / 1000, true);
        }
    }, [progress, ready, failed]);

    const toggleMute = () => {
        const yt = ytRef.current;
        if (!yt || !ready) return;
        if (muted) yt.unMute?.();
        else yt.mute?.();
        setMuted(!muted);
    };

    // Decide what to show, then crossfade between states below.
    let mode;
    if (!selected || !track) mode = "notrack";
    else if (!videoId) mode = "notvideo";
    else if (failed) mode = "failed";
    else mode = "video";

    return (
        <div className="relative h-full overflow-hidden">
            {/* The video box stays mounted across states so the player (and its
                sync position) survives brief track transitions. */}
            <div className={`absolute inset-4 transition-opacity duration-300 sm:inset-8 ${mode === "video" ? "opacity-100" : "pointer-events-none opacity-0"}`}>
                <div className="absolute inset-0 overflow-hidden rounded-xl bg-black shadow-2xl">
                    <div ref={hostRef} className="absolute inset-0 [&>iframe]:h-full [&>iframe]:w-full" />
                    {!ready && <div className="skeleton-shimmer absolute inset-0" />}
                    {/* Shield: swallows every click so YouTube's own UI is
                        unreachable — playback belongs to the player bar. */}
                    <div className="absolute inset-0 z-10" title="Use the player controls below" />
                </div>
                <button
                    onClick={toggleMute}
                    title={muted ? "Unmute the video (the bot keeps playing in Discord)" : "Mute the video"}
                    className="absolute bottom-4 right-4 z-20 flex items-center gap-2 rounded-full bg-white/15 px-4 py-2 text-sm font-bold text-white shadow-lg backdrop-blur-md transition hover:bg-white/25"
                >
                    <Icon name={muted ? "volume-mute" : "volume"} className="h-4 w-4" />
                    {muted ? "Unmute" : "Mute"}
                </button>
            </div>

            <AnimatePresence initial={false}>
                {mode !== "video" && (
                    <motion.div
                        key={mode}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.3, ease: EASE }}
                        className="absolute inset-0 flex flex-col items-center justify-center p-8 text-center"
                    >
                        <p className="text-lg font-bold text-white/70">
                            {mode === "notrack"
                                ? "No track playing"
                                : mode === "notvideo"
                                ? "This track isn't a YouTube video"
                                : "This video can't be embedded"}
                        </p>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
