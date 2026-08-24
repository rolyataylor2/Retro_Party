import assert from "node:assert/strict";
import test from "node:test";

import { detectChallengeFailure } from "../lib/challenge-runtime.js";

test("rejects SMB death engine states before goal evaluation", () => {
  const values = new Uint8Array(0x10000);
  values[0x000e] = 0x0b;
  values[0x075a] = 4;
  const start = values.slice();
  start[0x000e] = 0x08;

  assert.match(detectChallengeFailure({ romFile: "smb.nes", values, start }), /death state/i);
});

test("rejects a lost SMB life and allows a normal state", () => {
  const start = new Uint8Array(0x10000);
  const values = new Uint8Array(0x10000);
  start[0x075a] = 4;
  values[0x075a] = 3;
  values[0x000e] = 0x08;
  assert.match(detectChallengeFailure({ romFile: "smb.nes", values, start }), /lost a life/i);

  values[0x075a] = 4;
  assert.equal(detectChallengeFailure({ romFile: "smb.nes", values, start }), null);
});

test("supports packaged failure conditions for other games", () => {
  const values = new Uint8Array(0x10000);
  values[0x0042] = 7;
  const failure = detectChallengeFailure({
    romFile: "other.nes",
    values,
    rules: { failConditions: [{ address: 0x42, operator: "equals", value: 7, description: "Player defeated" }] },
  });
  assert.equal(failure, "Player defeated");
});
