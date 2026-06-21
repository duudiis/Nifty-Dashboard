import { useEffect, useRef, useState } from "react";

import { useNifty } from "../context/NiftyContext.js";
import Logo from "./Logo.js";
import { AnimatePresence, motion, EASE } from "./motion/index.js";

// Full-page overlay shown on first load (until the first connect) and whenever
// the browser later loses its link to the dashboard hub. The bot keeps playing
// regardless. Brief later blips are ridden out before the overlay reappears.
const SHOW_DELAY = 5000; // wait this long after a *drop* before showing
const MIN_VISIBLE = 2000; // once shown, stay up at least this long

const TIPS = [
    "Right-click almost anything to play, queue, or share it.",
    "Open an album or artist page to queue the whole thing at once.",
    "Tap the lyrics icon in the player for time-synced lyrics.",
    "Use Connect to switch which server you're controlling.",
    "Search covers songs, albums, artists, playlists and videos.",
    "Nifty keeps playing even when this dashboard is closed."
];

export default function ConnectionOverlay() {
    const { connected } = useNifty();
    // Shown immediately on page load and kept up until the very first connect.
    const [visible, setVisible] = useState(true);
    const visibleRef = useRef(true);
    visibleRef.current = visible;
    const everConnected = useRef(false);
    const shownAt = useRef(Date.now());
    const showTimer = useRef();
    const hideTimer = useRef();
    const [tip, setTip] = useState(0);

    useEffect(() => {
        clearTimeout(showTimer.current);
        clearTimeout(hideTimer.current);

        if (connected) {
            everConnected.current = true;
            if (visibleRef.current) {
                const remaining = Math.max(0, MIN_VISIBLE - (Date.now() - shownAt.current));
                hideTimer.current = setTimeout(() => setVisible(false), remaining);
            }
        } else if (everConnected.current) {
            // A later drop might reconnect instantly — only surface it if it lasts.
            showTimer.current = setTimeout(() => {
                shownAt.current = Date.now();
                setVisible(true);
            }, SHOW_DELAY);
        }
        // Initial load (never connected yet): the overlay is already visible.

        return () => {
            clearTimeout(showTimer.current);
            clearTimeout(hideTimer.current);
        };
    }, [connected]);

    // Rotate tips while the overlay is up.
    useEffect(() => {
        if (!visible) return;
        const id = setInterval(() => setTip((t) => (t + 1) % TIPS.length), 5000);
        return () => clearInterval(id);
    }, [visible]);

    const status = everConnected.current ? "RECONNECTING" : "LOADING";

    return (
        <AnimatePresence>
            {visible && (
                <motion.div
                    // No fade-in on the very first (load) appearance; reconnects fade.
                    initial={everConnected.current ? { opacity: 0 } : false}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.35, ease: EASE }}
                    className="fixed inset-0 z-[100] flex flex-col items-center justify-center gap-6 bg-canvas px-6 text-center"
                >
                    <Logo draw className="h-24 w-24 text-white" />
                    <div className="flex flex-col items-center gap-3">
                        <p className="text-xs font-bold uppercase tracking-[0.3em] text-subtext">{status}</p>
                        <AnimatePresence mode="wait">
                            <motion.p
                                key={tip}
                                initial={{ opacity: 0 }}
                                animate={{ opacity: 1 }}
                                exit={{ opacity: 0 }}
                                transition={{ duration: 0.3, ease: EASE }}
                                className="max-w-sm text-sm text-subtext"
                            >
                                {TIPS[tip]}
                            </motion.p>
                        </AnimatePresence>
                    </div>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
