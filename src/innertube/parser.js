// Parses YouTube Music search responses into a flat, queue-ready result list.
//
// YouTube Music's WEB_REMIX response now nests results differently than it used
// to: items are `musicResponsiveListItemRenderer`s living directly inside
// `itemSectionRenderer.contents` (older responses wrapped them in a
// `musicShelfRenderer`), and the big top hit is a `musicCardShelfRenderer`.
// We read both shapes.
//
// Speed first: we only emit entries we can resolve to a playable URL *without*
// extra network round-trips — songs and videos (direct watch URLs) and
// playlists (direct list URLs). Albums/artists, which would each need a second
// browse call, are skipped so search stays instant.

const SEPARATORS = new Set([" • ", " & ", ", ", "•", "&", " · "]);
const isDuration = (t) => /^\d{1,2}:\d{2}(:\d{2})?$/.test((t || "").trim());

export default class InnerTubeParser {

    constructor(browse) {
        this.browse = browse;
    }

    parseSearchResults(json) {
        const results = [];
        const seen = new Set();

        const push = (entry) => {
            if (!entry) return;
            if (seen.has(entry.url)) return;
            seen.add(entry.url);
            results.push(entry);
        };

        const sections =
            json?.contents?.tabbedSearchResultsRenderer?.tabs?.[0]?.tabRenderer
                ?.content?.sectionListRenderer?.contents || [];

        for (const section of sections) {
            // Top-of-page "card" hit (often the best match for the query).
            if (section.musicCardShelfRenderer) {
                push(this.parseCard(section.musicCardShelfRenderer));
            }

            // Both the new (itemSectionRenderer) and old (musicShelfRenderer) shapes.
            const rows =
                section?.itemSectionRenderer?.contents ||
                section?.musicShelfRenderer?.contents ||
                [];

            for (const row of rows) {
                const item = row?.musicResponsiveListItemRenderer;
                if (!item) continue;
                push(this.parseItem(item));
            }
        }

        return results;
    }

    parseItem(item) {
        const titleRuns = this.runs(item, 0);
        const title = titleRuns?.[0]?.text;
        if (!title) return null;

        const artwork = this.parseThumbnail(item);
        const subtitle = this.runs(item, 1);
        const typeToken = subtitle?.[0]?.text || "";

        const videoId =
            titleRuns?.[0]?.navigationEndpoint?.watchEndpoint?.videoId ||
            item?.playlistItemData?.videoId ||
            item?.overlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer
                ?.playNavigationEndpoint?.watchEndpoint?.videoId;

        if (videoId) {
            return {
                type: /video/i.test(typeToken) ? "Video" : "Song",
                title,
                artist: this.parseArtist(subtitle, typeToken),
                duration: this.parseDuration(item, subtitle),
                artwork,
                url: `https://www.youtube.com/watch?v=${videoId}`
            };
        }

        const browse = item?.navigationEndpoint?.browseEndpoint;
        const browseId = browse?.browseId || "";
        const pageType =
            browse?.browseEndpointContextSupportedConfigs?.browseEndpointContextMusicConfig?.pageType;

        if (pageType === "MUSIC_PAGE_TYPE_PLAYLIST" || browseId.startsWith("VL")) {
            const list = browseId.startsWith("VL") ? browseId.slice(2) : browseId;
            return {
                type: "Playlist",
                title,
                artist: this.parseArtist(subtitle, typeToken) || "Playlist",
                duration: "",
                artwork,
                url: `https://www.youtube.com/playlist?list=${list}`
            };
        }

        // Albums / artists are skipped to keep search fast (no second request).
        return null;
    }

    parseCard(card) {
        const titleRuns = card?.title?.runs || [];
        const title = titleRuns.map((r) => r.text).join("");
        if (!title) return null;

        const videoId =
            titleRuns?.[0]?.navigationEndpoint?.watchEndpoint?.videoId ||
            card?.onTap?.watchEndpoint?.videoId;
        if (!videoId) return null; // artist/album cards need a second request — skip

        const subtitle = card?.subtitle?.runs || [];
        const typeToken = subtitle?.[0]?.text || "";

        return {
            type: "Top result",
            title,
            artist: this.parseArtist(subtitle, typeToken),
            duration: this.parseDuration(null, subtitle),
            artwork: this.parseThumbnail(card),
            url: `https://www.youtube.com/watch?v=${videoId}`
        };
    }

    runs(item, column) {
        return item?.flexColumns?.[column]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [];
    }

    // Prefer runs that link to an artist page; otherwise fall back to the first
    // meaningful (non-separator, non-type, non-duration) subtitle run.
    parseArtist(runs, typeToken) {
        const artistRuns = (runs || []).filter(
            (r) =>
                r?.navigationEndpoint?.browseEndpoint?.browseEndpointContextSupportedConfigs
                    ?.browseEndpointContextMusicConfig?.pageType === "MUSIC_PAGE_TYPE_ARTIST"
        );
        if (artistRuns.length) return artistRuns.map((r) => r.text).join(", ");

        const meaningful = (runs || []).filter(
            (r) => !SEPARATORS.has(r.text) && r.text !== typeToken && !isDuration(r.text) && !/\d/.test(r.text)
        );
        return meaningful[0]?.text || "Unknown artist";
    }

    parseDuration(item, runs) {
        const fromSub = (runs || []).find((r) => isDuration(r.text))?.text;
        if (fromSub) return fromSub;
        const fixed =
            item?.fixedColumns?.[0]?.musicResponsiveListItemFixedColumnRenderer?.text?.runs?.[0]?.text;
        return isDuration(fixed) ? fixed : "";
    }

    parseThumbnail(item) {
        const thumbs = item?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails || [];
        if (thumbs.length === 0) return null;
        // Last entry is the highest resolution.
        return thumbs[thumbs.length - 1]?.url || null;
    }
}
