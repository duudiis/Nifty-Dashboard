import { useNifty } from "../../context/NiftyContext.js";

import QueueList from "../queue/QueueList.js";
import NowPlayingPanel from "../NowPlayingPanel.js";

export default function RightSidebar() {
    const { settings, updateSettings } = useNifty();
    const panel = settings.rightPanel;

    const Tab = ({ id, label }) => (
        <button
            onClick={() => updateSettings({ rightPanel: id })}
            className={`rounded-full px-3 py-1 text-xs font-bold transition ${panel === id ? "bg-elevated text-maintext" : "text-subtext hover:text-maintext"}`}
        >
            {label}
        </button>
    );

    return (
        <aside className="hidden w-[340px] shrink-0 flex-col rounded-lg bg-surface lg:flex">
            <div className="flex items-center gap-1 border-b border-border/60 p-3">
                <Tab id="queue" label="Queue" />
                <Tab id="nowplaying" label="Now playing" />
            </div>

            <div className="flex min-h-0 flex-1 flex-col overflow-auto">
                {panel === "queue" ? (
                    <div className="p-2">
                        <QueueList dense />
                    </div>
                ) : (
                    <NowPlayingPanel />
                )}
            </div>
        </aside>
    );
}
