import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";

import { useNifty } from "../../context/NiftyContext.js";
import { artworkOrFallback } from "../../lib/format.js";
import Icon from "../Icon.js";
import { motion, Reorder, EASE, LoadingSwap, useEntrance, EntranceBoundary } from "../motion/index.js";
import { useContextMenu } from "../menu/ContextMenu.js";
import { useEntityMenu } from "../menu/entityMenu.js";
import SortDropdown from "../menu/SortDropdown.js";
import { useModal } from "../modal/Modal.js";
import Loader, { TrackListSkeleton } from "../Loader.js";

const useBeforePaint = typeof window === "undefined" ? useEffect : useLayoutEffect;

const SORTS = [
    { id: "custom", label: "Custom order", icon: "grip" },
    { id: "recent", label: "Recently added", icon: "history" },
    { id: "alpha", label: "Alphabetical", icon: "sort" }
];

const LIKED_ITEM = {
    kind: "playlist",
    custom: true,
    liked: true,
    browseId: "nifty:playlist:liked",
    title: "Liked songs"
};

function NavButton({ active, onClick, icon, label }) {
    return (
        <button
            onClick={onClick}
            className={`flex w-full items-center gap-4 rounded-md px-3 py-2 text-sm font-bold transition-colors ${active ? "text-maintext" : "text-subtext hover:text-maintext"}`}
        >
            {icon}
            {label}
        </button>
    );
}

function CreatePlaylistForm({ close }) {
    const { createPlaylist, openEntity } = useNifty();
    const [name, setName] = useState("");
    const [saving, setSaving] = useState(false);
    const [error, setError] = useState(false);
    const submit = async (event) => {
        event.preventDefault();
        if (!name.trim() || saving) return;
        setSaving(true);
        setError(false);
        const playlist = await createPlaylist(name.trim());
        setSaving(false);
        if (!playlist) { setError(true); return; }
        close();
        openEntity("playlist", `nifty:playlist:${playlist.id}`);
    };
    return (
        <form onSubmit={submit} className="flex flex-col gap-5">
            <p className="text-sm leading-relaxed text-subtext">A place for your next favorite songs.</p>
            <label className="flex flex-col gap-2 text-xs font-semibold text-maintext">
                Playlist name
                <input autoFocus required maxLength={100} value={name} onChange={(event) => setName(event.target.value)} placeholder="Give it a name" className="h-12 rounded-lg border border-border bg-elevated px-3 text-sm font-normal text-maintext outline-none placeholder:text-subtext focus:border-accent" />
            </label>
            {error && <p role="alert" className="text-xs text-subtext">Couldn&apos;t create your playlist. Please try again.</p>}
            <div className="flex items-center justify-end gap-3">
                <button type="button" onClick={() => close()} className="min-h-10 rounded-full px-4 text-sm font-semibold text-subtext hover:text-maintext">Cancel</button>
                <button type="submit" disabled={!name.trim() || saving} className="flex min-h-10 items-center gap-2 rounded-full bg-accent px-5 text-sm font-bold text-canvas transition hover:brightness-110 disabled:opacity-40">{saving ? <Loader size="sm" delay={0} className="text-canvas" /> : <Icon name="plus" className="h-4 w-4" />}Create</button>
            </div>
        </form>
    );
}

function RowBody({ item, likedCount }) {
    return (
        <>
            {item.liked ? (
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-accent to-accent/40 text-canvas">
                    <Icon name="heart-filled" className="h-5 w-5" />
                </span>
            ) : item.custom && !item.artwork ? (
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-elevated text-subtext"><Icon name="music" className="h-5 w-5" /></span>
            ) : (
                <img
                    src={artworkOrFallback(item.artwork)}
                    onError={(e) => (e.currentTarget.src = artworkOrFallback(null))}
                    className={`h-12 w-12 shrink-0 object-cover ${item.kind === "artist" ? "rounded-full" : "rounded-md"}`}
                    alt=""
                />
            )}
            <div className="flex min-w-0 flex-col gap-1.5 leading-tight">
                <span className="truncate text-[13px] font-semibold text-maintext">{item.title}</span>
                <span className="truncate text-xs capitalize text-subtext">
                    {item.liked ? `${likedCount} song${likedCount === 1 ? "" : "s"}` : item.subtitle || item.kind}
                </span>
            </div>
        </>
    );
}

// One shelf row: opens its page on click, full entity menu on right-click.
function LibraryRow({ item, likedCount = 0, draggable = false, grouped = false, onCommit }) {
    const { openEntity } = useNifty();
    const entityMenu = useEntityMenu();
    const { onContextMenu, active } = useContextMenu(() => entityMenu(item));

    const [dragging, setDragging] = useState(false);
    const draggedRef = useRef(false);

    const open = () => {
        if (draggedRef.current) return;
        openEntity(item.kind === "artist" ? "artist" : item.kind, item.browseId);
    };

    const className = `flex min-h-16 w-full cursor-pointer select-none items-center gap-3 rounded-lg px-2 py-2 text-left transition-colors hover:bg-elevated ${active || dragging ? "bg-elevated" : ""}`;

    if (!grouped) {
        return (
            <motion.div
                layout="position"
                initial={false}
                transition={{ duration: 0.2, ease: EASE }}
                onClick={open}
                onContextMenu={onContextMenu}
                className={className}
            >
                <RowBody item={item} likedCount={likedCount} />
            </motion.div>
        );
    }

    return (
        <Reorder.Item
            as="div"
            value={item}
            initial={false}
            layout="position"
            dragListener={draggable}
            drag={draggable ? "y" : false}
            transition={{ duration: 0.2, ease: EASE }}
            whileDrag={{ boxShadow: "0 12px 28px rgb(0 0 0 / 0.45)", cursor: "grabbing" }}
            onDragStart={() => { draggedRef.current = true; setDragging(true); }}
            onDragEnd={() => {
                setDragging(false);
                onCommit?.(item);
                setTimeout(() => { draggedRef.current = false; }, 0);
            }}
            onClick={open}
            onContextMenu={onContextMenu}
            className={className}
        >
            <RowBody item={item} likedCount={likedCount} />
        </Reorder.Item>
    );
}

export default function LeftSidebar() {
    const reveal = useEntrance(0.04, { distance: 8, fade: false });
    const { view, setView, library, reorderLibraryItem, settings, updateSettings } = useNifty();
    const modal = useModal();

    const sort = settings.librarySort || "custom";
    const descending = settings.librarySortDesc ?? (sort === "recent");
    const likedCount = library.likedUrls.length;

    // Local order mirrors the shelf while dragging (custom sort only).
    const [order, setOrder] = useState(library.items);
    const orderRef = useRef(order);
    orderRef.current = order;
    useBeforePaint(() => setOrder(library.items), [library.items]);

    const sorted = useMemo(() => {
        const direction = descending ? -1 : 1;
        if (sort === "recent") return [...library.items].sort((a, b) => (new Date(a.addedAt) - new Date(b.addedAt)) * direction);
        if (sort === "alpha") return [...library.items].sort((a, b) => (a.title || "").localeCompare(b.title || "") * direction);
        return order;
    }, [sort, descending, library.items, order]);

    const commitDrag = (item) => {
        const index = orderRef.current.findIndex((i) => i.itemId === item.itemId);
        if (index >= 0) reorderLibraryItem(item.itemId, index, orderRef.current);
    };

    return (
        <motion.aside {...reveal} data-panel="left" className="hidden w-[var(--left-w)] shrink-0 flex-col gap-2 md:flex">

            {/* Nav card */}
            <nav className="space-y-1 rounded-lg bg-surface p-2">
                <NavButton
                    active={view === "home"}
                    onClick={() => setView("home")}
                    label="Home"
                    icon={<Icon name="home" className="h-6 w-6" />}
                />
                <NavButton
                    active={view === "search"}
                    onClick={() => setView("search")}
                    label="Search"
                    icon={<Icon name="search" className="h-6 w-6" />}
                />
                <NavButton
                    active={view === "queue"}
                    onClick={() => setView("queue")}
                    label="Queue"
                    icon={<Icon name="queue" className="h-6 w-6" />}
                />
            </nav>

            <div className="relative flex min-h-0 flex-1 flex-col rounded-lg bg-surface">
                <div className="flex min-h-0 flex-1 flex-col">
                <div className="flex items-center gap-2.5 px-4 pb-3 pt-4 text-sm font-semibold text-maintext">
                    <Icon name="library-lines" className="h-5 w-5 text-subtext" />
                    <span className="min-w-0 truncate">Your library</span>
                    <div className="ml-auto flex items-center gap-1">
                        <button
                            onClick={() => modal.open({ title: "Create playlist", size: "sm", render: ({ close }) => <CreatePlaylistForm close={close} /> })}
                            title="Create a playlist"
                            aria-label="Create a playlist"
                            className="flex h-9 w-9 items-center justify-center text-subtext transition-colors hover:text-maintext"
                        >
                            <Icon name="playlist-add" className="h-5 w-5" />
                        </button>
                    </div>
                </div>
                <div className="mb-1 flex items-center justify-between border-t border-border/30 px-3 pt-1">
                    <span className="pl-1 text-[11px] text-subtext">Collections & artists</span>
                    <SortDropdown options={SORTS} value={sort} onChange={(librarySort) => updateSettings({ librarySort, librarySortDesc: librarySort === "recent" })} descending={descending} onDirectionChange={(librarySortDesc) => updateSettings({ librarySortDesc })} label="Sort library" compact />
                </div>

                <EntranceBoundary>
                <LoadingSwap loading={!library.loaded} fallback={<TrackListSkeleton rows={6} rowHeight={64} fill label="Loading your library" />} className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
                    {/* Liked songs is pinned — it isn't a shelf row */}
                    <LibraryRow item={LIKED_ITEM} likedCount={likedCount} />

                    <Reorder.Group axis="y" as="div" values={sort === "custom" ? order : sorted} onReorder={sort === "custom" ? setOrder : () => {}}>
                        {(sort === "custom" ? order : sorted).map((item) => (
                            <LibraryRow key={item.itemId} item={item} grouped draggable={sort === "custom"} onCommit={commitDrag} />
                        ))}
                    </Reorder.Group>

                    {library.items.length === 0 && (
                        <div className="px-3 py-6 text-center text-[11px] leading-relaxed text-subtext">
                            Save albums, artists and playlists — or create your own — and
                            they&apos;ll live here.
                        </div>
                    )}
                </LoadingSwap>
                </EntranceBoundary>
                </div>
            </div>
        </motion.aside>
    );
}
