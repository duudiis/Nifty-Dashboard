import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";
import { useRouter } from "next/router";

import { buildEntityId, parseEntityId } from "../sources/ids.js";

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
const VIEWS = ["queue", "search", "lyrics", "watch"];
// Full-surface overlays (toggled from the player bar); closing one returns to
// the last regular page instead of navigating somewhere new.
const OVERLAY_VIEWS = ["lyrics", "watch"];
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
    // Entity URLs are /dashboard/<kind>/<source>/<id>; the browse layer speaks
    // namespaced ids, so rebuild one from the path (legacy 2-segment URLs
    // already carry it whole).
    const entityId = ENTITY_VIEWS.includes(viewSeg)
        ? (segs.length >= 3 ? buildEntityId(segs[1], viewSeg, segs.slice(2).join("/")) : segs[1] || null)
        : null;
    const setView = useCallback(
        (v) => { router.push(pathForView(v), undefined, { shallow: true }); },
        [router]
    );
    // Open an album/playlist/artist page — pretty URLs: /dashboard/<kind>/<source>/<id>.
    const openEntity = useCallback(
        (kind, id) => {
            const parsed = parseEntityId(id);
            const path = parsed
                ? `/dashboard/${kind}/${parsed.source}/${encodeURIComponent(parsed.id)}`
                : `/dashboard/${kind}/${encodeURIComponent(id)}`;
            router.push(path, undefined, { shallow: true });
        },
        [router]
    );

    // Remember the last non-overlay location so closing an overlay view returns
    // there (album page, search results, queue, …) instead of always going home.
    const prevPathRef = useRef("/dashboard");
    useEffect(() => {
        if (!OVERLAY_VIEWS.includes(view)) prevPathRef.current = router.asPath;
    }, [view, router.asPath]);
    const closeOverlay = useCallback(
        () => { router.push(prevPathRef.current || "/dashboard", undefined, { shallow: true }); },
        [router]
    );

    // Live browser-tab title: the playing track ("Title — Artist") when one is
    // loaded, otherwise "Nifty — <view>" (just "Nifty" on home).
    useEffect(() => {
        if (typeof document === "undefined") return;
        const track = player?.track;
        const LABELS = { queue: "Queue", search: "Search", lyrics: "Lyrics", watch: "Watch", album: "Album", playlist: "Playlist", artist: "Artist" };
        if (track?.title) {
            document.title = track.artist ? `${track.title} — ${track.artist}` : track.title;
        } else {
            const label = LABELS[view];
            document.title = label ? `Nifty — ${label}` : "Nifty";
        }
    }, [player?.track?.title, player?.track?.artist, view]);

    const [search, setSearch] = useState({ query: "", sections: [], loading: false });

    const [settings, setSettings] = useState(DEFAULT_SETTINGS);

    const wsRef = useRef(null);
    const heartbeatRef = useRef(null);
    const reconnectRef = useRef(null);
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

        try {
            if (what !== "queue") {
                const res = await fetch(`/api/player?${params}`, { cache: "no-store" });
                if (res.ok) {
                    const json = await res.json();
                    if (stillCurrent()) {
                        // Anchor the server-computed progress to the local clock:
                        // displayed progress derives from this anchor instead of
                        // accumulating ticks, so it can never drift.
                        setPlayer(json?.track
                            ? { ...json, _anchor: { progress: json.progress || 0, at: Date.now() } }
                            : null);
                        // The queue cursor rides along with the player row.
                        if (json?.track && typeof json.position === "number") {
                            setQueue((prev) => ({ ...prev, position: json.position }));
                        }
                    }
                }
            }
            if (what !== "player") {
                const res = await fetch(`/api/queue?${params}`, { cache: "no-store" });
                if (res.ok) {
                    const json = await res.json();
                    if (stillCurrent()) {
                        setQueue({ tracks: json?.tracks || [], position: json?.position ?? 0 });
                    }
                }
            }
        } catch { /* transient — the next nudge retries */ }
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

                    // Something changed in the database — re-read the piece
                    // that changed (state itself never travels on the socket).
                    case "player_updated": {
                        fetchState("player");
                        break;
                    }

                    case "queue_updated": {
                        fetchState("queue");
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
    }, [user, fetchState]);

    // Everything is event-driven: the bot nudges on change and this client
    // re-reads the database; sessions arrive on first connect
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
        setQueue({ tracks: [], position: 0 });
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
                setQueue({ tracks: [], position: 0 });
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
        logout
    };

    return <NiftyContext.Provider value={value}>{children}</NiftyContext.Provider>;
}

export function useNifty() {
    const ctx = useContext(NiftyContext);
    if (!ctx) throw new Error("useNifty must be used within NiftyProvider");
    return ctx;
}
