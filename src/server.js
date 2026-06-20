import http from "http";
import { parse } from "url";
import next from "next";
import { WebSocketServer } from "ws";

import Connection from "./ws/Connection.js";

const dev = process.env.NODE_ENV !== "production";
const port = parseInt(process.env.PORT || "3000", 10);

// The dashboard WebSocket lives on a dedicated path so it never collides with
// Next.js' own HMR socket in development.
const WS_PATH = "/ws";

const app = next({ dev, dir: process.cwd() });
const handle = app.getRequestHandler();

app.prepare().then(() => {

    const server = http.createServer((req, res) => {
        handle(req, res, parse(req.url, true));
    });

    // Our hub. `noServer` lets us route upgrades ourselves.
    const wss = new WebSocketServer({ noServer: true });
    wss.on("connection", (socket, req) => {
        try {
            new Connection(socket, req);
        } catch (error) {
            console.error("[Dashboard] Connection error:", error);
            try { socket.terminate(); } catch {}
        }
    });

    const nextUpgrade = app.getUpgradeHandler();

    server.on("upgrade", (req, socket, head) => {
        const { pathname } = parse(req.url);

        if (pathname === WS_PATH) {
            wss.handleUpgrade(req, socket, head, (ws) => {
                wss.emit("connection", ws, req);
            });
        } else {
            // Everything else (Next HMR, etc.) goes to Next.
            nextUpgrade(req, socket, head);
        }
    });

    server.listen(port, () => {
        console.log(`> Nifty Dashboard ready on http://localhost:${port}`);
        console.log(`> WebSocket hub listening on path ${WS_PATH}`);
    });

});
