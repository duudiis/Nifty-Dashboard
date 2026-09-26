// Shared entity behaviours: queueing a whole album/playlist/artist, recording
// it in the user's recents, saving it to the library, and the external-link
// helpers. Used by the entity pages, the tiles' play button and the
// right-click entity menu, so they all act identically.

import { useCallback } from "react";

import { useNifty } from "../../context/NiftyContext.js";
import { useModal } from "../modal/Modal.js";
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

/**
 * Queues a list of tracks in one go.
 *
 * The queue on a Discord bot is SHARED — dropping thirty tracks into a room
 * that is mid-session is a rude thing to do silently, and the only way back is
 * removing them one at a time. So a bulk add into a live room asks first, and
 * the count always travels with the action: callers put it in the button label
 * ("Queue 12 tracks", never "Shuffle all") and get one toast at the end rather
 * than one per track.
 *
 * Lives here rather than in NiftyContext because the modal provider is mounted
 * inside NiftyProvider, so the context itself cannot open a confirmation.
 */
export function useBulkQueue() {
    const { play, notify, selected, queue } = useNifty();
    const modal = useModal();

    return useCallback(async (tracks, { label = null, confirmFrom = 5 } = {}) => {
        const list = (tracks || []).filter((t) => t?.playQuery || t?.url);
        if (!selected?.guildId || !list.length) return false;

        const queued = queue?.tracks?.length || 0;
        if (list.length >= confirmFrom && queued > 0) {
            const ok = await modal.confirm({
                title: `Add ${list.length} tracks?`,
                message: `${selected.guildName || "This server"} already has ${queued} track${queued === 1 ? "" : "s"} queued. These go on the end.`,
                confirmLabel: `Add ${list.length}`
            });
            if (!ok) return false;
        }

        list.forEach((t) => play(t.playQuery || t.url));
        notify(label ? `Added ${label} to the queue` : `Added ${list.length} tracks to the queue`);
        return true;
    }, [play, notify, selected, queue, modal]);
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

    return { playEntity };
}
