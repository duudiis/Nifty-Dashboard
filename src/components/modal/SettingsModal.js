// The settings panel rendered inside the app modal (opened from the account
// dropdown): a category rail on the left, the active category's content on
// the right. Settings persist through the existing settings store
// (localStorage-backed, applied live).

import { useState } from "react";

import { useNifty, THEME_GROUPS } from "../../context/NiftyContext.js";
import Icon from "../Icon.js";
import { AnimatePresence, motion, EASE } from "../motion/index.js";

const CATEGORIES = [
    { id: "appearance", label: "Appearance", icon: "grid" },
    { id: "account", label: "Account", icon: "user" }
];

function Section({ title, children }) {
    return (
        <section className="flex flex-col gap-3">
            <h3 className="text-xs font-bold uppercase tracking-wide text-subtext">{title}</h3>
            {children}
        </section>
    );
}

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
                className={`flex h-10 w-16 items-center justify-center rounded-md border bg-canvas ${active ? "border-accent" : "border-border"}`}
            >
                <span className="h-4 w-4 rounded-full bg-accent" />
                <span className="ml-1 h-2 w-6 rounded-full bg-maintext/70" />
            </span>
            <span className={`text-[11px] font-medium capitalize ${active ? "text-maintext" : "text-subtext"}`}>{theme}</span>
        </button>
    );
}

function Segmented({ options, value, onChange }) {
    return (
        <div className="flex w-fit items-center gap-1 rounded-full bg-elevated p-1">
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

function AppearanceSettings() {
    const { settings, updateSettings } = useNifty();

    const swatches = (themes) => (
        <div className="grid grid-cols-3 gap-1 sm:grid-cols-4">
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
        <div className="flex flex-col gap-7">
            <Section title="Dark themes">{swatches(THEME_GROUPS.dark)}</Section>
            <Section title="Light themes">{swatches(THEME_GROUPS.light)}</Section>
            <Section title="Layout">
                <div className="flex items-center justify-between gap-4">
                    <div className="flex flex-col">
                        <span className="text-sm font-medium text-maintext">Right sidebar</span>
                        <span className="text-[11px] text-subtext">What the right panel shows by default.</span>
                    </div>
                    <Segmented
                        value={settings.rightPanel}
                        onChange={(rightPanel) => updateSettings({ rightPanel })}
                        options={[
                            { id: "queue", label: "Queue" },
                            { id: "nowplaying", label: "Now playing" }
                        ]}
                    />
                </div>
            </Section>
        </div>
    );
}

function AccountSettings() {
    const { user, library, logout } = useNifty();

    return (
        <div className="flex flex-col gap-7">
            <Section title="Signed in as">
                <div className="flex items-center gap-4">
                    <img src={user?.avatar_url} alt="" className="h-14 w-14 rounded-full object-cover" />
                    <div className="flex min-w-0 flex-col">
                        <span className="truncate text-sm font-bold text-maintext">{user?.username}</span>
                        <span className="text-[11px] text-subtext">Discord ID {user?.id}</span>
                        <span className="text-[11px] text-subtext">
                            {library.likedUrls.length} liked song{library.likedUrls.length === 1 ? "" : "s"} · {library.items.length} in library
                        </span>
                    </div>
                </div>
            </Section>
            <Section title="Session">
                <button
                    onClick={logout}
                    className="w-fit rounded-full bg-rose-500/10 px-4 py-1.5 text-xs font-bold text-rose-400 transition hover:bg-rose-500/20"
                >
                    Log out
                </button>
            </Section>
        </div>
    );
}

export default function SettingsPanel() {
    const [category, setCategory] = useState("appearance");

    return (
        <div className="flex h-[26rem] min-h-0">
            {/* category rail */}
            <nav className="flex w-44 shrink-0 flex-col gap-1 bg-elevated/40 p-3">
                {CATEGORIES.map((c) => (
                    <button
                        key={c.id}
                        onClick={() => setCategory(c.id)}
                        className={`flex items-center gap-2.5 rounded-md px-3 py-2 text-left text-[13px] font-bold transition-colors ${
                            category === c.id ? "bg-elevated text-maintext" : "text-subtext hover:text-maintext"
                        }`}
                    >
                        <Icon name={c.icon} className="h-4 w-4" />
                        {c.label}
                    </button>
                ))}
                <span className="mt-auto px-3 pb-1 text-[10px] text-subtext/70">More settings soon</span>
            </nav>

            {/* content */}
            <div className="min-h-0 flex-1 overflow-y-auto p-6">
                <AnimatePresence mode="popLayout" initial={false}>
                    <motion.div
                        key={category}
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.15, ease: EASE }}
                    >
                        {category === "appearance" ? <AppearanceSettings /> : <AccountSettings />}
                    </motion.div>
                </AnimatePresence>
            </div>
        </div>
    );
}
