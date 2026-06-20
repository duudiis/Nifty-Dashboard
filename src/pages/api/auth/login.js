import { serialize } from "cookie";

import { exchangeCode, fetchUser } from "../../../lib/discord.js";
import { signSession, SESSION_MAX_AGE } from "../../../lib/jwt.js";

export default async function handler(req, res) {
    if (req.method !== "POST") {
        return res.status(405).json({ message: "Method Not Allowed" });
    }

    const code = req.body?.code;
    if (!code) {
        return res.status(400).json({ message: "Missing authorization code.", code: "MISSING_CODE" });
    }

    const auth = await exchangeCode(code);
    if (auth.error) {
        return res.status(400).json(auth.error);
    }

    const user = await fetchUser(auth.tokenType, auth.accessToken);
    if (user.error) {
        return res.status(400).json(user.error);
    }

    const token = await signSession(user);

    res.setHeader("Set-Cookie", serialize("session", token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: SESSION_MAX_AGE,
        path: "/"
    }));

    return res.status(200).json({ message: "Logged in.", user });
}
