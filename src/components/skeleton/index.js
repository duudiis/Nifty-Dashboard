// The loading wash.
//
// A box still waiting on its data paints no content and lays a soft themed
// band over itself, which fades away once the data lands.
//
//   <div className="relative …">              the box must be positioned
//       <LoadingWash show={!ready} sweep="narrow" />
//       {ready && <RealContent />}
//   </div>
//
// It is deliberately a SIBLING overlay, not a wrapper around the content.
// Wrapping the live view in an <AnimatePresence> stacked a second presence
// layer on top of the ones the views run themselves (SlideTransition, Reorder,
// layoutScroll): the centre view stopped swapping on navigation and the right
// panel rendered its backdrop with no content in it. An overlay can't reach
// them, so the views keep behaving exactly as they do without it.

import { AnimatePresence, motion, EASE } from "../motion/index.js";

// How fast the band crosses. It travels a share of the box's own width, so a
// wide box needs a longer cycle to look like it is moving at the same speed as
// a narrow one. The default suits the centre view.
const SWEEP = {
    narrow: "box-shimmer-narrow", // the sidebars
    wide: "box-shimmer-wide"      // the full-width player bar
};

export default function LoadingWash({ show, sweep, className = "rounded-lg" }) {
    return (
        <AnimatePresence>
            {show && (
                <motion.div
                    initial={{ opacity: 1 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.3, ease: EASE }}
                    className="pointer-events-none absolute inset-0 z-20"
                >
                    <div className={`box-shimmer h-full w-full ${className} ${SWEEP[sweep] || ""}`} />
                </motion.div>
            )}
        </AnimatePresence>
    );
}
