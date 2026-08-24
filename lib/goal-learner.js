const HEX = (value, width = 4) => value.toString(16).toUpperCase().padStart(width, "0");

function transitionKey(event) {
  return `${event.address}:${event.before}:${event.after}`;
}

// Volatile address blacklist/heuristic: common NES hardware/engine registers that change continuously
const VOLATILE_ADDRESSES = new Set([
  0x0009, // Frame counter / sub-frame timer in many games
  0x0012, // Audio pulse sweep / temp timer
  0x0013, // Frame counter low byte
  0x07A7, // RNG seed / sound RNG
]);

function computeVolatileSet(attempt) {
  if (attempt.volatileSet) return attempt.volatileSet;
  const volatile = new Set(VOLATILE_ADDRESSES);
  if (attempt.changeCounts) {
    const threshold = Math.max(10, (attempt.frameCount || 60) * 0.4);
    for (const [addr, count] of attempt.changeCounts) {
      if (count > threshold) volatile.add(addr);
    }
  } else if (attempt.frames) {
    const counts = new Map();
    for (const frame of attempt.frames) {
      for (const event of frame) {
        counts.set(event.address, (counts.get(event.address) || 0) + 1);
      }
    }
    const threshold = Math.max(10, attempt.frames.length * 0.4);
    for (const [addr, count] of counts) {
      if (count > threshold) volatile.add(addr);
    }
  }
  attempt.volatileSet = volatile;
  return volatile;
}

function isVolatileAddress(address, attempt) {
  if (VOLATILE_ADDRESSES.has(address)) return true;
  const set = attempt.volatileSet || computeVolatileSet(attempt);
  return set.has(address);
}

export function getAttemptTransitionMap(attempt, windowFrames = 180) {
  const volatile = computeVolatileSet(attempt);
  const found = new Map();
  const totalFrames = attempt.frameCount || attempt.frames?.length || 180;

  if (attempt.transitions && Array.isArray(attempt.transitions)) {
    for (const event of attempt.transitions) {
      if (volatile.has(event.address)) continue;
      const distance = event.distance != null
        ? event.distance
        : (event.frameIndex != null ? Math.max(0, totalFrames - event.frameIndex) : 10);
      if (distance <= windowFrames) {
        found.set(transitionKey(event), { ...event, distance });
      }
    }
  } else if (attempt.frames) {
    const start = Math.max(0, attempt.frames.length - windowFrames);
    for (let frame = start; frame < attempt.frames.length; frame++) {
      for (const event of attempt.frames[frame]) {
        if (volatile.has(event.address)) continue;
        found.set(transitionKey(event), {
          ...event,
          distance: attempt.frames.length - 1 - frame,
        });
      }
    }
  }
  return found;
}

function recentTransitions(attempt, windowFrames = 180) {
  return getAttemptTransitionMap(attempt, windowFrames);
}

function hasTransition(attempt, key) {
  return getAttemptTransitionMap(attempt, 9999).has(key);
}

function hasAllTransitions(attempt, keys) {
  const map = getAttemptTransitionMap(attempt, 9999);
  return keys.every((key) => map.has(key));
}

function confidenceFor({ falsePositives, distance = 0, complexity = 1 }) {
  const raw = 99 - falsePositives * 35 - Math.min(20, distance * 0.25) - (complexity - 1) * 6;
  return Math.max(1, Math.min(99, Math.round(raw)));
}

export function createEventLedger(goal) {
  if (!goal) return { completed: false, count: 0, total: 0, statuses: [], descriptions: [] };
  const conditions = goal.conditions || (goal.type === "compound" ? goal.conditions : [goal]);
  return {
    completed: false,
    conditions,
    statuses: conditions.map(() => false),
    descriptions: conditions.map((c, i) => c.title || c.label || (c.description && !c.description.startsWith("$") ? c.description : `Goal ${i + 1}`)),
    count: 0,
    total: conditions.length,
  };
}

export function updateEventLedger(ledger, current, start, recentEvents = []) {
  if (!ledger || ledger.completed) return ledger;
  for (let i = 0; i < ledger.conditions.length; i++) {
    if (!ledger.statuses[i]) {
      const satisfied = evaluateCandidate(ledger.conditions[i], current, start, recentEvents);
      if (satisfied) {
        ledger.statuses[i] = true;
        ledger.count++;
      }
    }
  }
  if (ledger.count >= ledger.total && ledger.total > 0) {
    ledger.completed = true;
  }
  return ledger;
}

export function learnCandidates(positives, negatives = [], options = {}) {
  if (!positives.length) return [];
  const windowFrames = options.windowFrames ?? 180;
  const singleCandidates = [];
  const transitionSets = positives.map((attempt) => recentTransitions(attempt, windowFrames));

  const validKeys = [];
  for (const [key, first] of transitionSets[0]) {
    if (!transitionSets.every((set) => set.has(key))) continue;
    validKeys.push({ key, first });
    const matches = transitionSets.map((set) => set.get(key));
    const falsePositives = negatives.filter((attempt) => hasTransition(attempt, key)).length;
    const averageDistance = matches.reduce((sum, match) => sum + match.distance, 0) / matches.length;
    singleCandidates.push({
      type: "event",
      operator: "transition",
      address: first.address,
      from: first.before,
      to: first.after,
      windowFrames: Math.max(12, Math.ceil(averageDistance + 16)),
      confidence: confidenceFor({ falsePositives, distance: averageDistance, complexity: 1 }),
      falsePositives,
      key,
      description: `$${HEX(first.address)} changed ${first.before} → ${first.after}`,
      explanation: `Appeared in all ${positives.length} marked successes${falsePositives ? ` and ${falsePositives} loss attempt(s)` : " and no loss attempts"}.`,
    });
  }

  const first = positives[0];
  const checkAddresses = [];
  for (let a = 0; a < 0x0800; a++) checkAddresses.push(a);
  for (let a = 0x6000; a < 0x8000; a++) checkAddresses.push(a);

  for (const address of checkAddresses) {
    if (!first.valid[address] || isVolatileAddress(address, first)) continue;
    const startValue = first.start[address];
    const endValue = first.end[address];
    if (startValue === endValue) continue;
    if (!positives.every((attempt) => attempt.valid[address] && attempt.end[address] === endValue)) continue;

    const falsePositives = negatives.filter((attempt) => attempt.valid[address] && attempt.end[address] === endValue).length;
    singleCandidates.push({
      type: "state",
      operator: "equals",
      address,
      value: endValue,
      confidence: confidenceFor({ falsePositives, distance: 14, complexity: 1 }),
      falsePositives,
      description: `$${HEX(address)} became ${endValue}`,
      explanation: `Ended at the same value in all ${positives.length} successes.`,
    });

    const delta = (endValue - startValue + 256) % 256;
    if (positives.every((attempt) => ((attempt.end[address] - attempt.start[address] + 256) % 256) === delta)) {
      singleCandidates.push({
        type: "state",
        operator: "delta",
        address,
        delta,
        confidence: confidenceFor({ falsePositives, distance: 20, complexity: 1 }),
        falsePositives,
        description: `$${HEX(address)} changed by ${delta}`,
        explanation: `The same relative change appeared in every successful attempt.`,
      });
    }
  }

  // Compound / Multi-Event candidate learning:
  const compoundCandidates = [];
  if (validKeys.length >= 2) {
    for (let i = 0; i < validKeys.length && i < 16; i++) {
      for (let j = i + 1; j < validKeys.length && j < 16; j++) {
        const itemA = validKeys[i];
        const itemB = validKeys[j];
        if (itemA.first.address === itemB.first.address && itemA.first.before === itemB.first.before && itemA.first.after === itemB.first.after) continue;

        const pairFalsePositives = negatives.filter((attempt) => hasAllTransitions(attempt, [itemA.key, itemB.key])).length;
        const candA = singleCandidates.find((c) => c.key === itemA.key);
        const candB = singleCandidates.find((c) => c.key === itemB.key);
        if (!candA || !candB) continue;

        const avgDist = ((candA.windowFrames || 30) + (candB.windowFrames || 30)) / 2;
        const confidence = confidenceFor({ falsePositives: pairFalsePositives, distance: avgDist, complexity: 2 });

        compoundCandidates.push({
          type: "compound",
          operator: "all",
          conditions: [
            { type: "event", operator: "transition", address: itemA.first.address, from: itemA.first.before, to: itemA.first.after, windowFrames: candA.windowFrames, description: candA.description },
            { type: "event", operator: "transition", address: itemB.first.address, from: itemB.first.before, to: itemB.first.after, windowFrames: candB.windowFrames, description: candB.description },
          ],
          confidence,
          falsePositives: pairFalsePositives,
          description: `BOTH: ${candA.description} + ${candB.description}`,
          explanation: `Both events occurred in all ${positives.length} wins (${pairFalsePositives} loss false positives).`,
        });
      }
    }
  }

  const all = [...singleCandidates, ...compoundCandidates];
  const unique = new Map();
  for (const candidate of all) {
    const key = candidate.type === "compound"
      ? `compound:${candidate.conditions.map((c) => `${c.address}:${c.from}:${c.to}`).join("+")}`
      : `${candidate.operator}:${candidate.address}:${candidate.from ?? ""}:${candidate.to ?? candidate.value ?? candidate.delta ?? ""}`;
    const existing = unique.get(key);
    if (!existing || candidate.confidence > existing.confidence) unique.set(key, candidate);
  }

  return [...unique.values()]
    .sort((a, b) => b.confidence - a.confidence || a.falsePositives - b.falsePositives || (a.conditions?.length || 1) - (b.conditions?.length || 1))
    .slice(0, options.limit ?? 48)
    .map((candidate, index) => ({ ...candidate, id: `candidate-${index + 1}` }));
}

export function evaluateCandidate(candidate, current, start, recentEvents = [], ledger = null) {
  if (!candidate) return false;
  if (candidate.type === "compound" || candidate.conditions) {
    if (ledger) return ledger.completed;
    const conditions = candidate.conditions || [];
    return conditions.every((cond) => {
      if (cond.operator === "transition") {
        return recentEvents.some((frameEvents) =>
          frameEvents.some((event) => event.address === cond.address && event.before === cond.from && event.after === cond.to)
        );
      }
      return evaluateCandidate(cond, current, start, recentEvents);
    });
  }

  const value = current[candidate.address];
  switch (candidate.operator) {
    case "equals":
      return value === candidate.value;
    case "delta":
      return ((value - start[candidate.address] + 256) % 256) === candidate.delta;
    case "transition": {
      const floor = Math.max(0, recentEvents.length - (candidate.windowFrames ?? 45));
      for (let frame = floor; frame < recentEvents.length; frame++) {
        if (recentEvents[frame].some((event) =>
          event.address === candidate.address && event.before === candidate.from && event.after === candidate.to)) {
          return true;
        }
      }
      return false;
    }
    default:
      return false;
  }
}

export function learnLossCandidates(positives = [], negatives = [], romFile = "") {
  const suggestions = [];

  // Verified known fail guards for specific games
  if (String(romFile || "").toLowerCase().includes("smb")) {
    suggestions.push(
      { id: "loss-smb-death", operator: "equals-any", address: 0x000E, values: [0x06, 0x0B], description: "Mario entered death state ($000E == 0x06/0x0B)", explanation: "Standard SMB player death routine", defaultEnabled: true },
      { id: "loss-smb-life", operator: "decreased", address: 0x075A, description: "Mario lost a life ($075A decreased)", explanation: "Standard SMB life counter decrement", defaultEnabled: true }
    );
  }

  // Find transitions that occurred in negative runs within the final 180 frames of the loss
  if (negatives.length > 0) {
    const negSets = negatives.map((attempt) => recentTransitions(attempt, 180));
    for (const [key, first] of negSets[0] || []) {
      if (isVolatileAddress(first.address, negatives[0])) continue;
      const inPositives = positives.some((attempt) => hasTransition(attempt, key));
      if (!inPositives) {
        suggestions.push({
          id: `loss-trans-${first.address}-${first.before}-${first.after}`,
          operator: "transition",
          address: first.address,
          from: first.before,
          to: first.after,
          description: `Loss event: $${HEX(first.address)} changed ${first.before} → ${first.after}`,
          explanation: `Occurred near end of loss demonstrations (unchecked by default).`,
          defaultEnabled: false,
        });
      }
    }
  }

  // Deduplicate by ID
  const unique = new Map();
  for (const item of suggestions) {
    if (!unique.has(item.id)) unique.set(item.id, item);
  }
  return [...unique.values()];
}

export function buildGoalFromConditions(conditions = []) {
  if (!conditions.length) return null;
  if (conditions.length === 1) {
    return { ...conditions[0], id: conditions[0].id || "custom-single-goal" };
  }
  return {
    type: "compound",
    operator: "all",
    conditions: conditions.map((c, i) => ({ ...c, id: c.id || `cond-${i + 1}` })),
    id: "custom-compound-goal",
    description: `ALL (${conditions.length} conditions): ${conditions.map((c) => c.description).join(" + ")}`,
    confidence: 99,
  };
}

export function extractAllMilestoneCandidates(recentFrames = [], current = null, start = null, options = {}) {
  const windowFrames = options.windowFrames || 180;
  const counts = new Map();
  const transitions = new Map();

  const startFrame = Math.max(0, recentFrames.length - windowFrames);
  for (let f = startFrame; f < recentFrames.length; f++) {
    for (const event of recentFrames[f]) {
      if (VOLATILE_ADDRESSES.has(event.address)) continue;
      const key = transitionKey(event);
      counts.set(event.address, (counts.get(event.address) || 0) + 1);
      transitions.set(key, { ...event, distance: recentFrames.length - 1 - f });
    }
  }

  const candidates = [];
  for (const [key, event] of transitions) {
    const changeCount = counts.get(event.address) || 1;
    // Discard high-frequency noise/movement addresses that changed more than 6 times in 3 seconds
    if (changeCount > 6) continue;

    const confidence = Math.max(50, Math.min(99, 99 - Math.round(event.distance * 0.1) - (changeCount - 1) * 6));
    candidates.push({
      id: `cand-${event.address}-${event.before}-${event.after}`,
      type: "event",
      operator: "transition",
      address: event.address,
      from: event.before,
      to: event.after,
      windowFrames: 120,
      description: `$${HEX(event.address)} changed ${event.before} → ${event.after}`,
      explanation: `Changed ${event.distance} frames (~${(event.distance / 60).toFixed(1)}s) before marking.`,
      confidence,
      hits: 1,
    });
  }

  candidates.sort((a, b) => b.confidence - a.confidence);
  return candidates.slice(0, options.limit || 12);
}

export function extractMilestoneCandidate(recentFrames = [], current = null, start = null, options = {}) {
  const list = extractAllMilestoneCandidates(recentFrames, current, start, options);
  return list[0] || null;
}

export function reinforceMilestoneCandidates(existingCandidates = [], newFrames = [], current = null, start = null) {
  const newCandidates = extractAllMilestoneCandidates(newFrames, current, start);
  const updated = existingCandidates.map((c) => ({ ...c }));

  for (const n of newCandidates) {
    const match = updated.find((e) => e.address === n.address && e.operator === n.operator && e.from === n.from && e.to === n.to);
    if (match) {
      match.hits = (match.hits || 1) + 1;
      match.confidence = Math.min(99, match.confidence + 12);
      match.explanation = `Reinforced across ${match.hits} demonstrations.`;
    } else {
      updated.push({ ...n, confidence: Math.max(40, n.confidence - 5) });
    }
  }

  // Decay candidates that did not occur in the new run
  for (const e of updated) {
    if (!newCandidates.some((n) => n.address === e.address && n.operator === e.operator && n.from === e.from && n.to === e.to)) {
      e.confidence = Math.max(10, e.confidence - 25);
    }
  }

  updated.sort((a, b) => (b.hits || 1) - (a.hits || 1) || b.confidence - a.confidence);
  return updated.slice(0, 12);
}

export function buildConditionFromSelection(candidates = [], selectedIds = null) {
  if (selectedIds !== null && Array.isArray(selectedIds)) {
    if (selectedIds.length === 0) return null;
    const chosen = candidates.filter((c) => selectedIds.includes(c.id));
    if (!chosen.length) return null;
    if (chosen.length === 1) return chosen[0];
    return {
      type: "compound",
      operator: "all",
      conditions: chosen,
      description: `ALL: ${chosen.map((c) => c.description).join(" + ")}`,
    };
  }
  if (!candidates.length) return null;
  return candidates[0];
}

export function buildMilestoneGoal(milestones = []) {
  const active = milestones.filter((m) => m.enabled !== false && m.condition);
  if (!active.length) return null;
  if (active.length === 1) {
    const c = active[0].condition;
    return {
      ...c,
      id: active[0].id || "milestone-single-goal",
      title: active[0].title || "Goal 1",
      description: active[0].title || c.description,
    };
  }
  const conditions = active.map((m, idx) => ({
    ...m.condition,
    id: m.id || `milestone-cond-${idx + 1}`,
    title: m.title || `Goal ${idx + 1}`,
    description: m.title || m.condition.description,
  }));
  return {
    type: "compound",
    operator: "all",
    conditions,
    id: "milestone-compound-goal",
    description: `ALL: ${active.map((m) => m.title || m.condition.description).join(" + ")}`,
    confidence: 99,
  };
}

export function diffSnapshots(previous, current, valid) {
  const events = [];
  // Scope diffing to NES CPU RAM (0x0000-0x0800) and Battery RAM (0x6000-0x8000)
  for (let address = 0; address < 0x0800; address++) {
    if (valid[address] && previous[address] !== current[address]) {
      events.push({ address, before: previous[address], after: current[address] });
    }
  }
  for (let address = 0x6000; address < 0x8000; address++) {
    if (valid[address] && previous[address] !== current[address]) {
      events.push({ address, before: previous[address], after: current[address] });
    }
  }
  return events;
}




