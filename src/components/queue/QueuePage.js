import { useNifty } from "../../context/NiftyContext.js";
import { CollectionHeader, formatCollectionDuration, TRACK_TABLE_GUTTER_CLASS } from "../browse/trackTable.js";
import Icon from "../Icon.js";
import { CollectionSkeleton } from "../Loader.js";
import { LoadingSwap } from "../motion/index.js";
import QueueList from "./QueueList.js";

export default function QueuePage() {
    const { queue, player, selected, control, jump, ready, stateLoaded } = useNifty();
    const tracks = queue.tracks || [];
    const length = formatCollectionDuration(tracks.reduce((total, track) => total + (track.duration || 0) / 1000, 0));
    const playing = !!player?.track && player.playing;
    const togglePlayback = () => {
        if (player?.track) control("togglePause");
        else if (tracks.length) jump(tracks[0].track_id);
    };

    return (
        <LoadingSwap loading={!ready || (!!selected && stateLoaded === false)} fallback={<CollectionSkeleton queue />}>
            <div className="pb-8">
                <div style={{ background: "linear-gradient(180deg, rgb(var(--c-accent) / 0.25) -40%, transparent 100%)" }}>
                    <CollectionHeader icon="queue" eyebrow="Listening session" title="Queue">
                        {selected?.guildName && <span className="text-sm font-semibold text-maintext/90">{selected.guildName}</span>}
                        <span className="mt-1 text-xs leading-relaxed text-maintext/70">
                            {tracks.length.toLocaleString()} song{tracks.length === 1 ? "" : "s"}{length ? ` · ${length}` : ""}
                        </span>
                    </CollectionHeader>
                </div>
                <div className={`flex items-center gap-3 pb-4 ${TRACK_TABLE_GUTTER_CLASS}`}>
                    <button
                        type="button"
                        onClick={togglePlayback}
                        disabled={!selected || (!player?.track && !tracks.length)}
                        aria-label={playing ? "Pause queue" : "Play queue"}
                        title={playing ? "Pause queue" : "Play queue"}
                        className="flex h-12 w-12 items-center justify-center rounded-full bg-accent text-canvas shadow-lg transition hover:scale-105 hover:brightness-110 disabled:opacity-40"
                    >
                        <Icon name={playing ? "pause" : "play"} className={`h-5 w-5 ${playing ? "" : "ml-0.5"}`} />
                    </button>
                </div>
                <div className={TRACK_TABLE_GUTTER_CLASS}>
                    <QueueList />
                </div>
            </div>
        </LoadingSwap>
    );
}
