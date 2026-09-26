import Icon from "../Icon.js";
import { motion, variants, EASE, DUR } from "../motion/index.js";

/* Small shared pieces the home sections build from. Everything here draws from
   the theme tokens, so all fourteen themes — light families included — get a
   readable version for free. */

// A number worth glancing at, with an optional week-over-week delta.
export function StatTile({ label, value, delta = null, hint, onClick }) {
    const up = delta != null && delta > 0;
    const flat = delta === null || Math.abs(delta) < 1;

    return (
        <motion.button
            variants={variants.pop}
            initial="initial"
            animate="animate"
            transition={{ duration: DUR.base, ease: EASE }}
            onClick={onClick}
            title={hint}
            className={`flex flex-col items-start gap-1 rounded-xl bg-elevated/60 p-4 text-left transition ${onClick ? "hover:bg-elevated" : "cursor-default"}`}
        >
            <span className="text-2xl font-bold leading-none text-maintext">{value}</span>
            <span className="text-[10px] font-bold uppercase tracking-wide text-subtext">{label}</span>
            {!flat && (
                <span className={`text-[11px] font-bold ${up ? "text-accent" : "text-subtext"}`}>
                    {up ? "↑" : "↓"} {Math.abs(Math.round(delta))}%
                </span>
            )}
        </motion.button>
    );
}

// Discord avatars 404 once a member leaves a guild, so every avatar on this
// page falls back to a glyph rather than a broken image.
export function Avatar({ src, name, className = "h-8 w-8" }) {
    return src ? (
        <img
            src={src}
            alt=""
            title={name}
            onError={(e) => { e.currentTarget.style.display = "none"; }}
            className={`${className} shrink-0 rounded-full object-cover`}
        />
    ) : (
        <span title={name} className={`${className} flex shrink-0 items-center justify-center rounded-full bg-elevated text-subtext`}>
            <Icon name="user" className="h-1/2 w-1/2" />
        </span>
    );
}

// Overlapping faces — "four people heard this".
export function FacePile({ faces = [], max = 4, size = "h-6 w-6" }) {
    const shown = faces.slice(0, max);
    const extra = faces.length - shown.length;
    if (!shown.length) return null;

    return (
        <span className="flex items-center -space-x-2">
            {shown.map((f, i) => (
                <span key={f.id || i} className="rounded-full ring-2 ring-surface">
                    <Avatar src={f.avatar} name={f.name} className={size} />
                </span>
            ))}
            {extra > 0 && (
                <span className={`${size} flex items-center justify-center rounded-full bg-elevated text-[9px] font-bold text-subtext ring-2 ring-surface`}>
                    +{extra}
                </span>
            )}
        </span>
    );
}

// One person in a ranking: face, name, a proportional bar, and what they last
// put on.
export function PeopleRow({ person, rank, fraction = 0, meta, onClick }) {
    return (
        <button
            onClick={onClick}
            className="flex w-full items-center gap-3 rounded-md px-2 py-2 text-left transition hover:bg-elevated"
        >
            <span className="w-4 shrink-0 text-center text-xs font-bold text-subtext">{rank}</span>
            <Avatar src={person.avatar} name={person.name} className="h-9 w-9" />
            <span className="flex min-w-0 flex-1 flex-col gap-1">
                <span className="flex items-baseline gap-2">
                    <span className="truncate text-[13px] font-bold text-maintext">{person.name}</span>
                    {person.isYou && <span className="shrink-0 text-[10px] font-bold uppercase tracking-wide text-accent">you</span>}
                </span>
                <span className="h-1 w-full overflow-hidden rounded-full bg-elevated">
                    <span
                        className="block h-full rounded-full bg-accent transition-[width] duration-500"
                        style={{ width: `${Math.max(4, Math.round(fraction * 100))}%` }}
                    />
                </span>
            </span>
            {meta && <span className="shrink-0 text-[11px] text-subtext">{meta}</span>}
        </button>
    );
}

// A quiet provenance badge — "via autoplay", "3 plays", "2 years ago".
export function Pill({ children, tone = "quiet" }) {
    return (
        <span
            className={`inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-bold ${
                tone === "accent" ? "bg-accent/15 text-accent" : "bg-elevated text-subtext"
            }`}
        >
            {children}
        </span>
    );
}
