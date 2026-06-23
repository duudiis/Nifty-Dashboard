// Builds the right-click menu for a track, wherever it appears.
//
// `useTrackMenu()` returns a factory: pass a track plus its source and get a
// menu-item list ready for <... onContextMenu={useContextMenu(items)}>.
//
//   source "search"  → query/URL based (Play now / next / add to queue)
//   source "queue"   → existing queue entry (jump / move / remove)
//   source "player"  → the currently playing track (share/open only)
//
// Share / Open / Copy link are client-side and always available when the track
// has a resolvable URL.

import { useCallback } from "react";

import { useNifty } from "../../context/NiftyContext.js";

function openLink(url) {
    if (url) window.open(url, "_blank", "noopener,noreferrer");
}

async function copyLink(url) {
    if (!url) return;
    try {
        await navigator.clipboard.writeText(url);
    } catch {
        // Clipboard API needs a secure context / permission — fall back silently.
        const ta = document.createElement("textarea");
        ta.value = url;
        ta.style.position = "fixed";
        ta.style.opacity = "0";
        document.body.appendChild(ta);
        ta.select();
        try { document.execCommand("copy"); } catch {}
        document.body.removeChild(ta);
    }
}

async function shareLink(url, title) {
    if (!url) return;
    if (navigator.share) {
        try { await navigator.share({ title: title || "Nifty", url }); return; } catch { return; }
    }
    copyLink(url);
}

export function useTrackMenu() {
    const { selected, play, jump, playNextTrack, moveToTop, removeTrack } = useNifty();

    return useCallback(
        (track, { source }) => {
            if (!track) return [];

            const url = track.url || track.songUrl || null;
            // What we actually queue (may be a ytmsearch: for video-only entries);
            // url stays the real link for Share / Open / Copy.
            const queueRef = track.playQuery || url;
            const title = track.title;
            const linkItems = [
                { separator: true },
                { label: "Share", icon: "share", onClick: () => shareLink(url, title), disabled: !url },
                { label: "Open in browser", icon: "open", onClick: () => openLink(url), disabled: !url },
                { label: "Copy link", icon: "link", onClick: () => copyLink(url), disabled: !url }
            ];

            if (source === "queue") {
                const id = track.track_id;
                return [
                    { label: "Play now", icon: "play-now", onClick: () => jump(id), disabled: !selected },
                    { label: "Play next", icon: "play-next", onClick: () => playNextTrack(id), disabled: !selected },
                    { label: "Move to top", icon: "move-top", onClick: () => moveToTop(id), disabled: !selected },
                    ...linkItems,
                    { separator: true },
                    { label: "Remove from queue", icon: "trash", danger: true, onClick: () => removeTrack(id), disabled: !selected }
                ];
            }

            if (source === "player") {
                return linkItems.slice(1); // drop the leading separator
            }

            // search results
            return [
                { label: "Play now", icon: "play-now", onClick: () => play(queueRef, "now", title), disabled: !selected },
                { label: "Play next", icon: "play-next", onClick: () => play(queueRef, "next", title), disabled: !selected },
                { label: "Add to queue", icon: "enqueue", onClick: () => play(queueRef, "queue", title), disabled: !selected },
                ...linkItems
            ];
        },
        [selected, play, jump, playNextTrack, moveToTop, removeTrack]
    );
}
