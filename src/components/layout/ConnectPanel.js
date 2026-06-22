import { useEffect } from "react";

import { useNifty } from "../../context/NiftyContext.js";
import { artworkOrFallback } from "../../lib/format.js";
import Icon from "../Icon.js";

const key = (s) => `${s.botName}:${s.guildId}`;

// Spotify-"Connect"-style list of the servers/voice channels the bot(s) are in.
// Picking one makes it the active session.
export default function ConnectPanel() {
    const { sessions, selected, selectSession, refreshSessions } = useNifty();

    // While this panel is open, keep the list fresh (immediately, then every 5s).
    useEffect(() => {
        refreshSessions();
        const id = setInterval(refreshSessions, 5000);
        return () => clearInterval(id);
    }, [refreshSessions]);

    if (sessions.length === 0) {
        return (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
                <Icon name="connect" className="h-8 w-8 text-subtext" />
                <p className="text-sm font-bold text-maintext">No active servers</p>
                <p className="text-xs text-subtext">Join a voice channel with Nifty in it to see it here.</p>
            </div>
        );
    }

    return (
        <div className="flex flex-col gap-1 p-2">
            {sessions.map((s) => {
                const isSelected = selected && key(selected) === key(s);
                return (
                    <button
                        key={key(s)}
                        onClick={() => selectSession(s)}
                        className={`flex w-full items-center gap-3 rounded-lg p-2 text-left transition ${
                            isSelected ? "bg-accent/15" : "hover:bg-elevated"
                        }`}
                    >
                        <img
                            src={artworkOrFallback(s.guildIcon)}
                            onError={(e) => (e.currentTarget.src = artworkOrFallback(null))}
                            className="h-10 w-10 shrink-0 rounded-lg object-cover"
                            alt=""
                        />
                        <div className="flex min-w-0 flex-1 flex-col leading-tight">
                            <span className={`truncate text-sm font-bold ${isSelected ? "text-accent" : "text-maintext"}`}>
                                {s.guildName}
                            </span>
                            <span className="flex items-center gap-1 truncate text-[11px] text-subtext">
                                <Icon name="mic" className="h-3 w-3" strokeWidth={2.2} />
                                {s.voiceChannelName || "—"}
                            </span>
                        </div>
                        {isSelected ? (
                            <Icon name="connect" className="h-4 w-4 shrink-0 text-accent" />
                        ) : (
                            <span className="shrink-0 rounded-full bg-elevated px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide text-subtext">
                                {s.botName}
                            </span>
                        )}
                    </button>
                );
            })}
        </div>
    );
}
