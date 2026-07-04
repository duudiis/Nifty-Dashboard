import { parse, serialize } from "cookie";

import { verifySession } from "../../../../lib/jwt.js";
import { getProvider } from "../../../../connect/providers.js";
import { randomState } from "../../../../lib/crypto.js";

// Begins the OAuth flow: sets a CSRF state cookie and redirects the browser to
// the provider's consent screen.  GET /api/connect/<provider>/start

export function redirectUri(req, providerId) {
    if (process.env.PUBLIC_BASE_URL) {
        return `${process.env.PUBLIC_BASE_URL.replace(/\/$/, "")}/api/connect/${providerId}/callback`;
    }
    const proto = (req.headers["x-forwarded-proto"] || "https").split(",")[0].trim();
    const host = req.headers["x-forwarded-host"] || req.headers.host;
    return `${proto}://${host}/api/connect/${providerId}/callback`;
}

export default async function handler(req, res) {
    const cookies = parse(req.headers.cookie || "");
    if (!(await verifySession(cookies.session))) {
        return res.status(401).json({ message: "Not authenticated." });
    }

    const providerId = String(req.query.provider || "");
    const provider = getProvider(providerId);
    if (!provider) return res.status(404).json({ message: "Unknown provider." });
    if (!provider.available()) {
        return res.status(503).json({ message: `${provider.label} is not configured on this server.` });
    }

    const state = randomState();
    res.setHeader("Set-Cookie", serialize("nifty_oauth_state", `${providerId}:${state}`, {
        httpOnly: true,
        secure: true,
        sameSite: "lax",   // survives the cross-site redirect back
        path: "/",
        maxAge: 600
    }));

    return res.redirect(302, provider.authorizeUrl(state, redirectUri(req, providerId)));
}
