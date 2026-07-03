// Builds the right-click menu for an album / artist / playlist, wherever it
// appears (search rows, tiles, the suggestion dropdown, the library shelf).
//
// Queueing goes through the shared entity actions (server-cached browse ->
// whole-collection play URL that the bot expands; artists queue their top
// songs), which also record the collection in the user's recents. Library
// items are state-aware: Save flips to Remove when already saved, and
// "Add to playlist" resolves the collection's tracks into one of yours.

import { useCallback } from "react";

import { useNifty } from "../../context/NiftyContext.js";
import { useModal } from "../modal/Modal.js";
import { useEntityActions, entityExternalUrl } from "../browse/useEntityActions.js";

export function useEntityMenu() {
    const { selected, notify, openEntity, library, isSaved, toggleSaveEntity, addToPlaylist, createPlaylist, removePlaylist } = useNifty();
    const { playEntity } = useEntityActions();
    const modal = useModal();

    return useCallback(
        (item) => {
            if (!item?.browseId || !item?.kind) return [];

            const externalLink = entityExternalUrl(item);
            const saved = isSaved(item.browseId);
            const label = item.title ? `“${item.title}”` : `this ${item.kind}`;

            const copyExternal = async () => {
                if (!externalLink) return;
                try {
                    await navigator.clipboard.writeText(externalLink);
                    notify("Copied link to clipboard");
                } catch {
                    notify("Couldn't copy the link");
                }
            };

            // Resolves the collection's tracks, then appends them to a playlist.
            const addAllTo = async (playlist) => {
                notify(`Loading ${label}…`);
                try {
                    const res = await fetch(`/api/browse?id=${encodeURIComponent(item.browseId)}`);
                    if (!res.ok) throw new Error();
                    const data = await res.json();
                    const tracks = data.tracks?.length ? data.tracks : data.topSongs || [];
                    if (!tracks.length) return notify(`Couldn't load ${label}`);
                    addToPlaylist(playlist, tracks, label);
                } catch {
                    notify(`Couldn't load ${label}`);
                }
            };

            const playlistChildren = [
                {
                    label: "New playlist…",
                    icon: "enqueue",
                    onClick: async () => {
                        const name = window.prompt("Name your new playlist:", item.title || "My playlist");
                        if (!name?.trim()) return;
                        const playlist = await createPlaylist(name.trim());
                        if (playlist) addAllTo(playlist);
                    }
                },
                ...library.playlists.map((playlist) => ({
                    label: playlist.name,
                    onClick: () => addAllTo(playlist)
                }))
            ];

            return [
                { label: "Play now", icon: "play-now", onClick: () => playEntity(item, "now"), disabled: !selected },
                { label: "Play next", icon: "play-next", onClick: () => playEntity(item, "next"), disabled: !selected },
                { label: "Add to queue", icon: "enqueue", onClick: () => playEntity(item, "queue"), disabled: !selected },
                { separator: true },
                // Your own playlists live on your shelf already — no Save for them.
                ...(item.custom ? [] : [{
                    label: saved ? "Remove from library" : "Save to library",
                    icon: saved ? "heart-filled" : "heart",
                    onClick: () => toggleSaveEntity(item)
                }]),
                { label: "Add to playlist", icon: "library", children: playlistChildren },
                { label: `Go to ${item.kind}`, icon: "open", onClick: () => openEntity(item.kind, item.browseId) },
                ...(externalLink
                    ? [
                        { separator: true },
                        {
                            label: "Open in browser",
                            icon: "open",
                            onClick: () => window.open(externalLink, "_blank", "noopener,noreferrer")
                        },
                        { label: "Copy link", icon: "link", onClick: copyExternal }
                    ]
                    : []),
                // Your own playlists can be deleted (Liked songs cannot).
                ...(item.custom && !item.liked && !item.browseId.endsWith(":liked")
                    ? [
                        { separator: true },
                        {
                            label: "Delete playlist",
                            icon: "trash",
                            danger: true,
                            onClick: async () => {
                                const sure = await modal.confirm({
                                    title: "Delete playlist?",
                                    message: `“${item.title}” and everything in it will be gone for good.`,
                                    confirmLabel: "Delete",
                                    danger: true
                                });
                                if (sure) removePlaylist(item);
                            }
                        }
                    ]
                    : [])
            ];
        },
        [selected, notify, openEntity, playEntity, library.playlists, library.savedRefs,
         isSaved, toggleSaveEntity, addToPlaylist, createPlaylist, removePlaylist, modal]
    );
}
