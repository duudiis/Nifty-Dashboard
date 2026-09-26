import { useRef, useState } from "react";

// The draggable seam between two boxes. It IS the gap between them — no extra
// chrome in the layout — and only shows itself on hover: a hairline down the
// gap with a small grip in the middle, turning accent while you drag.
//
//   drag         resize the panel (clamped so the centre never gets cramped)
//   double-click snap the panel back to its default width
//   ←/→ (focus)  nudge by 16px (64px with shift)
//
// Dragging writes the width straight onto the row's CSS variable, so the boxes
// follow the pointer without a React render per frame; the final width is
// committed once, on release.

const CENTER_MIN = 520; // px the centre view keeps, whatever the sidebars do
const NUDGE = 16;

export default function ResizeHandle({ rowRef, panel, spec, width, onCommit, label, className = "" }) {
    const [dragging, setDragging] = useState(false);
    const drag = useRef(null);
    const snapTimer = useRef(0);

    // Right panel grows as the pointer moves left.
    const dir = panel === "left" ? 1 : -1;

    // Largest width that still leaves the centre its minimum, given how wide
    // the opposite panel is right now (0 when a breakpoint hides it). On a
    // window already too narrow for that, the panel can shrink but not grow —
    // it never jumps on the first move.
    const limits = () => {
        const row = rowRef.current;
        const other = row?.querySelector(`:scope > [data-panel="${panel === "left" ? "right" : "left"}"]`);
        const handles = row ? row.querySelectorAll(":scope > [role=separator]") : [];
        let seams = 0;
        handles.forEach((h) => { seams += h.offsetWidth; });
        const room = row ? row.clientWidth - (other?.offsetWidth || 0) - seams - CENTER_MIN : spec.max;
        return { min: spec.min, max: Math.max(spec.min, Math.min(spec.max, Math.max(room, width))) };
    };

    const clamp = (w, { min, max }) => Math.round(Math.min(max, Math.max(min, w)));

    const apply = (w) => rowRef.current?.style.setProperty(spec.cssVar, `${w}px`);

    const onPointerDown = (e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.currentTarget.setPointerCapture(e.pointerId);
        drag.current = { x: e.clientX, start: width, value: width, limits: limits() };
        setDragging(true);
        document.documentElement.classList.add("is-resizing");
    };

    const onPointerMove = (e) => {
        const d = drag.current;
        if (!d) return;
        d.value = clamp(d.start + dir * (e.clientX - d.x), d.limits);
        apply(d.value);
    };

    const end = () => {
        const d = drag.current;
        if (!d) return;
        drag.current = null;
        setDragging(false);
        document.documentElement.classList.remove("is-resizing");
        // A click (the first half of a double-click, say) moves nothing.
        if (d.value !== d.start) onCommit(d.value);
    };

    // Glide back to the default instead of jumping: the row carries a width
    // transition only for as long as the snap takes.
    const reset = () => {
        const row = rowRef.current;
        if (row) {
            row.dataset.snap = "";
            clearTimeout(snapTimer.current);
            snapTimer.current = setTimeout(() => { delete row.dataset.snap; }, 400);
        }
        onCommit(null);
    };

    const onKeyDown = (e) => {
        if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
        e.preventDefault();
        const step = (e.shiftKey ? NUDGE * 4 : NUDGE) * (e.key === "ArrowRight" ? 1 : -1) * dir;
        const next = clamp(width + step, limits());
        apply(next);
        onCommit(next);
    };

    return (
        <div
            role="separator"
            aria-orientation="vertical"
            aria-label={label}
            aria-valuenow={width}
            aria-valuemin={spec.min}
            aria-valuemax={spec.max}
            tabIndex={0}
            data-active={dragging || undefined}
            onPointerDown={onPointerDown}
            onPointerMove={onPointerMove}
            onPointerUp={end}
            onPointerCancel={end}
            onLostPointerCapture={end}
            onDoubleClick={reset}
            onKeyDown={onKeyDown}
            className={`group relative w-2 shrink-0 cursor-col-resize touch-none select-none outline-none ${className}`}
        >
            {/* hairline */}
            <span
                aria-hidden
                className="pointer-events-none absolute inset-y-3 left-1/2 w-px -translate-x-1/2 rounded-full bg-topbartext opacity-0 transition-opacity duration-200 ease-smooth group-hover:opacity-20 group-hover:delay-100 group-focus-visible:opacity-30 group-data-[active]:bg-accent group-data-[active]:opacity-70 group-data-[active]:delay-0"
            />
            {/* grip */}
            <span
                aria-hidden
                className="pointer-events-none absolute left-1/2 top-1/2 h-9 w-[3px] -translate-x-1/2 -translate-y-1/2 rounded-full bg-topbartext opacity-0 transition-[opacity,height,box-shadow] duration-200 ease-smooth group-hover:opacity-60 group-hover:delay-100 group-focus-visible:opacity-80 group-data-[active]:h-14 group-data-[active]:bg-accent group-data-[active]:opacity-100 group-data-[active]:shadow-[0_0_12px_rgb(var(--c-accent)/0.6)] group-data-[active]:delay-0"
            />
        </div>
    );
}
