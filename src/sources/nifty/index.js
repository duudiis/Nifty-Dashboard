// The dashboard's own source: custom playlists that live in the shared
// database rather than on a platform. Only browse is meaningful — these
// playlists are created and edited in the dashboard itself.

import { browsePlaylistFromDb } from "../../lib/db.js";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default {
    id: "nifty",

    async search() {
        return { sections: [] };
    },

    async browse(kind, id) {
        if (kind !== "playlist" || !UUID.test(id)) throw new Error("Unknown nifty entity.");
        return browsePlaylistFromDb(id);
    }
};
