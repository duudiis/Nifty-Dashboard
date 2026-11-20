// Neutral labels and small glyphs keep playback diagnostics out of the way.
const MAPS = {
    playEnd: {
        finished: { label: "Finished", icon: "check" },
        skipped: { label: "Skipped", icon: "next" },
        replaced: { label: "Replaced", icon: "play-next" },
        stopped: { label: "Stopped", icon: "pause" },
        error: { label: "Playback error", icon: "info" }
    },
    segStart: {
        track_start: { label: "Track started", icon: "play" },
        unpause: { label: "Resumed", icon: "play" },
        user_join: { label: "You joined", icon: "user" }
    },
    segEnd: {
        track_finish: { label: "Track finished", icon: "check" },
        replace: { label: "Next track", icon: "next" },
        pause: { label: "Paused", icon: "pause" },
        stop: { label: "Stopped", icon: "pause" },
        error: { label: "Playback error", icon: "info" },
        user_leave: { label: "You left", icon: "user" }
    },
    via: {
        dashboard: { label: "Added from dashboard", icon: "connect" },
        command: { label: "Added by command", icon: "music" },
        autoplay: { label: "Autoplay", icon: "infinity" }
    }
};

export function reasonInfo(kind, code) {
    if (!code) return { label: kind === "playEnd" || kind === "segEnd" ? "Still playing" : "Unknown", icon: "music" };
    return MAPS[kind]?.[code] || { label: String(code).replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()), icon: "info" };
}
