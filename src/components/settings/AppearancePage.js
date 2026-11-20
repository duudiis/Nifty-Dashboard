import { useNifty, THEME_GROUPS, normalizeCustomTheme } from "../../context/NiftyContext.js";
import Icon from "../Icon.js";
import { FOCUS, HAIRLINE, PageHeading, Row, Rows, Section, Segmented, Slider, Switch } from "./primitives.js";

// A theme swatch renders with its own data-theme scope, so the CSS variables
// preview the real palette without switching the app.
function ThemeSwatch({ theme, active, onPick }) {
    return (
        <button
            type="button"
            onClick={onPick}
            aria-pressed={active}
            className={`flex flex-col gap-2 rounded-[9px] border p-1.5 text-left transition-colors ${FOCUS} ${
                active ? "border-accent/60 bg-accent/[0.07]" : `${HAIRLINE} hover:border-maintext/20`
            }`}
        >
            <span data-theme={theme} className="flex h-12 items-center gap-2 rounded-md bg-canvas px-2.5">
                <span className="h-4 w-4 shrink-0 rounded-full bg-accent" />
                <span className="flex min-w-0 flex-1 flex-col gap-1.5">
                    <span className="h-1.5 w-4/5 rounded-full bg-maintext/85" />
                    <span className="h-1.5 w-1/2 rounded-full bg-subtext/60" />
                </span>
            </span>
            <span className="flex items-center justify-between gap-1 px-1 pb-0.5">
                <span className={`truncate text-[11px] font-medium capitalize ${active ? "text-accent" : "text-subtext"}`}>{theme}</span>
                {active && <Icon name="check" className="h-3 w-3 text-accent" strokeWidth={3} />}
            </span>
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
        <label
            className={`flex cursor-pointer items-center gap-2.5 rounded-[7px] border bg-canvas/60 px-3 py-2 transition-colors hover:border-accent/40 focus-within:border-accent/60 ${HAIRLINE}`}
        >
            <span
                className="relative h-6 w-6 shrink-0 overflow-hidden rounded-md border border-maintext/15"
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
                <span className="truncate text-xs font-medium text-maintext">{label}</span>
                <span className="text-[10px] uppercase tabular-nums text-subtext">{value}</span>
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
                type="button"
                onClick={() => updateSettings({ theme: "custom" })}
                aria-pressed={active}
                className={`flex items-center justify-between gap-4 rounded-[10px] border p-3 text-left transition-colors ${FOCUS} ${
                    active ? "border-accent/60" : `${HAIRLINE} hover:border-maintext/20`
                }`}
                style={{ background: previewBackground }}
            >
                <span className="flex items-center gap-2 rounded-md px-3 py-2.5" style={{ backgroundColor: custom.colors.surface }}>
                    <span className="h-4 w-4 rounded-full" style={{ backgroundColor: custom.colors.accent }} />
                    <span className="flex flex-col gap-1.5">
                        <span className="h-1.5 w-12 rounded-full" style={{ backgroundColor: custom.colors.text }} />
                        <span className="h-1.5 w-7 rounded-full" style={{ backgroundColor: custom.colors.subtext }} />
                    </span>
                </span>
                <span
                    className="flex items-center gap-1.5 rounded-md px-2.5 py-1.5 text-[11px] font-medium"
                    style={{ backgroundColor: custom.colors.accent, color: custom.colors.base }}
                >
                    {active && <Icon name="check" className="h-3 w-3" strokeWidth={3} />}
                    {active ? "Active" : "Use custom theme"}
                </span>
            </button>

            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {COLOR_FIELDS.map((field) => (
                    <ColorField
                        key={field.key}
                        label={field.label}
                        value={custom.colors[field.key]}
                        onChange={(value) => setColor(field.key, value)}
                    />
                ))}
            </div>

            <Rows>
                <Row title="Background gradient" description="Painted across the app frame, behind the cards.">
                    <Switch
                        label="Background gradient"
                        checked={custom.gradient.enabled}
                        onChange={(enabled) => setGradient({ enabled })}
                    />
                </Row>
            </Rows>

            {custom.gradient.enabled && (
                <>
                    <div className="grid grid-cols-2 gap-2">
                        <ColorField label="From" value={custom.gradient.from} onChange={(from) => setGradient({ from })} />
                        <ColorField label="To" value={custom.gradient.to} onChange={(to) => setGradient({ to })} />
                    </div>
                    <Slider
                        label="Angle"
                        value={custom.gradient.angle}
                        max={360}
                        suffix="°"
                        onChange={(angle) => setGradient({ angle })}
                    />
                </>
            )}
        </div>
    );
}

export default function AppearancePage() {
    const { settings, updateSettings } = useNifty();

    const swatches = (themes) => (
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-5">
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
            <PageHeading
                eyebrow="Make it yours"
                title="Appearance"
                description="The theme applies instantly, everywhere."
            />

            <Section title="Dark themes">{swatches(THEME_GROUPS.dark)}</Section>
            <Section title="Light themes">{swatches(THEME_GROUPS.light)}</Section>

            <Section title="Custom theme">
                <p className="-mt-1 mb-4 text-xs leading-relaxed text-subtext">
                    Build your own — every color is yours to pick. Editing anything switches you onto it.
                </p>
                <CustomThemeEditor />
            </Section>

            <Section title="Layout">
                <Rows>
                    <Row title="Right sidebar" description="What the panel next to the queue shows when you open the app.">
                        <Segmented
                            label="Right sidebar"
                            value={settings.rightPanel}
                            onChange={(rightPanel) => updateSettings({ rightPanel })}
                            options={[
                                { id: "queue", label: "Queue" },
                                { id: "nowplaying", label: "Now playing" }
                            ]}
                        />
                    </Row>
                </Rows>
            </Section>
        </>
    );
}
