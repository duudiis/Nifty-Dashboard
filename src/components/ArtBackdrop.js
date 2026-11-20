import { useNifty } from "../context/NiftyContext.js";
import { artworkOrFallback } from "../lib/format.js";
import { BackdropCrossfade, useBackdropPhase, useDecodedArtwork } from "./artwork.js";

// The drifting cover-art "lights" behind the full-surface views (lyrics,
// watch). The pinned backdrop fills the box independently of foreground page
// motion. Decoded replacements dissolve over the existing scene when tracks
// change, keeping the surface covered throughout the transition.
export default function ArtBackdrop() {
    const { player } = useNifty();
    const art = useDecodedArtwork(player?.track?.artwork, { fallback: artworkOrFallback(null) });
    const phase = useBackdropPhase();
    return (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <BackdropCrossfade identity={art} duration={0.5}>
                {art && <>
                    <img src={art} alt="" className="lyric-blob-a backdrop-art absolute inset-0 h-full w-full object-cover object-center opacity-50 blur-3xl saturate-150" style={phase} />
                    <img src={art} alt="" className="lyric-blob-b backdrop-art absolute inset-0 h-full w-full object-cover object-center opacity-40 blur-3xl saturate-150" style={phase} />
                    <img src={art} alt="" className="lyric-blob-c backdrop-art absolute inset-0 h-full w-full object-cover object-center opacity-30 blur-3xl saturate-150" style={phase} />
                </>}
            </BackdropCrossfade>
            <div className="art-scrim absolute inset-0 backdrop-blur-2xl" />
        </div>
    );
}
