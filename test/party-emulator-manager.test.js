import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { GameLibrary } from "../lib/game-library.js";
import { PartyEmulatorManager } from "../lib/party-emulator-manager.js";

const root = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

test("runs an isolated packaged mini-game frame in a phone worker", async (context) => {
  const addonPath = path.join(root, "build/Release/nes_core.node");
  if (!fs.existsSync(addonPath)) return context.skip("native addon has not been built");
  const challengeFile = fs.readdirSync(path.join(root, "minigames")).find((file) => file.endsWith(".neschallenge"));
  if (!challengeFile) return context.skip("no packaged mini-game is available");
  const challenge = JSON.parse(fs.readFileSync(path.join(root, "minigames", challengeFile), "utf8"));
  const library = new GameLibrary(root); library.scan();
  const game = library.gameByHash(challenge.rom.sha256);
  if (!game) return context.skip("the packaged ROM is unavailable");
  const manager = new PartyEmulatorManager(root);
  try {
    await manager.start("TEST", "player-1", { challenge, game:{ ...game, absolutePath:library.absolutePath(game) }, corePath:path.join(root, "fceumm_libretro.dylib"), addonPath });
    const frame = await manager.frame("TEST", "player-1", 0);
    const packet = Buffer.from(frame.packet);
    assert.equal(packet.readUInt32LE(0), 256);
    assert.equal(packet.readUInt32LE(4), 240);
    assert.ok(packet.length > 256 * 240 * 4);
  } finally { manager.stopRoom("TEST"); }
});
