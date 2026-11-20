// Shared reconciliation rules for HTTP snapshots, socket updates and controls.
export function progressAt(player, now = Date.now()) {
    if (!player) return 0;
    const anchor = player._anchor;
    const progress = anchor
        ? anchor.progress + (player.playing ? Math.max(0, now - anchor.at) * (player.speed || 1) : 0)
        : player.progress || 0;
    return Math.max(0, Math.min(progress, player.track?.duration || Infinity));
}

export function anchorPlayer(player, now = Date.now()) {
    if (!player?.track) return null;
    const progress = Math.max(0, Math.min(Number(player.progress) || 0, player.track.duration || Infinity));
    return { ...player, progress, _anchor: { progress, at: now } };
}

export function applyPlayerControl(player, action, extra = {}, now = Date.now()) {
    if (!player?.track) return player;
    const progress = action === "seek" ? Number(extra.position) : progressAt(player, now);
    if (!Number.isFinite(progress)) return player;
    return anchorPlayer({
        ...player,
        progress,
        playing: action === "togglePause" ? !player.playing : player.playing
    }, now);
}

export function mergeAutoplay(previous = { enabled: false, tracks: [] }, patch) {
    if (!patch) return previous;
    const enabled = patch.enabled === true || patch.enabled === "enabled" ? true
        : patch.enabled === false || patch.enabled === "disabled" ? false
        : previous.enabled;
    return { enabled, tracks: Array.isArray(patch.tracks) ? patch.tracks : previous.tracks };
}

export function matchesSession(data, selected) {
    if (!selected) return false;
    return (!data?.guildId || String(data.guildId) === String(selected.guildId))
        && (!data?.botId || String(data.botId) === String(selected.botId));
}
