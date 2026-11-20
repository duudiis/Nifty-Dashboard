import Icon from "../Icon.js";
import { artworkOrFallback } from "../../lib/format.js";
import ArtistLink from "./ArtistLink.js";
import { COLLECTION_COVER_SIZE_CLASS, DENSE_TRACK_ROW_CLASS, TRACK_ROW_HEIGHT, TRACK_ROW_CLASS } from "../skeletonLayout.js";

// Keep the measured row pitch, live rows, and loading placeholders together.
// Collections use this height to calculate their virtualized scroll window.
export { TRACK_ROW_HEIGHT, TRACK_ROW_CLASS };
export const TRACK_NUMBER_CLASS = "flex w-8 shrink-0 items-center justify-center text-center text-xs tabular-nums";
export const TRACK_DETAILS_CLASS = "flex min-w-0 flex-1 flex-col gap-0.5 leading-tight";
export const TRACK_TABLE_GUTTER_CLASS = "px-3 sm:px-5";
export const COLLECTION_HEADER_CLASS = "flex flex-col gap-5 px-3 pb-6 pt-8 sm:flex-row sm:flex-wrap sm:items-end sm:px-5";
export const TRACK_ACTION_CLASS = "flex h-8 w-8 shrink-0 items-center justify-center transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent";

export function formatCollectionDuration(seconds) {
    if (!seconds) return null;
    const minutes = Math.round(seconds / 60);
    const hours = Math.floor(minutes / 60);
    return hours > 0 ? `${hours} hr ${minutes % 60} min` : `${minutes} min`;
}

export function trackRowClassName({ dense = false, collection = true, active = false } = {}) {
    return `group relative flex w-full items-center rounded-md transition-colors hover:bg-elevated ${dense ? DENSE_TRACK_ROW_CLASS : collection ? TRACK_ROW_CLASS : "h-[60px] gap-3 p-2"} ${active ? "bg-elevated" : ""}`;
}

// Queue, playlists and liked songs use the same actual row structure. Only
// their controls and the optional queue metadata differ.
export function TrackRowContent({ leading, artwork, title, artist, artistBrowseId, current = false, collection = true, metadata, like, duration, menu }) {
    return (
        <>
            {leading}
            {artwork}
            <div className={TRACK_DETAILS_CLASS}>
                <span className={`truncate text-[13px] ${collection ? "font-medium" : ""} ${current ? "text-accent" : "text-maintext"}`}>{title}</span>
                <ArtistLink name={artist} browseId={artistBrowseId} className="text-[11px] text-subtext" />
            </div>
            {metadata}
            {like}
            {duration}
            {menu}
        </>
    );
}

export function TrackTableHeader({ children }) {
    return (
        <div className="mb-1 flex h-8 items-center gap-2 border-b border-border/60 px-2 text-xs font-medium text-subtext">
            <span className={TRACK_NUMBER_CLASS}>#</span>
            <span className="min-w-0 flex-1">Title</span>
            {children}
            <span className="w-8 shrink-0" />
            <span className="flex w-12 shrink-0 justify-end" title="Duration"><Icon name="clock" className="h-4 w-4" /><span className="sr-only">Duration</span></span>
            <span className="w-8 shrink-0" />
        </div>
    );
}

export function CollectionHeader({ artwork, icon, eyebrow, title, children }) {
    return (
        <div className={COLLECTION_HEADER_CLASS}>
            {icon ? (
                <span className={`flex ${COLLECTION_COVER_SIZE_CLASS} items-center justify-center rounded-xl bg-gradient-to-br from-accent to-accent/40 text-canvas shadow-2xl`}>
                    <Icon name={icon} className="h-16 w-16" />
                </span>
            ) : (
                <img
                    src={artworkOrFallback(artwork)}
                    onError={(event) => (event.currentTarget.src = artworkOrFallback(null))}
                    className={`${COLLECTION_COVER_SIZE_CLASS} rounded-xl object-cover shadow-2xl ring-1 ring-white/10`}
                    alt=""
                />
            )}
            <div className="flex min-w-0 flex-col gap-2 pb-1 drop-shadow-sm sm:min-w-[200px] sm:flex-1">
                {eyebrow && <span className="text-xs font-semibold text-maintext/80">{eyebrow}</span>}
                <h1 className="break-words text-3xl font-extrabold leading-[1.08] tracking-tight sm:text-4xl xl:text-5xl">{title}</h1>
                {children}
            </div>
        </div>
    );
}
