import { useNifty } from "../context/NiftyContext.js";
import Logo from "./Logo.js";

// Shown only when the browser loses its link to the dashboard hub. The bot keeps
// playing regardless — this is purely about the dashboard connection.
export default function ConnectionOverlay() {
    const { connected } = useNifty();
    if (connected) return null;

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 backdrop-blur-sm">
            <div className="flex flex-col items-center gap-4 text-center">
                <Logo className="h-14 w-14 animate-pulse text-accent" />
                <p className="text-sm font-bold tracking-wide text-white">RECONNECTING</p>
                <p className="max-w-xs text-xs text-white/60">
                    Lost connection to the dashboard. The bot keeps playing — we&apos;ll be right back.
                </p>
            </div>
        </div>
    );
}
