import { useEffect, useState } from "react";

import { Button, Card, IconTile, PageHeading, Row, Rows, Section } from "./primitives.js";

const REPOS = [
    { title: "Dashboard", path: "duudiis/Nifty-Dashboard" },
    { title: "Bot", path: "duudiis/Nifty" }
];

export default function AboutPage() {
    const [build, setBuild] = useState(null);

    useEffect(() => {
        let stale = false;
        fetch("/api/version")
            .then((r) => r.json())
            .then((j) => !stale && setBuild(j.version || null))
            .catch(() => {});
        return () => { stale = true; };
    }, []);

    return (
        <>
            <PageHeading eyebrow="Under the hood" title="About" description="What you're running, and where it lives." />

            <Card className="mb-7 flex items-center gap-4 p-4">
                <IconTile name="boombox" className="h-14 w-14" iconClassName="h-8 w-8" />
                <div className="min-w-0">
                    <strong className="block text-base font-semibold tracking-tight text-maintext">Nifty Dashboard</strong>
                    <span className="mt-0.5 block text-xs text-subtext">A Spotify-style remote for the Nifty Discord music bot.</span>
                    {build && <span className="mt-1 block text-[11px] tabular-nums text-subtext/70">Build {String(build).slice(0, 12)}</span>}
                </div>
            </Card>

            <Section title="How it works">
                <p className="text-xs leading-relaxed text-subtext">
                    The bot is the source of truth: it plays the music and writes every change to a shared database.
                    This dashboard reads that database and sends the bot commands — what you see is what every
                    listener hears.
                </p>
            </Section>

            <Section title="Source">
                <Rows>
                    {REPOS.map((repo) => (
                        <Row key={repo.path} title={repo.title} description={`github.com/${repo.path}`}>
                            <Button icon="open" href={`https://github.com/${repo.path}`} target="_blank" rel="noopener noreferrer">
                                Open
                            </Button>
                        </Row>
                    ))}
                </Rows>
            </Section>
        </>
    );
}
