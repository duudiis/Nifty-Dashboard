import { useEffect, useState } from "react";

import { PageHeading, Row, Rows, Section } from "./primitives.js";

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
            <PageHeading eyebrow="Under the hood" title="About" description="What you're running, and how it works." />

            <Section title="This app">
                <Rows>
                    <Row title="Nifty Dashboard" description="A Spotify-style remote for the Nifty Discord music bot.">
                        {build && <span className="text-xs tabular-nums text-subtext">Build {String(build).slice(0, 12)}</span>}
                    </Row>
                </Rows>
            </Section>

            <Section title="How it works">
                <p className="text-xs leading-relaxed text-subtext">
                    The bot is the source of truth: it plays the music and writes every change to a shared database.
                    This dashboard reads that database and sends the bot commands — what you see is what every
                    listener hears.
                </p>
            </Section>
        </>
    );
}
