import { useEffect, useRef, useState } from "react";

import { useNifty } from "../../context/NiftyContext.js";

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
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-maintext transition hover:bg-surface"
                    >
                        <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
                            <path d="M12 15.5A3.5 3.5 0 1 1 12 8.5a3.5 3.5 0 0 1 0 7Zm7.43-2.53.02-.97-.02-.97 2.11-1.65a.5.5 0 0 0 .12-.64l-2-3.46a.5.5 0 0 0-.61-.22l-2.49 1a7.03 7.03 0 0 0-1.69-.98l-.38-2.65a.5.5 0 0 0-.49-.42h-4a.5.5 0 0 0-.49.42l-.38 2.65c-.6.25-1.17.58-1.69.98l-2.49-1a.5.5 0 0 0-.61.22l-2 3.46a.5.5 0 0 0 .12.64l2.11 1.65-.02.97.02.97-2.11 1.65a.5.5 0 0 0-.12.64l2 3.46c.14.24.42.32.61.22l2.49-1c.52.4 1.09.73 1.69.98l.38 2.65c.04.24.25.42.49.42h4c.24 0 .45-.18.49-.42l.38-2.65c.6-.25 1.17-.58 1.69-.98l2.49 1c.19.1.47.02.61-.22l2-3.46a.5.5 0 0 0-.12-.64l-2.11-1.65Z" />
                        </svg>
                        Settings
                    </button>
                    <button
                        onClick={logout}
                        className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-left text-sm text-maintext transition hover:bg-surface"
                    >
                        <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current">
                            <path d="M16 17v-2H9v-2h7V9l4 4-4 4ZM14 2a2 2 0 0 1 2 2v2h-2V4H5v16h9v-2h2v2a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9Z" />
                        </svg>
                        Log out
                    </button>
                </div>
            )}
        </div>
    );
}
