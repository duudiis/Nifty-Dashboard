// An artist name that opens the artist's page. Tracks that carry an artist
// browse id use it directly; everything else resolves the name through
// /api/artist-lookup (cached server-side).

import { useNifty } from "../../context/NiftyContext.js";

export default function ArtistLink({ name, browseId = null, className = "" }) {
    const { openEntity, notify } = useNifty();

    if (!name) return null;

    const open = async (e) => {
        e.stopPropagation();
        if (browseId) return openEntity("artist", browseId);
        try {
            const res = await fetch(`/api/artist-lookup?name=${encodeURIComponent(name)}`);
            const json = await res.json();
            if (json.browseId) openEntity("artist", json.browseId);
            else notify(`Couldn't find ${name}`);
        } catch {
            notify(`Couldn't find ${name}`);
        }
    };

    return (
        <button
            type="button"
            onClick={open}
            title={`Go to ${name}`}
            className={`min-w-0 truncate text-left transition-colors hover:text-maintext hover:underline ${className}`}
        >
            {name}
        </button>
    );
}
