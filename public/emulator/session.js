import { createCore } from "./core-registry.js";
import { buildConditionFromSelection, buildGoalFromConditions, buildMilestoneGoal, createEventLedger, diffSnapshots, evaluateCandidate, extractAllMilestoneCandidates, extractMilestoneCandidate, learnCandidates, learnLossCandidates, reinforceMilestoneCandidates, updateEventLedger } from "../../lib/goal-learner.js";
import { detectChallengeFailure } from "../../lib/challenge-runtime.js";

const fromBase64 = (value) => Uint8Array.from(atob(value), (character) => character.charCodeAt(0));
const toBase64 = (bytes) => {
  let result = "";
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    result += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(result);
};

const romCache = new Map();

async function getGameBytes(contentUrl, gameTitle) {
  if (romCache.has(contentUrl)) return romCache.get(contentUrl);
  const response = await fetch(contentUrl);
  if (!response.ok) throw new Error(`Could not download ${gameTitle} from the library`);
  const buffer = await response.arrayBuffer();
  romCache.set(contentUrl, buffer);
  return buffer;
}

function randomCode(len = 6) {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let result = "";
  for (let i = 0; i < len; i++) {
    result += chars[Math.floor(Math.random() * chars.length)];
  }
  return result;
}

export class BrowserEmulatorSession {
  constructor() {
    this.core = null;
    this.coreId = null;
    this.game = null;
    this.challenge = null;
    this.frameNumber = 0;
    this.rewindStates = [];
    this.quickState = null;
    this.outcome = null;
    this.creator = null;
    this.modifiers = [];
    this.eventLedger = null;
  }

  async ensureCore(coreId) {
    if (this.core && this.coreId === coreId) return this.core;
    this.core?.unloadGame();
    this.core = await createCore(coreId);
    this.coreId = coreId;
    return this.core;
  }

  async loadGame(game, state = null) {
    const core = await this.ensureCore(game.coreId);
    const bytes = await getGameBytes(game.contentUrl, game.title);
    await core.loadGame(game, bytes);
    if (state && !core.loadState(state)) throw new Error("This starting moment is incompatible with the browser core");
    this.game = game;
    this.challenge = null;
    this.creator = null;
    this.modifiers = [];
    this.frameNumber = 0;
    this.rewindStates = [];
    this.quickState = null;
    this.outcome = null;
    this.eventLedger = null;
  }

  async loadChallenge({ challenge, game }, editing = false) {
    await this.loadGame(game, fromBase64(challenge.startStateBase64));
    this.challenge = challenge;
    this.modifiers = (challenge.modifiers || []).map((item) => ({ ...item, enabled: item.enabled !== false }));
    this.applyFreezes();
    if (editing) this.restoreCreator(challenge);
    else {
      const snapshot = this.captureSnapshot();
      this.playback = { start: snapshot.values, previous: snapshot.values, frames: [] };
      this.eventLedger = createEventLedger(challenge.goal);
    }
  }

  unload() {
    this.core?.unloadGame();
    this.game = null;
    this.challenge = null;
    this.creator = null;
    this.outcome = null;
    this.eventLedger = null;
  }

  captureSnapshot() {
    const snapshot = this.core.snapshot();
    return { values: snapshot.slice(0, 0x10000), valid: snapshot.slice(0x10000) };
  }

  applyFreezes() {
    if (!this.modifiers || !this.modifiers.length) return;
    for (const item of this.modifiers) {
      if (item.enabled === true && item.kind === "freeze") {
        if (Array.isArray(item.entries) && item.entries.length > 0) {
          for (const entry of item.entries) {
            this.core.poke(Number(entry.address) & 0xffff, Number(entry.value) & 0xff);
          }
        } else if (item.address !== undefined && item.address !== null) {
          this.core.poke(Number(item.address) & 0xffff, Number(item.value) & 0xff);
        }
      }
    }
  }

  setAvailableModifiers(list = []) {
    const enabledMap = new Map((this.modifiers || []).map((m) => [m.id, m.enabled]));
    this.modifiers = list.map((item) => ({
      ...item,
      enabled: enabledMap.has(item.id) ? Boolean(enabledMap.get(item.id)) : (item.enabled === true),
    }));
    if (this.creator) {
      this.creator.modifiers = this.modifiers;
    }
    this.applyFreezes();
    return this.modifiers;
  }

  toggleModifier(modId, enabled) {
    const mod = (this.modifiers || []).find((m) => m.id === modId);
    if (mod) {
      mod.enabled = Boolean(enabled);
      this.applyFreezes();
      if (this.creator) {
        this.creator.modifiers = this.modifiers;
      }
    }
    return this.modifiers;
  }

  runFrame(inputMask = 0) {
    if (!this.core) throw new Error("No active emulator core");
    this.frameNumber++;
    this.applyFreezes();
    const output = this.core.runFrame(inputMask);
    if (this.game && !this.challenge && !this.creator && this.frameNumber % 30 === 0) {
      this.rewindStates.push(this.core.saveState());
      if (this.rewindStates.length > 30) this.rewindStates.shift();
    }
    this.recordFrame();
    return { ...output, outcome: this.outcome, ledger: this.eventLedger };
  }

  recordFrame() {
    const tracker = this.creator?.attempt || this.playback;
    if (!tracker || this.outcome) return;
    const snapshot = this.captureSnapshot();
    const diffs = diffSnapshots(tracker.previous, snapshot.values, snapshot.valid);
    
    // Rolling ring buffer (max 240 frames = 4 seconds)
    tracker.frames.push(diffs);
    if (tracker.frames.length > 240) tracker.frames.shift();
    
    tracker.frameCount = (tracker.frameCount || 0) + 1;
    if (tracker.transitions && diffs.length > 0) {
      for (const event of diffs) {
        const key = `${event.address}:${event.before}:${event.after}`;
        tracker.transitions.set(key, {
          ...event,
          frameIndex: tracker.frameCount,
          distance: 0,
        });
        tracker.changeCounts.set(event.address, (tracker.changeCounts.get(event.address) || 0) + 1);
      }
    }

    tracker.previous = snapshot.values;
    tracker.end = snapshot.values;
    tracker.valid = snapshot.valid;
    const selected = this.creator?.selected || this.challenge?.goal;
    const rules = this.creator?.rules || this.challenge?.rules || {};
    if (!selected || (this.creator && !["verification", "playing"].includes(this.creator.mode))) return;
    
    if (!this.eventLedger) this.eventLedger = createEventLedger(selected);
    updateEventLedger(this.eventLedger, snapshot.values, tracker.start, tracker.frames);

    const failure = detectChallengeFailure({ romFile: this.game.fileHint, values: snapshot.values, start: tracker.start, rules });
    if (failure) {
      this.outcome = { completed: false, reason: failure };
      if (this.creator) { this.creator.mode = "failed"; this.creator.failureDetected = true; this.creator.failureReason = failure; }
    } else if (evaluateCandidate(selected, snapshot.values, tracker.start, tracker.frames, this.eventLedger)) {
      this.outcome = { completed: true, reason: "Goal detected" };
      if (this.creator) { this.creator.mode = "detected"; this.creator.goalDetected = true; }
    } else if (rules.timeLimitFrames && this.frameNumber >= rules.timeLimitFrames) {
      this.outcome = { completed: false, reason: "Time expired" };
    }
  }

  saveQuickState() { this.quickState = this.core.saveState(); return this.quickState; }
  loadQuickState() { if (!this.quickState || !this.core.loadState(this.quickState)) throw new Error("No quick state is available"); }
  rewind(steps = 6) {
    if (this.rewindStates.length < 2) throw new Error("Play a little longer before rewinding");
    const index = Math.max(0, this.rewindStates.length - Math.max(1, Math.min(60, steps)));
    if (!this.core.loadState(this.rewindStates[index])) throw new Error("Could not restore rewind state");
    this.rewindStates.length = index;
  }

  startCreator() {
    const snapshot = this.captureSnapshot();
    const editing = this.creator?.editingId ? this.creator : {};
    const defaultLossGuards = [];
    if (this.game.fileHint?.toLowerCase().includes("smb")) {
      const deathCond = { id: "loss-smb-death", operator: "equals-any", address: 0x000E, values: [0x06, 0x0B], description: "Mario entered death state ($000E == 6/11)", confidence: 99, hits: 1 };
      const lifeCond = { id: "loss-smb-life", operator: "decreased", address: 0x075A, description: "Mario lost a life ($075A decreased)", confidence: 99, hits: 1 };
      defaultLossGuards.push(
        { id: "loss-smb-death", title: "Loss Mario Dies", candidates: [deathCond], selectedCandidateIds: [deathCond.id], autoSelectedCandidateIds: [deathCond.id], condition: deathCond, enabled: true, hits: 1 },
        { id: "loss-smb-life", title: "Loss Lost Life", candidates: [lifeCond], selectedCandidateIds: [lifeCond.id], autoSelectedCandidateIds: [lifeCond.id], condition: lifeCond, enabled: true, hits: 1 }
      );
    }

    this.creator = {
      editingId: editing.editingId || null, original: editing.original || null,
      presentation: editing.presentation || null, metadata: editing.metadata || null, rules: editing.rules || {},
      kind: "creator", gameId: this.game.id, romFile: this.game.fileHint, mode: "ready",
      startState: this.core.saveState(), start: snapshot.values, valid: snapshot.valid,
      positives: [], negatives: [], priorPositiveCount: editing.priorPositiveCount || 0,
      priorNegativeCount: editing.priorNegativeCount || 0, candidates: [], lossCandidates: [],
      milestones: editing.milestones || [], lossGuards: editing.lossGuards || defaultLossGuards,
      selectedConditionIds: [], selectedLossIds: [], selected: null,
      attempt: null, goalDetected: false, verified: false,
    };
    if (this.creator.lossGuards.length > 0) {
      this.creator.rules.failConditions = this.creator.lossGuards.filter((g) => g.enabled).map((g) => g.condition);
    }
    return this.creatorSummary();
  }

  restoreCreator(challenge) {
    const snapshot = this.captureSnapshot();
    const decode = (items = []) => items.map((attempt) => ({ start: snapshot.values, end: fromBase64(attempt.endBase64), valid: snapshot.valid, frames: attempt.frames || [] }));
    const selected = { ...challenge.goal, id: challenge.goal.id || "saved-goal" };
    const milestones = selected.conditions
      ? selected.conditions.map((c, i) => {
          const code = c.title?.startsWith("Goal ") ? c.title.replace("Goal ", "") : randomCode(6);
          return { id: c.id || `goal-${code.toLowerCase()}`, title: c.title || `Goal ${code}`, candidates: [c], selectedCandidateIds: [c.id || `cond-${i + 1}`], autoSelectedCandidateIds: [c.id || `cond-${i + 1}`], condition: c, enabled: true, hits: 1 };
        })
      : (() => {
          const code = selected.title?.startsWith("Goal ") ? selected.title.replace("Goal ", "") : randomCode(6);
          return [{ id: selected.id || `goal-${code.toLowerCase()}`, title: selected.title || `Goal ${code}`, candidates: [selected], selectedCandidateIds: [selected.id], autoSelectedCandidateIds: [selected.id], condition: selected, enabled: true, hits: 1 }];
        })();

    this.creator = {
      editingId: challenge.id, original: challenge, presentation: challenge.presentation || {}, metadata: challenge.metadata || {}, rules: challenge.rules || {},
      kind: "creator", gameId: this.game.id, romFile: this.game.fileHint, mode: "review", startState: this.core.saveState(), start: snapshot.values,
      valid: snapshot.valid, positives: decode(challenge.training?.positives), negatives: decode(challenge.training?.negatives),
      priorPositiveCount: Number(challenge.training?.priorPositiveCount) || 0, priorNegativeCount: Number(challenge.training?.priorNegativeCount) || 0,
      candidates: [selected], lossCandidates: [], milestones, lossGuards: (challenge.rules?.failConditions || []).map((c, i) => ({ id: `loss-${i + 1}`, title: c.title || `Loss ${randomCode(6)}`, candidates: [c], selectedCandidateIds: [c.id || `loss-${i + 1}`], autoSelectedCandidateIds: [c.id || `loss-${i + 1}`], condition: c, enabled: true, hits: 1 })),
      selectedConditionIds: [selected.id], selectedLossIds: [], selected, attempt: null, goalDetected: false, verified: true,
    };
    return this.creatorSummary();
  }

  beginAttempt(mode = "recording") {
    if (!this.creator) throw new Error("Create Mini-Game mode has not started");
    this.core.loadState(this.creator.startState);
    this.applyFreezes();
    const snapshot = this.captureSnapshot();
    this.eventLedger = mode === "verification" && this.creator.selected ? createEventLedger(this.creator.selected) : null;
    Object.assign(this.creator, {
      mode, goalDetected: false, failureDetected: false, failureReason: null,
      attempt: {
        frames: [],
        transitions: new Map(),
        changeCounts: new Map(),
        frameCount: 0,
        start: snapshot.values,
        end: snapshot.values,
        valid: snapshot.valid,
        previous: snapshot.values,
      },
    });
    this.outcome = null;
    return this.creatorSummary();
  }

  tagMilestone() {
    return this.tagNewGoal();
  }

  tagNewGoal() {
    const creator = this.creator;
    if (!creator?.attempt) throw new Error("Start a demonstration first");
    const snapshot = this.captureSnapshot();
    const candidates = extractAllMilestoneCandidates(creator.attempt.frames, snapshot.values, creator.start);
    if (!candidates.length) return { error: "No distinct memory changes detected in recent moments" };

    const top = candidates[0];
    const code = randomCode(6);
    const id = `goal-${code.toLowerCase()}`;
    const milestone = {
      id,
      title: `Goal ${code}`,
      candidates,
      selectedCandidateIds: top ? [top.id] : [],
      autoSelectedCandidateIds: top ? [top.id] : [],
      condition: top,
      enabled: true,
      hits: 1,
    };
    creator.milestones.push(milestone);
    creator.selected = buildMilestoneGoal(creator.milestones);
    this.eventLedger = createEventLedger(creator.selected);
    return { milestone, summary: this.creatorSummary() };
  }

  tagNewLoss() {
    const creator = this.creator;
    if (!creator?.attempt) throw new Error("Start a demonstration first");
    const snapshot = this.captureSnapshot();
    const candidates = extractAllMilestoneCandidates(creator.attempt.frames, snapshot.values, creator.start);
    if (!candidates.length) return { error: "No distinct memory changes detected in recent moments" };

    const top = candidates[0];
    const code = randomCode(6);
    const id = `loss-${code.toLowerCase()}`;
    const guard = {
      id,
      title: `Loss ${code}`,
      candidates,
      selectedCandidateIds: top ? [top.id] : [],
      autoSelectedCandidateIds: top ? [top.id] : [],
      condition: top ? { ...top, title: `Loss ${code}` } : null,
      enabled: true,
      hits: 1,
    };
    creator.lossGuards.push(guard);
    creator.rules.failConditions = creator.lossGuards.filter((g) => g.enabled).map((g) => g.condition).filter(Boolean);
    return { guard, summary: this.creatorSummary() };
  }

  reinforceGoal(id) {
    const creator = this.creator;
    if (!creator?.attempt) throw new Error("Start a demonstration first");
    const m = creator.milestones.find((item) => item.id === id);
    if (!m) return { error: "Goal not found" };

    const snapshot = this.captureSnapshot();
    m.candidates = reinforceMilestoneCandidates(m.candidates, creator.attempt.frames, snapshot.values, creator.start);
    m.hits = (m.hits || 1) + 1;
    if (!m.selectedCandidateIds || m.selectedCandidateIds.length <= 1) {
      const top = m.candidates[0];
      m.selectedCandidateIds = top ? [top.id] : [];
    }
    m.condition = buildConditionFromSelection(m.candidates, m.selectedCandidateIds);
    creator.selected = buildMilestoneGoal(creator.milestones);
    this.eventLedger = createEventLedger(creator.selected);
    return { milestone: m, summary: this.creatorSummary() };
  }

  reinforceLoss(id) {
    const creator = this.creator;
    if (!creator?.attempt) throw new Error("Start a demonstration first");
    const g = creator.lossGuards.find((item) => item.id === id);
    if (!g) return { error: "Loss condition not found" };

    const snapshot = this.captureSnapshot();
    g.candidates = reinforceMilestoneCandidates(g.candidates, creator.attempt.frames, snapshot.values, creator.start);
    g.hits = (g.hits || 1) + 1;
    if (!g.selectedCandidateIds || g.selectedCandidateIds.length <= 1) {
      const top = g.candidates[0];
      g.selectedCandidateIds = top ? [top.id] : [];
    }
    const condition = buildConditionFromSelection(g.candidates, g.selectedCandidateIds);
    g.condition = condition ? { ...condition, title: g.title } : null;
    creator.rules.failConditions = creator.lossGuards.filter((item) => item.enabled).map((item) => item.condition).filter(Boolean);
    return { guard: g, summary: this.creatorSummary() };
  }

  updateMilestoneCondition(milestoneId, selectedCandidateIds = []) {
    const creator = this.creator;
    if (!creator) return null;
    const m = creator.milestones.find((item) => item.id === milestoneId);
    if (m) {
      m.selectedCandidateIds = selectedCandidateIds;
      m.condition = buildConditionFromSelection(m.candidates, selectedCandidateIds);
      creator.selected = buildMilestoneGoal(creator.milestones);
      this.eventLedger = createEventLedger(creator.selected);
      creator.verified = false;
    }
    return this.creatorSummary();
  }

  updateLossGuardCondition(lossId, selectedCandidateIds = []) {
    const creator = this.creator;
    if (!creator) return null;
    const g = creator.lossGuards.find((item) => item.id === lossId);
    if (g) {
      g.selectedCandidateIds = selectedCandidateIds;
      const condition = buildConditionFromSelection(g.candidates, selectedCandidateIds);
      g.condition = condition ? { ...condition, title: g.title } : null;
      creator.rules.failConditions = creator.lossGuards.filter((item) => item.enabled).map((item) => item.condition);
      creator.verified = false;
    }
    return this.creatorSummary();
  }

  renameCreatorRule(type, id, title) {
    const creator = this.creator;
    if (!creator) return null;
    const list = type === "loss" ? creator.lossGuards : creator.milestones;
    const rule = list.find((item) => item.id === id);
    if (!rule) return this.creatorSummary();
    rule.title = String(title || "").trim().slice(0, 80) || (type === "loss" ? "Loss Guard" : "Goal");
    if (type === "loss") {
      if (rule.condition) rule.condition = { ...rule.condition, title: rule.title };
      creator.rules.failConditions = creator.lossGuards.filter((item) => item.enabled && item.condition).map((item) => item.condition);
    } else {
      creator.selected = buildMilestoneGoal(creator.milestones);
      this.eventLedger = createEventLedger(creator.selected);
    }
    creator.verified = false;
    return this.creatorSummary();
  }

  resetCreatorRule(type, id) {
    const creator = this.creator;
    if (!creator) return null;
    const list = type === "loss" ? creator.lossGuards : creator.milestones;
    const rule = list.find((item) => item.id === id);
    if (!rule) return this.creatorSummary();
    const selected = rule.autoSelectedCandidateIds?.length ? rule.autoSelectedCandidateIds : (rule.candidates[0]?.id ? [rule.candidates[0].id] : []);
    return type === "loss" ? this.updateLossGuardCondition(id, selected) : this.updateMilestoneCondition(id, selected);
  }

  finishGameWon() {
    const creator = this.creator;
    if (!creator?.attempt) throw new Error("No demonstration is currently recording");
    const snapshot = this.captureSnapshot();
    if (creator.milestones.length === 0) {
      this.tagNewGoal();
    }
    creator.selected = buildMilestoneGoal(creator.milestones);
    creator.positives.push({ start: creator.start, end: snapshot.values, valid: snapshot.valid, frames: [] });
    creator.attempt = null;
    creator.mode = "review";
    creator.verified = false;
    this.eventLedger = null;
    this.outcome = null;
    return this.creatorSummary();
  }

  finishGameLost() {
    const creator = this.creator;
    if (!creator?.attempt) throw new Error("No demonstration is currently recording");
    const snapshot = this.captureSnapshot();
    this.tagNewLoss();
    creator.negatives.push({ start: creator.start, end: snapshot.values, valid: snapshot.valid, frames: [] });
    creator.attempt = null;
    creator.mode = "review";
    creator.verified = false;
    this.eventLedger = null;
    this.outcome = null;
    return this.creatorSummary();
  }

  toggleMilestone(id, enabled) {
    const creator = this.creator;
    if (!creator) return null;
    const m = creator.milestones.find((item) => item.id === id);
    if (m) m.enabled = enabled;
    creator.selected = buildMilestoneGoal(creator.milestones);
    this.eventLedger = createEventLedger(creator.selected);
    creator.verified = false;
    return this.creatorSummary();
  }

  removeMilestone(id) {
    const creator = this.creator;
    if (!creator) return null;
    creator.milestones = creator.milestones.filter((m) => m.id !== id);
    creator.selected = buildMilestoneGoal(creator.milestones);
    this.eventLedger = createEventLedger(creator.selected);
    creator.verified = false;
    return this.creatorSummary();
  }

  toggleLossGuard(id, enabled) {
    const creator = this.creator;
    if (!creator) return null;
    const g = creator.lossGuards.find((item) => item.id === id);
    if (g) g.enabled = enabled;
    creator.rules.failConditions = creator.lossGuards.filter((item) => item.enabled).map((item) => item.condition);
    creator.verified = false;
    return this.creatorSummary();
  }

  removeLossGuard(id) {
    const creator = this.creator;
    if (!creator) return null;
    creator.lossGuards = creator.lossGuards.filter((g) => g.id !== id);
    creator.rules.failConditions = creator.lossGuards.filter((item) => item.enabled).map((item) => item.condition);
    creator.verified = false;
    return this.creatorSummary();
  }

  finishAttempt(success) {
    return success ? this.finishGameWon() : this.finishGameLost();
  }

  selectCandidate(id) {
    return this.creatorSummary();
  }

  verify() { if (!this.creator?.selected) throw new Error("Add at least one Goal milestone first"); return this.beginAttempt("verification"); }
  acceptVerification() { this.creator.verified = true; this.creator.mode = "verified"; this.outcome = null; return this.creatorSummary(); }

  creatorSummary() {
    const creator = this.creator;
    if (!creator) return null;
    return {
      ...creator,
      startState: undefined, start: undefined, valid: undefined, positives: undefined, negatives: undefined, attempt: undefined, original: undefined,
      positiveCount: creator.positives.length + creator.priorPositiveCount,
      negativeCount: creator.negatives.length + creator.priorNegativeCount,
      recordedPositiveCount: creator.positives.length, recordedNegativeCount: creator.negatives.length,
      recordingFrames: creator.attempt?.frameCount || creator.attempt?.frames?.length || 0,
      milestones: (creator.milestones || []).map((m) => ({ ...m })),
      lossGuards: (creator.lossGuards || []).map((g) => ({ ...g })),
      failureConditionCount: creator.rules?.failConditions?.length || 0,
      ledger: this.eventLedger ? {
        completed: this.eventLedger.completed,
        count: this.eventLedger.count,
        total: this.eventLedger.total,
        statuses: [...this.eventLedger.statuses],
        descriptions: [...this.eventLedger.descriptions],
      } : null,
    };
  }

  finishAttempt(success) {
    return success ? this.finishGameWon() : this.finishGameLost();
  }

  selectCandidate(id) {
    return this.creatorSummary();
  }

  verify() { if (!this.creator?.selected) throw new Error("Add at least one Goal milestone first"); return this.beginAttempt("verification"); }
  acceptVerification() { this.creator.verified = true; this.creator.mode = "verified"; this.outcome = null; return this.creatorSummary(); }

  creatorSummary() {
    const creator = this.creator;
    if (!creator) return null;
    return {
      ...creator,
      startState: undefined, start: undefined, valid: undefined, positives: undefined, negatives: undefined, attempt: undefined, original: undefined,
      positiveCount: creator.positives.length + creator.priorPositiveCount,
      negativeCount: creator.negatives.length + creator.priorNegativeCount,
      recordedPositiveCount: creator.positives.length, recordedNegativeCount: creator.negatives.length,
      recordingFrames: creator.attempt?.frameCount || creator.attempt?.frames?.length || 0,
      milestones: (creator.milestones || []).map((m) => ({ ...m })),
      lossGuards: (creator.lossGuards || []).map((g) => ({ ...g })),
      failureConditionCount: creator.rules?.failConditions?.length || 0,
      modifiers: (this.modifiers || []).map((m) => ({ ...m })),
      ledger: this.eventLedger ? {
        completed: this.eventLedger.completed,
        count: this.eventLedger.count,
        total: this.eventLedger.total,
        statuses: [...this.eventLedger.statuses],
        descriptions: [...this.eventLedger.descriptions],
      } : null,
    };
  }

  challengePackage(fields) {
    const creator = this.creator;
    if (!creator?.selected || !creator.verified) throw new Error("Verify a learned goal before saving");
    const encode = (attempts) => attempts.map((attempt) => ({ endBase64: toBase64(attempt.end) }));
    const original = creator.original || {};
    return {
      id: creator.editingId || null, format: "nes-minigame-v1", coreId: this.coreId,
      createdAt: original.createdAt || new Date().toISOString(), updatedAt: new Date().toISOString(),
      rom: { sha256: this.game.sha256, fileHint: this.game.fileHint }, startStateBase64: toBase64(creator.startState), goal: creator.selected,
      rules: { timeLimitFrames: Math.max(0, Number(fields.timeLimitFrames) || 0), failConditions: creator.rules?.failConditions || [] },
      training: { priorPositiveCount: creator.priorPositiveCount, priorNegativeCount: creator.priorNegativeCount, positives: encode(creator.positives), negatives: encode(creator.negatives) },
      modifiers: this.modifiers.map(({ cheatIndex, ...item }) => item),
      presentation: { title: String(fields.title || "Untitled Challenge").slice(0, 80), instructions: String(fields.instructions || "Complete the demonstrated goal!").slice(0, 240) },
      metadata: { category: fields.category || "Skill", difficulty: fields.difficulty || "Medium", playerCount: Math.max(1, Math.min(4, Number(fields.playerCount) || 1)), mode: fields.mode || "Solo", gameId: this.game.id, gameName: this.game.title, tags: fields.tags || [] },
    };
  }
}

export const browserBytes = { fromBase64, toBase64 };
