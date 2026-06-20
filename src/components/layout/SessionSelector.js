import { useEffect, useRef, useState } from "react";

import { useNifty } from "../../context/NiftyContext.js";
import { artworkOrFallback } from "../../lib/format.js";
import Icon from "../Icon.js";

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
                <Icon name="chevron-down" className="h-4 w-4 text-white/70" />
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
                                            <Icon name="mic" className="h-3 w-3" strokeWidth={2.2} />
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
