// Spotify-style "now playing" equalizer. Bars bounce while `playing`, and rest
// at varied low heights when paused. Colour follows currentColor.
const BARS = [
    { x: 1, delay: "0s", dur: "0.9s", rest: 0.4 },
    { x: 5, delay: "0.25s", dur: "1.1s", rest: 0.7 },
    { x: 9, delay: "0.45s", dur: "0.8s", rest: 0.3 },
    { x: 13, delay: "0.15s", dur: "1.05s", rest: 0.55 }
];

export default function Equalizer({ playing = true, className = "" }) {
    return (
        <svg viewBox="0 0 16 16" className={className} fill="currentColor" aria-hidden="true">
            {BARS.map((b) => (
                <rect
                    key={b.x}
                    x={b.x}
                    y="0"
                    width="2"
                    height="16"
                    rx="1"
                    className={`eq-bar ${playing ? "is-playing" : ""}`}
                    style={
                        playing
                            ? { animationDelay: b.delay, animationDuration: b.dur }
                            : { transform: `scaleY(${b.rest})` }
                    }
                />
            ))}
        </svg>
    );
}
