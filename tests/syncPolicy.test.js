import assert from "node:assert/strict";
import test from "node:test";
import {
    AUTO_SYNC_AFTER_MS, BACKOFF_BASE_MS, BACKOFF_MAX_MS, MANUAL_COOLDOWN_MS, RETRY_COOLDOWN_MS,
    backoffMs, connectionKey, describeSyncError, nextManualSyncAt, selectDueConnections
} from "../src/connect/syncPolicy.js";

const NOW = Date.parse("2026-11-20T12:00:00Z");
const ago = (ms) => new Date(NOW - ms).toISOString();

test("a connection that never synced can sync right away", () => {
    assert.equal(nextManualSyncAt({}), null);
    assert.equal(nextManualSyncAt({ lastSyncedAt: null, lastFailedAt: null }), null);
});

test("a finished sync starts the manual cooldown", () => {
    const synced = NOW - 30_000;
    assert.equal(nextManualSyncAt({ lastSyncedAt: new Date(synced) }), synced + MANUAL_COOLDOWN_MS);
    assert.equal(nextManualSyncAt({ lastSyncedAt: new Date(synced).toISOString() }), synced + MANUAL_COOLDOWN_MS);
});

test("a failed attempt only asks for a short wait", () => {
    const failed = NOW - 5_000;
    assert.equal(nextManualSyncAt({ lastFailedAt: failed }), failed + RETRY_COOLDOWN_MS);
    // whichever wait ends later wins
    const synced = NOW - 10_000;
    assert.equal(nextManualSyncAt({ lastSyncedAt: synced, lastFailedAt: failed }), synced + MANUAL_COOLDOWN_MS);
    assert.equal(nextManualSyncAt({ lastSyncedAt: NOW - 10 * MANUAL_COOLDOWN_MS, lastFailedAt: failed }), failed + RETRY_COOLDOWN_MS);
});

test("automatic retries back off and cap", () => {
    assert.equal(backoffMs(0), 0);
    assert.equal(backoffMs(1), BACKOFF_BASE_MS);
    assert.equal(backoffMs(2), BACKOFF_BASE_MS * 2);
    assert.equal(backoffMs(3), BACKOFF_BASE_MS * 4);
    assert.equal(backoffMs(40), BACKOFF_MAX_MS);
});

test("auto-sync picks stale connections, stalest first", () => {
    const connections = [
        { userId: "1", provider: "spotify", lastSyncedAt: ago(AUTO_SYNC_AFTER_MS + 60_000) },
        { userId: "1", provider: "youtube", lastSyncedAt: ago(60_000) },                 // fresh
        { userId: "2", provider: "spotify", lastSyncedAt: ago(3 * AUTO_SYNC_AFTER_MS) },
        { userId: "3", provider: "tidal", lastSyncedAt: null }                           // never finished a sync
    ];
    const due = selectDueConnections(connections, { now: NOW });
    assert.deepEqual(due.map((c) => connectionKey(c.userId, c.provider)), ["3:tidal", "2:spotify", "1:spotify"]);
});

test("auto-sync skips running, unconfigured and backing-off connections", () => {
    const stale = ago(2 * AUTO_SYNC_AFTER_MS);
    const connections = [
        { userId: "1", provider: "spotify", lastSyncedAt: stale },
        { userId: "1", provider: "youtube", lastSyncedAt: stale },
        { userId: "1", provider: "deezer", lastSyncedAt: stale },
        { userId: "2", provider: "spotify", lastSyncedAt: stale },
        { userId: "3", provider: "spotify", lastSyncedAt: stale }
    ];
    const failures = new Map([
        ["2:spotify", { count: 1, at: NOW - 60_000 }],                 // failed a minute ago: wait
        ["3:spotify", { count: 1, at: NOW - BACKOFF_BASE_MS - 1 }]     // backoff over: retry
    ]);
    const due = selectDueConnections(connections, {
        now: NOW,
        failures,
        isRunning: (key) => key === "1:youtube",
        isAvailable: (provider) => provider !== "deezer"
    });
    assert.deepEqual(due.map((c) => connectionKey(c.userId, c.provider)).sort(), ["1:spotify", "3:spotify"]);
});

test("sync errors are explained in the user's terms", () => {
    const withStatus = (message, status, rateLimited = false) => Object.assign(new Error(message), { status, rateLimited });
    assert.match(describeSyncError(withStatus("Spotify liked 401", 401), "Spotify"), /access expired/);
    assert.match(describeSyncError(new Error("Spotify refresh 400"), "Spotify"), /access expired/);
    assert.match(describeSyncError(withStatus("YouTube liked 403", 403, true), "YouTube"), /rate-limiting/);
    assert.match(describeSyncError(withStatus("Spotify liked 429", 429, true), "Spotify"), /rate-limiting/);
    assert.match(describeSyncError(withStatus("Spotify liked 503", 503), "Spotify"), /Couldn't reach Spotify/);
    assert.match(describeSyncError(new Error("fetch failed"), "Tidal"), /Couldn't reach Tidal/);
    assert.match(describeSyncError(new Error("Not connected."), "Tidal"), /isn't connected/);
});
