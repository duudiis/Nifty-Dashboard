import QueueItem from "./QueueItem.js";
import { useNifty } from "../../context/NiftyContext.js";

function ColumnHeader() {
    return (
        <div className="flex w-full items-center gap-3 border-b border-border/60 px-2 pb-2 text-[10px] font-bold uppercase tracking-wide text-subtext">
            <span className="w-6 shrink-0 text-center">#</span>
            <span className="w-10 shrink-0" />
            <span className="min-w-0 flex-1">Title</span>
            <span className="hidden w-28 shrink-0 lg:block">Added by</span>
            <span className="w-12 shrink-0 text-right">Time</span>
        </div>
    );
}

export default function QueueList({ dense = false }) {
    const { queue, player, selected } = useNifty();
    const tracks = queue.tracks || [];

    if (!selected) {
        return (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
                <p className="text-sm font-bold text-maintext">No server selected</p>
                <p className="text-xs text-subtext">Pick a server from the top bar to see its queue.</p>
            </div>
        );
    }

    if (tracks.length === 0) {
        return (
            <div className="flex flex-1 flex-col items-center justify-center gap-2 p-8 text-center">
                <p className="text-sm font-bold text-maintext">The queue is empty</p>
                <p className="text-xs text-subtext">Search above to add a track and get the party started.</p>
            </div>
        );
    }

    // Cross-reference the player so the "now playing" highlight tracks playback
    // changes immediately, even before a fresh queue snapshot arrives.
    const current = player?.track;
    const isCurrent = (track) =>
        track.track_id === queue.position ||
        (current && ((current.songUrl && current.songUrl === track.songUrl) || current.track_id === track.track_id));

    return (
        <div className={`flex flex-col ${dense ? "gap-0.5" : "gap-1"}`}>
            {!dense && <ColumnHeader />}
            {tracks.map((track) => (
                <QueueItem
                    key={`${track.track_id}-${track.songUrl}`}
                    track={track}
                    index={track.track_id}
                    isCurrent={isCurrent(track)}
                    dense={dense}
                />
            ))}
        </div>
    );
}
