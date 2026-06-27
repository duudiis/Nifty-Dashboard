import { useNifty } from "../../context/NiftyContext.js";
import { SlideTransition } from "../motion/index.js";

import QueueList from "../queue/QueueList.js";
import NowPlayingPanel, { NowPlayingBackdrop } from "../NowPlayingPanel.js";
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
            {/* Same slide primitive as the centre view, so panels enter/leave with
                identical timing. mode="wait" (inside SlideTransition) fully drops
                the old panel before mounting the new one, so the Queue panel's
                Reorder subtree can't leave a ghost over the incoming panel.
                Now playing hands its cover-art gradient to the pinned backdrop, so
                the slide never exposes the bare surface above it.
                The inner (sliding) layer is the scroll container:
                  • layoutScroll — framer accounts for its scroll offset during a
                    drag, so a dragged track isn't left behind on auto-scroll.
                  • overflow-anchor:none — disable Chrome scroll anchoring, which
                    would otherwise fight framer's layout slide (scrollTop flicker). */}
            <SlideTransition
                transitionKey={panel}
                layoutScroll
                backdrop={panel === "nowplaying" ? <NowPlayingBackdrop /> : null}
                className="flex min-h-0 flex-1 flex-col"
                contentClassName="flex min-h-0 flex-1 flex-col overflow-y-auto [overflow-anchor:none]"
            >
                <PanelBody panel={panel} onClose={close} />
            </SlideTransition>
        </aside>
    );
}
