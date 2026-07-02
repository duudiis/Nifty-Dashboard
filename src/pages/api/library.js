import { parse } from "cookie";

import { verifySession } from "../../lib/jwt.js";
import {
    ensureUser,
    saveCollection,
    unsaveCollection,
    getSavedRefs,
    likeTrack,
    unlikeTrack
} from "../../lib/db.js";
import { parseEntityId } from "../../sources/ids.js";
import { parseLink, externalUrl } from "../../sources/links.js";

// The user's library: saved collections (albums / playlists / artists, stored
// as live platform pointers) and liked tracks (stored against the shared
// track catalog).
//
//   GET  /api/library?refs=a,b,c   -> { saved: [refs...] }   (heart states)
//   POST /api/library { action: "save"|"unsave", entity: { browseId, kind, title, subtitle, artwork, url } }
//   POST /api/library { action: "like"|"unlike", track: { title, artist, artwork, duration, url } }

export default async function handler(req, res) {

    const cookies = parse(req.headers.cookie || "");
    const user = await verifySession(cookies.session);
    if (!user) {
        return res.status(401).json({ message: "Not authenticated." });
    }

    try {

        if (req.method === "GET") {
            const refs = String(req.query.refs || "").split(",").filter(Boolean);
            const saved = await getSavedRefs(user.id, refs);
            res.setHeader("Cache-Control", "no-store");
            return res.status(200).json({ saved });
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

        return res.status(400).json({ message: "Unknown action." });

    } catch (error) {
        console.error("[Dashboard] /api/library failed:", error.message);
        return res.status(500).json({ message: "Database unavailable." });
    }

}
