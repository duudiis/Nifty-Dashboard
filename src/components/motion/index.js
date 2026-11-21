// Modular animation system.
//
// One place for every motion primitive the app uses, so transitions stay
// consistent and new screens can opt in with a single wrapper. Built on
// framer-motion; everything here is a thin, named convenience layer.
//
//   <ViewTransition transitionKey={view}>…</ViewTransition>    page/panel fade
//   <FadeIn>…</FadeIn>                                   simple reveal
//   useEntrance(delay)                                boundary-aware reveal
//   <LoadingSwap loading={pending} fallback={…}>…</LoadingSwap>
//   useContentChange(trackId)                         motion on real updates
//   <Stagger><StaggerItem/>…</Stagger>                   list cascade
//   <Pressable>…</Pressable>                             tap/hover feedback
//
// Prefer these over hand-rolling `motion.div` so timing/easing live in one file.

import { createContext, forwardRef, useContext, useEffect, useLayoutEffect, useRef, useState } from "react";
import { AnimatePresence, Reorder, animate, motion as nativeMotion, useDragControls, useMotionValue, useReducedMotion, useTransform } from "framer-motion";

// Framer 11's accelerated opacity path cancels its WAAPI effect before the
// final inline value is painted. This can expose the initial opacity for one
// frame at completion (including a flash immediately before removal).
// An onUpdate observer keeps animations on Framer's shared frame scheduler,
// with the final DOM write and presence removal on the same clock. The stable
// no-op doesn't schedule React renders. Keep refs intact for popLayout/drag.
const observeFrame = () => {};
const motionElements = new Map();
const stableMotion = (Component) => {
    if (!motionElements.has(Component)) {
        const StableMotion = forwardRef(({ onUpdate = observeFrame, ...props }, ref) => (
            <Component {...props} ref={ref} onUpdate={onUpdate} />
        ));
        motionElements.set(Component, StableMotion);
    }
    return motionElements.get(Component);
};
const motion = new Proxy(nativeMotion, {
    get(target, tag) {
        if (tag === "create") return (Component, options) => stableMotion(target.create(Component, options));
        return typeof tag === "string" ? stableMotion(target[tag]) : Reflect.get(target, tag);
    }
});

// Shared easing + durations. Tweak here to retune the whole app.
export const EASE = [0.4, 0, 0.2, 1];
export const DUR = { fast: 0.18, base: 0.32, slow: 0.5 };

// A view owns the entrance of everything inside it, including asynchronous
// content. Loading boundaries consume that entrance too: replacing a skeleton
// must never start a second slide or a staggered reveal in its descendants.
const EntranceContext = createContext(false);
export function EntranceBoundary({ children }) {
    return <EntranceContext.Provider value={true}>{children}</EntranceContext.Provider>;
}

// One source of truth for every entrance — the app shell on load, the centre
// view and the right-sidebar panel on navigation. The boxes themselves never
// move: their surfaces are simply there, and what's inside fades in once,
// quickly. Backgrounds stay mounted outside the keyed foreground, so a
// navigation never dims the artwork behind the content.
const ENTER = { duration: 0.18, ease: EASE };

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

// Fades the foreground in on navigation. Bump `transitionKey` to switch.
//
//   backdrop          — optional layer pinned to the container (a cover-art
//                       gradient, etc.); stays mounted independently of it.
//   className         — on the stable outer layer; should fill the box.
//   contentClassName  — on the inner (fading) layer; e.g. the scroll area.
//   layoutScroll      — set when the inner layer is the scroll container, so
//                       framer accounts for its scroll offset during drags.
export function ViewTransition({
    transitionKey,
    backdrop = null,
    children,
    className,
    contentClassName,
    layoutScroll = false
}) {
    const reduceMotion = useReducedMotion();
    return (
        <div data-view-shell className={`relative ${className || ""}`}>
            {backdrop != null && <div data-view-backdrop className="pointer-events-none absolute inset-0">{backdrop}</div>}
            <motion.div
                key={transitionKey}
                data-view-content
                data-scroll-viewport={layoutScroll || undefined}
                initial={reduceMotion ? false : { opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={reduceMotion ? { duration: 0 } : ENTER}
                layoutScroll={layoutScroll}
                className={`relative ${contentClassName || ""}`}
            >
                <EntranceBoundary>{children}</EntranceBoundary>
            </motion.div>
        </div>
    );
}

// One-shot reveal for a block of content.
export function FadeIn({ children, className, delay = 0 }) {
    const reveal = useEntrance(delay);
    return (
        <motion.div
            className={className}
            {...reveal}
        >
            {children}
        </motion.div>
    );
}

// Loading layers share one clock and additive compositing. Independent
// source-over fades dim the overlap midway (two 50% layers cover only 75%).
// Isolation keeps the blend inside the swap, preserving the page's artwork.
const useBeforePaint = typeof window === "undefined" ? useEffect : useLayoutEffect;

// One clock for any number of interrupted scene changes. Starting a new
// transition from the currently painted weights keeps their sum exactly one;
// separate enter/exit animations can start on different frames and blink.
export function useCrossfadeWeights(activeKey, { duration = 0.24 } = {}) {
    const reduceMotion = useReducedMotion();
    const weights = useMotionValue(activeKey == null ? {} : { [activeKey]: 1 });
    const progress = useMotionValue(1);
    useBeforePaint(() => {
        const from = weights.get();
        if (activeKey == null ? Object.keys(from).length === 0 : from[activeKey] === 1 && Object.keys(from).length === 1) return;
        progress.set(0);
        const animation = animate(progress, 1, {
            duration: reduceMotion ? 0 : duration,
            ease: EASE,
            onUpdate: (value) => {
                const next = {};
                for (const [key, weight] of Object.entries(from)) next[key] = weight * (1 - value);
                if (activeKey != null) next[activeKey] = (next[activeKey] || 0) + value;
                weights.set(next);
            },
            onComplete: () => weights.set(activeKey == null ? {} : { [activeKey]: 1 })
        });
        return () => animation.stop();
    }, [activeKey, duration, reduceMotion, weights, progress]);
    return weights;
}

export function LoadingSwap({ loading, fallback, children, className = "", contentClassName = "", duration = 0.2 }) {
    const [retainFallback, setRetainFallback] = useState(loading);
    const latestLoading = useRef(loading);
    latestLoading.current = loading;
    const reduceMotion = useReducedMotion();
    const opacity = useMotionValue(loading ? 0 : 1);
    const placeholderOpacity = useTransform(opacity, (value) => 1 - value);
    const placeholderY = useMotionValue(0);
    const placeholderRef = useRef(null);
    const placeholderBox = useRef(null);
    const placeholderScroll = useRef([]);
    const placeholderContent = useRef(fallback);
    if (loading) placeholderContent.current = fallback;
    const reveal = useEntrance();

    useBeforePaint(() => {
        const element = placeholderRef.current;
        if (!loading || !element) return;
        const measure = () => {
            if (!latestLoading.current) return;
            placeholderBox.current = { top: element.offsetTop, left: element.offsetLeft, width: element.offsetWidth, height: element.offsetHeight };
        };
        const scrollers = [];
        for (let node = element.parentElement; node; node = node.parentElement) {
            if (/(auto|scroll)/.test(getComputedStyle(node).overflowY)) scrollers.push(node);
        }
        const rememberScroll = () => {
            if (latestLoading.current) placeholderScroll.current = scrollers.map(node => ({ node, top: node.scrollTop }));
        };
        measure();
        rememberScroll();
        placeholderY.set(0);
        scrollers.forEach(node => node.addEventListener("scroll", rememberScroll, { passive: true }));
        const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
        observer?.observe(element);
        return () => {
            observer?.disconnect();
            scrollers.forEach(node => node.removeEventListener("scroll", rememberScroll));
        };
    }, [loading, placeholderY]);

    // A loaded list may align its current row before its first paint. Keep
    // the outgoing placeholder at its painted position during that scroll;
    // only the live list moves, underneath the complementary crossfade.
    useBeforePaint(() => {
        if (loading || !retainFallback) { placeholderY.set(0); return; }
        const scrollers = placeholderScroll.current;
        const align = () => placeholderY.set(scrollers.reduce((delta, { node, top }) => delta + node.scrollTop - top, 0));
        align();
        scrollers.forEach(({ node }) => node.addEventListener("scroll", align, { passive: true }));
        return () => scrollers.forEach(({ node }) => node.removeEventListener("scroll", align));
    }, [loading, retainFallback, placeholderY]);

    useBeforePaint(() => {
        if (loading) {
            opacity.set(0);
            setRetainFallback(true);
            return;
        }
        const animation = animate(opacity, 1, {
            duration: reduceMotion ? 0 : duration,
            ease: EASE,
            onComplete: () => { if (!latestLoading.current) setRetainFallback(false); }
        });
        return () => animation.stop();
    }, [loading, duration, reduceMotion, opacity]);

    const overlapping = loading || retainFallback;
    return (
        <motion.div {...reveal} aria-busy={loading} data-loading-swap data-loading-phase={loading ? "loading" : retainFallback ? "revealing" : "ready"} className={`relative flex min-w-0 flex-col ${className}`} style={{ isolation: "isolate" }}>
            <EntranceBoundary>
            {overlapping && (
                <motion.div
                    key="placeholder"
                    ref={placeholderRef}
                    data-loading-placeholder
                    aria-hidden={!loading || undefined}
                    style={{ opacity: placeholderOpacity, y: placeholderY, mixBlendMode: "plus-lighter", ...(!loading && placeholderBox.current ? { ...placeholderBox.current, bottom: "auto", right: "auto" } : {}) }}
                    className={`${loading ? "relative min-h-0 flex-1" : "pointer-events-none absolute inset-0 z-10 overflow-hidden"} min-w-0 ${contentClassName}`}
                >
                    {placeholderContent.current}
                </motion.div>
            )}
            {!loading && (
                <motion.div
                    key="content"
                    data-loaded-content
                    style={{ opacity, mixBlendMode: overlapping ? "plus-lighter" : "normal" }}
                    className={`min-h-0 min-w-0 flex-1 ${contentClassName}`}
                >
                    {children}
                </motion.div>
            )}
            </EntranceBoundary>
        </motion.div>
    );
}

// A one-shot entrance: a quick fade in place. Use the hook in components so
// reduced motion is respected; the plain props helper remains for existing
// callers. `distance` is for small pieces of content only — never a whole box.
//
//   <motion.div {...entrance()}>…</motion.div>
export function entrance(delay = 0, { duration = ENTER.duration, distance = 0 } = {}) {
    return {
        initial: { opacity: 0, y: distance },
        animate: { opacity: 1, y: 0 },
        transition: { duration, ease: EASE, delay }
    };
}

export function useEntrance(delay = 0, options = {}) {
    const reduceMotion = useReducedMotion();
    const inherited = useContext(EntranceContext);
    return reduceMotion || inherited
        ? { initial: false, animate: { opacity: 1, y: 0 }, transition: { duration: 0 } }
        : entrance(delay, options);
}

// Actual content changes can move inside an already-entered view. Keep the
// node opaque and mounted; progress updates with the same identity do nothing.
// Empty states and interrupted updates always settle back at the origin.
export function useContentChange(identity, { distance = 8, duration = DUR.base } = {}) {
    const previous = useRef(identity);
    const y = useMotionValue(0);
    const reduceMotion = useReducedMotion();
    useBeforePaint(() => {
        const changed = previous.current !== identity;
        const hadContent = previous.current != null;
        previous.current = identity;
        if (!changed) return;
        y.set(0);
        if (reduceMotion || !hadContent || identity == null) return;
        y.set(distance);
        const animation = animate(y, 0, { duration, ease: EASE });
        return () => { animation.stop(); y.set(0); };
    }, [identity, distance, duration, reduceMotion, y]);
    return y;
}

// Container that cascades its <StaggerItem> children in.
export function Stagger({ children, className, gap = 0.04, delay = 0 }) {
    const reduceMotion = useReducedMotion();
    const inherited = useContext(EntranceContext);
    const skip = reduceMotion || inherited;
    return (
        <motion.div
            className={className}
            initial={skip ? false : "initial"}
            animate="animate"
            variants={{ animate: { transition: { staggerChildren: skip ? 0 : gap, delayChildren: skip ? 0 : delay } } }}
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
