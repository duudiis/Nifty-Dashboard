import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";

import Logo from "../Logo.js";
import Icon from "../Icon.js";
import Account from "./Account.js";
import { useNifty } from "../../context/NiftyContext.js";

export default function TopBar() {
    const { runSearch, setView, updateAvailable, reloadApp } = useNifty();
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

    return (
        <header className="flex h-16 shrink-0 items-center gap-4 bg-topbar px-4">

            {/* Brand (left third) */}
            <div className="flex min-w-0 flex-1 items-center justify-start">
                <button
                    onClick={() => setView("home")}
                    className="flex items-center gap-3 text-white transition-opacity hover:opacity-90"
                >
                    <Logo className="h-9 w-9 text-white" />
                    <span className="hidden text-3xl font-extrabold tracking-tight sm:block">Nifty</span>
                </button>
            </div>

            {/* Search (always centred) */}
            <form onSubmit={submit} className="w-full max-w-md shrink">
                <div className="flex w-full items-center gap-2 rounded-full bg-white/10 px-4 py-2 ring-white/0 transition focus-within:bg-white/15 focus-within:ring-2 focus-within:ring-white/20">
                    <Icon name="search" className="h-5 w-5 shrink-0 text-white/60" />
                    <input
                        ref={inputRef}
                        value={query}
                        onChange={onChange}
                        placeholder="What do you want to play?"
                        className="w-full bg-transparent text-sm text-white placeholder-white/50 outline-none"
                    />
                </div>
            </form>

            {/* Update prompt + account (right third) */}
            <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
                {updateAvailable && (
                    <button
                        onClick={reloadApp}
                        title="A new version is available — click to update"
                        className="flex items-center gap-1.5 rounded-full bg-accent px-3 py-1.5 text-xs font-bold text-canvas transition hover:brightness-110"
                    >
                        <Icon name="sync" className="h-3.5 w-3.5" />
                        <span className="hidden sm:block">Update</span>
                    </button>
                )}
                <Account />
            </div>
        </header>
    );
}
