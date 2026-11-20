// Artwork-driven page backdrop: the cover itself, blown up and heavily
// blurred, fading into the page background — every album/artist/playlist gets
// a header tinted by its own art instead of one static accent gradient.
// Pure CSS on top of the artwork URL, so it needs no pixel access (remote
// covers are cross-origin and would taint a canvas).
//
// Rendered inside the transition's pinned (non-sliding) layer — see
// CenterContent — so the blur never leaks past the header while the page
// content slides up.

import { BackdropCrossfade, useDecodedArtwork } from "../artwork.js";

export default function Backdrop({ artwork, height = 340 }) {
    const art = useDecodedArtwork(artwork);
    return (
        <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 overflow-hidden" style={{ height }}>
            <BackdropCrossfade identity={art}>
                {art && <>
                        {art === "accent" ? (
                            <div className="h-full w-full bg-gradient-to-br from-accent to-accent/40 opacity-60" />
                        ) : (
                            <img
                                src={art}
                                alt=""
                                className="backdrop-art h-full w-full scale-125 object-cover opacity-60 blur-3xl saturate-150"
                            />
                        )}
                        <div className="absolute inset-0 bg-scrim/30" />
                        <div className="absolute inset-0 bg-gradient-to-b from-transparent via-transparent to-surface" />
                </>}
            </BackdropCrossfade>
        </div>
    );
}
