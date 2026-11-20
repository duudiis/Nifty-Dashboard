import { useNifty } from "../../context/NiftyContext.js";

// This fixed-height header is the reorder boundary. Loading rows live outside
// it so a recommendation response can never stretch or move its switch.
export default function AutoplaySection() {
    const { queue, toggleAutoplay } = useNifty();
    const enabled = queue.autoplay?.enabled ?? false;

    return (
        <div className="flex h-12 w-full items-center justify-between gap-2 px-2">
            <span className="truncate text-[13px] font-bold text-maintext">
                {enabled ? "Next from: Autoplay" : "Autoplay"}
            </span>
            <button
                type="button"
                onClick={toggleAutoplay}
                onPointerDown={(event) => event.stopPropagation()}
                title={enabled ? "Turn off Autoplay" : "Turn on Autoplay"}
                aria-label="Autoplay"
                role="switch"
                aria-checked={enabled}
                className={`relative h-5 w-9 shrink-0 rounded-full outline-none transition-colors focus-visible:ring-2 focus-visible:ring-accent focus-visible:ring-offset-2 focus-visible:ring-offset-surface ${enabled ? "bg-accent" : "bg-subtext/30"}`}
            >
                <span className={`absolute left-0.5 top-0.5 h-4 w-4 rounded-full bg-maintext shadow transition-transform ${enabled ? "translate-x-4" : "translate-x-0"}`} />
            </button>
        </div>
    );
}
