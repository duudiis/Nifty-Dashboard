import { useState } from "react";

import Icon from "../Icon.js";
import { artworkOrFallback } from "../../lib/format.js";
import ArtistLink from "./ArtistLink.js";
import { COLLECTION_COVER_SIZE_CLASS, DENSE_TRACK_ROW_CLASS, TRACK_ROW_HEIGHT, TRACK_ROW_CLASS } from "../skeletonLayout.js";

// One table for playlists, Liked songs and the queue page. Everything that
// decides its rhythm lives here, so live rows, headers and loading
// placeholders can't drift apart:
//
//   page edge │ gutter │ row padding │ #  cover  title/artist … meta ♥ time ⋯
//
// The header block and the action bar start on the same line as the row
// content (gutter + row padding). Collections use TRACK_ROW_HEIGHT to
// calculate their virtualized scroll window.
export { TRACK_ROW_HEIGHT, TRACK_ROW_CLASS };

// The gutter is also the size container: the optional metadata column appears
// when the table itself is wide enough, whatever the sidebars are doing.
export const TRACK_TABLE_GUTTER_CLASS = "px-2 sm:px-4 [container-type:inline-size]";
export const COLLECTION_HEADER_CLASS = "flex flex-col gap-6 px-6 pb-7 pt-10 [container-type:inline-size] sm:flex-row sm:flex-wrap sm:items-end sm:px-8";
export const TRACK_ACTIONS_CLASS = "flex flex-wrap items-center justify-between gap-4 px-4 pb-6";
export const TRACK_TABLE_HEADER_CLASS = "mb-2 flex h-9 items-center gap-3 border-b border-maintext/10 px-4 text-[11px] font-medium uppercase tracking-[0.08em] text-subtext";

// The round actions above a table (size them with h-/w- at the call site).
// The secondary one has an opaque surface of its own, so it reads on any
// cover-art backdrop.
export const PLAY_ACTION_CLASS = "flex shrink-0 items-center justify-center rounded-full bg-accent text-canvas shadow-lg transition hover:scale-105 hover:brightness-110 active:scale-100 disabled:opacity-40";
export const SECONDARY_ACTION_CLASS = "flex shrink-0 items-center justify-center rounded-full bg-elevated text-maintext shadow-lg ring-1 ring-maintext/10 transition hover:scale-105 hover:brightness-125 active:scale-100 disabled:opacity-40";

export const TRACK_NUMBER_CLASS = "flex w-6 shrink-0 items-center justify-center text-center text-[13px] tabular-nums";
export const TRACK_DETAILS_CLASS = "flex min-w-0 flex-1 flex-col gap-1 leading-tight";
// Optional column between the title and the actions (date added, added by).
export const TRACK_META_CLASS = "hidden w-40 shrink-0 items-center truncate text-xs text-subtext [@container_(min-width:640px)]:flex";
export const TRACK_ACTION_CLASS = "flex h-8 w-8 shrink-0 items-center justify-center rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";
// Row actions stay out of the way until the row is hovered, focused or has
// its menu open; touch screens (no hover) always show them.
// The ⋯ button gives its column back to the title on a narrow table (the
// right-click menu still has everything).
export const TRACK_MENU_COLUMN_CLASS = "hidden [@container_(min-width:480px)]:flex";
export const TRACK_QUIET_ACTION_CLASS = "opacity-0 group-hover:opacity-100 group-focus-within:opacity-100 group-data-[active]:opacity-100 [@media(hover:none)]:opacity-100";

export function formatCollectionDuration(seconds) {
    if (!seconds) return null;
    const minutes = Math.round(seconds / 60);
    const hours = Math.floor(minutes / 60);
    return hours > 0 ? `${hours} hr ${minutes % 60} min` : `${minutes} min`;
}

// "3 days ago" for the last month, a short date after that.
export function formatAdded(iso, now = Date.now()) {
    const time = iso ? new Date(iso).getTime() : NaN;
    if (Number.isNaN(time)) return "";
    const days = Math.floor((now - time) / 86400000);
    if (days < 1) return "Today";
    if (days === 1) return "Yesterday";
    if (days < 7) return `${days} days ago`;
    if (days < 28) return `${Math.floor(days / 7)} week${days < 14 ? "" : "s"} ago`;
    return new Date(time).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
}

export function trackRowClassName({ dense = false, collection = true, active = false } = {}) {
    return `group relative flex w-full items-center rounded-md transition-colors hover:bg-elevated ${dense ? DENSE_TRACK_ROW_CLASS : collection ? TRACK_ROW_CLASS : "h-[60px] gap-3 p-2"} ${active ? "bg-elevated" : ""}`;
}

// Queue, playlists and liked songs use the same actual row structure. Only
// their controls and the optional metadata column differ.
export function TrackRowContent({ leading, artwork, title, artist, artistBrowseId, current = false, collection = true, metadata, like, duration, menu }) {
    return (
        <>
            {leading}
            {artwork}
            <div className={collection ? TRACK_DETAILS_CLASS : "flex min-w-0 flex-1 flex-col gap-0.5 leading-tight"}>
                <span className={`truncate ${collection ? "text-sm font-medium" : "text-[13px]"} ${current ? "text-accent" : "text-maintext"}`}>{title}</span>
                <ArtistLink name={artist} browseId={artistBrowseId} className={collection ? "text-xs text-subtext" : "text-[11px] text-subtext"} />
            </div>
            {metadata}
            {like}
            {duration}
            {menu}
        </>
    );
}

// `meta` names the optional metadata column ("Date added", "Added by").
export function TrackTableHeader({ meta }) {
    return (
        <div className={TRACK_TABLE_HEADER_CLASS}>
            <span className={TRACK_NUMBER_CLASS}>#</span>
            <span className="min-w-0 flex-1">Title</span>
            {meta && <span className={TRACK_META_CLASS}>{meta}</span>}
            <span className="w-8 shrink-0" />
            <span className="flex w-12 shrink-0 justify-end" title="Duration"><Icon name="clock" className="h-4 w-4" /><span className="sr-only">Duration</span></span>
            <span className={`w-8 shrink-0 ${TRACK_MENU_COLUMN_CLASS}`} />
        </div>
    );
}

// The collection's cover at any size: its artwork, or an accent tile with an
// icon for the ones that have none (Liked songs, the queue).
export function CollectionCover({ artwork, icon, className = "", iconClassName = "h-20 w-20" }) {
    if (icon) {
        return (
            <span className={`flex shrink-0 items-center justify-center bg-gradient-to-br from-accent to-accent/40 text-canvas ${className}`}>
                <Icon name={icon} className={iconClassName} />
            </span>
        );
    }
    return (
        <img
            src={artworkOrFallback(artwork)}
            onError={(event) => (event.currentTarget.src = artworkOrFallback(null))}
            className={`shrink-0 object-cover ${className}`}
            alt=""
        />
    );
}

const COLLECTION_TITLE_CLASS = "break-words text-3xl font-extrabold leading-[1.08] tracking-tight sm:text-4xl xl:text-5xl";

// The page title. With `onRename` (your own playlists) clicking it turns it
// into a field: Enter or clicking away saves, Escape cancels.
function CollectionTitle({ title, onRename }) {
    const [editing, setEditing] = useState(false);
    const [draft, setDraft] = useState(title);

    if (!onRename) return <h1 className={COLLECTION_TITLE_CLASS}>{title}</h1>;

    const commit = () => {
        setEditing(false);
        const name = draft.trim();
        if (name && name !== title) onRename(name);
    };

    if (editing) {
        return (
            <input
                autoFocus
                value={draft}
                maxLength={100}
                aria-label="Playlist name"
                onChange={(event) => setDraft(event.target.value)}
                onFocus={(event) => event.target.select()}
                onBlur={commit}
                onKeyDown={(event) => {
                    if (event.key === "Enter") event.currentTarget.blur();
                    if (event.key === "Escape") { event.stopPropagation(); setEditing(false); }
                }}
                className={`${COLLECTION_TITLE_CLASS} -mx-2 w-[calc(100%+1rem)] rounded-md bg-maintext/10 px-2 text-maintext outline-none ring-1 ring-maintext/20 focus:ring-accent`}
            />
        );
    }
    return (
        <h1 className={COLLECTION_TITLE_CLASS}>
            <button
                type="button"
                title="Rename"
                onClick={() => { setDraft(title); setEditing(true); }}
                className="-mx-2 rounded-md px-2 text-left transition-colors hover:bg-maintext/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent"
            >
                {title}
            </button>
        </h1>
    );
}

export function CollectionHeader({ artwork, icon, eyebrow, title, onRename, children }) {
    return (
        <div className={COLLECTION_HEADER_CLASS}>
            <CollectionCover
                artwork={artwork}
                icon={icon}
                className={`${COLLECTION_COVER_SIZE_CLASS} rounded-lg shadow-[0_16px_48px_rgb(0_0_0/0.45)] ${icon ? "" : "ring-1 ring-white/10"}`}
            />
            <div className="flex min-w-0 flex-col gap-2.5 pb-1 drop-shadow-sm sm:min-w-[180px] sm:flex-1">
                {eyebrow && <span className="text-xs font-semibold text-maintext/80">{eyebrow}</span>}
                <CollectionTitle key={title} title={title} onRename={onRename} />
                {children}
            </div>
        </div>
    );
}
