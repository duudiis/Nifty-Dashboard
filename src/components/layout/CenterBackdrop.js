import { useTransform } from "framer-motion";
import { motion, useCrossfadeWeights } from "../motion/index.js";
import ArtBackdrop from "../ArtBackdrop.js";
import Backdrop from "../browse/Backdrop.js";
import Aurora from "../home/Aurora.js";

function Layer({ name, weights, children }) {
    const opacity = useTransform(weights, (value) => value[name] || 0);
    const visibility = useTransform(opacity, (value) => value > 0 ? "visible" : "hidden");
    return (
        <motion.div
            data-background-view={name}
            className="absolute inset-0 bg-surface"
            style={{ opacity, visibility, mixBlendMode: "plus-lighter" }}
        >
            {children}
        </motion.div>
    );
}

// Keep each background renderer alive across route kinds. Replacing Aurora
// with Backdrop used to discard the painted palette and decoded artwork on
// every navigation. Hidden scenes can prepare the next cover without painting;
// complementary, isolated fades preserve brightness when the view changes.
export default function CenterBackdrop({ view, pageArt, artwork }) {
    const kind = ["album", "playlist", "artist"].includes(view) ? "entity"
        : ["home", "lyrics", "watch"].includes(view) ? view : "neutral";
    const weights = useCrossfadeWeights(kind);
    return (
        <div aria-hidden className="absolute inset-0 isolate" data-center-backdrop>
            <Layer name="neutral" weights={weights} />
            <Layer name="home" weights={weights}>
                <Aurora artwork={artwork} height={360} />
            </Layer>
            <Layer name="entity" weights={weights}>
                <Backdrop artwork={pageArt} />
            </Layer>
            <Layer name="lyrics" weights={weights}>
                <ArtBackdrop />
            </Layer>
            <Layer name="watch" weights={weights}>
                <div className="absolute inset-0 bg-black" />
            </Layer>
        </div>
    );
}
