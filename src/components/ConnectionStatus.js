import { useEffect, useState } from "react";

import { useNifty } from "../context/NiftyContext.js";
import { AnimatePresence, motion, EASE } from "./motion/index.js";

// A dropped link usually comes straight back, so ride out brief blips before
// saying anything.
const SHOW_DELAY = 2500;

// Live link to the dashboard hub, shown as a small pill in the top bar. It
// replaces the old full-page overlay: losing the socket doesn't hide the
// dashboard — the bot keeps playing and everything on screen stays readable,
// you just can't send it anything until this clears.
export default function ConnectionStatus() {
    const { connected, ready } = useNifty();
    const [show, setShow] = useState(false);

    useEffect(() => {
        if (connected) {
            setShow(false);
            return;
        }
        const t = setTimeout(() => setShow(true), SHOW_DELAY);
        return () => clearTimeout(t);
    }, [connected]);

    return (
        <AnimatePresence>
            {show && ready && (
                <motion.div
                    initial={{ opacity: 0, y: -6 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -6 }}
                    transition={{ duration: 0.25, ease: EASE }}
                    title="Lost the link to the dashboard hub — retrying. The bot keeps playing."
                    className="flex shrink-0 items-center gap-2 rounded-full bg-topbartext/10 px-3 py-1.5 text-[11px] font-bold text-topbartext/80"
                >
                    <span className="relative flex h-2 w-2 shrink-0">
                        <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-amber-400/70" />
                        <span className="relative inline-flex h-2 w-2 rounded-full bg-amber-400" />
                    </span>
                    <span className="hidden sm:block">Reconnecting…</span>
                </motion.div>
            )}
        </AnimatePresence>
    );
}
