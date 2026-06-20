import { useEffect, useRef, useState } from "react";

import { useNifty } from "../../context/NiftyContext.js";
import { artworkOrFallback } from "../../lib/format.js";

function VoiceIcon({ className }) {
    return (
        <svg viewBox="0 0 24 24" className={className}>
            <path d="M12 3a3 3 0 0 0-3 3v6a3 3 0 0 0 6 0V6a3 3 0 0 0-3-3Zm7 9a7 7 0 0 1-6 6.92V21a1 1 0 1 1-2 0v-2.08A7 7 0 0 1 5 12a1 1 0 1 1 2 0 5 5 0 0 0 10 0 1 1 0 1 1 2 0Z" />
        </svg>
    );
}

export default function SessionSelector() {
    const { sessions, selected, selectSession } = useNifty();
    const [open, setOpen] = useState(false);
    const ref = useRef(null);

    useEffect(() => {
        if (!open) return;
        const handler = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false); };
        window.addEventListener("click", handler);
        return () => window.removeEventListener("click", handler);
    }, [open]);

    const key = (s) => `${s.botName}:${s.guildId}`;

    return (
        <div ref={ref} className="relative">
            <button
                onClick={() => setOpen((o) => !o)}
                className="flex max-w-[220px] items-center gap-2 rounded-full bg-white/10 px-3 py-1.5 text-white transition hover:bg-white/15"
            >
                {selected ? (
                    <>
                        <img
                            src={artworkOrFallback(selected.guildIcon)}
                            onError={(e) => (e.currentTarget.src = artworkOrFallback(null))}
                            className="h-6 w-6 shrink-0 rounded-full object-cover"
                            alt=""
                        />
                        <div className="flex min-w-0 flex-col items-start leading-tight">
                            <span className="max-w-[140px] truncate text-xs font-bold">{selected.guildName}</span>
                            <span className="max-w-[140px] truncate text-[10px] text-white/60">
                                {selected.voiceChannelName || "Not in a channel"}
                            </span>
                        </div>
                    </>
                ) : (
                    <span className="px-1 text-xs font-bold">Select a server</span>
                )}
                <svg viewBox="0 0 24 24" className="h-4 w-4 shrink-0 fill-white/70">
                    <path d="M12 15.4 6.6 10l1.4-1.4 4 4 4-4L17.4 10 12 15.4Z" />
                </svg>
            </button>

            {open && (
                <div className="pop-in absolute right-0 z-50 mt-2 max-h-[60vh] w-80 overflow-auto rounded-xl border border-border bg-elevated p-2 shadow-2xl">
                    {sessions.length === 0 ? (
                        <div className="px-3 py-6 text-center text-xs text-subtext">
                            No active sessions. Join a voice channel with Nifty in it.
                        </div>
                    ) : (
                        sessions.map((s) => {
                            const isSelected = selected && key(selected) === key(s);
                            return (
                                <button
                                    key={key(s)}
                                    onClick={() => { selectSession(s); setOpen(false); }}
                                    className={`flex w-full items-center gap-3 rounded-lg p-2 text-left transition ${isSelected ? "bg-accent/15" : "hover:bg-surface"}`}
                                >
                                    <img
                                        src={artworkOrFallback(s.guildIcon)}
                                        onError={(e) => (e.currentTarget.src = artworkOrFallback(null))}
                                        className="h-10 w-10 shrink-0 rounded-lg object-cover"
                                        alt=""
                                    />
                                    <div className="flex min-w-0 flex-1 flex-col leading-tight">
                                        <span className="truncate text-sm font-bold text-maintext">{s.guildName}</span>
                                        <span className="flex items-center gap-1 truncate text-[11px] text-subtext">
                                            <VoiceIcon className="h-3 w-3 fill-current" />
                                            {s.voiceChannelName || "—"}
                                        </span>
                                        {s.nowPlaying?.title && (
                                            <span className="truncate text-[11px] text-accent">♪ {s.nowPlaying.title}</span>
                                        )}
                                    </div>
                                    <span className="shrink-0 rounded-full bg-surface px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-subtext">
                                        {s.botName}
                                    </span>
                                </button>
                            );
                        })
                    )}
                </div>
            )}
        </div>
    );
}
