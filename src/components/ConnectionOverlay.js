import { useEffect, useRef, useState } from "react";

import { useNifty } from "../context/NiftyContext.js";
import Logo from "./Logo.js";
import { AnimatePresence, motion, EASE } from "./motion/index.js";

// Full-page overlay shown on first load (until the first connect), whenever the
// browser later loses its link to the dashboard hub, and while updating. The bot
// keeps playing regardless. Brief later blips are ridden out before reappearing.
const SHOW_DELAY = 5000; // wait this long after a *drop* before showing
const MIN_VISIBLE = 2000; // once shown, stay up at least this long

const TIPS = [
    "Right-click almost anything to play, queue, or share it.",
    "Open an album or artist page to queue the whole thing at once.",
    "Tap the lyrics icon in the player for time-synced lyrics.",
    "Playing a YouTube track? Tap the screen icon to watch it together, in sync.",
    "Use Connect to switch which server you're controlling.",
    "Search covers songs, albums, artists, playlists and videos.",
    "Nifty keeps playing even when this dashboard is closed.",
    "Double-click a track to queue it instantly.",
    "The now-playing track stays pinned to the top of the queue.",
    "Switch Queue, Now Playing and Connect from the player bar.",
    "Long titles scroll so you can read the whole thing.",
    "Toggle list or grid layout on your search results.",
    "Right-click a queued track to play it next or move it to the top."
];

export default function ConnectionOverlay() {
    const { connected, reloading } = useNifty();
    // Shown immediately on page load and kept up until the very first connect.
    const [visible, setVisible] = useState(true);
    const visibleRef = useRef(true);
    visibleRef.current = visible;
    const everConnected = useRef(false);
    const shownAt = useRef(Date.now());
    const showTimer = useRef();
    const hideTimer = useRef();
    // Latched when the overlay starts showing, so it doesn't flip mid-display.
    const [mode, setMode] = useState("LOADING");
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
                setMode("RECONNECTING");
                setVisible(true);
            }, SHOW_DELAY);
        }
        // Initial load (never connected yet): the overlay is already visible.

        return () => {
            clearTimeout(showTimer.current);
            clearTimeout(hideTimer.current);
        };
    }, [connected]);

    const show = visible || reloading;

    // Rotate tips while the overlay is up.
    useEffect(() => {
        if (!show) return;
        const id = setInterval(() => setTip((t) => (t + 1) % TIPS.length), 4500);
        return () => clearInterval(id);
    }, [show]);

    const status = reloading ? "LOADING" : mode;
    // Updating fades the screen in over the dashboard; first load is instant.
    const bgFades = everConnected.current || reloading;
    // Don't replay the content entrance on the pre-reload screen (it animates
    // once on the fresh page after the refresh).
    const animateContent = !reloading;

    return (
        <AnimatePresence>
            {show && (
                <motion.div
                    initial={bgFades ? { opacity: 0 } : false}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    transition={{ duration: 0.35, ease: EASE }}
                    className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-canvas px-6 text-center"
                >
                    {/* While reloading we show only the plain canvas — the logo +
                        text belong to the fresh page's load screen, so rendering
                        them here too would flash them twice across the refresh. */}
                    {!reloading && (
                        <motion.div
                            initial={animateContent ? { opacity: 0 } : false}
                            animate={{ opacity: 1 }}
                            transition={{ duration: 0.45, ease: EASE }}
                            className="flex flex-col items-center"
                        >
                            <Logo draw className="h-32 w-32 text-white" />
                            <div className="mt-20 flex flex-col items-center gap-2">
                                <p className="text-shimmer text-xs font-extrabold uppercase tracking-[0.1em]">{status}</p>
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
                </motion.div>
            )}
        </AnimatePresence>
    );
}
