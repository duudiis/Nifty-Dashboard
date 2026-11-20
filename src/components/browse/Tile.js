import { useState } from "react";

import { useNifty } from "../../context/NiftyContext.js";
import { artworkOrFallback } from "../../lib/format.js";
import { useContextMenu } from "../menu/ContextMenu.js";
import { useTrackMenu } from "../menu/trackMenu.js";
import { useEntityMenu } from "../menu/entityMenu.js";
import { useEntityActions } from "./useEntityActions.js";
import QueueGlyph from "./QueueGlyph.js";
import Icon from "../Icon.js";
import { MUSIC_CARD_BODY_CLASS } from "../skeletonLayout.js";

// A grid card for any search item. Songs/videos queue on click (the queue icon
// flips to a check on add); albums/artists/playlists open their page. Albums
// and playlists also get an inline play button that queues the whole collection
// without leaving the grid. Artists are round.
export default function Tile({ item }) {
    const { play, selected, openEntity } = useNifty();
    const { playEntity } = useEntityActions();
    const trackMenu = useTrackMenu();
    const entityMenu = useEntityMenu();
    const playable = item.kind === "song" || item.kind === "video";
    const collection = item.kind === "album" || item.kind === "playlist";
    const [done, setDone] = useState(false);

    const round = item.kind === "artist";
    const subtitle = item.artist || item.subtitle || item.kind;

    const queue = () => {
        if (!selected || done) return;
        play(item.playQuery || item.url, "queue", item.title);
        setDone(true);
        setTimeout(() => setDone(false), 1000);
    };

    // Inline play on album/playlist tiles: play the whole collection now,
    // without opening its page first.
    const playCollection = (e) => {
        e.stopPropagation();
        if (!selected) return;
        playEntity(item, "now");
    };

    // "Add to queue" in the menu runs the same animated add as a plain click.
    const { onContextMenu, active } = useContextMenu(() =>
        playable ? trackMenu(item, { source: "search", onAdd: queue }) : entityMenu(item)
    );
    const onClick = () => (playable ? queue() : openEntity(item.kind, item.browseId));

    return (
        <button
            onClick={onClick}
            onContextMenu={onContextMenu}
            className={`group ${MUSIC_CARD_BODY_CLASS} rounded-lg text-left transition hover:bg-elevated ${active ? "bg-elevated" : ""}`}
        >
            <div className="relative w-full">
                <img
                    src={artworkOrFallback(item.artwork)}
                    onError={(e) => (e.currentTarget.src = artworkOrFallback(null))}
                    className={`aspect-square w-full object-cover shadow-lg ${round ? "rounded-full" : "rounded-md"}`}
                    alt=""
                    loading="lazy"
                    decoding="async"
                />
            </div>
            <div className="flex w-full min-w-0 items-center gap-2">
                <div className="min-w-0 flex-1">
                    <div className={`truncate text-sm font-bold text-maintext ${round ? "text-center" : ""}`}>{item.title}</div>
                    <div className={`truncate text-xs capitalize text-subtext ${round ? "text-center" : ""}`}>{subtitle}</div>
                </div>
                {playable && (
                    <span className={`flex h-6 w-5 shrink-0 items-center justify-center text-accent transition-opacity ${done ? "opacity-100" : "opacity-0 group-hover:opacity-100 group-focus-visible:opacity-100"}`}>
                        <QueueGlyph done={done} className="h-4 w-4" />
                    </span>
                )}
                {collection && (
                    <span
                        title={selected ? `Play this ${item.kind}` : "Select a server first"}
                        onClick={playCollection}
                        className="flex h-6 w-5 shrink-0 items-center justify-center text-accent opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100"
                    >
                        <Icon name="play" className="h-4 w-4" />
                    </span>
                )}
            </div>
        </button>
    );
}
