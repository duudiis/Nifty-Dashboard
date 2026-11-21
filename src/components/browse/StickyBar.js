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
//   surface   fades in over the last stretch before the page's own action
//             row (`triggerRef`, the big Play button) reaches the bar
//   contents  fade in as that row slides underneath, so there are never two
//             Play buttons competing on screen
//
// Render it as the first child of the page; it takes no room in the layout.
export const STICKY_BAR_HEIGHT = 64;
const SURFACE_LEAD = 120;   // px of scroll over which the surface fades in
const CONTENT_SPAN = 44;    // px of scroll over which the contents fade in

const useBeforePaint = typeof window === "undefined" ? useEffect : useLayoutEffect;
const clamp = (value) => Math.min(1, Math.max(0, value));

export default function StickyBar({ triggerRef, cover, title, children }) {
    const anchor = useRef(null);
    const surface = useMotionValue(0);
    const contents = useMotionValue(0);
    // Hidden contents are out of the tab order and can't be clicked.
    const visibility = useTransform(contents, (value) => (value > 0.02 ? "visible" : "hidden"));

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
            <div className="pointer-events-none absolute inset-x-0 top-0" style={{ height: STICKY_BAR_HEIGHT }}>
                <motion.div
                    aria-hidden
                    style={{ opacity: surface }}
                    className="absolute inset-0 border-b border-maintext/10 bg-surface shadow-[0_8px_24px_rgb(0_0_0/0.28)]"
                >
                    <div className="absolute inset-0 bg-accent/10" />
                </motion.div>
                <motion.div
                    style={{ opacity: contents, visibility }}
                    className="pointer-events-auto relative flex h-full items-center gap-3 px-6 sm:px-8"
                >
                    {cover}
                    <span className="min-w-0 flex-1 truncate text-base font-bold tracking-tight text-maintext">{title}</span>
                    {children}
                </motion.div>
            </div>
        </div>
    );
}
