import InnerTubeBrowse from "./browse.js";
import InnerTubeParser from "./parser.js";
import InnerTubeSearch from "./search.js";

// Lightweight YouTube Music search client, shared as a singleton.
const browseClient = new InnerTubeBrowse();
const parser = new InnerTubeParser((id) => browseClient.browse(id));
const searchClient = new InnerTubeSearch(parser);

export default class InnerTube {
    constructor() {
        this.search = (query) => searchClient.search(query);
        // Album / playlist / artist pages, parsed into structured data.
        this.browse = (id) => browseClient.browse(id).then((json) => parser.parseBrowse(id, json));
    }
}
