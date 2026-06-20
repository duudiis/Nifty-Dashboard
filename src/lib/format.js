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

// Use on <img onError> and for null artwork so we always show something.
export function artworkOrFallback(url) {
    return url && url.length > 0 ? url : FALLBACK_ARTWORK;
}
