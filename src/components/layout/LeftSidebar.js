import { useNifty } from "../../context/NiftyContext.js";
import { artworkOrFallback } from "../../lib/format.js";

function NavButton({ active, onClick, icon, label }) {
    return (
        <button
            onClick={onClick}
            className={`flex w-full items-center gap-4 rounded-md px-3 py-2 text-sm font-bold transition ${active ? "text-maintext" : "text-subtext hover:text-maintext"}`}
        >
            {icon}
            {label}
        </button>
    );
}

export default function LeftSidebar() {
    const { view, setView, sessions, selected, selectSession } = useNifty();
    const key = (s) => `${s.botName}:${s.guildId}`;

    return (
        <aside className="hidden w-[300px] shrink-0 flex-col gap-2 md:flex">

            {/* Nav card */}
            <nav className="rounded-lg bg-surface p-2">
                <NavButton
                    active={view === "home"}
                    onClick={() => setView("home")}
                    label="Home"
                    icon={
                        <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current">
                            <path d="M12 3 3 10v11h6v-6h6v6h6V10L12 3Z" />
                        </svg>
                    }
                />
                <NavButton
                    active={view === "search"}
                    onClick={() => setView("search")}
                    label="Search"
                    icon={
                        <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current">
                            <path d="M10 18a8 8 0 1 1 5.293-14.001A8 8 0 0 1 10 18Zm11.707 2.293-4.82-4.82a10 10 0 1 0-1.414 1.414l4.82 4.82a1 1 0 0 0 1.414-1.414Z" />
                        </svg>
                    }
                />
                <NavButton
                    active={view === "queue"}
                    onClick={() => setView("queue")}
                    label="Queue"
                    icon={
                        <svg viewBox="0 0 24 24" className="h-6 w-6 fill-current">
                            <path d="M3 6h13v2H3V6Zm0 5h13v2H3v-2Zm0 5h9v2H3v-2Zm15-1.05V8l4 2-4 2Z" />
                        </svg>
                    }
                />
            </nav>

            {/* Library / servers */}
            <div className="flex min-h-0 flex-1 flex-col rounded-lg bg-surface">
                <div className="flex items-center gap-2 px-4 py-3 text-sm font-bold text-subtext">
                    <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current">
                        <path d="M4 4h7v7H4V4Zm9 0h7v7h-7V4ZM4 13h7v7H4v-7Zm9 0h7v7h-7v-7Z" />
                    </svg>
                    Your servers
                </div>

                <div className="min-h-0 flex-1 overflow-auto px-2 pb-2">
                    {sessions.length === 0 ? (
                        <p className="px-3 py-2 text-xs text-subtext">
                            Join a voice channel with Nifty to see your servers here.
                        </p>
                    ) : (
                        sessions.map((s) => {
                            const isSelected = selected && key(selected) === key(s);
                            return (
                                <button
                                    key={key(s)}
                                    onClick={() => selectSession(s)}
                                    className={`flex w-full items-center gap-3 rounded-md p-2 text-left transition ${isSelected ? "bg-elevated" : "hover:bg-elevated/60"}`}
                                >
                                    <img
                                        src={artworkOrFallback(s.guildIcon)}
                                        onError={(e) => (e.currentTarget.src = artworkOrFallback(null))}
                                        className="h-11 w-11 shrink-0 rounded-md object-cover"
                                        alt=""
                                    />
                                    <div className="flex min-w-0 flex-col leading-tight">
                                        <span className={`truncate text-sm font-bold ${isSelected ? "text-accent" : "text-maintext"}`}>{s.guildName}</span>
                                        <span className="truncate text-[11px] text-subtext">
                                            {s.botName} · {s.voiceChannelName || "—"}
                                        </span>
                                    </div>
                                </button>
                            );
                        })
                    )}
                </div>
            </div>
        </aside>
    );
}
