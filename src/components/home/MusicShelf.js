import Tile from "../browse/Tile.js";
import Rail from "./Rail.js";
import Section from "./Section.js";

// One card pitch for songs, collections and artists across every shelf.
export default function MusicShelf({ items = [], loading = false, ...section }) {
    const playable = items.filter((item) => item?.title && (item.browseId || item.playQuery || item.url));
    if (!loading && !playable.length) return null;
    return (
        <Section {...section} loading={loading}>
            <Rail>
                {playable.map((item) => (
                    <Tile
                        key={item.browseId || item.url || item.playQuery}
                        item={item.kind === "artist" ? { ...item, subtitle: "Artist" } : item}
                    />
                ))}
            </Rail>
        </Section>
    );
}
