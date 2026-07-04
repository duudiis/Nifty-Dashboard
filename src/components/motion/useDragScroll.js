import { useCallback, useEffect, useRef } from "react";

// Nearest scrollable ancestor of `node`.
export function findScroller(node) {
    let p = node?.parentElement;
    while (p) {
        const oy = getComputedStyle(p).overflowY;
        if (oy === "auto" || oy === "scroll") return p;
        p = p.parentElement;
    }
    return null;
}

/**
 * Edge auto-scroll for a framer <Reorder> drag: hold a row near the top or
 * bottom of the scroll area and it scrolls that way, so you can drag a track
 * anywhere in a long list. Pointer compensation keeps the held row pinned to
 * the cursor while the list scrolls under it. Same mechanism the queue uses.
 *
 * Usage: const { start, stop } = useDragScroll(listRef); call start() on the
 * item's onDragStart and stop() on onDragEnd.
 */
export function useDragScroll(listRef) {
    const scrollerRef = useRef(null);
    const pointerYRef = useRef(0);       // real pointer Y
    const lastPointerRef = useRef(null); // last real pointer event
    const accScrollRef = useRef(0);      // total auto-scroll this drag
    const rafRef = useRef(0);

    // Re-emit the last real pointer shifted by everything we've auto-scrolled,
    // so framer's drag offset stays correct as the origin scrolls away.
    const emitCompensated = useCallback(() => {
        const le = lastPointerRef.current;
        if (!le) return;
        const ev = new PointerEvent("pointermove", {
            clientX: le.clientX,
            clientY: le.clientY + accScrollRef.current,
            pointerId: le.pointerId,
            pointerType: le.pointerType || "mouse",
            isPrimary: true,
            bubbles: true,
            cancelable: true,
            view: window
        });
        ev.__auto = true;
        document.dispatchEvent(ev);
    }, []);

    // Capture-phase: run before framer's own listener. Once scrolled, swallow
    // real moves and re-emit a compensated one for the rest of the drag.
    const onPointerCapture = useCallback((e) => {
        if (e.__auto) return;
        lastPointerRef.current = e;
        pointerYRef.current = e.clientY;
        if (accScrollRef.current !== 0) {
            e.stopImmediatePropagation();
            emitCompensated();
        }
    }, [emitCompensated]);

    const start = useCallback(() => {
        const scroller = findScroller(listRef.current);
        scrollerRef.current = scroller;
        accScrollRef.current = 0;
        if (!scroller) return;
        const rect = scroller.getBoundingClientRect();
        pointerYRef.current = (rect.top + rect.bottom) / 2;
        window.addEventListener("pointermove", onPointerCapture, true);

        const EDGE = 80;  // px from an edge where scrolling kicks in
        const MAX = 9;    // px per frame at the very edge
        const tick = () => {
            const sc = scrollerRef.current;
            if (!sc) return;
            const r = sc.getBoundingClientRect();
            const y = pointerYRef.current;
            let dy = 0;
            if (y < r.top + EDGE) dy = -MAX * Math.min(1, (r.top + EDGE - y) / EDGE);
            else if (y > r.bottom - EDGE) dy = MAX * Math.min(1, (y - (r.bottom - EDGE)) / EDGE);
            if (dy) {
                const before = sc.scrollTop;
                sc.scrollTop += dy;
                const applied = sc.scrollTop - before;
                if (applied) {
                    accScrollRef.current += applied;
                    emitCompensated();
                }
            }
            rafRef.current = requestAnimationFrame(tick);
        };
        rafRef.current = requestAnimationFrame(tick);
    }, [listRef, onPointerCapture, emitCompensated]);

    const stop = useCallback(() => {
        window.removeEventListener("pointermove", onPointerCapture, true);
        cancelAnimationFrame(rafRef.current);
        scrollerRef.current = null;
        accScrollRef.current = 0;
    }, [onPointerCapture]);

    useEffect(() => stop, [stop]); // clean up if unmounted mid-drag
    return { start, stop };
}
