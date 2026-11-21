import test from "node:test";
import assert from "node:assert/strict";

import { nextPlaylistName } from "../src/lib/playlistName.js";

test("the first playlist is #1", () => {
    assert.equal(nextPlaylistName([]), "Playlist #1");
});

test("counts every playlist, named or not", () => {
    assert.equal(nextPlaylistName(["Road trip", "Playlist #1"]), "Playlist #3");
});

test("never reuses a number that is still taken", () => {
    // two playlists left after deleting #1 and #2: the count says #3, which exists
    assert.equal(nextPlaylistName(["Playlist #3", "Playlist #4"]), "Playlist #5");
});

test("ignores look-alikes", () => {
    assert.equal(nextPlaylistName(["Playlist #2 (old)", "playlist #2"]), "Playlist #3");
});
