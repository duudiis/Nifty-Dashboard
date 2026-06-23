import Icon from "../Icon.js";
import { AnimatePresence, motion, EASE } from "../motion/index.js";

// The add-to-queue icon that flips to a check when a track has just been queued.
export default function QueueGlyph({ done, className }) {
    return (
        <AnimatePresence mode="wait" initial={false}>
            <motion.span
                key={done ? "check" : "add"}
                initial={{ opacity: 0, scale: 0.5 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.5 }}
                transition={{ duration: 0.15, ease: EASE }}
                className="flex items-center justify-center"
            >
                <Icon name={done ? "check" : "enqueue"} className={className} />
            </motion.span>
        </AnimatePresence>
    );
}
