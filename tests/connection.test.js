import assert from "node:assert/strict";
import { EventEmitter } from "node:events";
import test from "node:test";

import Connection from "../src/ws/Connection.js";
import { users } from "../src/ws/registry.js";
import { signSession } from "../src/lib/jwt.js";

class FakeSocket extends EventEmitter {
    OPEN = 1;
    CLOSED = 3;
    readyState = this.OPEN;
    sent = [];
    pingCount = 0;
    terminationCount = 0;
    respondToPing = false;
    _socket = { setKeepAlive() {}, setNoDelay() {} };

    send(frame) {
        assert.equal(this.readyState, this.OPEN, "closed sockets must never receive an authentication reply");
        this.sent.push(JSON.parse(frame));
    }

    ping() {
        this.pingCount++;
        if (this.respondToPing) this.emit("pong");
    }

    close() {
        if (this.readyState === this.CLOSED) return;
        this.readyState = this.CLOSED;
        this.emit("close");
    }

    terminate() {
        this.terminationCount++;
        this.close();
    }
}

// Observe the actual asynchronous JWT verification without replacing it or
// exposing a testing-only hook in the production connection.
class ObservedConnection extends Connection {
    tryCookieAuth() {
        this.authComplete = super.tryCookieAuth();
        return this.authComplete;
    }
}

function fakeClock(t) {
    t.mock.timers.enable({ apis: ["setInterval", "Date"], now: Date.now() });
}

test("protocol pongs keep an idle browser alive without JavaScript heartbeats", (t) => {
    fakeClock(t);
    const socket = new FakeSocket();
    socket.respondToPing = true;
    new Connection(socket, { headers: {} });
    t.after(() => socket.close());

    for (let interval = 0; interval < 12; interval++) t.mock.timers.tick(25_000);

    assert.equal(socket.pingCount, 12);
    assert.equal(socket.terminationCount, 0);
    assert.equal(socket.readyState, socket.OPEN);
    assert.deepEqual(socket.sent.map((frame) => frame.operation), ["hello"]);
});

test("a genuinely silent peer is terminated after the liveness grace period", (t) => {
    fakeClock(t);
    const socket = new FakeSocket();
    new Connection(socket, { headers: {} });
    t.after(() => socket.close());

    for (let interval = 0; interval < 3; interval++) t.mock.timers.tick(25_000);
    assert.equal(socket.terminationCount, 0, "temporary packet loss should have time to recover");
    t.mock.timers.tick(25_000);
    assert.equal(socket.terminationCount, 1);
    assert.equal(socket.readyState, socket.CLOSED);

    const pingsAtClose = socket.pingCount;
    t.mock.timers.tick(100_000);
    assert.equal(socket.pingCount, pingsAtClose, "teardown must cancel future probes");
    assert.equal(socket.terminationCount, 1);
});

test("resuming after a server event-loop suspension gives the peer a fresh chance to respond", (t) => {
    fakeClock(t);
    const socket = new FakeSocket();
    const connection = new Connection(socket, { headers: {} });
    t.after(() => socket.close());

    // Move wall time without executing interval callbacks, as during suspend.
    t.mock.timers.setTime(Date.now() + 120_000);
    socket.respondToPing = true;
    t.mock.timers.tick(1);

    assert.ok(socket.pingCount > 0);
    assert.equal(socket.terminationCount, 0);
    assert.equal(connection.lastActivity, Date.now());
    for (let interval = 0; interval < 4; interval++) t.mock.timers.tick(25_000);
    assert.equal(socket.terminationCount, 0);
});

test("a valid cookie registers an open browser and close removes it", async (t) => {
    const token = await signSession({ id: "connection-test-user", username: "Listener", avatar_url: null });
    fakeClock(t);
    const before = users.size;
    const socket = new FakeSocket();
    t.after(() => socket.close());
    const connection = new ObservedConnection(socket, { headers: { cookie: `session=${token}` } });

    await connection.authComplete;

    assert.ok(connection.role);
    assert.equal(users.size, before + 1);
    assert.ok(users.has(connection.role));
    assert.equal(socket.sent.at(-1).operation, "identify_success");
    socket.close();
    assert.equal(users.size, before);
});

test("closing during asynchronous cookie authentication cannot leak a UserSocket into the registry", async (t) => {
    const token = await signSession({ id: "connection-race-test-user", username: "Listener", avatar_url: null });
    fakeClock(t);
    const before = users.size;
    const socket = new FakeSocket();
    const connection = new ObservedConnection(socket, { headers: { cookie: `session=${token}` } });
    t.after(() => socket.close());

    // JWT verification has yielded; close arrives before it can register a role.
    socket.close();
    await connection.authComplete;

    assert.equal(connection.role, null);
    assert.equal(users.size, before);
    assert.deepEqual(socket.sent.map((frame) => frame.operation), ["hello"]);
    t.mock.timers.tick(100_000);
    assert.equal(socket.pingCount, 0);
});
