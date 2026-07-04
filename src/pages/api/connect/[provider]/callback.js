import { parse, serialize } from "cookie";

import { verifySession } from "../../../../lib/jwt.js";
import { getProvider } from "../../../../connect/providers.js";
import { upsertConnection, importLikedFromProvider } from "../../../../lib/connections.js";
import { redirectUri } from "./start.js";

// The provider redirects here after consent: verify state, exchange the code,
// store the (encrypted) tokens, kick off the liked-songs import, then bounce
// back to the dashboard.  GET /api/connect/<provider>/callback

export default async function handler(req, res) {
    const cookies = parse(req.headers.cookie || "");
    const user = await verifySession(cookies.session);

    const providerId = String(req.query.provider || "");
    const provider = getProvider(providerId);

    const done = (status) =>
        res.redirect(302, `/dashboard?settings=connections&connect=${providerId}:${status}`);

    // Clear the state cookie no matter what.
    res.setHeader("Set-Cookie", serialize("nifty_oauth_state", "", { path: "/", maxAge: 0 }));

    if (!user || !provider) return done("error");
    if (req.query.error) return done("denied");

    // CSRF: the state we set must come back unchanged.
    const [cookieProvider, cookieState] = String(cookies.nifty_oauth_state || "").split(":");
    if (cookieProvider !== providerId || !cookieState || cookieState !== req.query.state) {
        return done("error");
    }

    const code = String(req.query.code || "");
    if (!code) return done("error");

    try {
        const tokens = await provider.exchangeCode(code, redirectUri(req, providerId));
        const account = tokens.externalId
            ? { id: tokens.externalId, name: `${provider.label} account` }
            : await provider.fetchAccount(tokens.accessToken).catch(() => ({ id: null, name: `${provider.label} account` }));

        await upsertConnection(user.id, providerId, {
            externalId: account.id || tokens.externalId || null,
            externalName: account.name,
            accessToken: tokens.accessToken,
            refreshToken: tokens.refreshToken,
            expiresIn: tokens.expiresIn,
            scope: tokens.scope
        });

        // Import in the background so the browser returns immediately; the
        // Connections tab polls for the resulting count.
        importLikedFromProvider(user.id, providerId).catch((e) =>
            console.error(`[Dashboard] Import (${providerId}) failed:`, e.message)
        );

        return done("ok");
    } catch (error) {
        console.error(`[Dashboard] Connect (${providerId}) failed:`, error.message);
        return done("error");
    }
}
