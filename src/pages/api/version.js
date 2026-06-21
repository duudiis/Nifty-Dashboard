import fs from "fs";
import path from "path";

// The Next.js build id changes on every build/deploy. The client compares the
// id it was served with (window.__NEXT_DATA__.buildId) against this; a mismatch
// means a newer dashboard has been deployed.
let cached = null;

export default function handler(req, res) {
    if (!cached) {
        try {
            cached = fs.readFileSync(path.join(process.cwd(), ".next", "BUILD_ID"), "utf8").trim();
        } catch {
            cached = "dev";
        }
    }
    res.setHeader("Cache-Control", "no-store");
    res.status(200).json({ version: cached });
}
