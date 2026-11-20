import { useCallback, useEffect, useRef, useState } from "react";

import Icon from "../Icon.js";
import Loader, { HistorySkeleton } from "../Loader.js";
import { LoadingSwap } from "../motion/index.js";
import SessionGroup from "./SessionGroup.js";
import { dayKey, dayLabel } from "../../lib/format.js";

// The user's full listening history: every session they were present for,
// newest first, with quiet session separators and playable song rows. Sessions are
// keyset-paginated and fetched on demand as the user scrolls.
export default function HistoryView() {
    const [sessions, setSessions] = useState([]);
    const [cursor, setCursor] = useState(null);
    const [hasMore, setHasMore] = useState(true);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState(false);
    const loadedOnce = useRef(false);
    const fetching = useRef(false);

    const loadMore = useCallback(async () => {
        if (fetching.current) return;
        fetching.current = true;
        setLoading(true);
        setError(false);
        try {
            const qs = cursor ? `?before=${encodeURIComponent(cursor)}` : "";
            const res = await fetch(`/api/history${qs}`, { cache: "no-store" });
            if (!res.ok) throw new Error();
            const json = await res.json();
            setSessions((prev) => {
                const known = new Set(prev.map((session) => session.id));
                return [...prev, ...(json.sessions || []).filter((session) => !known.has(session.id))];
            });
            setCursor(json.nextCursor);
            setHasMore(!!json.nextCursor);
        } catch {
            setError(true);
        } finally {
            fetching.current = false;
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
        <div className="px-4 pb-12 pt-10 sm:px-7">
            <header className="mb-9 flex flex-col gap-3">
                <span className="text-xs font-medium text-subtext">Made of your music</span>
                <h1 className="text-4xl font-extrabold tracking-tight sm:text-5xl">Listening history</h1>
                <p className="max-w-lg text-sm leading-relaxed text-subtext">Find a favorite, play it again, or add it to your queue.</p>
            </header>

            <LoadingSwap loading={loading && sessions.length === 0} fallback={<HistorySkeleton />} contentClassName="flex flex-col">
                {empty && (
                    <div className="flex flex-col items-center gap-3 py-20 text-center">
                        <Icon name="history" className="h-8 w-8 text-subtext" />
                        <p className="text-sm font-semibold text-maintext">No listening history yet</p>
                        <p className="max-w-xs text-xs text-subtext">
                            Once you listen along in a voice channel, every session will show up here.
                        </p>
                    </div>
                )}

                {sessions.map((session) => {
                    const key = dayKey(session.startedAt);
                    const showHeading = key !== lastDay;
                    lastDay = key;
                    return (
                        <div key={session.id}>
                            {showHeading && (
                                <h2 className="mb-3 mt-5 px-2 text-lg font-bold tracking-tight text-maintext first:mt-0">
                                    {dayLabel(session.startedAt)}
                                </h2>
                            )}
                            <SessionGroup session={session} />
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

                {loading && sessions.length > 0 && (
                    <div className="flex items-center justify-center py-6">
                        <Loader />
                    </div>
                )}

                {/* Infinite-scroll trigger */}
                {hasMore && !error && <div ref={sentinel} className="h-1" />}
            </LoadingSwap>
        </div>
    );
}
