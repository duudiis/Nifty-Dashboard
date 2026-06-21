import { useEffect, useState } from "react";

import Logo from "../Logo.js";
import Icon from "../Icon.js";
import Account from "./Account.js";
import { useNifty } from "../../context/NiftyContext.js";

export default function TopBar() {
    const { runSearch, setView, view } = useNifty();
    const [query, setQuery] = useState("");

    // Auto-search as the user types (debounced), no Enter needed.
    useEffect(() => {
        const q = query.trim();
        if (!q) return;
        const t = setTimeout(() => runSearch(q), 350);
        return () => clearTimeout(t);
    }, [query, runSearch]);

    const submit = (e) => {
        e.preventDefault();
        if (query.trim()) runSearch(query.trim());
    };

    return (
        <header className="flex h-16 shrink-0 items-center justify-between gap-4 bg-topbar px-4">

            {/* Brand */}
            <button
                onClick={() => setView("home")}
                className="flex items-center gap-3 text-white transition-opacity hover:opacity-90"
            >
                <Logo className="h-9 w-9 text-white" />
                <span className="hidden text-3xl font-extrabold tracking-tight sm:block">Nifty</span>
            </button>

            {/* Search */}
            <form onSubmit={submit} className="flex max-w-md flex-1 items-center gap-2">
                <div className="flex w-full items-center gap-2 rounded-full bg-white/10 px-4 py-2 ring-white/0 transition focus-within:bg-white/15 focus-within:ring-2 focus-within:ring-white/20">
                    <Icon name="search" className="h-5 w-5 text-white/60" />
                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="What do you want to play?"
                        className={`w-full bg-transparent text-sm text-white placeholder-white/50 outline-none ${view === "search" ? "" : ""}`}
                    />
                </div>
            </form>

            {/* Account */}
            <div className="flex items-center gap-2">
                <Account />
            </div>
        </header>
    );
}
