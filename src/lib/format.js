// Formats milliseconds as m:ss or h:mm:ss.
export function msToClock(ms) {
    if (ms == null || isNaN(ms) || ms < 0) ms = 0;

    let seconds = Math.floor((ms / 1000) % 60);
    let minutes = Math.floor((ms / (1000 * 60)) % 60);
    const hours = Math.floor(ms / (1000 * 60 * 60));

    const ss = String(seconds).padStart(2, "0");

    if (hours > 0) {
        const mm = String(minutes).padStart(2, "0");
        return `${hours}:${mm}:${ss}`;
    }

    return `${minutes}:${ss}`;
}

// Sums a queue's total duration into a readable label.
export function totalDuration(tracks) {
    const total = (tracks || []).reduce((sum, t) => sum + (t.duration || 0), 0);
    return msToClock(total);
}

// Normalises a track's "added by" info across the shapes the bot might send:
// a bare username string, or an object ({ name|username, avatar|avatar_url }),
// with the avatar also accepted as a sibling field on the track.
export function addedByOf(track) {
    if (!track) return { name: "", avatar: null };
    const a = track.added_by;
    const obj = a && typeof a === "object" ? a : null;
    const name = obj ? obj.name || obj.username || "" : a || "";
    const avatar =
        track.added_by_avatar ||
        track.addedByAvatar ||
        (obj ? obj.avatar || obj.avatar_url : null) ||
        track.requester?.avatar_url ||
        null;
    return { name: name || "", avatar: avatar || null };
}

export const FALLBACK_ARTWORK = "/images/fallback.svg";

// Swap a YouTube thumbnail to a specific size variant (keeps the video id).
function ytThumb(url, name) {
    return url.replace(/\/(default|mqdefault|hqdefault|sddefault|maxresdefault|hq720)\.jpg.*$/, `/${name}.jpg`);
}

// Google image hosts encode the size in the URL (=wXX-hXX / =sXX) and serve a
// bigger one on request — search thumbnails arrive at 120px.
function googleUpscale(url, size) {
    if (!/(googleusercontent|ggpht|lh3\.google)/.test(url)) return url;
    if (/=w\d+-h\d+/.test(url)) return url.replace(/=w\d+-h\d+/, `=w${size}-h${size}`);
    if (/=s\d+/.test(url)) {
        const current = parseInt(url.match(/=s(\d+)/)?.[1] || "0", 10);
        return current < size ? url.replace(/=s\d+/, `=s${size}`) : url;
    }
    return url;
}

// Foreground covers: request the sharpest size. YouTube video thumbnails jump
// to maxresdefault (bar-free, hi-res) — pair with onArtworkError so videos
// without a maxres fall back to mqdefault.
export function hiResArtwork(url, size = 544) {
    if (!url) return url;
    if (/i\.ytimg\.com\/vi\//.test(url)) return ytThumb(url, "maxresdefault");
    return googleUpscale(url, size);
}

// Backgrounds (CSS background-image, which can't fall back on error): never
// maxres — keep a guaranteed bar-free size so the blurred backdrop always loads.
export function bgArtwork(url, size = 544) {
    if (!url) return url;
    if (/i\.ytimg\.com\/vi\//.test(url)) return ytThumb(url, "mqdefault");
    return googleUpscale(url, size);
}

// Use for an <img> src and for null artwork so we always show something.
export function artworkOrFallback(url) {
    return url && url.length > 0 ? hiResArtwork(url) : FALLBACK_ARTWORK;
}

// <img onError>: step maxresdefault → mqdefault (bar-free) → placeholder.
export function onArtworkError(e) {
    const img = e.currentTarget;
    const src = img.getAttribute("src") || "";
    if (src.includes("maxresdefault")) {
        img.src = ytThumb(src, "mqdefault");
        return;
    }
    if (!src.endsWith(FALLBACK_ARTWORK)) img.src = FALLBACK_ARTWORK;
}
