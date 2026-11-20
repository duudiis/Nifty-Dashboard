import { useNifty } from "../../../context/NiftyContext.js";
import MusicShelf from "../MusicShelf.js";

export default function LibraryRail() {
    const { library } = useNifty();
    return <MusicShelf id="your-library" title="Made part of your collection" items={library?.items} loading={!library?.loaded} />;
}
