// Artwork-driven page backdrop: the cover itself, blown up and heavily
// blurred, fading into the page background — every album/artist/playlist gets
// a header tinted by its own art instead of one static accent gradient.
// Pure CSS on top of the artwork URL, so it needs no pixel access (remote
// covers are cross-origin and would taint a canvas).
//
// Rendered inside the transition's pinned (non-sliding) layer — see
// CenterContent — so the blur never leaks past the header while the page
// content slides up.

import { AnimatePresence, motion } from "../motion/index.js";

export default function Backdrop({ artwork, height = 340 }) {
    return (
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 overflow-hidden" style={{ height }}>
            <AnimatePresence>
                {artwork && (
                    <motion.div
                        key={artwork}
                        className="absolute inset-0"
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.45, ease: [0.4, 0, 0.2, 1] }}
                    >
                        {artwork === "accent" ? (
                            <div className="h-full w-full bg-gradient-to-br from-accent to-accent/40 opacity-60" />
                        ) : (
                            <img
                                src={artwork}
                                alt=""
                                className="backdrop-art h-full w-full scale-125 object-cover opacity-60 blur-3xl saturate-150"
                            />
                        )}
                        <div className="absolute inset-0 bg-scrim/30" />
                        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-surface" />
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
