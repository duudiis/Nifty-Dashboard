import { useCallback, useEffect, useRef, useState } from "react";

import { useNifty } from "../../context/NiftyContext.js";
import { getYouTubeVideoId, loadYouTubeIframeAPI } from "../../lib/youtube.js";
import { AnimatePresence, motion, EASE } from "../motion/index.js";

// The bot stays the single source of truth: the embed mirrors the player state
// it already pushes (play/pause/seek/track changes plus the 1s progress
// updates) — no timers of our own. The expected position is interpolated on
// the wall clock between pushes, so corrections work from the real "now", not
// a progress value that may be up to a second stale.
//
// Corrections come in two strengths. Small drift (buffering after a load put
// the video a second or two behind) is caught up smoothly by nudging the
// playback rate — no visible seek, no rebuffer. Large drift gets a hard seek.
const DRIFT_SOFT_MS = 450;  // start rate-nudging beyond this…
const DRIFT_LOCK_MS = 150;  // …and return to 1x once back within this
const DRIFT_HARD_MS = 3000; // beyond this, hard-seek instead
const RATE_UP = 1.25;       // catch-up rate when behind
const RATE_DOWN = 0.75;     // slow-down rate when ahead

// YT.PlayerState values (the enum object isn't available until the API loads).
const YT_ENDED = 0;
const YT_PLAYING = 1;
const YT_PAUSED = 2;
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
    const readyRef = useRef(false);
    const [failed, setFailed] = useState(false); // embedding disabled / bad id
    const rateRef = useRef(1); // playback rate currently applied to the embed

    // Latest playback state for the async player callbacks.
    const liveRef = useRef({ videoId, playing, progress });
    liveRef.current = { videoId, playing, progress };

    // Wall-clock base for interpolating the bot position between pushes.
    // (Runs before the sync effects below — effect order matters.)
    const clockRef = useRef({ p: 0, t: 0, playing: false });
    useEffect(() => {
        clockRef.current = { p: progress, t: performance.now(), playing };
    }, [progress, playing]);

    // One correction pass: compare the embed to the interpolated bot position
    // and nudge / seek as needed. Reads refs only, so it's safe to call from
    // the player's own event callbacks.
    const syncNow = useCallback(() => {
        const yt = ytRef.current;
        if (!yt || !readyRef.current) return;
        const state = yt.getPlayerState?.();
        const clock = clockRef.current;
        const expected = clock.playing ? clock.p + (performance.now() - clock.t) : clock.p;
        const drift = (yt.getCurrentTime?.() || 0) * 1000 - expected; // >0 = embed ahead
        const abs = Math.abs(drift);

        if (state === YT_CUED) {
            // Paused before first play: keep the cue point near the bot position
            // (seeking a cued video would start it, so re-cue instead).
            if (abs > DRIFT_HARD_MS) {
                yt.cueVideoById({ videoId: liveRef.current.videoId, startSeconds: expected / 1000 });
            }
            return;
        }
        if (state === YT_ENDED) return; // video shorter than the track — let it sit

        if (state !== YT_PLAYING) {
            // Paused: snap the frame if it's clearly off (stays paused). While
            // buffering, leave it alone — it's already heading somewhere.
            if (state === YT_PAUSED && abs > DRIFT_SOFT_MS) yt.seekTo(expected / 1000, true);
            return;
        }

        let target;
        if (abs >= DRIFT_HARD_MS) {
            yt.seekTo(expected / 1000, true);
            target = 1;
        } else if (rateRef.current === 1) {
            target = abs > DRIFT_SOFT_MS ? (drift < 0 ? RATE_UP : RATE_DOWN) : 1;
        } else {
            // Already nudging — hold until we're locked back on.
            target = abs > DRIFT_LOCK_MS ? (drift < 0 ? RATE_UP : RATE_DOWN) : 1;
        }
        if (target !== rateRef.current) {
            rateRef.current = target;
            yt.setPlaybackRate?.(target);
        }
    }, []);

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
                videoId: liveRef.current.videoId,
                playerVars: {
                    // Native controls stay available (volume, captions, quality)
                    // but playback is enforced from the bot's state below, so
                    // pausing or seeking the embed just snaps back in sync.
                    // Muted by default — the shared audio comes from Discord.
                    mute: 1,
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
                        const clock = clockRef.current;
                        const expected = clock.playing ? clock.p + (performance.now() - clock.t) : clock.p;
                        e.target.mute();
                        if (live.playing) {
                            e.target.seekTo(expected / 1000, true);
                            e.target.playVideo();
                        } else {
                            // Re-cue at the bot position — seeking a cued video
                            // would start it playing.
                            e.target.cueVideoById({ videoId: live.videoId, startSeconds: expected / 1000 });
                        }
                        readyRef.current = true;
                        setReady(true);
                    },
                    onError: () => setFailed(true),
                    onStateChange: (e) => {
                        const live = liveRef.current;
                        if (e.data === YT_PLAYING) {
                            // Either buffering just ended (correct whatever the
                            // load time cost us) or someone pressed play on the
                            // embed while the bot is paused (undo it).
                            if (!live.playing) e.target.pauseVideo();
                            else syncNow();
                        } else if (e.data === YT_PAUSED && live.playing) {
                            // Paused via the embed's own UI — the bot decides.
                            e.target.playVideo();
                        } else if (e.data === YT_CUED && live.playing) {
                            // Autoplay didn't take (policy hiccup) — try again.
                            e.target.playVideo();
                        }
                    }
                }
            });
        });
        return () => { stale = true; };
    }, [videoId, syncNow]);

    useEffect(() => () => {
        try { ytRef.current?.destroy(); } catch {}
        ytRef.current = null;
        readyRef.current = false;
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
        rateRef.current = 1;
        const target = { videoId, startSeconds: liveRef.current.progress / 1000 };
        if (liveRef.current.playing) yt.loadVideoById(target);
        else yt.cueVideoById(target);
    }, [videoId, ready]);

    // Mirror play / pause from the bot.
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

    // Correction pass on every progress push (1Hz while playing, plus seeks).
    useEffect(() => {
        if (!failed) syncNow();
    }, [progress, ready, failed, syncNow]);

    // Decide what to show, then crossfade between states below.
    let mode;
    if (!selected || !track) mode = "notrack";
    else if (!videoId) mode = "notvideo";
    else if (failed) mode = "failed";
    else mode = "video";

    return (
        <div className="relative h-full overflow-hidden">
            {/* The video stays mounted across states so the player (and its
                sync position) survives brief track transitions. */}
            <div className={`absolute inset-0 transition-opacity duration-300 ${mode === "video" ? "opacity-100" : "pointer-events-none opacity-0"}`}>
                <div ref={hostRef} className="absolute inset-0 [&>iframe]:h-full [&>iframe]:w-full" />
                {!ready && <div className="skeleton-shimmer absolute inset-0" />}
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
