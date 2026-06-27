// Modular animation system.
//
// One place for every motion primitive the app uses, so transitions stay
// consistent and new screens can opt in with a single wrapper. Built on
// framer-motion; everything here is a thin, named convenience layer.
//
//   <SlideTransition transitionKey={view}>…</SlideTransition>  page/panel slide
//   <FadeIn>…</FadeIn>                                   simple reveal
//   <Stagger><StaggerItem/>…</Stagger>                   list cascade
//   <Pressable>…</Pressable>                             tap/hover feedback
//
// Prefer these over hand-rolling `motion.div` so timing/easing live in one file.

import { AnimatePresence, Reorder, animate, motion, useDragControls } from "framer-motion";

// Shared easing + durations. Tweak here to retune the whole app.
export const EASE = [0.4, 0, 0.2, 1];
export const DUR = { fast: 0.18, base: 0.32, slow: 0.5 };

// One source of truth for the centre view + right-sidebar panel slide, so every
// layout enters/leaves with the same feel. mode="wait" plays exit then enter
// back-to-back, so the exit is quick and the enter medium.
const TRANSITION = {
    enter: { duration: 0.32, ease: EASE },
    exit: { duration: 0.18, ease: EASE },
    riseFrom: 12,  // px the foreground rises from on enter
    driftTo: -10   // px the foreground drifts to on exit
};

// The transition is split across two stacked layers:
//   • layerFade  — fills the container, fades + blurs the whole view, never
//     translates. A pinned backdrop lives here, so it stays put.
//   • layerSlide — the foreground, which only translates (y). Because the
//     backdrop below it doesn't move, the slide can never expose the bare box
//     background at the leading edge (the old gradient-edge "reveal").
// layerSlide has no initial/animate/exit props of its own, so it inherits the
// animation state from layerFade and just applies its own y variants.
const layerFade = {
    initial: { opacity: 0, filter: "blur(4px)" },
    animate: { opacity: 1, filter: "blur(0px)", transition: TRANSITION.enter },
    exit: { opacity: 0, filter: "blur(4px)", transition: TRANSITION.exit }
};
const layerSlide = {
    initial: { y: TRANSITION.riseFrom },
    animate: { y: 0, transition: TRANSITION.enter },
    exit: { y: TRANSITION.driftTo, transition: TRANSITION.exit }
};

export const variants = {
    fade: {
        initial: { opacity: 0, y: 10 },
        animate: { opacity: 1, y: 0 },
        exit: { opacity: 0, y: 6 }
    },
    pop: {
        initial: { opacity: 0, scale: 0.96 },
        animate: { opacity: 1, scale: 1 },
        exit: { opacity: 0, scale: 0.97 }
    },
    item: {
        initial: { opacity: 0, y: 8 },
        animate: { opacity: 1, y: 0 }
    }
};

// Slides a whole view/panel in and out. Bump `transitionKey` to switch.
//
//   backdrop          — optional layer pinned to the container (a cover-art
//                       gradient, etc.); fades with the view but never slides.
//   className         — on the outer (fade/blur) layer; should fill the box.
//   contentClassName  — on the inner (sliding) layer; e.g. the scroll area.
//   layoutScroll      — set when the inner layer is the scroll container, so
//                       framer accounts for its scroll offset during drags.
export function SlideTransition({
    transitionKey,
    backdrop = null,
    children,
    className,
    contentClassName,
    layoutScroll = false
}) {
    return (
        <AnimatePresence mode="wait" initial={false}>
            <motion.div
                key={transitionKey}
                className={`relative ${className || ""}`}
                variants={layerFade}
                initial="initial"
                animate="animate"
                exit="exit"
            >
                {backdrop != null && <div className="absolute inset-0">{backdrop}</div>}
                <motion.div variants={layerSlide} layoutScroll={layoutScroll} className={contentClassName}>
                    {children}
                </motion.div>
            </motion.div>
        </AnimatePresence>
    );
}

// One-shot reveal for a block of content.
export function FadeIn({ children, className, delay = 0, y = 10 }) {
    return (
        <motion.div
            className={className}
            initial={{ opacity: 0, y }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: DUR.base, ease: EASE, delay }}
        >
            {children}
        </motion.div>
    );
}

// Container that cascades its <StaggerItem> children in.
export function Stagger({ children, className, gap = 0.04, delay = 0 }) {
    return (
        <motion.div
            className={className}
            initial="initial"
            animate="animate"
            variants={{ animate: { transition: { staggerChildren: gap, delayChildren: delay } } }}
        >
            {children}
        </motion.div>
    );
}

export function StaggerItem({ children, className, ...rest }) {
    return (
        <motion.div
            className={className}
            variants={variants.item}
            transition={{ duration: DUR.base, ease: EASE }}
            {...rest}
        >
            {children}
        </motion.div>
    );
}

// Subtle press/hover feedback for clickable cards & rows.
export function Pressable({ children, className, onClick, title, ...rest }) {
    return (
        <motion.div
            className={className}
            onClick={onClick}
            title={title}
            whileHover={{ scale: 1.012 }}
            whileTap={{ scale: 0.985 }}
            transition={{ duration: DUR.fast, ease: EASE }}
            {...rest}
        >
            {children}
        </motion.div>
    );
}

export { AnimatePresence, Reorder, animate, motion, useDragControls };
