// Friendly labels + colour tones for the raw reason codes the bot logs.
// Tones are literal Tailwind class strings (kept whole so the JIT sees them).

const TONE = {
    green:  "bg-emerald-500/15 text-emerald-300 ring-emerald-500/20",
    amber:  "bg-amber-500/15 text-amber-300 ring-amber-500/20",
    rose:   "bg-rose-500/15 text-rose-300 ring-rose-500/20",
    sky:    "bg-sky-500/15 text-sky-300 ring-sky-500/20",
    violet: "bg-violet-500/15 text-violet-300 ring-violet-500/20",
    slate:  "bg-white/10 text-subtext ring-white/10"
};

// Why a track's playback ended (track_plays.end_reason).
const PLAY_END = {
    finished: { label: "Finished",  tone: "green" },
    skipped:  { label: "Skipped",   tone: "amber" },
    replaced: { label: "Replaced",  tone: "amber" },
    stopped:  { label: "Stopped",   tone: "rose" },
    error:    { label: "Error",     tone: "rose" }
};

// Why the user's listening span opened (listening_segments.start_reason).
const SEG_START = {
    track_start: { label: "Track started", tone: "violet" },
    unpause:     { label: "Resumed",       tone: "sky" },
    user_join:   { label: "You joined",    tone: "green" }
};

// Why the user's listening span closed (listening_segments.end_reason).
const SEG_END = {
    track_finish: { label: "Track finished", tone: "green" },
    replace:      { label: "Next track",     tone: "amber" },
    pause:        { label: "Paused",         tone: "sky" },
    stop:         { label: "Stopped",        tone: "rose" },
    error:        { label: "Error",          tone: "rose" },
    user_leave:   { label: "You left",       tone: "rose" }
};

// How the track got into the queue (queue_history.via).
const VIA = {
    dashboard: { label: "via Dashboard", tone: "violet" },
    command:   { label: "via Command",   tone: "sky" },
    autoplay:  { label: "Autoplay",      tone: "slate" }
};

const MAPS = { playEnd: PLAY_END, segStart: SEG_START, segEnd: SEG_END, via: VIA };

function titleCase(raw) {
    return String(raw).replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

/**
 * Resolves a raw reason code to { label, cls } for a pill. Unknown or missing
 * codes fall back to a neutral slate pill so nothing renders blank.
 */
export function reasonInfo(kind, code) {
    if (!code) return { label: "Unknown", cls: TONE.slate };
    const hit = MAPS[kind]?.[code];
    const tone = hit ? hit.tone : "slate";
    return { label: hit ? hit.label : titleCase(code), cls: TONE[tone] };
}
