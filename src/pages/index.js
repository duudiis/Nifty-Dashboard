import Head from "next/head";
import Link from "next/link";

import Logo from "../components/Logo.js";

export default function Landing() {
    return (
        <>
            <Head>
                <title>Nifty — Music, beautifully controlled</title>
                <meta name="viewport" content="initial-scale=1.0, width=device-width" />
            </Head>

            <div className="relative flex min-h-screen flex-col overflow-hidden bg-canvas text-maintext">

                {/* ambient glow */}
                <div className="pointer-events-none absolute -top-40 left-1/2 h-[480px] w-[480px] -translate-x-1/2 rounded-full bg-accent/20 blur-[120px]" />

                <header className="z-10 flex items-center justify-between px-8 py-6">
                    <div className="flex items-center gap-3">
                        <Logo className="h-9 w-9 text-accent" />
                        <span className="text-xl font-bold tracking-tight">Nifty</span>
                    </div>
                    <Link
                        href="/dashboard"
                        className="rounded-full bg-maintext px-5 py-2 text-sm font-bold text-canvas transition-transform hover:scale-105"
                    >
                        Open dashboard
                    </Link>
                </header>

                <main className="z-10 flex flex-1 flex-col items-center justify-center px-6 text-center">
                    <Logo className="mb-8 h-24 w-24 text-accent animate-pulse" />

                    <h1 className="max-w-3xl text-5xl font-bold leading-tight sm:text-6xl">
                        Your Discord music,
                        <span className="text-accent"> in full color.</span>
                    </h1>

                    <p className="mt-6 max-w-xl text-base text-subtext">
                        A Spotify-style control room for the Nifty music bot. See what&apos;s playing,
                        manage the queue, search, and control every server — live, from anywhere.
                    </p>

                    <div className="mt-10 flex items-center gap-4">
                        <Link
                            href="/dashboard"
                            className="rounded-full bg-accent px-8 py-3 font-bold text-canvas transition-transform hover:scale-105"
                        >
                            Launch
                        </Link>
                        <a
                            href="https://discord.com"
                            target="_blank"
                            rel="noreferrer"
                            className="rounded-full border border-border px-8 py-3 font-bold text-maintext transition-colors hover:bg-elevated"
                        >
                            Add to server
                        </a>
                    </div>
                </main>

                <footer className="z-10 px-8 py-6 text-center text-xs text-subtext">
                    Nifty Dashboard · The bot keeps playing even when this is offline.
                </footer>
            </div>
        </>
    );
}
