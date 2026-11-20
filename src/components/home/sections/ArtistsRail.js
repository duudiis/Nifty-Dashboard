import { useNifty } from "../../../context/NiftyContext.js";
import { artworkOrFallback } from "../../../lib/format.js";
import Rail from "../Rail.js";
import Section from "../Section.js";

export default function ArtistsRail({ home, loading }) {
    const { openEntity, notify } = useNifty();
    const artists = (home?.topArtists || []).filter((artist) => artist?.name);
    if (!loading && !artists.length) return null;
    const open = async (name) => {
        try {
            const res = await fetch(`/api/artist-lookup?name=${encodeURIComponent(name)}`);
            const json = await res.json();
            if (json.browseId) openEntity("artist", json.browseId);
            else notify(`Couldn't find ${name}`);
        } catch { notify(`Couldn't find ${name}`); }
    };

    return (
        <Section id="your-artists" title="Your favorite artists" loading={loading}>
            <Rail>
                {artists.map((artist) => (
                    <button key={artist.name} onClick={() => open(artist.name)} title={`Go to ${artist.name}`} className="flex w-full flex-col gap-3 rounded-lg p-3 text-left transition-colors hover:bg-elevated">
                        <img src={artworkOrFallback(artist.artwork)} onError={(event) => { event.currentTarget.src = artworkOrFallback(null); }} className="aspect-square w-full rounded-full object-cover shadow-lg" alt="" loading="lazy" decoding="async" />
                        <span className="block min-w-0 text-center">
                            <span className="block truncate text-sm font-bold text-maintext">{artist.name}</span>
                            <span className="block truncate text-xs text-subtext">Artist</span>
                        </span>
                    </button>
                ))}
            </Rail>
        </Section>
    );
}
