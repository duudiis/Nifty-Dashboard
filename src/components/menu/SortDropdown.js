import { useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

import Icon from "../Icon.js";
import { AnimatePresence, motion, EASE } from "../motion/index.js";

// A button-anchored picker shared by collection pages and the library. The
// portal keeps the menu clear of panel overflow and draggable list transforms.
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
            setPosition({ top: rect.bottom + 6, left: Math.max(8, Math.min(rect.right - 208, window.innerWidth - 216)), maxHeight: Math.max(120, window.innerHeight - rect.bottom - 14) });
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
                className={`flex h-8 shrink-0 items-center justify-center gap-2 rounded-md text-subtext transition-colors hover:bg-elevated hover:text-maintext focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent ${compact ? "w-8" : "px-2 text-xs font-medium"} ${open ? "bg-elevated text-maintext" : ""}`}
            >
                <Icon name="sort" className="h-4 w-4" />
                {!compact && <span>{current?.label || "Custom order"}</span>}
                {!compact && <Icon name="chevron-down" className={`h-3.5 w-3.5 transition-transform duration-200 ${open ? "rotate-180" : ""}`} />}
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
                            className="fixed z-[65] w-52 space-y-1 overflow-y-auto rounded-lg border border-border bg-elevated p-1 shadow-2xl"
                        >
                            <div className="px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wider text-subtext">{label}</div>
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
                                        className={`flex min-h-8 w-full items-center gap-2.5 rounded-md px-2.5 py-1 text-left text-[13px] transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-accent ${selected ? "bg-accent/10 text-accent hover:bg-accent/20" : "text-maintext hover:bg-maintext/10 focus-visible:bg-maintext/10"}`}
                                    >
                                        {option.icon && <Icon name={option.icon} className="h-4 w-4" />}
                                        <span className="flex-1">{option.label}</span>
                                        {selected && <Icon name={direction ? (descending ? "arrow-down" : "arrow-up") : "check"} className="h-3.5 w-3.5" />}
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
