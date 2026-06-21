import Icon from "../Icon.js";

// Shared header for the right-sidebar panels: an icon + title, generous
// matching padding, no divider line, and breathing room before the content.
export default function PanelHeader({ icon, title }) {
    return (
        <div className="flex items-center gap-2.5 px-4 pb-4 pt-5 text-sm font-bold text-maintext">
            <Icon name={icon} className="h-4 w-4 text-subtext" />
            {title}
        </div>
    );
}
