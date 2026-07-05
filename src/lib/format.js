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

// Human-readable span for listening durations: "1h 4m", "3m 12s", "45s".
// Rounds to whole seconds; anything under a second reads as "0s".
export function humanDuration(ms) {
    if (ms == null || isNaN(ms) || ms < 0) ms = 0;
    const total = Math.round(ms / 1000);
    const h = Math.floor(total / 3600);
    const m = Math.floor((total % 3600) / 60);
    const s = total % 60;
    if (h > 0) return m > 0 ? `${h}h ${m}m` : `${h}h`;
    if (m > 0) return s > 0 ? `${m}m ${s}s` : `${m}m`;
    return `${s}s`;
}

// Absolute clock time in the viewer's locale, e.g. "3:42 PM".
export function formatTime(value) {
    if (!value) return "";
    return new Date(value).toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
}

// Full date + time, e.g. "Jul 5, 2026, 3:42 PM".
export function formatDateTime(value) {
    if (!value) return "";
    return new Date(value).toLocaleString([], {
        month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit"
    });
}

// A calendar-day heading — "Today" / "Yesterday" / "Saturday, July 5, 2026" —
// used to group sessions in the timeline. Keyed off the local day.
export function dayLabel(value) {
    if (!value) return "";
    const d = new Date(value);
    const today = new Date();
    const startOf = (x) => new Date(x.getFullYear(), x.getMonth(), x.getDate());
    const days = Math.round((startOf(today) - startOf(d)) / 86_400_000);
    if (days === 0) return "Today";
    if (days === 1) return "Yesterday";
    return d.toLocaleDateString([], { weekday: "long", month: "long", day: "numeric", year: "numeric" });
}

// Stable per-day key so consecutive sessions on the same date share a heading.
export function dayKey(value) {
    const d = new Date(value);
    return `${d.getFullYear()}-${d.getMonth()}-${d.getDate()}`;
}

export const FALLBACK_ARTWORK = "/images/fallback.svg";

// YouTube/Google image hosts encode the size in the URL (=wXX-hXX or =sXX) and
// happily serve a bigger one — search thumbnails arrive at 120px, so request a
// crisp size instead. Unknown hosts (e.g. i.ytimg.com) are left untouched.
export function hiResArtwork(url, size = 544) {
    if (!url || !/(googleusercontent|ggpht|lh3\.google)/.test(url)) return url;
    if (/=w\d+-h\d+/.test(url)) return url.replace(/=w\d+-h\d+/, `=w${size}-h${size}`);
    if (/=s\d+/.test(url)) {
        const current = parseInt(url.match(/=s(\d+)/)?.[1] || "0", 10);
        return current < size ? url.replace(/=s\d+/, `=s${size}`) : url;
    }
    return url;
}

// Use on <img onError> and for null artwork so we always show something.
export function artworkOrFallback(url) {
    return url && url.length > 0 ? hiResArtwork(url) : FALLBACK_ARTWORK;
}
