import { useNifty } from "../../../context/NiftyContext.js";
import { artworkOrFallback, dayLabel, humanDuration, msToClock } from "../../../lib/format.js";
import Icon from "../../Icon.js";
import Marquee from "../../Marquee.js";
import Equalizer from "../../Equalizer.js";
import AddedBy from "../../AddedBy.js";
import ArtistLink from "../../browse/ArtistLink.js";
import { motion, entrance } from "../../motion/index.js";
import Section, { Empty } from "../Section.js";

/* The top of the home screen: who you are, what the mirror knows about you,
   and — when there is one — the room you are actually listening in.

   Everything on the right comes from the socket the context already holds
   open, so the card is live without this file owning a single timer. */

const PRIMARY = "rounded-full bg-accent px-4 py-2 text-xs font-bold text-canvas transition hover:brightness-110";
const SECONDARY = "rounded-full bg-elevated px-4 py-2 text-xs font-bold text-subtext transition hover:text-maintext";

// Bands of the local clock, checked in order — the last one runs to midnight.
const GREETINGS = [
    [4, "Still up"],
    [11, "Good morning"],
    [16, "Good afternoon"],
    [21, "Good evening"],
    [23, "Night shift"]
];

function greetingFor(hour) {
    const band = GREETINGS.find(([until]) => hour <= until);
    return band ? band[1] : "Hello";
}

// One sentence, first match wins. The hero states a single true thing about
// your listening; a stack of them would be a stat page, not a greeting.
function mirrorSentence(home) {
    const totals = home?.totals || {};
    const today = totals.today_ms || 0;
    const week = totals.week_ms || 0;
    const prev = totals.prev_week_ms || 0;
    const all = totals.all_ms || 0;
    const last = home?.lastTrack || null;

    if (today > 0) return `You've listened ${humanDuration(today)} today.`;

    if (week > 0) {
        // A first week has no denominator, so the comparison clause is dropped
        // rather than printed as an infinity — same rule as the status line.
        if (prev <= 0) return `${humanDuration(week)} this week.`;
        const pct = Math.round((Math.abs(week - prev) / prev) * 100);
        if (pct === 0) return `${humanDuration(week)} this week, level with last week.`;
        return `${humanDuration(week)} this week, ${pct}% ${week >= prev ? "up" : "down"} on last week.`;
    }

    // all_ms can be non-zero while the last-track lookup came back empty.
    if (all > 0 && last?.title) return `Last heard ${dayLabel(last.heardAt)} — ${last.title} by ${last.artist}.`;

    return "Nothing in the mirror yet. Queue something and it starts remembering.";
}

// "2 rooms live · 14 in queue". A clause that would read as zero is left out
// entirely — the line says what is happening, never what isn't.
function StatusLine({ liveRooms, queued }) {
    const clauses = [];
    if (liveRooms > 0) clauses.push(`${liveRooms} room${liveRooms === 1 ? "" : "s"} live`);
    if (queued > 0) clauses.push(`${queued} in queue`);
    if (!clauses.length) return null;

    return <p className="text-xs text-subtext">{clauses.join(" · ")}</p>;
}

// A transport icon. The accent dot under an active toggle matches the player
// bar, so shuffle/loop read the same in both places.
function Transport({ icon, onClick, title, active = false, dot = true }) {
    return (
        <button
            type="button"
            onClick={onClick}
            title={title}
            className={`relative flex h-9 w-9 items-center justify-center rounded-full transition hover:bg-elevated ${
                active ? "text-accent" : "text-subtext hover:text-maintext"
            }`}
        >
            <Icon name={icon} className="h-[18px] w-[18px]" />
            {active && dot && <span className="absolute bottom-0.5 left-1/2 h-[3px] w-[3px] -translate-x-1/2 rounded-full bg-accent" />}
        </button>
    );
}

// The live card. Player-shape track only: duration and progress are numbers of
// milliseconds here, so every time on this card goes through msToClock.
function LiveCard() {
    const { player, queue, control, isLiked, toggleLike } = useNifty();
    const track = player?.track;
    if (!track) return null;

    const tracks = queue?.tracks || [];
    const duration = track.duration || 0;
    const elapsed = player.progress || 0;
    const progress = duration > 0 ? Math.min(elapsed, duration) : elapsed;
    const pct = duration > 0 ? (progress / duration) * 100 : 0;

    const liked = isLiked(track);
    const loopOn = !!player.loop && player.loop !== "disabled";

    // track_id IS the queue position, not an index into the array — the list
    // reorders constantly, and indexing by position points at the wrong song
    // the moment anything moves.
    const index = tracks.findIndex((t) => t.track_id === queue?.position);

    const footer = [];
    if (index >= 0 && tracks.length) footer.push(`${index + 1} of ${tracks.length}`);
    if (duration > 0) footer.push(`${msToClock(Math.max(0, duration - progress))} left`);

    const seek = (e) => {
        if (duration <= 0) return;
        const box = e.currentTarget.getBoundingClientRect();
        const ratio = box.width > 0 ? (e.clientX - box.left) / box.width : 0;
        control("seek", { position: Math.round(Math.min(1, Math.max(0, ratio)) * duration) });
    };

    return (
        <div className="flex w-full shrink-0 flex-col gap-4 rounded-xl bg-elevated/60 p-4 backdrop-blur-sm lg:w-[380px]">
            {/* keyed on the song so a track change fades the new one in rather
                than swapping the text under a still marquee */}
            <motion.div key={track.songUrl || track.title} {...entrance()} className="flex items-start gap-4">
                <img
                    src={artworkOrFallback(track.artwork)}
                    onError={(e) => (e.currentTarget.src = artworkOrFallback(null))}
                    className="h-24 w-24 shrink-0 rounded-lg object-cover shadow-lg"
                    alt=""
                />
                <div className="flex min-w-0 flex-1 flex-col gap-1">
                    <Marquee text={track.title || ""} className="text-lg font-bold text-maintext" />
                    <ArtistLink name={track.artist} browseId={null} className="text-sm text-subtext" />
                    <div className="mt-1 flex min-w-0 items-center gap-2">
                        <Equalizer playing={!!player.playing} className="h-3.5 w-3.5 shrink-0 text-accent" />
                        <AddedBy track={track} size={18} className="min-w-0 text-[11px] text-subtext" />
                    </div>
                </div>
            </motion.div>

            <div className="flex items-center gap-1">
                <Transport icon="prev" title="Previous" onClick={() => control("back")} />
                <button
                    type="button"
                    onClick={() => control("togglePause")}
                    title={player.playing ? "Pause" : "Play"}
                    className="flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-accent text-canvas shadow-lg transition hover:brightness-110 active:scale-95"
                >
                    <Icon name={player.playing ? "pause" : "play"} className="h-6 w-6" />
                </button>
                <Transport icon="next" title="Next" onClick={() => control("skip")} />

                <span className="ml-auto flex items-center gap-1">
                    <Transport icon="shuffle" title="Shuffle" active={!!player.shuffle} onClick={() => control("shuffle")} />
                    <Transport
                        icon={player.loop === "track" ? "loop-one" : "loop"}
                        title={`Loop: ${player.loop && player.loop !== "disabled" ? player.loop : "off"}`}
                        active={loopOn}
                        onClick={() => control("loop")}
                    />
                    <Transport
                        icon={liked ? "heart-filled" : "heart"}
                        title={liked ? "Remove from Liked songs" : "Save to Liked songs"}
                        active={liked}
                        dot={false}
                        onClick={() => toggleLike(track)}
                    />
                </span>
            </div>

            <div className="flex flex-col gap-1.5">
                {/* the padding is the hit area — a 4px bar is a hard click target */}
                <button
                    type="button"
                    onClick={seek}
                    disabled={duration <= 0}
                    title="Seek"
                    className="group/seek -my-2 w-full py-2 disabled:cursor-default"
                >
                    <span className="block h-1 w-full overflow-hidden rounded-full bg-border">
                        <span className="block h-full rounded-full bg-accent transition-[width] duration-500" style={{ width: `${pct}%` }} />
                    </span>
                </button>
                <div className="flex items-center justify-between text-[10px] text-subtext">
                    <span>{msToClock(progress)}</span>
                    <span>{msToClock(duration)}</span>
                </div>
            </div>

            {footer.length > 0 && <p className="text-[11px] text-subtext">{footer.join(" · ")}</p>}
        </div>
    );
}

// Tiers 1-3 sit in the same slot the live card would occupy, so the hero keeps
// its shape whether or not anything is playing.
function Standby({ tier, home }) {
    const { sessions, selected, inviteUrl, updateSettings, summon, play } = useNifty();
    const rooms = sessions || [];
    const lastTrack = home?.lastTrack || null;

    if (tier === 1) {
        return (
            <Empty
                action={
                    <div className="flex flex-wrap items-center gap-2">
                        {/* the invite URL is built from an env var, so it can
                            genuinely be missing — the button stays, dimmed */}
                        <a
                            href={inviteUrl || "#"}
                            target="_blank"
                            rel="noreferrer"
                            className={`${PRIMARY} ${inviteUrl ? "" : "pointer-events-none opacity-40"}`}
                        >
                            Invite Nifty
                        </a>
                        <button type="button" onClick={() => updateSettings({ rightPanel: "connect" })} className={SECONDARY}>
                            Open Connect
                        </button>
                    </div>
                }
            >
                Nifty can&apos;t see you in a voice channel right now. Hop into one and it
                shows up here — or invite it to a server that doesn&apos;t have it yet.
            </Empty>
        );
    }

    if (tier === 2) {
        return (
            <Empty
                action={
                    <button type="button" onClick={() => updateSettings({ rightPanel: "connect" })} className={SECONDARY}>
                        Open Connect
                    </button>
                }
            >
                {rooms.length} rooms standing by. Nothing is playing in any of them yet.
            </Empty>
        );
    }

    const quiet = selected?.guildName ? `${selected.guildName} is quiet.` : "Nothing is playing right now.";
    const canResume = !!lastTrack?.url;
    const canSummon = !!selected && !selected.botActive;

    return (
        <Empty
            action={
                (canResume || canSummon) && (
                    <div className="flex flex-wrap items-center gap-2">
                        {canResume && (
                            <button
                                type="button"
                                onClick={() => play(lastTrack.url, "now", lastTrack.title)}
                                title={lastTrack.title}
                                className={PRIMARY}
                            >
                                Play where you left off
                            </button>
                        )}
                        {canSummon && (
                            <button type="button" onClick={summon} className={SECONDARY}>
                                Summon Nifty
                            </button>
                        )}
                    </div>
                )
            }
        >
            {quiet} {canResume ? "Pick up where you left off, or search for something new." : "Search for something to put on."}
        </Empty>
    );
}

export default function Hero({ home, loading }) {
    const { user, sessions, player, queue } = useNifty();

    const rooms = sessions || [];
    const tracks = queue?.tracks || [];
    const liveRooms = rooms.filter((s) => s?.nowPlaying?.title).length;

    // Rendered in this order on purpose. The context auto-selects a session the
    // instant one exists, so "selected but not playing" is also true while the
    // bot is offline everywhere — checking it first would swallow the two
    // states above it. Tier 2 additionally stands down when a player is live:
    // the room list is polled and its nowPlaying can lag the socket, and
    // "3 rooms standing by" over a playing track is the one wrong answer here.
    let tier;
    if (!rooms.length) tier = 1;
    else if (rooms.length > 1 && !liveRooms && !player) tier = 2;
    else if (!player) tier = 3;
    else tier = 4;

    const name = user?.display_name || user?.username || "";
    const greeting = greetingFor(new Date().getHours());

    // Section's wash is deliberately not wired to `loading`. The live card is
    // socket state that lands long before /api/home does, and washing the hero
    // would hide a player that is already playing. Only the mirror waits.
    return (
        <Section id="hero" minHeight={150}>
            <div className="flex flex-col items-start gap-6 lg:flex-row lg:justify-between">
                <div className="flex min-w-0 flex-col gap-2">
                    <h1 className="text-3xl font-extrabold leading-tight text-maintext sm:text-4xl">
                        {name ? `${greeting}, ${name}` : greeting}
                    </h1>

                    {loading ? (
                        <div className="h-4 w-64 animate-pulse rounded bg-elevated" />
                    ) : (
                        <p className="text-sm text-subtext">{mirrorSentence(home)}</p>
                    )}

                    <StatusLine liveRooms={liveRooms} queued={tracks.length} />
                </div>

                {tier === 4 ? (
                    <LiveCard />
                ) : (
                    <div className="w-full shrink-0 lg:w-[380px]">
                        <Standby tier={tier} home={home} />
                    </div>
                )}
            </div>
        </Section>
    );
}
