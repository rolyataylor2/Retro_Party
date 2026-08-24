import assert from "node:assert/strict";
import test from "node:test";

import { BrowserEmulatorSession } from "../public/emulator/session.js";

class FakeCore {
  constructor() { this.value = 1; this.states = []; }
  snapshot() {
    const bytes = new Uint8Array(0x20000);
    bytes[12] = this.value;
    bytes[0x10000 + 12] = 1;
    return bytes;
  }
  saveState() { return Uint8Array.of(this.value); }
  loadState(bytes) { this.value = bytes[0]; return true; }
  runFrame() { this.value++; return { width: 1, height: 1, sampleRate: 48000, video: new Uint8Array(4), audio: new Int16Array() }; }
  poke(address, value) { if (address === 12) this.value = value; return true; }
  unloadGame() {}
}

test("runs challenge goal detection entirely in a browser session", () => {
  const session = new BrowserEmulatorSession();
  session.core = new FakeCore();
  session.coreId = "nes";
  session.game = { id: "fake", fileHint: "fake.nes", coreId: "nes" };
  session.challenge = { goal: { operator: "equals", address: 12, value: 2 }, rules: {} };
  const initial = session.captureSnapshot();
  session.playback = { start: initial.values, previous: initial.values, frames: [] };

  const frame = session.runFrame(0);

  assert.deepEqual(frame.outcome, { completed: true, reason: "Goal detected" });
  assert.equal(session.frameNumber, 1);
});

test("captures creator training and rewinds attempts locally", () => {
  const session = new BrowserEmulatorSession();
  session.core = new FakeCore();
  session.coreId = "nes";
  session.game = { id: "fake", title: "Fake", fileHint: "fake.nes", sha256: "abc", coreId: "nes" };

  session.startCreator();
  session.beginAttempt();
  session.runFrame(0);
  const summary = session.finishAttempt(true);

  assert.equal(summary.positiveCount, 1);
  assert.equal(session.core.value, 2);
  session.beginAttempt();
  assert.equal(session.core.value, 1);
});

test("applies all pokes for collapsed multi-part modifiers", () => {
  const pokes = [];
  const fakeCore = {
    poke(addr, val) { pokes.push({ addr, val }); return true; },
    snapshot() { return new Uint8Array(0x20000); },
    runFrame() { return { width: 1, height: 1, sampleRate: 48000, video: new Uint8Array(4), audio: new Int16Array() }; },
    unloadGame() {},
  };

  const session = new BrowserEmulatorSession();
  session.core = fakeCore;
  session.coreId = "nes";
  session.game = { id: "fake", fileHint: "fake.nes", coreId: "nes" };

  const modifiers = [
    {
      id: "mod-multi",
      name: "Invincibility",
      kind: "freeze",
      entries: [
        { address: 0x9298, value: 0xad },
        { address: 0x94e9, value: 0xad },
      ],
    },
  ];

  session.setAvailableModifiers(modifiers);
  assert.equal(pokes.length, 0, "No pokes before enabling");

  session.toggleModifier("mod-multi", true);
  assert.equal(pokes.length, 2, "Enabling modifier should immediately poke both entries");
  assert.deepEqual(pokes, [
    { addr: 0x9298, val: 0xad },
    { addr: 0x94e9, val: 0xad },
  ]);

  pokes.length = 0;
  session.runFrame(0);
  assert.equal(pokes.length, 2, "Running frame should maintain freezes for both entries");
  assert.deepEqual(pokes, [
    { addr: 0x9298, val: 0xad },
    { addr: 0x94e9, val: 0xad },
  ]);
});

