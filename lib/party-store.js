import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const BOARD_SPACES = [
  [17, 68], [24, 73], [34, 75], [44, 72], [52, 65], [56, 55],
  [53, 45], [44, 39], [34, 39], [28, 33], [31, 24], [40, 19],
  [52, 20], [60, 27], [66, 34], [72, 41], [76, 51], [73, 61],
  [67, 69], [60, 76], [49, 81], [38, 84], [28, 82], [20, 76],
];

const SPACE_TYPES = [
  "start", "blue", "blue", "lucky", "red", "blue", "event", "blue",
  "lucky", "red", "blue", "event", "blue", "lucky", "red", "blue",
  "event", "blue", "lucky", "red", "blue", "event", "blue", "lucky",
];

const GEARBOLT_SPACES = [
  [14, 73], [21, 66], [29, 59], [38, 55], [47, 58], [56, 66], [66, 73],
  [76, 72], [84, 63], [87, 52], [83, 42], [75, 35], [66, 31], [57, 34],
  [49, 42], [41, 48], [33, 45], [25, 38], [18, 30], [24, 21], [36, 17],
  [48, 20], [59, 16], [71, 20], [81, 28], [88, 38], [89, 50], [84, 62],
];

const GEARBOLT_TYPES = [
  "start", "blue", "red", "blue", "lucky", "blue", "event", "red",
  "blue", "lucky", "red", "blue", "event", "blue", "red", "lucky",
  "blue", "event", "red", "blue", "lucky", "red", "blue", "event",
  "blue", "red", "lucky", "blue",
];

const RAINSHADOW_ROUTE = [
  [27,74],[30,68],[28,60],[23,55],[24,47],[30,43],[36,44],[39,38],[37,31],
  [39,24],[46,20],[52,15],[48,26],[43,34],[43,45],[39,54],[42,62],[48,63],
  [55,61],[59,55],[62,48],[63,42],[67,37],[72,34],[76,26],[81,31],[85,38],
  [83,46],[78,52],[73,58],[66,62],[59,65],[52,68],[45,72],[38,74],
];

const RAINSHADOW_TYPES = [
  "start","blue","event","lucky","blue","red","blue","event","lucky",
  "blue","red","blue","event","lucky","blue","red","blue","event",
  "lucky","blue","red","blue","event","blue","lucky","red","blue",
  "event","blue","lucky","red","blue","event","blue","lucky",
];

const RAINSHADOW_ACTIVITIES = {
  2: { id: "ferry-fanfare", icon: "⛴", title: "FERRY FANFARE", message: "The harbor bell rings—catch the island ferry and collect 5 coins!", effects: [{ op: "coins", amount: 5 }] },
  7: { id: "mushroom-mystery", icon: "🍄", title: "MUSHROOM MYSTERY", message: "The glowing grove reveals a hidden cache worth 7 coins.", effects: [{ op: "coins", amount: 7 }] },
  12: { id: "rain-squall", icon: "🌧", title: "CEDAR SQUALL", message: "A sudden cloudburst sends you back along the boardwalk!", effects: [{ op: "move", amount: -2 }] },
  17: { id: "salmon-leap", icon: "🐟", title: "SALMON LEAP", message: "Follow the salmon over the falls and spring ahead 3 spaces!", effects: [{ op: "move", amount: 3 }] },
  22: { id: "hot-spring", icon: "♨", title: "HOT-SPRING BREAK", message: "A restorative soak leaves 4 lucky coins in your pack.", effects: [{ op: "coins", amount: 4 }] },
  27: { id: "lookout-cache", icon: "🔭", title: "FIRE LOOKOUT CACHE", message: "Spot the secret trail from the summit and collect 8 coins!", effects: [{ op: "coins", amount: 8 }] },
  32: { id: "tidepool-treasure", icon: "🐚", title: "TIDE-POOL TREASURE", message: "Nori finds a pearl among the anemones—gain 6 coins!", effects: [{ op: "coins", amount: 6 }] },
};

const CHARACTER_COLORS = {
  nova: "#e65b4f",
  marina: "#26a9ad",
  nimbus: "#e0b62e",
  sprig: "#2e74cf",
  luna: "#9a5cc4",
  dash: "#ef9f2f",
};

const defaults = {
  boards: [
    {
      id: "rainshadow-reach",
      name: "Rainshadow Reach",
      description: "Ride the ferry, cross roaring falls, explore cedar groves, and climb from tide pools to the fire lookout.",
      difficulty: "Adventurous",
      image: "/assets/rainshadow-reach.png",
      starSpots: [3, 8, 13, 18, 24, 30],
      starCost: 20,
      landmarks: ["Ferry Harbor", "Glowcap Grove", "Salmon Falls", "Cedar Gorge", "Soothewater Springs", "Fire Lookout", "Orca Tide Pools"],
      spaces: RAINSHADOW_ROUTE.map(([x, y], index) => ({ id: index, x, y, type: RAINSHADOW_TYPES[index], activity: RAINSHADOW_ACTIVITIES[index] || null })),
    },
    {
      id: "starlight-circuit",
      name: "Starlight Circuit",
      description: "A breezy tour through sweets, stars, forest lights, and sparkling shores.",
      difficulty: "Friendly",
      image: "/assets/party-board.png",
      starSpots: [3, 8, 13, 18],
      starCost: 20,
      spaces: BOARD_SPACES.map(([x, y], index) => ({ id: index, x, y, type: SPACE_TYPES[index] })),
    },
    {
      id: "gearbolt-station",
      name: "Gearbolt Station",
      description: "Race around a cheerful orbital robot workshop filled with reactors, rockets, and conveyor surprises.",
      difficulty: "Tricky",
      image: "/assets/gearbolt-station.webp",
      starSpots: [3, 9, 15, 21],
      starCost: 20,
      spaces: GEARBOLT_SPACES.map(([x, y], index) => ({ id: index, x, y, type: GEARBOLT_TYPES[index] })),
    },
  ],
  packs: [{
    id: "party-mix",
    name: "Party Mix",
    description: "Every mini-game on this server, shuffled into one cheerful set.",
    challengeIds: ["*"],
    categories: ["All"],
    playerCounts: [1, 2, 3, 4],
    featured: true,
  }],
  rulesets: [{
    id: "classic-party",
    name: "Classic Party",
    description: "Take turns, earn coins, and settle the score with frequent mini-games.",
    rounds: 5,
    startingCoins: 10,
    minigameEvery: 1,
    blueCoins: 3,
    redCoins: -3,
    luckyCoins: 7,
    winCondition: "Most coins",
  }],
};

function slug(value, fallback) {
  return String(value || fallback).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 64) || fallback;
}

function cleanText(value, fallback, max = 160) {
  return String(value || fallback).trim().slice(0, max);
}

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

export class PartyStore {
  constructor(root, options = {}) {
    this.root = root;
    this.gameResolver = options.gameResolver || (() => null);
    this.extraPacks = options.extraPacks || (() => []);
    this.randomInt = options.randomInt || crypto.randomInt;
    this.runtimeChallengeCache = new Map();
    this.dataPath = path.join(root, "data");
    this.challengePath = path.join(root, "minigames");
    fs.mkdirSync(this.dataPath, { recursive: true });
    fs.mkdirSync(this.challengePath, { recursive: true });
  }

  readCollection(name) {
    const file = path.join(this.dataPath, `${name}.json`);
    if (!fs.existsSync(file)) return clone(defaults[name] || []);
    const parsed = JSON.parse(fs.readFileSync(file, "utf8"));
    return Array.isArray(parsed) ? parsed : clone(defaults[name] || []);
  }

  writeCollection(name, items) {
    const file = path.join(this.dataPath, `${name}.json`);
    const temporary = `${file}.${process.pid}.${crypto.randomUUID()}.tmp`;
    fs.writeFileSync(temporary, `${JSON.stringify(items, null, 2)}\n`);
    fs.renameSync(temporary, file);
  }

  challenges() {
    return fs.readdirSync(this.challengePath)
      .filter((file) => file.endsWith(".neschallenge"))
      .sort()
      .flatMap((file) => {
        try {
          const challenge = JSON.parse(fs.readFileSync(path.join(this.challengePath, file), "utf8"));
          const id = file.replace(/\.neschallenge$/, "");
          const meta = challenge.metadata || {};
          const libraryGame = this.gameResolver(challenge.rom?.sha256);
          return [{
            id,
            coreId: challenge.coreId || "nes",
            file,
            title: challenge.presentation?.title || id.replace(/-/g, " "),
            instructions: challenge.presentation?.instructions || "Complete the challenge!",
            category: meta.category || "Skill",
            playerCount: Math.max(1, Math.min(4, Number(meta.playerCount) || 1)),
            mode: meta.mode || "Solo",
            difficulty: meta.difficulty || "Medium",
            gameId: libraryGame?.id || meta.gameId || challenge.rom?.fileHint || "nes-game",
            gameName: libraryGame?.title || meta.gameName || challenge.rom?.fileHint || "NES Game",
            boxArt: libraryGame?.boxArt || null,
            tags: Array.isArray(meta.tags) ? meta.tags.slice(0, 8) : [],
            timeLimitFrames: challenge.rules?.timeLimitFrames || 0,
            createdAt: challenge.createdAt || null,
          }];
        } catch {
          return [];
        }
      });
  }

  catalog() {
    const challenges = this.challenges();
    return {
      challenges,
      packs: [...this.readCollection("packs"), ...this.extraPacks(challenges)],
      rulesets: this.readCollection("rulesets"),
      boards: this.readCollection("boards"),
    };
  }

  savePack(input) {
    const packs = this.readCollection("packs");
    const id = slug(input.id || input.name, `pack-${Date.now()}`);
    const pack = {
      id,
      name: cleanText(input.name, "New Party Pack", 60),
      description: cleanText(input.description, "A custom mini-game collection."),
      challengeIds: [...new Set(Array.isArray(input.challengeIds) ? input.challengeIds.map(String) : [])],
      categories: [...new Set(Array.isArray(input.categories) ? input.categories.map(String) : [])],
      playerCounts: [...new Set(Array.isArray(input.playerCounts) ? input.playerCounts.map(Number).filter((n) => n >= 1 && n <= 4) : [])],
      featured: Boolean(input.featured),
      updatedAt: new Date().toISOString(),
    };
    const index = packs.findIndex((item) => item.id === id);
    index >= 0 ? packs.splice(index, 1, pack) : packs.push(pack);
    this.writeCollection("packs", packs);
    return pack;
  }

  deletePack(id) {
    const packs = this.readCollection("packs");
    const safeId = slug(id, "missing");
    const index = packs.findIndex((item) => item.id === safeId);
    if (index < 0) throw new Error("Party pack not found or is generated automatically");
    if (packs.length === 1) throw new Error("Keep at least one party pack available");
    const [deleted] = packs.splice(index, 1);
    this.writeCollection("packs", packs);
    return deleted;
  }

  saveRuleset(input) {
    const rulesets = this.readCollection("rulesets");
    const id = slug(input.id || input.name, `rules-${Date.now()}`);
    const ruleset = {
      id,
      name: cleanText(input.name, "House Rules", 60),
      description: cleanText(input.description, "Your custom party rules."),
      rounds: Math.max(1, Math.min(50, Number(input.rounds) || 5)),
      startingCoins: Math.max(0, Math.min(999, Number(input.startingCoins) || 10)),
      minigameEvery: Math.max(1, Math.min(8, Number(input.minigameEvery) || 1)),
      blueCoins: Math.max(0, Math.min(99, Number(input.blueCoins) || 3)),
      redCoins: Math.max(-99, Math.min(0, Number(input.redCoins) || -3)),
      luckyCoins: Math.max(0, Math.min(99, Number(input.luckyCoins) || 7)),
      winCondition: "Most coins",
      updatedAt: new Date().toISOString(),
    };
    const index = rulesets.findIndex((item) => item.id === id);
    index >= 0 ? rulesets.splice(index, 1, ruleset) : rulesets.push(ruleset);
    this.writeCollection("rulesets", rulesets);
    return ruleset;
  }

  deleteRuleset(id) {
    const rulesets = this.readCollection("rulesets");
    const safeId = slug(id, "missing");
    const index = rulesets.findIndex((item) => item.id === safeId);
    if (index < 0) throw new Error("Rule set not found");
    if (rulesets.length === 1) throw new Error("Keep at least one rule set available");
    const [deleted] = rulesets.splice(index, 1);
    this.writeCollection("rulesets", rulesets);
    return deleted;
  }

  resolvePackChallenges(pack, playerCount) {
    const challenges = this.challenges();
    const selected = pack.challengeIds.includes("*") ? challenges : challenges.filter((item) => pack.challengeIds.includes(item.id));
    const compatible = selected.filter((item) => item.playerCount === 1 || item.playerCount === playerCount);
    return compatible.length ? compatible : selected;
  }

  createSession(input) {
    const catalog = this.catalog();
    const board = catalog.boards.find((item) => item.id === input.boardId) || catalog.boards[0];
    const pack = catalog.packs.find((item) => item.id === input.packId) || catalog.packs[0];
    const ruleset = catalog.rulesets.find((item) => item.id === input.rulesetId) || catalog.rulesets[0];
    const count = Math.max(1, Math.min(4, Number(input.playerCount) || 4));
    const names = Array.isArray(input.playerNames) ? input.playerNames : [];
    const characterIds = Array.isArray(input.characterIds) ? input.characterIds.map(String) : [];
    const colors = ["#ff5f77", "#53d6ff", "#ffd45c", "#77e39b"];
    const session = {
      id: crypto.randomUUID(),
      status: "playing",
      boardId: board.id,
      packId: pack.id,
      rulesetId: ruleset.id,
      round: 1,
      currentPlayerIndex: 0,
      actionCount: 0,
      pendingMinigame: null,
      starPosition: board.starSpots?.[0] ?? 0,
      starCost: Math.max(1, Number(board.starCost) || 20),
      lastEvent: "The party is starting! Player 1 rolls first.",
      players: Array.from({ length: count }, (_, index) => ({
        id: index + 1,
        name: cleanText(names[index], `Player ${index + 1}`, 24),
        color: CHARACTER_COLORS[characterIds[index]] || colors[index],
        characterId: cleanText(characterIds[index], `player-${index + 1}`, 32),
        coins: ruleset.startingCoins,
        stars: 0,
        position: 0,
      })),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const sessions = this.readCollection("sessions");
    sessions.push(session);
    this.writeCollection("sessions", sessions.slice(-30));
    return session;
  }

  session(id) {
    return this.readCollection("sessions").find((item) => item.id === id) || null;
  }

  updateSession(session) {
    const sessions = this.readCollection("sessions");
    const index = sessions.findIndex((item) => item.id === session.id);
    if (index < 0) throw new Error("Board game session not found");
    session.updatedAt = new Date().toISOString();
    sessions[index] = session;
    this.writeCollection("sessions", sessions);
    return session;
  }

  advanceTurn(session, ruleset) {
    session.currentPlayerIndex++;
    if (session.currentPlayerIndex >= session.players.length) {
      session.currentPlayerIndex = 0;
      session.round++;
      if (session.round > ruleset.rounds) {
        session.status = "complete";
        session.round = ruleset.rounds;
        const winner = [...session.players].sort((a, b) => (b.stars || 0) - (a.stars || 0) || b.coins - a.coins)[0];
        session.lastEvent = `${winner.name} wins with ${winner.stars || 0} stars and ${winner.coins} coins!`;
      }
    }
  }

  roll(id) {
    const session = this.session(id);
    if (!session) throw new Error("Board game session not found");
    if (session.status !== "playing") throw new Error("This board game is already complete");
    if (session.pendingMinigame) throw new Error("Finish the mini-game before rolling again");
    const catalog = this.catalog();
    const board = catalog.boards.find((item) => item.id === session.boardId);
    const pack = catalog.packs.find((item) => item.id === session.packId);
    const ruleset = catalog.rulesets.find((item) => item.id === session.rulesetId);
    const player = session.players[session.currentPlayerIndex];
    const roll = this.randomInt(1, 7);
    const movement = Array.from({ length: roll }, (_, index) => (player.position + index + 1) % board.spaces.length);
    player.position = movement.at(-1);
    const space = board.spaces[player.position];
    let coinChange = 0;
    let starChange = 0;
    if (space.type === "blue") coinChange = ruleset.blueCoins;
    if (space.type === "red") coinChange = ruleset.redCoins;
    if (space.type === "lucky") coinChange = ruleset.luckyCoins;
    player.coins = Math.max(0, player.coins + coinChange);
    if (player.position === session.starPosition) {
      if (player.coins >= session.starCost) {
        player.coins -= session.starCost;
        coinChange -= session.starCost;
        player.stars = (player.stars || 0) + 1;
        starChange = 1;
        const starSpots = board.starSpots?.length ? board.starSpots : [0];
        const currentStarIndex = Math.max(0, starSpots.indexOf(session.starPosition));
        session.starPosition = starSpots[(currentStarIndex + 1) % starSpots.length];
      }
    }
    session.actionCount++;
    const effect = starChange
      ? `bought a Star from BOLT-0 for ${session.starCost} coins`
      : player.position === session.starPosition && player.coins < session.starCost
        ? `met BOLT-0 but needs ${session.starCost} coins for a Star`
        : coinChange === 0 ? `landed on an ${space.type} space` : `${coinChange > 0 ? "gained" : "lost"} ${Math.abs(coinChange)} coins`;
    session.lastEvent = `${player.name} rolled ${roll} and ${effect}.`;

    const completedPlayerCycle = session.currentPlayerIndex === session.players.length - 1;
    if (completedPlayerCycle && session.round % ruleset.minigameEvery === 0) {
      const available = this.resolvePackChallenges(pack, session.players.length);
      if (available.length) {
        const challenge = available[this.randomInt(0, available.length)];
        session.pendingMinigame = { challengeId: challenge.id, title: challenge.title, playerIndex: session.currentPlayerIndex };
        session.lastEvent += ` Next up: ${challenge.title.replace(/[.!?]+$/, "")}!`;
      } else {
        this.advanceTurn(session, ruleset);
      }
    } else {
      this.advanceTurn(session, ruleset);
    }
    this.updateSession(session);
    return { session, roll, coinChange, starChange, movement, space };
  }

  finishMinigame(id, input) {
    const session = this.session(id);
    if (!session?.pendingMinigame) throw new Error("There is no pending mini-game");
    const ruleset = this.readCollection("rulesets").find((item) => item.id === session.rulesetId);
    const winnerIndex = Math.max(0, Math.min(session.players.length - 1, Number(input.winnerIndex) || 0));
    const winner = session.players[winnerIndex];
    const completed = input.completed !== false;
    if (completed) winner.coins += 10;
    session.lastEvent = completed ? `${winner.name} cleared the mini-game and won 10 coins!` : "The mini-game slipped away. Better luck next time!";
    session.pendingMinigame = null;
    this.advanceTurn(session, ruleset);
    return this.updateSession(session);
  }

  challengePackage(id) {
    const safeId = slug(id, "missing");
    const file = path.join(this.challengePath, `${safeId}.neschallenge`);
    if (!fs.existsSync(file)) throw new Error("Mini-game not found");
    return JSON.parse(fs.readFileSync(file, "utf8"));
  }

  challengeRuntimePackage(id) {
    const safeId = slug(id, "missing");
    const file = path.join(this.challengePath, `${safeId}.neschallenge`);
    if (!fs.existsSync(file)) throw new Error("Mini-game not found");
    const modifiedAt = fs.statSync(file).mtimeMs;
    const cached = this.runtimeChallengeCache.get(safeId);
    if (cached?.modifiedAt === modifiedAt) return clone(cached.challenge);

    const windowSize = Math.min(1024 * 1024, fs.statSync(file).size);
    const descriptor = fs.openSync(file, "r");
    let runtimeSource;
    try {
      const headBuffer = Buffer.alloc(windowSize);
      const tailBuffer = Buffer.alloc(windowSize);
      fs.readSync(descriptor, headBuffer, 0, windowSize, 0);
      fs.readSync(descriptor, tailBuffer, 0, windowSize, Math.max(0, fs.statSync(file).size - windowSize));
      const head = headBuffer.toString("utf8");
      const tail = tailBuffer.toString("utf8");
      const trainingStart = head.indexOf('\n  "training":');
      const trainingEnd = tail.indexOf('\n  "modifiers":');
      runtimeSource = trainingStart >= 0 && trainingEnd >= 0
        ? `${head.slice(0, trainingStart)}\n  "training": {},${tail.slice(trainingEnd)}`
        : fs.readFileSync(file, "utf8");
    } finally {
      fs.closeSync(descriptor);
    }
    const challenge = JSON.parse(runtimeSource);
    challenge.training = {};
    this.runtimeChallengeCache.set(safeId, { modifiedAt, challenge });
    return clone(challenge);
  }

  saveChallenge(input) {
    if (input?.format !== "nes-minigame-v1") throw new Error("Unsupported mini-game package format");
    const title = cleanText(input.presentation?.title, "Untitled Challenge", 80);
    const id = slug(input.id || title, `challenge-${Date.now()}`);
    const challenge = clone(input);
    delete challenge.id;
    challenge.coreId = cleanText(challenge.coreId, "nes", 32);
    challenge.presentation = { ...challenge.presentation, title };
    challenge.updatedAt = new Date().toISOString();
    challenge.createdAt ||= challenge.updatedAt;
    const file = path.join(this.challengePath, `${id}.neschallenge`);
    const temporary = `${file}.${process.pid}.${crypto.randomUUID()}.tmp`;
    fs.writeFileSync(temporary, `${JSON.stringify(challenge, null, 2)}\n`);
    fs.renameSync(temporary, file);
    this.runtimeChallengeCache.delete(id);
    return { id, file: path.relative(this.root, file), saved: this.challenges().find((item) => item.id === id) };
  }

  deleteChallenge(id) {
    const safeId = slug(id, "missing");
    const file = path.join(this.challengePath, `${safeId}.neschallenge`);
    if (!fs.existsSync(file)) throw new Error("Mini-game not found");
    const trash = path.join(this.dataPath, "trash", "minigames");
    fs.mkdirSync(trash, { recursive: true });
    const destination = path.join(trash, `${safeId}-${Date.now()}.neschallenge`);
    fs.renameSync(file, destination);
    this.runtimeChallengeCache.delete(safeId);
    const packs = this.readCollection("packs").map((pack) => ({ ...pack, challengeIds: pack.challengeIds.filter((challengeId) => challengeId !== safeId) }));
    this.writeCollection("packs", packs);
    return { id: safeId, recoverableFrom: path.relative(this.root, destination) };
  }
}
