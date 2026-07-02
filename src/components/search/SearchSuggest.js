import { useEffect, useRef, useState } from "react";

import { useNifty } from "../../context/NiftyContext.js";
import { parseLink } from "../../sources/links.js";
import { closeness } from "../../lib/fuzzy.js";
import { artworkOrFallback } from "../../lib/format.js";
import { useContextMenu } from "../menu/ContextMenu.js";
import { useTrackMenu } from "../menu/trackMenu.js";
import { useEntityMenu } from "../menu/entityMenu.js";
import { AnimatePresence, motion, EASE } from "../motion/index.js";

// The typeahead dropdown under the search bar. Three modes:
//   search — the closest matches to what's being typed, ranked by fuzzy
//            closeness (shares /api/search and its cache with the results page)
//   link   — a platform URL was pasted: the dropdown shows exactly that one
//            resolved item; Enter (or click) opens its page / queues the track
//   recent — the box is focused but empty: the user's recently queued tracks
//            and collections, straight from the database
//
// Debouncing lives here: every keystroke swaps the list for a fresh skeleton
// immediately (stale results never linger), and the fetch fires once typing
// pauses.

const KIND_LABEL = { song: "Song", video: "Video", album: "Album", artist: "Artist", playlist: "Playlist" };
const MIN_SCORE = 0.35;
const MAX_ROWS = 8;
const DEBOUNCE_MS = 300;
const VIDEO_SLOTS = 2;       // rows reserved for well-matching videos
const VIDEO_MIN_SCORE = 0.5; // the "matches well" bar for those slots

function scoreItem(query, item) {
    const title = closeness(query, item.title);
    const artist = item.artist ? closeness(query, item.artist) : 0;
    const combo = item.artist ? closeness(query, `${item.artist} ${item.title}`) : 0;
    return Math.max(title, artist * 0.9, combo * 0.95);
}

// The same song shows up once per release on Deezer (album, single,
// compilation…) — one suggestion row per title+artist+kind is plenty.
const dedupeKey = (item) =>
    `${item.kind}|${(item.title || "").toLowerCase().trim()}|${(item.artist || item.subtitle || "").toLowerCase().trim()}`;

function rank(query, sections) {
    const scored = [];
    const seen = new Set();
    for (const section of sections) {
        for (const item of section.items) {
            const score = scoreItem(query, item);
            if (score < MIN_SCORE) continue;
            const key = dedupeKey(item);
            if (seen.has(key)) continue;
            seen.add(key);
            scored.push({ item, score });
        }
    }
    scored.sort((a, b) => b.score - a.score); // stable: ties keep section order

    const top = scored.slice(0, MAX_ROWS);

    // Songs of a popular query score a hair above their music videos, which
    // would sweep every video out of the list — so reserve a couple of rows
    // for videos that still match well ("the official video of X" should
    // always be within reach).
    const isVideo = (e) => e.item.kind === "video";
    const missing = VIDEO_SLOTS - top.filter(isVideo).length;
    if (missing > 0) {
        const extras = scored
            .slice(MAX_ROWS)
            .filter((e) => isVideo(e) && e.score >= VIDEO_MIN_SCORE)
            .slice(0, missing);
        for (const extra of extras) {
            if (top.length >= MAX_ROWS) {
                // Swap out the lowest-ranked non-video row.
                for (let i = top.length - 1; i >= 0; i--) {
                    if (!isVideo(top[i])) {
                        top.splice(i, 1);
                        break;
                    }
                }
            }
            top.push(extra);
        }
        top.sort((a, b) => b.score - a.score);
    }

    return top.map((e) => e.item);
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

function Row({ item, onPick }) {
    const { play, selected, openEntity } = useNifty();
    const trackMenu = useTrackMenu();
    const entityMenu = useEntityMenu();
    const isTrack = item.kind === "song" || item.kind === "video";
    const { onContextMenu, active } = useContextMenu(() =>
        isTrack ? trackMenu(item, { source: "search" }) : entityMenu(item)
    );

    // Tracks queue straight from the dropdown; entities open their page.
    // Either way the pick closes the dropdown and clears the search box.
    const onClick = () => {
        if (isTrack) {
            if (!selected) return;
            play(item.playQuery || item.url, "queue", item.title);
        } else {
            openEntity(item.kind, item.browseId);
        }
        onPick();
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

export default function SearchSuggest({ query, open, onClose, onPick }) {
    const q = query.trim();
    const link = parseLink(q);
    const mode = link ? "link" : q ? "search" : "recent";
    const [state, setState] = useState({ items: [], loading: false });
    const seqRef = useRef(0);
    const debounceRef = useRef(null);
    // Measured height of the panel's content, so the box can grow/shrink
    // smoothly when the skeleton swaps for results (or the row count changes).
    const innerRef = useRef(null);
    const [panelH, setPanelH] = useState(null);

    useEffect(() => {
        clearTimeout(debounceRef.current);
        const seq = ++seqRef.current;
        const apply = (items) => seqRef.current === seq && setState({ items, loading: false });
        const fail = () => seqRef.current === seq && setState({ items: [], loading: false });

        // A pasted platform link resolves to exactly one item — no ranking.
        if (link) {
            setState({ items: [], loading: true });
            fetch(`/api/resolve?url=${encodeURIComponent(q)}`)
                .then((r) => r.json())
                .then((json) => apply(json.item ? [json.item] : []))
                .catch(fail);
            return;
        }

        // Empty but focused: the user's recently queued items.
        if (!q) {
            if (!open) {
                setState({ items: [], loading: false });
                return;
            }
            setState({ items: [], loading: true });
            fetch("/api/recent")
                .then((r) => r.json())
                .then((json) => apply((json.items || []).slice(0, MAX_ROWS)))
                .catch(fail);
            return;
        }

        if (q.length < 2) {
            setState({ items: [], loading: false });
            return;
        }
        // Fresh skeleton right away — never linger on the previous results.
        setState({ items: [], loading: true });
        debounceRef.current = setTimeout(() => {
            fetch(`/api/search?query=${encodeURIComponent(q)}`)
                .then((r) => r.json())
                .then((json) => apply(rank(q, json.sections || [])))
                .catch(fail);
        }, DEBOUNCE_MS);
        return () => clearTimeout(debounceRef.current);
    }, [q, open, link ? link.url : null]);

    const visible = open
        && (state.items.length > 0 || state.loading)
        && (mode !== "search" || q.length >= 2);

    // Track the content's real height while the panel is up (skeleton and
    // results have different sizes); reset when hidden so a re-open starts
    // from the unfold again.
    useEffect(() => {
        if (!visible) {
            setPanelH(null);
            return;
        }
        const el = innerRef.current;
        if (!el) return;
        const ro = new ResizeObserver(() => setPanelH(el.offsetHeight));
        ro.observe(el);
        setPanelH(el.offsetHeight);
        return () => ro.disconnect();
    }, [visible]);

    return (
        <AnimatePresence>
            {visible && (
                <motion.div
                    // Unfolds open, collapses closed; between content states the
                    // height eases to the measured size ("auto" only until the
                    // first measurement lands).
                    initial={{ opacity: 0, y: -6, height: 0 }}
                    animate={{ opacity: 1, y: 0, height: panelH ?? "auto" }}
                    exit={{ opacity: 0, y: -6, height: 0 }}
                    transition={{ duration: 0.25, ease: EASE }}
                    className="absolute left-0 right-0 top-full z-[60] mt-2 overflow-hidden rounded-xl border border-border bg-surface/95 shadow-2xl backdrop-blur-md"
                >
                    <div ref={innerRef} className="p-1.5">
                        {/* popLayout lifts the outgoing block out of the flow, so
                            the measured height is the incoming content's alone
                            and the box resizes while the two crossfade. */}
                        <AnimatePresence mode="popLayout" initial={false}>
                            <motion.div
                                key={state.loading ? "skeleton" : "results"}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.15, ease: EASE }}
                            >
                                {state.loading ? (
                                    <SkeletonRows />
                                ) : (
                                    <>
                                        {state.items.map((item, i) => (
                                            <motion.div
                                                key={`${item.kind}:${item.videoId || item.browseId || item.url || item.title}`}
                                                initial={{ opacity: 0, y: 6 }}
                                                animate={{ opacity: 1, y: 0 }}
                                                transition={{ duration: 0.18, ease: EASE, delay: i * 0.03 }}
                                            >
                                                <Row item={item} onPick={onPick} />
                                            </motion.div>
                                        ))}
                                        <div className="px-3 pb-1 pt-1.5 text-[10px] text-subtext/70">
                                            {mode === "link" ? "Press Enter to open"
                                                : mode === "recent" ? "Recently queued"
                                                : "Press Enter for all results"}
                                        </div>
                                    </>
                                )}
                            </motion.div>
                        </AnimatePresence>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
