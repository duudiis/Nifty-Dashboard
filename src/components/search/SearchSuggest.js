import { useEffect, useRef, useState } from "react";

import { useNifty } from "../../context/NiftyContext.js";
import { closeness } from "../../lib/fuzzy.js";
import { artworkOrFallback } from "../../lib/format.js";
import { useContextMenu } from "../menu/ContextMenu.js";
import { useTrackMenu } from "../menu/trackMenu.js";
import { useEntityMenu } from "../menu/entityMenu.js";
import { AnimatePresence, motion, EASE } from "../motion/index.js";

// The typeahead dropdown under the search bar: the closest matches to what's
// being typed, regardless of kind, ranked by fuzzy closeness (ties keep the
// section order, so Deezer songs still edge out everything else). It shares
// /api/search — and its server-side cache — with the full results page.
//
// Debouncing lives here: every keystroke swaps the list for a fresh skeleton
// immediately (stale results never linger), and the fetch fires once typing
// pauses.

const KIND_LABEL = { song: "Song", video: "Video", album: "Album", artist: "Artist", playlist: "Playlist" };
const MIN_SCORE = 0.35;
const MAX_ROWS = 8;
const DEBOUNCE_MS = 300;

function scoreItem(query, item) {
    const title = closeness(query, item.title);
    const artist = item.artist ? closeness(query, item.artist) : 0;
    const combo = item.artist ? closeness(query, `${item.artist} ${item.title}`) : 0;
    return Math.max(title, artist * 0.9, combo * 0.95);
}

function rank(query, sections) {
    const scored = [];
    for (const section of sections) {
        for (const item of section.items) {
            const score = scoreItem(query, item);
            if (score >= MIN_SCORE) scored.push({ item, score });
        }
    }
    scored.sort((a, b) => b.score - a.score); // stable: ties keep section order
    return scored.slice(0, MAX_ROWS).map((s) => s.item);
}

// Placeholder rows mirroring the real row layout (artwork + two text lines).
function SkeletonRows() {
    return Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="flex items-center gap-3 p-2">
            <div className="h-9 w-9 shrink-0 animate-pulse rounded bg-elevated" />
            <div className="flex flex-1 flex-col gap-1.5">
                <div className="h-2.5 animate-pulse rounded bg-elevated" style={{ width: `${55 - i * 7}%` }} />
                <div className="h-2 animate-pulse rounded bg-elevated" style={{ width: `${30 - i * 3}%` }} />
            </div>
        </div>
    ));
}

function Row({ item, onClose }) {
    const { play, selected, openEntity } = useNifty();
    const trackMenu = useTrackMenu();
    const entityMenu = useEntityMenu();
    const isTrack = item.kind === "song" || item.kind === "video";
    const { onContextMenu, active } = useContextMenu(() =>
        isTrack ? trackMenu(item, { source: "search" }) : entityMenu(item)
    );

    // Tracks queue straight from the dropdown; entities open their page.
    const onClick = () => {
        if (isTrack) {
            if (!selected) return;
            play(item.playQuery || item.url, "queue", item.title);
        } else {
            openEntity(item.kind, item.browseId);
        }
        onClose();
    };

    const round = item.kind === "artist";
    const detail = item.artist || item.subtitle || "";

    return (
        <button
            // Explicit type: the dropdown lives inside the search <form>, and a
            // default (submit) button would open the full search page on click.
            type="button"
            onClick={onClick}
            onContextMenu={onContextMenu}
            title={isTrack ? (selected ? "Add to queue" : "Select a server first") : `Open ${item.kind}`}
            className={`flex w-full items-center gap-3 rounded-lg p-2 text-left transition hover:bg-elevated ${active ? "bg-elevated" : ""}`}
        >
            <img
                src={artworkOrFallback(item.artwork)}
                onError={(e) => (e.currentTarget.src = artworkOrFallback(null))}
                className={`h-9 w-9 shrink-0 object-cover ${round ? "rounded-full" : "rounded"}`}
                alt=""
            />
            <div className="flex min-w-0 flex-1 flex-col leading-tight">
                <span className="truncate text-[13px] text-maintext">{item.title}</span>
                <span className="truncate text-[11px] text-subtext">
                    {KIND_LABEL[item.kind] || item.kind}
                    {detail ? ` · ${detail}` : ""}
                </span>
            </div>
            {item.duration && <span className="shrink-0 pr-2 text-[11px] text-subtext">{item.duration}</span>}
        </button>
    );
}

export default function SearchSuggest({ query, open, onClose }) {
    const q = query.trim();
    const [state, setState] = useState({ items: [], loading: false });
    const seqRef = useRef(0);
    const debounceRef = useRef(null);

    useEffect(() => {
        clearTimeout(debounceRef.current);
        if (q.length < 2) {
            setState({ items: [], loading: false });
            return;
        }
        // Fresh skeleton right away — never linger on the previous results.
        setState({ items: [], loading: true });
        const seq = ++seqRef.current;
        debounceRef.current = setTimeout(() => {
            fetch(`/api/search?query=${encodeURIComponent(q)}`)
                .then((r) => r.json())
                .then((json) => {
                    if (seqRef.current !== seq) return;
                    setState({ items: rank(q, json.sections || []), loading: false });
                })
                .catch(() => {
                    if (seqRef.current === seq) setState({ items: [], loading: false });
                });
        }, DEBOUNCE_MS);
        return () => clearTimeout(debounceRef.current);
    }, [q]);

    const visible = open && q.length >= 2 && (state.items.length > 0 || state.loading);

    return (
        <AnimatePresence>
            {visible && (
                <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    transition={{ duration: 0.15, ease: EASE }}
                    className="absolute left-0 right-0 top-full z-[60] mt-2 overflow-hidden rounded-xl border border-border bg-surface/95 p-1.5 shadow-2xl backdrop-blur-md"
                >
                    {state.loading ? (
                        <SkeletonRows />
                    ) : (
                        <>
                            {state.items.map((item) => (
                                <Row
                                    key={`${item.kind}:${item.videoId || item.browseId || item.url || item.title}`}
                                    item={item}
                                    onClose={onClose}
                                />
                            ))}
                            <div className="px-3 pb-1 pt-1.5 text-[10px] text-subtext/70">
                                Press Enter for all results
                            </div>
                        </>
                    )}
                </motion.div>
            )}
        </AnimatePresence>
    );
}
