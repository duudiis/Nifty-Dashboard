import { useEffect, useState } from "react";

import { useNifty } from "../context/NiftyContext.js";
import { AnimatePresence, motion, EASE } from "./motion/index.js";

// Roughly how much vertical space one toast occupies (box + gap), used to work
// out how many fit in the top-half budget.
const SLOT = 60;

// Toasts stacked directly above the player, centred. The newest sits closest to
// the player; as more arrive they push older ones up, and once a toast climbs
// past ~half the screen it fades out naturally on its way out of the area.
export default function NotificationStack() {
    const { notifications } = useNifty();
    const [vh, setVh] = useState(0);

    useEffect(() => {
        const update = () => setVh(window.innerHeight);
        update();
        window.addEventListener("resize", update);
        return () => window.removeEventListener("resize", update);
    }, []);

    const budget = vh ? (vh * 0.5) / SLOT : 99; // toasts that fit before fading

    return (
        <div className="pointer-events-none absolute bottom-full left-1/2 z-30 mb-6 flex -translate-x-1/2 flex-col items-center gap-6">
            <AnimatePresence initial>
                {notifications.map((n, i) => {
                    const fromBottom = notifications.length - 1 - i;
                    // full opacity near the player, ramping to 0 over the last
                    // ~1.5 slots as it passes the half-screen line.
                    const opacity = Math.max(0, Math.min(1, (budget - fromBottom) / 1.5));
                    return (
                        <motion.div
                            key={n.id}
                            layout
                            initial={{ opacity: 0 }}
                            animate={{ opacity }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.24, ease: EASE }}
                            className="max-w-[min(80vw,28rem)] truncate rounded-lg bg-white px-4 py-2 text-sm font-semibold text-black shadow-lg shadow-black/20"
                        >
                            {n.message}
                        </motion.div>
                    );
                })}
            </AnimatePresence>
        </div>
    );
}
