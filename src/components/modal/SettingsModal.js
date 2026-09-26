// The settings panel rendered inside the app modal — Discord-style: a grouped
// category rail on the left (separated by a hairline divider, same surface),
// the active category's content on the right. Settings persist through the
// existing settings store (localStorage-backed, applied live).

import { useEffect, useState } from "react";

import { useNifty, THEME_GROUPS, normalizeCustomTheme } from "../../context/NiftyContext.js";
import Icon from "../Icon.js";
import { AnimatePresence, motion, EASE } from "../motion/index.js";
import { useModal } from "./Modal.js";

const GROUPS = [
    {
        label: "User settings",
        items: [
            { id: "account", label: "Account", icon: "user" },
            { id: "connections", label: "Connections", icon: "connect" }
        ]
    },
    {
        label: "App settings",
        items: [
            { id: "appearance", label: "Appearance", icon: "grid" },
            { id: "about", label: "About", icon: "info" }
        ]
    }
];

/* ------------------------------------------------------------ primitives */

// A titled block: heading + short description, then the control(s).
function Setting({ title, description, children, inline = false }) {
    return (
        <div className={inline ? "flex items-center justify-between gap-6" : "flex flex-col gap-3"}>
            <div className="flex min-w-0 flex-col gap-0.5">
                <span className="text-sm font-bold text-maintext">{title}</span>
                {description && <span className="text-xs leading-relaxed text-subtext">{description}</span>}
            </div>
            {children}
        </div>
    );
}

function PageHeader({ title, description }) {
    return (
        <div className="flex flex-col gap-1 pb-6">
            <h3 className="text-lg font-extrabold text-maintext">{title}</h3>
            {description && <p className="text-xs leading-relaxed text-subtext">{description}</p>}
        </div>
    );
}

function Segmented({ options, value, onChange }) {
    return (
        <div className="flex w-fit shrink-0 items-center gap-1 rounded-full bg-elevated p-1">
            {options.map((option) => (
                <button
                    key={option.id}
                    onClick={() => onChange(option.id)}
                    className={`rounded-full px-3.5 py-1 text-xs font-bold transition-colors ${
                        value === option.id ? "bg-accent text-canvas" : "text-subtext hover:text-maintext"
                    }`}
                >
                    {option.label}
                </button>
            ))}
        </div>
    );
}

/* ------------------------------------------------------------ appearance */

// A theme swatch renders with its own data-theme scope, so the CSS variables
// preview the real palette without switching the app.
function ThemeSwatch({ theme, active, onPick }) {
    return (
        <button
            onClick={onPick}
            className={`flex flex-col items-center gap-1.5 rounded-lg p-2 transition-colors hover:bg-elevated ${active ? "bg-elevated" : ""}`}
        >
            <span
                data-theme={theme}
                className={`flex h-11 w-[4.5rem] items-center justify-center rounded-md border-2 bg-canvas shadow-sm ${active ? "border-accent" : "border-border"}`}
            >
                <span className="h-4 w-4 rounded-full bg-accent" />
                <span className="ml-1 flex flex-col gap-1">
                    <span className="h-1.5 w-6 rounded-full bg-maintext/80" />
                    <span className="h-1.5 w-4 rounded-full bg-subtext/60" />
                </span>
            </span>
            <span className={`text-[11px] font-medium capitalize ${active ? "text-maintext" : "text-subtext"}`}>{theme}</span>
        </button>
    );
}

const COLOR_FIELDS = [
    { key: "accent", label: "Accent" },
    { key: "base", label: "Background" },
    { key: "surface", label: "Cards" },
    { key: "elevated", label: "Raised" },
    { key: "topbar", label: "Frame" },
    { key: "topbartext", label: "Frame text" },
    { key: "border", label: "Borders" },
    { key: "text", label: "Text" },
    { key: "subtext", label: "Muted text" }
];

function ColorField({ label, value, onChange }) {
    return (
        <label className="flex cursor-pointer items-center gap-2.5 rounded-lg bg-elevated/60 px-3 py-2 transition-colors hover:bg-elevated">
            <span
                className="relative h-6 w-6 shrink-0 overflow-hidden rounded-full border border-border"
                style={{ backgroundColor: value }}
            >
                <input
                    type="color"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                />
            </span>
            <span className="flex min-w-0 flex-col leading-tight">
                <span className="truncate text-xs font-bold text-maintext">{label}</span>
                <span className="text-[10px] uppercase text-subtext">{value}</span>
            </span>
        </label>
    );
}

// Live editor for the fully custom theme. Touching any control switches the
// app onto it, so every change previews instantly.
function CustomThemeEditor() {
    const { settings, updateSettings } = useNifty();
    const custom = normalizeCustomTheme(settings.customTheme);
    const active = settings.theme === "custom";

    const apply = (next) => updateSettings({ theme: "custom", customTheme: next });
    const setColor = (key, value) => apply({ ...custom, colors: { ...custom.colors, [key]: value } });
    const setGradient = (patch) => apply({ ...custom, gradient: { ...custom.gradient, ...patch } });

    const previewBackground = custom.gradient.enabled
        ? `linear-gradient(${custom.gradient.angle}deg, ${custom.gradient.from}, ${custom.gradient.to})`
        : custom.colors.base;

    return (
        <div className="flex flex-col gap-4">
            {/* activate + live preview strip */}
            <button
                onClick={() => updateSettings({ theme: "custom" })}
                className={`flex items-center gap-4 rounded-xl border-2 p-3 text-left transition-colors ${
                    active ? "border-accent" : "border-border hover:border-subtext/50"
                }`}
                style={{ background: previewBackground }}
            >
                <span className="flex items-center gap-2 rounded-lg px-3 py-2" style={{ backgroundColor: custom.colors.surface }}>
                    <span className="h-4 w-4 rounded-full" style={{ backgroundColor: custom.colors.accent }} />
                    <span className="flex flex-col gap-1">
                        <span className="h-1.5 w-10 rounded-full" style={{ backgroundColor: custom.colors.text }} />
                        <span className="h-1.5 w-6 rounded-full" style={{ backgroundColor: custom.colors.subtext }} />
                    </span>
                </span>
                <span
                    className="rounded-full px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide"
                    style={{ backgroundColor: custom.colors.accent, color: custom.colors.base }}
                >
                    {active ? "Active" : "Use custom theme"}
                </span>
            </button>

            {/* colors */}
            <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-3">
                {COLOR_FIELDS.map((field) => (
                    <ColorField
                        key={field.key}
                        label={field.label}
                        value={custom.colors[field.key]}
                        onChange={(value) => setColor(field.key, value)}
                    />
                ))}
            </div>

            {/* gradient */}
            <div className="flex flex-col gap-3 rounded-xl bg-elevated/40 p-4">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex flex-col gap-0.5">
                        <span className="text-xs font-bold text-maintext">Background gradient</span>
                        <span className="text-[11px] text-subtext">Painted across the app frame, behind the cards.</span>
                    </div>
                    <Segmented
                        value={custom.gradient.enabled ? "on" : "off"}
                        onChange={(v) => setGradient({ enabled: v === "on" })}
                        options={[{ id: "off", label: "Off" }, { id: "on", label: "On" }]}
                    />
                </div>
                {custom.gradient.enabled && (
                    <div className="flex flex-wrap items-center gap-3">
                        <div className="grid flex-1 grid-cols-2 gap-1.5">
                            <ColorField label="From" value={custom.gradient.from} onChange={(v) => setGradient({ from: v })} />
                            <ColorField label="To" value={custom.gradient.to} onChange={(v) => setGradient({ to: v })} />
                        </div>
                        <label className="flex w-full items-center gap-3">
                            <span className="text-[11px] font-bold text-subtext">Angle</span>
                            <input
                                type="range"
                                min="0"
                                max="360"
                                value={custom.gradient.angle}
                                onChange={(e) => setGradient({ angle: Number(e.target.value) })}
                                className="flex-1 accent-accent"
                            />
                            <span className="w-10 text-right text-[11px] text-subtext">{custom.gradient.angle}°</span>
                        </label>
                    </div>
                )}
            </div>
        </div>
    );
}

function AppearanceSettings() {
    const { settings, updateSettings } = useNifty();

    const swatches = (themes) => (
        <div className="grid grid-cols-3 gap-1 sm:grid-cols-4 lg:grid-cols-5">
            {themes.map((theme) => (
                <ThemeSwatch
                    key={theme}
                    theme={theme}
                    active={settings.theme === theme}
                    onPick={() => updateSettings({ theme })}
                />
            ))}
        </div>
    );

    return (
        <>
            <PageHeader title="Appearance" description="Make Nifty yours — the theme applies instantly, everywhere." />
            <div className="flex flex-col gap-8">
                <Setting title="Dark themes" description="Easy on the eyes, heavy on the vibes.">
                    {swatches(THEME_GROUPS.dark)}
                </Setting>
                <Setting title="Light themes" description="Bright and clean. Artwork backdrops soften automatically.">
                    {swatches(THEME_GROUPS.light)}
                </Setting>
                <Setting
                    title="Custom theme"
                    description="Build your own — every color is yours to pick, with an optional background gradient. Editing anything switches you onto it."
                >
                    <CustomThemeEditor />
                </Setting>
                <Setting
                    inline
                    title="Right sidebar"
                    description="What the panel next to the queue shows when you open the app."
                >
                    <Segmented
                        value={settings.rightPanel}
                        onChange={(rightPanel) => updateSettings({ rightPanel })}
                        options={[
                            { id: "queue", label: "Queue" },
                            { id: "nowplaying", label: "Now playing" }
                        ]}
                    />
                </Setting>
            </div>
        </>
    );
}

/* --------------------------------------------------------------- account */

function AccountSettings() {
    const { user, library, logout } = useNifty();

    return (
        <>
            <PageHeader title="Account" description="You sign in with Discord — the bot knows you by the same account." />
            <div className="flex flex-col gap-8">
                <div className="flex items-center gap-4 rounded-xl bg-elevated/60 p-4">
                    <img src={user?.avatar_url} alt="" className="h-16 w-16 rounded-full object-cover" />
                    <div className="flex min-w-0 flex-col gap-0.5">
                        <span className="truncate text-base font-extrabold text-maintext">{user?.username}</span>
                        <span className="text-[11px] text-subtext">Discord ID {user?.id}</span>
                    </div>
                </div>

                <Setting title="Your library" description="Everything you've saved, at a glance.">
                    <div className="flex gap-3">
                        {[
                            { label: "Liked songs", value: library.likedUrls.length },
                            { label: "In library", value: library.items.length },
                            { label: "Playlists", value: library.playlists.length }
                        ].map((stat) => (
                            <div key={stat.label} className="flex min-w-[6.5rem] flex-col gap-0.5 rounded-xl bg-elevated/60 px-4 py-3">
                                <span className="text-xl font-extrabold text-maintext">{stat.value}</span>
                                <span className="text-[11px] text-subtext">{stat.label}</span>
                            </div>
                        ))}
                    </div>
                </Setting>

                <Setting inline title="Log out" description="Ends this browser session. Your library stays.">
                    <button
                        onClick={logout}
                        className="shrink-0 rounded-full bg-rose-500/10 px-4 py-1.5 text-xs font-bold text-rose-400 transition hover:bg-rose-500/20"
                    >
                        Log out
                    </button>
                </Setting>
            </div>
        </>
    );
}

/* ----------------------------------------------------------- connections */

const PLATFORM_META = {
    spotify: { name: "Spotify", blurb: "Import your Spotify liked songs, kept in sync." },
    deezer: { name: "Deezer", blurb: "Import your Deezer favorite tracks." },
    youtube: { name: "YouTube", blurb: "Import your YouTube liked videos." },
    tidal: { name: "Tidal", blurb: "Import your Tidal favorite tracks." }
};

function timeAgo(iso) {
    if (!iso) return null;
    const secs = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
    if (secs < 60) return "just now";
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}

function ConnectionsSettings() {
    const { notify, refreshLibrary } = useNifty();
    const modal = useModal();
    const [state, setState] = useState(null); // { providers, connections }
    const [busy, setBusy] = useState(null);    // provider id mid-action

    const load = () =>
        fetch("/api/connect")
            .then((r) => r.json())
            .then(setState)
            .catch(() => setState({ providers: [], connections: [] }));

    useEffect(() => { load(); }, []);

    const connectionFor = (id) => state?.connections?.find((c) => c.provider === id);

    const sync = async (id) => {
        setBusy(id);
        try {
            const res = await fetch("/api/connect", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "sync", provider: id })
            });
            const j = await res.json();
            if (!res.ok) throw new Error(j.message);
            notify(j.imported > 0 ? `Imported ${j.imported} new liked song${j.imported === 1 ? "" : "s"}` : "Already up to date");
            refreshLibrary();
            await load();
        } catch {
            notify("Couldn't sync — try reconnecting");
        } finally {
            setBusy(null);
        }
    };

    const disconnect = async (id) => {
        const name = PLATFORM_META[id].name;
        const conn = connectionFor(id);
        const count = conn?.likedCount || 0;
        const sure = await modal.confirm({
            title: `Disconnect ${name}?`,
            message: `The ${count > 0 ? count + " " : ""}liked song${count === 1 ? "" : "s"} imported from ${name} will be removed from your Liked songs. Songs you liked here, or that came from another connected account, stay. You can reconnect and re-import any time.`,
            confirmLabel: "Disconnect & remove",
            danger: true
        });
        if (!sure) return;

        setBusy(id);
        try {
            const res = await fetch("/api/connect", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "disconnect", provider: id })
            });
            const j = await res.json();
            if (!res.ok) throw new Error(j.message);
            notify(j.removed > 0
                ? `Disconnected ${name} — removed ${j.removed} imported song${j.removed === 1 ? "" : "s"}`
                : `Disconnected ${name}`);
            refreshLibrary();
            await load();
        } catch {
            notify(`Couldn't disconnect ${name}`);
        } finally {
            setBusy(null);
        }
    };

    return (
        <>
            <PageHeader
                title="Connections"
                description="Link your music accounts to import your liked songs. Imports keep their original dates and merge into one Liked songs list, newest first."
            />
            {state === null ? (
                <div className="flex flex-col gap-2">
                    {Object.keys(PLATFORM_META).map((k) => (
                        <div key={k} className="h-[4.5rem] rounded-xl bg-elevated/60" />
                    ))}
                </div>
            ) : (
                <div className="flex flex-col gap-2">
                    {(state.providers || []).map((p) => {
                        const meta = PLATFORM_META[p.id];
                        const conn = connectionFor(p.id);
                        const working = busy === p.id;
                        return (
                            <div key={p.id} className="flex items-center gap-4 rounded-xl bg-elevated/60 px-4 py-3.5">
                                <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                                    <span className="flex items-center gap-2 text-sm font-bold text-maintext">
                                        {meta.name}
                                        {conn && <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-accent">Connected</span>}
                                    </span>
                                    <span className="text-[11px] text-subtext">
                                        {conn
                                            ? `${conn.externalName || "Account"} · ${conn.likedCount || 0} imported${conn.lastSyncedAt ? ` · synced ${timeAgo(conn.lastSyncedAt)}` : ""}`
                                            : p.available ? meta.blurb : "Not configured on this server."}
                                    </span>
                                </div>

                                {conn ? (
                                    <div className="flex shrink-0 items-center gap-2">
                                        <button
                                            onClick={() => sync(p.id)}
                                            disabled={working}
                                            className="flex items-center gap-1.5 rounded-full bg-elevated px-3 py-1.5 text-xs font-bold text-maintext transition hover:bg-border/60 disabled:opacity-50"
                                        >
                                            <Icon name={working ? "spinner" : "sync"} className={`h-3.5 w-3.5 ${working ? "animate-spin" : ""}`} />
                                            {working ? "Syncing…" : "Sync"}
                                        </button>
                                        <button
                                            onClick={() => disconnect(p.id)}
                                            disabled={working}
                                            className="rounded-full bg-rose-500/10 px-3 py-1.5 text-xs font-bold text-rose-400 transition hover:bg-rose-500/20 disabled:opacity-50"
                                        >
                                            Disconnect
                                        </button>
                                    </div>
                                ) : (
                                    <a
                                        href={p.available ? `/api/connect/${p.id}/start` : undefined}
                                        aria-disabled={!p.available}
                                        className={`shrink-0 rounded-full px-4 py-1.5 text-xs font-bold transition ${
                                            p.available
                                                ? "bg-accent text-canvas hover:brightness-110"
                                                : "pointer-events-none bg-elevated text-subtext"
                                        }`}
                                    >
                                        {p.available ? "Connect" : "Unavailable"}
                                    </a>
                                )}
                            </div>
                        );
                    })}
                </div>
            )}
        </>
    );
}

/* ------------------------------------------------------------------ about */

function AboutSettings() {
    const [build, setBuild] = useState(null);

    useEffect(() => {
        let stale = false;
        fetch("/api/version")
            .then((r) => r.json())
            .then((j) => !stale && setBuild(j.version || null))
            .catch(() => {});
        return () => { stale = true; };
    }, []);

    return (
        <>
            <PageHeader title="About" description="What you're running, and where it lives." />
            <div className="flex flex-col gap-8">
                <div className="flex items-center gap-4 rounded-xl bg-elevated/60 p-4">
                    <span className="flex h-14 w-14 items-center justify-center rounded-xl bg-accent/15 text-accent">
                        <Icon name="boombox" className="h-8 w-8" />
                    </span>
                    <div className="flex flex-col gap-0.5">
                        <span className="text-base font-extrabold text-maintext">Nifty Dashboard</span>
                        <span className="text-[11px] text-subtext">
                            A Spotify-style remote for the Nifty Discord music bot.
                        </span>
                        {build && <span className="text-[11px] text-subtext/70">Build {String(build).slice(0, 12)}</span>}
                    </div>
                </div>

                <Setting title="How it works" description="The bot is the source of truth: it plays the music and writes every change to a shared database. This dashboard reads that database and sends the bot commands — what you see is what every listener hears.">
                </Setting>

                <Setting title="Source" description="Dashboard and bot, side by side.">
                    <div className="flex gap-2">
                        <a
                            href="https://github.com/duudiis/Nifty-Dashboard"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 rounded-full bg-elevated px-4 py-1.5 text-xs font-bold text-maintext transition hover:bg-border/60"
                        >
                            <Icon name="open" className="h-3.5 w-3.5" /> Dashboard repo
                        </a>
                        <a
                            href="https://github.com/duudiis/Nifty"
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-2 rounded-full bg-elevated px-4 py-1.5 text-xs font-bold text-maintext transition hover:bg-border/60"
                        >
                            <Icon name="open" className="h-3.5 w-3.5" /> Bot repo
                        </a>
                    </div>
                </Setting>
            </div>
        </>
    );
}

/* ------------------------------------------------------------------ shell */

const PAGES = {
    account: AccountSettings,
    connections: ConnectionsSettings,
    appearance: AppearanceSettings,
    about: AboutSettings
};

export default function SettingsPanel({ initial = "appearance" }) {
    const [category, setCategory] = useState(PAGES[initial] ? initial : "appearance");
    const Page = PAGES[category] || AppearanceSettings;

    return (
        <div className="flex h-[42rem] max-h-[78vh] min-h-0">
            {/* category rail — same surface, hairline divider */}
            <nav className="flex w-52 shrink-0 flex-col gap-4 overflow-y-auto border-r border-border/60 p-4">
                {GROUPS.map((group) => (
                    <div key={group.label} className="flex flex-col gap-0.5">
                        <span className="px-3 pb-1 text-[10px] font-bold uppercase tracking-widest text-subtext/70">
                            {group.label}
                        </span>
                        {group.items.map((item) => (
                            <button
                                key={item.id}
                                onClick={() => setCategory(item.id)}
                                className={`flex items-center gap-2.5 rounded-md px-3 py-1.5 text-left text-[13px] font-bold transition-colors ${
                                    category === item.id
                                        ? "bg-elevated text-maintext"
                                        : "text-subtext hover:bg-elevated/50 hover:text-maintext"
                                }`}
                            >
                                <Icon name={item.icon} className="h-4 w-4" />
                                {item.label}
                            </button>
                        ))}
                    </div>
                ))}
            </nav>

            {/* content */}
            <div className="min-h-0 flex-1 overflow-y-auto px-8 py-6">
                <AnimatePresence mode="popLayout" initial={false}>
                    <motion.div
                        key={category}
                        initial={{ opacity: 0, x: 6 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -6 }}
                        transition={{ duration: 0.14, ease: EASE }}
                    >
                        <Page />
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
}
