import Icon from "../Icon.js";

// Shared header for the right-sidebar panels: an icon + title, generous
// matching padding, no divider line, and breathing room before the content.
// Pass `onClose` to show a close (X) button aligned with the title.
export default function PanelHeader({ icon, title, onClose }) {
    return (
        <div className="flex items-center gap-2.5 px-4 pb-4 pt-5 text-sm font-bold text-maintext">
            <Icon name={icon} className="h-4 w-4 text-subtext" />
            {title}
            {onClose && (
                <button
                    onClick={onClose}
                    title="Close"
                    className="ml-auto text-subtext transition hover:text-maintext"
                >
                    <Icon name="x" className="h-4 w-4" />
                </button>
            )}
        </div>
    );
}
