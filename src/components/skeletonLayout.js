import { useEffect, useLayoutEffect, useState } from "react";

// Live content and its loading state share these dimensions. Keep the visual
// padding separate from the measured pitch used by scrolling/virtualization.
export const TRACK_ROW_HEIGHT = 56;
export const DENSE_TRACK_ROW_HEIGHT = 48;
export const TRACK_ROW_CLASS = "h-14 gap-2 px-2";
export const DENSE_TRACK_ROW_CLASS = "h-12 gap-2 px-2";
export const COLLECTION_COVER_SIZE_CLASS = "h-32 w-32 shrink-0 sm:h-40 sm:w-40";
export const MUSIC_CARD_WIDTH = 164;
export const MUSIC_CARD_WIDE_WIDTH = 184;
export const MUSIC_CARD_TEXT_HEIGHT = 36;
export const MUSIC_CARD_CONTENT_GAP = 12;
export const MUSIC_CARD_WIDTH_CLASS = "w-[164px] sm:w-[184px]";
export const MUSIC_CARD_BODY_CLASS = "flex w-full flex-col gap-3 p-3";
export const MUSIC_CARD_HEIGHT_CLASS = "h-[212px] sm:h-[232px]";
export const MUSIC_RAIL_CLASS = "-mx-3 flex gap-1 px-3 pb-1";
export const MUSIC_GRID_CLASS = "grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5";
export const LYRIC_LINE_HEIGHT_CLASS = "h-[37.5px] sm:h-10";

const useBeforePaint = typeof window === "undefined" ? useEffect : useLayoutEffect;

function scrollViewport(element) {
    for (let parent = element.parentElement; parent; parent = parent.parentElement) {
        if (parent.hasAttribute("data-scroll-viewport")) return parent;
        if (/(auto|scroll)/.test(getComputedStyle(parent).overflowY)) return parent;
    }
    return null;
}

function entranceOffset(element, viewport) {
    let offset = 0;
    for (let node = element; node && node !== viewport; node = node.parentElement) {
        const transform = getComputedStyle(node).transform;
        if (transform && transform !== "none") offset += new DOMMatrixReadOnly(transform).m42;
    }
    return offset;
}

// Fill only the remaining viewport, never a fixed guessed number of rows.
// Count includes a partially visible last item, and stays stable when the
// user scrolls. ResizeObserver also handles resizable desktop side panels.
export function useSkeletonCount(ref, { fill = false, minimum = 1, itemHeight, gap = 0, viewport = "remaining", axis = "y", columns = 1 }) {
    const [count, setCount] = useState(minimum);
    useBeforePaint(() => {
        const element = ref.current;
        if (!fill || !element) return;
        const scroller = scrollViewport(element);
        const measure = () => {
            // Keep the prepared shape fixed while the loaded content fades
            // through it. The exiting absolute overlay is not a new viewport.
            if (element.closest("[data-loading-swap]")?.dataset.loadingPhase === "revealing"
                || element.closest("[data-loading-placeholder]")?.getAttribute("aria-hidden") === "true") return;
            const rect = element.getBoundingClientRect();
            const layoutTop = rect.top - entranceOffset(element, scroller);
            const available = axis === "x" ? rect.width : viewport === "self" ? rect.height : scroller
                ? scroller.clientHeight - (layoutTop - scroller.getBoundingClientRect().top + scroller.scrollTop)
                : window.innerHeight - layoutTop;
            const height = typeof itemHeight === "function" ? itemHeight(element) : itemHeight;
            const spacing = typeof gap === "function" ? gap() : gap;
            const columnCount = typeof columns === "function" ? columns(element) : columns;
            if (!(height > 0)) return;
            const next = Math.max(minimum, Math.ceil((available + spacing) / (height + spacing)) * columnCount);
            setCount((current) => current === next ? current : next);
        };
        measure();
        const observer = typeof ResizeObserver === "undefined" ? null : new ResizeObserver(measure);
        // An ancestor changing height can move this section without changing
        // its own dimensions (e.g. a toolbar wraps on a narrow panel).
        for (let parent = element; parent; parent = parent.parentElement) {
            observer?.observe(parent);
            if (parent === scroller) break;
        }
        window.addEventListener("resize", measure);
        return () => { observer?.disconnect(); window.removeEventListener("resize", measure); };
    }, [ref, fill, minimum, itemHeight, gap, viewport, axis, columns]);
    return fill ? Math.max(minimum, count) : minimum;
}
