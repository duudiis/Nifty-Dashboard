import { useEffect, useState } from "react";

// Album isn't in the track payload, so resolve it from the server-cached
// /api/songinfo (iTunes). Each unique track is looked up once for everyone.
// If the bot ever sends track.album, that wins and no request is made.
export default function AlbumCell({ track, className = "" }) {
    const [album, setAlbum] = useState(track.album || "");

    useEffect(() => {
        if (track.album) {
            setAlbum(track.album);
            return;
        }
        let stale = false;
        const qs = new URLSearchParams({ title: track.title || "", artist: track.artist || "" });
        fetch(`/api/songinfo?${qs}`)
            .then((r) => r.json())
            .then((j) => {
                if (!stale) setAlbum(j?.itunes?.album || "");
            })
            .catch(() => {});
        return () => {
            stale = true;
        };
    }, [track.title, track.artist, track.album]);

    return (
        <span className={className} title={album || undefined}>
            {album || "—"}
        </span>
    );
}
