// When a connection may sync, and when it should on its own. Pure — the job
// runner (syncJobs.js) and the API feed it timestamps and act on the answers.

const SECOND = 1000;
const MINUTE = 60 * SECOND;
const HOUR = 60 * MINUTE;

export const MANUAL_COOLDOWN_MS = 2 * MINUTE;   // gap after a finished sync before "Sync" works again
export const RETRY_COOLDOWN_MS = 30 * SECOND;   // shorter gap after a failed one
export const AUTO_SYNC_AFTER_MS = 6 * HOUR;     // a connection this stale is synced automatically
export const AUTO_CHECK_EVERY_MS = 15 * MINUTE; // how often the scheduler looks for stale connections
export const AUTO_FIRST_CHECK_MS = 2 * MINUTE;  // first look after the server starts
export const AUTO_STAGGER_MS = 5 * SECOND;      // pause between two automatic syncs
export const BACKOFF_BASE_MS = 30 * MINUTE;     // automatic retries after a failure: 30m, 1h, 2h … capped
export const BACKOFF_MAX_MS = 24 * HOUR;

const toMs = (value) => {
    if (value == null) return null;
    const ms = value instanceof Date ? value.getTime() : typeof value === "number" ? value : Date.parse(value);
    return Number.isFinite(ms) ? ms : null;
};

// Epoch ms from which a manual sync is allowed again, or null when it never
// has to wait. `lastSyncedAt` is the last successful sync of any kind;
// `lastFailedAt` the last failed attempt.
export function nextManualSyncAt({ lastSyncedAt = null, lastFailedAt = null } = {}) {
    const afterSuccess = toMs(lastSyncedAt);
    const afterFailure = toMs(lastFailedAt);
    const next = Math.max(
        afterSuccess == null ? 0 : afterSuccess + MANUAL_COOLDOWN_MS,
        afterFailure == null ? 0 : afterFailure + RETRY_COOLDOWN_MS
    );
    return next || null;
}

// How long automatic syncs leave a connection alone after `failures`
// consecutive failures.
export function backoffMs(failures) {
    if (!failures || failures < 1) return 0;
    return Math.min(BACKOFF_MAX_MS, BACKOFF_BASE_MS * 2 ** (failures - 1));
}

// The connections an automatic pass should sync now, stalest first.
//
//   connections  [{ userId, provider, lastSyncedAt }]
//   failures     key -> { count, at }   consecutive failures (see connectionKey)
//   isRunning    (key) => boolean       a sync of it is already in flight
//   isAvailable  (provider) => boolean  its credentials are configured
export function selectDueConnections(connections, { now, failures = new Map(), isRunning = () => false, isAvailable = () => true }) {
    const staleness = (connection) => toMs(connection.lastSyncedAt) ?? -Infinity; // never synced sorts first
    return connections
        .filter((connection) => {
            const key = connectionKey(connection.userId, connection.provider);
            if (!isAvailable(connection.provider) || isRunning(key)) return false;
            const failed = failures.get(key);
            if (failed && now < failed.at + backoffMs(failed.count)) return false;
            const last = toMs(connection.lastSyncedAt);
            return last == null || now - last >= AUTO_SYNC_AFTER_MS;
        })
        .sort((a, b) => staleness(a) - staleness(b));
}

export function connectionKey(userId, provider) {
    return `${userId}:${provider}`;
}

// What to tell the user when a sync fails. Token problems need a reconnect;
// everything else is worth simply trying again.
export function describeSyncError(error, label) {
    const message = String(error?.message || error || "");
    if (/Not connected/i.test(message)) return `${label} isn't connected.`;
    if (error?.rateLimited) return `${label} is rate-limiting us — try again in a few minutes.`;
    if (error?.status === 401 || error?.status === 403 || /refresh|token/i.test(message)) {
        return `${label} access expired — disconnect and connect again.`;
    }
    return `Couldn't reach ${label} — try again in a moment.`;
}
