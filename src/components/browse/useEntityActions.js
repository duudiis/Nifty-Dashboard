// Shared entity behaviours: queueing a whole album/playlist/artist, recording
// it in the user's recents, saving it to the library, and the external-link
// helpers. Used by the entity pages, the tiles' play button and the
// right-click entity menu, so they all act identically.

import { useCallback } from "react";

import { useNifty } from "../../context/NiftyContext.js";
import { parseEntityId } from "../../sources/ids.js";
import { externalUrl } from "../../sources/links.js";

/** The entity's public platform URL (for Open in browser / Copy link). */
export function entityExternalUrl(item, data = null) {
    if (data?.url) return data.url;
    if (item?.url && /^https?:/i.test(item.url)) return item.url;
    const parsed = parseEntityId(item?.browseId);
    return parsed ? externalUrl(parsed.source, parsed.kind, parsed.id) : null;
}

/** Fire-and-forget record of a whole-collection enqueue (feeds recents). */
export function recordCollectionQueued(item, data = null) {
    try {
        fetch("/api/recent", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
                browseId: item.browseId,
                kind: item.kind,
                title: data?.title || item.title,
                subtitle: data?.subtitle || item.subtitle || null,
                artwork: data?.artwork || item.artwork || null,
                url: entityExternalUrl(item, data)
            })
        }).catch(() => {});
    } catch { /* recents are best-effort */ }
}

export function useEntityActions() {
    const { play, notify } = useNifty();

    /**
     * Queues a whole entity ("now" | "next" | "queue"). Resolves it through
     * the server-cached browse layer to the collection's play URL (the bot
     * expands it in order); artists queue their top songs.
     */
    const playEntity = useCallback(async (item, mode, { silent = false, data: preloaded = null } = {}) => {
        const label = item.title ? `“${item.title}”` : `this ${item.kind}`;
        if (!silent) notify(`Loading ${label}…`);

        try {
            const data = preloaded
                || await fetch(`/api/browse?id=${encodeURIComponent(item.browseId)}`).then((r) => {
                    if (!r.ok) throw new Error(`browse ${r.status}`);
                    return r.json();
                });

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

            recordCollectionQueued(item, data);

            notify(
                mode === "now" ? `Now playing ${label}`
                : mode === "next" ? `Playing ${label} next`
                : `Added ${label} to the queue`
            );
        } catch {
            notify(`Couldn't load ${label}`);
        }
    }, [play, notify]);

    /** Saves / removes the entity in the user's library. Returns the new state. */
    const saveEntity = useCallback(async (item, save, data = null) => {
        const label = item.title ? `“${item.title}”` : `this ${item.kind}`;
        try {
            const res = await fetch("/api/library", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    action: save ? "save" : "unsave",
                    entity: {
                        browseId: item.browseId,
                        kind: item.kind,
                        title: data?.title || item.title,
                        subtitle: data?.subtitle || item.subtitle || null,
                        artwork: data?.artwork || item.artwork || null,
                        url: entityExternalUrl(item, data)
                    }
                })
            });
            if (!res.ok) throw new Error(`library ${res.status}`);
            notify(save ? `Saved ${label} to your library` : `Removed ${label} from your library`);
            return save;
        } catch {
            notify(`Couldn't update your library`);
            return !save;
        }
    }, [notify]);

    return { playEntity, saveEntity };
}
