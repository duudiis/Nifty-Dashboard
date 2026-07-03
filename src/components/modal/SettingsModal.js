// The settings panel rendered inside the app modal (opened from the account
// dropdown). Settings persist through the existing settings store
// (localStorage-backed, applied live).

import { useNifty } from "../../context/NiftyContext.js";
import { THEMES } from "../../context/NiftyContext.js";

function Section({ title, children }) {
    return (
        <section className="flex flex-col gap-3 py-3 first:pt-0 last:pb-0">
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

export default function SettingsPanel() {
    const { settings, updateSettings } = useNifty();

    return (
        <div className="flex flex-col divide-y divide-border/60">
            <Section title="Appearance">
                <div className="grid grid-cols-3 gap-1 sm:grid-cols-5">
                    {THEMES.map((theme) => (
                        <ThemeSwatch
                            key={theme}
                            theme={theme}
                            active={settings.theme === theme}
                            onPick={() => updateSettings({ theme })}
                        />
                    ))}
                </div>
            </Section>

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

            <Section title="">
                <p className="text-[11px] text-subtext">More settings soon.</p>
            </Section>
        </div>
    );
}
