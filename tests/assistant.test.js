import assert from "node:assert/strict";
import http from "node:http";
import test from "node:test";

import { createAssistantHandler } from "../src/assistant/http.js";

const TOKEN = "test-token";
const GUILD = "111111111111111111";
const USER = "676156762457374742";
const BOT_A = "900000000000000001";
const BOT_B = "900000000000000002";

// A stand-in for the hub: connected bots, guild owners, and a routeAction
// that records what it was asked to send (same contract as ws/registry.js).
function fakeHub({ connected = [], owners = {} } = {}) {
    const botsById = new Map(connected.map((botId) => [botId, { botId, botName: `Bot ${botId.slice(-1)}` }]));
    const guildOwners = new Map(Object.entries(owners).map(([guildId, botId]) => [guildId, botsById.get(botId)]));
    const sent = [];
    return {
        botsById,
        guildOwners,
        sent,
        routeAction(botId, guildId, data) {
            sent.push({ botId, guildId, data: JSON.parse(JSON.stringify(data)) });
            return botsById.size > 0;
        }
    };
}

async function serve(options = {}) {
    const registry = options.registry || fakeHub();
    const reads = [];
    const handler = createAssistantHandler({
        token: TOKEN,
        registry,
        getPlayerState: async (botId, guildId) => { reads.push(["player", botId, guildId]); return options.player ?? null; },
        getQueue: async (botId, guildId) => { reads.push(["queue", botId, guildId]); return { position: 0, tracks: [{ track_id: 0 }], autoplay: { enabled: false, tracks: [] } }; },
        listGuildPlayers: options.listGuildPlayers || (async () => []),
        search: options.search || (async (query) => ({ sections: [{ kind: "song", items: [{ title: query }] }], source: "fake" })),
        ...options.deps
    });
    const server = http.createServer(handler);
    await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
    const base = `http://127.0.0.1:${server.address().port}`;
    const call = async (path, { method = "GET", body, token = TOKEN, headers = {} } = {}) => {
        const response = await fetch(base + path, {
            method,
            headers: { ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers },
            body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body)
        });
        return { status: response.status, headers: response.headers, json: await response.json() };
    };
    return { call, registry, reads, close: () => new Promise((resolve) => server.close(resolve)) };
}

const post = (body) => ({ method: "POST", body });

test("without a configured token the whole API is a 404", async () => {
    const app = await serve({ deps: { token: "" } });
    assert.equal((await app.call(`/assistant/state?guildId=${GUILD}`)).status, 404);
    assert.equal((await app.call("/assistant/action", post({}))).status, 404);
    await app.close();
});

test("a missing or wrong token is a 401, and nothing is cached", async () => {
    const app = await serve();
    for (const options of [{ token: null }, { token: "nope" }, { token: TOKEN + "x" }, { token: null, headers: { Authorization: `Basic ${TOKEN}` } }]) {
        const reply = await app.call(`/assistant/state?guildId=${GUILD}`, options);
        assert.equal(reply.status, 401);
        assert.deepEqual(reply.json, { message: "Unauthorized." });
        assert.equal(reply.headers.get("cache-control"), "no-store");
    }
    assert.equal(app.reads.length, 0);
    await app.close();
});

test("unknown paths and wrong methods are refused", async () => {
    const app = await serve();
    assert.equal((await app.call("/assistant/nope")).status, 404);
    assert.equal((await app.call("/assistant/action")).status, 405);
    assert.equal((await app.call(`/assistant/state?guildId=${GUILD}`, post({}))).status, 405);
    await app.close();
});

test("state needs a numeric guild (and a numeric bot, when one is given)", async () => {
    const app = await serve();
    assert.equal((await app.call("/assistant/state")).status, 400);
    assert.equal((await app.call("/assistant/state?guildId=abc")).status, 400);
    assert.equal((await app.call(`/assistant/state?guildId=${GUILD}&botId=x`)).status, 400);
    await app.close();
});

test("state with no bot for the guild is a normal, empty answer", async () => {
    const app = await serve();
    const reply = await app.call(`/assistant/state?guildId=${GUILD}`);
    assert.equal(reply.status, 200);
    assert.deepEqual(reply.json, {
        ok: true, connected: false, botId: null, botName: null, player: null,
        queue: { position: 0, tracks: [], autoplay: { enabled: false, tracks: [] } }
    });
    assert.equal(app.reads.length, 0);
    await app.close();
});

test("state reads the given bot, and says whether it is connected", async () => {
    const app = await serve({ registry: fakeHub({ connected: [BOT_A] }), player: { playing: true } });
    const online = await app.call(`/assistant/state?guildId=${GUILD}&botId=${BOT_A}`);
    assert.deepEqual([online.json.connected, online.json.botId, online.json.botName], [true, BOT_A, "Bot 1"]);
    assert.deepEqual(online.json.player, { playing: true });
    assert.equal(online.json.queue.tracks.length, 1);

    const offline = await app.call(`/assistant/state?guildId=${GUILD}&botId=${BOT_B}`);
    assert.deepEqual([offline.json.connected, offline.json.botId, offline.json.botName], [false, BOT_B, null]);
    assert.deepEqual(app.reads.at(-1), ["queue", BOT_B, GUILD]);
    await app.close();
});

test("state finds the guild's bot: owner, then player rows, then the only bot", async () => {
    const rows = async () => [{ botId: BOT_A, trackLoaded: false }, { botId: BOT_B, trackLoaded: true }];

    // the bot that last reported the guild wins, whatever the database says
    let app = await serve({ registry: fakeHub({ connected: [BOT_A, BOT_B], owners: { [GUILD]: BOT_A } }), listGuildPlayers: rows });
    assert.equal((await app.call(`/assistant/state?guildId=${GUILD}`)).json.botId, BOT_A);
    await app.close();

    // no owner: the player row with a track loaded
    app = await serve({ registry: fakeHub({ connected: [BOT_A, BOT_B] }), listGuildPlayers: rows });
    assert.equal((await app.call(`/assistant/state?guildId=${GUILD}`)).json.botId, BOT_B);
    await app.close();

    // nothing loaded anywhere: prefer the row whose bot is connected
    app = await serve({
        registry: fakeHub({ connected: [BOT_B] }),
        listGuildPlayers: async () => [{ botId: BOT_A, trackLoaded: false }, { botId: BOT_B, trackLoaded: false }]
    });
    assert.equal((await app.call(`/assistant/state?guildId=${GUILD}`)).json.botId, BOT_B);
    await app.close();

    // no rows at all: the only connected bot — but never a guess between two
    app = await serve({ registry: fakeHub({ connected: [BOT_A] }) });
    assert.equal((await app.call(`/assistant/state?guildId=${GUILD}`)).json.botId, BOT_A);
    await app.close();
    app = await serve({ registry: fakeHub({ connected: [BOT_A, BOT_B] }) });
    assert.equal((await app.call(`/assistant/state?guildId=${GUILD}`)).json.botId, null);
    await app.close();
});

test("an action is forwarded like a browser's, attributed to the given user", async () => {
    const app = await serve({ registry: fakeHub({ connected: [BOT_A] }) });
    const reply = await app.call("/assistant/action", post({
        guildId: GUILD, botId: BOT_A, userId: USER, action: "play", query: "Numb Linkin Park", next: true, now: false
    }));
    assert.equal(reply.status, 200);
    assert.deepEqual(reply.json, { ok: true, delivered: true });
    assert.deepEqual(app.registry.sent, [{
        botId: BOT_A,
        guildId: GUILD,
        data: { guildId: GUILD, botId: BOT_A, userId: USER, action: "play", query: "Numb Linkin Park", next: true, now: false }
    }]);
    await app.close();
});

test("an action without a bot is addressed to the guild's bot when it can be found", async () => {
    let app = await serve({
        registry: fakeHub({ connected: [BOT_A, BOT_B] }),
        listGuildPlayers: async () => [{ botId: BOT_B, trackLoaded: true }]
    });
    await app.call("/assistant/action", post({ guildId: GUILD, userId: USER, action: "skip" }));
    assert.equal(app.registry.sent[0].data.botId, BOT_B);
    await app.close();

    // not found (two bots, no trace of the guild): left unaddressed, as for a browser
    app = await serve({ registry: fakeHub({ connected: [BOT_A, BOT_B] }) });
    await app.call("/assistant/action", post({ guildId: GUILD, userId: USER, action: "summon" }));
    assert.equal(app.registry.sent[0].botId, null);
    assert.equal("botId" in app.registry.sent[0].data, false);
    await app.close();

    // a failing lookup must not lose the action
    app = await serve({ registry: fakeHub({ connected: [BOT_A, BOT_B] }), listGuildPlayers: async () => { throw new Error("db down"); } });
    const reply = await app.call("/assistant/action", post({ guildId: GUILD, userId: USER, action: "skip" }));
    assert.deepEqual(reply.json, { ok: true, delivered: true });
    assert.equal(app.registry.sent.length, 1);
    await app.close();
});

test("delivered is false when no bot is connected", async () => {
    const app = await serve();
    const reply = await app.call("/assistant/action", post({ guildId: GUILD, userId: USER, action: "togglePause" }));
    assert.deepEqual(reply.json, { ok: true, delivered: false });
    await app.close();
});

test("a bad action body is a 400 and reaches no bot", async () => {
    const app = await serve({ registry: fakeHub({ connected: [BOT_A] }) });
    const bad = [
        "{not json",
        "[]",
        { userId: USER, action: "skip" },
        { guildId: GUILD, action: "skip" },
        { guildId: GUILD, userId: USER },
        { guildId: GUILD, userId: USER, action: 5 },
        { guildId: "abc", userId: USER, action: "skip" },
        { guildId: 111, userId: USER, action: "skip" },          // ids must be strings
        { guildId: GUILD, userId: USER, botId: "x", action: "skip" }
    ];
    for (const body of bad) {
        assert.equal((await app.call("/assistant/action", post(body))).status, 400, JSON.stringify(body));
    }
    assert.equal(app.registry.sent.length, 0);
    await app.close();
});

test("an oversized action body is refused", async () => {
    const app = await serve({ registry: fakeHub({ connected: [BOT_A] }) });
    const reply = await app.call("/assistant/action", post({ guildId: GUILD, userId: USER, action: "play", query: "x".repeat(20_000) }));
    assert.equal(reply.status, 413);
    assert.equal(app.registry.sent.length, 0);
    await app.close();
});

test("search returns the source's body, needs a query, and reports upstream failure", async () => {
    let app = await serve();
    const reply = await app.call("/assistant/search?query=linkin+park");
    assert.equal(reply.status, 200);
    assert.deepEqual(reply.json, { sections: [{ kind: "song", items: [{ title: "linkin park" }] }], source: "fake" });
    assert.equal((await app.call("/assistant/search?query=%20")).status, 400);
    assert.equal((await app.call("/assistant/search")).status, 400);
    await app.close();

    app = await serve({ search: async () => { throw new Error("upstream"); } });
    assert.equal((await app.call("/assistant/search?query=x")).status, 502);
    await app.close();
});
