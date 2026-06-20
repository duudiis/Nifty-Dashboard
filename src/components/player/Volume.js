import { useNifty } from "../../context/NiftyContext.js";
import Icon from "../Icon.js";

export default function Volume({ disabled = false }) {
    const { player, control } = useNifty();
    const volume = player?.volume ?? 100;
    const pct = Math.min(volume, 100);

    const trackStyle = {
        background: `linear-gradient(to right, rgb(var(--c-accent)) ${pct}%, rgb(var(--c-border)) ${pct}%)`
    };

    const name = volume === 0 ? "volume-mute" : volume < 50 ? "volume-low" : "volume";

    return (
        <div className={`flex items-center gap-2 ${disabled ? "opacity-40" : ""}`}>
            <Icon name={name} className="h-5 w-5 text-subtext" />
            <input
                type="range"
                min={0}
                max={100}
                value={volume}
                disabled={disabled}
                onChange={(e) => control("volume", { volume: Number(e.target.value) })}
                style={trackStyle}
                className="player-slider h-1 w-24 rounded-full disabled:cursor-not-allowed"
            />
        </div>
    );
}
