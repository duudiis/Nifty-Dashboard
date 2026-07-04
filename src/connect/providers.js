// Per-provider OAuth + liked-songs import adapters.
//
// Each provider exposes the same interface so the connect routes and the
// import engine never special-case a platform:
//
//   id                       provider key
//   label                    display name
//   available()              are the credentials configured?
//   authorizeUrl(state,uri)  where to send the browser to grant access
//   exchangeCode(code,uri)   -> { accessToken, refreshToken, expiresIn, scope }
//   refresh(refreshToken)    -> { accessToken, expiresIn } (or null if N/A)
//   fetchAccount(token)      -> { id, name }
//   fetchLiked(token)        -> [ normalized track, ... ] (all of them, paged)
//
// A normalized liked track:
//   { source, sourceId, title, artist, isrc, url, artwork, durationMs, addedAt }
// addedAt is an ISO string — the platform's own "date added", used to merge
// everyone's likes into one chronological Liked songs list.

const env = (k) => process.env[k] || null;

// "PT3M20S" -> milliseconds (YouTube contentDetails.duration).
function iso8601ToMs(iso) {
    const m = /^PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?$/.exec(iso || "");
    if (!m) return null;
    const [, h, min, s] = m;
    return ((Number(h || 0) * 3600) + (Number(min || 0) * 60) + Number(s || 0)) * 1000;
}

/* ------------------------------------------------------------------ Spotify */

const spotify = {
    id: "spotify",
    label: "Spotify",
    available: () => !!(env("SPOTIFY_CLIENT_ID") && env("SPOTIFY_CLIENT_SECRET")),

    authorizeUrl(state, redirectUri) {
        const p = new URLSearchParams({
            client_id: env("SPOTIFY_CLIENT_ID"),
            response_type: "code",
            redirect_uri: redirectUri,
            scope: "user-library-read",
            state
        });
        return `https://accounts.spotify.com/authorize?${p}`;
    },

    async exchangeCode(code, redirectUri) {
        const basic = Buffer.from(`${env("SPOTIFY_CLIENT_ID")}:${env("SPOTIFY_CLIENT_SECRET")}`).toString("base64");
        const res = await fetch("https://accounts.spotify.com/api/token", {
            method: "POST",
            headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ grant_type: "authorization_code", code, redirect_uri: redirectUri })
        });
        if (!res.ok) throw new Error(`Spotify token ${res.status}`);
        const j = await res.json();
        return { accessToken: j.access_token, refreshToken: j.refresh_token, expiresIn: j.expires_in, scope: j.scope };
    },

    async refresh(refreshToken) {
        const basic = Buffer.from(`${env("SPOTIFY_CLIENT_ID")}:${env("SPOTIFY_CLIENT_SECRET")}`).toString("base64");
        const res = await fetch("https://accounts.spotify.com/api/token", {
            method: "POST",
            headers: { Authorization: `Basic ${basic}`, "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({ grant_type: "refresh_token", refresh_token: refreshToken })
        });
        if (!res.ok) throw new Error(`Spotify refresh ${res.status}`);
        const j = await res.json();
        return { accessToken: j.access_token, expiresIn: j.expires_in };
    },

    async fetchAccount(token) {
        const j = await fetch("https://api.spotify.com/v1/me", { headers: { Authorization: `Bearer ${token}` } }).then((r) => r.json());
        return { id: j.id, name: j.display_name || j.id };
    },

    async fetchLiked(token) {
        const out = [];
        let url = "https://api.spotify.com/v1/me/tracks?limit=50";
        while (url && out.length < 10000) {
            const res = await fetch(url, { headers: { Authorization: `Bearer ${token}` } });
            if (!res.ok) throw new Error(`Spotify liked ${res.status}`);
            const j = await res.json();
            for (const item of j.items || []) {
                const t = item.track;
                if (!t?.id) continue;
                out.push({
                    source: "spotify",
                    sourceId: t.id,
                    title: t.name,
                    artist: (t.artists || []).map((a) => a.name).join(", "),
                    isrc: t.external_ids?.isrc || null,
                    url: t.external_urls?.spotify || `https://open.spotify.com/track/${t.id}`,
                    artwork: t.album?.images?.[0]?.url || null,
                    durationMs: t.duration_ms || null,
                    addedAt: item.added_at || null
                });
            }
            url = j.next;
        }
        return out;
    }
};

/* ------------------------------------------------------------------- Deezer */

const deezer = {
    id: "deezer",
    label: "Deezer",
    available: () => !!(env("DEEZER_APP_ID") && env("DEEZER_APP_SECRET")),

    authorizeUrl(state, redirectUri) {
        const p = new URLSearchParams({
            app_id: env("DEEZER_APP_ID"),
            redirect_uri: redirectUri,
            perms: "basic_access,offline_access",
            state
        });
        return `https://connect.deezer.com/oauth/auth.php?${p}`;
    },

    async exchangeCode(code, redirectUri) {
        // Deezer returns a urlencoded body, not JSON, and no refresh token.
        const p = new URLSearchParams({
            app_id: env("DEEZER_APP_ID"),
            secret: env("DEEZER_APP_SECRET"),
            code,
            output: "json"
        });
        const res = await fetch(`https://connect.deezer.com/oauth/access_token.php?${p}`);
        const text = await res.text();
        let token, expires;
        try {
            const j = JSON.parse(text);
            token = j.access_token; expires = j.expires;
        } catch {
            const parsed = new URLSearchParams(text);
            token = parsed.get("access_token"); expires = parsed.get("expires");
        }
        if (!token) throw new Error("Deezer token exchange failed");
        return { accessToken: token, refreshToken: null, expiresIn: Number(expires) || null, scope: "basic_access" };
    },

    async refresh() { return null; }, // Deezer tokens are long-lived; no refresh

    async fetchAccount(token) {
        const j = await fetch(`https://api.deezer.com/user/me?access_token=${token}`).then((r) => r.json());
        return { id: j.id ? String(j.id) : null, name: j.name || "Deezer user" };
    },

    async fetchLiked(token) {
        const out = [];
        let url = `https://api.deezer.com/user/me/tracks?limit=100&access_token=${token}`;
        while (url && out.length < 10000) {
            const j = await fetch(url).then((r) => r.json());
            if (j?.error) throw new Error(`Deezer liked: ${j.error.message || j.error.type}`);
            for (const t of j.data || []) {
                out.push({
                    source: "deezer",
                    sourceId: String(t.id),
                    title: t.title,
                    artist: t.artist?.name || "",
                    isrc: t.isrc || null,
                    url: t.link || `https://www.deezer.com/track/${t.id}`,
                    artwork: t.album?.cover_xl || t.album?.cover_big || t.album?.cover_medium || null,
                    durationMs: t.duration ? t.duration * 1000 : null,
                    // Deezer gives a unix "time_add" on favorites.
                    addedAt: t.time_add ? new Date(t.time_add * 1000).toISOString() : null
                });
            }
            url = j.next || null;
        }
        return out;
    }
};

/* ------------------------------------------------------------------ YouTube */

const youtube = {
    id: "youtube",
    label: "YouTube",
    available: () => !!(env("GOOGLE_CLIENT_ID") && env("GOOGLE_CLIENT_SECRET")),

    authorizeUrl(state, redirectUri) {
        const p = new URLSearchParams({
            client_id: env("GOOGLE_CLIENT_ID"),
            redirect_uri: redirectUri,
            response_type: "code",
            scope: "https://www.googleapis.com/auth/youtube.readonly",
            access_type: "offline",
            prompt: "consent",
            state
        });
        return `https://accounts.google.com/o/oauth2/v2/auth?${p}`;
    },

    async exchangeCode(code, redirectUri) {
        const res = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                code,
                client_id: env("GOOGLE_CLIENT_ID"),
                client_secret: env("GOOGLE_CLIENT_SECRET"),
                redirect_uri: redirectUri,
                grant_type: "authorization_code"
            })
        });
        if (!res.ok) throw new Error(`Google token ${res.status}`);
        const j = await res.json();
        return { accessToken: j.access_token, refreshToken: j.refresh_token, expiresIn: j.expires_in, scope: j.scope };
    },

    async refresh(refreshToken) {
        const res = await fetch("https://oauth2.googleapis.com/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                refresh_token: refreshToken,
                client_id: env("GOOGLE_CLIENT_ID"),
                client_secret: env("GOOGLE_CLIENT_SECRET"),
                grant_type: "refresh_token"
            })
        });
        if (!res.ok) throw new Error(`Google refresh ${res.status}`);
        const j = await res.json();
        return { accessToken: j.access_token, expiresIn: j.expires_in };
    },

    async fetchAccount(token) {
        const j = await fetch(
            "https://www.googleapis.com/youtube/v3/channels?part=snippet&mine=true",
            { headers: { Authorization: `Bearer ${token}` } }
        ).then((r) => r.json());
        const ch = j.items?.[0];
        return { id: ch?.id || null, name: ch?.snippet?.title || "YouTube account" };
    },

    async fetchLiked(token) {
        // "LL" is the channel's Liked videos playlist — which mixes music with
        // everything else. We keep only videos in the Music category (10), so a
        // sync imports liked *songs*, not every liked video.
        const auth = { Authorization: `Bearer ${token}` };
        const out = [];
        let pageToken = "";

        do {
            const p = new URLSearchParams({
                part: "snippet,contentDetails",
                playlistId: "LL",
                maxResults: "50",
                ...(pageToken ? { pageToken } : {})
            });
            const res = await fetch(`https://www.googleapis.com/youtube/v3/playlistItems?${p}`, { headers: auth });
            if (!res.ok) throw new Error(`YouTube liked ${res.status}`);
            const j = await res.json();

            const pageItems = (j.items || [])
                .map((item) => ({ vid: item.contentDetails?.videoId, sn: item.snippet || {} }))
                .filter((x) => x.vid);

            // Look up category + duration for this page's videos in one call.
            const ids = pageItems.map((x) => x.vid).join(",");
            const meta = new Map();
            if (ids) {
                const vp = new URLSearchParams({ part: "snippet,contentDetails", id: ids, maxResults: "50" });
                const vres = await fetch(`https://www.googleapis.com/youtube/v3/videos?${vp}`, { headers: auth });
                if (vres.ok) {
                    const vj = await vres.json();
                    for (const v of vj.items || []) {
                        meta.set(v.id, {
                            categoryId: v.snippet?.categoryId,
                            durationMs: iso8601ToMs(v.contentDetails?.duration)
                        });
                    }
                }
            }

            for (const { vid, sn } of pageItems) {
                const m = meta.get(vid);
                if (!m || m.categoryId !== "10") continue; // music only
                out.push({
                    source: "youtube",
                    sourceId: vid,
                    title: sn.title || "Song",
                    artist: (sn.videoOwnerChannelTitle || "").replace(/ - Topic$/, ""),
                    isrc: null,
                    url: `https://www.youtube.com/watch?v=${vid}`,
                    // Full-resolution, bar-free cover — same URL the bot uses,
                    // so imported rows match what playback writes to the catalog.
                    artwork: `https://i.ytimg.com/vi/${vid}/maxresdefault.jpg`,
                    durationMs: m.durationMs,
                    addedAt: sn.publishedAt || null
                });
            }

            pageToken = j.nextPageToken || "";
        } while (pageToken && out.length < 10000);

        return out;
    }
};

/* -------------------------------------------------------------------- Tidal */
// Tidal's user-library API. Uses the login.tidal.com authorization-code flow
// with the client id/secret; favorites carry a "created" date + ISRC.

const tidal = {
    id: "tidal",
    label: "Tidal",
    available: () => !!(env("TIDAL_CLIENT_ID") && env("TIDAL_CLIENT_SECRET")),

    authorizeUrl(state, redirectUri) {
        const p = new URLSearchParams({
            client_id: env("TIDAL_CLIENT_ID"),
            response_type: "code",
            redirect_uri: redirectUri,
            scope: "r_usr",
            state
        });
        return `https://login.tidal.com/authorize?${p}`;
    },

    async exchangeCode(code, redirectUri) {
        const res = await fetch("https://auth.tidal.com/v1/oauth2/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                grant_type: "authorization_code",
                code,
                client_id: env("TIDAL_CLIENT_ID"),
                client_secret: env("TIDAL_CLIENT_SECRET"),
                redirect_uri: redirectUri
            })
        });
        if (!res.ok) throw new Error(`Tidal token ${res.status}`);
        const j = await res.json();
        return {
            accessToken: j.access_token,
            refreshToken: j.refresh_token,
            expiresIn: j.expires_in,
            scope: j.scope,
            externalId: j.user?.userId ? String(j.user.userId) : (j.user_id ? String(j.user_id) : null)
        };
    },

    async refresh(refreshToken) {
        const res = await fetch("https://auth.tidal.com/v1/oauth2/token", {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                grant_type: "refresh_token",
                refresh_token: refreshToken,
                client_id: env("TIDAL_CLIENT_ID"),
                client_secret: env("TIDAL_CLIENT_SECRET")
            })
        });
        if (!res.ok) throw new Error(`Tidal refresh ${res.status}`);
        const j = await res.json();
        return { accessToken: j.access_token, expiresIn: j.expires_in };
    },

    async fetchAccount(token) {
        const j = await fetch("https://api.tidal.com/v1/sessions", {
            headers: { Authorization: `Bearer ${token}` }
        }).then((r) => r.json());
        return { id: j.userId ? String(j.userId) : null, name: "Tidal account", country: j.countryCode || "US" };
    },

    async fetchLiked(token, externalId) {
        const country = env("TIDAL_COUNTRY_CODE") || "US";
        const account = externalId || (await this.fetchAccount(token)).id;
        if (!account) throw new Error("Tidal user id unknown");

        const out = [];
        for (let offset = 0; offset < 10000; offset += 100) {
            const p = new URLSearchParams({ limit: "100", offset: String(offset), countryCode: country });
            const res = await fetch(`https://api.tidal.com/v1/users/${account}/favorites/tracks?${p}`, {
                headers: { Authorization: `Bearer ${token}` }
            });
            if (!res.ok) throw new Error(`Tidal liked ${res.status}`);
            const j = await res.json();
            const items = j.items || [];
            for (const entry of items) {
                const t = entry.item || entry;
                if (!t?.id) continue;
                out.push({
                    source: "tidal",
                    sourceId: String(t.id),
                    title: t.title,
                    artist: (t.artists || []).map((a) => a.name).join(", ") || t.artist?.name || "",
                    isrc: t.isrc || null,
                    url: t.url || `https://tidal.com/browse/track/${t.id}`,
                    artwork: t.album?.cover
                        ? `https://resources.tidal.com/images/${String(t.album.cover).replace(/-/g, "/")}/640x640.jpg`
                        : null,
                    durationMs: t.duration ? t.duration * 1000 : null,
                    addedAt: entry.created || null
                });
            }
            if (items.length < 100) break;
        }
        return out;
    }
};

const PROVIDERS = { spotify, deezer, youtube, tidal };

export function getProvider(id) {
    return PROVIDERS[id] || null;
}

export function listProviders() {
    return Object.values(PROVIDERS).map((p) => ({ id: p.id, label: p.label, available: p.available() }));
}
