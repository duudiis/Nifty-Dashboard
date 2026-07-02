import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";

import Logo from "../Logo.js";
import Icon from "../Icon.js";
import Account from "./Account.js";
import { motion, EASE } from "../motion/index.js";
import { useNifty } from "../../context/NiftyContext.js";

// Search modes, cycled by the chip inside the search pill. "auto" blends
// Deezer music with YouTube videos/playlists; the others use one source only.
const SEARCH_MODES = [
    { id: "auto", label: "Auto", hint: "Deezer music + YouTube videos" },
    { id: "deezer", label: "Deezer", hint: "Deezer only" },
    { id: "youtube", label: "YouTube", hint: "YouTube Music only" }
];

export default function TopBar() {
    const { runSearch, setView, updateAvailable, reloadApp, settings, updateSettings } = useNifty();
    const router = useRouter();
    const [query, setQuery] = useState(() => (router.query.q ? String(router.query.q) : ""));
    const inputRef = useRef(null);
    const debounceRef = useRef(null);

    // Keep the box in sync with the URL on navigation (back/forward, leaving the
    // search page), but never overwrite what the user is actively typing.
    useEffect(() => {
        if (document.activeElement === inputRef.current) return;
        const onSearch = router.query.view?.[0] === "search";
        setQuery(onSearch && router.query.q ? String(router.query.q) : "");
    }, [router.query.view, router.query.q]);

    useEffect(() => () => clearTimeout(debounceRef.current), []);

    // Auto-search as the user types (debounced), no Enter needed.
    const onChange = (e) => {
        const value = e.target.value;
        setQuery(value);
        clearTimeout(debounceRef.current);
        const q = value.trim();
        if (q) debounceRef.current = setTimeout(() => runSearch(q), 350);
    };

    const submit = (e) => {
        e.preventDefault();
        if (query.trim()) runSearch(query.trim());
    };

    const mode = SEARCH_MODES.find((m) => m.id === settings.searchSource) || SEARCH_MODES[0];
    const cycleMode = () => {
        const next = SEARCH_MODES[(SEARCH_MODES.indexOf(mode) + 1) % SEARCH_MODES.length];
        updateSettings({ searchSource: next.id });
    };

    return (
        <header className="flex h-16 shrink-0 items-center gap-4 bg-topbar px-4">

            {/* Brand (left third) */}
            <div className="flex min-w-0 flex-1 items-center justify-start">
                <button
                    onClick={() => setView("home")}
                    className="ml-1 flex items-center gap-3 text-white transition-opacity hover:opacity-90"
                >
                    <Logo className="h-11 w-11 text-white" />
                    <span className="hidden text-3xl font-extrabold tracking-tight sm:block">Nifty</span>
                </button>
            </div>

            {/* Search (always centred) */}
            <form onSubmit={submit} className="w-full max-w-md shrink">
                <div className="flex w-full items-center gap-2 rounded-full bg-white/10 px-4 py-2 ring-white/0 transition focus-within:bg-white/15 focus-within:ring-2 focus-within:ring-white/20">
                    <Icon name="search" className="h-5 w-5 shrink-0 text-white/60" />
                    <input
                        id="nifty-search"
                        ref={inputRef}
                        value={query}
                        onChange={onChange}
                        placeholder="What do you want to play?"
                        className="w-full bg-transparent text-sm text-white placeholder-white/50 outline-none"
                    />
                    <button
                        type="button"
                        onClick={cycleMode}
                        title={`Search mode: ${mode.label} — ${mode.hint}. Click to switch.`}
                        className="shrink-0 rounded-full bg-white/10 px-2.5 py-0.5 text-[11px] font-bold text-white/60 transition hover:bg-white/20 hover:text-white"
                    >
                        {mode.label}
                    </button>
                </div>
            </form>

            {/* Update prompt + account (right third) */}
            <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
                {updateAvailable && (
                    <motion.button
                        initial={{ opacity: 0, scale: 0.85 }}
                        animate={{ opacity: 1, scale: 1 }}
                        transition={{ duration: 0.25, ease: EASE }}
                        onClick={reloadApp}
                        title="A new version is available — click to update"
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-accent transition hover:bg-white/15"
                    >
                        <Icon name="download" className="h-5 w-5" />
                    </motion.button>
                )}
                <Account />
            </div>
        </header>
    );
}
