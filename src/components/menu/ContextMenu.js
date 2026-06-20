// App-wide right-click menu.
//
// Mount <ContextMenuProvider> once near the root. Anywhere inside it, call
// `useContextMenu(buildItems)` to get an `onContextMenu` handler:
//
//   const onContextMenu = useContextMenu(() => [
//       { label: "Play now", icon: "play-now", onClick: () => … },
//       { separator: true },
//       { label: "Remove", icon: "trash", danger: true, onClick: () => … }
//   ]);
//   <div onContextMenu={onContextMenu}>…</div>
//
// `buildItems` may be an array or a function returning one (evaluated on open,
// so it can read fresh state). Items: { label, icon?, onClick, disabled?,
// danger? } or { separator: true }.

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { createPortal } from "react-dom";

import Icon from "../Icon.js";
import { AnimatePresence, motion, EASE, DUR } from "../motion/index.js";

const Ctx = createContext(null);

const MENU_W = 220;
const ITEM_H = 38;

export function ContextMenuProvider({ children }) {
    const [menu, setMenu] = useState(null); // { x, y, items }
    const [mounted, setMounted] = useState(false);

    useEffect(() => setMounted(true), []);

    const close = useCallback(() => setMenu(null), []);

    const open = useCallback((event, items) => {
        const list = (typeof items === "function" ? items() : items)?.filter(Boolean) || [];
        if (list.length === 0) return;
        event.preventDefault();
        event.stopPropagation();

        // Keep the menu inside the viewport.
        const rows = list.filter((i) => !i.separator).length;
        const seps = list.length - rows;
        const h = rows * ITEM_H + seps * 9 + 12;
        const x = Math.min(event.clientX, window.innerWidth - MENU_W - 8);
        const y = Math.min(event.clientY, window.innerHeight - h - 8);
        setMenu({ x: Math.max(8, x), y: Math.max(8, y), items: list });
    }, []);

    useEffect(() => {
        if (!menu) return;
        const onScroll = () => close();
        const onKey = (e) => e.key === "Escape" && close();
        window.addEventListener("scroll", onScroll, true);
        window.addEventListener("resize", close);
        window.addEventListener("keydown", onKey);
        return () => {
            window.removeEventListener("scroll", onScroll, true);
            window.removeEventListener("resize", close);
            window.removeEventListener("keydown", onKey);
        };
    }, [menu, close]);

    return (
        <Ctx.Provider value={open}>
            {children}
            {mounted &&
                createPortal(
                    <AnimatePresence>
                        {menu && (
                            <>
                                {/* click-away / right-click-away catcher */}
                                <div
                                    className="fixed inset-0 z-[90]"
                                    onClick={close}
                                    onContextMenu={(e) => {
                                        e.preventDefault();
                                        close();
                                    }}
                                />
                                <motion.div
                                    className="fixed z-[95] w-[220px] overflow-hidden rounded-xl border border-border bg-elevated p-1 shadow-2xl"
                                    style={{ left: menu.x, top: menu.y, transformOrigin: "top left" }}
                                    initial={{ opacity: 0, scale: 0.94 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.96 }}
                                    transition={{ duration: DUR.fast, ease: EASE }}
                                >
                                    {menu.items.map((item, i) =>
                                        item.separator ? (
                                            <div key={`sep-${i}`} className="my-1 h-px bg-border/70" />
                                        ) : (
                                            <button
                                                key={item.label}
                                                disabled={item.disabled}
                                                onClick={() => {
                                                    close();
                                                    item.onClick?.();
                                                }}
                                                className={`flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left text-[13px] font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
                                                    item.danger
                                                        ? "text-rose-400 hover:bg-rose-500/10"
                                                        : "text-maintext hover:bg-surface"
                                                }`}
                                            >
                                                {item.icon && <Icon name={item.icon} className="h-4 w-4" />}
                                                <span className="truncate">{item.label}</span>
                                            </button>
                                        )
                                    )}
                                </motion.div>
                            </>
                        )}
                    </AnimatePresence>,
                    document.body
                )}
        </Ctx.Provider>
    );
}

// Returns an onContextMenu handler bound to the given items (array or factory).
export function useContextMenu(items) {
    const open = useContext(Ctx);
    return useCallback(
        (event) => {
            if (open) open(event, items);
        },
        [open, items]
    );
}
