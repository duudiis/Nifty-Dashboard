// Builds the right-click menu for an album / artist / playlist, wherever it
// appears (search rows, tiles, the search-suggestion dropdown).
//
// Queueing goes through the shared entity actions (server-cached browse ->
// whole-collection play URL that the bot expands; artists queue their top
// songs), which also record the collection in the user's recents.

import { useCallback } from "react";

import { useNifty } from "../../context/NiftyContext.js";
import { useEntityActions, entityExternalUrl } from "../browse/useEntityActions.js";

export function useEntityMenu() {
    const { selected, notify, openEntity } = useNifty();
    const { playEntity, saveEntity } = useEntityActions();

    return useCallback(
        (item) => {
            if (!item?.browseId || !item?.kind) return [];

            const externalLink = entityExternalUrl(item);

            const copyLink = async () => {
                if (!externalLink) return;
                try {
                    await navigator.clipboard.writeText(externalLink);
                    notify("Copied link to clipboard");
                } catch {
                    notify("Couldn't copy the link");
                }
            };

            return [
                { label: "Play now", icon: "play-now", onClick: () => playEntity(item, "now"), disabled: !selected },
                { label: "Play next", icon: "play-next", onClick: () => playEntity(item, "next"), disabled: !selected },
                { label: "Add to queue", icon: "enqueue", onClick: () => playEntity(item, "queue"), disabled: !selected },
                { separator: true },
                { label: "Save to library", icon: "heart", onClick: () => saveEntity(item, true) },
                { label: `Go to ${item.kind}`, icon: "open", onClick: () => openEntity(item.kind, item.browseId) },
                ...(externalLink
                    ? [
                        { separator: true },
                        {
                            label: "Open in browser",
                            icon: "open",
                            onClick: () => window.open(externalLink, "_blank", "noopener,noreferrer")
                        },
                        { label: "Copy link", icon: "link", onClick: copyLink }
                    ]
                    : [])
            ];
        },
        [selected, notify, openEntity, playEntity, saveEntity]
    );
}
