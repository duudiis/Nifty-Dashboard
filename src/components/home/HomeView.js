import { useEffect, useRef, useState } from "react";

import { FadeIn } from "../motion/index.js";

import Hero from "./sections/Hero.js";
import RoomsRail from "./sections/RoomsRail.js";
import PulseStrip from "./sections/PulseStrip.js";
import FirstRun from "./sections/FirstRun.js";
import QuickPicks from "./sections/QuickPicks.js";
import UpNext from "./sections/UpNext.js";
import RecentlyRail from "./sections/RecentlyRail.js";
import LibraryRail from "./sections/LibraryRail.js";
import OnRepeat from "./sections/OnRepeat.js";
import ArtistsRail from "./sections/ArtistsRail.js";
import BecauseYouPlayed from "./sections/BecauseYouPlayed.js";
import NewReleases from "./sections/NewReleases.js";
import Genres from "./sections/Genres.js";
import LikedUnheard from "./sections/LikedUnheard.js";
import TheRoom from "./sections/TheRoom.js";
import TheExchange from "./sections/TheExchange.js";
import YourRhythm from "./sections/YourRhythm.js";
import OnThisDay from "./sections/OnThisDay.js";
import HomeFooter from "./sections/HomeFooter.js";

const EMPTY_HOME = {
    totals: { today_ms: 0, week_ms: 0, prev_week_ms: 0, all_ms: 0, plays: 0, distinct_tracks: 0, sessions: 0 },
    firstSeenAt: null, lastTrack: null, topArtists: [], onRepeat30: [], onRepeatAll: [],
    recentHeard: [], recentQueued: [], likedUnheard: [], likedUnheardTotal: 0, onThisDay: [],
    clock: [], days: [], feed: [], leaders: [], reach: [], brought: []
};

const EMPTY_DISCOVER = { personalized: false, seeds: [], bundles: [], releases: [], songs: [], playlists: [], artists: [], albums: [] };

/**
 * The home screen.
 *
 * Three loading states, never one. The shell's own boot wash (CenterContent's
 * LoadingWash, gated on `ready`) decides whether this mounts at all; then the
 * database half and the recommendation half wash independently, because Deezer
 * is a third party and a slow minute there must not hold up a page built from
 * the user's own history. The library is a fourth, already loaded by the
 * context.
 *
 * No intervals. The page fetches once per mount; everything live on it — the
 * player, the queue, the room list — arrives on the WebSocket deltas the
 * context already applies.
 */
export default function HomeView() {
    const [home, setHome] = useState(EMPTY_HOME);
    const [homeLoaded, setHomeLoaded] = useState(false);
    const [discover, setDiscover] = useState(EMPTY_DISCOVER);
    const [discoverLoaded, setDiscoverLoaded] = useState(false);

    // Strict mode double-invokes effects; the fetch is idempotent but there is
    // no reason to pay for it twice.
    const loadedOnce = useRef(false);
    const [reloadKey, setReloadKey] = useState(0);

    useEffect(() => {
        if (loadedOnce.current && reloadKey === 0) return;
        loadedOnce.current = true;
        let live = true;

        (async () => {
            const tz = Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC";
            let payload = EMPTY_HOME;
            try {
                const res = await fetch(`/api/home?tz=${encodeURIComponent(tz)}`, { cache: "no-store" });
                if (res.ok) payload = { ...EMPTY_HOME, ...(await res.json()) };
            } catch { /* the page still renders from context alone */ }

            if (!live) return;
            setHome(payload);
            setHomeLoaded(true);

            // Chained, not parallel — the seeds come out of the first response.
            // Send a run of candidates, not the top three: the route keeps the
            // first few that match a real catalogue artist, and the very top of
            // a listening history is often an alias nothing can resolve.
            const seeds = payload.topArtists.slice(0, 10).map((a) => a.name).filter(Boolean);
            try {
                const res = await fetch(`/api/discover?seeds=${encodeURIComponent(seeds.join(","))}`, { cache: "no-store" });
                if (res.ok && live) setDiscover({ ...EMPTY_DISCOVER, ...(await res.json()) });
            } catch { /* the discovery rows simply don't appear */ }
            if (live) setDiscoverLoaded(true);
        })();

        return () => { live = false; };
    }, [reloadKey]);

    const refresh = () => { setHomeLoaded(false); setDiscoverLoaded(false); setReloadKey((k) => k + 1); };

    // A handful of plays is not a mirror yet — showing nineteen empty shelves
    // to someone who just arrived is worse than showing them how to start.
    const starting = homeLoaded && home.totals.plays < 10;

    const band = (i, node) => (
        <FadeIn key={i} delay={Math.min(i * 0.04, 0.4)} y={10}>{node}</FadeIn>
    );

    const sections = [
        <Hero home={home} loading={!homeLoaded} />,
        <RoomsRail />,
        <PulseStrip home={home} loading={!homeLoaded} onRefresh={refresh} />
    ];

    if (starting) {
        sections.push(<FirstRun home={home} />);
    } else {
        sections.push(
            <QuickPicks home={home} loading={!homeLoaded} />,
            <UpNext />,
            <RecentlyRail home={home} loading={!homeLoaded} />,
            <LibraryRail />,
            <OnRepeat home={home} loading={!homeLoaded} />,
            <ArtistsRail home={home} loading={!homeLoaded} />,
            <BecauseYouPlayed discover={discover} loading={!discoverLoaded} />,
            <NewReleases discover={discover} loading={!discoverLoaded} />,
            <LikedUnheard home={home} loading={!homeLoaded} />,
            <Genres />,
            <TheRoom home={home} loading={!homeLoaded} />,
            <TheExchange home={home} loading={!homeLoaded} />,
            <YourRhythm home={home} loading={!homeLoaded} />,
            <OnThisDay home={home} loading={!homeLoaded} />
        );
    }

    sections.push(<HomeFooter home={home} loading={!homeLoaded} />);

    return (
        <div className="flex flex-col gap-8 px-6 pb-16 pt-6">
            {sections.map((node, i) => band(i, node))}
        </div>
    );
}
