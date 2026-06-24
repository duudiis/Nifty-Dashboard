import { useState } from "react";

import { useNifty } from "../../context/NiftyContext.js";
import { artworkOrFallback } from "../../lib/format.js";
import { useContextMenu } from "../menu/ContextMenu.js";
import { useTrackMenu } from "../menu/trackMenu.js";
import QueueGlyph from "./QueueGlyph.js";

// A playable song/video row (search results, album/playlist/artist track lists).
// Click anywhere on the row to add it to the queue; right-click for the full
// play/queue menu. The cover icon flips to a check for a second on add.
export default function TrackRow({ track, index }) {
    const { play, selected } = useNifty();
    const trackMenu = useTrackMenu();
    const [done, setDone] = useState(false);

    const queue = () => {
        if (!selected || done) return;
        play(track.playQuery || track.url, "queue", track.title);
        setDone(true);
        setTimeout(() => setDone(false), 1000);
    };

    // "Add to queue" in the menu runs the same animated add as a plain click.
    const { onContextMenu, active } = useContextMenu(() => trackMenu(track, { source: "search", onAdd: queue }));

    return (
        <div
            onClick={queue}
            onContextMenu={onContextMenu}
            title={selected ? "Add to queue" : "Select a server first"}
            className={`group flex items-center gap-3 rounded-md p-2 transition hover:bg-elevated ${selected ? "cursor-pointer" : ""} ${active ? "bg-elevated" : ""}`}
        >
            {index != null && (
                <span className="hidden w-5 shrink-0 text-center text-xs text-subtext sm:block">{index}</span>
            )}

            <div className="relative h-11 w-11 shrink-0">
                <img
                    src={artworkOrFallback(track.artwork)}
                    onError={(e) => (e.currentTarget.src = artworkOrFallback(null))}
                    className="h-11 w-11 rounded object-cover"
                    alt=""
                />
                <span
                    className={`absolute inset-0 flex items-center justify-center rounded bg-black/50 text-white transition ${done ? "opacity-100" : "opacity-0 group-hover:opacity-100"}`}
                >
                    <QueueGlyph done={done} className="h-5 w-5" />
                </span>
            </div>

            <div className="flex min-w-0 flex-1 flex-col leading-tight">
                <span className="truncate text-[13px] text-maintext">{track.title}</span>
                <span className="truncate text-[11px] text-subtext">{track.artist}</span>
            </div>

            {track.duration && (
                <span className="w-12 shrink-0 text-center text-[11px] text-subtext">{track.duration}</span>
            )}
        </div>
    );
}
