const KEY = "AIzaSyC9XL3ZjWddXya6X74dJoCTL-WEYFDNX30";

const CONTEXT = {
    client: {
        clientName: "WEB_REMIX",
        clientVersion: "1.20230104.01.00"
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
