// The name a new playlist gets when the user hasn't typed one: "Playlist #N",
// where N is one past the highest number already in use (or the first free
// one after the count, so deleting playlists never produces a duplicate).
export function nextPlaylistName(existingNames = []) {
    const used = new Set();
    for (const name of existingNames) {
        const match = /^Playlist #(\d+)$/.exec(String(name || "").trim());
        if (match) used.add(Number(match[1]));
    }
    let number = existingNames.length + 1;
    while (used.has(number)) number++;
    return `Playlist #${number}`;
}
