import { COLLECTION_HEADER_CLASS, TRACK_ROW_HEIGHT, TRACK_TABLE_GUTTER_CLASS } from "./browse/trackTable.js";
import PanelHeader from "./layout/PanelHeader.js";
import { useRef } from "react";
import { COLLECTION_COVER_SIZE_CLASS, DENSE_TRACK_ROW_HEIGHT, LYRIC_LINE_HEIGHT_CLASS, MUSIC_CARD_BODY_CLASS, MUSIC_CARD_CONTENT_GAP, MUSIC_CARD_HEIGHT_CLASS, MUSIC_CARD_TEXT_HEIGHT, MUSIC_CARD_WIDE_WIDTH, MUSIC_CARD_WIDTH, MUSIC_CARD_WIDTH_CLASS, MUSIC_GRID_CLASS, MUSIC_RAIL_CLASS, useSkeletonCount } from "./skeletonLayout.js";

// A small sound wave for indeterminate work. Content-shaped skeletons below
// reserve the space for lists and collections while their data arrives.
const SIZES = {
    sm: { "--loader-width": "3px", "--loader-height": "15px", "--loader-gap": "3px" },
    md: { "--loader-width": "4px", "--loader-height": "24px", "--loader-gap": "4px" },
    lg: { "--loader-width": "5px", "--loader-height": "32px", "--loader-gap": "5px" }
};
const wideLayout = () => window.matchMedia("(min-width: 640px)").matches;
const cardWidth = () => wideLayout() ? MUSIC_CARD_WIDE_WIDTH : MUSIC_CARD_WIDTH;
const shelfHeight = () => wideLayout() ? 284 : 260;
const shelfGap = () => wideLayout() ? 40 : 36;
const lyricPitch = () => wideLayout() ? 76 : 73.5;
const gridColumns = (element) => getComputedStyle(element).gridTemplateColumns.split(" ").length;
const gridItemHeight = (element) => {
    const columns = gridColumns(element);
    return (element.getBoundingClientRect().width - 8 * (columns - 1)) / columns + MUSIC_CARD_TEXT_HEIGHT + MUSIC_CARD_CONTENT_GAP;
};

export default function Loader({ size = "md", delay = 0.2, className = "text-accent", label = "Loading" }) {
    return (
        <span role="status" aria-label={label} className={`loader ${className}`} style={{ ...SIZES[size], "--loader-delay": `${delay}s` }}>
            {Array.from({ length: 5 }, (_, i) => <span key={i} aria-hidden="true" />)}
        </span>
    );
}

export function PageLoader({ className = "", ...props }) {
    return (
        <div className={`pointer-events-none flex min-h-40 flex-1 items-center justify-center ${className}`}>
            <Loader size="lg" {...props} />
        </div>
    );
}

export function Skeleton({ className = "", style }) {
    return <div aria-hidden="true" className={`skeleton shrink-0 rounded-md ${className}`} style={style} />;
}

// Keep the cover and the title/artist group legible without drawing a fake
// control for every live button. The row pitch still matches virtualization.
export function TrackListSkeleton({ rows = 6, count, dense = false, rowHeight, rowGap = 0, fill = false, numbered = rowHeight == null && !dense, className = "", label = "Loading tracks" }) {
    const ref = useRef(null);
    const height = rowHeight ?? (dense ? DENSE_TRACK_ROW_HEIGHT : TRACK_ROW_HEIGHT);
    const visibleRows = useSkeletonCount(ref, { fill, minimum: count ?? rows, itemHeight: height, gap: rowGap });
    const artworkSize = dense || height <= 52 ? 36 : height === 64 ? 48 : height > TRACK_ROW_HEIGHT ? 44 : 40;
    const history = height === 76;
    const spacing = history ? "gap-3 px-2 sm:gap-4 sm:px-3" : dense || height === TRACK_ROW_HEIGHT ? "gap-2 px-2" : "gap-3 px-2";
    return (
        <div ref={ref} role="status" aria-label={label} className={`flex w-full shrink-0 flex-col ${className}`} style={{ gap: rowGap }}>
            {Array.from({ length: visibleRows }, (_, i) => (
                <div key={i} aria-hidden="true" data-skeleton-row className={`flex shrink-0 items-center ${spacing}`} style={{ height }}>
                    {numbered && <div className={numbered === "compact" ? "hidden w-7 shrink-0 sm:block" : "w-8 shrink-0"} />}
                    <Skeleton style={{ height: artworkSize, width: artworkSize }} />
                    <div className="min-w-0 flex-1">
                        <Skeleton className={`${history ? "h-10" : "h-8"} max-w-80`} style={{ width: `${[72, 88, 62, 80, 68][i % 5]}%` }} />
                    </div>
                </div>
            ))}
        </div>
    );
}

export function CollectionSkeleton({ className = "", queue = false, liked = false }) {
    return (
        <div role="status" aria-label="Loading collection" className={`w-full shrink-0 pb-8 ${className}`}>
            <div aria-hidden="true" className={COLLECTION_HEADER_CLASS}>
                <Skeleton className={`${COLLECTION_COVER_SIZE_CLASS} !rounded-xl`} />
                <div className="min-w-0 pb-1 sm:min-w-[200px] sm:flex-1">
                    <Skeleton className="h-[116px] w-full max-w-[520px]" />
                </div>
            </div>
            <div className={TRACK_TABLE_GUTTER_CLASS}>
                <div aria-hidden="true" className="flex flex-wrap items-center justify-between gap-3 pb-4">
                    <Skeleton className={`h-12 ${queue ? "w-12" : liked ? "w-56" : "w-[276px]"}`} />
                    {!queue && <Skeleton className="h-8 w-[162px]" />}
                </div>
                <div aria-hidden="true" className="mb-1 flex h-8 items-center border-b border-border/60 px-2"><Skeleton className="h-3 w-1/3 max-w-40" /></div>
                <TrackListSkeleton rows={9} fill />
            </div>
        </div>
    );
}

export function CardsSkeleton({ count = 8, className = "" }) {
    const ref = useRef(null);
    const visibleCards = useSkeletonCount(ref, { fill: true, minimum: count, itemHeight: cardWidth, gap: 4, axis: "x" });
    return (
        <div ref={ref} role="status" aria-label="Loading recommendations" className={`${MUSIC_RAIL_CLASS} shrink-0 overflow-hidden ${className}`}>
            {Array.from({ length: visibleCards }, (_, i) => (
                <div key={i} aria-hidden="true" data-skeleton-card className={`${MUSIC_CARD_WIDTH_CLASS} ${MUSIC_CARD_HEIGHT_CLASS} shrink-0`}>
                    <div className={MUSIC_CARD_BODY_CLASS}>
                        <Skeleton className="aspect-square w-full" />
                        <Skeleton className="h-9 w-full" />
                    </div>
                </div>
            ))}
        </div>
    );
}

export function GridSkeleton({ count = 4, className = "", label = "Loading music" }) {
    const ref = useRef(null);
    const visibleCards = useSkeletonCount(ref, { fill: true, minimum: count, itemHeight: gridItemHeight, gap: 8, columns: gridColumns });
    return (
        <div ref={ref} role="status" aria-label={label} className={`${MUSIC_GRID_CLASS} ${className}`}>
            {Array.from({ length: visibleCards }, (_, i) => (
                <div key={i} aria-hidden="true" className={MUSIC_CARD_BODY_CLASS}>
                    <Skeleton className="aspect-square w-full" />
                    <Skeleton className="h-9 w-full" />
                </div>
            ))}
        </div>
    );
}

export function LyricsSkeleton() {
    const ref = useRef(null);
    const lineCount = useSkeletonCount(ref, { fill: true, minimum: 3, itemHeight: lyricPitch, viewport: "self" }) + 2;
    const referenceLine = Math.floor((lineCount - 1) / 2);
    const widths = ["70%", "52%", "84%", "61%", "45%", "76%", "58%", "68%"];
    return (
        <div ref={ref} role="status" aria-label="Loading lyrics" className="relative h-full min-h-0 flex-1 overflow-hidden">
            {/* Real synced lyrics scroll around the active verse. Place a
                reference verse at the same center, with neighbors both above
                and below it instead of leaving half the loading view empty. */}
            <div className="absolute inset-x-0 top-1/2 flex flex-col gap-9 px-8 [--verse-height:37.5px] [--verse-pitch:73.5px] sm:px-14 sm:[--verse-height:40px] sm:[--verse-pitch:76px]" style={{ transform: `translateY(calc(-${referenceLine} * var(--verse-pitch) - var(--verse-height) / 2))` }}>
                {Array.from({ length: lineCount }, (_, i) => (
                    <Skeleton key={i} className={`${LYRIC_LINE_HEIGHT_CLASS} !bg-lyric/10`} style={{ width: widths[i % widths.length] }} />
                ))}
            </div>
        </div>
    );
}

// Reserve the same first-screen structure as the home feed. These are whole
// quick-pick and shelf blocks, not a miniature placeholder for every label.
export function HomeSkeleton() {
    const shelves = useRef(null);
    const shelfCount = useSkeletonCount(shelves, { fill: true, minimum: 2, itemHeight: shelfHeight, gap: shelfGap });
    return (
        <div role="status" aria-label="Loading your recommendations" className="flex w-full shrink-0 flex-col gap-9 sm:gap-10">
            <div aria-hidden="true" className="grid gap-2.5 [grid-template-columns:repeat(auto-fit,minmax(min(100%,240px),1fr))]">
                {Array.from({ length: 8 }, (_, i) => <Skeleton key={i} className="h-[72px] !rounded-lg" />)}
            </div>
            <div ref={shelves} className="flex min-w-0 flex-col gap-9 sm:gap-10">
            {Array.from({ length: shelfCount }, (_, i) => (
                <div key={i} aria-hidden="true" className="flex min-w-0 flex-col gap-4">
                    <div className={`flex items-start ${i === 0 ? "h-[51.5px] sm:h-[55.5px]" : "h-7 sm:h-8"}`}>
                        <Skeleton className="h-7 w-64 max-w-[65%] sm:h-8" />
                    </div>
                    <CardsSkeleton />
                </div>
            ))}
            </div>
        </div>
    );
}

export function ArtistSkeleton() {
    return (
        <div role="status" aria-label="Loading artist" className="w-full shrink-0">
            <div aria-hidden="true" className="flex items-end gap-6 px-6 pb-6 pt-20">
                <Skeleton className="h-44 w-44 !rounded-full" />
                <Skeleton className="h-24 min-w-0 flex-1 sm:h-32" />
            </div>
            <div aria-hidden="true" className="px-6 py-4"><Skeleton className="h-10 w-40" /></div>
            <div className="flex flex-col gap-1 px-4 py-4">
                <div aria-hidden="true" className="h-9 px-2"><Skeleton className="h-7 w-32" /></div>
                <TrackListSkeleton rows={5} rowHeight={60} rowGap={4} numbered="compact" />
            </div>
            <div aria-hidden="true" className="flex flex-col gap-3 px-6 pb-8">
                <Skeleton className="h-7 w-40" />
                <GridSkeleton />
            </div>
        </div>
    );
}

export function NowPlayingSkeleton() {
    return (
        <div role="status" aria-label="Loading now playing" className="w-full shrink-0">
            <div aria-hidden="true"><PanelHeader icon="now-playing" title="Now playing" /></div>
            <div aria-hidden="true" className="flex flex-col gap-4 p-4 pt-0">
                <Skeleton className="aspect-square w-full !rounded-lg" />
                <Skeleton className="h-[49px] w-full" />
                <Skeleton className="h-[22px] w-2/3" />
                <SongInfoSkeleton />
            </div>
        </div>
    );
}

export function SongInfoSkeleton() {
    return (
        <div role="status" aria-label="Loading song details" className="flex flex-col gap-4 border-t border-border/60 pt-4">
            <Skeleton className="h-28 w-full" />
            <Skeleton className="h-32 w-full" />
        </div>
    );
}

export function HistorySkeleton() {
    return (
        <div role="status" aria-label="Loading listening history" className="flex w-full flex-col">
            <div aria-hidden="true" className="mb-3 px-2"><Skeleton className="h-7 w-40" /></div>
            <div aria-hidden="true" className="mb-1 flex h-11 items-center border-b border-border/50 px-3"><Skeleton className="h-4 w-52 max-w-full" /></div>
            <TrackListSkeleton rows={6} rowHeight={76} fill />
        </div>
    );
}
