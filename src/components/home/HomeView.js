import { useEffect, useState } from "react";

import { LoadingSwap } from "../motion/index.js";
import { HomeSkeleton } from "../Loader.js";
import { useNifty } from "../../context/NiftyContext.js";
import QuickPicks, { HomeGreeting } from "./sections/QuickPicks.js";
import RecentlyRail from "./sections/RecentlyRail.js";
import LibraryRail from "./sections/LibraryRail.js";
import OnRepeat from "./sections/OnRepeat.js";
import ArtistsRail from "./sections/ArtistsRail.js";
import BecauseYouPlayed from "./sections/BecauseYouPlayed.js";
import NewReleases from "./sections/NewReleases.js";
import Genres from "./sections/Genres.js";
import LikedUnheard from "./sections/LikedUnheard.js";

const EMPTY_HOME = { topArtists: [], onRepeat30: [], onRepeatAll: [], recentHeard: [], recentQueued: [], likedUnheard: [] };
const EMPTY_DISCOVER = { personalized: false, bundles: [], releases: [], songs: [], playlists: [], artists: [], albums: [] };

async function homeResource(url, signal) {
    const request = new AbortController();
    const abort = () => request.abort();
    if (signal.aborted) return null;
    signal.addEventListener("abort", abort, { once: true });
    // A stalled external catalogue must still reveal the user's own music.
    const timeout = setTimeout(abort, 8000);
    try {
        const response = await fetch(url, { cache: "no-store", signal: request.signal });
        return response.ok ? await response.json() : null;
    } catch {
        return null;
    } finally {
        clearTimeout(timeout);
        signal.removeEventListener("abort", abort);
    }
}

// Publish the initial shelves together. Showing one placeholder shelf and then
// inserting several personalized rails displaced everything further down the
// page. The greeting stays put while the completed layout fades in beneath it.
export default function HomeView() {
    const { library } = useNifty();
    const [home, setHome] = useState(null);
    const [discover, setDiscover] = useState(EMPTY_DISCOVER);
    const [genreShelf, setGenreShelf] = useState(null);

    useEffect(() => {
        const controller = new AbortController();
        const { signal } = controller;
        const genreRequest = homeResource("/api/genres?id=132", signal);
        (async () => {
            const payload = { ...EMPTY_HOME, ...(await homeResource("/api/home", signal)) };
            if (signal.aborted) return;

            const seeds = [...new Set([
                ...payload.topArtists.map((artist) => artist.name),
                ...payload.recentHeard.map((track) => track.artist)
            ].filter(Boolean))].slice(0, 10);
            const recommendations = await homeResource(`/api/discover?seeds=${encodeURIComponent(seeds.join(","))}`, signal);
            const genre = await genreRequest;
            if (!signal.aborted) {
                setDiscover({ ...EMPTY_DISCOVER, ...recommendations });
                setGenreShelf(genre || { id: "132", songs: [], albums: [] });
                setHome(payload);
            }
        })();
        // StrictMode's replacement setup must start its own request when the
        // first setup is aborted; a persistent loadedOnce guard breaks this.
        return () => controller.abort();
    }, []);

    return (
        <div className="flex flex-col gap-5 px-4 pb-14 pt-6 sm:px-6 lg:px-8">
            <HomeGreeting />
            <LoadingSwap loading={!home || !library?.loaded} fallback={<HomeSkeleton />} contentClassName="flex min-w-0 flex-col gap-9 sm:gap-10">
                {home && <>
                    <QuickPicks home={home} discover={discover} />
                    <BecauseYouPlayed discover={discover} />
                    <OnRepeat home={home} />
                    <NewReleases discover={discover} />
                    <Genres initialShelf={genreShelf} />
                    <RecentlyRail home={home} />
                    <ArtistsRail home={home} />
                    <LikedUnheard home={home} />
                    <LibraryRail />
                </>}
            </LoadingSwap>
        </div>
    );
}
