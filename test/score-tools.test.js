import assert from "node:assert/strict";
import test from "node:test";

import { ScoreRunTracker, calculateScore, filterMemoryCandidates, newScoreStats, updateScoreStats } from "../public/emulator/score-tools.js";

test("filters memory like an emulator cheat finder", () => {
  const before = Uint8Array.of(5, 5, 5, 5);
  const after = Uint8Array.of(8, 2, 5, 9);
  const valid = Uint8Array.of(1, 1, 1, 0);
  assert.deepEqual(filterMemoryCandidates(before, after, valid, null, "greater"), [0]);
  assert.deepEqual(filterMemoryCandidates(before, after, valid, null, "less"), [1]);
  assert.deepEqual(filterMemoryCandidates(before, after, valid, null, "equal"), [2]);
  assert.deepEqual(filterMemoryCandidates(before, after, valid, null, "changed"), [0, 1]);
});

test("calculates every supported score statistic", () => {
  const stats = newScoreStats(12, 10);
  updateScoreStats(stats, 15, 3);
  updateScoreStats(stats, 7, 8);
  updateScoreStats(stats, 20, 12);
  assert.equal(calculateScore(stats, "final"), 20);
  assert.equal(calculateScore(stats, "increase"), 10);
  assert.equal(calculateScore(stats, "decrease"), -10);
  assert.equal(calculateScore(stats, "highest"), 20);
  assert.equal(calculateScore(stats, "lowest"), 7);
  assert.equal(calculateScore(stats, "largestIncrease"), 13);
  assert.equal(calculateScore(stats, "largestDecrease"), 8);
  assert.equal(calculateScore(stats, "timeToHighest"), 12);
  assert.equal(calculateScore(stats, "timeToLowest"), 8);
  assert.equal(calculateScore(stats, "changes"), 3);
});

test("tracks configured scores through a verification run", () => {
  const tracker = new ScoreRunTracker([{ id: "score-1", address: 1, formula: "highest", useAsScore: true }], Uint8Array.of(0, 4));
  tracker.update(Uint8Array.of(0, 9), 10);
  tracker.update(Uint8Array.of(0, 6), 20);
  assert.equal(tracker.results()[0].score, 9);
  assert.equal(tracker.results()[0].stats.changes, 2);
});

test("unwraps cumulative 8-bit score values at the configured boundaries", () => {
  const increasing = new ScoreRunTracker([
    { id: "laps", address: 1, formula: "increase", cumulative: true, useAsScore: true },
  ], Uint8Array.of(0, 251));
  increasing.update(Uint8Array.of(0, 254), 1);
  increasing.update(Uint8Array.of(0, 2), 2);
  assert.equal(increasing.results()[0].score, 7);
  assert.equal(increasing.results()[0].stats.current, 258);

  const decreasing = new ScoreRunTracker([
    { id: "countdown", address: 1, formula: "decrease", cumulative: true, useAsScore: true },
  ], Uint8Array.of(0, 4));
  decreasing.update(Uint8Array.of(0, 1), 1);
  decreasing.update(Uint8Array.of(0, 252), 2);
  assert.equal(decreasing.results()[0].score, 8);
  assert.equal(decreasing.results()[0].stats.current, -4);
});

test("groups tracked memory formulas into one score calculator", () => {
  const tracker = new ScoreRunTracker([{
    id: "group-1", name: "Treasure Total", entries: [
      { id: "coins", address: 1, formula: "increase", useAsScore: true },
      { id: "stars", address: 2, formula: "final", useAsScore: true },
    ],
  }], Uint8Array.of(0, 4, 1));
  tracker.update(Uint8Array.of(0, 9, 3), 10);
  const result = tracker.results()[0];
  assert.equal(result.name, "Treasure Total");
  assert.equal(result.score, 8);
  assert.deepEqual(result.components.map((component) => component.score), [5, 3]);
});

test("adds a tracked value to a running score estimate", () => {
  const tracker = new ScoreRunTracker([], Uint8Array.of(0, 4));
  tracker.addConfig({ id: "late", address: 1, formula: "increase", useAsScore: true }, 4);
  tracker.update(Uint8Array.of(0, 9), 5);
  assert.equal(tracker.results()[0].score, 5);
});
