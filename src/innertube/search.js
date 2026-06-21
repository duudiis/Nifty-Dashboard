const KEY = "AIzaSyC9XL3ZjWddXya6X74dJoCTL-WEYFDNX30";

// gl/hl pin results to the US so what we surface matches what the (US-hosted)
// bot can actually play — region-locked tracks otherwise fail to queue.
const CONTEXT = {
    client: {
        clientName: "WEB_REMIX",
        clientVersion: "1.20230104.01.00",
        gl: "US",
        hl: "en"
    }
};

// Per-type search filters (the same "params" YouTube Music's "Show all" uses).
// Each returns a full shelf (~20 items) instead of the ~5 a mixed search gives.
const FILTERS = [
    ["song", "EgWKAQIIAWoKEAkQBRAKEAMQBA=="],
    ["album", "EgWKAQIYAWoKEAkQBRAKEAMQBA=="],
    ["artist", "EgWKAQIgAWoKEAkQBRAKEAMQBA=="],
    ["playlist", "EgWKAQIoAWoKEAkQBRAKEAMQBA=="],
    ["video", "EgWKAQIQAWoKEAkQBRAKEAMQBA=="]
];

export default class InnerTubeSearch {

    constructor(parser) {
        this.parser = parser;
    }

    async one(query, params) {
        const res = await fetch(`https://www.youtube.com/youtubei/v1/search?key=${KEY}`, {
            method: "POST",
            headers: {
                Referer: "music.youtube.com",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ context: CONTEXT, query, params })
        });
        return res.json();
    }

    async search(query) {
        // Fetch every type in parallel and merge — far more results per section.
        // The filter kind is kept as a hint so songs vs videos bucket correctly.
        const responses = await Promise.all(
            FILTERS.map(([kind, params]) =>
                this.one(query, params).then((json) => ({ kind, json })).catch(() => ({ kind, json: null }))
            )
        );
        return this.parser.parseSearchResults(responses);
    }
}
