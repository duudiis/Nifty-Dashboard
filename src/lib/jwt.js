import { SignJWT, jwtVerify } from "jose";

// Stateless sessions: the signed JWT *is* the session. No database required.
const secret = new TextEncoder().encode(
    process.env.DASHBOARD_JWT_SECRET || "change-me-in-production-please"
);

const ISSUER = "nifty-dashboard";
const MAX_AGE_SECONDS = 60 * 60 * 24 * 30; // 30 days

/**
 * Signs a session token for a Discord user.
 * @param {{ id: string, username: string, avatar_url: string }} user
 */
export async function signSession(user) {
    return await new SignJWT({
        username: user.username,
        avatar_url: user.avatar_url
    })
        .setProtectedHeader({ alg: "HS256" })
        .setSubject(user.id)
        .setIssuer(ISSUER)
        .setIssuedAt()
        .setExpirationTime(`${MAX_AGE_SECONDS}s`)
        .sign(secret);
}

/**
 * Verifies a session token and returns the user payload, or null if invalid.
 * @param {string} token
 */
export async function verifySession(token) {
    if (!token) return null;
    try {
        const { payload } = await jwtVerify(token, secret, { issuer: ISSUER });
        return {
            id: payload.sub,
            username: payload.username,
            avatar_url: payload.avatar_url
        };
    } catch {
        return null;
    }
}

export const SESSION_MAX_AGE = MAX_AGE_SECONDS;
