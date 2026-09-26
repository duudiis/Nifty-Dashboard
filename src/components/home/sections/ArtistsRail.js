import { useNifty } from "../../../context/NiftyContext.js";
import { artworkOrFallback, humanDuration } from "../../../lib/format.js";
import Rail from "../Rail.js";
import Section from "../Section.js";

/**
 * The top of the listening history as faces, ranked by time rather than plays —
 * a two-minute skit played forty times is not the artist anyone means when they
 * say who they listen to.
 *
 * The rows carry a name and nothing else: /api/home counts artist *labels* off
 * the played tracks, so there is no browse id to open with. Clicking resolves
 * the name through /api/artist-lookup the same way ArtistLink does (one
 * server-side cache behind both), and says so plainly when the lookup comes
 * back empty rather than opening someone else's page.
 *
 * There is no <Empty> here on purpose: an account with plays has artists, so an
 * empty list means the history itself is empty, and the shelves above already
 * say that once. The section removes itself instead — but only after the data
 * lands, so the reserved height never disappears mid-load and jolts the page.
 */
export default function ArtistsRail({ home, loading }) {
    const { openEntity, notify } = useNifty();

    const artists = (home?.topArtists || []).filter((a) => a?.name);

    if (!loading && artists.length === 0) return null;

    const open = async (name) => {
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
        <Section
            id="your-artists"
            title="The artists you actually listen to"
            subtitle="By time in your ears, all time."
            loading={loading}
            minHeight={240}
        >
            <Rail itemClassName="w-[132px]">
                {artists.map((artist, i) => (
                            <button
                            onClick={() => open(artist.name)}
                            title={`Go to ${artist.name}`}
                            className="flex w-full flex-col gap-3 rounded-lg p-2 transition-colors hover:bg-elevated"
                        >
                            <img
                                src={artworkOrFallback(artist.artwork)}
                                onError={(e) => (e.currentTarget.src = artworkOrFallback(null))}
                                className="aspect-square w-full rounded-full object-cover shadow-lg"
                                alt=""
                            />
                            <span className="block min-w-0">
                                <span className="block truncate text-center text-sm font-bold text-maintext">
                                    {artist.name}
                                </span>
                                <span className="block truncate text-center text-[11px] text-subtext">
                                    {humanDuration(artist.ms || 0)}
                                </span>
                            </span>
                        </button>
                ))}
            </Rail>
        </Section>
    );
}
