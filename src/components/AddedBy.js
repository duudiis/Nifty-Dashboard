import { addedByOf } from "../lib/format.js";
import Icon from "./Icon.js";

// Renders "who queued this": their Discord avatar (or a fallback user glyph)
// next to their name. Pass a track; shape normalisation lives in addedByOf.
export default function AddedBy({ track, className = "", size = 16, showName = true }) {
    const { name, avatar } = addedByOf(track);
    if (!name && !avatar) return null;

    const dim = { width: size, height: size };

    return (
        <span className={`flex min-w-0 items-center gap-1.5 ${className}`}>
            {avatar ? (
                <img
                    src={avatar}
                    onError={(e) => (e.currentTarget.style.display = "none")}
                    style={dim}
                    className="shrink-0 rounded-full object-cover"
                    alt=""
                />
            ) : (
                <span style={dim} className="flex shrink-0 items-center justify-center rounded-full bg-elevated text-subtext">
                    <Icon name="user" className="h-3 w-3" strokeWidth={2.2} />
                </span>
            )}
            {showName && <span className="truncate">{name}</span>}
        </span>
    );
}
