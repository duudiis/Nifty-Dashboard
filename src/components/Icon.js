// Central icon set. One consistent 24x24 grid with ~2px of built-in padding so
// nothing ever clips against the viewBox edge, and `overflow-visible` as a
// belt-and-braces guard for the few glyphs that round outward.
//
// Color is driven by `currentColor`, so set the color with a text-* class
// (e.g. `text-subtext`, `text-accent`) — not fill-*. Glyphs marked `fill: true`
// render solid (play / pause / volume cone); the rest are stroked outlines.
//
// Usage: <Icon name="play" className="h-5 w-5" />

import { forwardRef } from "react";

const ICONS = {
    // --- transport ---
    play: { fill: true, body: <polygon points="6 4 20 12 6 20 6 4" /> },
    pause: {
        fill: true,
        body: (
            <>
                <rect x="6" y="4" width="4" height="16" rx="1.2" />
                <rect x="14" y="4" width="4" height="16" rx="1.2" />
            </>
        )
    },
    next: {
        fill: true,
        body: (
            <>
                <polygon points="5 4 15 12 5 20 5 4" />
                <line x1="19" y1="5" x2="19" y2="19" />
            </>
        )
    },
    prev: {
        fill: true,
        body: (
            <>
                <polygon points="19 4 9 12 19 20 19 4" />
                <line x1="5" y1="5" x2="5" y2="19" />
            </>
        )
    },
    shuffle: {
        body: (
            <>
                <path d="M2 18h1.6c1.3 0 2.5-.65 3.3-1.75l5.2-7c.8-1.1 2-1.75 3.3-1.75H22" />
                <path d="m18.5 3 3.5 3.5L18.5 10" />
                <path d="M2 6h1.6c1.3 0 2.5.65 3.3 1.75l.6.8" />
                <path d="M22 18h-4.6c-1.3 0-2.5-.65-3.3-1.75l-.6-.8" />
                <path d="m18.5 14 3.5 3.5-3.5 3.5" />
            </>
        )
    },
    loop: {
        body: (
            <>
                <path d="m17 3 3.5 3.5L17 10" />
                <path d="M3.5 11.5v-1A4.5 4.5 0 0 1 8 6h12.5" />
                <path d="m7 21-3.5-3.5L7 14" />
                <path d="M20.5 12.5v1a4.5 4.5 0 0 1-4.5 4.5H3.5" />
            </>
        )
    },
    "loop-one": {
        body: (
            <>
                <path d="m17 3 3.5 3.5L17 10" />
                <path d="M3.5 11.5v-1A4.5 4.5 0 0 1 8 6h12.5" />
                <path d="m7 21-3.5-3.5L7 14" />
                <path d="M20.5 12.5v1a4.5 4.5 0 0 1-4.5 4.5H3.5" />
                <path d="M11.2 10.2 12.5 9.5V15" />
            </>
        )
    },

    // --- volume ---
    volume: {
        fill: true,
        body: (
            <>
                <polygon points="11 5 6 9 3 9 3 15 6 15 11 19 11 5" />
                <path fill="none" d="M15.5 8.5a5 5 0 0 1 0 7" />
                <path fill="none" d="M18.5 5.5a9 9 0 0 1 0 13" />
            </>
        )
    },
    "volume-low": {
        fill: true,
        body: (
            <>
                <polygon points="11 5 6 9 3 9 3 15 6 15 11 19 11 5" />
                <path fill="none" d="M15.5 8.5a5 5 0 0 1 0 7" />
            </>
        )
    },
    "volume-mute": {
        fill: true,
        body: (
            <>
                <polygon points="11 5 6 9 3 9 3 15 6 15 11 19 11 5" />
                <line fill="none" x1="22" y1="9" x2="16" y2="15" />
                <line fill="none" x1="16" y1="9" x2="22" y2="15" />
            </>
        )
    },

    // --- navigation ---
    home: {
        body: (
            <>
                <path d="m3 10 9-7 9 7v9a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <path d="M9 21v-7h6v7" />
            </>
        )
    },
    search: {
        body: (
            <>
                <circle cx="11" cy="11" r="7" />
                <line x1="20.5" y1="20.5" x2="16" y2="16" />
            </>
        )
    },
    queue: {
        body: (
            <>
                <line x1="4" y1="6" x2="15" y2="6" />
                <line x1="4" y1="12" x2="15" y2="12" />
                <line x1="4" y1="18" x2="11" y2="18" />
                <circle cx="18" cy="16.5" r="2.5" />
                <path d="M20.5 16.5V7l-4 1.2" />
            </>
        )
    },
    library: {
        body: (
            <>
                <rect x="3" y="3" width="7" height="7" rx="1.3" />
                <rect x="14" y="3" width="7" height="7" rx="1.3" />
                <rect x="14" y="14" width="7" height="7" rx="1.3" />
                <rect x="3" y="14" width="7" height="7" rx="1.3" />
            </>
        )
    },
    mic: {
        body: (
            <>
                <rect x="9" y="3" width="6" height="11" rx="3" />
                <path d="M19 11a7 7 0 0 1-14 0" />
                <line x1="12" y1="18" x2="12" y2="21" />
            </>
        )
    },
    music: {
        body: (
            <>
                <path d="M9 18V6l11-2v12" />
                <circle cx="6" cy="18" r="3" />
                <circle cx="17" cy="16" r="3" />
            </>
        )
    },
    "chevron-down": { body: <path d="m6 9.5 6 6 6-6" /> },
    user: {
        body: (
            <>
                <circle cx="12" cy="8" r="4" />
                <path d="M4.5 20.5a7.5 7.5 0 0 1 15 0" />
            </>
        )
    },
    lyrics: {
        body: (
            <>
                <rect x="3" y="4.5" width="18" height="15" rx="2.5" />
                <path d="M7 10h6" />
                <path d="M7 14h4" />
                <path d="M16 9.5v5" />
                <circle cx="14.5" cy="14.5" r="1.4" />
            </>
        )
    },
    "now-playing": {
        body: (
            <>
                <path d="M9 17V6l9-1.6V15" />
                <circle cx="6.5" cy="17" r="2.5" />
                <circle cx="15.5" cy="15" r="2.5" />
            </>
        )
    },
    info: {
        body: (
            <>
                <circle cx="12" cy="12" r="9" />
                <path d="M12 16v-4" />
                <path d="M12 8h.01" />
            </>
        )
    },
    x: {
        body: (
            <>
                <line x1="18" y1="6" x2="6" y2="18" />
                <line x1="6" y1="6" x2="18" y2="18" />
            </>
        )
    },

    // --- account / settings ---
    settings: {
        body: (
            <>
                <path d="M12.2 3h-.4a1.8 1.8 0 0 0-1.8 1.8 1.6 1.6 0 0 1-.8 1.4 1.6 1.6 0 0 1-1.6 0 1.8 1.8 0 0 0-2.4.66l-.2.34a1.8 1.8 0 0 0 .66 2.46 1.6 1.6 0 0 1 .8 1.4 1.6 1.6 0 0 1-.8 1.4 1.8 1.8 0 0 0-.66 2.46l.2.34a1.8 1.8 0 0 0 2.4.66 1.6 1.6 0 0 1 1.6 0 1.6 1.6 0 0 1 .8 1.4A1.8 1.8 0 0 0 11.8 21h.4a1.8 1.8 0 0 0 1.8-1.8 1.6 1.6 0 0 1 .8-1.4 1.6 1.6 0 0 1 1.6 0 1.8 1.8 0 0 0 2.4-.66l.2-.34a1.8 1.8 0 0 0-.66-2.46 1.6 1.6 0 0 1-.8-1.4 1.6 1.6 0 0 1 .8-1.4 1.8 1.8 0 0 0 .66-2.46l-.2-.34a1.8 1.8 0 0 0-2.4-.66 1.6 1.6 0 0 1-1.6 0 1.6 1.6 0 0 1-.8-1.4A1.8 1.8 0 0 0 12.2 3Z" />
                <circle cx="12" cy="12" r="3" />
            </>
        )
    },
    logout: {
        body: (
            <>
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
            </>
        )
    },

    // --- context-menu actions ---
    "play-now": { fill: true, body: <polygon points="6 4 20 12 6 20 6 4" /> },
    "play-next": {
        body: (
            <>
                <path d="m5 17 5-5-5-5" />
                <path d="m12 17 5-5-5-5" />
            </>
        )
    },
    enqueue: {
        body: (
            <>
                <line x1="4" y1="6" x2="15" y2="6" />
                <line x1="4" y1="12" x2="15" y2="12" />
                <line x1="4" y1="18" x2="11" y2="18" />
                <line x1="18" y1="9" x2="18" y2="17" />
                <line x1="14" y1="13" x2="22" y2="13" />
            </>
        )
    },
    "move-top": {
        body: (
            <>
                <line x1="5" y1="3.5" x2="19" y2="3.5" />
                <path d="m18 13-6-6-6 6" />
                <line x1="12" y1="7" x2="12" y2="21" />
            </>
        )
    },
    trash: {
        body: (
            <>
                <line x1="3.5" y1="6" x2="20.5" y2="6" />
                <path d="M18.5 6v13a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2V6" />
                <path d="M8.5 6V4.5a2 2 0 0 1 2-2h3a2 2 0 0 1 2 2V6" />
                <line x1="10" y1="11" x2="10" y2="17" />
                <line x1="14" y1="11" x2="14" y2="17" />
            </>
        )
    },
    share: {
        body: (
            <>
                <circle cx="18" cy="5" r="2.5" />
                <circle cx="6" cy="12" r="2.5" />
                <circle cx="18" cy="19" r="2.5" />
                <line x1="8.2" y1="13.2" x2="15.8" y2="17.8" />
                <line x1="15.8" y1="6.2" x2="8.2" y2="10.8" />
            </>
        )
    },
    open: {
        body: (
            <>
                <path d="M15 3.5h5.5V9" />
                <path d="M20 4 11 13" />
                <path d="M18 13.5V19a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h5.5" />
            </>
        )
    },
    link: {
        body: (
            <>
                <path d="M10 13a4.5 4.5 0 0 0 6.8.5l2.7-2.7a4.5 4.5 0 0 0-6.4-6.4l-1.5 1.5" />
                <path d="M14 11a4.5 4.5 0 0 0-6.8-.5L4.5 13.2a4.5 4.5 0 0 0 6.4 6.4l1.5-1.5" />
            </>
        )
    }
};

const Icon = forwardRef(function Icon({ name, className = "h-5 w-5", strokeWidth = 2, ...rest }, ref) {
    const icon = ICONS[name];
    if (!icon) return null;
    return (
        <svg
            ref={ref}
            viewBox="0 0 24 24"
            className={`pointer-events-none inline-block shrink-0 overflow-visible ${className}`}
            fill={icon.fill ? "currentColor" : "none"}
            stroke="currentColor"
            strokeWidth={strokeWidth}
            strokeLinecap="round"
            strokeLinejoin="round"
            aria-hidden="true"
            {...rest}
        >
            {icon.body}
        </svg>
    );
});

export default Icon;
