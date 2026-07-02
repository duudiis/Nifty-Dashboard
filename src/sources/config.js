// Which source powers search. "auto" (the default) blends Deezer —
// authoritative for music — with YouTube videos and playlists. There is no
// user-facing setting; a SEARCH_SOURCE env var can override it for testing.
export const SEARCH_SOURCE = process.env.SEARCH_SOURCE || "auto";
