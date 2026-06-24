import { useNifty } from "../../context/NiftyContext.js";
import { AnimatePresence, motion, EASE } from "../motion/index.js";

import QueueList from "../queue/QueueList.js";
import NowPlayingPanel from "../NowPlayingPanel.js";
import ConnectPanel from "./ConnectPanel.js";
import PanelHeader from "./PanelHeader.js";
import Icon from "../Icon.js";

// Each panel (header + content) animates as one unit: Queue/Connect slide down
// out and Now playing rises from below — so closing a panel reveals it.
function PanelBody({ panel, onClose }) {
    if (panel === "queue") {
        return (
            <>
                {/* fixed at the top; tracks fade out behind it as they scroll up */}
                <div className="sticky top-0 z-10 flex items-center gap-2.5 bg-gradient-to-b from-surface via-surface via-[58%] to-transparent px-4 pb-8 pt-5 text-sm font-bold text-maintext">
                    <Icon name="queue" className="h-4 w-4 text-subtext" />
                    Queue
                    <button onClick={onClose} title="Close" className="ml-auto text-subtext transition hover:text-maintext">
                        <Icon name="x" className="h-4 w-4" />
                    </button>
                </div>
                <div className="-mt-3 flex min-h-0 flex-1 flex-col px-2">
                    <QueueList dense />
                </div>
            </>
        );
    }
    if (panel === "connect") {
        return (
            <>
                <PanelHeader icon="connect" title="Connect" onClose={onClose} />
                <div className="flex min-h-0 flex-1 flex-col">
                    <ConnectPanel />
                </div>
            </>
        );
    }
    // Now playing draws its own header inside its cover-art gradient.
    return <NowPlayingPanel />;
}

export default function RightSidebar() {
    const { settings, updateSettings } = useNifty();
    const panel = settings.rightPanel;
    const close = () => updateSettings({ rightPanel: "nowplaying" });

    return (
        <aside className="hidden w-[340px] shrink-0 flex-col overflow-hidden rounded-lg bg-surface lg:flex">
            {/* popLayout (not "wait"): the incoming panel mounts immediately while
                the outgoing one is popped out of flow. "wait" deadlocks here —
                the Queue panel's Reorder/layout subtree can fail to fire
                onExitComplete, which would leave the next panel permanently blank. */}
            <AnimatePresence mode="popLayout" initial={false}>
                <motion.section
                    key={panel}
                    // overflow-anchor:none disables Chrome's scroll anchoring,
                    // which would otherwise fight the framer-motion layout
                    // slide (auto-shifting scrollTop and causing flicker).
                    className="flex min-h-0 flex-1 flex-col overflow-y-auto [overflow-anchor:none]"
                    initial={{ opacity: 0, y: 24 }}
                    animate={{ opacity: 1, y: 0, transition: { duration: 0.28, ease: EASE } }}
                    exit={{ opacity: 0, y: 24, transition: { duration: 0.18, ease: EASE } }}
                >
                    <PanelBody panel={panel} onClose={close} />
                </motion.section>
            </AnimatePresence>
        </aside>
    );
}
