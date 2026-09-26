import { useNifty } from "../../../context/NiftyContext.js";
import { dayLabel } from "../../../lib/format.js";
import Icon from "../../Icon.js";
import { Stagger, StaggerItem } from "../../motion/index.js";
import Section from "../Section.js";

// One numbered step: the numeral, a line of why, and the control that does it.
// The action lives inside the step rather than under the card, so nobody has to
// read all three before anything is clickable.
function Step({ n, title, children, action }) {
    return (
        <div className="flex gap-4">
            <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-accent font-bold text-canvas">
                {n}
            </span>
            <div className="flex min-w-0 flex-1 flex-col items-start gap-2 pt-1">
                <span className="text-sm font-bold text-maintext">{title}</span>
                <p className="max-w-prose text-[13px] leading-relaxed text-subtext">{children}</p>
                {action}
            </div>
        </div>
    );
}

/**
 * What home looks like before it has anything to reflect.
 *
 * HomeView swaps this in for the entire middle of the page under ten plays, so
 * this section *is* the empty state — there is no <Empty> in it because there
 * is no shelf beneath it left to be empty. Every step is the real control, not
 * a description of where to find one, and whatever the account already has
 * hangs below the card so a first visit is never a dead end.
 */
export default function FirstRun({ home }) {
    const { sessions, inviteUrl, updateSettings, setView, runSearch, openEntity } = useNifty();

    const rooms = sessions || [];
    const waiting = home?.likedUnheardTotal || 0;
    const last = home?.lastTrack || null;

    // The search field lives in the top bar, which is mounted on every view, so
    // it can take focus in the same tick the navigation starts.
    const toSearch = () => {
        setView("search");
        document.getElementById("nifty-search")?.focus();
    };

    const pickRoom = rooms.length ? (
        <button
            onClick={() => updateSettings({ rightPanel: "connect" })}
            className="flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-xs font-bold text-canvas transition hover:brightness-110"
        >
            <Icon name="connect" className="h-3.5 w-3.5" />
            Pick a room
        </button>
    ) : (
        <a
            href={inviteUrl || "#"}
            target="_blank"
            rel="noreferrer"
            className={`flex items-center gap-1.5 rounded-full bg-accent px-4 py-2 text-xs font-bold text-canvas transition hover:brightness-110 ${
                inviteUrl ? "" : "pointer-events-none opacity-40"
            }`}
        >
            <Icon name="connect" className="h-3.5 w-3.5" />
            Invite Nifty
        </a>
    );

    return (
        <Section id="first-run" minHeight={360}>
            <div className="rounded-xl border border-border bg-elevated/40 p-6">
                <h3 className="flex items-center gap-2 text-lg font-bold text-maintext">
                    <Icon name="sparkles" className="h-5 w-5 text-accent" />
                    Start the mirror
                </h3>
                <p className="mt-2 max-w-prose text-[13px] leading-relaxed text-subtext">
                    None of this page is written ahead of time. Every shelf on it — the artists, the repeats,
                    the room feed — is built out of what actually gets played through Nifty, so it stays quiet
                    until there is some listening to read back.
                </p>

                <Stagger className="mt-6 flex flex-col gap-5" gap={0.06}>
                    <StaggerItem>
                        <Step
                            n={1}
                            title="Pick a room"
                            action={pickRoom}
                        >
                            {rooms.length
                                ? "Nifty plays into a voice channel, and everything it plays there is what this page reads. Choose which server you're steering."
                                : "Nifty isn't in a server yet. Invite it to one you're in, join a voice channel, and it can start playing."}
                        </Step>
                    </StaggerItem>

                    <StaggerItem>
                        <Step
                            n={2}
                            title="Search for something"
                            action={
                                <button
                                    onClick={toSearch}
                                    className="flex items-center gap-1.5 rounded-full bg-elevated px-4 py-2 text-xs font-bold text-maintext transition hover:bg-surface"
                                >
                                    <Icon name="search" className="h-3.5 w-3.5" />
                                    Open search
                                </button>
                            }
                        >
                            Songs, albums, artists, playlists, a YouTube link — the search bar at the top takes
                            all of it.
                        </Step>
                    </StaggerItem>

                    <StaggerItem>
                        <Step
                            n={3}
                            title="Play it"
                            action={
                                <button
                                    onClick={() => runSearch("top hits")}
                                    className="flex items-center gap-1.5 rounded-full bg-elevated px-4 py-2 text-xs font-bold text-maintext transition hover:bg-surface"
                                >
                                    <Icon name="play" className="h-3.5 w-3.5" />
                                    Browse the charts
                                </button>
                            }
                        >
                            Click a result and it goes in the queue. After about ten tracks this page has enough
                            to build itself from — and it keeps filling in from there. If nothing comes to mind,
                            start from what everyone else is playing.
                        </Step>
                    </StaggerItem>
                </Stagger>
            </div>

            {(waiting > 0 || last) && (
                <div className="flex flex-wrap items-center gap-2">
                    {waiting > 0 && (
                        <button
                            onClick={() => openEntity("playlist", "nifty:playlist:liked")}
                            className="flex items-center gap-2 rounded-full bg-elevated/60 px-3 py-1.5 text-[12px] text-subtext transition hover:bg-elevated hover:text-maintext"
                        >
                            <Icon name="heart-filled" className="h-3.5 w-3.5 shrink-0 text-accent" />
                            You already have {waiting} liked song{waiting === 1 ? "" : "s"} waiting.
                        </button>
                    )}
                    {last && (
                        <span className="flex min-w-0 items-center gap-2 rounded-full bg-elevated/60 px-3 py-1.5 text-[12px] text-subtext">
                            <Icon name="history" className="h-3.5 w-3.5 shrink-0" />
                            <span className="truncate">
                                {dayLabel(last.heardAt)}: {last.title}
                                {last.artist ? ` — ${last.artist}` : ""}
                            </span>
                        </span>
                    )}
                </div>
            )}
        </Section>
    );
}
