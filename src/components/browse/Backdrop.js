// Artwork-driven page backdrop: the cover itself, blown up and heavily
// blurred, fading into the page background — every album/artist/playlist gets
// a header tinted by its own art instead of one static accent gradient.
// Pure CSS on top of the artwork URL, so it needs no pixel access (remote
// covers are cross-origin and would taint a canvas).

import { artworkOrFallback } from "../../lib/format.js";

export default function Backdrop({ artwork, className = "" }) {
    return (
        <div aria-hidden className={`pointer-events-none absolute inset-0 overflow-hidden ${className}`}>
            <img
                src={artworkOrFallback(artwork)}
                alt=""
                className="h-full w-full scale-125 object-cover opacity-60 blur-3xl saturate-150"
            />
            {/* Darken for text contrast, then dissolve into the page colour. */}
            <div className="absolute inset-0 bg-black/30" />
            <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-canvas" />
        </div>
    );
}
