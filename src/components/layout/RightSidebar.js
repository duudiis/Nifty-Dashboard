import { useNifty } from "../../context/NiftyContext.js";
import { AnimatePresence, motion, EASE, DUR } from "../motion/index.js";

import QueueList from "../queue/QueueList.js";
import NowPlayingPanel from "../NowPlayingPanel.js";

export default function RightSidebar() {
    const { settings } = useNifty();
    const panel = settings.rightPanel;
    const title = panel === "nowplaying" ? "Now playing" : "Queue";

    return (
        <aside className="hidden w-[340px] shrink-0 flex-col overflow-hidden rounded-lg bg-surface lg:flex">
            <div className="flex items-center gap-2 border-b border-border/60 px-4 py-3 text-sm font-bold text-maintext">
                {title}
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-auto">
                <AnimatePresence mode="wait" initial={false}>
                    <motion.div
                        key={panel}
                        initial={{ opacity: 0, y: 14 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -14 }}
                        transition={{ duration: DUR.fast, ease: EASE }}
                    >
                        {panel === "queue" ? (
                            <div className="p-2">
                                <QueueList dense />
                            </div>
                        ) : (
                            <NowPlayingPanel />
                        )}
                    </motion.div>
                </AnimatePresence>
            </div>
        </aside>
    );
}
