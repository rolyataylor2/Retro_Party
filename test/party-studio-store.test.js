import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { PartyStore } from "../lib/party-store.js";
import { PartyStudioStore } from "../lib/party-studio-store.js";

function fixture() {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "starlight-studio-"));
  const partyStore = new PartyStore(root);
  return { root, partyStore, studio: new PartyStudioStore(root, partyStore) };
}

test("Party Studio starts with all six creation station data sets", () => {
  const { studio } = fixture();
  const project = studio.get();
  assert.ok(project.map.spaces.length > 10);
  assert.equal(project.scenes.entries[0].id, "ghost-challenge");
  assert.ok(project.events.entries[0].commands.length >= 4);
  assert.ok(project.rules.pages.flow.cards.length >= 3);
  assert.ok(project.data.spaceTypes.includes("EVENT"));
  assert.ok(project.data.toys.some((toy) => toy.category === "currency" && toy.id === "coins"));
  assert.ok(project.data.toys.some((toy) => toy.category === "dice"));
  assert.ok(project.data.toys.some((toy) => toy.category === "healing"));
});

test("Party Studio persists editable Toy Catalogue gameplay metadata", () => {
  const { studio } = fixture();
  const data = studio.get().data;
  data.toys.push({
    id: "lucky-cookie", name: "LUCKY COOKIE", icon: "🥠", category: "food",
    description: "Restores health and grants luck.", effectType: "heal-status", amount: 15,
    stackLimit: 4, consumable: true, tradable: true, rarity: "rare", image: "data:image/png;base64,dG95",
  });
  const saved = studio.update("data", data);
  const toy = saved.data.toys.find((item) => item.id === "lucky-cookie");
  assert.equal(toy.category, "food");
  assert.equal(toy.effectType, "heal-status");
  assert.equal(toy.stackLimit, 4);
  assert.equal(toy.image, "data:image/png;base64,dG95");
});

test("Party Studio atomically persists and publishes editor changes", () => {
  const { root, partyStore, studio } = fixture();
  const map = studio.get().map;
  map.name = "  Haunted   Harbor  ";
  map.spaces.push({ id: 99, x: 120, y: -10, type: "LUCKY", size: 12, depth: 20, rotation: 900 });
  const saved = studio.update("map", map);
  const added = saved.map.spaces.at(-1);

  assert.equal(saved.map.name, "Haunted Harbor");
  assert.equal(added.x, 100);
  assert.equal(added.y, 0);
  assert.equal(added.size, 5);
  assert.equal(added.type, "lucky");
  saved.map.name = "Changed by caller";

  const restarted = new PartyStudioStore(root, partyStore);
  assert.equal(restarted.get().map.name, "Haunted Harbor");
  assert.equal(partyStore.readCollection("boards")[0].name, "Haunted Harbor");
  assert.equal(partyStore.readCollection("boards")[0].spaces.at(-1).x, 100);
  assert.equal(partyStore.readCollection("boards")[0].spaces[0].shape, "oval");
  assert.ok(Array.isArray(partyStore.readCollection("boards")[0].paths));
  assert.ok(fs.existsSync(path.join(root, "data", "party-studio.json")));
});

test("Party Studio publishes map triggers and complete event decks to gameplay boards", () => {
  const { partyStore, studio } = fixture();
  const map = studio.get().map;
  map.triggers.push({ id: "mist-bell", kind: "trigger", name: "Mist Bell", eventId: "mist-event", x: 40, y: 50, radius: 8 });
  studio.update("map", map);
  const events = studio.get().events;
  events.entries.push({ id: "mist-event", name: "Mist Bell", trigger: { kind: "proximity", radius: 8 }, commands: [{ id: "reward", kind: "player", op: "coins", amount: 5, label: "GIVE PLAYER 5 COINS", depth: 0 }] });
  studio.update("events", events);

  const board = partyStore.readCollection("boards")[0];
  assert.equal(board.triggers.find((trigger) => trigger.id === "mist-bell").eventId, "mist-event");
  assert.equal(board.events.find((event) => event.id === "mist-event").trigger.kind, "proximity");
  assert.equal(board.events.find((event) => event.id === "mist-event").commands[0].amount, 5);
});

test("Party Studio keeps every editor data set isolated to its board", () => {
  const { studio } = fixture();
  const first = studio.get().boardProjects.selectedId;
  const second = studio.get().boardProjects.entries.find((entry) => entry.id !== first).id;
  const data = studio.get().data;
  data.toys.push({ id: "first-board-only", name: "FIRST BOARD ONLY", category: "other" });
  studio.update("data", data);

  const selectedSecond = studio.selectBoard(second);
  assert.equal(selectedSecond.boardProjects.selectedId, second);
  assert.equal(selectedSecond.data.toys.some((toy) => toy.id === "first-board-only"), false);
  selectedSecond.scenes.entries[0].name = "Second Board Scene";
  studio.update("scenes", selectedSecond.scenes);

  const selectedFirst = studio.selectBoard(first);
  assert.equal(selectedFirst.data.toys.some((toy) => toy.id === "first-board-only"), true);
  assert.notEqual(selectedFirst.scenes.entries[0].name, "Second Board Scene");
});

test("Party Studio creates a blank grid board and selects it", () => {
  const { partyStore, studio } = fixture();
  const created = studio.createBoard({ name: "Cloud Garden" });
  assert.equal(created.map.name, "Cloud Garden");
  assert.equal(created.map.image, "");
  assert.deepEqual(created.map.spaces, []);
  assert.equal(created.boardProjects.selectedId, "cloud-garden");
  assert.ok(partyStore.readCollection("boards").some((board) => board.id === "cloud-garden"));
});

test("Party Studio rejects unknown stations, publishes rule cartridges, and resets", () => {
  const { partyStore, studio } = fixture();
  assert.throws(() => studio.update("scripts", {}), /does not exist/i);
  const changed = studio.get().rules;
  changed.activeCartridge = "team";
  studio.update("rules", changed);
  assert.equal(studio.get().rules.activeCartridge, "team");
  assert.equal(partyStore.readCollection("rulesets").find((item) => item.id === "studio-rules").name, "TEAM PARTY");
  assert.equal(studio.reset().rules.activeCartridge, "classic");
});
