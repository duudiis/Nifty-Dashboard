import { useEffect, useRef, useState } from "react";

import { useNifty } from "../context/NiftyContext.js";
import Logo from "./Logo.js";
import { AnimatePresence, motion, EASE } from "./motion/index.js";

// Full-page overlay shown when the browser loses its link to the dashboard hub.
// The bot keeps playing regardless. To avoid flashing on brief blips we wait a
// few seconds before showing it, and once shown we keep it up for a moment.
const SHOW_DELAY = 5000; // wait this long disconnected before showing
const MIN_VISIBLE = 2000; // once shown, stay up at least this long

export default function ConnectionOverlay() {
    const { connected } = useNifty();
    const [visible, setVisible] = useState(false);
    const visibleRef = useRef(false);
    visibleRef.current = visible;
    const shownAt = useRef(0);
    const showTimer = useRef();
    const hideTimer = useRef();

    useEffect(() => {
        clearTimeout(showTimer.current);
        clearTimeout(hideTimer.current);

        if (!connected) {
            // Might reconnect instantly — only surface the overlay if it lasts.
            showTimer.current = setTimeout(() => {
                shownAt.current = Date.now();
                setVisible(true);
            }, SHOW_DELAY);
        } else if (visibleRef.current) {
            // Reconnected while shown: hold for the minimum, then hide.
            const remaining = Math.max(0, MIN_VISIBLE - (Date.now() - shownAt.current));
            hideTimer.current = setTimeout(() => setVisible(false), remaining);
        }

        return () => {
            clearTimeout(showTimer.current);
            clearTimeout(hideTimer.current);
        };
    }, [connected]);

    return (
        <AnimatePresence>
            {visible && (
                <motion.div
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.35, ease: EASE }}
                    className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-7 bg-canvas/95 px-6 text-center backdrop-blur-md"
                >
                    <Logo draw className="h-24 w-24 text-accent" />
                    <div className="flex flex-col gap-2">
                        <p className="text-xl font-bold text-maintext">Reconnecting…</p>
                        <p className="max-w-sm text-sm text-subtext">
                            We lost the connection to Nifty. Your music keeps playing — hang tight, we&apos;re
                            getting you back in.
                        </p>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
