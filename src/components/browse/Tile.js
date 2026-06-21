import { useNifty } from "../../context/NiftyContext.js";
import { artworkOrFallback, onArtworkError } from "../../lib/format.js";
import Icon from "../Icon.js";
import { useContextMenu } from "../menu/ContextMenu.js";
import { useTrackMenu } from "../menu/trackMenu.js";

// A grid card for any search item. Songs/videos queue on click (with a hover
// play overlay); albums/artists/playlists open their page. Artists are round.
export default function Tile({ item }) {
    const { play, selected, openEntity } = useNifty();
    const trackMenu = useTrackMenu();
    const playable = item.kind === "song" || item.kind === "video";
    const { onContextMenu, active } = useContextMenu(() =>
        playable ? trackMenu(item, { source: "search" }) : []
    );

    const round = item.kind === "artist";
    const subtitle = item.artist || item.subtitle || item.kind;

    const onClick = () => (playable ? selected && play(item.playQuery || item.url) : openEntity(item.kind, item.browseId));

    return (
        <button
            onClick={onClick}
            onContextMenu={onContextMenu}
            className={`group flex w-full flex-col gap-3 rounded-lg p-3 text-left transition hover:bg-elevated ${active ? "bg-elevated" : ""}`}
        >
            <div className="relative w-full">
                <img
                    src={artworkOrFallback(item.artwork)}
                    onError={onArtworkError}
                    className={`aspect-square w-full object-cover shadow-lg ${round ? "rounded-full" : "rounded-md"}`}
                    alt=""
                />
                {playable && (
                    <span className="absolute bottom-2 right-2 flex h-10 w-10 translate-y-2 items-center justify-center rounded-full bg-accent text-canvas opacity-0 shadow-lg transition group-hover:translate-y-0 group-hover:opacity-100">
                        <Icon name="play" className="h-5 w-5" />
                    </span>
                )}
            </div>
            <div className="min-w-0">
                <div className={`truncate text-sm font-bold text-maintext ${round ? "text-center" : ""}`}>{item.title}</div>
                <div className={`truncate text-xs capitalize text-subtext ${round ? "text-center" : ""}`}>{subtitle}</div>
            </div>
        </button>
    );
}
