// App-wide right-click menu.
//
// Mount <ContextMenuProvider> once near the root. Anywhere inside it, call
// `useContextMenu(buildItems)` to get { onContextMenu, active }:
//
//   const { onContextMenu, active } = useContextMenu(() => [
//       { label: "Play now", icon: "play-now", onClick: () => … },
//       { separator: true },
//       { label: "Remove", icon: "trash", danger: true, onClick: () => … }
//   ]);
//   <div onContextMenu={onContextMenu} className={active ? "bg-elevated" : ""}>…</div>
//
// `active` is true while *this* element's menu is open, so the trigger can keep
// its hover state and make clear which item the menu refers to.
//
// `buildItems` may be an array or a function returning one (evaluated on open,
// so it can read fresh state). Items: { label, icon?, onClick, disabled?,
// danger? }, { separator: true }, or { label, icon?, children: [...] } for a
// one-level submenu (opens on hover, arrow on the right). A handler that
// yields no items lets the
// event fall through to the global suppressor, so the native browser menu is
// hidden on "dead" areas while still working inside text fields.

import { createContext, useCallback, useContext, useEffect, useId, useState } from "react";
import { createPortal } from "react-dom";

import Icon from "../Icon.js";
import { AnimatePresence, motion } from "../motion/index.js";

const Ctx = createContext(null);

const MENU_W = 224;
const SUB_W = 208;
const ITEM_H = 33;
const SEP_H = 9;
const PAD = 8;
const FORM_FIELDS = 'input, textarea, select, [contenteditable=""], [contenteditable="true"]';

export function ContextMenuProvider({ children }) {
    const [menu, setMenu] = useState(null); // { x, y, items, origin, id }
    const [sub, setSub] = useState(null);   // { index, top } — open submenu
    const [mounted, setMounted] = useState(false);

    useEffect(() => setMounted(true), []);

    const close = useCallback(() => { setMenu(null); setSub(null); }, []);

    const open = useCallback((event, items, id) => {
        const list = (typeof items === "function" ? items() : items)?.filter(Boolean) || [];
        if (list.length === 0) return; // let the global suppressor handle it
        event.preventDefault();

        const rows = list.filter((i) => !i.separator).length;
        const seps = list.length - rows;
        const h = rows * ITEM_H + seps * SEP_H + 8;

        // Horizontal: open to the right of the cursor (incl. when near the left
        // edge); flip to the left only when there isn't room on the right.
        let x = event.clientX;
        let originX = "left";
        if (x + MENU_W + PAD > window.innerWidth) {
            x = event.clientX - MENU_W;
            originX = "right";
        }
        x = Math.max(PAD, Math.min(x, window.innerWidth - MENU_W - PAD));

        // Vertical: drop down, flip up if it would overflow the bottom.
        let y = event.clientY;
        let originY = "top";
        if (y + h + PAD > window.innerHeight) {
            y = event.clientY - h;
            originY = "bottom";
        }
        y = Math.max(PAD, Math.min(y, window.innerHeight - h - PAD));

        setMenu({ x, y, items: list, origin: `${originY} ${originX}`, id });
    }, []);

    // Suppress the native context menu everywhere our menu didn't already claim,
    // except inside editable fields (so paste/select still works there).
    useEffect(() => {
        const onDocCtx = (e) => {
            if (e.defaultPrevented) return;
            if (e.target?.closest?.(FORM_FIELDS)) return;
            e.preventDefault();
        };
        document.addEventListener("contextmenu", onDocCtx);
        return () => document.removeEventListener("contextmenu", onDocCtx);
    }, []);

    useEffect(() => {
        if (!menu) return;
        // Non-capture: only a page/window scroll closes the menu. Inner-element
        // scrolls (e.g. the lyrics auto-scroll) must NOT dismiss it.
        const onScroll = () => close();
        const onKey = (e) => e.key === "Escape" && close();
        window.addEventListener("scroll", onScroll);
        window.addEventListener("resize", close);
        window.addEventListener("keydown", onKey);
        return () => {
            window.removeEventListener("scroll", onScroll);
            window.removeEventListener("resize", close);
            window.removeEventListener("keydown", onKey);
        };
    }, [menu, close]);

    const value = { open, openId: menu?.id ?? null };

    return (
        <Ctx.Provider value={value}>
            {children}
            {mounted &&
                createPortal(
                    <AnimatePresence>
                        {menu && (
                            <>
                                <div
                                    // Tagged so outside-click handlers (e.g. the
                                    // search dropdown's) can tell "closing a menu"
                                    // apart from a genuine outside click.
                                    data-ctxmenu=""
                                    className="fixed inset-0 z-[90]"
                                    onClick={close}
                                    onContextMenu={(e) => {
                                        e.preventDefault();
                                        close();
                                    }}
                                />
                                <motion.div
                                    data-ctxmenu=""
                                    className="fixed z-[95] overflow-hidden rounded-lg border border-border bg-elevated p-1 shadow-2xl"
                                    style={{ left: menu.x, top: menu.y, width: MENU_W, transformOrigin: menu.origin }}
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, scale: 0.96 }}
                                    transition={{ duration: 0.1, ease: [0.4, 0, 0.2, 1] }}
                                >
                                    {menu.items.map((item, i) =>
                                        item.separator ? (
                                            <div key={`sep-${i}`} className="my-1 h-px bg-border/70" />
                                        ) : (
                                            <button
                                                key={item.label}
                                                disabled={item.disabled}
                                                onMouseEnter={(e) => {
                                                    if (item.children?.length) {
                                                        setSub({ index: i, top: e.currentTarget.getBoundingClientRect().top - 4 });
                                                    } else {
                                                        setSub(null);
                                                    }
                                                }}
                                                onClick={() => {
                                                    if (item.children?.length) return; // hover opens it
                                                    close();
                                                    item.onClick?.();
                                                }}
                                                className={`flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[12px] font-medium transition disabled:cursor-not-allowed disabled:opacity-40 ${
                                                    item.danger
                                                        ? "text-rose-400 hover:bg-rose-500/10"
                                                        : "text-maintext hover:bg-surface"
                                                } ${sub?.index === i ? "bg-surface" : ""}`}
                                            >
                                                {item.icon && <Icon name={item.icon} className="h-3.5 w-3.5" />}
                                                <span className="truncate">{item.label}</span>
                                                {item.children?.length > 0 && (
                                                    <Icon name="chevron-down" className="ml-auto h-3 w-3 shrink-0 -rotate-90 text-subtext" />
                                                )}
                                            </button>
                                        )
                                    )}
                                </motion.div>
                                {sub && menu.items[sub.index]?.children?.length > 0 && (
                                    <motion.div
                                        data-ctxmenu=""
                                        className="fixed z-[96] max-h-72 overflow-y-auto rounded-lg border border-border bg-elevated p-1 shadow-2xl"
                                        style={{
                                            left: menu.x + MENU_W + SUB_W + PAD > window.innerWidth
                                                ? menu.x - SUB_W + 4
                                                : menu.x + MENU_W - 4,
                                            top: Math.min(
                                                sub.top,
                                                window.innerHeight - PAD -
                                                    (menu.items[sub.index].children.length * ITEM_H + 8)
                                            ),
                                            width: SUB_W
                                        }}
                                        initial={{ opacity: 0, x: -4 }}
                                        animate={{ opacity: 1, x: 0 }}
                                        exit={{ opacity: 0 }}
                                        transition={{ duration: 0.1, ease: [0.4, 0, 0.2, 1] }}
                                    >
                                        {menu.items[sub.index].children.map((child) => (
                                            <button
                                                key={child.label}
                                                disabled={child.disabled}
                                                onClick={() => {
                                                    close();
                                                    child.onClick?.();
                                                }}
                                                className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[12px] font-medium text-maintext transition hover:bg-surface disabled:cursor-not-allowed disabled:opacity-40"
                                            >
                                                {child.icon && <Icon name={child.icon} className="h-3.5 w-3.5 shrink-0" />}
                                                <span className="truncate">{child.label}</span>
                                            </button>
                                        ))}
                                    </motion.div>
                                )}
                            </>
                        )}
                    </AnimatePresence>,
                    document.body
                )}
        </Ctx.Provider>
    );
}

// Returns { onContextMenu, active }. `active` is true while this element's menu
// is the one currently open (so the trigger can persist its hover state).
export function useContextMenu(items) {
    const ctx = useContext(Ctx);
    const id = useId();
    const onContextMenu = useCallback(
        (event) => {
            ctx?.open(event, items, id);
        },
        [ctx, items, id]
    );
    return { onContextMenu, active: ctx?.openId === id };
}
