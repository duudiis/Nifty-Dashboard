// App-wide layered modal system.
//
// Mount <ModalProvider> once near the root. Anywhere inside it:
//
//   const modal = useModal();
//
//   modal.open({ title, size, render })   custom content modal
//       size    "sm" | "md" | "lg" (default "md")
//       render  ({ close }) => JSX — the body; call close() to dismiss
//       returns the modal id (modal.close(id) closes it programmatically)
//
//   await modal.confirm({ title, message, confirmLabel, cancelLabel, danger })
//       promise-based confirmation prompt; resolves true on confirm, false on
//       cancel / Escape / backdrop click. `danger: true` renders the confirm
//       button destructive.
//
// Modals stack: a confirm() opened from inside a settings modal layers on
// top; dismissal always targets the top-most entry. One shared backdrop
// (fade) lives under the stack; each panel animates in and out on its own.

import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";

import Icon from "../Icon.js";
import { AnimatePresence, motion, EASE } from "../motion/index.js";

const ModalCtx = createContext(null);

const SIZES = {
    sm: "max-w-sm",
    md: "max-w-lg",
    lg: "max-w-2xl",
    xl: "max-w-6xl"
};

export function ModalProvider({ children }) {
    const [stack, setStack] = useState([]);
    const [mounted, setMounted] = useState(false);
    const idRef = useRef(0);

    useEffect(() => setMounted(true), []);

    // Removes one entry (top-most when no id given), resolving pending
    // confirmations as dismissed.
    const close = useCallback((id = null, answer = false) => {
        setStack((prev) => {
            const target = id ?? prev[prev.length - 1]?.id;
            const entry = prev.find((m) => m.id === target);
            if (!entry) return prev;
            entry.resolve?.(answer);
            return prev.filter((m) => m.id !== target);
        });
    }, []);

    const open = useCallback((descriptor) => {
        const id = ++idRef.current;
        setStack((prev) => [...prev, { size: "md", dismissable: true, ...descriptor, id }]);
        return id;
    }, []);

    const confirm = useCallback((options = {}) => new Promise((resolve) => {
        const id = ++idRef.current;
        let settled = false;
        setStack((prev) => [...prev, {
            id,
            size: "sm",
            dismissable: true,
            title: options.title || "Are you sure?",
            confirm: options,
            resolve: (answer) => {
                if (settled) return;
                settled = true;
                resolve(!!answer);
            }
        }]);
    }), []);

    // Escape dismisses the top-most dismissable entry.
    useEffect(() => {
        if (!stack.length) return;
        const onKey = (e) => {
            if (e.key !== "Escape") return;
            const top = stack[stack.length - 1];
            if (top?.dismissable) close(top.id, false);
        };
        window.addEventListener("keydown", onKey);
        return () => window.removeEventListener("keydown", onKey);
    }, [stack, close]);

    // Lock page scroll while anything is open.
    useEffect(() => {
        if (typeof document === "undefined") return;
        document.body.style.overflow = stack.length ? "hidden" : "";
        return () => { document.body.style.overflow = ""; };
    }, [stack.length]);

    const value = { open, close, confirm };

    return (
        <ModalCtx.Provider value={value}>
            {children}
            {mounted && createPortal(
                <>
                    <AnimatePresence>
                        {stack.length > 0 && (
                            <motion.div
                                key="modal-backdrop"
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.13, ease: EASE }}
                                onClick={() => {
                                    const top = stack[stack.length - 1];
                                    if (top?.dismissable) close(top.id, false);
                                }}
                                className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-sm"
                            />
                        )}
                    </AnimatePresence>
                    <AnimatePresence>
                        {stack.map((entry) => (
                            <div key={entry.id} className="pointer-events-none fixed inset-0 z-[75] flex items-center justify-center p-4">
                                <motion.div
                                    role="dialog"
                                    aria-modal="true"
                                    aria-label={entry.title || "Dialog"}
                                    initial={{ opacity: 0, scale: 0.92 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.94 }}
                                    transition={{ duration: 0.15, ease: EASE }}
                                    className={`pointer-events-auto flex max-h-[85vh] w-full flex-col overflow-hidden rounded-xl border border-border bg-surface shadow-2xl ${SIZES[entry.size] || SIZES.md}`}
                                >
                                    {entry.confirm ? (
                                        /* minimal confirmation: title, message, buttons */
                                        <div className="flex flex-col gap-2 px-5 py-4">
                                            <h2 className="text-sm font-bold text-maintext">{entry.title}</h2>
                                            <p className="text-[13px] leading-relaxed text-subtext">{entry.confirm.message}</p>
                                            <div className="mt-2 flex items-center justify-end gap-2">
                                                <button
                                                    onClick={() => close(entry.id, false)}
                                                    className="rounded-full bg-elevated px-4 py-1.5 text-xs font-bold text-maintext transition hover:bg-border/60"
                                                >
                                                    {entry.confirm.cancelLabel || "Cancel"}
                                                </button>
                                                <button
                                                    autoFocus
                                                    onClick={() => close(entry.id, true)}
                                                    className={`rounded-full px-4 py-1.5 text-xs font-bold transition hover:brightness-110 ${
                                                        entry.confirm.danger
                                                            ? "bg-rose-500 text-white"
                                                            : "bg-accent text-canvas"
                                                    }`}
                                                >
                                                    {entry.confirm.confirmLabel || "Confirm"}
                                                </button>
                                            </div>
                                        </div>
                                    ) : (
                                        <>
                                            <div className="flex items-center gap-3 px-5 pb-1 pt-4">
                                                <h2 className="min-w-0 flex-1 truncate text-base font-bold text-maintext">{entry.title}</h2>
                                                {entry.dismissable && (
                                                    <button
                                                        onClick={() => close(entry.id, false)}
                                                        title="Close"
                                                        className="flex h-7 w-7 items-center justify-center rounded-full text-subtext transition-colors hover:bg-elevated hover:text-maintext"
                                                    >
                                                        <Icon name="x" className="h-4 w-4" />
                                                    </button>
                                                )}
                                            </div>
                                            <div className={`min-h-0 flex-1 overflow-y-auto ${entry.bare ? "" : "px-5 py-4"}`}>
                                                {entry.render?.({ close: (answer = false) => close(entry.id, answer) })}
                                            </div>
                                        </>
                                    )}
                                </motion.div>
                            </div>
                        ))}
                    </AnimatePresence>
                </>,
                document.body
            )}
        </ModalCtx.Provider>
    );
}

export function useModal() {
    const ctx = useContext(ModalCtx);
    if (!ctx) throw new Error("useModal must be used within ModalProvider");
    return ctx;
}
