import { useCallback, useEffect, useRef, useState } from "react";

import Icon from "../Icon.js";
import Loader from "../Loader.js";
import SessionGroup from "./SessionGroup.js";
import { dayKey, dayLabel } from "../../lib/format.js";

// The user's full listening history: every session they were present for,
// newest first, each expandable into a play-by-play timeline. Sessions are
// keyset-paginated and fetched on demand as the user scrolls.
export default function HistoryView() {
    const [sessions, setSessions] = useState([]);
    const [cursor, setCursor] = useState(null);
    const [hasMore, setHasMore] = useState(true);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(false);
    const loadedOnce = useRef(false);

    const loadMore = useCallback(async () => {
        setLoading(true);
        setError(false);
        try {
            const qs = cursor ? `?before=${encodeURIComponent(cursor)}` : "";
            const res = await fetch(`/api/history${qs}`, { cache: "no-store" });
            if (!res.ok) throw new Error();
            const json = await res.json();
            setSessions((prev) => [...prev, ...(json.sessions || [])]);
            setCursor(json.nextCursor);
            setHasMore(!!json.nextCursor);
        } catch {
            setError(true);
        } finally {
            setLoading(false);
        }
    }, [cursor]);

    // First page on mount (guarded against React 18 double-invoke in dev).
    useEffect(() => {
        if (loadedOnce.current) return;
        loadedOnce.current = true;
        loadMore();
    }, [loadMore]);

    // Infinite scroll: fire the next page when the sentinel nears the viewport.
    const sentinel = useRef(null);
    useEffect(() => {
        const el = sentinel.current;
        if (!el || !hasMore || loading || error) return;
        const io = new IntersectionObserver((entries) => {
            if (entries[0].isIntersecting) loadMore();
        }, { rootMargin: "400px" });
        io.observe(el);
        return () => io.disconnect();
    }, [hasMore, loading, error, loadMore]);

    const empty = !loading && sessions.length === 0 && !hasMore;

    // Track day boundaries so consecutive sessions on the same date share one heading.
    let lastDay = null;

    return (
        <div>
            <div
                className="flex items-end gap-6 px-6 pb-6 pt-10"
                style={{ background: "linear-gradient(180deg, rgb(var(--c-accent) / 0.35) -40%, transparent 100%)" }}
            >
                <span className="flex h-32 w-32 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-accent to-accent/40 text-canvas shadow-2xl">
                    <Icon name="history" className="h-14 w-14" />
                </span>
                <div className="flex flex-col gap-2">
                    <span className="text-xs font-bold uppercase tracking-wide text-subtext">History</span>
                    <h1 className="text-5xl font-bold">Listening history</h1>
                    <span className="max-w-md text-xs text-subtext">
                        Every track you've listened to, grouped by session — newest first.
                    </span>
                </div>
            </div>

            <div className="flex flex-col gap-3 px-6 pb-10">
                {empty && (
                    <div className="flex flex-col items-center gap-2 rounded-xl border border-dashed border-border py-16 text-center">
                        <Icon name="history" className="h-8 w-8 text-subtext" />
                        <p className="text-sm font-semibold text-maintext">No listening history yet</p>
                        <p className="max-w-xs text-xs text-subtext">
                            Once you listen along in a voice channel, every session will show up here.
                        </p>
                    </div>
                )}

                {sessions.map((session, i) => {
                    const key = dayKey(session.startedAt);
                    const showHeading = key !== lastDay;
                    lastDay = key;
                    return (
                        <div key={session.id}>
                            {showHeading && (
                                <h2 className="mb-2 mt-3 px-1 text-xs font-bold uppercase tracking-wide text-subtext first:mt-0">
                                    {dayLabel(session.startedAt)}
                                </h2>
                            )}
                            <SessionGroup session={session} defaultOpen={i === 0} />
                        </div>
                    );
                })}

                {error && (
                    <button
                        onClick={loadMore}
                        className="mx-auto mt-2 rounded-full border border-border px-4 py-1.5 text-xs font-semibold text-subtext transition hover:text-maintext"
                    >
                        Couldn't load history — retry
                    </button>
                )}

                {loading && (
                    <div className="flex items-center justify-center py-6">
                        <Loader />
                    </div>
                )}

                {/* Infinite-scroll trigger */}
                {hasMore && !error && <div ref={sentinel} className="h-1" />}
            </div>
        </div>
    );
}
