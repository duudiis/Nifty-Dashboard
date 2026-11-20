import { useEffect, useState } from "react";

import { useNifty } from "../../context/NiftyContext.js";
import { useModal } from "../modal/Modal.js";
import { Badge, Button, Note, PageHeading, Row, Rows, Section } from "./primitives.js";

const PLATFORM_META = {
    spotify: { name: "Spotify", blurb: "Import your Spotify liked songs, kept in sync." },
    deezer: { name: "Deezer", blurb: "Import your Deezer favorite tracks." },
    youtube: { name: "YouTube", blurb: "Import your YouTube liked videos." },
    tidal: { name: "Tidal", blurb: "Import your Tidal favorite tracks." }
};

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

function describe(provider, connection) {
    if (!connection) return provider.available ? PLATFORM_META[provider.id].blurb : "Not configured on this server.";
    const synced = connection.lastSyncedAt ? ` · synced ${timeAgo(connection.lastSyncedAt)}` : "";
    return `${connection.externalName || "Account"} · ${connection.likedCount || 0} imported${synced}`;
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
    const [state, setState] = useState(null); // { providers, connections }
    const [busy, setBusy] = useState(null);    // provider id mid-action

    const load = () =>
        fetch("/api/connect")
            .then((r) => r.json())
            .then(setState)
            .catch(() => setState({ providers: [], connections: [] }));

    useEffect(() => { load(); }, []);

    const connectionFor = (id) => state?.connections?.find((c) => c.provider === id);

    const post = async (action, provider) => {
        const res = await fetch("/api/connect", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action, provider })
        });
        const body = await res.json();
        if (!res.ok) throw new Error(body.message);
        return body;
    };

    const sync = async (id) => {
        setBusy(id);
        try {
            const { imported } = await post("sync", id);
            notify(imported > 0 ? `Imported ${imported} new liked song${imported === 1 ? "" : "s"}` : "Already up to date");
            refreshLibrary();
            await load();
        } catch {
            notify("Couldn't sync — try reconnecting");
        } finally {
            setBusy(null);
        }
    };

    const disconnect = async (id) => {
        const name = PLATFORM_META[id].name;
        const count = connectionFor(id)?.likedCount || 0;
        const sure = await modal.confirm({
            title: `Disconnect ${name}?`,
            message: `The ${count > 0 ? count + " " : ""}liked song${count === 1 ? "" : "s"} imported from ${name} will be removed from your Liked songs. Songs you liked here, or that came from another connected account, stay. You can reconnect and re-import any time.`,
            confirmLabel: "Disconnect & remove",
            danger: true
        });
        if (!sure) return;

        setBusy(id);
        try {
            const { removed } = await post("disconnect", id);
            notify(removed > 0
                ? `Disconnected ${name} — removed ${removed} imported song${removed === 1 ? "" : "s"}`
                : `Disconnected ${name}`);
            refreshLibrary();
            await load();
        } catch {
            notify(`Couldn't disconnect ${name}`);
        } finally {
            setBusy(null);
        }
    };

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
                            const working = busy === provider.id;
                            return (
                                <Row
                                    key={provider.id}
                                    title={<>{PLATFORM_META[provider.id].name}{connection && <Badge>Connected</Badge>}</>}
                                    description={describe(provider, connection)}
                                >
                                    {connection ? (
                                        <>
                                            <Button
                                                icon={working ? "spinner" : "sync"}
                                                spin={working}
                                                disabled={working}
                                                onClick={() => sync(provider.id)}
                                            >
                                                {working ? "Syncing…" : "Sync"}
                                            </Button>
                                            <Button tone="danger" disabled={working} onClick={() => disconnect(provider.id)}>
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
            </Note>
        </>
    );
}
