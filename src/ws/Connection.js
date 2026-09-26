import { parse } from "cookie";

import { verifySession } from "../lib/jwt.js";

import BotSocket from "./BotSocket.js";
import UserSocket from "./UserSocket.js";

// Liveness is driven from this side with protocol-level ping frames: the
// browser answers them in its network stack, so a backgrounded tab stays up
// even when its JavaScript timers are throttled (Chrome clamps them to ~1/min,
// which used to trip the old client-timer heartbeat and drop the socket every
// minute). Bots that send app-level "heartbeat" frames keep working unchanged —
// either one counts as a sign of life.
const PING_INTERVAL = 30_000;
const LIVENESS_GRACE = 90_000; // ~3 missed pings before we call it dead

// Advertised to peers that run their own heartbeat timer (the bots).
const HEARTBEAT_INTERVAL = 45_000;

/**
 * Handles a single raw WebSocket from handshake through identification.
 *
 * Browsers are authenticated transparently from their httpOnly session cookie
 * (sent on the upgrade request) — the JWT is never exposed to client JS. Bots
 * have no cookie and instead identify with the shared DASHBOARD_TOKEN. Peers
 * that go silent are terminated.
 */
export default class Connection {

    constructor(socket, req) {
        this.socket = socket;
        this.req = req;
        this.role = null; // BotSocket | UserSocket once identified

        this.socket.send(JSON.stringify({
            operation: "hello",
            data: { heartbeatInterval: HEARTBEAT_INTERVAL }
        }));

        this.armLiveness();
        this.pingTimer = setInterval(() => {
            try { this.socket.ping(); } catch {}
        }, PING_INTERVAL);

        this.socket.on("message", (raw) => this.onMessage(raw));
        this.socket.on("pong", () => this.armLiveness());
        this.socket.on("close", () => this.teardown());
        this.socket.on("error", () => { try { this.socket.terminate(); } catch {} });

        // Try cookie-based user auth immediately.
        this.tryCookieAuth();
    }

    armLiveness() {
        clearTimeout(this.livenessTimeout);
        this.livenessTimeout = setTimeout(() => {
            try { this.socket.terminate(); } catch {}
        }, LIVENESS_GRACE);
    }

    teardown() {
        clearTimeout(this.livenessTimeout);
        clearInterval(this.pingTimer);
    }

    async tryCookieAuth() {
        try {
            const cookies = parse(this.req?.headers?.cookie || "");
            const user = await verifySession(cookies.session);
            if (user && !this.role) {
                this.role = new UserSocket(this.socket, user);
                this.socket.send(JSON.stringify({
                    operation: "identify_success",
                    data: { user }
                }));
            }
        } catch { /* fall back to token identify */ }
    }

    async onMessage(raw) {
        let message;
        try {
            message = JSON.parse(raw.toString());
        } catch {
            return; // ignore malformed frames
        }

        // Heartbeats work the same before and after identification.
        if (message.operation === "heartbeat") {
            this.armLiveness();
            this.socket.send(JSON.stringify({ operation: "heartbeat_ack" }));
            return;
        }

        if (!this.role) {
            if (message.operation === "identify") {
                await this.identify(message.data || {});
            }
            return;
        }

        this.role.onMessage(message);
    }

    async identify(data) {
        const token = data.token;

        // Bot identification: shared secret. The botId (the bot's Discord user
        // id) scopes routing and matches its rows in the shared database.
        const botToken = process.env.DASHBOARD_TOKEN;
        if (botToken && token === botToken) {
            this.role = new BotSocket(this.socket, data.botName, data.botId);
            this.socket.send(JSON.stringify({ operation: "identify_success" }));
            return;
        }

        // Browser identification fallback: a session JWT passed explicitly.
        const user = await verifySession(token);
        if (user) {
            this.role = new UserSocket(this.socket, user);
            this.socket.send(JSON.stringify({
                operation: "identify_success",
                data: { user }
            }));
            return;
        }

        this.socket.send(JSON.stringify({ operation: "identify_error" }));
    }
}
