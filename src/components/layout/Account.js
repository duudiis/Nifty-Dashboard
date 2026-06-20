import { useEffect, useRef, useState } from "react";

import { useNifty } from "../../context/NiftyContext.js";
import Icon from "../Icon.js";

export default function Account() {
    const { user, setSettingsOpen, logout } = useNifty();
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        if (!open) return;
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        window.addEventListener("click", handler);
        return () => window.removeEventListener("click", handler);
    }, [open]);

    if (!user) return null;

    return (
        <div ref={ref} className="relative">
            <button
                onClick={() => setOpen((o) => !o)}
                className="flex items-center gap-2 rounded-full bg-white/10 py-1 pl-1 pr-2 text-white transition hover:bg-white/15"
            >
                <img src={user.avatar_url} alt="" className="h-7 w-7 rounded-full object-cover" />
                <span className="hidden max-w-[120px] truncate text-xs font-bold md:block">{user.username}</span>
            </button>

            {open && (
                <div className="pop-in absolute right-0 z-50 mt-2 w-48 overflow-hidden rounded-xl border border-border bg-elevated p-1 shadow-2xl">
                    <button
                        onClick={() => { setSettingsOpen(true); setOpen(false); }}
                        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-maintext transition hover:bg-surface"
                    >
                        <Icon name="settings" className="h-4 w-4" />
                        Settings
                    </button>
                    <button
                        onClick={logout}
                        className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-left text-sm text-maintext transition hover:bg-surface"
                    >
                        <Icon name="logout" className="h-4 w-4" />
                        Log out
                    </button>
                </div>
            )}
        </div>
    );
}
