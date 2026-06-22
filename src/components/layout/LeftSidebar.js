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
                <div className="flex items-center gap-3 px-4 pb-3 pt-4 text-xs font-bold text-subtext">
                    <Icon name="library" className="h-5 w-5" />
                    Library
                </div>

                <div className="relative min-h-0 flex-1 overflow-hidden">
                    {/* ghost library entries: aligned with the header icon, many and tall
                        so they bleed off the bottom edge (overflow hidden) */}
                    <div className="flex flex-col gap-3 px-4 pt-1">
                        {[140, 115, 160, 130, 150, 110, 145, 120, 155, 125].map((w, i) => (
                            <div key={i} className="flex animate-pulse items-center gap-3" style={{ animationDelay: `${i * 0.16}s` }}>
                                <div className="h-12 w-12 shrink-0 rounded-md bg-elevated" />
                                <div className="flex shrink-0 flex-col gap-2">
                                    <div className="h-3.5 rounded bg-elevated" style={{ width: `${w}px` }} />
                                    <div className="h-2.5 w-20 rounded bg-elevated" />
                                </div>
                            </div>
                        ))}
                    </div>

                    {/* centered message scrimmed over the skeleton */}
                    <div
                        className="absolute inset-0 flex flex-col items-center justify-center gap-1 px-6 text-center"
                        style={{ background: "radial-gradient(circle at 50% 45%, rgb(var(--c-surface)) 32%, rgb(var(--c-surface) / 0.85) 50%, transparent 80%)" }}
                    >
                        <Icon name="library" className="mb-1 h-8 w-8 text-subtext/60" />
                        <span className="text-sm font-bold text-maintext">Coming soon</span>
                        <span className="text-[11px] text-subtext">Your saved music, all in one place.</span>
                    </div>
                </div>
            </div>
        </aside>
    );
}
