// The assistant API wired to the real hub, database and search source.
// See ./http.js for the endpoints.

import { getPlayerState, getQueue, listGuildPlayers } from "../lib/db.js";
import { getActiveSource } from "../sources/index.js";
import { botsById, guildOwners, routeAction } from "../ws/registry.js";
import { createAssistantHandler } from "./http.js";

export { ASSISTANT_PREFIX } from "./http.js";

const source = getActiveSource();

export const handleAssistant = createAssistantHandler({
    token: process.env.ASSISTANT_TOKEN || "",
    registry: { botsById, guildOwners, routeAction },
    getPlayerState,
    getQueue,
    listGuildPlayers,
    // The same search, and the same body, as /api/search.
    search: async (query) => {
        const { sections } = await source.search(query);
        return { sections, source: source.id };
    }
});
