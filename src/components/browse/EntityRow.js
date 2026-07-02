import { useNifty } from "../../context/NiftyContext.js";
import { artworkOrFallback } from "../../lib/format.js";
import Icon from "../Icon.js";
import { useContextMenu } from "../menu/ContextMenu.js";
import { useEntityMenu } from "../menu/entityMenu.js";

// List-mode row for an album/artist/playlist. Opens its page on click;
// right-click plays/queues the whole thing.
export default function EntityRow({ item }) {
    const { openEntity } = useNifty();
    const entityMenu = useEntityMenu();
    const { onContextMenu, active } = useContextMenu(() => entityMenu(item));
    const round = item.kind === "artist";

    return (
        <button
            onClick={() => openEntity(item.kind, item.browseId)}
            onContextMenu={onContextMenu}
            className={`group flex w-full items-center gap-3 rounded-md p-2 text-left transition hover:bg-elevated ${active ? "bg-elevated" : ""}`}
        >
            <img
                src={artworkOrFallback(item.artwork)}
                onError={(e) => (e.currentTarget.src = artworkOrFallback(null))}
                className={`h-11 w-11 shrink-0 object-cover ${round ? "rounded-full" : "rounded"}`}
                alt=""
            />
            <div className="flex min-w-0 flex-1 flex-col leading-tight">
                <span className="truncate text-[13px] text-maintext">{item.title}</span>
                <span className="truncate text-[11px] capitalize text-subtext">{item.subtitle || item.kind}</span>
            </div>
            <Icon name="chevron-down" className="h-4 w-4 -rotate-90 text-subtext opacity-0 transition group-hover:opacity-100" />
        </button>
    );
}
