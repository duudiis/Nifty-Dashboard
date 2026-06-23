import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/router";

const NiftyContext = createContext(null);

export const THEMES = ["nifty", "spotify", "amethyst", "crimson", "light"];

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

// Center pages that have a real URL under /dashboard. "home" is the bare path.
const VIEWS = ["queue", "search", "lyrics"];
// Entity pages take a second path segment: /dashboard/<kind>/<id>.
const ENTITY_VIEWS = ["album", "playlist", "artist"];
const pathForView = (v) => (v === "home" ? "/dashboard" : `/dashboard/${v}`);

export function NiftyProvider({ user, inviteUrl = null, children }) {

    const router = useRouter();

    const [connected, setConnected] = useState(false);
    const [updateAvailable, setUpdateAvailable] = useState(false);
    const [reloading, setReloading] = useState(false);
    const [sessions, setSessions] = useState([]);     // aggregated across bots
    const [selected, setSelected] = useState(null);   // { botName, guildId, ... }
    const [player, setPlayer] = useState(null);        // null = nothing playing
    const [queue, setQueue] = useState({ tracks: [], position: 0 });
    const [notifications, setNotifications] = useState([]); // transient toasts

    // The active page is derived from the URL (refresh-safe); setView navigates.
    const segs = Array.isArray(router.query.view) ? router.query.view : [];
    const viewSeg = segs[0] || null;
    const view = VIEWS.includes(viewSeg) || ENTITY_VIEWS.includes(viewSeg) ? viewSeg : "home";
    const entityId = ENTITY_VIEWS.includes(viewSeg) ? segs[1] || null : null;
    const setView = useCallback(
        (v) => { router.push(pathForView(v), undefined, { shallow: true }); },
        [router]
    );
    // Open an album/playlist/artist page.
    const openEntity = useCallback(
        (kind, id) => { router.push(`/dashboard/${kind}/${encodeURIComponent(id)}`, undefined, { shallow: true }); },
        [router]
    );

    const [search, setSearch] = useState({ query: "", sections: [], loading: false });

    const [settings, setSettings] = useState(DEFAULT_SETTINGS);

    const wsRef = useRef(null);
    const heartbeatRef = useRef(null);
    const reconnectRef = useRef(null);
    const selectedRef = useRef(null);
    selectedRef.current = selected;
    const notifyIdRef = useRef(0);

    /* ---- transient toast notifications (shown stacked above the player) ---- */

    const notify = useCallback((message, duration = 3200) => {
        if (!message) return;
        const id = ++notifyIdRef.current;
        setNotifications((prev) => [...prev, { id, message }]);
        setTimeout(() => {
            setNotifications((prev) => prev.filter((n) => n.id !== id));
        }, duration);
    }, []);

    /* ---- settings: load + persist + apply theme ---- */

    useEffect(() => { setSettings(loadSettings()); }, []);

    useEffect(() => {
        if (typeof window === "undefined") return;
        document.documentElement.dataset.theme = settings.theme;
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

                    case "hello": {
                        const interval = message.data?.heartbeatInterval || 45000;
                        clearInterval(heartbeatRef.current);
                        heartbeatRef.current = setInterval(() => {
                            if (ws.readyState === WebSocket.OPEN) {
                                ws.send(JSON.stringify({ operation: "heartbeat" }));
                            }
                        }, interval);
                        break;
                    }

                    case "identify_success": {
                        setConnected(true);
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
                            ws.send(JSON.stringify({ operation: "subscribe", data: { guildId: sel.guildId } }));
                        }
                        break;
                    }

                    case "sessions": {
                        const botName = message.data?.botName;
                        const incoming = message.data?.sessions || [];
                        // Replace this bot's entries, keep the others.
                        setSessions((prev) => {
                            const others = prev.filter((s) => s.botName !== botName);
                            const tagged = incoming.map((s) => ({ ...s, botName: s.botName || botName }));
                            return [...others, ...tagged];
                        });
                        break;
                    }

                    case "player": {
                        const data = message.data;
                        setPlayer(data && data.track ? data : null);
                        break;
                    }

                    case "queue": {
                        setQueue({
                            tracks: message.data?.tracks || [],
                            position: message.data?.position ?? 0
                        });
                        break;
                    }

                    default:
                        break;
                }
            };

            ws.onclose = () => {
                setConnected(false);
                clearInterval(heartbeatRef.current);
                if (!closed) {
                    reconnectRef.current = setTimeout(connect, 2500);
                }
            };

            ws.onerror = () => { try { ws.close(); } catch {} };
        };

        connect();

        return () => {
            closed = true;
            clearInterval(heartbeatRef.current);
            clearTimeout(reconnectRef.current);
            try { wsRef.current?.close(); } catch {}
        };
    }, [user]);

    // Everything is event-driven: the bot pushes player/queue on change, and
    // sessions on first connect (identify_success) + voice changes. The Connect
    // panel polls sessions while it's open (see ConnectPanel) via this helper.
    const refreshSessions = useCallback(() => send("sessions_request"), [send]);

    /* ---- when the playing track changes, pull a fresh queue right away so the
       "now playing" highlight tracks playback without waiting for the poll ---- */

    useEffect(() => {
        if (!connected) return;
        const sel = selectedRef.current;
        if (sel?.guildId) send("subscribe", { guildId: sel.guildId });
    }, [connected, player?.track?.songUrl, send]);

    /* ---- local progress ticker (smooth progress bar between pushes) ---- */

    useEffect(() => {
        if (!player?.playing || !player?.track) return;
        const id = setInterval(() => {
            setPlayer((prev) => {
                if (!prev?.playing || !prev?.track) return prev;
                const next = (prev.progress || 0) + 1000;
                if (next > prev.track.duration) return prev;
                return { ...prev, progress: next };
            });
        }, 1000);
        return () => clearInterval(id);
    }, [player?.playing, player?.track?.songUrl]);

    /* ---- actions ---- */

    const selectSession = useCallback((session, { switchView = true } = {}) => {
        setSelected(session);
        setPlayer(null);
        setQueue({ tracks: [], position: 0 });
        if (session?.guildId) {
            send("subscribe", { guildId: session.guildId });
            if (switchView) setView("queue");
        }
    }, [send]);

    /* ---- always have a server selected: pick the first available, and
       re-pick if the current selection disappears (without yanking the view) ---- */

    useEffect(() => {
        if (!sessions.length) return;
        const k = (s) => `${s.botName}:${s.guildId}`;
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
        send("action", { guildId: sel.guildId, action, ...extra });
    }, [send]);

    // Ask the bot to join the user's voice channel in the selected guild.
    const summon = useCallback(() => control("summon"), [control]);

    // Queue a track by query/URL. `mode` lets callers ask the bot to place it:
    //   "queue" (default, append) · "now" (play immediately) · "next" (play next)
    const play = useCallback((query, mode = "queue", label) => {
        const sel = selectedRef.current;
        if (!sel?.guildId || !query) return;
        send("action", {
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

    // Existing-track operations (queue items are addressed by track_id).
    const jump = useCallback((trackId) => control("jump", { trackId }), [control]);
    const playNextTrack = useCallback((trackId) => control("playNext", { trackId }), [control]);
    const moveToTop = useCallback((trackId) => control("moveToTop", { trackId }), [control]);
    const moveToLast = useCallback((trackId) => control("moveToLast", { trackId }), [control]);
    const removeTrack = useCallback((trackId) => control("remove", { trackId }), [control]);
    // Drag-to-reorder: move the track at index `from` to index `to`.
    const moveTrack = useCallback((from, to) => control("move", { from, to }), [control]);

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
        router.push(`/dashboard/search?q=${encodeURIComponent(q)}`, undefined, { shallow: true });
        doSearch(q);
    }, [router, doSearch]);

    // Run the search when landing on / navigating (back/forward) to a search URL.
    useEffect(() => {
        if (view !== "search") return;
        const q = (router.query.q ?? "").toString();
        if (q && q !== initiatedRef.current) doSearch(q);
    }, [view, router.query.q, doSearch]);

    const logout = useCallback(async () => {
        try { await fetch("/api/auth/logout", { method: "POST" }); } catch {}
        window.location.href = "/login";
    }, []);

    const value = {
        user,
        connected,
        sessions,
        selected,
        player,
        queue,
        updateAvailable,
        reloading,
        refreshSessions,
        inviteUrl,
        summon,
        // Show the loading screen, then reload — gives the overlay time to cover
        // the page so the refresh is seamless (no double content animation).
        reloadApp: () => {
            setReloading(true);
            setTimeout(() => window.location.reload(), 450);
        },
        view, setView,
        entityId, openEntity,
        search, runSearch,
        settings, updateSettings,
        selectSession,
        control,
        play,
        notifications,
        notify,
        jump,
        playNextTrack,
        moveToTop,
        moveToLast,
        moveTrack,
        removeTrack,
        logout
    };

    return <NiftyContext.Provider value={value}>{children}</NiftyContext.Provider>;
}

export function useNifty() {
    const ctx = useContext(NiftyContext);
    if (!ctx) throw new Error("useNifty must be used within NiftyProvider");
    return ctx;
}
