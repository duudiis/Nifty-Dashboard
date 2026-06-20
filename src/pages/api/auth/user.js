import { parse } from "cookie";

import { verifySession } from "../../../lib/jwt.js";

export default async function handler(req, res) {
    const cookies = parse(req.headers.cookie || "");
    const user = await verifySession(cookies.session);

    if (!user) {
        return res.status(401).json({ message: "Not authenticated." });
    }

    return res.status(200).json({ user });
}
