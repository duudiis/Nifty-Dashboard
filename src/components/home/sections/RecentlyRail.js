import { useNifty } from "../../../context/NiftyContext.js";
import MusicShelf from "../MusicShelf.js";

export default function RecentlyRail({ home, loading }) {
    const { setView } = useNifty();
    const items = [...new Map([...(home?.recentHeard || []), ...(home?.recentQueued || [])]
        .map((item) => [item.url || item.playQuery, item])).values()];
    return (
        <MusicShelf
            id="recently"
            title="Jump back in"
            items={items}
            loading={loading}
            actions={<button onClick={() => setView("history")} className="rounded-full px-2 py-1 text-xs font-bold text-subtext transition hover:text-maintext">Listening history</button>}
        />
    );
}
