import assert from "node:assert/strict";
import test from "node:test";

import { rankSearchResults } from "../src/lib/searchResults.js";

test("an exact artist match is discoverable ahead of loosely matching songs", () => {
    const sections = [
        { kind: "song", items: [{ title: "Daft Punk tribute", artist: "A cover band", url: "song:tribute" }] },
        { kind: "album", items: [{ title: "Discovery", subtitle: "Daft Punk", browseId: "album:discovery" }] },
        { kind: "artist", items: [{ title: "Daft Punk", browseId: "artist:daft-punk" }] }
    ];
    const results = rankSearchResults("Daft Punk", sections);
    assert.equal(results[0].browseId, "artist:daft-punk");
    assert.ok(results.some((item) => item.browseId === "album:discovery"));
    assert.ok(results.some((item) => item.url === "song:tribute"));
});

test("searching by both artist and song brings the matching recording first", () => {
    const sections = [{ kind: "song", items: [
        { title: "Halo", artist: "Another artist", url: "song:other" },
        { title: "Halo", artist: "Beyoncé", url: "song:beyonce-halo" },
        { title: "Crazy in Love", artist: "Beyoncé", url: "song:beyonce-crazy" }
    ] }];
    assert.equal(rankSearchResults("Beyonce Halo", sections)[0].url, "song:beyonce-halo");
});

test("international artist names and unaccented queries remain searchable", () => {
    const sections = [{ kind: "artist", items: [
        { title: "Other artist", browseId: "artist:other" },
        { title: "宇多田", browseId: "artist:utada" },
        { title: "Beyoncé", browseId: "artist:beyonce" }
    ] }];
    assert.equal(rankSearchResults("宇多田", sections)[0].browseId, "artist:utada");
    assert.equal(rankSearchResults("beyonce", sections)[0].browseId, "artist:beyonce");
});

test("a large mixed response retains all distinct results and removes repeated identities", () => {
    const songs = Array.from({ length: 60 }, (_, index) => ({ title: `Love song ${index}`, artist: "Artist", url: `song:${index}` }));
    const sections = [
        { kind: "song", items: songs },
        { kind: "playlist", items: [{ title: "Love songs", browseId: "playlist:love" }] },
        { kind: "song", items: [songs[0], songs[12]] }
    ];
    const results = rankSearchResults("Love", sections);
    assert.equal(results.length, 61);
    assert.equal(results.filter((item) => item.kind === "song").length, 60);
    assert.ok(results.some((item) => item.browseId === "playlist:love"));
});
