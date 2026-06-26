// Entity ids are namespaced "<source>:<kind>:<nativeId>" so an album / playlist
// / artist link always resolves back through the source that produced it,
// regardless of which source happens to be active when it's opened. Tracks
// don't need this — they carry a direct play URL instead.

export function buildEntityId(source, kind, id) {
    return `${source}:${kind}:${id}`;
}

export function parseEntityId(encoded) {
    const str = String(encoded || "");
    const first = str.indexOf(":");
    const second = str.indexOf(":", first + 1);
    if (first === -1 || second === -1) return null;
    return {
        source: str.slice(0, first),
        kind: str.slice(first + 1, second),
        id: str.slice(second + 1)
    };
}
