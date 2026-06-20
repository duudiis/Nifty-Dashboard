import { useEffect, useState } from "react";
import Head from "next/head";
import { parse } from "cookie";

import Logo from "../components/Logo.js";
import { verifySession } from "../lib/jwt.js";
import { buildAuthorizeUrl } from "../lib/discord.js";

export async function getServerSideProps({ req }) {
    const cookies = parse(req.headers.cookie || "");
    const user = await verifySession(cookies.session);

    if (user) {
        return { redirect: { destination: "/dashboard", permanent: false } };
    }

    return { props: { authorizeUrl: buildAuthorizeUrl() } };
}

export default function Login({ authorizeUrl }) {
    const [status, setStatus] = useState("idle"); // idle | authenticating | error
    const [error, setError] = useState(null);

    useEffect(() => {
        const params = new URLSearchParams(window.location.search);
        const code = params.get("code");
        if (!code) return;

        setStatus("authenticating");

        (async () => {
            try {
                const res = await fetch("/api/auth/login", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ code })
                });

                if (res.ok) {
                    window.location.href = "/dashboard";
                    return;
                }

                const json = await res.json().catch(() => ({}));
                setError(json.message || "Authentication failed.");
                setStatus("error");
            } catch {
                setError("Could not reach the server.");
                setStatus("error");
            }
        })();
    }, []);

    return (
        <>
            <Head><title>Sign in · Nifty</title></Head>

            <div className="flex min-h-screen items-center justify-center bg-canvas text-maintext">
                <div className="pointer-events-none absolute -top-40 left-1/2 h-[420px] w-[420px] -translate-x-1/2 rounded-full bg-accent/20 blur-[120px]" />

                <div className="z-10 flex w-full max-w-sm flex-col items-center gap-8 rounded-2xl border border-border bg-surface/60 p-10 backdrop-blur">
                    <Logo className={`h-16 w-16 text-accent ${status === "authenticating" ? "animate-pulse" : ""}`} />

                    {status === "authenticating" ? (
                        <div className="text-center">
                            <p className="text-sm font-bold tracking-wide">SIGNING YOU IN</p>
                            <p className="mt-2 text-xs text-subtext">Hang tight, finishing up with Discord…</p>
                        </div>
                    ) : status === "error" ? (
                        <div className="flex flex-col items-center gap-4 text-center">
                            <p className="text-sm font-bold tracking-wide text-accent">SIGN-IN FAILED</p>
                            <p className="text-xs text-subtext">{error}</p>
                            <a href={authorizeUrl} className="text-xs font-bold underline">Try again</a>
                        </div>
                    ) : (
                        <div className="flex flex-col items-center gap-6 text-center">
                            <div>
                                <h1 className="text-2xl font-bold">Welcome back</h1>
                                <p className="mt-2 text-xs text-subtext">Sign in to control your music.</p>
                            </div>

                            <a
                                href={authorizeUrl}
                                className="flex w-full items-center justify-center gap-3 rounded-full bg-[#5865F2] px-6 py-3 font-bold text-white transition-transform hover:scale-[1.03]"
                            >
                                <svg viewBox="0 0 24 24" className="h-5 w-5 fill-current" aria-hidden>
                                    <path d="M20.317 4.369A19.79 19.79 0 0 0 16.558 3.2a.074.074 0 0 0-.079.037c-.34.6-.718 1.385-.984 2.001a18.27 18.27 0 0 0-5.487 0 12.6 12.6 0 0 0-.998-2.001.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C1.533 7.573.943 10.696 1.233 13.78a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028c.462-.63.874-1.295 1.226-1.994a.076.076 0 0 0-.041-.106 13.1 13.1 0 0 1-1.872-.892.077.077 0 0 1-.008-.128c.126-.094.252-.192.371-.291a.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.061 0a.074.074 0 0 1 .078.009c.12.099.245.198.372.292a.077.077 0 0 1-.006.127 12.3 12.3 0 0 1-1.873.891.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.84 19.84 0 0 0 6.002-3.03.077.077 0 0 0 .032-.056c.5-3.575-.838-6.674-2.413-9.385a.061.061 0 0 0-.031-.028ZM8.02 11.9c-1.182 0-2.157-1.085-2.157-2.419 0-1.333.956-2.418 2.157-2.418 1.21 0 2.176 1.094 2.157 2.418 0 1.334-.956 2.419-2.157 2.419Zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.418 2.157-2.418 1.21 0 2.176 1.094 2.157 2.418 0 1.334-.946 2.419-2.157 2.419Z" />
                                </svg>
                                Continue with Discord
                            </a>
                        </div>
                    )}
                </div>
            </div>
        </>
    );
}
