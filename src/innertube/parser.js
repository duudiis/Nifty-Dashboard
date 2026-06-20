// Parses YouTube Music search responses into a flat, queue-ready result list.
//
// Speed first: we only emit entries we can resolve to a playable URL *without*
// extra network round-trips — songs and videos (direct watch URLs) and
// playlists (direct list URLs). Albums/artists, which would each need a second
// browse call, are skipped so search stays instant.
export default class InnerTubeParser {

    constructor(browse) {
        this.browse = browse;
    }

    parseSearchResults(json) {
        const results = [];

        const shelves =
            json?.contents?.tabbedSearchResultsRenderer?.tabs?.[0]?.tabRenderer
                ?.content?.sectionListRenderer?.contents || [];

        for (const shelf of shelves) {
            const musicShelf = shelf?.musicShelfRenderer;
            if (!musicShelf) continue;

            const shelfTitle = musicShelf.title?.runs?.[0]?.text || "";

            for (const content of musicShelf.contents || []) {
                const item = content?.musicResponsiveListItemRenderer;
                if (!item) continue;

                const parsed = this.parseItem(item, shelfTitle);
                if (parsed) results.push(parsed);
            }
        }

        return results;
    }

    parseItem(item, shelfTitle) {
        const flex0 = item.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer;
        const flex1 = item.flexColumns?.[1]?.musicResponsiveListItemFlexColumnRenderer;

        const title = flex0?.text?.runs?.[0]?.text;
        if (!title) return null;

        const artwork = this.parseThumbnail(item);

        const videoId = flex0?.text?.runs?.[0]?.navigationEndpoint?.watchEndpoint?.videoId;

        if (videoId) {
            const type = shelfTitle === "Songs" ? "Song" : "Video";
            const runs = flex1?.text?.runs || [];

            // runs look like: [artist, " • ", album, " • ", duration]
            const artist = runs?.[0]?.text || "Unknown artist";
            const duration = runs?.[runs.length - 1]?.text || "";

            return {
                type,
                title,
                artist,
                duration,
                artwork,
                url: `https://www.youtube.com/watch?v=${videoId}`
            };
        }

        const browseId = item.navigationEndpoint?.browseEndpoint?.browseId;
        if (browseId?.startsWith("VL")) {
            return {
                type: "Playlist",
                title,
                artist: flex1?.text?.runs?.[0]?.text || "Playlist",
                duration: "",
                artwork,
                url: `https://www.youtube.com/playlist?list=${browseId.substring(2)}`
            };
        }

        // Albums / artists are skipped to keep search fast (no second request).
        return null;
    }

    parseThumbnail(item) {
        const thumbs =
            item?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails || [];
        if (thumbs.length === 0) return null;
        // Last entry is the highest resolution.
        return thumbs[thumbs.length - 1]?.url || null;
    }
}
