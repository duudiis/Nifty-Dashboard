// Parses YouTube Music (WEB_REMIX) responses into structured data the dashboard
// can render: sectioned search results, and album / playlist / artist pages.

const SEPARATORS = new Set([" • ", " & ", ", ", "•", "&", " · "]);
const isDuration = (t) => /^\d{1,2}:\d{2}(:\d{2})?$/.test((t || "").trim());

export default class InnerTubeParser {

    constructor(browse) {
        this.browse = browse;
    }

    /* ----------------------------------------------------------------- search */

    // Returns { sections: [{ kind, title, items: [...] }] } ordered
    // Songs → Albums → Artists → Playlists → Videos. Episodes/podcasts/profiles
    // are dropped.
    parseSearchResults(json) {
        const buckets = { song: [], album: [], artist: [], playlist: [], video: [] };
        const seen = new Set();
        const add = (e) => {
            if (!e) return;
            const key = e.videoId || e.browseId || e.url;
            if (!key || seen.has(key)) return;
            seen.add(key);
            buckets[e.kind]?.push(e);
        };

        const sections =
            json?.contents?.tabbedSearchResultsRenderer?.tabs?.[0]?.tabRenderer
                ?.content?.sectionListRenderer?.contents || [];

        for (const section of sections) {
            if (section.musicCardShelfRenderer) add(this.parseCard(section.musicCardShelfRenderer));
            const rows = section?.itemSectionRenderer?.contents || section?.musicShelfRenderer?.contents || [];
            for (const row of rows) {
                const item = row?.musicResponsiveListItemRenderer;
                if (item) add(this.classifyItem(item));
            }
        }

        const order = [
            ["song", "Songs"],
            ["album", "Albums"],
            ["artist", "Artists"],
            ["playlist", "Playlists"],
            ["video", "Videos"]
        ];
        const out = [];
        for (const [kind, title] of order) {
            if (buckets[kind].length) out.push({ kind, title, items: buckets[kind] });
        }
        return { sections: out };
    }

    classifyItem(item) {
        const titleRuns = this.runs(item, 0);
        const title = titleRuns?.[0]?.text;
        if (!title) return null;

        const artwork = this.parseThumbnail(item);
        const subtitleRuns = this.runs(item, 1);
        const typeToken = subtitleRuns?.[0]?.text || "";
        const subtitle = subtitleRuns.map((r) => r.text).join("");

        const videoId =
            titleRuns?.[0]?.navigationEndpoint?.watchEndpoint?.videoId ||
            item?.playlistItemData?.videoId ||
            item?.overlay?.musicItemThumbnailOverlayRenderer?.content?.musicPlayButtonRenderer
                ?.playNavigationEndpoint?.watchEndpoint?.videoId;

        if (videoId) {
            if (/episode/i.test(typeToken)) return null; // podcasts aren't music
            return {
                kind: /video/i.test(typeToken) ? "video" : "song",
                title,
                artist: this.parseArtist(subtitleRuns, typeToken),
                duration: this.parseDuration(item, subtitleRuns),
                artwork,
                videoId,
                url: `https://www.youtube.com/watch?v=${videoId}`
            };
        }

        const browse = item?.navigationEndpoint?.browseEndpoint;
        const browseId = browse?.browseId || "";
        const pageType =
            browse?.browseEndpointContextSupportedConfigs?.browseEndpointContextMusicConfig?.pageType || "";

        if (pageType === "MUSIC_PAGE_TYPE_ALBUM" || browseId.startsWith("MPREb")) {
            return { kind: "album", title, subtitle, artwork, browseId };
        }
        if (pageType === "MUSIC_PAGE_TYPE_ARTIST" || browseId.startsWith("UC")) {
            return { kind: "artist", title, subtitle, artwork, browseId };
        }
        if (pageType === "MUSIC_PAGE_TYPE_PLAYLIST" || browseId.startsWith("VL")) {
            return { kind: "playlist", title, subtitle, artwork, browseId };
        }
        return null; // profiles, podcasts, etc.
    }

    parseCard(card) {
        const titleRuns = card?.title?.runs || [];
        const title = titleRuns.map((r) => r.text).join("");
        if (!title) return null;

        const videoId = titleRuns?.[0]?.navigationEndpoint?.watchEndpoint?.videoId || card?.onTap?.watchEndpoint?.videoId;
        if (!videoId) return null; // album/artist cards are covered by the list items

        const subtitleRuns = card?.subtitle?.runs || [];
        const typeToken = subtitleRuns?.[0]?.text || "";
        return {
            kind: /video/i.test(typeToken) ? "video" : "song",
            title,
            artist: this.parseArtist(subtitleRuns, typeToken),
            duration: this.parseDuration(null, subtitleRuns),
            artwork: this.parseThumbnail(card),
            videoId,
            url: `https://www.youtube.com/watch?v=${videoId}`
        };
    }

    /* ----------------------------------------------------------------- browse */

    parseBrowse(browseId, json) {
        if (browseId.startsWith("UC") || browseId.startsWith("MPLA")) return this.parseArtistPage(json);
        return this.parseCollection(json, browseId.startsWith("MPREb") ? "album" : "playlist");
    }

    parseCollection(json, type) {
        const mf = this.microformat(json);
        const header = this.findHeader(json);

        let title = mf.title.replace(/\s*-\s*(Album|Single|EP)\s+by\s+.*/i, "").trim();
        if (!title) title = this.joinRuns(header?.title?.runs);

        const subtitle =
            this.joinRuns(header?.subtitle?.runs) || this.joinRuns(header?.straplineTextOne?.runs) || "";
        const artwork = mf.artwork || this.parseThumbnail(header);

        const sl = this.secondarySectionList(json);
        const shelf =
            sl.find((s) => s.musicShelfRenderer)?.musicShelfRenderer ||
            sl.find((s) => s.musicPlaylistShelfRenderer)?.musicPlaylistShelfRenderer;

        const tracks = (shelf?.contents || [])
            .map((r) => this.parseTrackRow(r?.musicResponsiveListItemRenderer, artwork))
            .filter(Boolean);

        return { type, title, subtitle, artwork, tracks };
    }

    parseArtistPage(json) {
        const mf = this.microformat(json);
        const header = this.findHeader(json);
        const artwork = mf.artwork || this.parseThumbnail(header);
        const title = mf.title || this.joinRuns(header?.title?.runs);
        const subtitle = this.joinRuns(header?.subtitle?.runs);

        const sl = this.primarySectionList(json);
        let topSongs = [];
        const albums = [];

        for (const s of sl) {
            if (s.musicShelfRenderer) {
                topSongs = (s.musicShelfRenderer.contents || [])
                    .map((r) => this.parseTrackRow(r?.musicResponsiveListItemRenderer, artwork))
                    .filter(Boolean);
            }
            if (s.musicCarouselShelfRenderer) {
                const head = this.joinRuns(
                    s.musicCarouselShelfRenderer.header?.musicCarouselShelfBasicHeaderRenderer?.title?.runs
                );
                if (/album|single|ep/i.test(head)) {
                    for (const c of s.musicCarouselShelfRenderer.contents || []) {
                        const card = this.parseTwoRow(c?.musicTwoRowItemRenderer);
                        if (card?.browseId) albums.push(card);
                    }
                }
            }
        }

        return { type: "artist", title, subtitle, artwork, topSongs, albums };
    }

    parseTrackRow(item, fallbackArtwork) {
        if (!item) return null;
        const titleRuns = this.runs(item, 0);
        const title = titleRuns?.[0]?.text;
        const videoId = titleRuns?.[0]?.navigationEndpoint?.watchEndpoint?.videoId || item?.playlistItemData?.videoId;
        if (!title || !videoId) return null;

        const subtitleRuns = this.runs(item, 1);
        return {
            title,
            artist: this.parseArtist(subtitleRuns, subtitleRuns?.[0]?.text || ""),
            duration: this.parseDuration(item, subtitleRuns),
            artwork: this.parseThumbnail(item) || fallbackArtwork || null,
            videoId,
            url: `https://www.youtube.com/watch?v=${videoId}`
        };
    }

    parseTwoRow(tr) {
        if (!tr) return null;
        const title = this.joinRuns(tr.title?.runs);
        if (!title) return null;
        const browseId =
            tr.navigationEndpoint?.browseEndpoint?.browseId ||
            tr.title?.runs?.[0]?.navigationEndpoint?.browseEndpoint?.browseId ||
            "";
        const thumbs = tr.thumbnailRenderer?.musicThumbnailRenderer?.thumbnail?.thumbnails || [];
        return {
            title,
            subtitle: this.joinRuns(tr.subtitle?.runs),
            artwork: thumbs[thumbs.length - 1]?.url || null,
            browseId
        };
    }

    /* ----------------------------------------------------------------- shared */

    secondarySectionList(json) {
        return (
            json?.contents?.twoColumnBrowseResultsRenderer?.secondaryContents?.sectionListRenderer?.contents ||
            json?.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer
                ?.contents ||
            []
        );
    }

    primarySectionList(json) {
        return (
            json?.contents?.singleColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer
                ?.contents ||
            json?.contents?.twoColumnBrowseResultsRenderer?.tabs?.[0]?.tabRenderer?.content?.sectionListRenderer
                ?.contents ||
            []
        );
    }

    findHeader(json) {
        for (const s of this.primarySectionList(json)) {
            if (s.musicResponsiveHeaderRenderer) return s.musicResponsiveHeaderRenderer;
        }
        return json?.header?.musicResponsiveHeaderRenderer || json?.header?.musicDetailHeaderRenderer || null;
    }

    microformat(json) {
        const mf = json?.microformat?.microformatDataRenderer;
        return {
            title: mf?.title || "",
            artwork: mf?.thumbnail?.thumbnails?.slice(-1)?.[0]?.url || null,
            description: mf?.description || ""
        };
    }

    joinRuns(runs) {
        return (runs || []).map((r) => r.text).join("");
    }

    runs(item, column) {
        return item?.flexColumns?.[column]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs || [];
    }

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
        const fixed = item?.fixedColumns?.[0]?.musicResponsiveListItemFixedColumnRenderer?.text?.runs?.[0]?.text;
        return isDuration(fixed) ? fixed : "";
    }

    parseThumbnail(node) {
        const thumbs =
            node?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails ||
            node?.thumbnail?.croppedSquareThumbnailRenderer?.thumbnail?.thumbnails ||
            [];
        return thumbs.length ? thumbs[thumbs.length - 1]?.url || null : null;
    }
}
