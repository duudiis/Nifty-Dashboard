// Modular animation system.
//
// One place for every motion primitive the app uses, so transitions stay
// consistent and new screens can opt in with a single wrapper. Built on
// framer-motion; everything here is a thin, named convenience layer.
//
//   <SlideTransition transitionKey={view}>…</SlideTransition>  page/panel slide
//   <FadeIn>…</FadeIn>                                   simple reveal
//   <motion.div {...entrance(0.1)}>…</motion.div>        staggered mount-in
//   <Stagger><StaggerItem/>…</Stagger>                   list cascade
//   <Pressable>…</Pressable>                             tap/hover feedback
//
// Prefer these over hand-rolling `motion.div` so timing/easing live in one file.

import { AnimatePresence, Reorder, animate, motion, useDragControls } from "framer-motion";

// Shared easing + durations. Tweak here to retune the whole app.
export const EASE = [0.4, 0, 0.2, 1];
export const DUR = { fast: 0.18, base: 0.32, slow: 0.5 };

// One source of truth for the centre view + right-sidebar panel slide, so every
// layout enters with the same feel.
const TRANSITION = {
    enter: { duration: 0.32, ease: EASE },
    riseFrom: 12   // px the foreground rises from on enter
};

// The transition is split across two stacked layers:
//   • the outer one fades + blurs the whole view and never translates, so a
//     pinned backdrop can live there and stay put.
//   • the inner one only translates (y). Because the backdrop below it doesn't
//     move, the slide can never expose the bare box background at the leading
//     edge (the old gradient-edge "reveal").

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
        // A keyed element, NOT an <AnimatePresence>.
        //
        // This used to swap with mode="wait", which renders the outgoing view
        // until its exit animation reports back and only then mounts the
        // incoming one. Every exit in the subtree has to settle for that report
        // to arrive, and a view like the home screen has plenty of them —
        // nested presence layers in the backdrop, the loading washes, the
        // section rails. One that never settles leaves the old page on screen
        // while the URL has already moved on, which is exactly the failure this
        // component kept producing.
        //
        // React swapping on a key cannot stall: the old tree unmounts and the
        // new one mounts in the same commit. What is lost is the 0.18s exit
        // fade, which was barely perceptible; the entrance does the work.
        <motion.div
            key={transitionKey}
            className={`relative ${className || ""}`}
            initial={{ opacity: 0, filter: "blur(4px)" }}
            animate={{ opacity: 1, filter: "blur(0px)" }}
            transition={TRANSITION.enter}
        >
            {backdrop != null && <div className="pointer-events-none absolute inset-0">{backdrop}</div>}
            {/* relative: keeps the foreground painted above the pinned
                backdrop even after framer strips the slide transform
                (an absolutely-positioned backdrop would otherwise sit on
                top of static content and swallow every click). */}
            <motion.div
                initial={{ y: TRANSITION.riseFrom }}
                animate={{ y: 0 }}
                transition={TRANSITION.enter}
                layoutScroll={layoutScroll}
                className={`relative ${contentClassName || ""}`}
            >
                {children}
            </motion.div>
        </motion.div>
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

// Props for a one-shot entrance on mount: a plain fade, nothing sliding into
// place. Spread onto any motion element, and give each one a slightly larger
// delay to bring a row of them up in sequence:
//
//   <motion.div {...entrance(0.08)}>…</motion.div>
export function entrance(delay = 0, { duration = 0.24 } = {}) {
    return {
        initial: { opacity: 0 },
        animate: { opacity: 1 },
        transition: { duration, ease: EASE, delay }
    };
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
