import { useNifty } from "../../../context/NiftyContext.js";
import MusicShelf from "../MusicShelf.js";

export default function LikedUnheard({ home, loading }) {
    const { openEntity } = useNifty();
    return (
        <MusicShelf
            id="liked-unheard"
            title="Saved for a first listen"
            subtitle="Something you liked, ready to play"
            items={home?.likedUnheard}
            loading={loading}
            actions={<button onClick={() => openEntity("playlist", "nifty:playlist:liked")} className="rounded-full px-2 py-1 text-xs font-bold text-subtext transition hover:text-maintext">Liked songs</button>}
        />
    );
}
