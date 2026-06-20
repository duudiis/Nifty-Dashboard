import { useState } from "react";

import Logo from "../Logo.js";
import SessionSelector from "./SessionSelector.js";
import Account from "./Account.js";
import { useNifty } from "../../context/NiftyContext.js";

export default function TopBar() {
    const { runSearch, setView, view } = useNifty();
    const [query, setQuery] = useState("");

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
                <Logo className="h-8 w-8 text-accent" />
                <span className="hidden text-lg font-bold tracking-tight sm:block">Nifty</span>
            </button>

            {/* Search */}
            <form onSubmit={submit} className="flex max-w-md flex-1 items-center gap-2">
                <div className="flex w-full items-center gap-2 rounded-full bg-white/10 px-4 py-2 ring-white/0 transition focus-within:bg-white/15 focus-within:ring-2 focus-within:ring-white/20">
                    <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 fill-white/60">
                        <path d="M10 18a8 8 0 1 1 5.293-14.001A8 8 0 0 1 10 18Zm11.707 2.293-4.82-4.82a10 10 0 1 0-1.414 1.414l4.82 4.82a1 1 0 0 0 1.414-1.414Z" />
                    </svg>
                    <input
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="What do you want to play?"
                        className={`w-full bg-transparent text-sm text-white placeholder-white/50 outline-none ${view === "search" ? "" : ""}`}
                    />
                </div>
            </form>

            {/* Session + account */}
            <div className="flex items-center gap-2">
                <SessionSelector />
                <Account />
            </div>
        </header>
    );
}
