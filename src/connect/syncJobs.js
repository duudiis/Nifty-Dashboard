// Runs liked-song syncs as background jobs and keeps their progress, so a
// request only has to start one and the UI can watch it.
//
//   startSync(userId, provider, { trigger, full })   start (or join) a sync
//   getSyncState(userId, provider)                   what the UI shows
//   syncStatesFor(userId)                            the same, for every provider seen
//   manualSyncAllowedAt(userId, provider, lastSyncedAt)   cooldown, epoch ms
//   startAutoSync()                                  the stale-connection scheduler
//   onSyncImported(listener)                         told when a sync added songs
//
// State lives on globalThis: the API routes (bundled by Next) and server.js
// (plain Node) each load their own copy of this module, but they are one
// process and must see the same jobs. It is in memory only — a restart forgets
// progress and failure counts, never the data, which is in the database.

import { getProvider } from "./providers.js";
import { importLikedFromProvider, listAllConnections } from "../lib/connections.js";
import {
    AUTO_CHECK_EVERY_MS, AUTO_FIRST_CHECK_MS, AUTO_STAGGER_MS,
    connectionKey, describeSyncError, nextManualSyncAt, selectDueConnections
} from "./syncPolicy.js";

const state = (globalThis.__niftySync ??= {
    jobs: new Map(),      // key -> job (the latest one per connection)
    failures: new Map(),  // key -> { count, at } consecutive failures
    listeners: new Set(), // (userId, { provider, label, imported, trigger }) => void
    scheduler: null,
    ticking: false
});

const iso = (ms) => (ms ? new Date(ms).toISOString() : null);

function publicState(job) {
    if (!job) return { status: "idle" };
    return {
        status: job.status,            // "running" | "idle" | "error"
        trigger: job.trigger,          // "manual" | "auto" | "connect"
        phase: job.phase,              // "reading" | "saving" while running
        done: job.done,
        total: job.total,
        startedAt: iso(job.startedAt),
        finishedAt: iso(job.finishedAt),
        result: job.result,            // { imported, scanned, mode } once it succeeded
        error: job.error               // what to tell the user once it failed
    };
}

export function getSyncState(userId, provider) {
    return publicState(state.jobs.get(connectionKey(userId, provider)));
}

export function syncStatesFor(userId) {
    const prefix = `${userId}:`;
    const out = {};
    for (const [key, job] of state.jobs) {
        if (key.startsWith(prefix)) out[key.slice(prefix.length)] = publicState(job);
    }
    return out;
}

export function isSyncRunning(userId, provider) {
    return state.jobs.get(connectionKey(userId, provider))?.status === "running";
}

// Epoch ms from which the user may press Sync again (null: right away).
export function manualSyncAllowedAt(userId, provider, lastSyncedAt) {
    const job = state.jobs.get(connectionKey(userId, provider));
    return nextManualSyncAt({
        lastSyncedAt,
        lastFailedAt: job?.status === "error" ? job.finishedAt : null
    });
}

// Calls `listener(userId, { provider, label, imported, trigger })` whenever a
// sync adds songs to someone's Liked songs. server.js uses it to nudge that
// user's open dashboards over the WebSocket hub, which only it can reach.
export function onSyncImported(listener) {
    state.listeners.add(listener);
}

// Forget a connection's job when it is disconnected.
export function clearSync(userId, provider) {
    const key = connectionKey(userId, provider);
    state.jobs.delete(key);
    state.failures.delete(key);
}

/**
 * Starts a sync in the background and returns its job right away. A sync of
 * the same connection that is already running is joined instead of doubled.
 * `job.finished` resolves (never rejects) when it is over.
 */
export function startSync(userId, provider, { trigger = "manual", full = false } = {}) {
    const key = connectionKey(userId, provider);
    const running = state.jobs.get(key);
    if (running?.status === "running") return running;

    const label = getProvider(provider)?.label || provider;
    const job = {
        status: "running", trigger, phase: "reading", done: 0, total: null,
        startedAt: Date.now(), finishedAt: null, result: null, error: null
    };
    state.jobs.set(key, job);

    const finished = importLikedFromProvider(userId, provider, {
        full,
        onProgress: (progress) => Object.assign(job, progress)
    })
        .then((result) => {
            job.status = "idle";
            job.result = result;
            state.failures.delete(key);
            if (result.imported > 0 || trigger !== "auto") {
                console.log(`[Dashboard] Sync ${key} (${trigger}, ${result.mode}): ${result.imported} new of ${result.scanned} read`);
            }
            if (result.imported > 0) {
                for (const listener of state.listeners) {
                    try { listener(userId, { provider, label, imported: result.imported, trigger }); } catch { /* a listener never fails a sync */ }
                }
            }
        })
        .catch((error) => {
            job.status = "error";
            job.error = describeSyncError(error, label);
            state.failures.set(key, { count: (state.failures.get(key)?.count || 0) + 1, at: Date.now() });
            console.error(`[Dashboard] Sync ${key} (${trigger}) failed:`, error.message);
        })
        .finally(() => {
            job.phase = null;
            job.finishedAt = Date.now();
        });

    // Not enumerable: kept off anything that serializes the job.
    Object.defineProperty(job, "finished", { value: finished });
    return job;
}

/* ---------------------------------------------------------------- auto-sync */

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// One pass: sync every connection that has gone stale, one after another.
async function autoSyncPass() {
    if (state.ticking) return; // the previous pass is still working through its list
    state.ticking = true;
    try {
        const due = selectDueConnections(await listAllConnections(), {
            now: Date.now(),
            failures: state.failures,
            isRunning: (key) => state.jobs.get(key)?.status === "running",
            isAvailable: (provider) => !!getProvider(provider)?.available()
        });
        for (const connection of due) {
            await startSync(connection.userId, connection.provider, { trigger: "auto" }).finished;
            await sleep(AUTO_STAGGER_MS);
        }
    } catch (error) {
        console.error("[Dashboard] Auto-sync pass failed:", error.message);
    } finally {
        state.ticking = false;
    }
}

// Starts the scheduler once per process. Timers are unref'd so they never
// keep the server alive on shutdown. AUTO_SYNC=off leaves it stopped, for a
// second instance (a preview, a dev server) pointed at the same database.
export function startAutoSync() {
    if (state.scheduler || process.env.AUTO_SYNC === "off") return;
    state.scheduler = setInterval(autoSyncPass, AUTO_CHECK_EVERY_MS);
    state.scheduler.unref?.();
    setTimeout(autoSyncPass, AUTO_FIRST_CHECK_MS).unref?.();
}
