import test from "node:test";
import assert from "node:assert/strict";
import { anchorPlayer, applyPlayerControl, progressAt, mergeAutoplay, matchesSession } from "../src/lib/playbackState.js";

const song = { track: { songUrl: "song:1", duration: 180000 }, progress: 10000, playing: true, speed: 1 };

test("pause, seek while paused, then resume uses the sought position", () => {
    const playing = anchorPlayer(song, 1000);
    const paused = applyPlayerControl(playing, "togglePause", {}, 4000);
    assert.equal(paused.progress, 13000);
    const sought = applyPlayerControl(paused, "seek", { position: 90000 }, 5000);
    assert.equal(progressAt(sought, 15000), 90000);
    const resumed = applyPlayerControl(sought, "togglePause", {}, 15000);
    assert.equal(progressAt(resumed, 18000), 93000);
});

test("progress respects playback speed and clamps seeks to track boundaries", () => {
    assert.equal(progressAt(anchorPlayer({ ...song, speed: 1.5 }, 1000), 3000), 13000);
    assert.equal(applyPlayerControl(song, "seek", { position: -20 }, 0).progress, 0);
    assert.equal(applyPlayerControl(song, "seek", { position: 999999 }, 0).progress, 180000);
});

test("partial autoplay updates keep enabled state and explicit off still works", () => {
    const previous = { enabled: true, tracks: [{ auto_id: "1" }] };
    assert.deepEqual(mergeAutoplay(previous, { tracks: [] }), { enabled: true, tracks: [] });
    assert.deepEqual(mergeAutoplay(previous, { enabled: false }), { enabled: false, tracks: previous.tracks });
    assert.equal(mergeAutoplay(previous, { enabled: "disabled" }).enabled, false);
    assert.equal(mergeAutoplay(previous, undefined), previous);
});

test("state from another bot or guild cannot affect the current session", () => {
    const selected = { botId: "100", guildId: "200" };
    assert.equal(matchesSession({ botId: "100", guildId: "200" }, selected), true);
    assert.equal(matchesSession({ botId: "101", guildId: "200" }, selected), false);
    assert.equal(matchesSession({ botId: "100", guildId: "201" }, selected), false);
    assert.equal(matchesSession({}, null), false);
});
