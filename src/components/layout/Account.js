import { useEffect, useRef, useState } from "react";

import { useNifty } from "../../context/NiftyContext.js";
import Icon from "../Icon.js";
import { AnimatePresence, motion, EASE } from "../motion/index.js";

export default function Account() {
    const { user, logout } = useNifty();
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        if (!open) return;
        const handler = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        };
        window.addEventListener("click", handler);
        return () => window.removeEventListener("click", handler);
    }, [open]);

    if (!user) return null;

    return (
        <div ref={ref} className="relative">
            <button
                onClick={() => setOpen((o) => !o)}
                className="flex items-center gap-2 rounded-full bg-white/10 py-1 pl-1 pr-3 text-white transition hover:bg-white/15"
            >
                <img src={user.avatar_url} alt="" className="h-7 w-7 rounded-full object-cover" />
                <span className="hidden max-w-[120px] truncate text-xs font-bold md:block">{user.username}</span>
                <Icon
                    name="chevron-down"
                    className={`h-4 w-4 text-white/70 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
                />
            </button>

            <AnimatePresence>
                {open && (
                    <motion.div
                        initial={{ opacity: 0, scale: 0.96, y: -6 }}
                        animate={{ opacity: 1, scale: 1, y: 0 }}
                        exit={{ opacity: 0, scale: 0.96, y: -6 }}
                        transition={{ duration: 0.14, ease: EASE }}
                        style={{ transformOrigin: "top right" }}
                        className="absolute right-0 z-50 mt-2 w-44 overflow-hidden rounded-xl border border-border bg-elevated p-1 shadow-2xl"
                    >
                        <button
                            onClick={logout}
                            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm font-medium text-rose-400 transition hover:bg-rose-500/10"
                        >
                            <Icon name="logout" className="h-4 w-4" />
                            Log out
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
