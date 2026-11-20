// Building blocks for the settings pages. Every page is made of the same few
// parts, so spacing, type and colour stay identical across categories:
//
//   <PageHeading eyebrow title description />   top of a category
//   <Section title>…</Section>                  titled group, hairline below
//   <Rows><Row title description>…</Row></Rows>  label on the left, control right
//   <Switch /> <Segmented /> <Slider /> <Button />   the controls
//   <Card> <Note> <Badge>                        quiet containers
//
// Colours come only from the theme tokens (canvas / surface / accent / maintext
// / subtext), so every theme — light, dark or custom — gets the same layout.

import { useId } from "react";

import Icon from "../Icon.js";

export const FOCUS =
    "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent";

// Hairline used for every divider and inset border.
export const HAIRLINE = "border-maintext/[0.07]";

export function PageHeading({ eyebrow, title, description }) {
    return (
        <header className="mb-7 sm:pr-10">
            <span className="text-[10px] font-bold uppercase tracking-[0.17em] text-accent/75">{eyebrow}</span>
            <h2 className="mb-1.5 mt-1.5 text-[22px] font-semibold leading-tight tracking-tight text-maintext">{title}</h2>
            {description && <p className="text-[13px] leading-relaxed text-subtext">{description}</p>}
        </header>
    );
}

export function Section({ title, children }) {
    return (
        <section className={`mb-6 border-b pb-6 last:mb-0 last:border-b-0 last:pb-0 ${HAIRLINE}`}>
            <h3 className="mb-4 text-[10px] font-bold uppercase tracking-[0.13em] text-subtext">{title}</h3>
            {children}
        </section>
    );
}

// A stack of rows separated by hairlines.
export function Rows({ children }) {
    return <div className="divide-y divide-maintext/[0.06]">{children}</div>;
}

// Copy on the left, control(s) on the right.
export function Row({ title, description, children }) {
    return (
        <div className="flex items-center justify-between gap-6 py-3 first:pt-0 last:pb-0">
            <div className="min-w-0 flex-1">
                <strong className="flex items-center gap-2 text-[13px] font-medium text-maintext">{title}</strong>
                {description && <span className="mt-1 block text-xs leading-relaxed text-subtext">{description}</span>}
            </div>
            {children && <div className="flex shrink-0 items-center gap-2">{children}</div>}
        </div>
    );
}

export function Switch({ checked, onChange, label }) {
    return (
        <button
            type="button"
            role="switch"
            aria-checked={checked}
            aria-label={label}
            onClick={() => onChange(!checked)}
            className={`relative h-[19px] w-[33px] shrink-0 rounded-full border transition-colors ${FOCUS} ${
                checked ? "border-accent bg-accent" : "border-maintext/10 bg-subtext/30"
            }`}
        >
            <span
                className={`absolute left-[2px] top-[2px] grid h-[13px] w-[13px] place-items-center rounded-full bg-white shadow-sm transition-transform duration-200 ${
                    checked ? "translate-x-[14px]" : "opacity-80"
                }`}
            >
                {checked && <Icon name="check" className="h-2 w-2 text-accent" strokeWidth={4.5} />}
            </span>
        </button>
    );
}

export function Segmented({ options, value, onChange, label }) {
    return (
        <div
            role="radiogroup"
            aria-label={label}
            className={`flex shrink-0 items-center gap-0.5 rounded-[7px] border bg-canvas/60 p-[3px] ${HAIRLINE}`}
        >
            {options.map((option) => (
                <button
                    key={option.id}
                    type="button"
                    role="radio"
                    aria-checked={value === option.id}
                    onClick={() => onChange(option.id)}
                    className={`rounded-[5px] px-3 py-1.5 text-xs font-medium transition-colors ${FOCUS} ${
                        value === option.id ? "bg-accent/15 text-accent" : "text-subtext hover:text-maintext"
                    }`}
                >
                    {option.label}
                </button>
            ))}
        </div>
    );
}

// The slider thumb, once per engine (each needs its own pseudo-element, and
// Tailwind only emits classes it can read literally).
const THUMB_PX = 11;
const THUMB_CLASSES = [
    "[&::-webkit-slider-thumb]:h-[15px] [&::-webkit-slider-thumb]:w-[11px] [&::-webkit-slider-thumb]:appearance-none",
    "[&::-webkit-slider-thumb]:rounded-[3px] [&::-webkit-slider-thumb]:bg-white",
    "[&::-webkit-slider-thumb]:shadow-[0_1px_6px_rgb(0_0_0/0.35)]",
    "[&::-moz-range-thumb]:h-[15px] [&::-moz-range-thumb]:w-[11px] [&::-moz-range-thumb]:appearance-none",
    "[&::-moz-range-thumb]:rounded-[3px] [&::-moz-range-thumb]:border-0 [&::-moz-range-thumb]:bg-white",
    "[&::-moz-range-thumb]:shadow-[0_1px_6px_rgb(0_0_0/0.35)]"
].join(" ");

export function Slider({ label, value, min = 0, max, suffix = "", onChange }) {
    const id = useId();
    const ratio = (value - min) / (max - min);
    return (
        <div>
            <div className="flex items-center justify-between gap-3">
                <label htmlFor={id} className="text-[13px] font-medium text-maintext">{label}</label>
                <output htmlFor={id} className="text-xs tabular-nums text-accent">{value}{suffix}</output>
            </div>
            <div className="relative flex h-[26px] items-center">
                <div className="pointer-events-none absolute inset-x-0 h-1 overflow-hidden rounded-full bg-maintext/10">
                    {/* the native thumb's centre travels inside the track by half its width */}
                    <div
                        className="h-full rounded-full bg-accent"
                        style={{ width: `calc(${ratio * 100}% + ${(0.5 - ratio) * THUMB_PX}px)` }}
                    />
                </div>
                <input
                    id={id}
                    type="range"
                    min={min}
                    max={max}
                    value={value}
                    onChange={(e) => onChange(Number(e.target.value))}
                    className={`relative h-full w-full cursor-pointer appearance-none rounded-full bg-transparent ${FOCUS} ${THUMB_CLASSES}`}
                />
            </div>
            <div className="flex justify-between text-[10px] leading-none text-subtext/80" aria-hidden="true">
                <span>{min}{suffix}</span>
                <span>{max}{suffix}</span>
            </div>
        </div>
    );
}

const TONES = {
    neutral: "border-maintext/10 bg-maintext/[0.04] text-maintext hover:bg-maintext/10",
    accent: "border-accent/25 bg-accent/10 text-accent hover:bg-accent/20",
    danger: "border-rose-400/25 bg-rose-400/[0.06] text-rose-400 hover:bg-rose-400/15"
};

// Small rectangular action. Renders an <a> when given an href.
export function Button({ tone = "neutral", icon, spin = false, href, children, ...rest }) {
    const Tag = href ? "a" : "button";
    return (
        <Tag
            {...(href ? { href } : { type: "button" })}
            {...rest}
            className={`flex shrink-0 items-center gap-1.5 rounded-md border px-3 py-2 text-xs font-medium transition-colors disabled:cursor-not-allowed disabled:opacity-40 ${FOCUS} ${TONES[tone]}`}
        >
            {icon && <Icon name={icon} className={`h-3.5 w-3.5 ${spin ? "animate-spin" : ""}`} />}
            {children}
        </Tag>
    );
}

// Inset container, a shade darker than the modal surface.
export function Card({ className = "", children }) {
    return <div className={`rounded-[10px] border bg-canvas ${HAIRLINE} ${className}`}>{children}</div>;
}

// Square tinted tile holding one icon (brand marks, the app glyph).
export function IconTile({ name, className = "h-10 w-10", iconClassName = "h-5 w-5" }) {
    return (
        <span className={`grid shrink-0 place-items-center rounded-[9px] bg-accent/10 text-accent ${className}`}>
            <Icon name={name} className={iconClassName} />
        </span>
    );
}

export function Note({ icon = "info", children }) {
    return (
        <p className="flex items-start gap-2 rounded-[7px] border border-accent/10 bg-accent/[0.04] p-3 text-xs leading-relaxed text-subtext">
            <Icon name={icon} className="mt-px h-3.5 w-3.5 text-accent/70" />
            <span>{children}</span>
        </p>
    );
}

export function Badge({ icon, children }) {
    return (
        <span className="flex items-center gap-1.5 rounded border border-accent/20 px-1.5 py-0.5 text-[10px] font-medium text-accent">
            {icon && <Icon name={icon} className="h-3 w-3" />}
            {children}
        </span>
    );
}
