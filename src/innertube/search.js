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

export default class InnerTubeSearch {

    constructor(parser) {
        this.parser = parser;
    }

    async search(query) {
        const res = await fetch(`https://www.youtube.com/youtubei/v1/search?key=${KEY}`, {
            method: "POST",
            headers: {
                Referer: "music.youtube.com",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ context: CONTEXT, query })
        });

        const json = await res.json();
        return this.parser.parseSearchResults(json);
    }
}
