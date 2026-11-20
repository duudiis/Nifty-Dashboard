import MusicShelf from "../MusicShelf.js";

export default function OnRepeat({ home, loading }) {
    const items = home?.onRepeat30?.length ? home.onRepeat30 : home?.onRepeatAll || [];
    return <MusicShelf id="on-repeat" title="On repeat" subtitle="The songs you always come back to" items={items} loading={loading} />;
}
