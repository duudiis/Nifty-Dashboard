import { useNifty } from "../../../context/NiftyContext.js";
import { artworkOrFallback } from "../../../lib/format.js";
import Equalizer from "../../Equalizer.js";
import Icon from "../../Icon.js";

// Two bots can sit in the same guild, so the guild id alone is not unique.
const key = (s) => `${s.botName}:${s.guildId}`;

// The rooms Nifty is currently in, as a wrapping chip row.
//
// Not a Rail: nobody has more than a handful of servers, and pushing two of
// four behind a scroll edge would hide the very thing this strip exists to
// show. It is bare — no <Section> heading — because it reads as orientation
// under the hero rather than as content of its own.
export default function RoomsRail() {
    const { sessions, selected, selectSession } = useNifty();
    const rooms = sessions || [];

    // The hero already carries the invite call to action; a second empty state
    // saying the same thing would just be noise.
    if (rooms.length === 0) return null;

    return (
        <div className="flex flex-wrap gap-2">
            {rooms.map((s) => {
                const active = selected != null && String(selected.guildId) === String(s.guildId);
                const listening = Boolean(s.nowPlaying?.title);

                return (
                            <button
                            // switchView stays false: this strip points at a
                            // room, it does not leave home to go play in it.
                            onClick={() => selectSession(s, { switchView: false })}
                            title={listening ? `${s.guildName} — ${s.nowPlaying.title}` : s.guildName}
                            className={`flex items-center gap-2.5 rounded-xl px-2.5 py-2 text-left transition ${
                                active ? "bg-accent/15 text-accent" : "bg-elevated text-maintext hover:bg-surface"
                            }`}
                        >
                            {/* The glyph sits underneath rather than beside: a
                                guild icon that 404s hides itself and uncovers
                                it, so the chip never collapses. */}
                            <span className="relative flex h-8 w-8 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-canvas/40 text-subtext">
                                <Icon name="music" className="h-4 w-4" />
                                {s.guildIcon && (
                                    <img
                                        src={artworkOrFallback(s.guildIcon)}
                                        onError={(e) => { e.currentTarget.style.display = "none"; }}
                                        className="absolute inset-0 h-full w-full object-cover"
                                        alt=""
                                    />
                                )}
                            </span>

                            <span className="flex min-w-0 max-w-[160px] flex-col leading-tight">
                                <span className="truncate text-[13px] font-bold">{s.guildName || "Unknown server"}</span>
                                <span className="flex items-center gap-1 text-[10px] text-subtext">
                                    <Icon name="voice" className="h-2.5 w-2.5 shrink-0" />
                                    <span className="truncate">{s.voiceChannelName || "Not in a channel"}</span>
                                </span>
                            </span>

                            {listening && <Equalizer playing className="h-3 w-3 shrink-0 text-accent" />}
                        </button>
                );
            })}
        </div>
    );
}
