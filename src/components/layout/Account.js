import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";

import { useNifty } from "../../context/NiftyContext.js";
import Icon from "../Icon.js";
import { AnimatePresence, motion, EASE } from "../motion/index.js";
import { useModal } from "../modal/Modal.js";
import { settingsModal } from "../settings/SettingsModal.js";

export default function Account() {
    const { user, logout, notify, setView } = useNifty();
    const modal = useModal();
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    const openSettings = (initial = "appearance") => {
        modal.open(settingsModal(initial));
    };

    useEffect(() => {
        if (!open) return;
        const handler = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        };
        const onKey = (e) => { if (e.key === "Escape") { setOpen(false); ref.current?.querySelector("button")?.focus(); } };
        window.addEventListener("click", handler);
        window.addEventListener("keydown", onKey);
        return () => { window.removeEventListener("click", handler); window.removeEventListener("keydown", onKey); };
    }, [open]);

    // Returning from an OAuth connect: open Settings → Connections and toast
    // the result, then strip the params so a refresh doesn't reopen it.
    const handledConnect = useRef(false);
    useEffect(() => {
        if (handledConnect.current || !router.isReady) return;
        const connect = router.query.connect;
        const settingsTab = router.query.settings;
        if (!connect && !settingsTab) return;
        handledConnect.current = true;

        openSettings("connections");
        if (connect) {
            const [prov, status] = String(connect).split(":");
            const name = prov ? prov[0].toUpperCase() + prov.slice(1) : "account";
            if (status === "ok") notify(`Connected ${name} — importing your liked songs…`);
            else if (status === "denied") notify(`${name} connection was cancelled`);
            else notify(`Couldn't connect ${name}`);
        }
        const { connect: _c, settings: _s, ...rest } = router.query;
        router.replace({ pathname: router.pathname, query: rest }, undefined, { shallow: true });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [router.isReady]);

    if (!user) return null;

    return (
        <div ref={ref} className="relative">
            <button
                onClick={() => setOpen((o) => !o)}
                aria-label="Account menu"
                aria-expanded={open}
                className="flex items-center gap-2 rounded-full bg-topbartext/10 py-1 pl-1 pr-3 text-topbartext transition hover:bg-topbartext/15"
            >
                <img src={user.avatar_url} alt="" className="h-7 w-7 rounded-full object-cover" />
                <span className="hidden max-w-[120px] truncate text-xs font-bold md:block">{user.username}</span>
                <Icon
                    name="chevron-down"
                    className={`h-4 w-4 text-topbartext/70 transition-transform duration-200 ${open ? "rotate-180" : ""}`}
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
                        className="absolute right-0 z-50 mt-2 w-52 space-y-1 overflow-hidden rounded-lg border border-border bg-elevated p-1.5 shadow-2xl"
                    >
                        <button
                            onClick={() => { setOpen(false); setView("history"); }}
                            className="flex min-h-9 w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[13px] font-medium text-maintext transition-colors hover:bg-surface"
                        >
                            <Icon name="history" className="h-4 w-4 text-subtext" />
                            Listening history
                        </button>
                        <button
                            onClick={() => { setOpen(false); openSettings("appearance"); }}
                            className="flex min-h-9 w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[13px] font-medium text-maintext transition-colors hover:bg-surface"
                        >
                            <Icon name="settings" className="h-4 w-4 text-subtext" />
                            Settings
                        </button>
                        <div className="my-1 h-px bg-border/70" />
                        <button
                            onClick={logout}
                            className="flex min-h-9 w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[13px] font-medium text-red-400 transition-colors hover:bg-red-400/10"
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
