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
    { key: "border", label: "Borders" },
    { key: "text", label: "Text" },
    { key: "subtext", label: "Muted text" },
    { key: "topbar", label: "Frame" },
    { key: "topbartext", label: "Frame text" }
];

// A colour chip: the swatch opens the native picker, the hex shows on hover.
function ColorChip({ label, value, onChange }) {
    return (
        <label
            title={value.toUpperCase()}
            className="flex min-w-0 cursor-pointer items-center gap-2 rounded-md px-1.5 py-1 transition-colors hover:bg-maintext/[0.06] focus-within:bg-maintext/[0.06]"
        >
            <span
                className="relative h-[18px] w-[18px] shrink-0 overflow-hidden rounded-[5px] ring-1 ring-maintext/20"
                style={{ backgroundColor: value }}
            >
                <input
                    type="color"
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    aria-label={label}
                    className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                />
            </span>
            <span className="truncate text-xs text-maintext">{label}</span>
        </label>
    );
}

// The app in miniature, painted with the custom palette: frame, three boxes,
// player bar. Clicking it switches onto the custom theme.
function ThemePreview({ custom, active, onPick }) {
    const { colors, gradient } = custom;
    const frame = gradient.enabled ? `linear-gradient(${gradient.angle}deg, ${gradient.from}, ${gradient.to})` : colors.topbar;
    const line = (color, width) => <span className="block h-[3px] rounded-full" style={{ backgroundColor: color, width }} />;
    const box = (children, className = "") => (
        <span className={`flex flex-col gap-[5px] rounded-[4px] p-[6px] ${className}`} style={{ backgroundColor: colors.surface }}>
            {children}
        </span>
    );

    return (
        <button
            type="button"
            onClick={onPick}
            aria-pressed={active}
            aria-label={active ? "Custom theme (active)" : "Use custom theme"}
            className={`group relative flex h-[112px] w-full shrink-0 flex-col gap-[4px] overflow-hidden rounded-lg border p-[5px] text-left transition-colors sm:w-[188px] ${FOCUS} ${
                active ? "border-accent/70" : "border-maintext/10 hover:border-maintext/30"
            }`}
            style={{ background: frame }}
        >
            <span className="flex items-center justify-between px-[3px] pt-[2px]">
                {line(colors.topbartext, 22)}
                <span className="h-[5px] w-[42px] rounded-full" style={{ backgroundColor: colors.topbartext, opacity: 0.18 }} />
                <span className="h-[6px] w-[6px] rounded-full" style={{ backgroundColor: colors.topbartext, opacity: 0.5 }} />
            </span>
            <span className="grid min-h-0 flex-1 grid-cols-[1fr_2fr_1fr] gap-[4px]">
                {box(<>{line(colors.text, "70%")}{line(colors.subtext, "50%")}{line(colors.subtext, "60%")}</>)}
                {box(
                    <>
                        <span className="flex items-center gap-[5px]">
                            <span className="h-[14px] w-[14px] rounded-[3px]" style={{ backgroundColor: colors.elevated, boxShadow: `inset 0 0 0 1px ${colors.border}` }} />
                            <span className="flex flex-1 flex-col gap-[4px]">{line(colors.text, "65%")}{line(colors.subtext, "40%")}</span>
                        </span>
                        {line(colors.border, "100%")}
                        {line(colors.subtext, "80%")}
                        {line(colors.subtext, "55%")}
                    </>
                )}
                {box(<>{line(colors.text, "60%")}{line(colors.subtext, "75%")}</>)}
            </span>
            <span className="flex items-center gap-[5px] px-[3px] pb-[1px]">
                <span className="h-[7px] w-[7px] rounded-full" style={{ backgroundColor: colors.accent }} />
                <span className="relative h-[3px] flex-1 overflow-hidden rounded-full" style={{ backgroundColor: `${colors.topbartext}33` }}>
                    <span className="absolute inset-y-0 left-0 w-2/5 rounded-full" style={{ backgroundColor: colors.accent }} />
                </span>
            </span>

            <span
                className={`absolute right-1.5 top-1.5 flex items-center gap-1 rounded px-1.5 py-0.5 text-[10px] font-medium transition-opacity ${
                    active ? "" : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"
                }`}
                style={{ backgroundColor: colors.accent, color: colors.base }}
            >
                {active && <Icon name="check" className="h-2.5 w-2.5" strokeWidth={3.5} />}
                {active ? "Active" : "Use"}
            </span>
        </button>
    );
}

// Live editor for the fully custom theme, in one compact card: the preview,
// every colour as a chip, and the frame gradient on a single line. Touching
// any control switches the app onto it, so every change previews instantly.
function CustomThemeEditor() {
    const { settings, updateSettings } = useNifty();
    const custom = normalizeCustomTheme(settings.customTheme);
    const active = settings.theme === "custom";

    const apply = (next) => updateSettings({ theme: "custom", customTheme: next });
    const setColor = (key, value) => apply({ ...custom, colors: { ...custom.colors, [key]: value } });
    const setGradient = (patch) => apply({ ...custom, gradient: { ...custom.gradient, ...patch } });

    return (
        <div className={`rounded-[10px] border bg-canvas/60 ${HAIRLINE}`}>
            <div className="flex flex-col gap-4 p-3 sm:flex-row sm:items-center">
                <ThemePreview custom={custom} active={active} onPick={() => updateSettings({ theme: "custom" })} />
                <div className="grid min-w-0 flex-1 grid-cols-2 gap-x-2 gap-y-1 sm:grid-cols-3">
                    {COLOR_FIELDS.map((field) => (
                        <ColorChip
                            key={field.key}
                            label={field.label}
                            value={custom.colors[field.key]}
                            onChange={(value) => setColor(field.key, value)}
                        />
                    ))}
                </div>
            </div>

            <div className={`flex min-h-[46px] flex-wrap items-center gap-x-4 gap-y-1 border-t px-3 py-2 ${HAIRLINE}`}>
                <span className="flex items-center gap-2.5">
                    <Switch
                        label="Frame gradient"
                        checked={custom.gradient.enabled}
                        onChange={(enabled) => setGradient({ enabled })}
                    />
                    <span className="text-xs font-medium text-maintext">Frame gradient</span>
                </span>
                {custom.gradient.enabled ? (
                    <>
                        <span className="flex items-center">
                            <ColorChip label="From" value={custom.gradient.from} onChange={(from) => setGradient({ from })} />
                            <ColorChip label="To" value={custom.gradient.to} onChange={(to) => setGradient({ to })} />
                        </span>
                        <Slider
                            inline
                            label="Angle"
                            value={custom.gradient.angle}
                            max={360}
                            suffix="°"
                            onChange={(angle) => setGradient({ angle })}
                        />
                    </>
                ) : (
                    <span className="text-xs text-subtext">Paint a gradient across the app frame, behind the cards.</span>
                )}
            </div>
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
                <p className="-mt-1 mb-3 text-xs leading-relaxed text-subtext">
                    Pick any color — editing switches you onto it.
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
