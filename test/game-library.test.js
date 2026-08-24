import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import { GameLibrary, gameLibraryInternals } from "../lib/game-library.js";

test("normalizes ROM names and infers useful game metadata", () => {
  assert.equal(gameLibraryInternals.cleanTitle("Mega Man (U).nes"), "Mega Man");
  assert.deepEqual(gameLibraryInternals.inferredMetadata("Mega Man").genres, ["Action", "Platforming"]);
  assert.ok(gameLibraryInternals.artworkNames({ relativePath: "Mega Man (U).nes", title: "Mega Man" }).includes("Mega Man (USA)"));
});

test("scans ROMs and catalogs per-game save states", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "starlight-library-"));
  fs.mkdirSync(path.join(root, "roms"));
  fs.writeFileSync(path.join(root, "roms", "Mega Man (U).nes"), Buffer.from("test-rom"));
  const library = new GameLibrary(root);
  const [game] = library.scan();
  assert.equal(game.title, "Mega Man");
  assert.equal(game.series, "Mega Man");
  const saved = library.saveState(game.id, "Before the boss", Buffer.from("state"));
  assert.equal(library.listStates(game.id)[0].title, "Before the boss");
  assert.equal(library.loadState(game.id, saved.id).buffer.toString(), "state");
  library.renameState(game.id, saved.id, "Boss Door");
  assert.equal(library.listStates(game.id)[0].title, "Boss Door");
  library.deleteState(game.id, saved.id);
  assert.equal(library.listStates(game.id).length, 0);
  const packs = library.smartPacks([{ id: "boss", gameId: game.id, gameName: game.title, category: "Action", difficulty: "Hard" }]);
  assert.ok(packs.some((pack) => pack.name === "Hard Mix"));
  assert.ok(packs.some((pack) => pack.name === "Mega Man Collection"));
  assert.ok(packs.some((pack) => pack.name === "Mega Man Series"));
});
