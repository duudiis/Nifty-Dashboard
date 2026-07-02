// The default search mode. "auto" blends Deezer (authoritative for music)
// with YouTube videos and playlists; "deezer" / "youtube" use one source only.
// The search bar exposes the mode per user and passes it per-request to
// getActiveSource; a SEARCH_SOURCE env var overrides the default.
export const SEARCH_SOURCE = process.env.SEARCH_SOURCE || "auto";
