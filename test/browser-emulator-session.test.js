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

test("resets the time limit for every verification run", () => {
  const session = new BrowserEmulatorSession();
  session.core = new FakeCore();
  session.coreId = "nes";
  session.game = { id: "fake", title: "Fake", fileHint: "fake.nes", sha256: "abc", coreId: "nes" };
  session.startCreator();
  session.creator.selected = { id: "never", operator: "equals", address: 12, value: 99 };
  session.creator.rules.timeLimitFrames = 2;

  session.verify();
  assert.equal(session.runFrame(0).outcome, null);
  assert.deepEqual(session.runFrame(0).outcome, { completed: false, reason: "Time expired" });
  assert.equal(session.creator.mode, "failed");
  session.resetCreatorState();
  assert.equal(session.core.value, 1, "Finishing verification should restore the captured starting state");

  session.verify();
  assert.equal(session.runFrame(0).outcome, null, "A new verify run should receive a fresh time limit");
  assert.deepEqual(session.runFrame(0).outcome, { completed: false, reason: "Time expired" });
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

  session.modifiers[0].entries[1].enabled = false;
  pokes.length = 0;
  session.runFrame(0);
  assert.deepEqual(pokes, [{ addr: 0x9298, val: 0xad }], "Unchecked modifier entries should not be frozen");
});

test("edits, resets, and deletes creator goal and loss rules", () => {
  const session = new BrowserEmulatorSession();
  const candidates = [
    { id: "auto", address: 12, operator: "equals", value: 2, description: "Auto", confidence: 95 },
    { id: "alternate", address: 13, operator: "equals", value: 7, description: "Alternate", confidence: 70 },
  ];
  session.creator = {
    milestones: [{ id: "goal-1", title: "Goal 1", candidates, selectedCandidateIds: ["auto"], autoSelectedCandidateIds: ["auto"], condition: candidates[0], enabled: true }],
    lossGuards: [{ id: "loss-1", title: "Loss 1", candidates, selectedCandidateIds: ["auto"], autoSelectedCandidateIds: ["auto"], condition: candidates[0], enabled: true }],
    rules: { failConditions: [candidates[0]] }, verified: true, positives: [], negatives: [], priorPositiveCount: 0, priorNegativeCount: 0,
  };

  session.renameCreatorRule("goal", "goal-1", "Collect the Key");
  session.updateMilestoneCondition("goal-1", ["auto", "alternate"]);
  assert.equal(session.creator.milestones[0].title, "Collect the Key");
  assert.equal(session.creator.milestones[0].condition.operator, "all");
  session.resetCreatorRule("goal", "goal-1");
  assert.deepEqual(session.creator.milestones[0].selectedCandidateIds, ["auto"]);

  session.renameCreatorRule("loss", "loss-1", "Touch the Lava");
  session.updateLossGuardCondition("loss-1", ["alternate"]);
  assert.equal(session.creator.lossGuards[0].condition.title, "Touch the Lava");
  session.removeLossGuard("loss-1");
  assert.equal(session.creator.lossGuards.length, 0);
});

test("packages score definitions with the mini-game", () => {
  const session = new BrowserEmulatorSession();
  session.coreId = "nes";
  session.game = { id: "fake", title: "Fake", fileHint: "fake.nes", sha256: "abc" };
  session.creator = {
    selected: { id: "goal", operator: "equals", address: 12, value: 2 }, verified: true,
    startState: Uint8Array.of(1), positives: [], negatives: [], priorPositiveCount: 0, priorNegativeCount: 0,
    rules: {}, scoring: [{ id: "score-1", address: 20, formula: "changes", useAsScore: true }],
  };

  const packaged = session.challengePackage({ title: "Score Test", timeLimitFrames: 600 });
  assert.deepEqual(packaged.scoring, [{ id: "score-1", address: 20, formula: "changes", useAsScore: true }]);
});

test("packages grouped score calculators with the mini-game", () => {
  const session = new BrowserEmulatorSession();
  session.coreId = "nes";
  session.game = { id: "fake", title: "Fake", fileHint: "fake.nes", sha256: "abc" };
  const scoring = [{ id: "score-group", name: "Coin Total", entries: [{ id: "coins", address: 20, formula: "increase", useAsScore: true }] }];
  session.creator = {
    selected: { id: "goal", operator: "equals", address: 12, value: 2 }, verified: true,
    startState: Uint8Array.of(1), positives: [], negatives: [], priorPositiveCount: 0, priorNegativeCount: 0,
    rules: {}, scoring,
  };
  assert.deepEqual(session.challengePackage({ title: "Grouped Score", timeLimitFrames: 600 }).scoring, scoring);
});

test("packages named memory exports for the board-game interface", () => {
  const session = new BrowserEmulatorSession();
  session.coreId = "nes";
  session.game = { id: "fake", title: "Fake", fileHint: "fake.nes", sha256: "abc" };
  session.creator = {
    selected: { id: "goal", operator: "equals", address: 12, value: 2 }, verified: true,
    startState: Uint8Array.of(1), positives: [], negatives: [], priorPositiveCount: 0, priorNegativeCount: 0,
    rules: {}, scoring: [], memoryExports: [{ id: "export-coins", name: "coins", address: 0x075e }],
  };

  assert.deepEqual(session.challengePackage({ title: "Export Test", timeLimitFrames: 600 }).memoryExports, [
    { id: "export-coins", name: "coins", address: 0x075e },
  ]);
});
