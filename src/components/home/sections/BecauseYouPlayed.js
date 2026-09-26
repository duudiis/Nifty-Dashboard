import { useState } from "react";

import Tile from "../../browse/Tile.js";
import { Stagger, StaggerItem } from "../../motion/index.js";
import Rail from "../Rail.js";
import Section, { Empty } from "../Section.js";

/**
 * The recommendation shelf: songs that sit next to an artist you actually
 * play, and the artists that sit next to them.
 *
 * /api/discover only calls a seed personal when it could resolve the name to a
 * real catalogue artist, and an unmatched history is a normal Tuesday, not a
 * failure — plenty of listening is live sets, uploads and covers that no
 * catalogue has a page for. So the unpersonalized branch is a first-class
 * layout with its own honest heading, not a degraded one: the charts are worth
 * showing, they are just nobody's taste in particular, and the subtitle says
 * exactly that rather than letting "because you played" sit over strangers.
 *
 * The seed chips are local state and nothing else. All three bundles arrive in
 * the one payload, so switching artists must never refetch or wash.
 */
export default function BecauseYouPlayed({ discover, loading }) {
    const [picked, setPicked] = useState(null);

    // A bundle whose radio and related calls both degraded still keeps its
    // chip: the seed is a real artist the user plays, and dropping it silently
    // would make the row shorter for a reason nobody could see. The empty
    // state below explains it instead.
    const bundles = (discover?.bundles || []).filter((b) => b?.seed?.name);
    const seedKey = (bundle) => bundle?.seed?.browseId || bundle?.seed?.name;

    const personalized = Boolean(discover?.personalized) && bundles.length > 0;

    // Derived, not an effect: `discover` lands a beat after mount, so a default
    // chosen at mount would always be the empty one. Once the user picks a
    // chip their choice wins and a late payload cannot move it.
    const active = bundles.find((b) => seedKey(b) === picked) || bundles[0] || null;
    const activeKey = personalized ? seedKey(active) : "charts";

    const songs = (personalized ? active?.songs : discover?.songs) || [];
    const artists = (personalized ? active?.artists : discover?.artists) || [];

    // A tile with no query behind it is a dead click, and an artist with no
    // browse id opens nothing.
    const picks = songs.filter((s) => s?.playQuery || s?.url);
    const faces = artists.filter((a) => a?.browseId);

    const anything = personalized
        ? bundles.some((b) => (b.songs || []).length || (b.artists || []).length)
        : picks.length > 0 || faces.length > 0;

    // Only once the payload has landed: hiding mid-load would drop the
    // reserved height and jolt everything below it upward.
    if (!loading && !anything) return null;

    // The heading is the one thing that cannot flip. While loading neither
    // branch is known yet, so it says the plain thing both of them mean rather
    // than showing "Charts right now" for a second and then renaming itself.
    const title = loading
        ? "More like what you play"
        : personalized
            ? `Because you played ${active.seed.name}`
            : "Charts right now";

    const subtitle = loading
        ? null
        : personalized
            ? "Songs that sit next to them, and the artists that do too."
            : "Nothing in your recent listening matched a catalogue artist, so this is what everyone is playing.";

    // One chip that cannot be unpicked is a control with nothing to do — with a
    // single seed the heading already carries the name.
    const chips = personalized && bundles.length > 1 ? (
        <div className="flex flex-wrap items-center gap-1.5">
            {bundles.map((b) => (
                <button
                    key={seedKey(b)}
                    onClick={() => setPicked(seedKey(b))}
                    className={`rounded-full px-3 py-1 text-xs font-bold transition ${
                        seedKey(b) === activeKey ? "bg-maintext text-canvas" : "bg-elevated text-subtext hover:text-maintext"
                    }`}
                >
                    {b.seed.name}
                </button>
            ))}
        </div>
    ) : null;

    return (
        <Section
            id="because-you-played"
            title={title}
            subtitle={subtitle}
            loading={loading}
            minHeight={420}
            actions={chips}
        >
            {picks.length === 0 && faces.length === 0 ? (
                <Empty>
                    {bundles.length > 1
                        ? `Nothing came back for ${active.seed.name} — try another artist above.`
                        : `Nothing came back for ${active?.seed?.name || "this artist"} just now. Worth another look later.`}
                </Empty>
            ) : (
                <div className="flex flex-col gap-4">
                    {picks.length > 0 && (
                        <Stagger className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5" gap={0.03}>
                            {picks.map((item, i) => (
                                // Keyed by seed as well: the same song turns up
                                // under two related artists, and a reused card
                                // would animate as if nothing had changed.
                                <StaggerItem key={`${activeKey}:${item.url || item.playQuery || i}`}>
                                                                            <Tile item={item} />
                                </StaggerItem>
                            ))}
                        </Stagger>
                    )}

                    {faces.length > 0 && (
                        <div className="border-t border-border pt-4">
                            <Rail itemClassName="w-[132px]">
                                {faces.map((artist, i) => (
                                    <Tile key={`${activeKey}:${artist.browseId || i}`} item={artist} />
                                ))}
                            </Rail>
                        </div>
                    )}
                </div>
            )}
        </Section>
    );
}
