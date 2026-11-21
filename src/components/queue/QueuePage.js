import { useNifty } from "../../context/NiftyContext.js";
import { useRef } from "react";

import StickyBar from "../browse/StickyBar.js";
import { CollectionCover, CollectionHeader, formatCollectionDuration, PLAY_ACTION_CLASS, TRACK_ACTIONS_CLASS, TRACK_TABLE_GUTTER_CLASS } from "../browse/trackTable.js";
import Icon from "../Icon.js";
import { CollectionSkeleton } from "../Loader.js";
import { LoadingSwap } from "../motion/index.js";
import QueueList from "./QueueList.js";

export default function QueuePage() {
    const { queue, player, selected, control, jump, ready, stateLoaded } = useNifty();
    const tracks = queue.tracks || [];
    const length = formatCollectionDuration(tracks.reduce((total, track) => total + (track.duration || 0) / 1000, 0));
    const playing = !!player?.track && player.playing;
    const actionsRef = useRef(null);
    const cannotPlay = !selected || (!player?.track && !tracks.length);
    const playLabel = playing ? "Pause queue" : "Play queue";
    const togglePlayback = () => {
        if (player?.track) control("togglePause");
        else if (tracks.length) jump(tracks[0].track_id);
    };

    return (
        <LoadingSwap loading={!ready || (!!selected && stateLoaded === false)} fallback={<CollectionSkeleton queue />}>
            <div className="pb-8">
                <StickyBar
                    triggerRef={actionsRef}
                    title="Queue"
                    cover={<CollectionCover icon="queue" className="h-10 w-10 rounded" iconClassName="h-4 w-4" />}
                >
                    <button type="button" onClick={togglePlayback} disabled={cannotPlay} aria-label={playLabel} title={playLabel} className={`h-10 w-10 ${PLAY_ACTION_CLASS}`}>
                        <Icon name={playing ? "pause" : "play"} className={`h-[18px] w-[18px] ${playing ? "" : "ml-0.5"}`} />
                    </button>
                </StickyBar>
                <div style={{ background: "linear-gradient(180deg, rgb(var(--c-accent) / 0.25) -40%, transparent 100%)" }}>
                    <CollectionHeader icon="queue" eyebrow="Listening session" title="Queue">
                        {selected?.guildName && <span className="text-sm font-semibold text-maintext/90">{selected.guildName}</span>}
                        <span className="text-[13px] leading-relaxed text-maintext/70">
                            {tracks.length.toLocaleString()} song{tracks.length === 1 ? "" : "s"}{length ? ` · ${length}` : ""}
                        </span>
                    </CollectionHeader>
                </div>
                <div className={TRACK_TABLE_GUTTER_CLASS}>
                    <div ref={actionsRef} className={TRACK_ACTIONS_CLASS}>
                    <button
                        type="button"
                        onClick={togglePlayback}
                        disabled={cannotPlay}
                        aria-label={playLabel}
                        title={playLabel}
                        className={`h-14 w-14 ${PLAY_ACTION_CLASS}`}
                    >
                        <Icon name={playing ? "pause" : "play"} className={`h-6 w-6 ${playing ? "" : "ml-0.5"}`} />
                    </button>
                    </div>
                </div>
                <div className={TRACK_TABLE_GUTTER_CLASS}>
                    <QueueList />
                </div>
            </div>
        </LoadingSwap>
    );
}
