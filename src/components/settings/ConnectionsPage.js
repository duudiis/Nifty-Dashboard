import { useCallback, useEffect, useRef, useState } from "react";

import { useNifty } from "../../context/NiftyContext.js";
import { useModal } from "../modal/Modal.js";
import { Badge, Button, Note, PageHeading, Row, Rows, Section } from "./primitives.js";

const PLATFORM_META = {
    spotify: { name: "Spotify", blurb: "Import your Spotify liked songs, kept in sync." },
    deezer: { name: "Deezer", blurb: "Import your Deezer favorite tracks." },
    youtube: { name: "YouTube", blurb: "Import your YouTube liked videos." },
    tidal: { name: "Tidal", blurb: "Import your Tidal favorite tracks." }
};

// How often to ask for progress — only while a sync is actually running.
const PROGRESS_POLL_MS = 800;

const count = (n) => Number(n || 0).toLocaleString();
const songs = (n) => `${count(n)} song${n === 1 ? "" : "s"}`;

function timeAgo(iso) {
    if (!iso) return null;
    const secs = Math.max(0, (Date.now() - new Date(iso).getTime()) / 1000);
    if (secs < 60) return "just now";
    const mins = Math.floor(secs / 60);
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
}

// "1:32" until a cooldown ends.
function countdown(ms) {
    const secs = Math.ceil(ms / 1000);
    return `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;
}

// The line under a connection's name: who it is and how much came from it.
function describe(provider, connection) {
    if (!connection) return provider.available ? PLATFORM_META[provider.id].blurb : "Not configured on this server.";
    return `${connection.externalName || "Account"} · ${count(connection.likedCount)} imported`;
}

// What a running sync is doing, in words.
function progressText(sync) {
    if (sync.phase === "saving") return sync.total > 0 ? `Saving ${songs(sync.total)}…` : "Finishing up…";
    if (sync.total > 0) return `Reading your likes… ${count(Math.min(sync.done, sync.total))} of ${count(sync.total)}`;
    return sync.trigger === "connect" ? "Starting your first import…" : "Starting…";
}

// How the last sync went.
function resultText(connection) {
    const { sync = {}, lastSyncedAt } = connection;
    if (!lastSyncedAt) return "Not synced yet";
    const parts = [`Synced ${timeAgo(lastSyncedAt)}`];
    if (sync.status === "idle" && sync.result) {
        parts.push(sync.result.imported > 0 ? `${count(sync.result.imported)} new` : "already up to date");
        if (sync.trigger === "auto") parts.push("automatic");
    }
    return parts.join(" · ");
}

// Status under a connected account: a live bar while syncing, otherwise the
// outcome of the last sync (or what went wrong).
function SyncStatus({ connection }) {
    const sync = connection.sync || {};

    if (sync.status === "running") {
        const ratio = sync.total > 0 ? Math.min(1, sync.done / sync.total) : 0;
        return (
            <span className="mt-2 block max-w-sm">
                <span className="block text-[11px] tabular-nums text-maintext/80">{progressText(sync)}</span>
                <span
                    role="progressbar"
                    aria-label="Sync progress"
                    aria-valuemin={0}
                    aria-valuemax={100}
                    aria-valuenow={sync.total > 0 ? Math.round(ratio * 100) : undefined}
                    className="mt-1.5 block h-1 overflow-hidden rounded-full bg-maintext/10"
                >
                    <span
                        className="block h-full rounded-full bg-accent transition-[width] duration-300 ease-out"
                        style={{ width: `${ratio * 100}%` }}
                    />
                </span>
            </span>
        );
    }

    if (sync.status === "error") {
        return <span className="mt-1 block text-[11px] text-rose-400" role="alert">{sync.error || "The last sync failed."}</span>;
    }
    return <span className="mt-1 block text-[11px] text-subtext/80">{resultText(connection)}</span>;
}

// Static stand-ins while the list loads, so the rows don't jump in.
function PlaceholderRows() {
    return (
        <Rows>
            {Object.keys(PLATFORM_META).map((id) => (
                <div key={id} className="flex items-center justify-between gap-6 py-3 first:pt-0 last:pb-0">
                    <div className="flex flex-col gap-2">
                        <span className="h-3.5 w-24 rounded bg-elevated" />
                        <span className="h-3 w-56 rounded bg-elevated/70" />
                    </div>
                    <span className="h-8 w-20 rounded-md bg-elevated" />
                </div>
            ))}
        </Rows>
    );
}

export default function ConnectionsPage() {
    const { notify, refreshLibrary } = useNifty();
    const modal = useModal();
    // { providers, connections, autoSync, skew } — skew is server clock minus ours.
    const [state, setState] = useState(null);
    const [busy, setBusy] = useState(null);    // provider id mid-request
    const [, setTick] = useState(0);           // re-renders a cooldown countdown

    const load = useCallback(() =>
        fetch("/api/connect")
            .then((r) => r.json())
            .then((next) => setState({ ...next, skew: next.now ? Date.parse(next.now) - Date.now() : 0 }))
            .catch(() => setState({ providers: [], connections: [] })), []);

    useEffect(() => { load(); }, [load]);

    const connections = state?.connections || [];
    const connectionFor = (id) => connections.find((c) => c.provider === id);
    const cooldownLeft = (connection) =>
        connection?.nextSyncAt ? Date.parse(connection.nextSyncAt) - (Date.now() + (state?.skew || 0)) : 0;

    // Follow running syncs: poll their progress (memory-only on the server),
    // and when one ends reload the list and say how it went. Nothing is polled
    // while every connection is idle.
    const runningIds = connections.filter((c) => c.sync?.status === "running").map((c) => c.provider).join(",");
    const announce = useRef(null);
    announce.current = (id, sync) => {
        const name = PLATFORM_META[id]?.name || id;
        if (sync?.status === "error") return notify(sync.error || `Couldn't sync ${name}`);
        const imported = sync?.result?.imported || 0;
        if (imported > 0) {
            notify(`Imported ${songs(imported)} from ${name}`);
            refreshLibrary();
        } else if (sync?.result) {
            notify(`${name} is already up to date`);
        }
    };
    useEffect(() => {
        if (!runningIds) return;
        const ids = runningIds.split(",");
        let stopped = false;
        const poll = async () => {
            const body = await fetch("/api/connect?view=progress").then((r) => r.json()).catch(() => null);
            if (stopped || !body) return;
            const sync = body.sync || {};
            const ended = ids.filter((id) => sync[id]?.status !== "running");
            if (ended.length) {
                stop(); // one announcement per sync, even if a poll is still in flight
                ended.forEach((id) => announce.current(id, sync[id]));
                await load();
                return;
            }
            setState((prev) => prev && {
                ...prev,
                connections: prev.connections.map((c) => (sync[c.provider] ? { ...c, sync: sync[c.provider] } : c))
            });
        };
        const timer = setInterval(poll, PROGRESS_POLL_MS);
        const stop = () => { stopped = true; clearInterval(timer); };
        return stop;
    }, [runningIds, load]);

    // Tick once a second while a cooldown is counting down, and not otherwise.
    const cooldownEndsAt = Math.max(0, ...connections.map((c) => (c.nextSyncAt ? Date.parse(c.nextSyncAt) : 0)));
    useEffect(() => {
        const skew = state?.skew || 0;
        if (cooldownEndsAt <= Date.now() + skew) return;
        const timer = setInterval(() => {
            setTick((n) => n + 1);
            if (cooldownEndsAt <= Date.now() + skew) clearInterval(timer);
        }, 1000);
        return () => clearInterval(timer);
    }, [cooldownEndsAt, state?.skew]);

    const post = async (action, provider) => {
        const res = await fetch("/api/connect", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action, provider })
        });
        const body = await res.json();
        if (!res.ok) throw Object.assign(new Error(body.message), { status: res.status });
        return body;
    };

    // Starts the sync; the progress effect above takes it from there.
    const sync = async (id) => {
        setBusy(id);
        try {
            const { sync: started } = await post("sync", id);
            setState((prev) => prev && {
                ...prev,
                connections: prev.connections.map((c) => (c.provider === id ? { ...c, sync: started } : c))
            });
        } catch (error) {
            // Cooling down (429) comes with its own wording and a fresh time.
            notify(error.status === 429 && error.message ? error.message : "Couldn't start the sync — try again in a moment");
            await load();
        } finally {
            setBusy(null);
        }
    };

    const disconnect = async (id) => {
        const name = PLATFORM_META[id].name;
        const imported = connectionFor(id)?.likedCount || 0;
        const sure = await modal.confirm({
            title: `Disconnect ${name}?`,
            message: `The ${imported > 0 ? count(imported) + " " : ""}liked song${imported === 1 ? "" : "s"} imported from ${name} will be removed from your Liked songs. Songs you liked here, or that came from another connected account, stay. You can reconnect and re-import any time.`,
            confirmLabel: "Disconnect & remove",
            danger: true
        });
        if (!sure) return;

        setBusy(id);
        try {
            const { removed } = await post("disconnect", id);
            notify(removed > 0 ? `Disconnected ${name} — removed ${songs(removed)}` : `Disconnected ${name}`);
            refreshLibrary();
            await load();
        } catch (error) {
            notify(error.status === 409 && error.message ? error.message : `Couldn't disconnect ${name}`);
        } finally {
            setBusy(null);
        }
    };

    const autoSyncHours = state?.autoSync?.everyMs ? Math.round(state.autoSync.everyMs / 3_600_000) : null;

    return (
        <>
            <PageHeading
                eyebrow="Bring your music"
                title="Connections"
                description="Link your music accounts to import your liked songs."
            />

            <Section title="Music accounts">
                {state === null ? (
                    <PlaceholderRows />
                ) : (
                    <Rows>
                        {(state.providers || []).map((provider) => {
                            const connection = connectionFor(provider.id);
                            const syncing = connection?.sync?.status === "running";
                            const waiting = busy === provider.id;
                            const cooling = cooldownLeft(connection);
                            return (
                                <Row
                                    key={provider.id}
                                    title={<>{PLATFORM_META[provider.id].name}{connection && <Badge>Connected</Badge>}</>}
                                    description={
                                        <>
                                            {describe(provider, connection)}
                                            {connection && <SyncStatus connection={connection} />}
                                        </>
                                    }
                                >
                                    {connection ? (
                                        <>
                                            <Button
                                                icon={syncing ? "spinner" : "sync"}
                                                spin={syncing}
                                                disabled={syncing || waiting || cooling > 0}
                                                onClick={() => sync(provider.id)}
                                            >
                                                <span className="tabular-nums">
                                                    {syncing ? "Syncing…" : cooling > 0 ? `Sync in ${countdown(cooling)}` : "Sync"}
                                                </span>
                                            </Button>
                                            <Button tone="danger" disabled={syncing || waiting} onClick={() => disconnect(provider.id)}>
                                                Disconnect
                                            </Button>
                                        </>
                                    ) : provider.available ? (
                                        <Button tone="accent" icon="link" href={`/api/connect/${provider.id}/start`}>Connect</Button>
                                    ) : (
                                        <Button disabled>Unavailable</Button>
                                    )}
                                </Row>
                            );
                        })}
                    </Rows>
                )}
            </Section>

            <Note>
                Imports keep their original dates and merge into one Liked songs list, newest first.
                {autoSyncHours && ` Connected accounts sync on their own about every ${autoSyncHours} hours, so new likes show up without pressing Sync.`}
            </Note>
        </>
    );
}
