export function detectChallengeFailure({ romFile, values, start, rules = {} }) {
  for (const condition of rules.failConditions || []) {
    const address = Number(condition.address) & 0xffff;
    const value = values[address];
    if (condition.operator === "equals" && value === (Number(condition.value) & 0xff)) {
      return condition.description || `Failure condition reached at $${address.toString(16).toUpperCase().padStart(4, "0")}`;
    }
    if (condition.operator === "equals-any" && condition.values?.map(Number).includes(value)) {
      return condition.description || `Failure condition reached at $${address.toString(16).toUpperCase().padStart(4, "0")}`;
    }
    if (condition.operator === "decreased" && start && value < start[address]) {
      return condition.description || `Value decreased at $${address.toString(16).toUpperCase().padStart(4, "0")}`;
    }
  }

  if (String(romFile || "").toLowerCase() === "smb.nes") {
    const engineRoutine = values[0x000e];
    if (engineRoutine === 0x06 || engineRoutine === 0x0b) return "Mario entered a death state";
    if (start && values[0x075a] < start[0x075a]) return "Mario lost a life";
  }
  return null;
}
