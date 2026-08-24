import test from "node:test";
import assert from "node:assert/strict";
import { evaluateCandidate, learnCandidates } from "../lib/goal-learner.js";

function attempt(frames, endOverrides = {}) {
  const start = new Uint8Array(0x10000);
  const end = new Uint8Array(start);
  const valid = new Uint8Array(0x10000).fill(1);
  for (const [address, value] of Object.entries(endOverrides)) end[Number(address)] = value;
  return { frames, start, end, valid };
}

test("learns a common transition and penalizes negative examples", () => {
  const positiveA = attempt([[{ address: 0xcf, before: 1, after: 0 }]], { 0xcf: 0 });
  const positiveB = attempt([[], [{ address: 0xcf, before: 1, after: 0 }]], { 0xcf: 0 });
  const negative = attempt([[{ address: 0x20, before: 4, after: 5 }]], { 0x20: 5 });
  const candidates = learnCandidates([positiveA, positiveB], [negative]);
  assert.equal(candidates[0].operator, "transition");
  assert.equal(candidates[0].address, 0xcf);
  assert.equal(candidates[0].falsePositives, 0);
});

test("evaluates event and state candidates", () => {
  const current = new Uint8Array(0x10000);
  const start = new Uint8Array(0x10000);
  current[0x75a] = 8;
  assert.equal(evaluateCandidate({ operator: "equals", address: 0x75a, value: 8 }, current, start), true);
  assert.equal(evaluateCandidate(
    { operator: "transition", address: 0xcf, from: 1, to: 0, windowFrames: 10 },
    current,
    start,
    [[{ address: 0xcf, before: 1, after: 0 }]],
  ), true);
});

test("learns and evaluates compound / multi-event goal with event ledger", () => {
  // Positive attempts had both event A (Goomba 1: 0x1e: 1->2) AND event B (Goomba 2: 0x1f: 1->2)
  const posA = attempt([
    [{ address: 0x1e, before: 1, after: 2 }],
    [],
    [{ address: 0x1f, before: 1, after: 2 }],
  ], { 0x1e: 2, 0x1f: 2 });

  const posB = attempt([
    [{ address: 0x1e, before: 1, after: 2 }],
    [{ address: 0x1f, before: 1, after: 2 }],
  ], { 0x1e: 2, 0x1f: 2 });

  // Negative attempt only had Event A (killed 1 Goomba)
  const neg = attempt([
    [{ address: 0x1e, before: 1, after: 2 }],
  ], { 0x1e: 2 });

  const candidates = learnCandidates([posA, posB], [neg]);
  // Top candidate should be the compound BOTH rule
  const compound = candidates.find((c) => c.type === "compound");
  assert.ok(compound, "Should find a compound candidate rule");
  assert.equal(compound.falsePositives, 0);
  assert.equal(compound.conditions.length, 2);

  // Single rule for 0x1e alone had 1 false positive
  const single1e = candidates.find((c) => c.address === 0x1e);
  assert.equal(single1e.falsePositives, 1);

  // Compound rule confidence should be higher than single 1e rule
  assert.ok(compound.confidence > single1e.confidence);
});

test("learns loss candidates and builds custom goal from checked conditions", async () => {
  const { buildGoalFromConditions, learnLossCandidates } = await import("../lib/goal-learner.js");
  const pos = attempt([[{ address: 0x1e, before: 1, after: 2 }]], { 0x1e: 2 });
  const neg = attempt([[{ address: 0x0e, before: 1, after: 6 }]], { 0x0e: 6 });

  const lossCandidates = learnLossCandidates([pos], [neg], "smb.nes");
  assert.ok(lossCandidates.length >= 2, "Should discover SMB loss candidates and loss transitions");
  assert.ok(lossCandidates.some((c) => c.address === 0x000e));

  const goal = buildGoalFromConditions([
    { operator: "transition", address: 0x1e, from: 1, to: 2, description: "Goomba 1 killed" },
    { operator: "transition", address: 0x1f, from: 1, to: 2, description: "Goomba 2 killed" },
  ]);
  assert.equal(goal.type, "compound");
  assert.equal(goal.conditions.length, 2);
});

test("extracts milestone candidates and compiles compound milestone goals", async () => {
  const { buildConditionFromSelection, buildMilestoneGoal, extractAllMilestoneCandidates, extractMilestoneCandidate, reinforceMilestoneCandidates } = await import("../lib/goal-learner.js");
  const frames = [
    [{ address: 0x09, before: 10, after: 11 }], // volatile noise
    [{ address: 0x1e, before: 1, after: 2 }, { address: 0x75e, before: 0, after: 100 }], // Goomba stomp + score change
  ];
  const all = extractAllMilestoneCandidates(frames);
  assert.ok(all.length >= 2, "Should find all candidate transitions");
  assert.equal(all[0].address, 0x1e);

  const candidate = extractMilestoneCandidate(frames);
  assert.ok(candidate, "Should extract top milestone candidate");
  assert.equal(candidate.address, 0x1e);

  // Test reinforcement
  const reinforced = reinforceMilestoneCandidates(all, frames);
  assert.equal(reinforced[0].hits, 2);
  assert.ok(reinforced[0].confidence >= all[0].confidence);

  // Test building condition from selection
  const cond = buildConditionFromSelection(all, [all[0].id, all[1].id]);
  assert.equal(cond.type, "compound");
  assert.equal(cond.conditions.length, 2);

  const goal = buildMilestoneGoal([
    { id: "g1", title: "Goal 1", condition: candidate, enabled: true },
    { id: "g2", title: "Goal 2", condition: { operator: "transition", address: 0x1f, from: 1, to: 2, description: "Goomba 2" }, enabled: true },
  ]);
  assert.equal(goal.type, "compound");
  assert.equal(goal.conditions.length, 2);
});




