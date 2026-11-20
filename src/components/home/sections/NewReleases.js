import MusicShelf from "../MusicShelf.js";

export default function NewReleases({ discover, loading }) {
    return <MusicShelf id="new-releases" title="Recent releases from your artists" items={discover?.releases} loading={loading} />;
}
