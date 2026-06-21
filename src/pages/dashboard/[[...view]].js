import Head from "next/head";
import { parse } from "cookie";

import { verifySession } from "../../lib/jwt.js";
import { NiftyProvider } from "../../context/NiftyContext.js";
import { ContextMenuProvider } from "../../components/menu/ContextMenu.js";

import TopBar from "../../components/layout/TopBar.js";
import LeftSidebar from "../../components/layout/LeftSidebar.js";
import CenterContent from "../../components/layout/CenterContent.js";
import RightSidebar from "../../components/layout/RightSidebar.js";
import Player from "../../components/player/Player.js";
import ConnectionOverlay from "../../components/ConnectionOverlay.js";

// Real, refresh-safe URLs for each page. Everything under /dashboard renders
// this same component; the active view is read from the path by the context.
const VIEWS = ["queue", "search", "lyrics"];

export async function getServerSideProps({ req, params }) {
    const cookies = parse(req.headers.cookie || "");
    const user = await verifySession(cookies.session);

    if (!user) {
        return { redirect: { destination: "/login", permanent: false } };
    }

    // Keep the URL space tidy: anything that isn't a known page bounces home.
    const seg = params?.view?.[0];
    if (params?.view && (params.view.length > 1 || (seg && !VIEWS.includes(seg)))) {
        return { redirect: { destination: "/dashboard", permanent: false } };
    }

    return { props: { user } };
}

export default function Dashboard({ user }) {
    return (
        <NiftyProvider user={user}>
            <ContextMenuProvider>
                <Head>
                    <title>Nifty Dashboard</title>
                    <meta name="viewport" content="initial-scale=1.0, width=device-width" />
                </Head>

                {/* The frame is the navbar colour, so the top bar and the gaps
                    between the floating surface boxes read as one continuous shell. */}
                <div className="flex h-screen flex-col bg-topbar text-maintext">
                    <TopBar />

                    <div className="flex min-h-0 flex-1 flex-col gap-2 p-2 pt-0">
                        <div className="flex min-h-0 flex-1 gap-2">
                            <LeftSidebar />
                            <CenterContent />
                            <RightSidebar />
                        </div>

                        <Player />
                    </div>

                    <ConnectionOverlay />
                </div>
            </ContextMenuProvider>
        </NiftyProvider>
    );
}
