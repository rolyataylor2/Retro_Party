export const scoreFormulaLabels = {
  final: "Final value",
  increase: "Increase from start",
  decrease: "Decrease from start",
  highest: "Highest value",
  lowest: "Lowest value",
  largestIncrease: "Largest increase",
  largestDecrease: "Largest decrease",
  timeToHighest: "Time to highest (frames)",
  timeToLowest: "Time to lowest (frames)",
  changes: "Number of changes",
};

export function filterMemoryCandidates(previous, current, valid, addresses = null, comparison = "changed") {
  if (!previous || !current) return [];
  const source = addresses || Array.from({ length: Math.min(0x800, current.length) }, (_, address) => address);
  return source.filter((address) => {
    if (valid && !valid[address]) return false;
    const before = previous[address];
    const now = current[address];
    if (comparison === "greater") return now > before;
    if (comparison === "less") return now < before;
    if (comparison === "equal") return now === before;
    return now !== before;
  });
}

export function newScoreStats(address, value) {
  return {
    address, start: value, current: value, previous: value,
    rawPrevious: value, cumulativeOffset: 0,
    highest: value, lowest: value, largestIncrease: 0, largestDecrease: 0,
    timeToHighest: 0, timeToLowest: 0, changes: 0,
  };
}

export function updateScoreStats(stats, value, frame, cumulative = false) {
  if (cumulative) {
    if (stats.rawPrevious > 250 && value < 5) stats.cumulativeOffset += 256;
    else if (stats.rawPrevious < 5 && value > 250) stats.cumulativeOffset -= 256;
  }
  const adjustedValue = cumulative ? value + stats.cumulativeOffset : value;
  const delta = adjustedValue - stats.previous;
  stats.current = adjustedValue;
  if (delta !== 0) stats.changes++;
  if (delta > stats.largestIncrease) stats.largestIncrease = delta;
  if (-delta > stats.largestDecrease) stats.largestDecrease = -delta;
  if (adjustedValue > stats.highest) { stats.highest = adjustedValue; stats.timeToHighest = frame; }
  if (adjustedValue < stats.lowest) { stats.lowest = adjustedValue; stats.timeToLowest = frame; }
  stats.previous = adjustedValue;
  stats.rawPrevious = value;
  return stats;
}

export function calculateScore(stats, formula = "final") {
  if (!stats) return 0;
  if (formula === "increase") return stats.current - stats.start;
  if (formula === "decrease") return stats.start - stats.current;
  if (formula === "highest") return stats.highest;
  if (formula === "lowest") return stats.lowest;
  if (formula === "largestIncrease") return stats.largestIncrease;
  if (formula === "largestDecrease") return stats.largestDecrease;
  if (formula === "timeToHighest") return stats.timeToHighest;
  if (formula === "timeToLowest") return stats.timeToLowest;
  if (formula === "changes") return stats.changes;
  return stats.current;
}

export class ScoreRunTracker {
  constructor(configs = [], values = new Uint8Array()) {
    this.groups = configs.map((config) => ({ ...config, entries: config.entries?.map((entry) => ({ ...entry })) }));
    this.configs = this.groups.flatMap((config) => config.entries?.length ? config.entries : [config]);
    this.stats = new Map(this.configs.map((config) => [config.id, newScoreStats(config.address, values[config.address] || 0)]));
    this.frame = 0;
  }

  addConfig(config, initialValue = 0) {
    if (this.stats.has(config.id)) return;
    const copy = { ...config };
    this.groups.push(copy);
    this.configs.push(copy);
    this.stats.set(copy.id, newScoreStats(copy.address, initialValue));
  }

  update(values, frame = this.frame + 1) {
    this.frame = frame;
    for (const config of this.configs) {
      updateScoreStats(this.stats.get(config.id), values[config.address] || 0, frame, config.cumulative === true);
    }
  }

  results() {
    return this.groups.flatMap((group) => {
      if (!group.entries?.length) {
        if (!group.useAsScore) return [];
        return [{ ...group, stats: { ...this.stats.get(group.id) }, score: calculateScore(this.stats.get(group.id), group.formula) }];
      }
      const components = group.entries.filter((entry) => entry.useAsScore !== false).map((entry) => ({
        ...entry,
        stats: { ...this.stats.get(entry.id) },
        score: calculateScore(this.stats.get(entry.id), entry.formula),
      }));
      return [{ ...group, components, score: components.reduce((total, component) => total + component.score, 0) }];
    });
  }
}
