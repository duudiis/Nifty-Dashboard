// The app's one loading indicator: three small dots breathing in turn. Quiet on
// purpose — it fades in only after `delay` seconds, so a quick load shows
// nothing but the content arriving. Colour comes from `text-*` on the element
// (or whatever it inherits).
//
//   <Loader />                          page / panel loads
//   <Loader size="sm" delay={0} />      inline, next to a label
//   <PageLoader />                      centred where a page would be

const SIZES = {
    sm: { "--loader-dot": "5px", "--loader-gap": "3px" },
    md: { "--loader-dot": "8px", "--loader-gap": "6px" },
    lg: { "--loader-dot": "10px", "--loader-gap": "8px" }
};

export default function Loader({ size = "md", delay = 0.3, className = "text-subtext" }) {
    return (
        <span
            role="status"
            aria-label="Loading"
            className={`loader ${className}`}
            style={{ ...SIZES[size], "--loader-delay": `${delay}s` }}
        >
            <span />
            <span />
            <span />
        </span>
    );
}

// Centres the dots in the space a view would fill — for a page that has
// nothing to show yet. Grows to fill a flex column; pass "absolute inset-0" to
// cover a positioned box instead.
export function PageLoader({ className = "", ...props }) {
    return (
        <div className={`pointer-events-none flex flex-1 items-center justify-center ${className}`}>
            <Loader {...props} />
        </div>
    );
}
