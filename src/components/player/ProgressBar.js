import { useNifty } from "../../context/NiftyContext.js";
import { msToClock } from "../../lib/format.js";

export default function ProgressBar({ showTimes = true, thin = false }) {
    const { player, control } = useNifty();

    const duration = player?.track?.duration || 0;
    const progress = Math.min(player?.progress || 0, duration);
    const pct = duration > 0 ? (progress / duration) * 100 : 0;

    const trackStyle = {
        background: `linear-gradient(to right, rgb(var(--c-accent)) ${pct}%, rgb(var(--c-border)) ${pct}%)`
    };

    const onSeek = (e) => control("seek", { position: Number(e.target.value) });

    return (
        <div className="flex w-full items-center gap-2">
            {showTimes && <span className="w-10 shrink-0 text-right text-[10px] text-subtext">{msToClock(progress)}</span>}
            <input
                type="range"
                min={0}
                max={duration || 0}
                value={progress}
                onChange={onSeek}
                style={trackStyle}
                className={`player-slider w-full rounded-full ${thin ? "h-[3px]" : "h-1"}`}
            />
            {showTimes && <span className="w-10 shrink-0 text-[10px] text-subtext">{msToClock(duration)}</span>}
        </div>
    );
}
