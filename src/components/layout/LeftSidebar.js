import { useEffect, useMemo, useRef, useState } from "react";

import { useNifty } from "../../context/NiftyContext.js";
import { artworkOrFallback } from "../../lib/format.js";
import Icon from "../Icon.js";
import { AnimatePresence, motion, Reorder, entrance, EASE } from "../motion/index.js";
import LoadingWash from "../skeleton/index.js";
import { useContextMenu } from "../menu/ContextMenu.js";
import { useEntityMenu } from "../menu/entityMenu.js";

const SORTS = [
    { id: "custom", label: "Custom order" },
    { id: "recent", label: "Recently added" },
    { id: "alpha", label: "Alphabetical" }
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
            className={`flex w-full items-center gap-4 rounded-md px-3 py-2 text-sm font-bold transition ${active ? "text-maintext" : "text-subtext hover:text-maintext"}`}
        >
            {icon}
            {label}
        </button>
    );
}

function RowBody({ item, likedCount }) {
    return (
        <>
            {item.liked ? (
                <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-md bg-gradient-to-br from-accent to-accent/40 text-canvas">
                    <Icon name="heart-filled" className="h-5 w-5" />
                </span>
            ) : (
                <img
                    src={artworkOrFallback(item.artwork)}
                    onError={(e) => (e.currentTarget.src = artworkOrFallback(null))}
                    className={`h-12 w-12 shrink-0 object-cover ${item.kind === "artist" ? "rounded-full" : "rounded-md"}`}
                    alt=""
                />
            )}
            <div className="flex min-w-0 flex-col leading-tight">
                <span className="truncate text-[13px] font-bold text-maintext">{item.title}</span>
                <span className="truncate text-[11px] capitalize text-subtext">
                    {item.liked ? `${likedCount} song${likedCount === 1 ? "" : "s"}` : item.subtitle || item.kind}
                </span>
            </div>
        </>
    );
}

// One shelf row: opens its page on click, full entity menu on right-click.
function LibraryRow({ item, likedCount = 0, draggable = false, onCommit }) {
    const { openEntity } = useNifty();
    const entityMenu = useEntityMenu();
    const { onContextMenu, active } = useContextMenu(() => entityMenu(item));

    const [dragging, setDragging] = useState(false);
    const draggedRef = useRef(false);

    const open = () => {
        if (draggedRef.current) return;
        openEntity(item.kind === "artist" ? "artist" : item.kind, item.browseId);
    };

    const className = `flex w-full cursor-pointer select-none items-center gap-3 rounded-md px-2 py-1.5 text-left transition-colors hover:bg-elevated ${active || dragging ? "bg-elevated" : ""}`;

    if (!draggable) {
        return (
            <motion.div
                layout
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -10 }}
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
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
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
    const { view, setView, library, createPlaylist, reorderLibraryItem, settings, updateSettings } = useNifty();

    const sort = settings.librarySort || "custom";
    const likedCount = library.likedUrls.length;

    // Local order mirrors the shelf while dragging (custom sort only).
    const [order, setOrder] = useState(library.items);
    const orderRef = useRef(order);
    orderRef.current = order;
    useEffect(() => setOrder(library.items), [library.items]);

    const sorted = useMemo(() => {
        if (sort === "recent") return [...library.items].sort((a, b) => new Date(b.addedAt) - new Date(a.addedAt));
        if (sort === "alpha") return [...library.items].sort((a, b) => (a.title || "").localeCompare(b.title || ""));
        return order;
    }, [sort, library.items, order]);

    // The sort picker reuses the context-menu panel, opened from a plain click.
    const { onContextMenu: openSortMenu } = useContextMenu(() =>
        SORTS.map((s) => ({
            label: s.label,
            icon: sort === s.id ? "check" : undefined,
            onClick: () => updateSettings({ librarySort: s.id })
        }))
    );

    // Inline "create playlist" name input, toggled by the + button.
    const [creating, setCreating] = useState(false);
    const [name, setName] = useState("");
    const submitCreate = async (e) => {
        e.preventDefault();
        const trimmed = name.trim();
        setCreating(false);
        setName("");
        if (trimmed) await createPlaylist(trimmed);
    };

    const commitDrag = (item) => {
        const index = orderRef.current.findIndex((i) => i.itemId === item.itemId);
        if (index >= 0) reorderLibraryItem(item.itemId, index, orderRef.current);
    };

    return (
        <motion.aside {...entrance(0)} className="hidden w-[300px] shrink-0 flex-col gap-2 md:flex">

            {/* Nav card */}
            <nav className="rounded-lg bg-surface p-2">
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

            {/* Library — the whole card washes until the shelf lands */}
            <div className="relative flex min-h-0 flex-1 flex-col rounded-lg bg-surface">
                <LoadingWash show={!library.loaded} sweep="narrow" />

                {library.loaded && (
                <motion.div {...entrance(0)} className="flex min-h-0 flex-1 flex-col">
                <div className="flex items-center gap-3 px-4 pb-2 pt-4 text-xs font-bold text-subtext">
                    <Icon name="library" className="h-5 w-5" />
                    Library
                    <div className="ml-auto flex items-center gap-1">
                        <button
                            onClick={openSortMenu}
                            title="Sort library"
                            className="flex h-7 w-7 items-center justify-center rounded-full text-subtext transition hover:bg-elevated hover:text-maintext"
                        >
                            <Icon name="list" className="h-4 w-4" />
                        </button>
                        <button
                            onClick={() => setCreating((c) => !c)}
                            title="Create a playlist"
                            className="flex h-7 w-7 items-center justify-center rounded-full text-subtext transition hover:bg-elevated hover:text-maintext"
                        >
                            <Icon name="enqueue" className="h-4 w-4" />
                        </button>
                    </div>
                </div>

                <AnimatePresence initial={false}>
                    {creating && (
                        <motion.form
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: "auto" }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2, ease: EASE }}
                            onSubmit={submitCreate}
                            className="overflow-hidden px-3"
                        >
                            <input
                                autoFocus
                                value={name}
                                onChange={(e) => setName(e.target.value)}
                                onKeyDown={(e) => e.key === "Escape" && setCreating(false)}
                                onBlur={() => !name.trim() && setCreating(false)}
                                placeholder="Playlist name — Enter to create"
                                className="mb-2 w-full rounded-md bg-elevated px-3 py-2 text-[13px] text-maintext placeholder-subtext outline-none ring-accent/60 focus:ring-2"
                            />
                        </motion.form>
                    )}
                </AnimatePresence>

                <div className="min-h-0 flex-1 overflow-y-auto px-2 pb-2">
                    {/* Liked songs is pinned — it isn't a shelf row */}
                    <LibraryRow item={LIKED_ITEM} likedCount={likedCount} />

                    {sort === "custom" ? (
                        <Reorder.Group axis="y" as="div" values={order} onReorder={setOrder}>
                            <AnimatePresence initial={false}>
                                {order.map((item) => (
                                    <LibraryRow key={item.itemId} item={item} draggable onCommit={commitDrag} />
                                ))}
                            </AnimatePresence>
                        </Reorder.Group>
                    ) : (
                        <AnimatePresence initial={false}>
                            {sorted.map((item) => (
                                <LibraryRow key={item.itemId} item={item} />
                            ))}
                        </AnimatePresence>
                    )}

                    {library.items.length === 0 && (
                        <div className="px-3 py-6 text-center text-[11px] leading-relaxed text-subtext">
                            Save albums, artists and playlists — or create your own — and
                            they&apos;ll live here.
                        </div>
                    )}
                </div>
                </motion.div>
                )}
            </div>
        </motion.aside>
    );
}
