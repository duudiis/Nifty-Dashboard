// Modular animation system.
//
// One place for every motion primitive the app uses, so transitions stay
// consistent and new screens can opt in with a single wrapper. Built on
// framer-motion; everything here is a thin, named convenience layer.
//
//   <PageTransition viewKey={view}>…</PageTransition>   page in/out crossfade
//   <FadeIn>…</FadeIn>                                   simple reveal
//   <Stagger><StaggerItem/>…</Stagger>                   list cascade
//   <Pressable>…</Pressable>                             tap/hover feedback
//
// Prefer these over hand-rolling `motion.div` so timing/easing live in one file.

import { AnimatePresence, motion } from "framer-motion";

// Shared easing + durations. Tweak here to retune the whole app.
export const EASE = [0.4, 0, 0.2, 1];
export const DUR = { fast: 0.18, base: 0.32, slow: 0.5 };

export const variants = {
    page: {
        initial: { opacity: 0, y: 12, filter: "blur(4px)" },
        animate: { opacity: 1, y: 0, filter: "blur(0px)" },
        exit: { opacity: 0, y: -10, filter: "blur(4px)" }
    },
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

// Crossfades whole views. Wrap the per-view content and bump `viewKey`.
export function PageTransition({ viewKey, children, className }) {
    return (
        <AnimatePresence mode="wait" initial={false}>
            <motion.div
                key={viewKey}
                className={className}
                variants={variants.page}
                initial="initial"
                animate="animate"
                exit="exit"
                transition={{ duration: DUR.base, ease: EASE }}
            >
                {children}
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

export { AnimatePresence, motion };
