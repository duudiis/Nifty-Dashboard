import Head from "next/head";
import { parse } from "cookie";

import { verifySession } from "../lib/jwt.js";
import { NiftyProvider } from "../context/NiftyContext.js";

import TopBar from "../components/layout/TopBar.js";
import LeftSidebar from "../components/layout/LeftSidebar.js";
import CenterContent from "../components/layout/CenterContent.js";
import RightSidebar from "../components/layout/RightSidebar.js";
import Player from "../components/player/Player.js";
import SettingsModal from "../components/SettingsModal.js";
import ConnectionOverlay from "../components/ConnectionOverlay.js";

export async function getServerSideProps({ req }) {
    const cookies = parse(req.headers.cookie || "");
    const user = await verifySession(cookies.session);

    if (!user) {
        return { redirect: { destination: "/login", permanent: false } };
    }

    return { props: { user } };
}

export default function Dashboard({ user }) {
    return (
        <NiftyProvider user={user}>
            <Head>
                <title>Nifty Dashboard</title>
                <meta name="viewport" content="initial-scale=1.0, width=device-width" />
            </Head>

            <div className="flex h-screen flex-col bg-canvas text-maintext">
                <TopBar />

                <div className="flex min-h-0 flex-1 gap-2 p-2">
                    <LeftSidebar />
                    <CenterContent />
                    <RightSidebar />
                </div>

                <Player />

                <SettingsModal />
                <ConnectionOverlay />
            </div>
        </NiftyProvider>
    );
}
