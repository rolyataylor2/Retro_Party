import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { diffSnapshots, evaluateCandidate } from "./goal-learner.js";
import { detectChallengeFailure } from "./challenge-runtime.js";

const require = createRequire(import.meta.url);
let core, challenge, romFile, start, previous, valid, frames = [], frame = 0, outcome = null;

function snapshot() {
  const memory = core.snapshot();
  return { values: Uint8Array.from(memory.subarray(0, 0x10000)), valid: Uint8Array.from(memory.subarray(0x10000, 0x20000)) };
}
function freezes() {
  for (const item of challenge.modifiers || []) {
    if (item.enabled !== false && item.kind === "freeze") {
      if (Array.isArray(item.entries) && item.entries.length > 0) {
        for (const entry of item.entries) {
          core.poke(Number(entry.address) & 0xffff, Number(entry.value) & 0xff);
        }
      } else if (item.address !== undefined && item.address !== null) {
        core.poke(Number(item.address) & 0xffff, Number(item.value) & 0xff);
      }
    }
  }
}
function reply(id, payload) { process.send?.({ id, ...payload }); }

process.on("message", (message) => {
  try {
    if (message.type === "init") {
      core = require(message.addonPath);
      challenge = message.challenge;
      romFile = path.basename(message.romPath);
      const rom = fs.readFileSync(message.romPath);
      core.load(message.corePath, message.romPath, rom, path.dirname(message.romPath));
      if (!core.loadState(Buffer.from(challenge.startStateBase64, "base64"))) throw new Error("Mini-game state is incompatible with this emulator build");
      freezes();
      const initial = snapshot(); start = initial.values; previous = initial.values; valid = initial.valid;
      reply(message.id, { ready:true });
      return;
    }
    if (message.type === "frame") {
      freezes();
      const packet = core.runFrame(Number(message.input) & 0xffff);
      frame++; freezes();
      const current = snapshot();
      frames.push(diffSnapshots(previous, current.values, current.valid));
      if (frames.length > 1800) frames.shift();
      previous = current.values; valid = current.valid;
      if (!outcome) {
        const failure = detectChallengeFailure({ romFile, values:current.values, start, rules:challenge.rules || {} });
        if (failure) outcome = { completed:false, reason:failure };
        else if (evaluateCandidate(challenge.goal, current.values, start, frames)) outcome = { completed:true, reason:"Goal detected" };
        else if (challenge.rules?.timeLimitFrames && frame >= challenge.rules.timeLimitFrames) outcome = { completed:false, reason:"Time expired" };
      }
      reply(message.id, { packet, outcome, frame });
    }
  } catch (error) { reply(message.id, { error:error.message || String(error) }); }
});

process.on("disconnect", () => { try { core?.unloadGame(); } catch {} process.exit(0); });
