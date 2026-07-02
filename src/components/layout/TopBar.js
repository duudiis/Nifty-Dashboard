import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/router";

import Logo from "../Logo.js";
import Icon from "../Icon.js";
import Account from "./Account.js";
import SearchSuggest from "../search/SearchSuggest.js";
import { motion, EASE } from "../motion/index.js";
import { useNifty } from "../../context/NiftyContext.js";

export default function TopBar() {
    const { runSearch, setView, updateAvailable, reloadApp } = useNifty();
    const router = useRouter();
    const [query, setQuery] = useState(() => (router.query.q ? String(router.query.q) : ""));
    const [suggestOpen, setSuggestOpen] = useState(false);
    const inputRef = useRef(null);
    const boxRef = useRef(null);

    // Keep the box in sync with the URL on navigation (back/forward, leaving the
    // search page), but never overwrite what the user is actively typing.
    useEffect(() => {
        if (document.activeElement === inputRef.current) return;
        const onSearch = router.query.view?.[0] === "search";
        setQuery(onSearch && router.query.q ? String(router.query.q) : "");
    }, [router.query.view, router.query.q]);

    // Typing feeds the suggestion dropdown (it debounces internally). The full
    // search page only opens on Enter.
    const onChange = (e) => {
        const value = e.target.value;
        setQuery(value);
        setSuggestOpen(!!value.trim());
    };

    const closeSuggest = () => setSuggestOpen(false);

    const submit = (e) => {
        e.preventDefault();
        closeSuggest();
        if (query.trim()) runSearch(query.trim());
    };

    // A click anywhere outside the search box dismisses the dropdown.
    useEffect(() => {
        if (!suggestOpen) return;
        const onDown = (e) => {
            if (!boxRef.current?.contains(e.target)) closeSuggest();
        };
        document.addEventListener("mousedown", onDown);
        return () => document.removeEventListener("mousedown", onDown);
    }, [suggestOpen]);

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
            <form ref={boxRef} onSubmit={submit} className="relative w-full max-w-md shrink">
                <div className="flex w-full items-center gap-2 rounded-full bg-white/10 px-4 py-2 ring-white/0 transition focus-within:bg-white/15 focus-within:ring-2 focus-within:ring-white/20">
                    <Icon name="search" className="h-5 w-5 shrink-0 text-white/60" />
                    <input
                        id="nifty-search"
                        ref={inputRef}
                        value={query}
                        onChange={onChange}
                        onFocus={() => query.trim().length >= 2 && setSuggestOpen(true)}
                        onKeyDown={(e) => e.key === "Escape" && closeSuggest()}
                        placeholder="What do you want to play?"
                        className="w-full bg-transparent text-sm text-white placeholder-white/50 outline-none"
                    />
                </div>
                <SearchSuggest query={query} open={suggestOpen} onClose={closeSuggest} />
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
