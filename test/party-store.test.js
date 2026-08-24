import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { PartyStore } from "../lib/party-store.js";

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "starlight-party-"));
  fs.mkdirSync(path.join(root, "minigames"), { recursive: true });
  fs.writeFileSync(path.join(root, "minigames", "test-run.neschallenge"), JSON.stringify({
    format: "nes-minigame-v1",
    presentation: { title: "Test Run", instructions: "Reach the finish." },
    metadata: { category: "Speed", playerCount: 1, gameId: "test", gameName: "Test Game" },
    rules: { timeLimitFrames: 600 },
    training: { positives: [{ frames: [[1, 2, 3]] }], negatives: [{ frames: [[4, 5, 6]] }] },
    modifiers: [],
  }));
  return root;
}

test("persists packs and rule sets in the party catalog", () => {
  const root = fixture();
  const store = new PartyStore(root);
  const pack = store.savePack({ name: "Speed Night", challengeIds: ["test-run"] });
  const rules = store.saveRuleset({ name: "Quick Match", rounds: 3, startingCoins: 5 });
  const reloaded = new PartyStore(root).catalog();

  assert.equal(reloaded.challenges[0].category, "Speed");
  assert.equal(reloaded.packs.find((item) => item.id === pack.id).challengeIds[0], "test-run");
  assert.equal(reloaded.rulesets.find((item) => item.id === rules.id).rounds, 3);
});

test("updates and deletes custom packs and rule sets while keeping one fallback", () => {
  const root = fixture();
  const store = new PartyStore(root);
  const pack = store.savePack({ name: "Speed Night", challengeIds: ["test-run"] });
  const rules = store.saveRuleset({ name: "Quick Match", rounds: 3 });

  assert.equal(store.savePack({ id: pack.id, name: "Speed Night Plus", challengeIds: ["test-run"] }).name, "Speed Night Plus");
  assert.equal(store.saveRuleset({ id: rules.id, name: "Quick Match Plus", rounds: 4 }).rounds, 4);
  assert.equal(store.deletePack(pack.id).id, pack.id);
  assert.equal(store.deleteRuleset(rules.id).id, rules.id);
  assert.throws(() => store.deletePack("party-mix"), /at least one party pack/i);
  assert.throws(() => store.deleteRuleset("classic-party"), /at least one rule set/i);
});

test("runs a persisted board turn through a mini-game result", () => {
  const root = fixture();
  const store = new PartyStore(root);
  const session = store.createSession({ playerCount: 2, packId: "party-mix", rulesetId: "classic-party" });
  const firstTurn = store.roll(session.id);
  assert.equal(firstTurn.session.pendingMinigame, null);
  const turn = store.roll(session.id);

  assert.ok(turn.roll >= 1 && turn.roll <= 6);
  assert.equal(turn.session.pendingMinigame.challengeId, "test-run");
  const finished = store.finishMinigame(session.id, { completed: true, winnerIndex: 0 });
  assert.equal(finished.players[0].coins >= 17, true);
  assert.equal(finished.currentPlayerIndex, 0);
  assert.equal(finished.round, 2);
  assert.equal(finished.pendingMinigame, null);
});

test("advances a board turn without awarding coins after a failed mini game", () => {
  const root = fixture();
  const store = new PartyStore(root);
  const session = store.createSession({ playerCount: 2 });
  store.roll(session.id);
  const turn = store.roll(session.id).session;
  const before = turn.players[0].coins;
  const finished = store.finishMinigame(session.id, { completed: false, winnerIndex: 0 });

  assert.equal(finished.players[0].coins, before);
  assert.equal(finished.currentPlayerIndex, 0);
  assert.match(finished.lastEvent, /luck next time/i);
});

test("offers three boards and persists characters, animated movement data, and star purchases", () => {
  const root = fixture();
  const store = new PartyStore(root, { randomInt: (minimum) => minimum });
  const catalog = store.catalog();
  assert.deepEqual(catalog.boards.map((board) => board.id), ["rainshadow-reach", "starlight-circuit", "gearbolt-station"]);
  assert.equal(catalog.boards[0].spaces.filter((space) => space.activity).length, 7);
  assert.equal(catalog.boards[0].spaces[17].activity.id, "salmon-leap");

  const session = store.createSession({ playerCount: 1, characterIds: ["luna"] });
  session.players[0].coins = 25;
  session.players[0].position = 2;
  store.updateSession(session);
  const turn = store.roll(session.id);

  assert.equal(turn.session.players[0].characterId, "luna");
  assert.deepEqual(turn.movement, [3]);
  assert.equal(turn.starChange, 1);
  assert.equal(turn.session.players[0].stars, 1);
  assert.equal(turn.session.starPosition, 8);
  assert.match(turn.session.lastEvent, /bought a Star from BOLT-0/i);
});

test("normalizes unsafe house-rule values and skips broken challenge files", () => {
  const root = fixture();
  fs.writeFileSync(path.join(root, "minigames", "broken.neschallenge"), "not json");
  const store = new PartyStore(root);
  const rules = store.saveRuleset({
    name: "Wild Limits",
    rounds: 999,
    startingCoins: -20,
    minigameEvery: 0,
    redCoins: 50,
  });

  assert.equal(store.challenges().length, 1);
  assert.equal(rules.rounds, 50);
  assert.equal(rules.startingCoins, 0);
  assert.equal(rules.minigameEvery, 1);
  assert.equal(rules.redCoins, 0);
});

test("builds a lightweight cached challenge package for gameplay", () => {
  const root = fixture();
  const store = new PartyStore(root);
  const runtime = store.challengeRuntimePackage("test-run");

  assert.deepEqual(runtime.training, {});
  assert.equal(runtime.presentation.title, "Test Run");
  runtime.presentation.title = "Changed by caller";
  assert.equal(store.challengeRuntimePackage("test-run").presentation.title, "Test Run");
  assert.equal(store.challengePackage("test-run").training.positives.length, 1);
});

test("deletes a mini-game into recoverable server trash and removes pack references", () => {
  const root = fixture();
  const store = new PartyStore(root);
  store.savePack({ name: "Test Pack", challengeIds: ["test-run"] });
  const deleted = store.deleteChallenge("test-run");
  assert.equal(store.challenges().length, 0);
  assert.equal(fs.existsSync(path.join(root, deleted.recoverableFrom)), true);
  assert.deepEqual(store.readCollection("packs").find((pack) => pack.id === "test-pack").challengeIds, []);
});
