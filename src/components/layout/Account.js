import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";

import { useNifty } from "../../context/NiftyContext.js";
import Icon from "../Icon.js";
import { AnimatePresence, motion, EASE } from "../motion/index.js";
import { useModal } from "../modal/Modal.js";
import SettingsPanel from "../modal/SettingsModal.js";

export default function Account() {
    const { user, logout, notify, setView } = useNifty();
    const modal = useModal();
    const router = useRouter();
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    const openSettings = (initial = "appearance") => {
        modal.open({
            title: "Settings",
            size: "xl",
            bare: true,
            render: () => <SettingsPanel initial={initial} />
        });
    };

    useEffect(() => {
        if (!open) return;
        const handler = (e) => {
            if (ref.current && !ref.current.contains(e.target)) setOpen(false);
        };
        window.addEventListener("click", handler);
        return () => window.removeEventListener("click", handler);
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
                        className="absolute right-0 z-50 mt-2 w-48 overflow-hidden rounded-lg border border-border bg-elevated p-1 shadow-2xl"
                    >
                        <button
                            onClick={() => { setOpen(false); setView("history"); }}
                            className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[12px] font-medium text-maintext transition hover:bg-surface"
                        >
                            <Icon name="history" className="h-3.5 w-3.5" />
                            Listening history
                        </button>
                        <button
                            onClick={() => { setOpen(false); openSettings("appearance"); }}
                            className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[12px] font-medium text-maintext transition hover:bg-surface"
                        >
                            <Icon name="settings" className="h-3.5 w-3.5" />
                            Settings
                        </button>
                        <div className="my-1 h-px bg-border/70" />
                        <button
                            onClick={logout}
                            className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-1.5 text-left text-[12px] font-medium text-rose-400 transition hover:bg-rose-500/10"
                        >
                            <Icon name="logout" className="h-3.5 w-3.5" />
                            Log out
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
