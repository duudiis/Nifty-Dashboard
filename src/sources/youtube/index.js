// YouTube Music source — a thin adapter over the existing InnerTube client.
// Kept registered (but no longer the default) so the source layer stays
// genuinely multi-source; the heavy parsing still lives in ../../innertube.

import InnerTube from "../../innertube/index.js";
import { buildEntityId } from "../ids.js";

const ID = "youtube";
const inner = new InnerTube();

// Namespace entity browseIds so opening one routes back through this source.
// Track items already carry direct watch URLs, so they're left untouched.
function tag(sections) {
    for (const section of sections) {
        if (section.kind === "song" || section.kind === "video") continue;
        for (const item of section.items) {
            if (item.browseId) item.browseId = buildEntityId(ID, item.kind, item.browseId);
        }
    }
    return sections;
}

export default {
    id: ID,

    async search(query) {
        const { sections } = await inner.search(query);
        return { sections: tag(sections) };
    },

    // The registry strips the namespace, so `id` is the raw YouTube browse id
    // the InnerTube parser self-dispatches on by prefix.
    async browse(kind, id) {
        const data = await inner.browse(id);

        if (data.type === "artist") {
            data.albums = (data.albums || []).map((a) => ({
                ...a,
                browseId: a.browseId ? buildEntityId(ID, "album", a.browseId) : a.browseId
            }));
            return data;
        }

        // album / playlist: expose the source-agnostic whole-collection play URL.
        return {
            ...data,
            playUrl: data.playlistId ? `https://www.youtube.com/playlist?list=${data.playlistId}` : null
        };
    }
};
