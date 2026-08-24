import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { PartyStore } from "../lib/party-store.js";
import { PartyV2RoomStore } from "../lib/party-v2-room-store.js";

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "starlight-party-v2-"));
  let now = 1_800_000_000_000;
  let tokenSequence = 0;
  const partyStore = new PartyStore(root);
  fs.writeFileSync(path.join(root, "minigames", "test-dash.neschallenge"), `${JSON.stringify({
    format: "nes-minigame-v1",
    rom: { sha256: "test", fileHint: "test.nes" },
    presentation: { title: "Test Dash", instructions: "Reach the goal." },
    metadata: { category: "Speed", difficulty: "Easy", playerCount: 1, mode: "Solo", gameName: "Test Game", tags: [] },
  }, null, 2)}\n`);
  const rooms = new PartyV2RoomStore(root, partyStore, {
    now: () => now,
    token: () => `v2-private-${++tokenSequence}`,
    randomInt: (minimum) => minimum,
  });
  return { root, partyStore, rooms, advance: (milliseconds) => { now += milliseconds; } };
}

test("Party V2 persists isolated rooms and keeps queue data safe for public displays", () => {
  const { root, partyStore, rooms } = fixture();
  const created = rooms.create("PLAY");
  const joined = rooms.join("play", { nickname: "Mina", characterId: "nova" });
  const publicRoom = rooms.getPublic("PLAY");

  assert.equal(created.code, "PLAY");
  assert.ok(fs.existsSync(path.join(root, "data", "party-rooms.json")));
  assert.equal(joined.room.self.primary, true);
  assert.equal(JSON.stringify(publicRoom).includes(joined.token), false);
  assert.ok(publicRoom.queue.some((item) => item.command === "patch" && item.kind === "display"));

  const restarted = new PartyV2RoomStore(root, partyStore);
  assert.equal(restarted.getPrivate("PLAY", joined.token).self.nickname, "Mina");
});

test("Party V2 repairs incomplete persisted rooms before rendering", () => {
  const { root, partyStore } = fixture();
  fs.writeFileSync(path.join(root, "data", "party-rooms.json"), JSON.stringify([{
    code: "OLDX",
    status: "playing",
    players: [],
    configuration: null,
    game: null,
    queues: null,
  }]));

  const restarted = new PartyV2RoomStore(root, partyStore);
  const repaired = restarted.getPublic("OLDX");
  assert.equal(repaired.status, "registration");
  assert.equal(repaired.configuration.boardId, null);
  assert.deepEqual(repaired.players, []);
  assert.deepEqual(repaired.queue, []);
});

test("Party Mode migrates queue rooms over the removed Version 1 database", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "starlight-party-migrate-"));
  const partyStore = new PartyStore(root);
  fs.writeFileSync(path.join(root, "data", "party-rooms.json"), JSON.stringify([{ code: "OLDV", status: "lobby", setupStage: "lobby", players: [] }]));
  fs.writeFileSync(path.join(root, "data", "party-v2-rooms.json"), JSON.stringify([{
    code: "KEEP", status: "registration", setupStep: "registration", players: [], configuration: {}, queues: { primary: [], players: {} }, queueSequence: 0,
  }]));

  const migrated = new PartyV2RoomStore(root, partyStore);
  assert.equal(migrated.getPublic("KEEP").code, "KEEP");
  assert.throws(() => migrated.getPublic("OLDV"), /not found/i);
  const saved = JSON.parse(fs.readFileSync(path.join(root, "data", "party-rooms.json"), "utf8"));
  assert.deepEqual(saved.map((room) => room.code), ["KEEP"]);
});

test("Party V2 uses acknowledged generic queues for displays and player input", () => {
  const { rooms } = fixture();
  rooms.create("PLAY");
  const primary = rooms.join("PLAY", { nickname: "Mina", characterId: "nova" });
  const friend = rooms.join("PLAY", { nickname: "Bo", characterId: "sprig" });
  const primaryDisplay = rooms.getPublic("PLAY");
  const queuedIds = primaryDisplay.queue.map((item) => item.id);

  assert.ok(primaryDisplay.queue.every((item) => ["patch", "navigate"].includes(item.command)));
  assert.ok(primary.room.queue.some((item) => item.command === "request-input"));
  assert.ok(friend.room.queue.some((item) => item.command === "navigate"));

  rooms.acknowledgePrimary("PLAY", [queuedIds[0]]);
  assert.equal(rooms.getPublic("PLAY").queue.some((item) => item.id === queuedIds[0]), false);
  assert.ok(rooms.getPublic("PLAY").queue.length > 0);

  const playerQueueIds = rooms.getPrivate("PLAY", primary.token).queue.map((item) => item.id);
  rooms.acknowledgePlayer("PLAY", primary.token, playerQueueIds);
  assert.deepEqual(rooms.getPrivate("PLAY", primary.token).queue, []);
});

test("Party V2 locks registration, queues setup patches, and refreshes every device", () => {
  const { rooms, advance } = fixture();
  rooms.create("PLAY");
  const primary = rooms.join("PLAY", { nickname: "Mina", characterId: "nova" });
  const friend = rooms.join("PLAY", { nickname: "Bo", characterId: "sprig" });
  rooms.acknowledgePrimary("PLAY", rooms.getPublic("PLAY").queue.map((item) => item.id));
  rooms.acknowledgePlayer("PLAY", primary.token, rooms.getPrivate("PLAY", primary.token).queue.map((item) => item.id));
  rooms.acknowledgePlayer("PLAY", friend.token, rooms.getPrivate("PLAY", friend.token).queue.map((item) => item.id));

  rooms.confirmPlayers("PLAY", primary.token);
  assert.throws(() => rooms.join("PLAY", { nickname: "Late", characterId: "luna" }), /locked/i);
  assert.ok(rooms.getPublic("PLAY").queue.some((item) => item.command === "navigate" && item.payload.view === "setup"));
  assert.ok(rooms.getPrivate("PLAY", primary.token).queue.some((item) => item.command === "refresh" && item.payload.view === "setup"));

  const room = rooms.getPrivate("PLAY", primary.token);
  const packId = room.catalog.packs[0].id;
  const rulesetId = room.catalog.rulesets[0].id;
  const boardId = room.catalog.boards[0].id;
  rooms.updateSetup("PLAY", primary.token, { aiPlayers: [{ characterId: "luna" }], setupStep: "rounds" });
  rooms.updateSetup("PLAY", primary.token, { aiPlayers: [], rounds: 5, packId, rulesetId, aiDifficulty: "normal", boardId, setupStep: "review" });
  const patchCommands = rooms.getPublic("PLAY").queue.filter((item) => item.command === "patch");
  assert.ok(patchCommands.some((item) => item.payload.patches.some((patch) => patch.op === "add")));
  assert.ok(patchCommands.some((item) => item.payload.patches.some((patch) => patch.op === "remove")));

  const countdown = rooms.confirmSetup("PLAY", primary.token);
  assert.equal(countdown.status, "countdown");
  advance(5_001);
  const started = rooms.getPublic("PLAY");
  assert.equal(started.status, "playing");
  assert.equal(started.game.players.length, 2);
  assert.ok(started.queue.some((item) => item.command === "refresh" && item.payload.view === "board"));
  assert.ok(rooms.getPrivate("PLAY", primary.token).queue.some((item) => item.command === "refresh" && item.payload.view === "waiting-turn"));
  assert.ok(rooms.getPrivate("PLAY", friend.token).queue.some((item) => item.command === "refresh" && item.payload.view === "waiting-turn"));
});

test("Party V2 hot paths avoid challenge parsing and acknowledgement broadcasts", () => {
  const { rooms, partyStore } = fixture();
  partyStore.catalog = () => { throw new Error("large challenge catalog should not be parsed"); };
  let broadcasts = 0;
  rooms.onUpdate(() => { broadcasts += 1; });

  rooms.create("FAST");
  const primary = rooms.join("FAST", { nickname: "Mina", characterId: "nova" });
  rooms.confirmPlayers("FAST", primary.token);
  const catalog = rooms.getPrivate("FAST", primary.token).catalog;
  rooms.updateSetup("FAST", primary.token, {
    aiPlayers: [],
    rounds: 5,
    packId: catalog.packs[0].id,
    rulesetId: catalog.rulesets[0].id,
    aiDifficulty: "normal",
    boardId: catalog.boards[0].id,
    setupStep: "review",
  });

  const beforeAck = rooms.getPublic("FAST");
  const broadcastsBeforeAck = broadcasts;
  rooms.acknowledgePrimary("FAST", beforeAck.queue.map((item) => item.id));
  assert.equal(broadcasts, broadcastsBeforeAck);
  assert.equal(rooms.getPublic("FAST").version, beforeAck.version);
  assert.strictEqual(rooms.catalog(), rooms.catalog());
});

test("Party V2 Director queues complete turns, a mini-game, results, and the next round", () => {
  const { rooms, advance } = fixture();
  rooms.create("GAME");
  const primary = rooms.join("GAME", { nickname: "Mina", characterId: "nova" });
  const friend = rooms.join("GAME", { nickname: "Bo", characterId: "sprig" });
  rooms.confirmPlayers("GAME", primary.token);
  const catalog = rooms.getPrivate("GAME", primary.token).catalog;
  rooms.updateSetup("GAME", primary.token, { aiPlayers: [], rounds: 5, packId: catalog.packs[0].id, rulesetId: catalog.rulesets[0].id, aiDifficulty: "normal", boardId: catalog.boards[0].id, setupStep: "review" });
  rooms.confirmSetup("GAME", primary.token);
  advance(5_001);
  rooms.getPublic("GAME");

  rooms.getPublic("GAME"); // start turn banner
  advance(1_251);
  let room = rooms.getPrivate("GAME", primary.token);
  assert.equal(room.gameQueue.active[0].type, "request-roll");
  assert.ok(room.queue.some((item) => item.command === "request-input" && item.payload.view === "roll"));
  rooms.roll("GAME", primary.token);

  const finishQueuedTurn = () => {
    rooms.getPublic("GAME");
    advance(1_001); rooms.getPublic("GAME");
    advance(501); rooms.getPublic("GAME");
    advance(701); rooms.getPublic("GAME");
    advance(301); return rooms.getPublic("GAME");
  };
  room = finishQueuedTurn();
  advance(1_251); rooms.getPublic("GAME");
  assert.equal(rooms.getPublic("GAME").gameQueue.active[0].payload.playerId, friend.room.self.id);
  rooms.roll("GAME", friend.token);
  room = finishQueuedTurn();
  assert.equal(room.status, "roulette");
  assert.equal(room.roulette.options.length, 6);

  advance(6_201);
  room = rooms.getPublic("GAME");
  assert.equal(room.status, "minigame");
  rooms.startMinigame("GAME", primary.token);
  rooms.startMinigame("GAME", friend.token);
  rooms.submitResult("GAME", primary.token, { completed: true, score: 10 });
  room = rooms.submitResult("GAME", friend.token, { completed: true, score: 5 });
  assert.equal(room.summary.winnerName, "Mina");
  rooms.getPublic("GAME");
  advance(3_001);
  room = rooms.getPublic("GAME");
  assert.equal(room.game.round, 2);
  assert.equal(room.game.players[0].coins >= 20, true);
});

test("Rainshadow Reach activities resolve through the persistent Director queue", () => {
  const { rooms, advance } = fixture();
  rooms.create("RAIN");
  const primary = rooms.join("RAIN", { nickname: "Mina", characterId: "nova" });
  rooms.confirmPlayers("RAIN", primary.token);
  const catalog = rooms.getPrivate("RAIN", primary.token).catalog;
  rooms.updateSetup("RAIN", primary.token, { aiPlayers: [], rounds: 5, packId: catalog.packs[0].id, rulesetId: catalog.rulesets[0].id, aiDifficulty: "normal", boardId: "rainshadow-reach", setupStep: "review" });
  rooms.confirmSetup("RAIN", primary.token);
  advance(5_001); rooms.getPublic("RAIN");
  rooms.getPublic("RAIN");
  advance(1_251); rooms.getPublic("RAIN");
  rooms.read().find((room) => room.code === "RAIN").game.players[0].position = 1;
  rooms.roll("RAIN", primary.token);
  rooms.getPublic("RAIN");
  advance(901);
  const moving = rooms.getPublic("RAIN");
  assert.ok(moving.queue.some((item) => item.command === "animate" && item.payload.animation === "move-player"));
  assert.equal(moving.queue.some((item) => item.command === "game-event" && item.payload.event === "move-space"), false);
  advance(431); rooms.getPublic("RAIN");
  advance(701);
  const landed = rooms.getPublic("RAIN");

  assert.equal(landed.game.players[0].position, 2);
  assert.equal(landed.game.players[0].coins, 15);
  assert.equal(landed.gameQueue.active[0].type, "board-event");
  assert.equal(landed.gameQueue.active[0].payload.activityId, "ferry-fanfare");
  assert.equal(landed.gameQueue.active[0].source, "board:rainshadow-reach");
});

test("pass-over and proximity event triggers compile between queued movement steps", () => {
  const { rooms, partyStore, advance } = fixture();
  const boards = partyStore.readCollection("boards"), board = boards[0];
  board.events = [
    { id: "trail-chime", name: "Trail Chime", trigger: { kind: "pass" }, commands: [{ id: "coins", kind: "player", op: "coins", amount: 6, label: "GIVE PLAYER 6 COINS", depth: 0 }] },
    { id: "mist-ring", name: "Mist Ring", trigger: { kind: "proximity", radius: 1 }, commands: [] },
  ];
  board.triggers = [
    { id: "chime-1", eventId: "trail-chime", spaceId: 1, x: board.spaces[1].x, y: board.spaces[1].y },
    { id: "mist-2", eventId: "mist-ring", x: board.spaces[2].x, y: board.spaces[2].y, radius: 1 },
  ];
  partyStore.writeCollection("boards", boards);
  rooms.randomInt = (minimum, maximum) => minimum === 1 && maximum === 7 ? 3 : minimum;
  rooms.create("PATH");
  const primary = rooms.join("PATH", { nickname: "Mina", characterId: "nova" });
  rooms.confirmPlayers("PATH", primary.token);
  const catalog = rooms.getPrivate("PATH", primary.token).catalog;
  rooms.updateSetup("PATH", primary.token, { aiPlayers: [], rounds: 5, packId: catalog.packs[0].id, rulesetId: catalog.rulesets[0].id, aiDifficulty: "normal", boardId: board.id, setupStep: "review" });
  rooms.confirmSetup("PATH", primary.token);
  advance(5_001); rooms.getPublic("PATH"); rooms.getPublic("PATH");
  advance(1_251); rooms.getPublic("PATH");
  rooms.roll("PATH", primary.token);
  const queue = rooms.read().find((room) => room.code === "PATH").gameQueue.pending;
  const types = queue.map((item) => `${item.type}:${item.payload.eventId || ""}`);

  assert.ok(types.indexOf("board-event:trail-chime") > types.indexOf("move-space:"));
  assert.ok(types.indexOf("event-effect:") > types.indexOf("board-event:trail-chime"));
  assert.ok(types.includes("board-event:mist-ring"));
  assert.equal(queue.find((item) => item.payload.eventId === "trail-chime").source, "studio-event:trail-chime");
});

test("Party V2 Haunted Harbor demo exposes overlap metadata and an input barrier", () => {
  const { rooms, advance } = fixture();
  rooms.create("DEMO");
  let room = rooms.startDemo("DEMO");
  assert.equal(room.status, "demo");
  assert.ok(room.gameQueue.pending.some((item) => item.startsEarly > 0));
  assert.ok(room.gameQueue.pending.some((item) => item.type === "demo-button-mash" && item.barrier));

  for (let index = 0; index < 30 && room.status === "demo"; index++) {
    advance(1_000);
    room = rooms.getPublic("DEMO");
  }
  assert.equal(room.status, "demo-complete");
  assert.equal(room.game.players[0].coins, 30);
  assert.ok(room.gameQueue.history.some((item) => item.type === "demo-fog-burst" && item.startsEarly === 1_100));
});

test("Party Studio scenes compile into Director queue clips with overlap and rewards", () => {
  const { rooms } = fixture();
  rooms.create("MAKE");
  const room = rooms.room("MAKE");
  room.game = { players: [{ id: "maker", nickname: "Maker", coins: 0 }] };
  room.gameQueue = { sequence: 0, pending: [], active: [], history: [] };
  rooms.studioStore = { get: () => ({ scenes: { entries: [{ id: "toy-scene", name: "Toy Scene", clips: [
    { id: "appear", track: "actor", label: "GHOST APPEARS", start: 0, duration: 2, resources: ["ghost"] },
    { id: "fog", track: "effects", label: "FOG BURST", start: 1, duration: 1, resources: ["effects"] },
    { id: "reward", track: "game", label: "+20 COINS", start: 2, duration: 1, resources: ["ui"] },
  ] }] } }) };

  assert.equal(rooms.queueStudioScene(room, 0), true);
  assert.deepEqual(room.gameQueue.pending.map((item) => item.type), ["scene-clip", "scene-clip", "scene-clip"]);
  assert.equal(room.gameQueue.pending[1].startsEarly, 1_000);
  rooms.completeGameItem(room, room.gameQueue.pending[2]);
  assert.equal(room.game.players[0].coins, 20);
});
