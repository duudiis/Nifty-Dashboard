import QueueItem from "./QueueItem.js";
import { useNifty } from "../../context/NiftyContext.js";

export default function QueueList({ dense = false }) {
    const { queue, selected } = useNifty();
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

    return (
        <div className={`flex flex-col ${dense ? "gap-0.5" : "gap-1"}`}>
            {tracks.map((track) => (
                <QueueItem
                    key={`${track.track_id}-${track.songUrl}`}
                    track={track}
                    index={track.track_id}
                    isCurrent={track.track_id === queue.position}
                    dense={dense}
                />
            ))}
        </div>
    );
}
