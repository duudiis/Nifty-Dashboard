// Which source powers search + browse. Internal for now — forced to Deezer.
// A SEARCH_SOURCE env var can override it (handy for testing other sources),
// but there is intentionally no user-facing setting yet. To add one later,
// surface this value through settings and pass it per-request to getActiveSource.
export const SEARCH_SOURCE = process.env.SEARCH_SOURCE || "deezer";
