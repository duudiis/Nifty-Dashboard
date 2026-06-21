import { useNifty } from "../../context/NiftyContext.js";
import { AnimatePresence, motion, EASE, DUR } from "../motion/index.js";

import QueueList from "../queue/QueueList.js";
import NowPlayingPanel from "../NowPlayingPanel.js";
import ConnectPanel from "./ConnectPanel.js";
import PanelHeader from "./PanelHeader.js";

// Panels with a plain text header. Now playing draws its own header inside its
// cover-art gradient, so it's intentionally absent here.
const HEADERS = {
    queue: { icon: "queue", title: "Queue" },
    connect: { icon: "connect", title: "Connect" }
};

export default function RightSidebar() {
    const { settings } = useNifty();
    const panel = settings.rightPanel;
    const header = HEADERS[panel];

    return (
        <aside className="hidden w-[340px] shrink-0 flex-col overflow-hidden rounded-lg bg-surface lg:flex">
            {header && <PanelHeader icon={header.icon} title={header.title} />}

            <div className="flex min-h-0 flex-1 flex-col overflow-auto">
                <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                        key={panel}
                        className="flex min-h-full flex-col"
                        initial={{ opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -14 }}
                        transition={{ duration: DUR.fast, ease: EASE }}
                    >
                        {panel === "queue" ? (
                            <div className="flex min-h-full flex-col px-2 pb-2">
                                <QueueList dense />
                            </div>
                        ) : panel === "connect" ? (
                            <ConnectPanel />
                        ) : (
                            <NowPlayingPanel />
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>
        </aside>
    );
}
