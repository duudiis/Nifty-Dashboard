import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import Icon from "../Icon.js";
import { AnimatePresence, motion, EASE } from "../motion/index.js";

// A button-anchored picker shared by collection pages and the library. The
// portal keeps the menu clear of panel overflow and draggable list transforms.
// The trigger's glyph shows the state at a glance: crossed arrows for a
// hand-made order, rising or falling bars for a sorted one.
const MENU_WIDTH = 224; // w-56
export default function SortDropdown({ options, value, onChange, label = "Sort by", compact = false, descending, onDirectionChange }) {
    const [open, setOpen] = useState(false);
    const [position, setPosition] = useState(null);
    const trigger = useRef(null);
    const menu = useRef(null);
    const menuId = useId();
    const current = options.find((option) => option.id === value);

    useEffect(() => {
        if (!open) return;
        const place = () => {
            const rect = trigger.current?.getBoundingClientRect();
            if (!rect) return;
            setPosition({ top: rect.bottom + 6, left: Math.max(8, Math.min(rect.right - MENU_WIDTH, window.innerWidth - MENU_WIDTH - 8)), maxHeight: Math.max(120, window.innerHeight - rect.bottom - 14) });
        };
        const dismiss = (event) => {
            if (!trigger.current?.contains(event.target) && !menu.current?.contains(event.target)) setOpen(false);
        };
        const escape = (event) => {
            if (event.key !== "Escape") return;
            event.stopPropagation();
            setOpen(false);
            trigger.current?.focus();
        };
        place();
        const focus = requestAnimationFrame(() => menu.current?.querySelector('[aria-checked="true"]')?.focus());
        window.addEventListener("resize", place);
        window.addEventListener("scroll", place, true);
        document.addEventListener("pointerdown", dismiss);
        document.addEventListener("keydown", escape);
        return () => {
            cancelAnimationFrame(focus);
            window.removeEventListener("resize", place);
            window.removeEventListener("scroll", place, true);
            document.removeEventListener("pointerdown", dismiss);
            document.removeEventListener("keydown", escape);
        };
    }, [open]);

    const select = (id) => {
        // Activating the current sort reverses it in place. Keep selection and
        // direction callbacks exclusive so a parent's reset cannot race them.
        if (id === value && id !== "custom" && onDirectionChange) {
            onDirectionChange(!descending);
        } else if (id !== value) {
            onChange(id);
        }
    };

    const onKeys = (event) => {
        if (event.key === "Tab") { setOpen(false); trigger.current?.focus(); return; }
        if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
        event.preventDefault();
        const buttons = [...menu.current.querySelectorAll('[role="menuitemradio"], [role="menuitem"]')];
        const index = buttons.indexOf(document.activeElement);
        const next = event.key === "Home" ? 0 : event.key === "End" ? buttons.length - 1
            : (index + (event.key === "ArrowDown" ? 1 : -1) + buttons.length) % buttons.length;
        buttons[next]?.focus();
    };

    return (
        <>
            <button
                ref={trigger}
                type="button"
                aria-label={`${label}: ${current?.label || "Custom order"}`}
                aria-haspopup="menu"
                aria-controls={open ? menuId : undefined}
                aria-expanded={open}
                title={label}
                onClick={() => setOpen((value) => !value)}
                onKeyDown={(event) => {
                    if (event.key === "ArrowDown" || event.key === "ArrowUp") { event.preventDefault(); setOpen(true); }
                }}
                className={`flex h-8 shrink-0 items-center justify-center gap-2 rounded-md transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${compact ? "w-8" : "text-xs font-medium"} ${open ? "text-maintext" : "text-subtext hover:text-maintext"}`}
            >
                {!compact && <span>{current?.label || "Custom order"}</span>}
                <Icon name={value === "custom" ? "sort-custom" : descending ? "sort-desc" : "sort-asc"} className="h-4 w-4" />
            </button>
            {typeof document !== "undefined" && createPortal(
                <AnimatePresence>
                    {open && position && (
                        <motion.div
                            ref={menu}
                            id={menuId}
                            role="menu"
                            aria-label={label}
                            onKeyDown={onKeys}
                            initial={{ opacity: 0, y: -5, scale: 0.98 }}
                            animate={{ opacity: 1, y: 0, scale: 1 }}
                            exit={{ opacity: 0, y: -3, scale: 0.98 }}
                            transition={{ duration: 0.16, ease: EASE }}
                            style={{ ...position, transformOrigin: "top right" }}
                            className="fixed z-[65] w-56 space-y-0.5 overflow-y-auto rounded-xl border border-border bg-elevated p-2 shadow-2xl"
                        >
                            <div className="px-3 pb-2 pt-1.5 text-[10px] font-semibold uppercase tracking-wider text-subtext">{label}</div>
                            {options.map((option) => {
                                const selected = value === option.id;
                                const direction = selected && option.id !== "custom" && !!onDirectionChange;
                                return (
                                    <button
                                        key={option.id}
                                        type="button"
                                        role="menuitemradio"
                                        aria-checked={selected}
                                        tabIndex={selected ? 0 : -1}
                                        aria-label={direction ? `${option.label}, ${descending ? "descending" : "ascending"}` : option.label}
                                        title={direction ? `Sort ${descending ? "ascending" : "descending"}` : undefined}
                                        onClick={() => select(option.id)}
                                        className={`flex min-h-9 w-full items-center gap-3 rounded-md px-3 py-2 text-left text-xs transition-colors hover:bg-maintext/[0.07] focus-visible:bg-maintext/[0.07] focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-accent ${selected ? "font-medium text-accent" : "text-maintext"}`}
                                    >
                                        {option.icon && <Icon name={option.icon} className={`h-3.5 w-3.5 ${selected ? "" : "text-subtext"}`} />}
                                        <span className="flex-1">{option.label}</span>
                                        {selected && <Icon name={direction ? (descending ? "sort-desc" : "sort-asc") : "check"} className="h-3.5 w-3.5" />}
                                    </button>
                                );
                            })}
                        </motion.div>
                    )}
                </AnimatePresence>, document.body
            )}
        </>
    );
}
