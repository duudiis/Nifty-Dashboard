// Thin Discord OAuth2 helpers. No persistence: we only use the access token
// once, to read the user's identity, then mint our own stateless JWT session.

const API = "https://discord.com/api/v10";

/**
 * Exchanges an OAuth2 authorization code for an access token.
 * @param {string} code
 * @returns {Promise<{ tokenType: string, accessToken: string } | { error: object }>}
 */
export async function exchangeCode(code) {
    const body = new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID,
        client_secret: process.env.DISCORD_CLIENT_SECRET,
        grant_type: "authorization_code",
        code,
        redirect_uri: process.env.DISCORD_REDIRECT_URI
    });

    const res = await fetch(`${API}/oauth2/token`, {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body
    });

    const json = await res.json().catch(() => ({}));

    if (!json?.token_type || !json?.access_token) {
        return { error: { message: "Failed to authenticate with Discord.", code: "TOKEN_ERROR" } };
    }

    return { tokenType: json.token_type, accessToken: json.access_token };
}

/**
 * Fetches the authenticated user's profile.
 * @param {string} tokenType
 * @param {string} accessToken
 */
export async function fetchUser(tokenType, accessToken) {
    const res = await fetch(`${API}/users/@me`, {
        headers: { Authorization: `${tokenType} ${accessToken}` }
    });

    const json = await res.json().catch(() => ({}));

    if (!json?.id) {
        return { error: { message: "Could not read your Discord profile (missing identify scope?).", code: "IDENTIFY_ERROR" } };
    }

    const avatar_url = json.avatar
        ? `https://cdn.discordapp.com/avatars/${json.id}/${json.avatar}.png?size=256`
        : `https://cdn.discordapp.com/embed/avatars/${(BigInt(json.id) >> 22n) % 6n}.png`;

    return {
        id: json.id,
        username: json.global_name || json.username,
        avatar_url
    };
}

/**
 * Builds the Discord OAuth2 authorize URL the login page redirects to.
 */
export function buildAuthorizeUrl() {
    const params = new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID,
        redirect_uri: process.env.DISCORD_REDIRECT_URI,
        response_type: "code",
        scope: "identify guilds"
    });
    return `https://discord.com/oauth2/authorize?${params.toString()}`;
}
