import { useEffect, useRef, useState } from "react";

import { useNifty } from "../../context/NiftyContext.js";
import { artworkOrFallback } from "../../lib/format.js";
import { progressAt } from "../../lib/playbackState.js";

// Registers the dashboard with the system's media controls (Media Session), so
// the keyboard's play / pause / next / previous keys, headset buttons and the
// OS "now playing" card drive Nifty and show what the bot is playing.
//
// The music itself plays in Discord, not in this tab — and a browser only
// hands media keys to a page that is playing something. So while the bot
// plays, this tab loops a silent track; it pauses with the bot, which is what
// tells the system "paused" rather than "nothing here".
//
// Everything is pushed on change (track, play/pause, seek). The system works
// out the running position itself from the last position and rate we gave it,
// so nothing here ticks.
//
// Controlled by settings.mediaKeys (Settings → Playback). Renders nothing.

const SEEK_STEP_MS = 10_000;
const RESTART_AFTER_MS = 3_000; // "previous" restarts the song once it is this far in

// Ten seconds of digital silence as a WAV (16-bit mono, 8 kHz ≈ 160 KB).
function silentTrackUrl(seconds = 10, rate = 8000) {
    const bytes = seconds * rate * 2;
    const view = new DataView(new ArrayBuffer(44 + bytes));
    const text = (offset, value) => [...value].forEach((char, i) => view.setUint8(offset + i, char.charCodeAt(0)));
    text(0, "RIFF"); view.setUint32(4, 36 + bytes, true); text(8, "WAVEfmt ");
    view.setUint32(16, 16, true); view.setUint16(20, 1, true); view.setUint16(22, 1, true);
    view.setUint32(24, rate, true); view.setUint32(28, rate * 2, true);
    view.setUint16(32, 2, true); view.setUint16(34, 16, true);
    text(36, "data"); view.setUint32(40, bytes, true);
    return URL.createObjectURL(new Blob([view.buffer], { type: "audio/wav" }));
}

export const mediaKeysSupported = () => typeof navigator !== "undefined" && "mediaSession" in navigator;

export default function MediaKeys() {
    const { player, control, selected, settings } = useNifty();
    const enabled = settings.mediaKeys !== false && mediaKeysSupported();
    const track = player?.track || null;
    const playing = !!track && !!player.playing;
    const trackKey = track ? track.songUrl || `${track.title}|${track.artist}` : null;

    // Handlers are registered once and read the latest state from here.
    const latest = useRef({});
    latest.current = { player, control };

    /* ---- the silent carrier track ---- */
    const audioRef = useRef(null);
    useEffect(() => {
        if (!enabled) return;
        const url = silentTrackUrl();
        const audio = new Audio(url);
        audio.loop = true;
        audioRef.current = audio;
        return () => {
            audio.pause();
            audio.removeAttribute("src");
            audioRef.current = null;
            URL.revokeObjectURL(url);
        };
    }, [enabled]);

    // Follow the bot: play while it plays, pause when it pauses or stops.
    // Browsers only let a page start audio after the user has interacted with
    // it, so a refused start is retried on the next click or key press.
    useEffect(() => {
        const audio = audioRef.current;
        if (!enabled || !audio) return;
        if (!playing) { audio.pause(); return; }

        let cancelled = false;
        const retry = () => { if (!cancelled) audio.play().catch(() => {}); };
        audio.play().catch(() => {
            if (cancelled) return;
            window.addEventListener("pointerdown", retry, { once: true });
            window.addEventListener("keydown", retry, { once: true });
        });
        return () => {
            cancelled = true;
            window.removeEventListener("pointerdown", retry);
            window.removeEventListener("keydown", retry);
        };
    }, [enabled, playing]);

    /* ---- what is playing ---- */
    // The album isn't in the bot's payload; the server already resolves and
    // caches it for the Now playing panel.
    const [album, setAlbum] = useState(null);
    useEffect(() => {
        setAlbum(null);
        if (!enabled || !track) return;
        if (track.album) { setAlbum(track.album); return; }
        let stale = false;
        const query = new URLSearchParams({ title: track.title || "", artist: track.artist || "" });
        fetch(`/api/songinfo?${query}`)
            .then((response) => (response.ok ? response.json() : null))
            .then((info) => { if (!stale && info?.itunes?.album) setAlbum(info.itunes.album); })
            .catch(() => {});
        return () => { stale = true; };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, trackKey]);

    useEffect(() => {
        if (!enabled) return;
        if (!track) { navigator.mediaSession.metadata = null; return; }
        navigator.mediaSession.metadata = new MediaMetadata({
            title: track.title || "Unknown title",
            artist: track.artist || "",
            album: album || selected?.guildName || "Nifty",
            artwork: [{ src: new URL(artworkOrFallback(track.artwork), window.location.href).href, sizes: "512x512" }]
        });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [enabled, trackKey, track?.title, track?.artist, track?.artwork, album, selected?.guildName]);

    /* ---- playing / paused, and where in the song ---- */
    useEffect(() => {
        if (!enabled) return;
        navigator.mediaSession.playbackState = !track ? "none" : playing ? "playing" : "paused";
        const duration = (track?.duration || 0) / 1000;
        if (!duration || !navigator.mediaSession.setPositionState) return;
        try {
            navigator.mediaSession.setPositionState({
                duration,
                playbackRate: player.speed || 1,
                position: Math.min(duration, progressAt(player) / 1000)
            });
        } catch { /* a position the browser rejects is not worth breaking playback over */ }
        // `player` changes identity on every real update (track, pause, seek).
    }, [enabled, player, track, playing]);

    /* ---- the keys ---- */
    useEffect(() => {
        if (!enabled) return;
        const session = navigator.mediaSession;
        const now = () => latest.current.player;
        const send = (...args) => latest.current.control(...args);
        const seekTo = (ms) => {
            const duration = now()?.track?.duration || 0;
            if (duration) send("seek", { position: Math.round(Math.min(duration, Math.max(0, ms))) });
        };
        const handlers = {
            play: () => { if (now()?.track && !now().playing) send("togglePause"); },
            pause: () => { if (now()?.track && now().playing) send("togglePause"); },
            stop: () => { if (now()?.track && now().playing) send("togglePause"); },
            nexttrack: () => send("skip"),
            previoustrack: () => (progressAt(now()) > RESTART_AFTER_MS ? send("seek", { position: 0 }) : send("back")),
            seekto: (details) => seekTo((details.seekTime || 0) * 1000),
            seekforward: (details) => seekTo(progressAt(now()) + (details.seekOffset ? details.seekOffset * 1000 : SEEK_STEP_MS)),
            seekbackward: (details) => seekTo(progressAt(now()) - (details.seekOffset ? details.seekOffset * 1000 : SEEK_STEP_MS))
        };
        // A browser that doesn't know an action throws on registering it.
        const set = (action, handler) => { try { session.setActionHandler(action, handler); } catch { /* unsupported action */ } };
        Object.entries(handlers).forEach(([action, handler]) => set(action, handler));
        return () => {
            Object.keys(handlers).forEach((action) => set(action, null));
            session.metadata = null;
            session.playbackState = "none";
        };
    }, [enabled]);

    return null;
}
