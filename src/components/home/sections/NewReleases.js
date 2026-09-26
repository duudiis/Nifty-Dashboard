import Tile from "../../browse/Tile.js";
import Rail from "../Rail.js";
import Section from "../Section.js";

// The date is not decoration. /api/discover keeps a twelve-month window,
// because a six-month one returned literally nothing for a real listener — so
// "new" here can mean last week or last autumn, and the tile has to say which.
const released = (value) => {
    const t = Date.parse(value);
    if (!Number.isFinite(t)) return null;
    return new Date(t).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
};

/**
 * Recent albums from the artists in the listening history, merged across every
 * seed into one shelf.
 *
 * When nothing comes back the section is gone — there is no fallback to a
 * global new-releases shelf, because "New from artists you play" over records
 * by artists the user has never played is a lie the page would be telling in
 * its own heading. Silence is the honest version.
 */
export default function NewReleases({ discover, loading }) {
    const releases = (discover?.releases || []).filter((r) => r?.browseId);

    // Only after the payload lands: hiding mid-load would drop the reserved
    // height and jolt everything below it upward.
    if (!loading && releases.length === 0) return null;

    return (
        <Section id="new-releases" title="New from artists you play" loading={loading} minHeight={260}>
            <Rail itemClassName="w-[168px]">
                {releases.map((album) => (
                    <div key={album.browseId}>
                        <Tile item={album} />
                        <div className="truncate px-3 pb-1 text-[10px] text-subtext">
                            {released(album.releaseDate)}
                        </div>
                    </div>
                ))}
            </Rail>
        </Section>
    );
}
