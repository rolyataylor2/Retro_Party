import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { pathToFileURL } from "node:url";

const root = path.resolve(import.meta.dirname, "..");
const modulePath = path.join(root, "public", "cores", "nes", "fceumm.js");
const wasmPath = path.join(root, "public", "cores", "nes", "fceumm.wasm");
const romPath = path.join(root, "roms", "smb.nes");

test("boots a real NES frame in the WebAssembly browser core", {
  skip: !fs.existsSync(modulePath) || !fs.existsSync(wasmPath) || !fs.existsSync(romPath),
}, async () => {
  const { default: createCore } = await import(pathToFileURL(modulePath));
  const module = await createCore({ locateFile: (file) => path.join(path.dirname(wasmPath), file) });
  const call = (name, result, argumentsList = []) => module.cwrap(name, result, argumentsList);
  assert.equal(call("web_init", "number")(), 1);

  const rom = fs.readFileSync(romPath);
  const pointer = module._malloc(rom.length);
  module.HEAPU8.set(rom, pointer);
  assert.equal(call("web_load_game", "number", ["string", "number", "number"])("smb.nes", pointer, rom.length), 1);
  module._free(pointer);

  call("web_run_frame", null, ["number"])(0);
  const width = call("web_width", "number")();
  const height = call("web_height", "number")();
  assert.equal(call("web_video_size", "number")(), width * height * 4);
  assert.ok(call("web_audio_frames", "number")() > 0);
  assert.ok(call("web_save_state", "number")() > 0);
  assert.ok(call("web_snapshot", "number")() > 0);
});
