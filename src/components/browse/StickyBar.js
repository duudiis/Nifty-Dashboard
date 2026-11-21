import { useEffect, useLayoutEffect, useRef } from "react";
import { useMotionValue, useTransform } from "framer-motion";

import { motion } from "../motion/index.js";
import { findScroller } from "../motion/useDragScroll.js";

// The slim bar that takes over from a collection's header as it scrolls away:
// cover, name and the play controls, pinned to the top of the page.
//
// It is tied to the scroll position itself, not to a timer — scrubbing the
// page up and down scrubs the bar in and out:
//
//   surface   slides down from above the page (and fades in) over the last
//             stretch before the page's own action row (`triggerRef`, the big
//             Play button) reaches the bar
//   contents  drop into place inside it as that row slides underneath, so
//             there are never two Play buttons competing on screen: the cover
//             and name first, the buttons a beat behind them
//
// Render it as the first child of the page; it takes no room in the layout.
export const STICKY_BAR_HEIGHT = 64;
const SURFACE_LEAD = 120;   // px of scroll over which the surface fades in
const CONTENT_SPAN = 72;    // px of scroll over which the contents drop in
const CONTENT_DROP = 20;    // px the contents travel
const BUTTON_LAG = 0.3;     // share of that span the buttons wait before following

const useBeforePaint = typeof window === "undefined" ? useEffect : useLayoutEffect;
const clamp = (value) => Math.min(1, Math.max(0, value));

export default function StickyBar({ triggerRef, cover, title, children }) {
    const anchor = useRef(null);
    const surface = useMotionValue(0);
    const contents = useMotionValue(0);
    // Hidden contents are out of the tab order and can't be clicked.
    const visibility = useTransform(contents, (value) => (value > 0.02 ? "visible" : "hidden"));
    // Gently decelerating, so each piece settles into place rather than
    // stopping dead, while still following the scroll all the way.
    const ease = (value) => 1 - (1 - value) ** 2;
    const surfaceOpacity = useTransform(surface, ease);
    const surfaceY = useTransform(surface, (value) => (ease(value) - 1) * STICKY_BAR_HEIGHT);
    const leadOpacity = useTransform(contents, (value) => ease(clamp(value / (1 - BUTTON_LAG))));
    const leadY = useTransform(leadOpacity, (value) => (value - 1) * CONTENT_DROP);
    const buttonOpacity = useTransform(contents, (value) => ease(clamp((value - BUTTON_LAG) / (1 - BUTTON_LAG))));
    const buttonY = useTransform(buttonOpacity, (value) => (value - 1) * CONTENT_DROP);

    useBeforePaint(() => {
        const scroller = findScroller(anchor.current);
        if (!scroller) return;

        const update = () => {
            const trigger = triggerRef.current;
            if (!trigger) return;
            const top = scroller.getBoundingClientRect().top;
            const rect = trigger.getBoundingClientRect();
            surface.set(clamp((STICKY_BAR_HEIGHT + SURFACE_LEAD - (rect.top - top)) / SURFACE_LEAD));
            contents.set(clamp((STICKY_BAR_HEIGHT - (rect.bottom - top) + CONTENT_SPAN) / CONTENT_SPAN));
        };
        update();
        scroller.addEventListener("scroll", update, { passive: true });
        // The page can change shape without any scrolling: a title wrapping,
        // a panel being resized, tracks arriving.
        const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(update);
        observer?.observe(scroller);
        if (anchor.current?.parentElement) observer?.observe(anchor.current.parentElement);
        return () => {
            scroller.removeEventListener("scroll", update);
            observer?.disconnect();
        };
    }, [triggerRef, surface, contents]);

    return (
        <div ref={anchor} className="sticky top-0 z-30 h-0">
            {/* Clipped at the top of the page, so nothing shows above it while
                the bar slides in; the extra height leaves room for its shadow. */}
            <div className="pointer-events-none absolute inset-x-0 top-0 overflow-hidden" style={{ height: STICKY_BAR_HEIGHT + 28 }}>
                <motion.div
                    aria-hidden
                    style={{ opacity: surfaceOpacity, y: surfaceY, height: STICKY_BAR_HEIGHT }}
                    className="absolute inset-x-0 top-0 border-b border-maintext/10 bg-surface shadow-[0_8px_24px_rgb(0_0_0/0.28)]"
                >
                    <div className="absolute inset-0 bg-accent/10" />
                </motion.div>
                <motion.div
                    style={{ visibility, height: STICKY_BAR_HEIGHT }}
                    className="pointer-events-auto relative flex items-center gap-3 px-6 sm:px-8"
                >
                    <motion.div style={{ opacity: leadOpacity, y: leadY }} className="flex min-w-0 flex-1 items-center gap-3">
                        {cover}
                        <span className="min-w-0 flex-1 truncate text-base font-bold tracking-tight text-maintext">{title}</span>
                    </motion.div>
                    <motion.div style={{ opacity: buttonOpacity, y: buttonY }} className="flex shrink-0 items-center gap-3">
                        {children}
                    </motion.div>
                </motion.div>
            </div>
        </div>
    );
}
