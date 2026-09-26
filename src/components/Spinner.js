// A thin turning arc over a faint track ring — the app's busy indicator for
// things that have no progress to report (a video buffering, an embed booting).
// Colour comes from the two `text-*` classes, so it inherits whatever it sits on.
export default function Spinner({ className = "h-8 w-8" }) {
    return (
        <svg
            viewBox="0 0 24 24"
            className={`spinner-turn ${className}`}
            fill="none"
            strokeWidth="2"
            aria-label="Loading"
        >
            <circle cx="12" cy="12" r="9.5" stroke="currentColor" className="text-current opacity-20" />
            <path d="M21.5 12A9.5 9.5 0 0 0 12 2.5" stroke="currentColor" strokeLinecap="round" />
        </svg>
    );
}
