import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const clone = (value) => JSON.parse(JSON.stringify(value));
const clean = (value, fallback, length = 80) => String(value || fallback).trim().replace(/\s+/g, " ").slice(0, length) || fallback;
const number = (value, fallback, minimum = 0, maximum = 10_000) => Math.max(minimum, Math.min(maximum, Number(value) || fallback));
const activity = (value) => {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;
  return {
    id: clean(value.id, "board-activity", 64).toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    icon: clean(value.icon, "✦", 4), title: clean(value.title, "BOARD ACTIVITY", 60), message: clean(value.message, "Something surprising happened!", 180),
    effects: (Array.isArray(value.effects) ? value.effects : []).slice(0, 4).map((effect) => ({ op: ["coins", "move"].includes(effect?.op) ? effect.op : "coins", amount: number(effect?.amount, 0, -99, 99) })),
  };
};

function studioDefaults(partyStore) {
  const boards = partyStore.readCollection("boards");
  const board = boards[0];
  const spaces = (board?.spaces || []).map((space) => ({ ...space, size: 3, depth: 2, rotation: 0, shape: "oval", action: space.activity?.id || `${space.type || "blue"}-space-event` }));
  return {
    version: 2,
    project: { id: "rainshadow-party", name: "Rainshadow Reach", host: "Bramble", updatedAt: new Date().toISOString() },
    map: {
      boardId: board?.id || "starlight-circuit",
      name: board?.name || "Starlight Circuit",
      image: board?.image || "/assets/party-board.png",
      tool: "space",
      spaceType: "blue",
      spaces,
      paths: spaces.map((space, index) => ({ id: `path-${index + 1}`, from: space.id, to: spaces[(index + 1) % spaces.length]?.id ?? 0 })),
      objects: [
        { id: "ferry-harbor", kind: "activity", name: "Ferry Harbor", x: 27, y: 74 },
        { id: "glowcap-grove", kind: "activity", name: "Glowcap Grove", x: 39, y: 38 },
        { id: "salmon-falls", kind: "activity", name: "Salmon Falls", x: 48, y: 63 },
        { id: "soothewater", kind: "activity", name: "Soothewater Springs", x: 67, y: 37 },
        { id: "fire-lookout", kind: "star-shop", name: "Fire Lookout", x: 76, y: 26 },
        { id: "orca-tidepools", kind: "activity", name: "Orca Tide Pools", x: 52, y: 68 },
      ],
      triggers: spaces[7] ? [{ id: "ghost-space-trigger", kind: "trigger", name: "Ghost Space", eventId: "ghost-space", spaceId: spaces[7].id, x: spaces[7].x, y: spaces[7].y, radius: 10 }] : [], regions: [], spawns: [{ id: "spawn-1", x: 27, y: 74 }], cameras: [],
    },
    scenes: {
      selectedId: "ghost-challenge",
      entries: [{
        id: "ghost-challenge", name: "Ghost Challenge", duration: 12,
        clips: [
          { id: "gather", track: "players", label: "GATHER PLAYERS", start: 0, duration: 1.4, color: "blue", resources: ["players"] },
          { id: "ghost", track: "actor", label: "GHOST APPEARS", start: 1.4, duration: 1.6, color: "purple", resources: ["ghost"] },
          { id: "fog", track: "effects", label: "FOG BURST", start: 1.9, duration: 1, color: "cyan", resources: ["effects"] },
          { id: "quip", track: "dialogue", label: "GHOST QUIP", start: 2.5, duration: 2.4, color: "pink", resources: ["ui"] },
          { id: "mash", track: "input", label: "MASH A!", start: 4.9, duration: 5, color: "yellow", resources: ["input"], barrier: true },
          { id: "reward", track: "game", label: "+20 COINS", start: 9.9, duration: 1.2, color: "green", resources: ["ui"] },
          { id: "restore", track: "players", label: "PUT THEM BACK", start: 11.1, duration: .9, color: "blue", resources: ["players"] },
        ],
      }],
    },
    events: {
      selectedId: "ghost-space",
      entries: [{ id: "ghost-space", name: "Ghost Space", trigger: { kind: "land", spaceId: 7, radius: 10, round: 1, turn: 1 }, commands: [
        { id: "who", kind: "condition", label: "IF 2 PLAYERS ARE READY", open: true, depth: 0 },
        { id: "scene", kind: "scene", label: "PLAY GHOST CHALLENGE", open: true, depth: 1 },
        { id: "winner", kind: "player", label: "GIVE WINNER 20 COINS", open: true, depth: 1 },
        { id: "restore", kind: "action", label: "PUT EVERYONE BACK", open: true, depth: 1 },
      ] }],
    },
    rules: {
      activeCartridge: "classic",
      cartridges: [
        { id: "classic", name: "CLASSIC PARTY", color: "red" },
        { id: "everybody", name: "EVERYBODY MOVES", color: "green" },
        { id: "team", name: "TEAM PARTY", color: "blue" },
        { id: "empty", name: "EMPTY RULESET", color: "cream" },
      ],
      pages: {
        start: { title: "HOW DOES IT START?", cards: ["GIVE EVERYONE 10 COINS", "PUT PLAYERS AT START", "PLACE THE FIRST STAR"] },
        flow: { title: "WHAT HAPPENS NEXT?", cards: ["WHEN NOTHING IS HAPPENING → START TURN", "AFTER EVERYONE MOVES → PICK MINI-GAME", "AFTER MINI-GAME → NEXT ROUND"] },
        players: { title: "WHO CAN PLAY?", cards: ["1–4 PLAYERS", "FILL EMPTY SEATS WITH CPU"] },
        movement: { title: "HOW DO THEY MOVE?", cards: ["ROLL 1–6", "MOVE ONE SPACE AT A TIME", "RUN EVENTS WHILE MOVING"] },
        minigames: { title: "WHEN DO MINI-GAMES START?", cards: ["AFTER EVERY ROUND", "WINNER GETS 10 COINS"] },
        winning: { title: "WHO WINS?", cards: ["MOST STARS", "THEN MOST COINS"] },
        special: { title: "ANY SPECIAL RULES?", cards: ["ANNOUNCE THE FINAL FIVE ROUNDS"] },
      },
    },
    data: {
      items: [{ id: "ferry-pass", name: "FERRY PASS", icon: "⛴" }, { id: "trail-compass", name: "TRAIL COMPASS", icon: "🧭" }, { id: "rain-shell", name: "RAIN SHELL", icon: "🧥" }, { id: "double-die", name: "DOUBLE DIE", icon: "🎲" }],
      currencies: [{ id: "coins", name: "COINS", icon: "●", color: "gold" }, { id: "stars", name: "STARS", icon: "★", color: "yellow" }],
      toys: [
        { id: "coins", name: "COINS", icon: "🪙", category: "currency", description: "The standard spendable board currency.", effectType: "coins", amount: 1, stackLimit: 999, consumable: false, tradable: true, rarity: "common" },
        { id: "stars", name: "STARS", icon: "⭐", category: "currency", description: "The primary victory collectible.", effectType: "stars", amount: 1, stackLimit: 99, consumable: false, tradable: true, rarity: "legendary" },
        { id: "standard-die", name: "STANDARD DICE BLOCK", icon: "🎲", category: "dice", description: "Roll from 1 to 6 for normal movement.", effectType: "roll", amount: 1, dieFaces: "1,2,3,4,5,6", stackLimit: 1, consumable: false, tradable: false, rarity: "common" },
        { id: "double-die", name: "DOUBLE DICE BLOCK", icon: "🎲🎲", category: "dice", description: "Roll two dice and move by their total.", effectType: "roll", amount: 2, dieFaces: "1,2,3,4,5,6", stackLimit: 3, consumable: true, tradable: true, rarity: "uncommon" },
        { id: "triple-die", name: "TRIPLE DICE BLOCK", icon: "🎲", category: "dice", description: "Roll three dice and move by their total.", effectType: "roll", amount: 3, dieFaces: "1,2,3,4,5,6", stackLimit: 3, consumable: true, tradable: true, rarity: "rare" },
        { id: "slow-die", name: "SLOW DICE BLOCK", icon: "🐢", category: "dice", description: "Choose a careful roll from 1 to 3.", effectType: "roll", amount: 1, dieFaces: "1,2,3", stackLimit: 3, consumable: true, tradable: true, rarity: "uncommon" },
        { id: "super-mushroom", name: "SUPER MUSHROOM", icon: "🍄", category: "powerup", description: "Boost the player's next movement.", effectType: "move", amount: 3, stackLimit: 3, consumable: true, tradable: true, rarity: "uncommon" },
        { id: "warp-whistle", name: "WARP WHISTLE", icon: "🪈", category: "powerup", description: "Warp to another board space.", effectType: "warp", amount: 1, stackLimit: 1, consumable: true, tradable: true, rarity: "rare" },
        { id: "duel-card", name: "DUEL CARD", icon: "⚔️", category: "card", description: "Challenge another player to a duel.", effectType: "duel", amount: 1, stackLimit: 3, consumable: true, tradable: true, rarity: "rare" },
        { id: "coin-card", name: "COIN BONUS CARD", icon: "🃏", category: "card", description: "Gain a quick coin bonus.", effectType: "coins", amount: 10, stackLimit: 5, consumable: true, tradable: true, rarity: "uncommon" },
        { id: "party-apple", name: "PARTY APPLE", icon: "🍎", category: "food", description: "A small restorative snack.", effectType: "heal", amount: 10, stackLimit: 5, consumable: true, tradable: true, rarity: "common" },
        { id: "celebration-cake", name: "CELEBRATION CAKE", icon: "🍰", category: "food", description: "A powerful treat that restores the whole party.", effectType: "heal-party", amount: 20, stackLimit: 1, consumable: true, tradable: true, rarity: "rare" },
        { id: "heart-potion", name: "HEART POTION", icon: "🧪", category: "healing", description: "Restore health or clear a minor injury.", effectType: "heal", amount: 25, stackLimit: 5, consumable: true, tradable: true, rarity: "uncommon" },
        { id: "first-aid-kit", name: "FIRST AID KIT", icon: "🩹", category: "healing", description: "Restore health and remove a negative status.", effectType: "heal-status", amount: 50, stackLimit: 2, consumable: true, tradable: true, rarity: "rare" },
      ],
      spaceTypes: ["START", "BLUE", "RED", "LUCKY", "EVENT"],
      statuses: ["TRAIL READY", "TAILWIND", "RAIN SOAKED", "HOT-SPRING GLOW"],
      minigamePools: [{ id: "party-mix", name: "PARTY MIX", enabled: true }],
    },
  };
}

function boardMap(board = {}) {
  const spaces = (Array.isArray(board.spaces) ? board.spaces : []).map((space, index) => ({
    ...space,
    id: Number.isFinite(Number(space.id)) ? Number(space.id) : index,
    size: number(space.size, 3, 1, 5), depth: number(space.depth, 2, 0, 5),
    rotation: number(space.rotation, 0, -180, 180), shape: ["oval", "round", "star"].includes(space.shape) ? space.shape : "oval",
    action: space.action || space.activity?.id || `${space.type || "blue"}-space-event`,
  }));
  return {
    boardId: clean(board.id, "studio-board", 64).toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    name: clean(board.name, "Untitled Board"), image: String(board.image || "").slice(0, 2_000_000),
    tool: "space", spaceType: "blue", spaces,
    paths: clone(Array.isArray(board.paths) ? board.paths : spaces.map((space, index) => ({ id: `path-${index + 1}`, from: space.id, to: spaces[index + 1]?.id })).filter((item) => item.to !== undefined)),
    objects: clone(Array.isArray(board.objects) ? board.objects : []), triggers: clone(Array.isArray(board.triggers) ? board.triggers : []),
    regions: clone(Array.isArray(board.regions) ? board.regions : []), spawns: clone(Array.isArray(board.spawns) ? board.spawns : []), cameras: clone(Array.isArray(board.cameras) ? board.cameras : []),
  };
}

function projectForBoard(board, template) {
  const result = {
    id: clean(board.id, "studio-board", 64).toLowerCase().replace(/[^a-z0-9]+/g, "-"),
    name: clean(board.name, "Untitled Board"), map: boardMap(board),
    scenes: clone(template.scenes), events: clone(template.events), rules: clone(template.rules), data: clone(template.data),
  };
  if (Array.isArray(board.events) && board.events.length) {
    result.events = { selectedId: board.events[0].id, entries: clone(board.events) };
  }
  return result;
}

export class PartyStudioStore {
  constructor(root, partyStore) {
    this.file = path.join(root, "data", "party-studio.json");
    this.partyStore = partyStore;
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    this.state = this.load();
  }

  load() {
    const defaults = studioDefaults(this.partyStore);
    try {
      const parsed = JSON.parse(fs.readFileSync(this.file, "utf8"));
      if (parsed && typeof parsed === "object") return this.hydrate({ ...defaults, ...parsed }, defaults);
    } catch {}
    return this.hydrate(defaults, defaults);
  }

  hydrate(state, defaults = studioDefaults(this.partyStore)) {
    const catalog = this.partyStore.readCollection("boards");
    const stored = Array.isArray(state.boardProjects?.entries) ? state.boardProjects.entries : [];
    const legacyId = state.map?.boardId;
    const entries = catalog.map((board) => {
      const existing = stored.find((entry) => entry.id === board.id);
      if (existing) return { ...projectForBoard(board, defaults), ...clone(existing), id: board.id, name: existing.name || board.name };
      if (!stored.length && board.id === legacyId) return { id: board.id, name: state.map?.name || board.name, map: clone(state.map), scenes: clone(state.scenes), events: clone(state.events), rules: clone(state.rules), data: clone(state.data) };
      return projectForBoard(board, defaults);
    });
    for (const entry of stored) if (!entries.some((item) => item.id === entry.id)) entries.push(clone(entry));
    if (!entries.length) entries.push(projectForBoard({ id: "studio-board", name: "Untitled Board" }, defaults));
    const requested = state.boardProjects?.selectedId || legacyId;
    const active = entries.find((entry) => entry.id === requested) || entries[0];
    return {
      ...state, version: 2,
      project: { ...state.project, id: active.id, name: active.name },
      boardProjects: { selectedId: active.id, entries },
      map: clone(active.map), scenes: clone(active.scenes), events: clone(active.events), rules: clone(active.rules), data: clone(active.data),
    };
  }

  syncActive() {
    const active = this.state.boardProjects?.entries?.find((entry) => entry.id === this.state.boardProjects.selectedId);
    if (!active) return;
    active.name = this.state.map?.name || active.name;
    for (const section of ["map", "scenes", "events", "rules", "data"]) active[section] = clone(this.state[section]);
  }

  get() { return clone(this.state); }

  write() {
    this.syncActive();
    this.state.project ||= {};
    this.state.project.updatedAt = new Date().toISOString();
    const temporary = `${this.file}.${process.pid}.${crypto.randomUUID()}.tmp`;
    fs.writeFileSync(temporary, `${JSON.stringify(this.state, null, 2)}\n`);
    fs.renameSync(temporary, this.file);
    return this.get();
  }

  update(section, input) {
    if (!["map", "scenes", "events", "rules", "data"].includes(section)) throw new Error("That Party Studio station does not exist.");
    if (!input || typeof input !== "object" || Array.isArray(input)) throw new Error("This station needs a valid project object.");
    const next = clone(input);
    if (section === "map") {
      next.name = clean(next.name, "Untitled Board");
      next.spaces = (Array.isArray(next.spaces) ? next.spaces : []).slice(0, 256).map((space, index) => ({
        id: Number.isFinite(Number(space.id)) ? Number(space.id) : index,
        x: number(space.x, 50, 0, 100), y: number(space.y, 50, 0, 100),
        type: clean(space.type, "blue", 20).toLowerCase(), size: number(space.size, 3, 1, 5),
        depth: number(space.depth, 2, 0, 5), rotation: number(space.rotation, 0, -180, 180),
        shape: ["oval", "round", "star"].includes(space.shape) ? space.shape : "oval",
        action: clean(space.action, `${clean(space.type, "blue", 20)}-space-event`, 64),
        activity: activity(space.activity),
      }));
      next.paths = (Array.isArray(next.paths) ? next.paths : []).slice(0, 512);
    }
    this.state[section] = next;
    if (section === "map") this.publishMap(next);
    if (section === "events") this.publishEvents(next);
    if (section === "rules") this.publishRules(next);
    return this.write();
  }

  selectBoard(id) {
    this.syncActive();
    const active = this.state.boardProjects.entries.find((entry) => entry.id === id);
    if (!active) throw new Error("That board is not in the Board Maker.");
    this.state.boardProjects.selectedId = active.id;
    this.state.project = { ...this.state.project, id: active.id, name: active.name };
    for (const section of ["map", "scenes", "events", "rules", "data"]) this.state[section] = clone(active[section]);
    return this.write();
  }

  createBoard(input = {}) {
    const name = clean(input.name, "New Board");
    const base = clean(input.id || name, "new-board", 64).toLowerCase().replace(/[^a-z0-9]+/g, "-") || "new-board";
    let id = base;
    let suffix = 2;
    while (this.state.boardProjects.entries.some((entry) => entry.id === id)) id = `${base}-${suffix++}`;
    const template = studioDefaults(this.partyStore);
    const entry = projectForBoard({ id, name, image: "", spaces: [] }, template);
    entry.scenes = { selectedId: "opening-scene", entries: [{ id: "opening-scene", name: "Opening Scene", duration: 12, clips: [] }] };
    entry.events = { selectedId: "first-space-action", entries: [{ id: "first-space-action", name: "First Space Action", trigger: { kind: "land", spaceId: 0, radius: 10, round: 1, turn: 1 }, commands: [] }] };
    this.syncActive();
    this.state.boardProjects.entries.push(entry);
    this.state.boardProjects.selectedId = id;
    this.state.project = { ...this.state.project, id, name };
    for (const section of ["map", "scenes", "events", "rules", "data"]) this.state[section] = clone(entry[section]);
    this.publishMap(this.state.map);
    return this.write();
  }

  publishMap(map) {
    const boards = this.partyStore.readCollection("boards");
    const existing = boards.find((board) => board.id === map.boardId) || boards[0] || {};
    const board = {
      ...existing,
      id: clean(map.boardId, "studio-board", 64).toLowerCase().replace(/[^a-z0-9]+/g, "-"),
      name: clean(map.name, "Studio Board"),
      description: clean(existing.description, "A board built in Party Studio.", 180),
      image: String(map.image || "").slice(0, 2_000_000),
      spaces: map.spaces.map(({ id, x, y, type, size, shape, rotation, activity: boardActivity }) => ({ id, x, y, type, size, shape, rotation, activity: boardActivity || null })),
      paths: map.paths,
      triggers: Array.isArray(map.triggers) ? map.triggers : [],
      objects: Array.isArray(map.objects) ? map.objects : [],
      regions: Array.isArray(map.regions) ? map.regions : [],
      spawns: Array.isArray(map.spawns) ? map.spawns : [],
      cameras: Array.isArray(map.cameras) ? map.cameras : [],
      events: this.state.events?.entries || existing.events || [],
      starSpots: map.spaces.filter((space) => space.type === "lucky").map((space) => space.id).slice(0, 6),
      starCost: number(existing.starCost, 20, 1, 100),
    };
    const index = boards.findIndex((item) => item.id === board.id);
    index >= 0 ? boards.splice(index, 1, board) : boards.push(board);
    this.partyStore.writeCollection("boards", boards);
  }

  publishEvents(events) {
    const boards = this.partyStore.readCollection("boards");
    const boardId = clean(this.state.map?.boardId, "studio-board", 64).toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const index = boards.findIndex((board) => board.id === boardId);
    if (index < 0) return;
    boards[index] = { ...boards[index], events: clone(events.entries || []), triggers: clone(this.state.map?.triggers || []) };
    this.partyStore.writeCollection("boards", boards);
  }

  publishRules(rules) {
    const cartridge = rules.cartridges.find((item) => item.id === rules.activeCartridge) || rules.cartridges[0];
    const collections = this.partyStore.readCollection("rulesets");
    const boardId = clean(this.state.map?.boardId, "studio-board", 48).toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const published = {
      id: boardId === this.partyStore.readCollection("boards")[0]?.id ? "studio-rules" : `studio-rules-${boardId}`,
      name: clean(cartridge?.name, "Studio Rules"),
      description: "The live rules assembled in Party Studio's Rule Book.",
      rounds: 5,
      startingCoins: rules.pages.start?.disabled?.includes(0) ? 0 : 10,
      minigameEvery: 1,
      blueCoins: 3,
      redCoins: -3,
      luckyCoins: 7,
      winCondition: rules.pages.winning?.disabled?.includes(0) ? "Most coins" : "Most stars",
    };
    const index = collections.findIndex((item) => item.id === published.id);
    index >= 0 ? collections.splice(index, 1, published) : collections.push(published);
    this.partyStore.writeCollection("rulesets", collections);
  }

  reset() {
    const defaults = studioDefaults(this.partyStore);
    this.state = this.hydrate(defaults, defaults);
    return this.write();
  }
}
