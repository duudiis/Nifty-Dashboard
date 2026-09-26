import { createContext, useContext, useEffect, useMemo, useRef, useState, useCallback } from "react";
import { useRouter } from "next/router";

import { buildEntityId, parseEntityId } from "../sources/ids.js";
import { trackRow } from "../lib/trackShape.js";

const NiftyContext = createContext(null);

export const THEME_GROUPS = {
    dark: ["nifty", "spotify", "amethyst", "crimson", "midnight", "forest", "sunset", "graphite", "ocean"],
    light: ["light", "rose", "mint", "sand", "lavender"]
};
export const THEMES = [...THEME_GROUPS.dark, ...THEME_GROUPS.light];

// Custom-theme scaffolding: every color the palette exposes, editable in the
// settings, applied as inline CSS variables when theme === "custom".
export const CUSTOM_THEME_DEFAULT = {
    colors: {
        accent: "#79a5fa",
        base: "#09090b",
        surface: "#121214",
        elevated: "#202024",
        topbar: "#000000",
        topbartext: "#ffffff",
        border: "#27272a",
        text: "#f5f5f5",
        subtext: "#a1a1aa"
    },
    gradient: { enabled: false, from: "#0b0b10", to: "#1b1035", angle: 135 }
};

export function normalizeCustomTheme(raw) {
    return {
        colors: { ...CUSTOM_THEME_DEFAULT.colors, ...(raw?.colors || {}) },
        gradient: { ...CUSTOM_THEME_DEFAULT.gradient, ...(raw?.gradient || {}) }
    };
}

const hexToTriplet = (hex) => {
    const m = String(hex || "").match(/^#?([0-9a-f]{6})$/i);
    if (!m) return null;
    const n = parseInt(m[1], 16);
    return `${(n >> 16) & 255} ${(n >> 8) & 255} ${n & 255}`;
};

const isLightHex = (hex) => {
    const m = String(hex || "").match(/^#?([0-9a-f]{6})$/i);
    if (!m) return false;
    const n = parseInt(m[1], 16);
    const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255];
    return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255 > 0.5;
};

const CUSTOM_VAR_MAP = {
    base: "--c-base",
    surface: "--c-surface",
    elevated: "--c-elevated",
    topbar: "--c-topbar",
    topbartext: "--c-topbar-text",
    border: "--c-border",
    accent: "--c-accent",
    text: "--c-text",
    subtext: "--c-subtext"
};

const CUSTOM_EXTRA_VARS = ["--c-accent-soft", "--c-lyric", "--c-scrim", "--app-gradient"];

const DEFAULT_SETTINGS = {
    theme: "nifty",
    rightPanel: "queue"     // "queue" | "nowplaying"
};

function loadSettings() {
    if (typeof window === "undefined") return DEFAULT_SETTINGS;
    try {
        const raw = localStorage.getItem("nifty:settings");
        return raw ? { ...DEFAULT_SETTINGS, ...JSON.parse(raw) } : DEFAULT_SETTINGS;
    } catch {
        return DEFAULT_SETTINGS;
    }
}

// Center pages that have a real URL at the site root. "home" is the bare path.
const VIEWS = ["queue", "search", "lyrics", "watch", "history"];
// Full-surface overlays (toggled from the player bar); closing one returns to
// the last regular page instead of navigating somewhere new.
const OVERLAY_VIEWS = ["lyrics", "watch"];
// Entity pages take a second path segment: /<kind>/<id>.
const ENTITY_VIEWS = ["album", "playlist", "artist"];
const pathForView = (v) => (v === "home" ? "/" : `/${v}`);

// After any structural queue delta, a track's id is its array position (the
// same contract as a full fetch). Rewrites track_id to match, preserving object
// identity for rows that didn't move so memoized rows don't re-render.
function reindexQueue(arr) {
    return arr.map((t, i) => (t.track_id === i ? t : { ...t, track_id: i }));
}

// The autoplay section: the bot's recommendation buffer ("Next from:
// Autoplay") plus whether autoplay is on. Rides inside the queue state so a
// session switch resets both together.
const EMPTY_AUTOPLAY = { enabled: false, tracks: [] };
const EMPTY_QUEUE = { tracks: [], position: 0, autoplay: EMPTY_AUTOPLAY };

// Longest the shell will sit on its loading placeholders before showing the
// real (possibly empty) dashboard, however the boot went.
const BOOT_TIMEOUT = 3000;

export function NiftyProvider({ user, inviteUrl = null, children }) {

    const router = useRouter();

    const [connected, setConnected] = useState(false);
    const [updateAvailable, setUpdateAvailable] = useState(false);
    const [reloading, setReloading] = useState(false);
    const [sessions, setSessions] = useState([]);     // aggregated across bots
    const [selected, setSelected] = useState(null);   // { botName, guildId, ... }
    const [player, setPlayer] = useState(null);        // null = nothing playing
    const [queue, setQueue] = useState(EMPTY_QUEUE);
    const [notifications, setNotifications] = useState([]); // transient toasts

    // First-load progress. The dashboard shell paints immediately with empty
    // boxes; these flip as each piece of the boot arrives, and `ready` (below)
    // latches once the real content can be shown.
    const [sessionsLoaded, setSessionsLoaded] = useState(false); // server list in
    const [stateLoaded, setStateLoaded] = useState(false);       // player+queue read once

    // The active page is derived from the URL (refresh-safe); setView navigates.
    //
    // Read from asPath rather than router.query.view: the page is an optional
    // catch-all, and on a shallow push into one the parsed route params can
    // still describe the previous URL for a render. asPath is the address bar,
    // so the view can never disagree with it.
    const segs = useMemo(() => {
        const path = (router.asPath || "/").split(/[?#]/)[0];
        return path.split("/").filter(Boolean).map((seg) => {
            try { return decodeURIComponent(seg); } catch { return seg; }
        });
    }, [router.asPath]);
    const viewSeg = segs[0] || null;
    const view = VIEWS.includes(viewSeg) || ENTITY_VIEWS.includes(viewSeg) ? viewSeg : "home";
    // Entity URLs are /<kind>/<source>/<id>; the browse layer speaks
    // namespaced ids, so rebuild one from the path (legacy 2-segment URLs
    // already carry it whole).
    const entityId = ENTITY_VIEWS.includes(viewSeg)
        ? (segs.length >= 3 ? buildEntityId(segs[1], viewSeg, segs.slice(2).join("/")) : segs[1] || null)
        : null;
    const setView = useCallback(
        (v) => { router.push(pathForView(v), undefined, { shallow: true }); },
        [router]
    );
    // Open an album/playlist/artist page — pretty URLs: /<kind>/<source>/<id>.
    const openEntity = useCallback(
        (kind, id) => {
            const parsed = parseEntityId(id);
            const path = parsed
                ? `/${kind}/${parsed.source}/${encodeURIComponent(parsed.id)}`
                : `/${kind}/${encodeURIComponent(id)}`;
            router.push(path, undefined, { shallow: true });
        },
        [router]
    );

    // Remember the last non-overlay location so closing an overlay view returns
    // there (album page, search results, queue, …) instead of always going home.
    const prevPathRef = useRef("/");
    useEffect(() => {
        if (!OVERLAY_VIEWS.includes(view)) prevPathRef.current = router.asPath;
    }, [view, router.asPath]);
    const closeOverlay = useCallback(
        () => { router.push(prevPathRef.current || "/", undefined, { shallow: true }); },
        [router]
    );

    // Live browser-tab title: the playing track ("Title — Artist") when one is
    // loaded, otherwise "Nifty — <view>" (just "Nifty" on home).
    useEffect(() => {
        if (typeof document === "undefined") return;
        const track = player?.track;
        const LABELS = { queue: "Queue", search: "Search", lyrics: "Lyrics", watch: "Watch", history: "History", album: "Album", playlist: "Playlist", artist: "Artist" };
        if (track?.title) {
            document.title = track.artist ? `${track.title} — ${track.artist}` : track.title;
        } else {
            const label = LABELS[view];
            document.title = label ? `Nifty — ${label}` : "Nifty";
        }
    }, [player?.track?.title, player?.track?.artist, view]);

    const [search, setSearch] = useState({ query: "", sections: [], loading: false });

    // Artwork for the current entity page's pinned backdrop. Lives here (not in
    // the page) so the transition layer can render it in the non-sliding layer
    // — the blur can never leak past the header during the slide-up.
    const [pageArt, setPageArt] = useState(null);

    const [settings, setSettings] = useState(DEFAULT_SETTINGS);

    const wsRef = useRef(null);
    const reconnectRef = useRef(null);
    const retryRef = useRef(0);
    const selectedRef = useRef(null);
    selectedRef.current = selected;
    const notifyIdRef = useRef(0);

    /* ---- player/queue state: read straight from the shared database via the
       HTTP API. The WebSocket only tells us WHEN to re-read (nudges). ---- */

    const fetchState = useCallback(async (what = "both") => {
        const sel = selectedRef.current;
        if (!sel?.guildId || !sel?.botId) return;
        const params = `botId=${encodeURIComponent(sel.botId)}&guildId=${encodeURIComponent(sel.guildId)}`;
        const stillCurrent = () =>
            selectedRef.current?.guildId === sel.guildId && selectedRef.current?.botId === sel.botId;

        // Both reads go out at once. The database is remote, so awaiting them
        // one after the other put a whole extra round trip on every boot.
        // A failed read resolves to undefined and is simply skipped — the next
        // nudge retries it.
        const read = (path) => fetch(`${path}?${params}`, { cache: "no-store" })
            .then((r) => (r.ok ? r.json() : undefined))
            .catch(() => undefined);

        const [playerJson, queueJson] = await Promise.all([
            what !== "queue" ? read("/api/player") : undefined,
            what !== "player" ? read("/api/queue") : undefined
        ]);

        if (stillCurrent()) {
            if (playerJson !== undefined) {
                // Anchor the server-computed progress to the local clock:
                // displayed progress derives from this anchor instead of
                // accumulating ticks, so it can never drift.
                setPlayer(playerJson?.track
                    ? { ...playerJson, _anchor: { progress: playerJson.progress || 0, at: Date.now() } }
                    : null);
                // The queue cursor rides along with the player row.
                if (playerJson?.track && typeof playerJson.position === "number") {
                    setQueue((prev) => ({ ...prev, position: playerJson.position }));
                }
            }
            if (queueJson !== undefined) {
                setQueue({
                    tracks: queueJson?.tracks || [],
                    position: queueJson?.position ?? 0,
                    autoplay: queueJson?.autoplay || EMPTY_AUTOPLAY
                });
            }
        }

        // A read that failed is still no longer "loading" — the boxes give way
        // either way, and the next nudge retries in the background.
        setStateLoaded(true);
    }, []);

    /* ---- transient toast notifications (shown stacked above the player) ---- */

    const notify = useCallback((message, duration = 3200) => {
        if (!message) return;
        const id = ++notifyIdRef.current;
        setNotifications((prev) => [...prev, { id, message }]);
        setTimeout(() => {
            setNotifications((prev) => prev.filter((n) => n.id !== id));
        }, duration);
    }, []);

    /* ---- library: the user's shelf + liked/saved caches ----
       Loaded once per login and kept fresh by the mutation helpers, so hearts
       and context menus can read saved/liked state synchronously. ---- */

    const [library, setLibrary] = useState({
        items: [], savedRefs: [], likedUrls: [], playlists: [], loaded: false
    });
    const libraryRef = useRef(library);
    libraryRef.current = library;

    // O(1) liked-URL lookup — rebuilt only when the liked set changes, not per
    // row. Without this, isLiked() scanning a thousands-long array on every one
    // of thousands of rows makes the Liked songs page O(n²) and freezes on drag.
    const likedSetRef = useRef(new Set());
    likedSetRef.current = useMemo(() => new Set(library.likedUrls), [library.likedUrls]);

    const refreshLibrary = useCallback(async () => {
        try {
            const [state, list] = await Promise.all([
                fetch("/api/library?view=state").then((r) => r.json()),
                fetch("/api/library?view=list").then((r) => r.json())
            ]);
            setLibrary({
                items: list.items || [],
                savedRefs: state.savedRefs || [],
                likedUrls: state.likedUrls || [],
                playlists: state.playlists || [],
                loaded: true
            });
        } catch {
            // Still mark it loaded: a failed read is no longer loading, and
            // leaving the flag false would keep the shelf empty forever. The next
            // mutation retries.
            setLibrary((prev) => ({ ...prev, loaded: true }));
        }
    }, []);

    useEffect(() => { if (user) refreshLibrary(); }, [user, refreshLibrary]);

    const isLiked = useCallback((track) => {
        const url = track?.url || track?.songUrl;
        return !!url && likedSetRef.current.has(url);
    }, []);

    const toggleLike = useCallback(async (track) => {
        const url = track?.url || track?.songUrl;
        if (!url) return;
        const liked = libraryRef.current.likedUrls.includes(url);
        const label = track.title ? `“${track.title}”` : "track";

        // Optimistic: hearts flip instantly, revert on failure.
        setLibrary((prev) => ({
            ...prev,
            likedUrls: liked ? prev.likedUrls.filter((u) => u !== url) : [...prev.likedUrls, url]
        }));
        try {
            const res = await fetch("/api/library", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: liked ? "unlike" : "like",
                    track: { title: track.title, artist: track.artist, artwork: track.artwork, duration: track.duration, url }
                })
            });
            if (!res.ok) throw new Error();
            notify(liked ? `Removed ${label} from Liked songs` : `Saved ${label} to Liked songs`);
        } catch {
            setLibrary((prev) => ({
                ...prev,
                likedUrls: liked ? [...prev.likedUrls, url] : prev.likedUrls.filter((u) => u !== url)
            }));
            notify("Couldn't update Liked songs");
        }
    }, [notify]);

    const isSaved = useCallback((browseId) => {
        return !!browseId && libraryRef.current.savedRefs.includes(browseId);
    }, []);

    const toggleSaveEntity = useCallback(async (item, data = null) => {
        const ref = item?.browseId;
        if (!ref) return;
        const saved = libraryRef.current.savedRefs.includes(ref);
        const label = item.title ? `“${item.title}”` : `this ${item.kind}`;

        setLibrary((prev) => ({
            ...prev,
            savedRefs: saved ? prev.savedRefs.filter((r) => r !== ref) : [...prev.savedRefs, ref]
        }));
        try {
            const res = await fetch("/api/library", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: saved ? "unsave" : "save",
                    entity: {
                        browseId: ref,
                        kind: item.kind,
                        title: data?.title || item.title,
                        subtitle: data?.subtitle || item.subtitle || null,
                        artwork: data?.artwork || item.artwork || null,
                        url: data?.url || item.url || null
                    }
                })
            });
            if (!res.ok) throw new Error();
            notify(saved ? `Removed ${label} from your library` : `Saved ${label} to your library`);
            refreshLibrary(); // the shelf changed
        } catch {
            setLibrary((prev) => ({
                ...prev,
                savedRefs: saved ? [...prev.savedRefs, ref] : prev.savedRefs.filter((r) => r !== ref)
            }));
            notify("Couldn't update your library");
        }
    }, [notify, refreshLibrary]);

    const createPlaylist = useCallback(async (name) => {
        try {
            const res = await fetch("/api/library", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "create_playlist", name })
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.message);
            notify(`Created “${json.playlist.name}”`);
            refreshLibrary();
            return json.playlist;
        } catch {
            notify("Couldn't create the playlist");
            return null;
        }
    }, [notify, refreshLibrary]);

    const addToPlaylist = useCallback(async (playlist, tracks, label = null) => {
        try {
            const res = await fetch("/api/library", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: "add_to_playlist",
                    playlistId: playlist.id,
                    tracks: tracks.map((t) => ({
                        title: t.title, artist: t.artist, artwork: t.artwork,
                        duration: t.duration, url: t.url || t.songUrl || t.playQuery
                    }))
                })
            });
            const json = await res.json();
            if (!res.ok) throw new Error(json.message);
            notify(`Added ${label || (json.added === 1 ? "1 track" : `${json.added} tracks`)} to “${playlist.name}”`);
        } catch {
            notify(`Couldn't add to “${playlist.name}”`);
        }
    }, [notify]);

    const removePlaylist = useCallback(async (item) => {
        const playlistId = parseEntityId(item?.browseId)?.id;
        if (!playlistId || playlistId === "liked") return;
        const label = item.title ? `“${item.title}”` : "playlist";
        try {
            const res = await fetch("/api/library", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "delete_playlist", playlistId })
            });
            if (!res.ok) throw new Error();
            notify(`Deleted ${label}`);
            refreshLibrary();
            // If its page is open, it no longer exists — go home.
            if (entityId === item.browseId) setView("home");
        } catch {
            notify(`Couldn't delete ${label}`);
        }
    }, [notify, refreshLibrary, entityId, setView]);

    const reorderLibraryItem = useCallback(async (itemId, toIndex, nextItems) => {
        // Optimistic: the sidebar hands us its already-reordered list.
        if (nextItems) setLibrary((prev) => ({ ...prev, items: nextItems }));
        try {
            const res = await fetch("/api/library", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "reorder", itemId, toIndex })
            });
            if (!res.ok) throw new Error();
        } catch {
            refreshLibrary();
        }
    }, [refreshLibrary]);

    /* ---- settings: load + persist + apply theme ---- */

    useEffect(() => { setSettings(loadSettings()); }, []);

    useEffect(() => {
        if (typeof window === "undefined") return;
        const root = document.documentElement;
        root.dataset.theme = settings.theme;

        if (settings.theme === "custom") {
            // Paint the user's palette straight onto :root — inline variables
            // beat every [data-theme] rule.
            const custom = normalizeCustomTheme(settings.customTheme);
            for (const [key, cssVar] of Object.entries(CUSTOM_VAR_MAP)) {
                const triplet = hexToTriplet(custom.colors[key]);
                if (triplet) root.style.setProperty(cssVar, triplet);
            }
            root.style.setProperty("--c-accent-soft", hexToTriplet(custom.colors.accent) || "121 165 250");

            // Light/dark family (media backdrops, lyric ink) follows the
            // chosen background's luminance.
            const light = isLightHex(custom.colors.base);
            root.dataset.mode = light ? "light" : "dark";
            root.style.setProperty("--c-lyric", light ? "28 26 32" : "255 255 255");
            root.style.setProperty("--c-scrim", light ? "255 255 255" : "0 0 0");

            root.style.setProperty(
                "--app-gradient",
                custom.gradient.enabled
                    ? `linear-gradient(${custom.gradient.angle}deg, ${custom.gradient.from}, ${custom.gradient.to})`
                    : "none"
            );
        } else {
            // Solid theme: clear every inline override so the stylesheet rules.
            for (const cssVar of [...Object.values(CUSTOM_VAR_MAP), ...CUSTOM_EXTRA_VARS]) {
                root.style.removeProperty(cssVar);
            }
            // data-mode lets CSS adapt media backdrops per light/dark family.
            root.dataset.mode = THEME_GROUPS.light.includes(settings.theme) ? "light" : "dark";
        }

        try { localStorage.setItem("nifty:settings", JSON.stringify(settings)); } catch {}
    }, [settings]);

    const updateSettings = useCallback((patch) => {
        setSettings((prev) => ({ ...prev, ...patch }));
    }, []);

    /* ---- websocket ---- */

    const sendRef = useRef(() => {});
    const send = useCallback((operation, data = {}) => {
        sendRef.current(operation, data);
    }, []);

    useEffect(() => {
        if (!user) return;

        let closed = false;

        const connect = () => {
            const proto = window.location.protocol === "https:" ? "wss" : "ws";
            const ws = new WebSocket(`${proto}://${window.location.host}/ws`);
            wsRef.current = ws;

            sendRef.current = (operation, data = {}) => {
                if (ws.readyState === WebSocket.OPEN) {
                    ws.send(JSON.stringify({ operation, data }));
                }
            };

            ws.onmessage = (event) => {
                let message;
                try { message = JSON.parse(event.data); } catch { return; }

                switch (message.operation) {

                    // "hello" carries the heartbeat interval for peers that run
                    // their own timer. The browser doesn't: the hub pings us and
                    // the browser answers in its network stack, which keeps
                    // working when a background tab's timers are throttled.

                    case "identify_success": {
                        setConnected(true);
                        retryRef.current = 0;
                        // On every (re)connect, check whether a newer dashboard
                        // build has been deployed than the one this tab is running.
                        fetch("/api/version", { cache: "no-store" })
                            .then((r) => r.json())
                            .then(({ version }) => {
                                const current = window.__NEXT_DATA__?.buildId;
                                if (version && current && version !== current) setUpdateAvailable(true);
                            })
                            .catch(() => {});
                        ws.send(JSON.stringify({ operation: "sessions_request" }));
                        const sel = selectedRef.current;
                        if (sel?.guildId) {
                            ws.send(JSON.stringify({
                                operation: "subscribe",
                                data: { botId: sel.botId, guildId: sel.guildId }
                            }));
                            fetchState("both");
                        }
                        break;
                    }

                    case "sessions": {
                        const botId = message.data?.botId || null;
                        const botName = message.data?.botName;
                        const incoming = message.data?.sessions || [];
                        // The hub answering with no bot at all means none are
                        // online — drop everything, don't merge.
                        setSessionsLoaded(true);
                        if (!botId && !botName) {
                            setSessions([]);
                            break;
                        }
                        // Replace this bot's entries, keep the others.
                        const botKey = (b, n) => b || n;
                        setSessions((prev) => {
                            const others = prev.filter((s) => botKey(s.botId, s.botName) !== botKey(botId, botName));
                            const tagged = incoming.map((s) => ({
                                ...s,
                                botId: s.botId || botId,
                                botName: s.botName || botName
                            }));
                            return [...others, ...tagged];
                        });
                        break;
                    }

                    // Legacy nudges (older bot builds): state didn't travel, so
                    // re-read the piece that changed from the database.
                    case "player_updated": {
                        fetchState("player");
                        break;
                    }

                    case "queue_updated": {
                        fetchState("queue");
                        break;
                    }

                    /* ---- granular deltas: the change rides on the socket, so we
                       apply it to local state instead of refetching. Full fetches
                       happen only on subscribe/reconnect, q_resync, queue-page
                       open, or when a track change reveals we're out of sync. ---- */

                    case "p_full": {
                        const d = message.data;
                        // No track loaded → the player is idle.
                        if (!d || !d.track) { setPlayer(null); break; }
                        const track = trackRow(d.track);
                        const payload = {
                            progress: d.progress || 0,
                            playing: !!d.playing,
                            shuffle: !!d.shuffle,
                            loop: d.loop,
                            volume: d.volume,
                            speed: d.speed || 1,
                            position: d.position,
                            track
                        };
                        setPlayer({ ...payload, _anchor: { progress: payload.progress, at: Date.now() } });
                        if (typeof d.position === "number") {
                            setQueue((prev) => ({ ...prev, position: d.position }));
                            // If the now-playing track isn't the one sitting at the
                            // cursor locally, we missed a queue delta — resync it.
                            const local = queueRef.current;
                            if (local.tracks.length > 0) {
                                const at = local.tracks[d.position];
                                if (!at || at.songUrl !== track.songUrl) fetchState("queue");
                            }
                        }
                        break;
                    }

                    case "q_add": {
                        const { at, cursor, tracks } = message.data || {};
                        if (!Array.isArray(tracks) || tracks.length === 0) break;
                        const mapped = tracks.map((r) => ({
                            track_id: r.position,
                            ...(r.id != null ? { entry_id: String(r.id) } : {}),
                            ...trackRow(r)
                        }));
                        setQueue((prev) => {
                            const arr = [...prev.tracks];
                            const idx = Math.min(Math.max(at ?? arr.length, 0), arr.length);
                            arr.splice(idx, 0, ...mapped);
                            return { ...prev, tracks: reindexQueue(arr), position: typeof cursor === "number" ? cursor : prev.position };
                        });
                        break;
                    }

                    case "q_remove": {
                        const { at, count, cursor } = message.data || {};
                        setQueue((prev) => {
                            const arr = [...prev.tracks];
                            arr.splice(at, count || 1);
                            return { ...prev, tracks: reindexQueue(arr), position: typeof cursor === "number" ? cursor : prev.position };
                        });
                        break;
                    }

                    case "q_move": {
                        const { from, to, cursor } = message.data || {};
                        setQueue((prev) => {
                            const arr = [...prev.tracks];
                            if (from < 0 || from >= arr.length) return prev;
                            const [moved] = arr.splice(from, 1);
                            const dest = Math.min(Math.max(to, 0), arr.length);
                            arr.splice(dest, 0, moved);
                            return { ...prev, tracks: reindexQueue(arr), position: typeof cursor === "number" ? cursor : prev.position };
                        });
                        break;
                    }

                    case "q_clear": {
                        // The autoplay section has its own lifecycle (a_full).
                        setQueue((prev) => ({ ...EMPTY_QUEUE, autoplay: prev.autoplay }));
                        break;
                    }

                    // Too many changes at once (shuffle / range edit) — refetch.
                    case "q_resync": {
                        fetchState("queue");
                        break;
                    }

                    // The autoplay section whole: enabled flag + the bot's
                    // recommendation buffer. Small (≤20 rows), so it always
                    // travels as one snapshot.
                    case "a_full": {
                        const d = message.data || {};
                        const tracks = (d.tracks || []).map((r) => ({
                            auto_id: String(r.id),
                            ...trackRow(r)
                        }));
                        setQueue((prev) => ({ ...prev, autoplay: { enabled: !!d.enabled, tracks } }));
                        break;
                    }

                    // A bot went offline: its sessions are gone, drop them
                    // instead of leaving ghosts in the Connect list.
                    case "bot_disconnected": {
                        const botId = message.data?.botId || null;
                        const botName = message.data?.botName;
                        const key = botId || botName;
                        if (!key) break;
                        setSessions((prev) => prev.filter((s) => (s.botId || s.botName) !== key));
                        break;
                    }

                    default:
                        break;
                }
            };

            ws.onclose = () => {
                setConnected(false);
                if (closed) return;
                // Retry almost immediately so a blip is invisible, backing off
                // only if the hub really is down.
                const delay = Math.min(300 * 2 ** retryRef.current++, 5000);
                reconnectRef.current = setTimeout(connect, delay);
            };

            ws.onerror = () => { try { ws.close(); } catch {} };
        };

        connect();

        return () => {
            closed = true;
            clearTimeout(reconnectRef.current);
            try { wsRef.current?.close(); } catch {}
        };
    }, [user, fetchState]);

    // Opening the queue page does a one-off full fetch as a safety net: local
    // state is kept live by deltas, but this reconciles anything a missed delta
    // could have drifted right when the user looks at the full list.
    useEffect(() => {
        if (view === "queue") fetchState("queue");
    }, [view, fetchState]);

    // Live state now rides on the socket as granular deltas (p_full + q_*); this
    // client applies them locally and only full-fetches on subscribe/reconnect,
    // q_resync, or queue-page open. Sessions arrive on first connect
    // (identify_success) + voice changes. The Connect panel polls sessions
    // while it's open (see ConnectPanel) via this helper.
    const refreshSessions = useCallback(() => send("sessions_request"), [send]);

    /* ---- local progress ticker: recomputes from the fetch-time anchor (at
       playback speed) instead of incrementing, so there is no cumulative
       drift — every tick is exact relative to the last server read ---- */

    useEffect(() => {
        if (!player?.playing || !player?.track) return;
        const id = setInterval(() => {
            setPlayer((prev) => {
                if (!prev?.playing || !prev?.track || !prev?._anchor) return prev;
                const rate = prev.speed || 1;
                const elapsed = (Date.now() - prev._anchor.at) * rate;
                const duration = prev.track.duration || Infinity;
                const next = Math.min(prev._anchor.progress + elapsed, duration);
                if (next === prev.progress) return prev;
                return { ...prev, progress: next };
            });
        }, 500);
        return () => clearInterval(id);
    }, [player?.playing, player?.track?.songUrl, player?._anchor?.at]);

    /* ---- actions ---- */

    const selectSession = useCallback((session, { switchView = true } = {}) => {
        setSelected(session);
        setPlayer(null);
        setQueue(EMPTY_QUEUE);
        if (session?.guildId) {
            send("subscribe", { botId: session.botId, guildId: session.guildId });
            // selectedRef updates on re-render; point it at the new session now
            // so the immediate fetch reads the right guild.
            selectedRef.current = session;
            fetchState("both");
            if (switchView) setView("queue");
        }
    }, [send, fetchState]);

    /* ---- always have a server selected: pick the first available, and
       re-pick if the current selection disappears (without yanking the view) ---- */

    useEffect(() => {
        if (!sessions.length) {
            // Nothing controllable anymore (e.g. the only bot went offline):
            // clear the stale selection so the UI shows its empty state.
            if (selectedRef.current) {
                setSelected(null);
                setPlayer(null);
                setQueue(EMPTY_QUEUE);
            }
            return;
        }
        const k = (s) => `${s.botId || s.botName}:${s.guildId}`;
        const cur = selectedRef.current;
        if (!cur || !sessions.some((s) => k(s) === k(cur))) {
            // Prefer a server where the bot is already playing something.
            const active = sessions.find((s) => s.nowPlaying?.title);
            selectSession(active || sessions[0], { switchView: false });
        }
    }, [sessions, selectSession]);

    const control = useCallback((action, extra = {}) => {
        const sel = selectedRef.current;
        if (!sel?.guildId) return;
        send("action", { botId: sel.botId, guildId: sel.guildId, action, ...extra });
    }, [send]);

    // Ask the bot to join the user's voice channel in the selected guild.
    const summon = useCallback(() => control("summon"), [control]);

    // Queue a track by query/URL. `mode` lets callers ask the bot to place it:
    //   "queue" (default, append) · "now" (play immediately) · "next" (play next)
    const play = useCallback((query, mode = "queue", label) => {
        const sel = selectedRef.current;
        if (!sel?.guildId || !query) return;
        send("action", {
            botId: sel.botId,
            guildId: sel.guildId,
            action: "play",
            query,
            now: mode === "now",
            next: mode === "next"
        });
        // A label means a single user-initiated add — toast it. Bulk callers
        // (queue-all) pass no label and emit their own single notification.
        if (label) {
            notify(
                mode === "now" ? `Now playing “${label}”`
                : mode === "next" ? `Playing “${label}” next`
                : `Added “${label}” to the queue`
            );
        }
    }, [send, notify]);

    // Existing-track operations. Components address entries by track_id (the
    // queue index), but the wire carries the entry's stable database id too:
    // the bot resolves it to the entry's CURRENT position at execution time,
    // so a stale index can never hit the wrong track mid-reorder.
    const queueRef = useRef(queue);
    queueRef.current = queue;

    const addressEntry = useCallback((trackId) => {
        const entry = (queueRef.current?.tracks || []).find((t) => t.track_id === trackId);
        return entry?.entry_id ? { trackId, entryId: entry.entry_id } : { trackId };
    }, []);

    /* ---- autoplay: the "Next from: Autoplay" section ----
       Entries are addressed by their stable auto_id (the autoplay_tracks row
       id), so no action can hit the wrong suggestion while the buffer moves. */

    // Flip autoplay on/off. The bot answers with a_full (and p_full when it
    // had to turn loop off), so no optimistic state is needed.
    const toggleAutoplay = useCallback(() => control("toggleAutoplay"), [control]);
    // Remove a suggestion — recorded bot-side as negative feedback.
    const autoplayRemove = useCallback((autoId) => control("autoplayRemove", { autoId }), [control]);
    // Drag-reorder within the autoplay section.
    const autoplayMove = useCallback((autoId, toIndex) => control("autoplayMove", { autoId, toIndex }), [control]);
    // Promote a suggestion into the real queue (attributed to this user).
    const autoplayPlay = useCallback((autoId) => control("autoplayPlay", { autoId }), [control]);
    const autoplayPlayNext = useCallback((autoId) => control("autoplayPlayNext", { autoId }), [control]);
    const autoplayQueue = useCallback((autoId) => control("autoplayQueue", { autoId }), [control]);

    const jump = useCallback((trackId) => control("jump", addressEntry(trackId)), [control, addressEntry]);
    // Play now: bot moves the entry to right after the current track, then jumps.
    const playNow = useCallback((trackId) => control("playNow", addressEntry(trackId)), [control, addressEntry]);
    // Play next: bot moves the entry to right after the current track.
    const playNextTrack = useCallback((trackId) => control("playNext", addressEntry(trackId)), [control, addressEntry]);
    // Move to last: bot moves the entry to the end of the queue.
    const moveToLast = useCallback((trackId) => control("moveToLast", addressEntry(trackId)), [control, addressEntry]);
    // Drag-reorder: move the entry at `trackId` (its current index) to `toIndex`.
    const moveTrack = useCallback((trackId, toIndex) => control("move", { ...addressEntry(trackId), toIndex }), [control, addressEntry]);
    const removeTrack = useCallback((trackId) => control("remove", addressEntry(trackId)), [control, addressEntry]);

    // The actual fetch. `initiatedRef` guards against running the same query
    // twice when both a click and the URL-sync effect fire.
    const initiatedRef = useRef("");
    const doSearch = useCallback(async (query) => {
        const q = query.trim();
        if (!q) return;
        initiatedRef.current = q;
        setSearch({ query: q, sections: [], loading: true });
        try {
            const res = await fetch(`/api/search?query=${encodeURIComponent(q)}`);
            const json = await res.json();
            setSearch({ query: q, sections: json.sections || [], loading: false });
        } catch {
            setSearch({ query: q, sections: [], loading: false });
        }
    }, []);

    // Navigate to the search page (real URL with ?q=…) and run the search.
    const runSearch = useCallback((query) => {
        if (!query?.trim()) return;
        const q = query.trim();
        router.push(`/search?q=${encodeURIComponent(q)}`, undefined, { shallow: true });
        doSearch(q);
    }, [router, doSearch]);

    // Run the search when landing on / navigating (back/forward) to a search URL.
    useEffect(() => {
        if (view !== "search") return;
        const q = (router.query.q ?? "").toString();
        if (q && q !== initiatedRef.current) doSearch(q);
    }, [view, router.query.q, doSearch]);

    /* ---- boot latch ----
       The shell paints straight away with empty boxes (the centre shows a
       loader); `ready` flips once the first real state has landed and then
       stays true, so a later reconnect refreshes the live content in place
       instead of blanking the whole app again. The timeout is the ceiling: if
       the hub never answers we still give way to the real (empty /
       disconnected) dashboard rather than loading forever. ---- */

    const [ready, setReady] = useState(false);
    // Deliberately does NOT wait on the library: the shelf clears itself on
    // library.loaded, so a slow library read can't hold up the rest of the app.
    const booted = sessionsLoaded && (sessions.length === 0 || stateLoaded);

    useEffect(() => {
        if (booted) setReady(true);
    }, [booted]);

    useEffect(() => {
        const t = setTimeout(() => setReady(true), BOOT_TIMEOUT);
        return () => clearTimeout(t);
    }, []);

    const logout = useCallback(async () => {
        try { await fetch("/api/auth/logout", { method: "POST" }); } catch {}
        window.location.href = "/login";
    }, []);

    const value = {
        user,
        connected,
        ready,
        sessions,
        selected,
        player,
        queue,
        updateAvailable,
        reloading,
        refreshSessions,
        inviteUrl,
        summon,
        // Fade the canvas over the app, then reload — just enough to cover the
        // refresh, not enough to feel like a wait.
        reloadApp: () => {
            setReloading(true);
            setTimeout(() => window.location.reload(), 180);
        },
        view, setView, closeOverlay,
        entityId, openEntity,
        search, runSearch,
        settings, updateSettings,
        selectSession,
        control,
        play,
        notifications,
        notify,
        jump,
        playNow,
        playNextTrack,
        moveToLast,
        moveTrack,
        removeTrack,
        toggleAutoplay,
        autoplayRemove,
        autoplayMove,
        autoplayPlay,
        autoplayPlayNext,
        autoplayQueue,
        pageArt, setPageArt,
        library,
        refreshLibrary,
        isLiked,
        toggleLike,
        isSaved,
        toggleSaveEntity,
        createPlaylist,
        addToPlaylist,
        removePlaylist,
        reorderLibraryItem,
        logout
    };

    return <NiftyContext.Provider value={value}>{children}</NiftyContext.Provider>;
}

export function useNifty() {
    const ctx = useContext(NiftyContext);
    if (!ctx) throw new Error("useNifty must be used within NiftyProvider");
    return ctx;
}
