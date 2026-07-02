import { useCallback, useEffect, useRef, useState } from "react";

import { useNifty } from "../../context/NiftyContext.js";
import { getYouTubeVideoId, loadYouTubeIframeAPI } from "../../lib/youtube.js";
import { AnimatePresence, motion, EASE } from "../motion/index.js";

// Sync is two-way. The bot remains the shared source of truth — its pushes
// (play/pause/seek/track changes plus the 1s progress updates) drive the
// embed, with positions interpolated on the wall clock between pushes. But
// the embed's own controls talk back: pausing, playing or seeking with the
// YouTube UI forwards that action to the bot instead of being snapped back.
//
// Corrections (bot → embed) come in two strengths. Small drift (buffering
// after a load) is caught up smoothly by nudging the playback rate — no
// visible seek, no rebuffer. Large drift gets a hard seek. To tell a user's
// seek apart from our own corrections, every programmatic seek/load is
// timestamped and the embed's clock is watched for jumps we didn't cause.
const DRIFT_SOFT_MS = 450;  // start rate-nudging beyond this…
const DRIFT_LOCK_MS = 150;  // …and return to 1x once back within this
const DRIFT_HARD_MS = 3000; // beyond this, hard-seek instead
const RATE_UP = 1.25;       // catch-up rate when behind
const RATE_DOWN = 0.75;     // slow-down rate when ahead
const USER_SEEK_MS = 2000;       // embed-clock jump that reads as a user seek
const SELF_SEEK_GRACE_MS = 3000; // our own seeks/loads settle within this
const SELF_CMD_GRACE_MS = 1500;  // our own play/pause commands settle within this

// YT.PlayerState values (the enum object isn't available until the API loads).
const YT_ENDED = 0;
const YT_PLAYING = 1;
const YT_PAUSED = 2;
const YT_BUFFERING = 3;
const YT_CUED = 5;

export default function WatchView() {
    const { player, selected, control } = useNifty();
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
    // The embed flashes plenty while it boots (white iframe, player chrome,
    // thumbnail, black buffering). An opaque cover hides all of it and fades
    // out once — when the video actually plays, or the cued poster is the
    // steady state.
    const [revealed, setRevealed] = useState(false);
    // Timestamps of our own commands, so their effects aren't mistaken for
    // user interaction with the embed.
    const selfSeekRef = useRef(0); // last programmatic seek / load / cue
    const selfCmdRef = useRef(0);  // last programmatic play / pause
    // The embed's own clock as last observed — a jump we didn't cause means
    // the user seeked with the YouTube UI.
    const videoClockRef = useRef({ v: 0, t: 0, rate: 1, playing: false });

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
    // and nudge / seek as needed — or, if the embed's clock jumped on its own,
    // forward that user seek to the bot. Reads refs only, so it's safe to call
    // from the player's own event callbacks.
    const syncNow = useCallback(() => {
        const yt = ytRef.current;
        if (!yt || !readyRef.current) return;
        const state = yt.getPlayerState?.();
        const clock = clockRef.current;
        const now = performance.now();
        const expected = clock.playing ? clock.p + (now - clock.t) : clock.p;
        const actual = (yt.getCurrentTime?.() || 0) * 1000;
        const drift = actual - expected; // >0 = embed ahead
        const abs = Math.abs(drift);

        // A discontinuity in the embed's own clock that we didn't cause is the
        // user dragging the YouTube seek bar — follow them on the bot instead
        // of snapping the video back.
        const vc = videoClockRef.current;
        const predicted = vc.playing ? vc.v + (now - vc.t) * vc.rate : vc.v;
        const jumped = vc.t > 0 && Math.abs(actual - predicted) > USER_SEEK_MS;
        videoClockRef.current = { v: actual, t: now, rate: rateRef.current, playing: state === YT_PLAYING };
        if (
            jumped &&
            now - selfSeekRef.current > SELF_SEEK_GRACE_MS &&
            state !== YT_CUED &&
            state !== YT_ENDED &&
            abs > DRIFT_SOFT_MS
        ) {
            control("seek", { position: Math.round(actual) });
            // Optimistic local clock, until the bot's push confirms it.
            clockRef.current = { ...clock, p: actual, t: now };
            return;
        }

        if (state === YT_CUED) {
            // Paused before first play: keep the cue point near the bot position
            // (seeking a cued video would start it, so re-cue instead).
            if (abs > DRIFT_HARD_MS) {
                selfSeekRef.current = now;
                yt.cueVideoById({ videoId: liveRef.current.videoId, startSeconds: expected / 1000 });
            }
            return;
        }
        if (state === YT_ENDED) return; // video shorter than the track — let it sit

        if (state !== YT_PLAYING) {
            // Paused: snap the frame if it's clearly off (stays paused). While
            // buffering, leave it alone — it's already heading somewhere.
            if (state === YT_PAUSED && abs > DRIFT_SOFT_MS) {
                selfSeekRef.current = now;
                yt.seekTo(expected / 1000, true);
            }
            return;
        }

        let target;
        if (abs >= DRIFT_HARD_MS) {
            selfSeekRef.current = now;
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
    }, [control]);

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
                    // Full native controls, keyboard and fullscreen included —
                    // pause/play/seek on the embed forwards to the bot (see
                    // onStateChange / syncNow), so everyone follows along.
                    // Muted by default — the shared audio comes from Discord.
                    mute: 1,
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
                        // Captions start off (undocumented but long-standing);
                        // the CC button still turns them on.
                        try {
                            e.target.unloadModule("captions");
                            e.target.unloadModule("cc");
                        } catch {}
                        if (live.playing) {
                            selfSeekRef.current = performance.now();
                            selfCmdRef.current = performance.now();
                            e.target.seekTo(expected / 1000, true);
                            e.target.playVideo();
                        } else {
                            // Re-cue at the bot position — seeking a cued video
                            // would start it playing. The poster is the steady
                            // state while paused, so show it.
                            selfSeekRef.current = performance.now();
                            e.target.cueVideoById({ videoId: live.videoId, startSeconds: expected / 1000 });
                            setRevealed(true);
                        }
                        readyRef.current = true;
                        setReady(true);
                    },
                    onError: () => setFailed(true),
                    onStateChange: (e) => {
                        const live = liveRef.current;
                        const settling = performance.now() - selfCmdRef.current < SELF_CMD_GRACE_MS;
                        if (e.data === YT_PLAYING) {
                            setRevealed(true);
                            if (!live.playing) {
                                // Play pressed on the embed while the bot is
                                // paused — resume the bot for everyone. (Unless
                                // one of our own commands is still settling.)
                                if (settling) e.target.pauseVideo();
                                else control("togglePause");
                            } else {
                                syncNow(); // buffering ended — settle the drift
                            }
                        } else if (e.data === YT_PAUSED) {
                            if (live.playing && !settling) {
                                // Paused via the embed — pause the bot too.
                                control("togglePause");
                            } else if (!live.playing) {
                                // Seeks while paused land here; follow a jump.
                                syncNow();
                            }
                        } else if (e.data === YT_CUED && live.playing) {
                            // Autoplay didn't take (policy hiccup) — try again.
                            selfCmdRef.current = performance.now();
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
        selfSeekRef.current = performance.now();
        selfCmdRef.current = performance.now();
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
            if (state !== YT_PLAYING) {
                selfCmdRef.current = performance.now();
                yt.playVideo?.();
            }
        } else if (state === YT_PLAYING || state === YT_BUFFERING) {
            selfCmdRef.current = performance.now();
            yt.pauseVideo?.();
        }
    }, [playing, ready]);

    // Correction pass on every progress push (1Hz while playing, plus seeks).
    useEffect(() => {
        if (!failed) syncNow();
    }, [progress, ready, failed, syncNow]);

    // If nothing confirms playback shortly after the player is ready (autoplay
    // hiccup, very slow buffer), drop the cover anyway rather than shimmering
    // forever over a working player.
    useEffect(() => {
        if (!ready || revealed) return;
        const t = setTimeout(() => setRevealed(true), 4000);
        return () => clearTimeout(t);
    }, [ready, revealed]);

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
                {/* Opaque loading cover: hides every boot-up flash of the embed
                    underneath, then fades away in one clean pass. */}
                <div className={`pointer-events-none absolute inset-0 z-10 bg-black transition-opacity duration-500 ${revealed ? "opacity-0" : "opacity-100"}`}>
                    <div className="skeleton-shimmer absolute inset-0" />
                </div>
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
