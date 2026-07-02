// Builds the right-click menu for an album / artist / playlist, wherever it
// appears (search rows, tiles, the search-suggestion dropdown).
//
// Play now / Play next / Add to queue resolve the entity through /api/browse
// (server-cached) to the same whole-collection play URL the collection pages
// use, then hand it to the bot with the chosen mode. Artists have no single
// URL, so their top songs are queued individually — reversed for "next", since
// each insert lands right after the current track.

import { useCallback } from "react";

import { useNifty } from "../../context/NiftyContext.js";

export function useEntityMenu() {
    const { selected, play, notify, openEntity } = useNifty();

    return useCallback(
        (item) => {
            if (!item?.browseId || !item?.kind) return [];
            const label = item.title ? `“${item.title}”` : `this ${item.kind}`;

            const resolveAndPlay = async (mode) => {
                notify(`Loading ${label}…`);
                try {
                    const res = await fetch(`/api/browse?id=${encodeURIComponent(item.browseId)}`);
                    if (!res.ok) throw new Error(`browse ${res.status}`);
                    const data = await res.json();
                    const tracks = data.tracks?.length ? data.tracks : data.topSongs || [];

                    if (data.playUrl) {
                        // One request; the bot expands the collection in order.
                        play(data.playUrl, mode);
                    } else if (!tracks.length) {
                        return notify(`Couldn't load ${label}`);
                    } else if (mode === "next") {
                        [...tracks].reverse().forEach((t) => play(t.playQuery || t.url, "next"));
                    } else {
                        tracks.forEach((t, i) => play(t.playQuery || t.url, mode === "now" && i === 0 ? "now" : "queue"));
                    }

                    notify(
                        mode === "now" ? `Now playing ${label}`
                        : mode === "next" ? `Playing ${label} next`
                        : `Added ${label} to the queue`
                    );
                } catch {
                    notify(`Couldn't load ${label}`);
                }
            };

            return [
                { label: "Play now", icon: "play-now", onClick: () => resolveAndPlay("now"), disabled: !selected },
                { label: "Play next", icon: "play-next", onClick: () => resolveAndPlay("next"), disabled: !selected },
                { label: "Add to queue", icon: "enqueue", onClick: () => resolveAndPlay("queue"), disabled: !selected },
                { separator: true },
                { label: `Go to ${item.kind}`, icon: "open", onClick: () => openEntity(item.kind, item.browseId) }
            ];
        },
        [selected, play, notify, openEntity]
    );
}
