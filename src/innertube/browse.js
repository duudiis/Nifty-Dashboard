const KEY = "AIzaSyC9XL3ZjWddXya6X74dJoCTL-WEYFDNX30";

const CONTEXT = {
    client: {
        clientName: "WEB_REMIX",
        clientVersion: "1.20230104.01.00",
        gl: "US",
        hl: "en"
    }
};

// Minimal YouTube Music (InnerTube) browse call. No API key of our own needed —
// this is the public web client key, same approach the bot's sources use.
export default class InnerTubeBrowse {

    async browse(browseId) {
        const res = await fetch(`https://www.youtube.com/youtubei/v1/browse?key=${KEY}`, {
            method: "POST",
            headers: {
                Referer: "music.youtube.com",
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ context: CONTEXT, browseId })
        });

        return res.json();
    }
}
