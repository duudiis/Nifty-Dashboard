import { useEffect, useMemo, useRef, useState } from "react";

import { useNifty } from "../../context/NiftyContext.js";
import { artworkOrFallback } from "../../lib/format.js";

// Interpolates a smooth, ~frame-accurate playback position between the 1s
// progress pushes from the bot, so line/word highlighting lands on time.
function useSmoothProgress(player) {
    const base = useRef({ p: 0, t: 0, playing: false });
    const [ms, setMs] = useState(0);

    useEffect(() => {
        base.current = { p: player?.progress || 0, t: performance.now(), playing: !!player?.playing };
        setMs(player?.progress || 0);
    }, [player?.progress, player?.playing, player?.track?.songUrl]);

    useEffect(() => {
        let raf;
        const tick = () => {
            const b = base.current;
            setMs(b.playing ? b.p + (performance.now() - b.t) : b.p);
            raf = requestAnimationFrame(tick);
        };
        raf = requestAnimationFrame(tick);
        return () => cancelAnimationFrame(raf);
    }, []);

    return ms;
}

function Line({ line, state, onClick, nodeRef }) {
    // state: "active" | "past" | "future"
    const words = useMemo(() => line.text.split(/(\s+)/), [line.text]);
    return (
        <button
            ref={nodeRef}
            onClick={onClick}
            className={`block w-full text-balance text-left text-3xl font-extrabold leading-tight transition-all duration-500 sm:text-4xl ${
                state === "active"
                    ? "lyric-line-active scale-[1.02] text-white"
                    : state === "past"
                    ? "text-white/25 hover:text-white/40"
                    : "text-white/30 hover:text-white/45"
            }`}
        >
            {state === "active"
                ? words.map((w, i) => (
                      <span key={i} className="lyric-word" style={{ animationDelay: `${i * 0.045}s` }}>
                          {w}
                      </span>
                  ))
                : line.text}
        </button>
    );
}

export default function LyricsView() {
    const { player, selected, control } = useNifty();
    const track = player?.track || null;
    const ms = useSmoothProgress(player);

    const [data, setData] = useState(null); // { synced, plain, instrumental, source }
    const [loading, setLoading] = useState(false);

    const scroller = useRef(null);
    const lineRefs = useRef([]);

    const art = artworkOrFallback(track?.artwork);

    // Fetch (server-cached) lyrics whenever the track changes.
    useEffect(() => {
        if (!track?.title) {
            setData(null);
            return;
        }
        let stale = false;
        setLoading(true);
        const qs = new URLSearchParams({
            title: track.title,
            artist: track.artist || "",
            duration: String(track.duration || 0)
        });
        fetch(`/api/lyrics?${qs}`)
            .then((r) => r.json())
            .then((j) => {
                if (!stale) setData(j);
            })
            .catch(() => !stale && setData(null))
            .finally(() => !stale && setLoading(false));
        return () => {
            stale = true;
        };
    }, [track?.songUrl, track?.title]);

    const synced = data?.synced || [];

    const activeIndex = useMemo(() => {
        if (!synced.length) return -1;
        let i = -1;
        // small lead so the line lights up just as it's sung
        const t = ms + 250;
        while (i + 1 < synced.length && synced[i + 1].time <= t) i++;
        return i;
    }, [synced, ms]);

    // Auto-scroll the active line to the vertical centre.
    useEffect(() => {
        const el = lineRefs.current[activeIndex];
        const box = scroller.current;
        if (!el || !box) return;
        const top = el.offsetTop - box.clientHeight / 2 + el.clientHeight / 2;
        box.scrollTo({ top, behavior: "smooth" });
    }, [activeIndex]);

    const Background = (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <div className="lyric-blob-a absolute inset-0 bg-cover bg-center opacity-50 blur-3xl saturate-150" style={{ backgroundImage: `url(${art})` }} />
            <div className="lyric-blob-b absolute inset-0 bg-cover bg-center opacity-40 blur-3xl saturate-150" style={{ backgroundImage: `url(${art})` }} />
            <div className="lyric-blob-c absolute inset-0 bg-cover bg-center opacity-30 blur-3xl saturate-150" style={{ backgroundImage: `url(${art})` }} />
            <div className="absolute inset-0 bg-black/55 backdrop-blur-2xl" />
        </div>
    );

    const Frame = ({ children }) => (
        <div className="relative flex h-full flex-col overflow-hidden rounded-lg">
            {Background}
            <div className="relative flex flex-1 items-center justify-center p-8 text-center">{children}</div>
        </div>
    );

    if (!selected || !track) {
        return (
            <Frame>
                <p className="text-lg font-bold text-white/70">No track playing</p>
            </Frame>
        );
    }

    if (loading && !data) {
        return (
            <Frame>
                <p className="animate-pulse text-lg font-bold text-white/70">Finding lyrics…</p>
            </Frame>
        );
    }

    if (data?.instrumental) {
        return (
            <Frame>
                <p className="text-2xl font-extrabold text-white/80">♪ Instrumental</p>
            </Frame>
        );
    }

    // Synced lyrics — the main event.
    if (synced.length) {
        return (
            <div className="relative flex h-full flex-col overflow-hidden rounded-lg">
                {Background}
                <div
                    ref={scroller}
                    className="relative flex-1 space-y-6 overflow-y-auto px-8 py-[42vh] sm:px-14"
                >
                    {synced.map((line, i) => (
                        <Line
                            key={`${line.time}-${i}`}
                            line={line}
                            state={i === activeIndex ? "active" : i < activeIndex ? "past" : "future"}
                            onClick={() => control("seek", { position: line.time })}
                            nodeRef={(el) => (lineRefs.current[i] = el)}
                        />
                    ))}
                </div>
            </div>
        );
    }

    // Plain (un-timed) lyrics fallback.
    if (data?.plain) {
        return (
            <div className="relative flex h-full flex-col overflow-hidden rounded-lg">
                {Background}
                <div className="relative flex-1 overflow-y-auto px-8 py-12 sm:px-14">
                    <pre className="whitespace-pre-wrap text-center font-unbounded text-xl font-bold leading-relaxed text-white/80">
                        {data.plain}
                    </pre>
                </div>
            </div>
        );
    }

    return (
        <Frame>
            <div className="flex flex-col items-center gap-2">
                <p className="text-lg font-bold text-white/70">No lyrics found</p>
                <p className="text-sm text-white/40">LRCLIB doesn&apos;t have this one yet.</p>
            </div>
        </Frame>
    );
}
