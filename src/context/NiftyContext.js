import { createContext, useContext, useEffect, useRef, useState, useCallback } from "react";

const NiftyContext = createContext(null);

export const THEMES = ["nifty", "spotify", "amethyst", "crimson", "light"];

const DEFAULT_SETTINGS = {
    theme: "nifty",
    compact: false,         // compact player bar
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

export function NiftyProvider({ user, children }) {

    const [connected, setConnected] = useState(false);
    const [sessions, setSessions] = useState([]);     // aggregated across bots
    const [selected, setSelected] = useState(null);   // { botName, guildId, ... }
    const [player, setPlayer] = useState(null);        // null = nothing playing
    const [queue, setQueue] = useState({ tracks: [], position: 0 });

    const [view, setView] = useState("home");          // "home" | "search" | "queue"
    const [search, setSearch] = useState({ query: "", results: [], loading: false });

    const [settings, setSettings] = useState(DEFAULT_SETTINGS);
    const [settingsOpen, setSettingsOpen] = useState(false);

    const wsRef = useRef(null);
    const heartbeatRef = useRef(null);
    const reconnectRef = useRef(null);
    const selectedRef = useRef(null);
    selectedRef.current = selected;

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

    /* ---- safety net: periodically refresh sessions + re-subscribe ---- */

    useEffect(() => {
        if (!connected) return;
        const id = setInterval(() => {
            send("sessions_request");
            const sel = selectedRef.current;
            if (sel?.guildId) send("subscribe", { guildId: sel.guildId });
        }, 12000);
        return () => clearInterval(id);
    }, [connected, send]);

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

    const selectSession = useCallback((session) => {
        setSelected(session);
        setPlayer(null);
        setQueue({ tracks: [], position: 0 });
        if (session?.guildId) {
            send("subscribe", { guildId: session.guildId });
            setView("queue");
        }
    }, [send]);

    const control = useCallback((action, extra = {}) => {
        const sel = selectedRef.current;
        if (!sel?.guildId) return;
        send("action", { guildId: sel.guildId, action, ...extra });
    }, [send]);

    const play = useCallback((query) => {
        const sel = selectedRef.current;
        if (!sel?.guildId || !query) return;
        send("action", { guildId: sel.guildId, action: "play", query });
    }, [send]);

    const runSearch = useCallback(async (query) => {
        if (!query?.trim()) return;
        setView("search");
        setSearch({ query, results: [], loading: true });
        try {
            const res = await fetch(`/api/search?query=${encodeURIComponent(query)}`);
            const json = await res.json();
            setSearch({ query, results: json.results || [], loading: false });
        } catch {
            setSearch({ query, results: [], loading: false });
        }
    }, []);

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
        view, setView,
        search, runSearch,
        settings, updateSettings,
        settingsOpen, setSettingsOpen,
        selectSession,
        control,
        play,
        logout
    };

    return <NiftyContext.Provider value={value}>{children}</NiftyContext.Provider>;
}

export function useNifty() {
    const ctx = useContext(NiftyContext);
    if (!ctx) throw new Error("useNifty must be used within NiftyProvider");
    return ctx;
}
