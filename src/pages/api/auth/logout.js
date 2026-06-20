import { serialize } from "cookie";

export default function handler(req, res) {
    res.setHeader("Set-Cookie", serialize("session", "", {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 0,
        path: "/"
    }));

    return res.status(200).json({ message: "Logged out." });
}
