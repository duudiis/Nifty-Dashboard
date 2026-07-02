import { parse } from "cookie";

import { verifySession } from "../lib/jwt.js";

import BotSocket from "./BotSocket.js";
import UserSocket from "./UserSocket.js";

const HEARTBEAT_INTERVAL = 45_000;
const HEARTBEAT_JITTER = 8_000;

/**
 * Handles a single raw WebSocket from handshake through identification.
 *
 * Browsers are authenticated transparently from their httpOnly session cookie
 * (sent on the upgrade request) — the JWT is never exposed to client JS. Bots
 * have no cookie and instead identify with the shared DASHBOARD_TOKEN. Peers
 * that miss heartbeats are terminated.
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

        this.armHeartbeat();

        this.socket.on("message", (raw) => this.onMessage(raw));
        this.socket.on("close", () => clearTimeout(this.heartbeatTimeout));
        this.socket.on("error", () => { try { this.socket.terminate(); } catch {} });

        // Try cookie-based user auth immediately.
        this.tryCookieAuth();
    }

    armHeartbeat() {
        clearTimeout(this.heartbeatTimeout);
        this.heartbeatTimeout = setTimeout(() => {
            try { this.socket.terminate(); } catch {}
        }, HEARTBEAT_INTERVAL + HEARTBEAT_JITTER);
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
            this.armHeartbeat();
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
