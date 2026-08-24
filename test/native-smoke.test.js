import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { fileURLToPath } from "node:url";

const require = createRequire(import.meta.url);
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");

test("boots SMB through the native instrumented core", { skip: !fs.existsSync(path.join(root, "build/Release/nes_core.node")) }, () => {
  const core = require(path.join(root, "build/Release/nes_core.node"));
  const romPath = path.join(root, "roms/smb.nes");
  const rom = fs.readFileSync(romPath);
  const info = core.load(path.join(root, "fceumm_libretro.dylib"), romPath, rom, path.dirname(romPath));
  assert.equal(info.width, 256);
  assert.equal(info.height, 240);
  assert.ok(info.fps > 59);

  const packet = core.runFrame(0);
  const header = new Uint32Array(packet.buffer, packet.byteOffset, 6);
  assert.deepEqual([...header.slice(0, 3)], [256, 240, 256 * 240 * 4]);
  assert.ok(header[3] > 0, "audio frames should be present");

  const snapshot = core.snapshot();
  assert.equal(snapshot.length, 0x20000);
  assert.equal(typeof core.peek(0x075a), "number");
  assert.equal(core.poke(0x075a, 7), true);
  assert.equal(core.peek(0x075a), 7);

  const state = core.saveState();
  assert.ok(state.length > 1000);
  assert.equal(core.loadState(state), true);

  const switched = core.switchGame(romPath, rom);
  assert.equal(switched.width, 256);
  assert.equal(core.runFrame(0).length > 256 * 240 * 4, true);

  const megaManPath = path.join(root, "roms", "Mega Man (U).nes");
  if (fs.existsSync(megaManPath)) {
    const megaMan = core.switchGame(megaManPath, fs.readFileSync(megaManPath));
    assert.equal(megaMan.width, 256);
    assert.equal(core.runFrame(0).length > 256 * 240 * 4, true);
  }
  assert.equal(core.unloadGame(), undefined);
  assert.equal(core.switchGame(romPath, rom).width, 256);
});
