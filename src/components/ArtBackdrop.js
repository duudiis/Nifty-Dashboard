import { useNifty } from "../context/NiftyContext.js";
import { artworkOrFallback } from "../lib/format.js";
import { AnimatePresence, motion, EASE, DUR } from "./motion/index.js";

// The drifting cover-art "lights" behind the full-surface views (lyrics,
// watch). Rendered as the view's pinned backdrop (by SlideTransition) so it
// fills the box and fades with the view but never slides — the page transition
// can't expose the bare surface behind it. The blobs crossfade when the track
// changes.
export default function ArtBackdrop() {
    const { player } = useNifty();
    const art = artworkOrFallback(player?.track?.artwork);
    return (
        <div className="pointer-events-none absolute inset-0 overflow-hidden">
            <AnimatePresence initial={false}>
                <motion.div
                    key={art}
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: DUR.slow, ease: EASE }}
                    className="absolute inset-0"
                >
                    <div className="lyric-blob-a absolute inset-0 bg-cover bg-center opacity-50 blur-3xl saturate-150" style={{ backgroundImage: `url(${art})` }} />
                    <div className="lyric-blob-b absolute inset-0 bg-cover bg-center opacity-40 blur-3xl saturate-150" style={{ backgroundImage: `url(${art})` }} />
                    <div className="lyric-blob-c absolute inset-0 bg-cover bg-center opacity-30 blur-3xl saturate-150" style={{ backgroundImage: `url(${art})` }} />
                </motion.div>
            </AnimatePresence>
            <div className="absolute inset-0 bg-black/55 backdrop-blur-2xl" />
        </div>
    );
}
