// Builds the right-click menu for a track, wherever it appears.
//
// `useTrackMenu()` returns a factory: pass a track plus its source and get a
// menu-item list ready for <... onContextMenu={useContextMenu(items)}>.
//
//   source "search"  → not yet in the queue (search result / browse row):
//                      Play now / Play next / Add to queue.
//   source "queue"   → an existing queue entry, addressed by track_id.
//   source "player"  → the live player track — i.e. the current queue entry,
//                      addressed by the queue cursor.
//
// "queue" and "player" share one menu: both are queue entries, so the player
// bar and Now-playing panel get the full set of player controls too. The
// current entry shows Pause/Resume + Skip; any other entry shows Play now /
// Play next. Open / Copy link are client-side and always available with a URL.

import { useCallback } from "react";

import { useNifty } from "../../context/NiftyContext.js";

function openLink(url) {
    if (url) window.open(url, "_blank", "noopener,noreferrer");
}

// Copies `url` to the clipboard; returns true on success so the caller can toast.
async function copyLink(url) {
    if (!url) return false;
    try {
        await navigator.clipboard.writeText(url);
        return true;
    } catch {
        // Clipboard API needs a secure context / permission — fall back silently.
        const ta = document.createElement("textarea");
        ta.value = url;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        let ok = false;
        try { ok = document.execCommand("copy"); } catch {}
        document.body.removeChild(ta);
        return ok;
    }
}

export function useTrackMenu() {
    const { selected, queue, player, play, playNow, playNextTrack, moveToLast, removeTrack, control, notify } = useNifty();

    return useCallback(
        (track, { source, onAdd } = {}) => {
            if (!track) return [];

            const url = track.url || track.songUrl || null;
            // What we actually queue (may be a ytmsearch: for video-only entries);
            // url stays the real link for Open / Copy.
            const queueRef = track.playQuery || url;
            const title = track.title;
            const label = title ? `“${title}”` : "track";

            const linkItems = [
                { separator: true },
                { label: "Open in browser", icon: "open", onClick: () => openLink(url), disabled: !url },
                {
                    label: "Copy link",
                    icon: "link",
                    onClick: async () => { if (await copyLink(url)) notify("Copied link to clipboard"); },
                    disabled: !url
                }
            ];

            // Queue entries and the live player track share one menu: the player
            // track is just the current queue entry, addressed by the cursor.
            if (source === "queue" || source === "player") {
                const id = source === "player" ? queue.position : track.track_id;
                const isCurrent = id === queue.position && !!player?.track;
                const playing = isCurrent && player?.playing;

                const head = isCurrent
                    ? [
                        {
                            label: playing ? "Pause" : "Resume",
                            icon: playing ? "pause" : "play-now",
                            onClick: () => control("togglePause"),
                            disabled: !selected
                        },
                        {
                            label: "Skip",
                            icon: "next",
                            onClick: () => { control("skip"); notify(`Skipped ${label}`); },
                            disabled: !selected
                        }
                    ]
                    : [
                        {
                            label: "Play now",
                            icon: "play-now",
                            onClick: () => { playNow(id); notify(`Now playing ${label}`); },
                            disabled: !selected
                        },
                        {
                            label: "Play next",
                            icon: "play-next",
                            onClick: () => { playNextTrack(id); notify(`Playing ${label} next`); },
                            disabled: !selected
                        }
                    ];

                return [
                    ...head,
                    {
                        label: "Move to last",
                        icon: "move-bottom",
                        onClick: () => { moveToLast(id); notify(`Moved ${label} to the end of the queue`); },
                        disabled: !selected
                    },
                    ...linkItems,
                    { separator: true },
                    {
                        label: "Remove",
                        icon: "trash",
                        danger: true,
                        onClick: () => { removeTrack(id); notify(`Removed ${label} from the queue`); },
                        disabled: !selected
                    }
                ];
            }

            // search results / browse rows (not yet in the queue)
            return [
                { label: "Play now", icon: "play-now", onClick: () => play(queueRef, "now", title), disabled: !selected },
                { label: "Play next", icon: "play-next", onClick: () => play(queueRef, "next", title), disabled: !selected },
                {
                    label: "Add to queue",
                    icon: "enqueue",
                    // Defer to the row's own add handler when given, so the cover's
                    // check animation plays exactly as a normal click would.
                    onClick: () => (onAdd ? onAdd() : play(queueRef, "queue", title)),
                    disabled: !selected
                },
                ...linkItems
            ];
        },
        [selected, queue.position, player?.track, player?.playing, play, playNow, playNextTrack, moveToLast, removeTrack, control, notify]
    );
}
