import { useNifty } from "../../context/NiftyContext.js";

export default function Volume() {
    const { player, control } = useNifty();
    const volume = player?.volume ?? 100;
    const pct = Math.min(volume, 100);

    const trackStyle = {
        background: `linear-gradient(to right, rgb(var(--c-accent)) ${pct}%, rgb(var(--c-border)) ${pct}%)`
    };

    const icon =
        volume === 0
            ? "M7 9v6h4l5 5V4l-5 5H7Zm12.5 3a4.5 4.5 0 0 0-2.5-4.03v8.06A4.5 4.5 0 0 0 19.5 12Z"
            : "M3 9v6h4l5 5V4L7 9H3Zm13.5 3A4.5 4.5 0 0 0 14 7.97v8.06A4.5 4.5 0 0 0 16.5 12ZM14 3.23v2.06a7 7 0 0 1 0 13.42v2.06a9 9 0 0 0 0-17.54Z";

    return (
        <div className="flex items-center gap-2">
            <svg viewBox="0 0 24 24" className="h-5 w-5 shrink-0 fill-subtext">
                <path d={icon} />
            </svg>
            <input
                type="range"
                min={0}
                max={100}
                value={volume}
                onChange={(e) => control("volume", { volume: Number(e.target.value) })}
                style={trackStyle}
                className="player-slider h-1 w-24 rounded-full"
            />
        </div>
    );
}
