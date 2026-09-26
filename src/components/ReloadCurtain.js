import { useNifty } from "../context/NiftyContext.js";
import { AnimatePresence, motion, EASE } from "./motion/index.js";

// Updating to a new build reloads the page. This fades the canvas over the app
// first so the refresh reads as one smooth blank rather than a hard flash —
// the fresh page then animates its own shell back in.
export default function ReloadCurtain() {
    const { reloading } = useNifty();

    return (
        <AnimatePresence>
            {reloading && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ duration: 0.18, ease: EASE }}
                    className="fixed inset-0 z-[100] bg-canvas"
                />
            )}
        </AnimatePresence>
    );
}
