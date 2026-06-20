import { useNifty, THEMES } from "../context/NiftyContext.js";

const THEME_SWATCHES = {
    nifty: ["#09090b", "#79a5fa"],
    spotify: ["#000000", "#1db954"],
    amethyst: ["#0e0a14", "#a855f7"],
    crimson: ["#100809", "#f43f5e"],
    light: ["#f7f7f8", "#2563eb"]
};

function Toggle({ checked, onChange }) {
    return (
        <button
            onClick={() => onChange(!checked)}
            className={`relative h-6 w-11 rounded-full transition ${checked ? "bg-accent" : "bg-border"}`}
        >
            <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white transition-all ${checked ? "left-[22px]" : "left-0.5"}`} />
        </button>
    );
}

function Row({ title, desc, children }) {
    return (
        <div className="flex items-center justify-between gap-4 py-3">
            <div>
                <p className="text-sm font-bold text-maintext">{title}</p>
                {desc && <p className="text-xs text-subtext">{desc}</p>}
            </div>
            {children}
        </div>
    );
}

export default function SettingsModal() {
    const { settingsOpen, setSettingsOpen, settings, updateSettings } = useNifty();
    if (!settingsOpen) return null;

    return (
        <div
            className="fixed inset-0 z-[60] flex items-center justify-center bg-black/60 p-4"
            onClick={() => setSettingsOpen(false)}
        >
            <div
                className="pop-in w-full max-w-md rounded-2xl border border-border bg-elevated p-6 shadow-2xl"
                onClick={(e) => e.stopPropagation()}
            >
                <div className="mb-4 flex items-center justify-between">
                    <h2 className="text-lg font-bold text-maintext">Settings</h2>
                    <button onClick={() => setSettingsOpen(false)} className="text-subtext hover:text-maintext">
                        <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
                            <path d="m12 10.6 5.3-5.3 1.4 1.4-5.3 5.3 5.3 5.3-1.4 1.4-5.3-5.3-5.3 5.3-1.4-1.4 5.3-5.3-5.3-5.3 1.4-1.4 5.3 5.3Z" />
                        </svg>
                    </button>
                </div>

                {/* Theme */}
                <div className="py-3">
                    <p className="mb-3 text-sm font-bold text-maintext">Theme</p>
                    <div className="grid grid-cols-5 gap-3">
                        {THEMES.map((theme) => {
                            const [bg, accent] = THEME_SWATCHES[theme];
                            const active = settings.theme === theme;
                            return (
                                <button
                                    key={theme}
                                    onClick={() => updateSettings({ theme })}
                                    className={`flex flex-col items-center gap-1.5 rounded-lg p-1 transition ${active ? "ring-2 ring-accent" : "hover:bg-surface"}`}
                                    title={theme}
                                >
                                    <span
                                        className="h-10 w-full rounded-md border border-border"
                                        style={{ background: `linear-gradient(135deg, ${bg} 55%, ${accent} 55%)` }}
                                    />
                                    <span className="text-[10px] capitalize text-subtext">{theme}</span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                <div className="border-t border-border/60" />

                <Row title="Compact player" desc="Slim bottom bar with a thin progress line.">
                    <Toggle checked={settings.compact} onChange={(v) => updateSettings({ compact: v })} />
                </Row>

                <Row title="Right panel" desc="What the right column shows by default.">
                    <div className="flex gap-1 rounded-full bg-surface p-1">
                        {["queue", "nowplaying"].map((id) => (
                            <button
                                key={id}
                                onClick={() => updateSettings({ rightPanel: id })}
                                className={`rounded-full px-3 py-1 text-xs font-bold capitalize transition ${settings.rightPanel === id ? "bg-accent text-canvas" : "text-subtext"}`}
                            >
                                {id === "nowplaying" ? "Now playing" : "Queue"}
                            </button>
                        ))}
                    </div>
                </Row>
            </div>
        </div>
    );
}
