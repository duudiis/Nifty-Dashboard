import { useNifty } from "../../context/NiftyContext.js";
import { artworkOrFallback, onArtworkError } from "../../lib/format.js";
import Icon from "../Icon.js";

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
                    icon={<Icon name="home" className="h-6 w-6" />}
                />
                <NavButton
                    active={view === "search"}
                    onClick={() => setView("search")}
                    label="Search"
                    icon={<Icon name="search" className="h-6 w-6" />}
                />
                <NavButton
                    active={view === "queue"}
                    onClick={() => setView("queue")}
                    label="Queue"
                    icon={<Icon name="queue" className="h-6 w-6" />}
                />
            </nav>

            {/* Library / servers */}
            <div className="flex min-h-0 flex-1 flex-col rounded-lg bg-surface">
                <div className="flex items-center gap-2 px-4 py-3 text-sm font-bold text-subtext">
                    <Icon name="library" className="h-5 w-5" />
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
                                        onError={onArtworkError}
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
