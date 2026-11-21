// The settings modal: a category sidebar on the left (grouped tabs, the Nifty
// mark at the bottom) and the active category on the right. Each category is
// its own file built from ./primitives.js. Settings persist through the
// existing settings store (localStorage-backed, applied live).
//
//   modal.open(settingsModal("connections"))

import { useEffect, useRef, useState } from "react";

import Icon from "../Icon.js";
import Logo from "../Logo.js";
import { motion } from "../motion/index.js";
import AboutPage from "./AboutPage.js";
import AccountPage from "./AccountPage.js";
import AppearancePage from "./AppearancePage.js";
import ConnectionsPage from "./ConnectionsPage.js";
import PlaybackPage from "./PlaybackPage.js";
import { FOCUS, HAIRLINE } from "./primitives.js";

const GROUPS = [
    {
        label: "Personal",
        tabs: [
            { id: "account", label: "Account", icon: "user", Page: AccountPage },
            { id: "connections", label: "Connections", icon: "link", Page: ConnectionsPage }
        ]
    },
    {
        label: "App settings",
        tabs: [
            { id: "appearance", label: "Appearance", icon: "palette", Page: AppearancePage },
            { id: "playback", label: "Playback", icon: "music", Page: PlaybackPage },
            { id: "about", label: "About", icon: "info", Page: AboutPage }
        ]
    }
];

const TABS = GROUPS.flatMap((group) => group.tabs);
const DEFAULT_TAB = "appearance";

// Descriptor for the app modal system; the panel draws its own chrome.
export function settingsModal(initial = DEFAULT_TAB) {
    return {
        title: "Settings",
        size: "settings",
        frameless: true,
        render: ({ close }) => <SettingsPanel initial={initial} onClose={close} />
    };
}

export default function SettingsPanel({ initial = DEFAULT_TAB, onClose }) {
    const [tabId, setTabId] = useState(TABS.some((tab) => tab.id === initial) ? initial : DEFAULT_TAB);
    const tabRefs = useRef({});
    const active = TABS.find((tab) => tab.id === tabId);

    // Keyboard users land on the current category.
    useEffect(() => {
        tabRefs.current[tabId]?.focus({ preventScroll: true });
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Arrow keys walk the categories, as in any tab list.
    const onKeyDown = (event) => {
        const index = TABS.findIndex((tab) => tab.id === tabId);
        const step = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 }[event.key];
        const next = event.key === "Home" ? TABS[0]
            : event.key === "End" ? TABS[TABS.length - 1]
            : step ? TABS[(index + step + TABS.length) % TABS.length]
            : null;
        if (!next) return;
        event.preventDefault();
        setTabId(next.id);
        tabRefs.current[next.id]?.focus();
    };

    return (
        <div className="relative flex h-[850px] max-h-[calc(100dvh-3rem)] min-h-0 flex-col sm:flex-row">
            <button
                type="button"
                onClick={() => onClose?.()}
                aria-label="Close settings"
                className={`absolute right-3.5 top-3.5 z-10 grid h-[30px] w-[30px] place-items-center rounded-lg border bg-maintext/[0.02] text-subtext transition hover:rotate-[5deg] hover:bg-maintext/[0.08] hover:text-maintext ${HAIRLINE} ${FOCUS}`}
            >
                <Icon name="x" className="h-4 w-4" />
            </button>

            <aside className={`flex shrink-0 flex-col border-b bg-canvas px-3 pb-2.5 pt-[17px] sm:w-[216px] sm:border-b-0 sm:border-r sm:pb-[22px] sm:pt-[31px] ${HAIRLINE}`}>
                <div className="mx-3 mb-4 text-[13px] font-bold uppercase tracking-[0.14em] text-maintext/85 sm:mb-[27px]">
                    Settings
                </div>

                <div
                    role="tablist"
                    aria-label="Settings categories"
                    aria-orientation="vertical"
                    onKeyDown={onKeyDown}
                    className="flex gap-3 overflow-x-auto sm:flex-col sm:gap-6 sm:overflow-visible"
                >
                    {GROUPS.map((group) => (
                        <div key={group.label}>
                            <div className="mx-3 mb-2 whitespace-nowrap text-[10px] font-semibold uppercase tracking-[0.1em] text-subtext/80">
                                {group.label}
                            </div>
                            <div className="flex gap-1 sm:flex-col">
                                {group.tabs.map((tab) => {
                                    const selected = tab.id === tabId;
                                    return (
                                        <button
                                            key={tab.id}
                                            ref={(node) => { tabRefs.current[tab.id] = node; }}
                                            type="button"
                                            role="tab"
                                            id={`settings-tab-${tab.id}`}
                                            aria-selected={selected}
                                            aria-controls="settings-panel"
                                            tabIndex={selected ? 0 : -1}
                                            onClick={() => setTabId(tab.id)}
                                            className={`flex w-full items-center gap-[11px] whitespace-nowrap rounded-[7px] px-3 py-2.5 text-left text-[13px] font-medium transition-colors ${FOCUS} ${
                                                selected
                                                    ? "bg-accent/[0.12] text-accent"
                                                    : "text-subtext hover:bg-maintext/[0.05] hover:text-maintext"
                                            }`}
                                        >
                                            <Icon name={tab.icon} className="hidden h-[18px] w-[18px] sm:block" />
                                            {tab.label}
                                        </button>
                                    );
                                })}
                            </div>
                        </div>
                    ))}
                </div>

                <div className="mx-3 mt-auto hidden pt-10 sm:block">
                    <span className="flex items-center gap-1.5 text-subtext/70">
                        <Logo className="h-7 w-7" />
                        <span className="text-xl font-extrabold tracking-tight">Nifty</span>
                    </span>
                    <p className="mt-1 text-[11px] text-subtext/60">Play it your way.</p>
                </div>
            </aside>

            <div className="min-h-0 min-w-0 flex-1 overflow-y-auto overscroll-contain">
                <motion.div
                    key={tabId}
                    role="tabpanel"
                    id="settings-panel"
                    aria-labelledby={`settings-tab-${tabId}`}
                    initial={{ opacity: 0, y: 3 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ duration: 0.15, ease: "easeOut" }}
                    className="px-5 pb-7 pt-6 sm:px-[35px] sm:pb-[30px] sm:pt-[33px]"
                >
                    <active.Page />
                </motion.div>
            </div>
        </div>
    );
}
