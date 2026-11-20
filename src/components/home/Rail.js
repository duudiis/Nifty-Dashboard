import { useCallback, useEffect, useRef, useState } from "react";

import Icon from "../Icon.js";
import { MUSIC_CARD_WIDTH_CLASS, MUSIC_RAIL_CLASS } from "../skeletonLayout.js";

// A horizontal shelf.
//
// Scrollbars are hidden app-wide, so an overflowing row has no affordance of
// its own — both the edge fades and the chevrons are load-bearing, not
// decoration. They appear only on the side that actually has more content.
// There is no chevron-left/right in the icon set; the app's convention is to
// rotate chevron-down, the same way EntityRow and the context menu do.
export default function Rail({ children, className = "", itemClassName = MUSIC_CARD_WIDTH_CLASS }) {
    const ref = useRef(null);
    const [edges, setEdges] = useState({ left: false, right: false });

    const measure = useCallback(() => {
        const el = ref.current;
        if (!el) return;
        const max = el.scrollWidth - el.clientWidth;
        setEdges({ left: el.scrollLeft > 8, right: el.scrollLeft < max - 8 });
    }, []);

    useEffect(() => {
        measure();
        const el = ref.current;
        if (!el || typeof ResizeObserver === "undefined") return;
        const ro = new ResizeObserver(measure);
        ro.observe(el);
        return () => ro.disconnect();
    }, [measure, children]);

    const nudge = (dir) => {
        const el = ref.current;
        if (el) el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: "smooth" });
    };

    const Chevron = ({ side }) => (
        <button
            onClick={() => nudge(side === "left" ? -1 : 1)}
            title={side === "left" ? "Previous recommendations" : "More recommendations"}
            aria-label={side === "left" ? "Previous recommendations" : "More recommendations"}
            className={`absolute top-1/2 z-20 flex h-9 w-9 -translate-y-1/2 items-center justify-center rounded-full bg-elevated/90 text-maintext shadow-lg backdrop-blur transition hover:bg-elevated ${
                side === "left" ? "left-1" : "right-1"
            }`}
        >
            <Icon name="chevron-down" className={`h-5 w-5 ${side === "left" ? "rotate-90" : "-rotate-90"}`} />
        </button>
    );

    return (
        <div className={`group/rail relative ${className}`}>
            <div
                ref={ref}
                onScroll={measure}
                tabIndex={0}
                aria-label="Music recommendations"
                className={`${MUSIC_RAIL_CLASS} snap-x overflow-x-auto scroll-smooth focus-visible:outline focus-visible:outline-2 focus-visible:outline-accent`}
            >
                {Array.isArray(children)
                    ? children.map((child, i) => (
                        <div key={child?.key ?? i} className={`shrink-0 snap-start ${itemClassName}`}>{child}</div>
                    ))
                    : <div className={`shrink-0 snap-start ${itemClassName}`}>{children}</div>}
            </div>

            {edges.left && (
                <>
                    <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-12 bg-gradient-to-r from-surface to-transparent" />
                    <div className="transition sm:opacity-0 sm:group-hover/rail:opacity-100 sm:group-focus-within/rail:opacity-100"><Chevron side="left" /></div>
                </>
            )}
            {edges.right && (
                <>
                    <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-12 bg-gradient-to-l from-surface to-transparent" />
                    <div className="transition sm:opacity-0 sm:group-hover/rail:opacity-100 sm:group-focus-within/rail:opacity-100"><Chevron side="right" /></div>
                </>
            )}
        </div>
    );
}
