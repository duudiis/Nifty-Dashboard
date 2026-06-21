import { useNifty } from "../../context/NiftyContext.js";
import { AnimatePresence, motion, EASE } from "../motion/index.js";

import QueueList from "../queue/QueueList.js";
import NowPlayingPanel from "../NowPlayingPanel.js";
import ConnectPanel from "./ConnectPanel.js";
import PanelHeader from "./PanelHeader.js";
import Icon from "../Icon.js";

// Each panel (header + content) animates as a single unit: it fades in while
// sliding up from below, and fades out while sliding up to the top.
function PanelBody({ panel }) {
    if (panel === "queue") {
        return (
            <>
                {/* fixed at the top; tracks fade out behind it as they scroll up */}
                <div className="sticky top-0 z-10 flex items-center gap-2.5 bg-gradient-to-b from-surface via-surface to-transparent px-4 pb-8 pt-5 text-sm font-bold text-maintext">
                    <Icon name="queue" className="h-4 w-4 text-subtext" />
                    Queue
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
                <PanelHeader icon="connect" title="Connect" />
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
    const { settings } = useNifty();
    const panel = settings.rightPanel;

    return (
        <aside className="hidden w-[340px] shrink-0 flex-col overflow-hidden rounded-lg bg-surface lg:flex">
            <AnimatePresence mode="wait" initial={false}>
                <motion.section
                    key={panel}
                    className="flex min-h-0 flex-1 flex-col overflow-y-auto"
                    initial={{ opacity: 0, y: 18 }}
                    animate={{ opacity: 1, y: 0, transition: { duration: 0.28, ease: EASE } }}
                    exit={{ opacity: 0, y: -18, transition: { duration: 0.16, ease: EASE } }}
                >
                    <PanelBody panel={panel} />
                </motion.section>
            </AnimatePresence>
        </aside>
    );
}
