import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const DEFAULT_PRESETS = {
  smb: [
    {
      id: "mod-smb-fire",
      name: "Always Fire Mario",
      description: "Mario has Fire power constantly ($0756 = 2)",
      kind: "freeze",
      address: 0x0756,
      value: 2,
      category: "Power-up",
    },
    {
      id: "mod-smb-star",
      name: "Permanent Star Power",
      description: "Mario is permanently invincible ($079F = 100)",
      kind: "freeze",
      address: 0x079f,
      value: 100,
      category: "Invincibility",
    },
    {
      id: "mod-smb-moon-jump",
      name: "Moon Gravity / High Jump",
      description: "Mario floats with super low gravity ($0709 = 0)",
      kind: "freeze",
      address: 0x0709,
      value: 0,
      category: "Physics",
    },
    {
      id: "mod-smb-super-speed",
      name: "Mega Run Speed",
      description: "Mario runs at maximum velocity ($0700 = 40)",
      kind: "freeze",
      address: 0x0700,
      value: 40,
      category: "Physics",
    },
    {
      id: "mod-smb-lives",
      name: "Infinite Lives (99)",
      description: "Lives locked to 99 ($075A = 99)",
      kind: "freeze",
      address: 0x075a,
      value: 99,
      category: "Lives",
    },
  ],
};

function readJSON(filePath, fallback = {}) {
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf8"));
  } catch {
    return fallback;
  }
}

function writeJSON(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true });
  const tmp = `${filePath}.${process.pid}.${crypto.randomUUID()}.tmp`;
  fs.writeFileSync(tmp, `${JSON.stringify(data, null, 2)}\n`);
  fs.renameSync(tmp, filePath);
}

function parseChtFile(filePath) {
  try {
    const content = fs.readFileSync(filePath, "utf8");
    const modifiers = [];
    const multipartMap = new Map();
    const lines = content.split(/\r?\n/);

    for (const rawLine of lines) {
      const line = rawLine.trim();
      if (!line || line.startsWith("#") || line.startsWith(";")) continue;

      let type = null;
      let address = 0;
      let value = 0;
      let compare = null;
      let desc = "";

      // Match substitution / compare cheat: SC<hexAddr>:<hexVal>:<hexComp>:<description>
      const scMatch = line.match(/^SC([0-9a-fA-F]{4,6}):([0-9a-fA-F]{2}):([0-9a-fA-F]{2}):(.*)$/);
      if (scMatch) {
        type = "sc";
        address = parseInt(scMatch[1], 16);
        value = parseInt(scMatch[2], 16);
        compare = parseInt(scMatch[3], 16);
        desc = scMatch[4].trim();
      } else {
        // Match simple cheat / freeze: S<hexAddr>:<hexVal>:<description>
        const sMatch = line.match(/^S([0-9a-fA-F]{4,6}):([0-9a-fA-F]{2}):(.*)$/);
        if (sMatch) {
          type = "s";
          address = parseInt(sMatch[1], 16);
          value = parseInt(sMatch[2], 16);
          desc = sMatch[3].trim();
        }
      }

      if (!type) continue;

      // Check if description indicates a multipart cheat code e.g. (1 of 2), (2 of 2), (Part 1 of 3), [1/2]
      const multiMatch = desc.match(/^(.*?)\s*[\(\[]\s*(?:part\s*)?(\d+)\s*(?:of|\/)\s*(\d+)\s*[\)\]]\s*$/i);
      if (multiMatch) {
        const baseName = multiMatch[1].trim();
        const part = parseInt(multiMatch[2], 10);
        const key = baseName.toLowerCase();
        const entry = { address, value, compare, part, type };

        if (multipartMap.has(key)) {
          const mod = multipartMap.get(key);
          mod.entries.push(entry);
        } else {
          const mod = {
            id: `cht-grp-${address.toString(16).padStart(4, "0")}-${modifiers.length}`,
            name: baseName || `Cheat $${address.toString(16).toUpperCase()}`,
            kind: "freeze",
            entries: [entry],
          };
          multipartMap.set(key, mod);
          modifiers.push(mod);
        }
      } else {
        const entry = { address, value, compare, part: 1, type };
        const isRam = address < 0x2000;
        const name = desc || (type === "sc" ? `Code $${address.toString(16).toUpperCase()}` : `Cheat $${address.toString(16).toUpperCase()}`);
        const description = type === "sc"
          ? `${name} ($${address.toString(16).toUpperCase().padStart(4, "0")} = $${value.toString(16).toUpperCase().padStart(2, "0")} [cmp $${compare.toString(16).toUpperCase().padStart(2, "0")}])`
          : `${name} ($${address.toString(16).toUpperCase().padStart(4, "0")} = ${value})`;

        modifiers.push({
          id: type === "sc"
            ? `cht-sc-${address.toString(16).padStart(4, "0")}-${value.toString(16).padStart(2, "0")}-${compare.toString(16).padStart(2, "0")}-${modifiers.length}`
            : `cht-${address.toString(16).padStart(4, "0")}-${value.toString(16).padStart(2, "0")}-${modifiers.length}`,
          name,
          description,
          kind: "freeze",
          address,
          value,
          compare,
          entries: [entry],
          category: isRam ? (type === "sc" ? "RAM Cheat" : "RAM Freeze") : "Game Modifier",
        });
      }
    }

    // Finalize multipart modifiers
    for (const mod of modifiers) {
      if (mod.entries && mod.entries.length > 1) {
        mod.entries.sort((a, b) => (a.part || 0) - (b.part || 0));
        const allRam = mod.entries.every((e) => e.address < 0x2000);
        mod.category = allRam ? "RAM Freeze" : "Game Modifier";
        mod.address = mod.entries[0].address;
        mod.value = mod.entries[0].value;
        const entryParts = mod.entries.map((e) => {
          const addrHex = `$${e.address.toString(16).toUpperCase().padStart(4, "0")}`;
          const valHex = `$${e.value.toString(16).toUpperCase().padStart(2, "0")}`;
          if (e.compare !== null && e.compare !== undefined) {
            const cmpHex = `$${e.compare.toString(16).toUpperCase().padStart(2, "0")}`;
            return `${addrHex}=$${valHex}[cmp $${cmpHex}]`;
          }
          return `${addrHex}=$${valHex}`;
        });
        mod.description = `${mod.name} (${mod.entries.length} parts: ${entryParts.join(", ")})`;
      } else if (mod.entries && mod.entries.length === 1 && !mod.description) {
        const e = mod.entries[0];
        const isRam = e.address < 0x2000;
        mod.category = isRam ? (e.type === "sc" ? "RAM Cheat" : "RAM Freeze") : "Game Modifier";
        mod.address = e.address;
        mod.value = e.value;
        mod.compare = e.compare;
        const addrHex = `$${e.address.toString(16).toUpperCase().padStart(4, "0")}`;
        const valHex = `$${e.value.toString(16).toUpperCase().padStart(2, "0")}`;
        if (e.compare !== null && e.compare !== undefined) {
          const cmpHex = `$${e.compare.toString(16).toUpperCase().padStart(2, "0")}`;
          mod.description = `${mod.name} (${addrHex} = $${valHex} [cmp $${cmpHex}])`;
        } else {
          mod.description = `${mod.name} (${addrHex} = ${e.value})`;
        }
      }
    }

    return modifiers;
  } catch {
    return [];
  }
}

export class ModifierLibrary {
  constructor(root) {
    this.root = root;
    this.filePath = path.join(root, "data", "modifiers.json");
    this.cheatsDir = path.join(root, "cheats", "FCEUX Cheat Code Pack");
    this.ensureDefaults();
  }

  ensureDefaults() {
    const data = readJSON(this.filePath, { games: {} });
    let modified = false;
    for (const [key, presets] of Object.entries(DEFAULT_PRESETS)) {
      if (!data.games[key] || !data.games[key].length) {
        data.games[key] = presets;
        modified = true;
      }
    }
    if (modified) writeJSON(this.filePath, data);
  }

  matchGameKey(gameId, romFile = "") {
    const hint = (romFile || gameId || "").toLowerCase();
    if (hint.includes("smb") || hint.includes("mario")) return "smb";
    return gameId || "default";
  }

  findChtFile(gameId, romFile = "") {
    if (!fs.existsSync(this.cheatsDir)) return null;
    const cleanHint = (romFile || gameId || "")
      .replace(/\.(nes|zip|7z|fds)$/i, "")
      .replace(/[\(\[\{].*?[\)\]\}]/g, "")
      .trim()
      .toLowerCase();
    if (!cleanHint) return null;

    const files = fs.readdirSync(this.cheatsDir);
    // 1. Try exact or near-exact match
    const directMatch = files.find((f) => {
      const base = f.replace(/\.cht$/i, "").toLowerCase();
      return base === cleanHint || base.startsWith(cleanHint);
    });
    if (directMatch) return path.join(this.cheatsDir, directMatch);

    // 2. Try keyword match (e.g. "mega man" -> "Mega Man (USA).cht")
    const words = cleanHint.split(/\s+/).filter((w) => w.length > 2);
    if (words.length > 0) {
      const match = files.find((f) => {
        const lower = f.toLowerCase();
        return words.every((w) => lower.includes(w));
      });
      if (match) return path.join(this.cheatsDir, match);
    }
    return null;
  }

  listModifiers(gameId, romFile = "") {
    const data = readJSON(this.filePath, { games: {} });
    const key = this.matchGameKey(gameId, romFile);
    const customList = data.games[key] || data.games[gameId] || [];
    const combined = customList.map((modifier) => ({ ...modifier }));

    // Merge the complete per-ROM cheat catalogue with presets/custom entries.
    // parseChtFile already flattens multipart codes into one modifier whose
    // entries array retains every write required to activate that cheat.
    const chtPath = this.findChtFile(gameId, romFile);
    if (chtPath) {
      const parsed = parseChtFile(chtPath);
      const seenIds = new Set(combined.map((modifier) => modifier.id));
      const indexByName = new Map(combined.map((modifier, index) => [String(modifier.name || "").trim().toLowerCase(), index]));
      for (const modifier of parsed) {
        const name = String(modifier.name || "").trim().toLowerCase();
        if (seenIds.has(modifier.id)) continue;
        if (name && indexByName.has(name)) {
          const index = indexByName.get(name);
          const existing = combined[index];
          const existingWrites = existing.entries?.length || 1;
          const parsedWrites = modifier.entries?.length || 1;
          if (parsedWrites > existingWrites) combined[index] = { ...modifier, enabled: existing.enabled === true };
          continue;
        }
        combined.push(modifier);
        seenIds.add(modifier.id);
        if (name) indexByName.set(name, combined.length - 1);
      }
    }

    return combined;
  }

  addModifier(gameId, romFile = "", modifier) {
    const data = readJSON(this.filePath, { games: {} });
    const key = this.matchGameKey(gameId, romFile);
    if (!data.games[key]) data.games[key] = [];

    const entries = Array.isArray(modifier.entries) && modifier.entries.length
      ? modifier.entries.map((e) => ({
          address: Number(e.address) & 0xffff,
          value: Number(e.value) & 0xff,
          compare: e.compare !== undefined ? Number(e.compare) & 0xff : undefined,
        }))
      : [
          {
            address: Number(modifier.address) & 0xffff,
            value: Number(modifier.value) & 0xff,
          },
        ];

    const item = {
      id: modifier.id || `mod-${crypto.randomUUID().slice(0, 8)}`,
      name: modifier.name || "Custom Modifier",
      description: modifier.description || `RAM Freeze $${(entries[0].address || 0).toString(16).toUpperCase()}`,
      kind: modifier.kind || "freeze",
      address: Number(entries[0].address) & 0xffff,
      value: Number(entries[0].value) & 0xff,
      entries,
      category: modifier.category || "Custom",
    };

    data.games[key] = data.games[key].filter((m) => m.id !== item.id);
    data.games[key].push(item);
    writeJSON(this.filePath, data);
    return item;
  }

  deleteModifier(gameId, romFile = "", modId) {
    const data = readJSON(this.filePath, { games: {} });
    const key = this.matchGameKey(gameId, romFile);
    if (!data.games[key]) return false;
    data.games[key] = data.games[key].filter((m) => m.id !== modId);
    writeJSON(this.filePath, data);
    return true;
  }
}
