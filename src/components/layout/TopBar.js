import { useEffect, useState } from "react";
import { useRouter } from "next/router";

import Logo from "../Logo.js";
import Icon from "../Icon.js";
import Account from "./Account.js";
import { useNifty } from "../../context/NiftyContext.js";

export default function TopBar() {
    const { runSearch, setView } = useNifty();
    const router = useRouter();
    const [query, setQuery] = useState(() => (router.query.q ? String(router.query.q) : ""));

    // Auto-search as the user types (debounced), no Enter needed. Skip when the
    // text already matches the URL's ?q= (e.g. on landing) so we don't re-fetch.
    useEffect(() => {
        const q = query.trim();
        if (!q || q === (router.query.q ? String(router.query.q) : "")) return;
        const t = setTimeout(() => runSearch(q), 350);
        return () => clearTimeout(t);
    }, [query, runSearch, router.query.q]);

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
                        value={query}
                        onChange={(e) => setQuery(e.target.value)}
                        placeholder="What do you want to play?"
                        className="w-full bg-transparent text-sm text-white placeholder-white/50 outline-none"
                    />
                </div>
            </form>

            {/* Account (right third) */}
            <div className="flex min-w-0 flex-1 items-center justify-end gap-2">
                <Account />
            </div>
        </header>
    );
}
