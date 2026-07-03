import { parse } from "cookie";

import { verifySession } from "../../lib/jwt.js";
import {
    ensureUser,
    saveCollection,
    unsaveCollection,
    getSavedRefs,
    likeTrack,
    unlikeTrack,
    listLibrary,
    getLibraryState,
    createPlaylist,
    addTracksToPlaylist,
    reorderLibrary
} from "../../lib/db.js";
import { parseEntityId } from "../../sources/ids.js";
import { parseLink, externalUrl } from "../../sources/links.js";

// The user's library: the ordered shelf (custom playlists + saved
// collections), liked tracks, and playlist editing.
//
//   GET  /api/library?view=list     -> { items }                 (the shelf)
//   GET  /api/library?view=state    -> { savedRefs, likedUrls, playlists }
//   GET  /api/library?refs=a,b      -> { saved: [refs...] }      (heart states)
//   POST { action: "save"|"unsave", entity }
//   POST { action: "like"|"unlike", track }
//   POST { action: "create_playlist", name }
//   POST { action: "add_to_playlist", playlistId, tracks: [...] }
//   POST { action: "reorder", itemId, toIndex }

export default async function handler(req, res) {

    const cookies = parse(req.headers.cookie || "");
    const user = await verifySession(cookies.session);
    if (!user) {
        return res.status(401).json({ message: "Not authenticated." });
    }

    try {

        if (req.method === "GET") {
            res.setHeader("Cache-Control", "no-store");

            if (req.query.view === "list") {
                return res.status(200).json({ items: await listLibrary(user.id) });
            }
            if (req.query.view === "state") {
                return res.status(200).json(await getLibraryState(user.id));
            }

            const refs = String(req.query.refs || "").split(",").filter(Boolean);
            return res.status(200).json({ saved: await getSavedRefs(user.id, refs) });
        }

        const { action } = req.body || {};

        if (action === "save" || action === "unsave") {
            const entity = req.body.entity || {};
            const parsed = parseEntityId(entity.browseId);
            if (!parsed || !["album", "playlist", "artist"].includes(entity.kind)) {
                return res.status(400).json({ message: "Invalid entity." });
            }

            const sourceUrl = entity.url || externalUrl(parsed.source, parsed.kind, parsed.id) || entity.browseId;

            await ensureUser(user);
            if (action === "save") {
                await saveCollection(user.id, {
                    kind: entity.kind,
                    source: parsed.source,
                    sourceUrl,
                    browseRef: entity.browseId,
                    name: entity.title,
                    subtitle: entity.subtitle,
                    artwork: entity.artwork
                });
            } else {
                await unsaveCollection(user.id, sourceUrl);
            }
            return res.status(200).json({ saved: action === "save" });
        }

        if (action === "like" || action === "unlike") {
            const track = req.body.track || {};
            const parsed = parseLink(track.url);
            if (!parsed || parsed.kind !== "track") {
                return res.status(400).json({ message: "Track link not recognised." });
            }

            await ensureUser(user);
            if (action === "like") {
                const added = await likeTrack(user.id, track, parsed);
                return res.status(200).json({ liked: true, already: !added });
            }
            await unlikeTrack(user.id, parsed);
            return res.status(200).json({ liked: false });
        }

        if (action === "create_playlist") {
            const name = String(req.body.name || "").trim().slice(0, 100);
            if (!name) {
                return res.status(400).json({ message: "A playlist needs a name." });
            }
            await ensureUser(user);
            const playlist = await createPlaylist(user.id, name);
            return res.status(200).json({ playlist });
        }

        if (action === "add_to_playlist") {
            const { playlistId } = req.body || {};
            const rawTracks = Array.isArray(req.body.tracks) ? req.body.tracks : [];

            const resolvable = rawTracks
                .map((item) => ({ item, parsedLink: parseLink(item?.url) }))
                .filter((t) => t.parsedLink && t.parsedLink.kind === "track");

            if (!playlistId || !resolvable.length) {
                return res.status(400).json({ message: "Nothing addable in that selection." });
            }

            await ensureUser(user);
            const added = await addTracksToPlaylist(user.id, playlistId, resolvable);
            return res.status(200).json({ added, skipped: rawTracks.length - resolvable.length });
        }

        if (action === "reorder") {
            const itemId = String(req.body.itemId || "");
            const toIndex = Number(req.body.toIndex);
            if (!itemId || !Number.isInteger(toIndex) || toIndex < 0) {
                return res.status(400).json({ message: "Invalid reorder." });
            }
            await reorderLibrary(user.id, itemId, toIndex);
            return res.status(200).json({ ok: true });
        }

        return res.status(400).json({ message: "Unknown action." });

    } catch (error) {
        console.error("[Dashboard] /api/library failed:", error.message);
        return res.status(500).json({ message: error.message || "Database unavailable." });
    }

}
