// YouTube helpers for the Watch view: extract a video id from the track URLs
// the bot reports (Lavaplayer URIs) and load the IFrame Player API once.

const isVideoId = (id) => !!id && /^[\w-]{11}$/.test(id);

// Returns the 11-char video id, or null when the URL isn't a YouTube video.
// Handles watch?v=, youtu.be/, shorts/, live/, embed/ and music.youtube.com.
export function getYouTubeVideoId(url) {
    if (!url) return null;
    let u;
    try {
        u = new URL(String(url));
    } catch {
        return null;
    }
    const host = u.hostname.replace(/^(www|m|music)\./, "");
    if (host === "youtu.be") {
        const id = u.pathname.slice(1).split("/")[0];
        return isVideoId(id) ? id : null;
    }
    if (host !== "youtube.com" && host !== "youtube-nocookie.com") return null;
    if (u.pathname === "/watch") {
        const id = u.searchParams.get("v");
        return isVideoId(id) ? id : null;
    }
    const m = u.pathname.match(/^\/(?:embed|shorts|live|v)\/([^/?]+)/);
    return m && isVideoId(m[1]) ? m[1] : null;
}

// Loads https://www.youtube.com/iframe_api exactly once and resolves with the
// global YT namespace. Safe to call from every mount of the Watch view.
let apiPromise = null;
export function loadYouTubeIframeAPI() {
    if (window.YT?.Player) return Promise.resolve(window.YT);
    if (!apiPromise) {
        apiPromise = new Promise((resolve) => {
            const prev = window.onYouTubeIframeAPIReady;
            window.onYouTubeIframeAPIReady = () => {
                prev?.();
                resolve(window.YT);
            };
            const script = document.createElement("script");
            script.src = "https://www.youtube.com/iframe_api";
            document.head.appendChild(script);
        });
    }
    return apiPromise;
}
