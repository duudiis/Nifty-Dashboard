import { useNifty } from "../../../context/NiftyContext.js";
import Tile from "../../browse/Tile.js";
import Icon from "../../Icon.js";
import Rail from "../Rail.js";
import Section, { Empty } from "../Section.js";

// The shelf is a real page served by /api/browse under this synthetic id — the
// same one the sidebar and the quick picks open.
const LIKED_ID = "nifty:playlist:liked";

/**
 * The library as covers, so the shelf reads the same way here as everywhere
 * else on the page. It draws straight from context: the library is already
 * loaded and kept current there, and a second fetch would only add a second
 * thing to be stale.
 *
 * Liked songs is pinned first and never scrolls away — it is the one shelf
 * every account has, and it has no artwork of its own, so it is drawn rather
 * than tiled. There is no "See all" beside the heading on purpose: the library
 * has no page of its own, and pointing this at search would send people
 * somewhere that does not hold what they clicked for.
 */
export default function LibraryRail() {
    const { library, openEntity, createPlaylist } = useNifty();

    const items = library?.items || [];
    const likedCount = (library?.likedUrls || []).length;
    const loaded = Boolean(library?.loaded);

    // One flat array: Rail wraps each child in its own snap column, and a
    // nested array would land in a single 168px slot.
    const cards = [
        <button
            key="liked"
            onClick={() => openEntity("playlist", LIKED_ID)}
            title="Open Liked songs"
            className="group flex w-full flex-col gap-3 rounded-lg p-3 text-left transition hover:bg-elevated"
        >
            <div className="flex aspect-square w-full items-center justify-center rounded-md bg-gradient-to-br from-accent to-accent/40 text-canvas shadow-lg">
                <Icon name="heart-filled" className="h-10 w-10" />
            </div>
            <div className="min-w-0">
                <div className="truncate text-sm font-bold text-maintext">Liked songs</div>
                <div className="truncate text-xs text-subtext">
                    {likedCount} song{likedCount === 1 ? "" : "s"}
                </div>
            </div>
        </button>,
        ...items.map((item, i) => <Tile key={item.itemId || item.browseId || i} item={item} />)
    ];

    return (
        <Section id="your-library" title="In your library" loading={!loaded} minHeight={260}>
            {loaded && items.length === 0 ? (
                <Empty
                    action={
                        <button
                            onClick={() => createPlaylist("My playlist")}
                            className="flex items-center gap-1.5 rounded-full bg-elevated px-4 py-2 text-xs font-bold text-maintext transition hover:bg-surface"
                        >
                            <Icon name="library" className="h-3.5 w-3.5" />
                            New playlist
                        </button>
                    }
                >
                    Save an album or make a playlist and it lives here.
                </Empty>
            ) : (
                <Rail itemClassName="w-[168px]">{cards}</Rail>
            )}
        </Section>
    );
}
