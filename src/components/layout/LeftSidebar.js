import { useNifty } from "../../context/NiftyContext.js";
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
    const { view, setView } = useNifty();

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

            {/* Library */}
            <div className="flex min-h-0 flex-1 flex-col rounded-lg bg-surface">
                <div className="flex items-center gap-2 px-4 py-3 text-sm font-bold text-subtext">
                    <Icon name="library" className="h-5 w-5" />
                    Library
                </div>

                <div className="flex min-h-0 flex-1 flex-col items-center justify-center gap-3 px-6 pb-6 text-center">
                    <Icon name="library" className="h-10 w-10 text-subtext/50" />
                    <div className="flex flex-col gap-1.5">
                        <span className="inline-flex items-center justify-center gap-2 text-sm font-bold text-maintext">
                            Library
                            <span className="rounded-full bg-accent/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-accent">
                                Soon
                            </span>
                        </span>
                        <p className="text-xs leading-relaxed text-subtext">
                            Save your liked songs and playlists right here, and link external
                            platforms — YouTube, Spotify, Deezer, Tidal — to see them all in one place.
                        </p>
                    </div>
                </div>
            </div>
        </aside>
    );
}
