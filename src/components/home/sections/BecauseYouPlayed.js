import MusicShelf from "../MusicShelf.js";

const unique = (items) => [...new Map(items.map((item) => [item.browseId || item.url || item.playQuery, item])).values()];

export default function BecauseYouPlayed({ discover, loading }) {
    if (loading) return <MusicShelf id="recommendations" title="Made for your next listen" loading />;
    const bundles = (discover?.bundles || []).filter((bundle) => bundle.seed?.name && (bundle.songs?.length || bundle.artists?.length));
    const personalized = discover?.personalized && bundles.length > 0;
    const artists = unique(personalized ? bundles.flatMap((bundle) => bundle.artists || []) : discover?.artists || []);

    return (
        <div className="flex flex-col gap-9 sm:gap-10">
            {personalized ? bundles.map((bundle) => (
                <MusicShelf
                    key={bundle.seed.browseId || bundle.seed.name}
                    title={`Because you like ${bundle.seed.name}`}
                    subtitle="Familiar favorites and new discoveries"
                    items={unique(bundle.songs)}
                />
            )) : (
                <MusicShelf id="recommendations" title="Popular picks" subtitle="Find your next favorite" items={discover?.songs} />
            )}
            <MusicShelf title={personalized ? "Artists you might like" : "Artists to explore"} items={artists} />
            <MusicShelf title="Playlists to get into" items={discover?.playlists} />
            <MusicShelf title="Albums worth a listen" items={discover?.albums} />
        </div>
    );
}
