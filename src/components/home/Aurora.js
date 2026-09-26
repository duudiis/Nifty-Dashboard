import { AnimatePresence, motion, EASE } from "../motion/index.js";
import useArtworkPalette from "./useArtworkPalette.js";

/**
 * The home screen's backdrop: curtains of light sweeping right to left in the
 * colours of whatever is playing.
 *
 * The colours are sampled from the cover art and then thrown away — what gets
 * painted is curtains, lobes and travelling points of pure colour, never the
 * artwork itself.
 *
 * With nothing playing, or a sleeve too monochrome to yield a palette, it falls
 * back to the theme's own accent so the band is never empty. All the motion is
 * CSS, so this owns no timers and stops for reduced-motion.
 */

// Only used when there is no palette to work from.
const FALLBACK = [
    "rgb(var(--c-accent))",
    "rgb(var(--c-accent-soft))",
    "rgb(var(--c-accent) / 0.55)",
    "rgb(var(--c-accent-soft) / 0.4)",
    "rgb(var(--c-accent) / 0.7)"
];

/**
 * One tile of a curtain. It has to start and end on the SAME colour: the tile
 * repeats across the strip, so any difference between the two ends would show
 * up as a hard vertical seam sliding past every few seconds.
 *
 * `shift` rotates which colour leads, so the three curtains carry the same
 * palette without lining up into one thick band.
 */
function curtainGradient(colors, shift) {
    const ring = colors.map((_, i) => colors[(i + shift) % colors.length]);
    const stops = [...ring, ring[0]].map((c, i, all) => `${c} ${(i / (all.length - 1)) * 100}%`);
    return `linear-gradient(90deg, ${stops.join(", ")})`;
}

export default function Aurora({ artwork, height = 360 }) {
    const palette = useArtworkPalette(artwork);
    const colors = palette && palette.length ? palette : FALLBACK;

    // Cycled rather than clamped: a two-colour cover still fills every layer,
    // just with its two colours alternating.
    const at = (i) => colors[i % colors.length];

    return (
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 overflow-hidden" style={{ height }}>
            {/* No mode="wait": the outgoing palette has to still be there while
                the incoming one arrives, or a track change dips the whole band
                to black on its way between two colours. Both layers are
                absolute, so they simply cross over each other. */}
            <AnimatePresence initial={false}>
                <motion.div
                    // Keyed on the palette, not the artwork: the colours land a
                    // moment after the track does, and keying on the URL would
                    // cross to the fallback first and then jump again.
                    key={colors.join("|")}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 1.4, ease: EASE }}
                    className="aurora"
                >
                    <div
                        className="aurora-base"
                        style={{ background: `radial-gradient(130% 115% at 50% 0%, ${at(0)} 0%, transparent 76%)` }}
                    />

                    {[1, 2, 3].map((n) => (
                        <div
                            key={`lobe-${n}`}
                            className={`aurora-lobe aurora-lobe-${n}`}
                            style={{ background: `radial-gradient(circle at 50% 50%, ${at(n - 1)} 0%, transparent 72%)` }}
                        />
                    ))}

                    {/* The wrapper drifts vertically, the strip inside it sweeps
                        horizontally — two transforms that would otherwise
                        overwrite each other on one element. */}
                    {[1, 2, 3].map((n) => (
                        <div key={`curtain-${n}`} className={`aurora-curtain aurora-curtain-${n}`}>
                            <div style={{ backgroundImage: curtainGradient(colors, n) }} />
                        </div>
                    ))}

                    {[1, 2, 3].map((n) => (
                        <div
                            key={`point-${n}`}
                            className={`aurora-point aurora-point-${n}`}
                            style={{ background: `radial-gradient(circle at 50% 50%, ${at(n + 1)} 0%, transparent 70%)` }}
                        />
                    ))}
                </motion.div>
            </AnimatePresence>

            {/* Settles the light into the page instead of cutting it off. */}
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-surface" />
        </div>
    );
}
