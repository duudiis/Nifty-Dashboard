import { useNifty } from "../context/NiftyContext.js";
import { AnimatePresence, motion, EASE } from "./motion/index.js";

// Toasts stacked directly above the player, centred, with a small gap. The
// container's bottom edge is pinned to the player's top (bottom-full), so as
// toasts are added the newest sits closest to the player and older ones get
// pushed up. Each fades in/out on its own timer (see context `notify`).
export default function NotificationStack() {
    const { notifications } = useNifty();

    return (
        <div className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-3 flex -translate-x-1/2 flex-col items-center gap-2">
            <AnimatePresence initial>
                {notifications.map((n) => (
                    <motion.div
                        key={n.id}
                        layout
                        initial={{ opacity: 0, y: 10, scale: 0.96 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.96 }}
                        transition={{ duration: 0.24, ease: EASE }}
                        className="max-w-[min(80vw,28rem)] truncate rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black shadow-lg shadow-black/20"
                    >
                        {n.message}
                    </motion.div>
                ))}
            </AnimatePresence>
        </div>
    );
}
