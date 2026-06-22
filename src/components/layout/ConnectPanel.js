import { useEffect } from "react";

import { useNifty } from "../../context/NiftyContext.js";
import { artworkOrFallback } from "../../lib/format.js";
import Icon from "../Icon.js";

const key = (s) => `${s.botName}:${s.guildId}`;

// The "can't find your server?" block. Centered + primary when there are no
// servers; a quieter footer beneath the list when there are.
function InviteBlock({ centered }) {
    const { inviteUrl } = useNifty();
    return (
        <div className={`flex flex-col items-center gap-3 px-6 text-center ${centered ? "flex-1 justify-center" : "mt-auto border-t border-border/60 py-6"}`}>
            <Icon name="boombox" className="h-9 w-9 text-subtext/70" />
            <div className="flex flex-col gap-1">
                <p className="text-sm font-bold text-maintext">{centered ? "No active servers" : "Not seeing your server?"}</p>
                <p className="text-xs leading-relaxed text-subtext">
                    {centered
                        ? "Join a voice channel with Nifty in it — or it may be missing permissions or not invited to your server yet."
                        : "Nifty might be missing permissions, or hasn't been invited to that server yet."}
                </p>
            </div>
            <a
                href={inviteUrl || "#"}
                target="_blank"
                rel="noreferrer"
                className={`rounded-full bg-accent px-4 py-2 text-xs font-bold text-canvas transition hover:brightness-110 ${inviteUrl ? "" : "pointer-events-none opacity-40"}`}
            >
                Invite Nifty
            </a>
        </div>
    );
}

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
            <div className="flex min-h-full flex-col">
                <InviteBlock centered />
            </div>
        );
    }

    return (
        <div className="flex min-h-full flex-col">
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
                                    <Icon name="voice" className="h-3 w-3" />
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

            <InviteBlock />
        </div>
    );
}
