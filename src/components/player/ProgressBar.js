import { useNifty } from "../../context/NiftyContext.js";
import { msToClock } from "../../lib/format.js";

// Pass `progress`/`duration` (and `disabled`) to render a static bar — used by
// the stopped player so its layout/width matches the live one exactly.
export default function ProgressBar({ showTimes = true, thin = false, progress: pProgress, duration: pDuration, disabled = false }) {
    const { player, control } = useNifty();

    const duration = pDuration != null ? pDuration : player?.track?.duration || 0;
    const progress = pProgress != null ? pProgress : Math.min(player?.progress || 0, duration);
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
                disabled={disabled}
                style={trackStyle}
                className={`player-slider w-full rounded-full ${thin ? "h-[3px]" : "h-1"} ${disabled ? "pointer-events-none" : ""}`}
            />
            {showTimes && <span className="w-10 shrink-0 text-[10px] text-subtext">{msToClock(duration)}</span>}
        </div>
    );
}
