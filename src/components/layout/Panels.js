import { useRef } from "react";

import { useNifty } from "../../context/NiftyContext.js";
import LeftSidebar from "./LeftSidebar.js";
import CenterContent from "./CenterContent.js";
import RightSidebar from "./RightSidebar.js";
import ResizeHandle from "./ResizeHandle.js";

// The three boxes under the top bar, with a resize seam between each pair.
//
// Sidebar widths are per-device preferences (settings.leftWidth/rightWidth,
// null = default). They reach the boxes as CSS variables on this row, which is
// also what a drag writes to while it's in progress.
export const PANELS = {
    left: { cssVar: "--left-w", width: 300, min: 220, max: 480 },
    right: { cssVar: "--right-w", width: 340, min: 280, max: 560 }
};

export default function Panels() {
    const { settings, updateSettings } = useNifty();
    const rowRef = useRef(null);

    const left = settings.leftWidth ?? PANELS.left.width;
    const right = settings.rightWidth ?? PANELS.right.width;

    return (
        <div
            ref={rowRef}
            className="panels flex min-h-0 flex-1"
            style={{ [PANELS.left.cssVar]: `${left}px`, [PANELS.right.cssVar]: `${right}px` }}
        >
            <LeftSidebar />
            <ResizeHandle
                rowRef={rowRef}
                panel="left"
                spec={PANELS.left}
                width={left}
                onCommit={(w) => updateSettings({ leftWidth: w })}
                label="Resize library"
                className="hidden md:block"
            />
            <CenterContent />
            <ResizeHandle
                rowRef={rowRef}
                panel="right"
                spec={PANELS.right}
                width={right}
                onCommit={(w) => updateSettings({ rightWidth: w })}
                label="Resize side panel"
                className="hidden lg:block"
            />
            <RightSidebar />
        </div>
    );
}
