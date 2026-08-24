import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const CHARACTER_META = [
  { id: "nova", name: "Bramble", color: "#e65b4f", x: 0, y: 0 },
  { id: "marina", name: "Tilly", color: "#26a9ad", x: 50, y: 0 },
  { id: "nimbus", name: "Moss", color: "#e0b62e", x: 100, y: 0 },
  { id: "sprig", name: "Skipper", color: "#2e74cf", x: 0, y: 100 },
  { id: "luna", name: "Ember", color: "#9a5cc4", x: 50, y: 100 },
  { id: "dash", name: "Nori", color: "#ef9f2f", x: 100, y: 100 },
];
const CHARACTERS = CHARACTER_META.map((character) => character.id);
const SETUP_STEPS = ["ai-players", "rounds", "minigames", "ruleset", "ai-difficulty", "board", "review"];
const ROUND_OPTIONS = [5, 10, 15, 20];
const AI_DIFFICULTIES = ["easy", "normal", "hard"];
const GAME_QUEUE_HISTORY_LIMIT = 120;

function clone(value) {
  return JSON.parse(JSON.stringify(value));
}

function clean(value, fallback, maximum = 20) {
  return String(value || fallback).trim().replace(/\s+/g, " ").slice(0, maximum) || fallback;
}

function roomCode(value) {
  const code = String(value || "").trim().toUpperCase();
  if (!/^[A-Z]{4}$/.test(code)) throw new Error("Party room codes must be four letters.");
  return code;
}

function jsonString(value, fallback = "") {
  try { return JSON.parse(`"${value}"`); } catch { return fallback; }
}

export class PartyV2RoomStore {
  constructor(root, partyStore, options = {}) {
    this.partyStore = partyStore;
    this.studioStore = options.studioStore || null;
    this.file = path.join(root, "data", "party-rooms.json");
    this.previousFile = path.join(root, "data", "party-v2-rooms.json");
    this.now = options.now || (() => Date.now());
    this.token = options.token || (() => crypto.randomBytes(24).toString("base64url"));
    this.randomInt = options.randomInt || crypto.randomInt;
    this.listeners = new Set();
    this.catalogCache = null;
    this.catalogCachedAt = 0;
    this.challengeCache = null;
    this.challengeCachedAt = 0;
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const loaded = this.load();
    this.rooms = loaded.rooms.map((room) => this.normalizeRoom(room));
    if (loaded.migrated) this.write(this.rooms);
  }

  onUpdate(callback) {
    if (typeof callback !== "function") return () => {};
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  notify(room) {
    for (const listener of this.listeners) {
      try { listener(room); } catch (error) { console.error("PartyV2RoomStore listener error:", error); }
    }
  }

  load() {
    const readRooms = (file) => {
      try { const parsed = JSON.parse(fs.readFileSync(file, "utf8")); return Array.isArray(parsed) ? parsed : []; }
      catch { return []; }
    };
    const current = readRooms(this.file);
    const queueRooms = current.filter((room) => room && (Object.hasOwn(room, "configuration") || Object.hasOwn(room, "gameQueue") || Object.hasOwn(room, "setupStep")));
    if (queueRooms.length) return { rooms: queueRooms, migrated: false };
    const previous = readRooms(this.previousFile);
    if (previous.length) return { rooms: previous, migrated: true };
    return { rooms: [], migrated: false };
  }

  read() {
    return this.rooms;
  }

  normalizeRoom(room) {
    if (!room || typeof room !== "object") return room;
    const configuration = room.configuration && typeof room.configuration === "object" ? room.configuration : {};
    room.configuration = {
      aiPlayers: Array.isArray(configuration.aiPlayers) ? configuration.aiPlayers : null,
      rounds: configuration.rounds ?? null,
      packId: configuration.packId ?? null,
      rulesetId: configuration.rulesetId ?? null,
      aiDifficulty: configuration.aiDifficulty ?? null,
      boardId: configuration.boardId ?? null,
    };
    room.players = Array.isArray(room.players) ? room.players : [];
    room.queues = room.queues && typeof room.queues === "object" ? room.queues : { primary: [], players: {} };
    room.queues.primary = Array.isArray(room.queues.primary) ? room.queues.primary : [];
    room.queues.players = room.queues.players && typeof room.queues.players === "object" ? room.queues.players : {};
    room.queueSequence = Number(room.queueSequence) || 0;
    room.eventSequence = Number(room.eventSequence) || 0;

    if (room.game && typeof room.game === "object") {
      room.game.players = Array.isArray(room.game.players) ? room.game.players : [];
      room.game.boardId ||= room.configuration.boardId || this.catalog().boards[0]?.id || null;
    } else if (["playing", "roulette", "minigame", "results", "complete", "demo", "demo-complete"].includes(room.status)) {
      const ready = room.players.length > 0
        && Array.isArray(room.configuration.aiPlayers)
        && ROUND_OPTIONS.includes(Number(room.configuration.rounds))
        && room.configuration.packId
        && room.configuration.rulesetId
        && room.configuration.aiDifficulty
        && room.configuration.boardId;
      room.status = ready ? "countdown" : room.players.length ? "setup" : "registration";
      room.setupStep = ready ? "complete" : room.players.length ? "ai-players" : "registration";
      room.countdownEndsAt = ready ? this.now() : null;
      room.game = null;
      room.gameQueue = null;
      room.roulette = null;
      room.minigame = null;
      room.summary = null;
    }
    return room;
  }

  write(rooms) {
    const temporary = `${this.file}.${process.pid}.${crypto.randomUUID()}.tmp`;
    fs.writeFileSync(temporary, `${JSON.stringify(rooms, null, 2)}\n`);
    fs.renameSync(temporary, this.file);
    this.rooms = rooms;
  }

  room(code, rooms = this.read()) {
    const normalized = roomCode(code);
    const room = rooms.find((room) => room.code === normalized) || null;
    return room ? this.normalizeRoom(room) : null;
  }

  event(room, type, detail = {}) {
    room.eventSequence = (room.eventSequence || 0) + 1;
    room.event = { id: room.eventSequence, type, at: this.now(), ...detail };
  }

  ensureQueues(room) {
    room.queueSequence ||= 0;
    room.queues ||= { primary: [], players: {} };
    room.queues.primary ||= [];
    room.queues.players ||= {};
    return room.queues;
  }

  enqueue(room, target, command, payload = {}) {
    const queues = this.ensureQueues(room);
    const item = {
      id: ++room.queueSequence,
      target,
      kind: command === "request-input" ? "input" : "display",
      command,
      payload,
      createdAt: this.now(),
    };
    if (target === "primary") queues.primary.push(item);
    else {
      queues.players[target] ||= [];
      queues.players[target].push(item);
    }
    return item;
  }

  enqueuePlayers(room, command, payloadForPlayer) {
    for (const player of room.players) {
      const payload = typeof payloadForPlayer === "function" ? payloadForPlayer(player) : payloadForPlayer;
      this.enqueue(room, player.id, command, payload || {});
    }
  }

  save(room, rooms = this.read(), options = {}) {
    const bumpVersion = options.bumpVersion !== false;
    const touch = options.touch !== false;
    const notify = options.notify !== false;
    const index = rooms.findIndex((item) => item.code === room.code);
    if (bumpVersion) room.version = (room.version || 0) + 1;
    if (touch) room.updatedAt = new Date(this.now()).toISOString();
    index >= 0 ? rooms.splice(index, 1, room) : rooms.push(room);
    this.write(rooms);
    if (notify) this.notify(room);
    return room;
  }

  create(code) {
    const normalized = roomCode(code);
    const rooms = this.read();
    const existing = rooms.find((room) => room.code === normalized);
    if (existing) return this.publicRoom(this.tickRoom(existing, rooms));
    const timestamp = new Date(this.now()).toISOString();
    const room = {
      code: normalized,
      status: "registration",
      setupStep: "registration",
      players: [],
      configuration: {
        aiPlayers: null,
        rounds: null,
        packId: null,
        rulesetId: null,
        aiDifficulty: null,
        boardId: null,
      },
      countdownEndsAt: null,
      game: null,
      gameQueue: null,
      roulette: null,
      minigame: null,
      summary: null,
      demo: null,
      queueSequence: 0,
      queues: { primary: [], players: {} },
      eventSequence: 0,
      event: null,
      createdAt: timestamp,
      updatedAt: timestamp,
      version: 1,
    };
    this.event(room, "room-created", { message: "Waiting for players to join." });
    this.enqueue(room, "primary", "navigate", { view: "registration", animation: "fade" });
    rooms.push(room);
    this.write(rooms);
    this.notify(room);
    return this.publicRoom(room);
  }

  getPlayer(room, token) {
    const player = room.players.find((item) => item.token === token);
    if (!player) throw new Error("This browser is not registered in that Party room.");
    return player;
  }

  getPrimary(room, token) {
    const player = this.getPlayer(room, token);
    if (!player.primary) throw new Error("Only the primary player can configure this game.");
    return player;
  }

  join(code, input = {}) {
    const rooms = this.read();
    const room = this.room(code, rooms);
    if (!room) throw new Error("Party room not found. Open it on the primary display first.");
    this.tickRoom(room, rooms);
    if (room.status !== "registration") throw new Error("The player count is locked; nobody else can join.");
    if (room.players.length >= 4) throw new Error("This party already has four human players.");
    const characterId = clean(input.characterId, "", 20).toLowerCase();
    if (!CHARACTERS.includes(characterId)) throw new Error("Choose an available avatar.");
    if (room.players.some((player) => player.characterId === characterId)) throw new Error("That avatar is already taken.");
    const player = {
      id: crypto.randomUUID(),
      token: this.token(),
      nickname: clean(input.nickname, `Player ${room.players.length + 1}`),
      characterId,
      primary: room.players.length === 0,
      joinedAt: new Date(this.now()).toISOString(),
    };
    room.players.push(player);
    const displayPlayer = { ...player };
    delete displayPlayer.token;
    this.enqueue(room, "primary", "patch", { patches: [{ op: "add", path: "players", value: displayPlayer }], animation: "pop" });
    this.enqueue(room, player.id, player.primary ? "request-input" : "navigate", { view: player.primary ? "confirm-players" : "waiting-for-primary", animation: "slide" });
    if (!player.primary) {
      const primary = room.players.find((item) => item.primary);
      if (primary) this.enqueue(room, primary.id, "patch", { patches: [{ op: "add", path: "players", value: displayPlayer }], animation: "pop" });
    }
    this.event(room, "player-joined", { playerId: player.id, message: `${player.nickname} joined the party.` });
    this.save(room, rooms);
    return { token: player.token, room: this.privateRoom(room, player.token) };
  }

  confirmPlayers(code, token) {
    const rooms = this.read();
    const room = this.room(code, rooms);
    if (!room) throw new Error("Party room not found.");
    this.getPrimary(room, token);
    if (room.status !== "registration") throw new Error("The player count has already been confirmed.");
    room.status = "setup";
    room.setupStep = "ai-players";
    this.enqueue(room, "primary", "navigate", { view: "setup", setupStep: room.setupStep, animation: "slide" });
    for (const player of room.players) {
      this.enqueue(room, player.id, player.primary ? "refresh" : "navigate", { view: player.primary ? "setup" : "waiting-for-setup", setupStep: room.setupStep, animation: "slide" });
    }
    this.event(room, "players-confirmed", { message: `${room.players.length} human player${room.players.length === 1 ? "" : "s"} locked in.` });
    this.save(room, rooms);
    return this.privateRoom(room, token);
  }

  updateSetup(code, token, input = {}) {
    const rooms = this.read();
    const room = this.room(code, rooms);
    if (!room) throw new Error("Party room not found.");
    this.getPrimary(room, token);
    if (room.status !== "setup") throw new Error("The setup wizard is not active.");
    const catalog = this.catalog();
    const configuration = room.configuration;
    const patches = [];

    if (Object.hasOwn(input, "aiPlayers")) {
      if (!Array.isArray(input.aiPlayers)) throw new Error("AI players must be a list.");
      const maximum = 4 - room.players.length;
      const used = new Set(room.players.map((player) => player.characterId));
      const previousIds = new Set((configuration.aiPlayers || []).map((player) => player.characterId));
      configuration.aiPlayers = input.aiPlayers.slice(0, maximum).map((inputPlayer, index) => {
        const characterId = clean(inputPlayer.characterId, "", 20).toLowerCase();
        if (!CHARACTERS.includes(characterId) || used.has(characterId)) throw new Error("Every human and AI player needs a unique avatar.");
        used.add(characterId);
        return { id: `ai-${index + 1}`, nickname: `${CHARACTER_META.find((character) => character.id === characterId)?.name || "CPU"} CPU`, characterId };
      });
      const nextIds = new Set(configuration.aiPlayers.map((player) => player.characterId));
      for (const player of configuration.aiPlayers) if (!previousIds.has(player.characterId)) patches.push({ op: "add", path: "configuration.aiPlayers", value: player });
      for (const characterId of previousIds) if (!nextIds.has(characterId)) patches.push({ op: "remove", path: "configuration.aiPlayers", match: { characterId } });
    }
    if (Object.hasOwn(input, "rounds")) {
      const rounds = Number(input.rounds);
      if (!ROUND_OPTIONS.includes(rounds)) throw new Error("Choose one of the available round counts.");
      configuration.rounds = rounds;
      patches.push({ op: "replace", path: "configuration.rounds", value: rounds });
    }
    if (Object.hasOwn(input, "packId")) {
      if (!catalog.packs.some((item) => item.id === input.packId)) throw new Error("Mini-game set not found.");
      configuration.packId = input.packId;
      patches.push({ op: "replace", path: "configuration.packId", value: input.packId });
    }
    if (Object.hasOwn(input, "rulesetId")) {
      if (!catalog.rulesets.some((item) => item.id === input.rulesetId)) throw new Error("Ruleset not found.");
      configuration.rulesetId = input.rulesetId;
      patches.push({ op: "replace", path: "configuration.rulesetId", value: input.rulesetId });
    }
    if (Object.hasOwn(input, "aiDifficulty")) {
      if (!AI_DIFFICULTIES.includes(input.aiDifficulty)) throw new Error("AI difficulty not found.");
      configuration.aiDifficulty = input.aiDifficulty;
      patches.push({ op: "replace", path: "configuration.aiDifficulty", value: input.aiDifficulty });
    }
    if (Object.hasOwn(input, "boardId")) {
      if (!catalog.boards.some((item) => item.id === input.boardId)) throw new Error("Board not found.");
      configuration.boardId = input.boardId;
      patches.push({ op: "replace", path: "configuration.boardId", value: input.boardId });
    }
    if (Object.hasOwn(input, "setupStep")) {
      if (!SETUP_STEPS.includes(input.setupStep)) throw new Error("Setup step not found.");
      room.setupStep = input.setupStep;
      patches.push({ op: "replace", path: "setupStep", value: input.setupStep });
    }

    if (patches.length) this.enqueue(room, "primary", "patch", { patches, animation: "highlight" });
    const primary = room.players.find((player) => player.primary);
    if (primary && Object.hasOwn(input, "setupStep")) this.enqueue(room, primary.id, "request-input", { view: "setup", setupStep: room.setupStep, animation: "slide" });

    this.event(room, "setup-updated", { setupStep: room.setupStep, message: "The primary player updated the setup." });
    this.save(room, rooms);
    return this.privateRoom(room, token);
  }

  confirmSetup(code, token) {
    const rooms = this.read();
    const room = this.room(code, rooms);
    if (!room) throw new Error("Party room not found.");
    this.getPrimary(room, token);
    if (room.status !== "setup") throw new Error("This room cannot start now.");
    const configuration = room.configuration;
    const complete = Array.isArray(configuration.aiPlayers)
      && ROUND_OPTIONS.includes(configuration.rounds)
      && configuration.packId
      && configuration.rulesetId
      && AI_DIFFICULTIES.includes(configuration.aiDifficulty)
      && configuration.boardId;
    if (!complete) throw new Error("Complete every setup step before starting the game.");
    room.status = "countdown";
    room.setupStep = "complete";
    room.countdownEndsAt = this.now() + 5_000;
    this.enqueue(room, "primary", "navigate", { view: "countdown", countdownEndsAt: room.countdownEndsAt, animation: "zoom" });
    this.enqueuePlayers(room, "navigate", { view: "countdown", countdownEndsAt: room.countdownEndsAt, animation: "zoom" });
    this.event(room, "countdown-started", { message: "Game starting in five seconds." });
    this.save(room, rooms);
    return this.privateRoom(room, token);
  }

  lightweightChallenges() {
    if (this.challengeCache && this.now() - this.challengeCachedAt < 5_000) return this.challengeCache;
    const directory = this.partyStore.challengePath;
    const files = fs.readdirSync(directory).filter((file) => file.endsWith(".neschallenge")).sort();
    this.challengeCache = files.flatMap((file) => {
      try {
        const fullPath = path.join(directory, file);
        const stat = fs.statSync(fullPath);
        const length = Math.min(stat.size, 96 * 1024);
        const headLength = Math.min(stat.size, 8 * 1024);
        const descriptor = fs.openSync(fullPath, "r");
        const buffer = Buffer.alloc(length);
        const headBuffer = Buffer.alloc(headLength);
        fs.readSync(descriptor, headBuffer, 0, headLength, 0);
        fs.readSync(descriptor, buffer, 0, length, stat.size - length);
        fs.closeSync(descriptor);
        const tail = `${headBuffer.toString("utf8")}\n${buffer.toString("utf8")}`;
        const stringField = (name, fallback) => {
          const matches = [...tail.matchAll(new RegExp(`"${name}"\\s*:\\s*"((?:\\\\.|[^"\\\\])*)"`, "g"))];
          return matches.length ? jsonString(matches.at(-1)[1], fallback) : fallback;
        };
        const numberField = (name, fallback) => {
          const matches = [...tail.matchAll(new RegExp(`"${name}"\\s*:\\s*(\\d+)`, "g"))];
          return matches.length ? Number(matches.at(-1)[1]) : fallback;
        };
        const id = file.replace(/\.neschallenge$/, "");
        const gameName = stringField("gameName", "NES Game");
        const game = this.partyStore.gameResolver ? this.partyStore.gameResolver(stringField("sha256", "")) : null;
        return [{
          id,
          title: stringField("title", id.replace(/-/g, " ")),
          instructions: stringField("instructions", "Complete the challenge!"),
          category: stringField("category", "Skill"),
          difficulty: stringField("difficulty", "Medium"),
          playerCount: numberField("playerCount", 1),
          gameName,
          boxArt: game?.boxArt || null,
        }];
      } catch {
        return [];
      }
    });
    this.challengeCachedAt = this.now();
    return this.challengeCache;
  }

  queueGame(room, type, payload = {}, options = {}) {
    room.gameQueue ||= { sequence: 0, pending: [], active: [], history: [] };
    const item = {
      id: ++room.gameQueue.sequence,
      type,
      payload,
      status: "pending",
      duration: Math.max(0, Number(options.duration) || 0),
      startsEarly: Math.max(0, Number(options.startsEarly) || 0),
      blocking: options.blocking !== false,
      barrier: Boolean(options.barrier),
      banner: Boolean(options.banner),
      resources: Array.isArray(options.resources) ? options.resources : [],
      source: options.source || "classic-director",
      queuedAt: this.now(),
    };
    room.gameQueue.pending.push(item);
    return item;
  }

  gameRoster(room) {
    return [
      ...room.players.map((player) => ({ id: player.id, nickname: player.nickname, characterId: player.characterId, kind: "human" })),
      ...(room.configuration.aiPlayers || []).map((player) => ({ ...player, kind: "ai" })),
    ];
  }

  initializeGame(room) {
    const catalog = this.catalog();
    const board = catalog.boards.find((item) => item.id === room.configuration.boardId) || catalog.boards[0];
    const rules = catalog.rulesets.find((item) => item.id === room.configuration.rulesetId) || catalog.rulesets[0];
    const roster = this.gameRoster(room);
    room.game = {
      status: "playing",
      round: 1,
      totalRounds: room.configuration.rounds,
      currentPlayerIndex: 0,
      boardId: board.id,
      starPosition: board.starSpots?.[0] ?? 0,
      starCost: Math.max(1, Number(board.starCost) || 20),
      lastRoll: null,
      players: roster.map((player) => ({ ...player, position: 0, coins: Number(rules.startingCoins) || 10, stars: 0 })),
      winnerIds: [],
      triggerLedger: [],
      startedAt: this.now(),
    };
    room.gameQueue = { sequence: 0, pending: [], active: [], history: [] };
    room.status = "playing";
    room.roulette = null;
    room.minigame = null;
    room.summary = null;
    this.enqueue(room, "primary", "refresh", { view: "board", animation: "zoom" });
    this.enqueuePlayers(room, "refresh", { view: "waiting-turn", animation: "fade" });
    this.queueBoardTriggers(room, "game-start", 0);
    this.scheduleTurn(room);
  }

  scheduleTurn(room) {
    const player = room.game.players[room.game.currentPlayerIndex];
    if (room.game.currentPlayerIndex === 0) this.queueBoardTriggers(room, "round", room.game.currentPlayerIndex);
    this.queueBoardTriggers(room, "turn", room.game.currentPlayerIndex);
    this.queueGame(room, "turn-banner", { playerId: player.id, playerIndex: room.game.currentPlayerIndex, message: `${player.nickname}'s turn!` }, { duration: 1_250, banner: true, resources: ["ui"] });
    this.queueGame(room, "request-roll", { playerId: player.id, playerIndex: room.game.currentPlayerIndex }, { barrier: true, resources: ["input"] });
  }

  canStartEarly(item, active) {
    if (!active.length || !item.startsEarly) return false;
    if (active.some((entry) => entry.barrier || !entry.endsAt || this.now() < entry.endsAt - item.startsEarly)) return false;
    const busy = new Set(active.flatMap((entry) => entry.resources));
    return !item.resources.some((resource) => busy.has(resource));
  }

  startGameItem(room, item) {
    item.status = "active";
    item.startedAt = this.now();
    item.endsAt = item.duration ? item.startedAt + item.duration : null;
    room.gameQueue.active.push(item);
    const gamePlayer = room.game?.players?.find((player) => player.id === item.payload.playerId);
    if (item.banner) this.enqueue(room, "primary", "game-event", { event: item.type, itemId: item.id, ...item.payload, banner: true, duration: item.duration, startsEarly: item.startsEarly });

    if (item.type === "turn-banner") {
      room.status = "playing";
      this.enqueue(room, "primary", "navigate", { view: "board" });
    } else if (item.type === "request-roll") {
      if (gamePlayer?.kind === "human") {
        this.enqueue(room, gamePlayer.id, "request-input", { view: "roll", round: room.game.round });
        for (const player of room.players.filter((player) => player.id !== gamePlayer.id)) this.enqueue(room, player.id, "navigate", { view: "waiting-turn" });
      } else {
        item.barrier = false;
        item.duration = 900;
        item.endsAt = item.startedAt + item.duration;
      }
    } else if (item.type === "roll-reveal") {
      room.game.lastRoll = item.payload.roll;
    } else if (item.type === "move-space") {
      this.enqueue(room, "primary", "animate", { animation: "move-player", ...item.payload, duration: item.duration });
    } else if (item.type === "event-effect") {
      this.enqueue(room, "primary", "animate", { animation: `event-${item.payload.effect}`, ...item.payload, duration: item.duration });
    } else if (item.type === "roulette") {
      room.status = "roulette";
      this.enqueue(room, "primary", "navigate", { view: "roulette" });
      this.enqueuePlayers(room, "navigate", { view: "roulette-wait" });
    } else if (item.type === "minigame") {
      room.status = "minigame";
      this.enqueue(room, "primary", "navigate", { view: "minigame" });
      for (const player of room.players) this.enqueue(room, player.id, "request-input", { view: "minigame" });
    } else if (item.type === "minigame-results") {
      room.status = "results";
      this.enqueue(room, "primary", "navigate", { view: "results" });
      this.enqueuePlayers(room, "navigate", { view: "results" });
    } else if (item.type === "scene-clip") {
      this.enqueue(room, "primary", "animate", { animation: `scene-${item.payload.track}`, ...item.payload, duration: item.duration, startsEarly: item.startsEarly });
    } else if (item.type.startsWith("demo-")) {
      room.status = "demo";
      this.enqueue(room, "primary", "animate", { animation: item.type, ...item.payload, duration: item.duration, startsEarly: item.startsEarly });
      if (item.type === "demo-button-mash") room.demo.inputEndsAt = item.endsAt;
    }
  }

  completeGameItem(room, item) {
    item.status = "complete";
    item.completedAt = this.now();
    if (item.type === "request-roll" && room.game.players[item.payload.playerIndex]?.kind === "ai") {
      this.performRoll(room, item.payload.playerIndex);
    } else if (item.type === "move-space") {
      room.game.players[item.payload.playerIndex].position = item.payload.to;
    } else if (item.type === "resolve-land") {
      this.resolveLanding(room, item.payload.playerIndex);
    } else if (item.type === "turn-end") {
      this.advanceAfterTurn(room);
    } else if (item.type === "roulette") {
      this.beginMinigame(room);
    } else if (item.type === "minigame-results") {
      this.advanceAfterMinigame(room);
    } else if (item.type === "scene-clip") {
      const coins = String(item.payload.label || "").match(/^\+(\d+)\s+COINS/i);
      const player = room.game.players[item.payload.playerIndex];
      if (coins && player) player.coins += Number(coins[1]);
    } else if (item.type === "event-effect") {
      const player = room.game.players[item.payload.playerIndex];
      if (player && item.payload.effect === "coins") player.coins = Math.max(0, player.coins + Number(item.payload.amount || 0));
      if (player && item.payload.effect === "item") { player.items ||= []; player.items.push(item.payload.item || "party-item"); }
      if (player && item.payload.effect === "move") {
        const board = this.catalog().boards.find((entry) => entry.id === room.game.boardId) || this.catalog().boards[0];
        player.position = (player.position + Number(item.payload.amount || 0) + board.spaces.length) % board.spaces.length;
      }
    } else if (item.type === "demo-button-mash") {
      const winner = room.game.players[0];
      winner.coins += 20;
      room.demo.winnerId = winner.id;
    } else if (item.type === "demo-complete") {
      room.status = "demo-complete";
      this.enqueue(room, "primary", "navigate", { view: "demo-complete" });
    }
    room.gameQueue.history.push(item);
    room.gameQueue.history = room.gameQueue.history.slice(-GAME_QUEUE_HISTORY_LIMIT);
  }

  processGameQueue(room) {
    if (!room.gameQueue) return false;
    let changed = false;
    for (const item of [...room.gameQueue.active]) {
      if (item.status === "complete" || (item.endsAt && this.now() >= item.endsAt)) {
        this.completeGameItem(room, item);
        room.gameQueue.active = room.gameQueue.active.filter((entry) => entry.id !== item.id);
        changed = true;
      }
    }
    let guard = 0;
    while (room.gameQueue.pending.length && guard++ < 20) {
      const next = room.gameQueue.pending[0];
      const canStart = !room.gameQueue.active.some((item) => item.blocking) || this.canStartEarly(next, room.gameQueue.active);
      if (!canStart) break;
      room.gameQueue.pending.shift();
      this.startGameItem(room, next);
      changed = true;
      if (next.blocking && !next.startsEarly) break;
    }
    return changed;
  }

  performRoll(room, playerIndex) {
    const board = this.catalog().boards.find((item) => item.id === room.game.boardId) || this.catalog().boards[0];
    const player = room.game.players[playerIndex];
    const roll = this.randomInt(1, 7);
    const movement = Array.from({ length: roll }, (_, index) => (player.position + index + 1) % board.spaces.length);
    this.queueGame(room, "roll-reveal", { playerId: player.id, playerIndex, roll }, { duration: 900, banner: true, resources: ["ui", `player:${player.id}`] });
    movement.forEach((to, step) => {
      this.queueGame(room, "move-space", { playerId: player.id, playerIndex, to, step: step + 1, total: movement.length }, { duration: 430, resources: [`player:${player.id}`, "camera"] });
      if (step < movement.length - 1) this.queueBoardTriggers(room, "pass", playerIndex, board.spaces[to]?.id);
      this.queueBoardTriggers(room, "proximity", playerIndex, board.spaces[to]?.id);
    });
    this.queueGame(room, "resolve-land", { playerId: player.id, playerIndex }, { duration: 700, resources: ["ui", `player:${player.id}`] });
    this.queueGame(room, "turn-end", { playerId: player.id, playerIndex }, { duration: 300 });
  }

  queueStudioScene(room, playerIndex, sceneId = null) {
    const scenes = this.studioStore?.get()?.scenes?.entries || [];
    const scene = scenes.find((entry) => entry.id === sceneId) || scenes[0];
    if (!scene?.clips?.length) return false;
    const player = room.game.players[playerIndex];
    let previousEnd = 0;
    for (const clip of [...scene.clips].sort((a, b) => Number(a.start) - Number(b.start))) {
      const start = Math.max(0, Number(clip.start) || 0);
      const duration = Math.max(.1, Number(clip.duration) || .1);
      this.queueGame(room, "scene-clip", {
        sceneId: scene.id, sceneName: scene.name, clipId: clip.id,
        label: clip.label, track: clip.track, playerId: player.id, playerIndex,
      }, {
        duration: duration * 1_000,
        startsEarly: Math.max(0, previousEnd - start) * 1_000,
        barrier: Boolean(clip.barrier),
        resources: Array.isArray(clip.resources) ? clip.resources : [],
        source: `studio-scene:${scene.id}`,
      });
      previousEnd = Math.max(previousEnd, start + duration);
    }
    return true;
  }

  queueEventCommands(room, event, playerIndex) {
    const player = room.game.players[playerIndex];
    let blockedDepth = null;
    for (const command of event.commands || []) {
      const depth = Math.max(0, Number(command.depth) || 0);
      if (blockedDepth != null && depth > blockedDepth) continue;
      if (blockedDepth != null && depth <= blockedDepth) blockedDepth = null;
      if (command.kind === "condition") {
        const amount = Math.max(0, Math.abs(Number(command.amount) || 10));
        const passed = command.op === "final-round" ? room.game.round === room.game.totalRounds
          : command.op === "has-item" ? Boolean(player.items?.length)
            : player.coins >= amount;
        if (!passed) blockedDepth = depth;
        continue;
      }
      if (command.kind === "scene") { this.queueStudioScene(room, playerIndex, command.sceneId); continue; }
      if (command.kind === "player") {
        if (command.op === "give-item") this.queueGame(room, "event-effect", { playerId: player.id, playerIndex, effect: "item", item: "trail-charm", label: command.label }, { duration: 650, resources: [`player:${player.id}`], source: `event:${event.id}` });
        else this.queueGame(room, "event-effect", { playerId: player.id, playerIndex, effect: "coins", amount: Number(command.amount) || 10, label: command.label }, { duration: 650, resources: [`player:${player.id}`, "ui"], source: `event:${event.id}` });
        continue;
      }
      if (command.kind === "action" && command.op === "move") {
        this.queueGame(room, "event-effect", { playerId: player.id, playerIndex, effect: "move", amount: Number(command.amount) || 3, label: command.label }, { duration: 700, resources: [`player:${player.id}`, "camera"], source: `event:${event.id}` });
        continue;
      }
      if (command.kind === "random") {
        const amount = this.randomInt(0, 2) ? 5 : -5;
        this.queueGame(room, "event-effect", { playerId: player.id, playerIndex, effect: "coins", amount, label: amount > 0 ? "LUCKY FLIP +5" : "UNLUCKY FLIP −5" }, { duration: 750, resources: [`player:${player.id}`, "ui"], source: `event:${event.id}` });
      }
    }
  }

  queueBoardEvent(room, event, playerIndex, marker = null, phase = "event") {
    const player = room.game.players[playerIndex] || room.game.players[0];
    if (!event || !player) return false;
    this.queueGame(room, "board-event", { playerId: player.id, playerIndex: room.game.players.indexOf(player), eventId: event.id, triggerId: marker?.id || null, icon: "⚡", title: event.name, message: event.message || `${event.name} triggered!`, phase }, { duration: 1_500, banner: true, resources: ["ui", "camera"], source: `studio-event:${event.id}` });
    this.queueEventCommands(room, event, room.game.players.indexOf(player));
    return true;
  }

  queueBoardTriggers(room, phase, playerIndex, spaceId = null) {
    const board = this.catalog().boards.find((entry) => entry.id === room.game.boardId) || this.catalog().boards[0];
    const events = Array.isArray(board.events) ? board.events : [];
    const markers = Array.isArray(board.triggers) ? board.triggers : [];
    const player = room.game.players[playerIndex] || room.game.players[0];
    const space = spaceId == null ? null : board.spaces.find((entry) => Number(entry.id) === Number(spaceId));
    room.game.triggerLedger ||= [];
    const fire = (event, marker = null) => {
      const key = `${room.game.round}:${room.game.currentPlayerIndex}:${phase}:${event.id}:${marker?.id || "global"}`;
      if (room.game.triggerLedger.includes(key)) return;
      room.game.triggerLedger.push(key); room.game.triggerLedger = room.game.triggerLedger.slice(-200);
      this.queueBoardEvent(room, event, playerIndex, marker, phase);
    };
    for (const event of events) {
      const trigger = event.trigger && typeof event.trigger === "object" ? event.trigger : { kind: "land" };
      if (["game-start", "before-minigame", "after-minigame"].includes(phase) && trigger.kind === phase) fire(event);
      else if (phase === "round" && trigger.kind === "round" && room.game.round === Math.max(1, Number(trigger.round) || 1)) fire(event);
      else if (phase === "turn" && trigger.kind === "turn" && room.game.currentPlayerIndex + 1 === Math.max(1, Number(trigger.turn) || 1)) fire(event);
      else if (["land", "pass", "proximity"].includes(phase)) for (const marker of markers.filter((entry) => entry.eventId === event.id)) {
        if (trigger.kind === phase && phase !== "proximity" && Number(marker.spaceId) === Number(spaceId)) fire(event, marker);
        if (trigger.kind === "proximity" && space) {
          const distance = Math.hypot(Number(marker.x) - Number(space.x), Number(marker.y) - Number(space.y));
          if (distance <= Math.max(1, Number(marker.radius) || Number(trigger.radius) || 10)) fire(event, marker);
        }
      }
    }
  }

  roll(code, token) {
    const rooms = this.read();
    const room = this.room(code, rooms);
    if (!room || room.status !== "playing") throw new Error("It is not time to roll.");
    const player = this.getPlayer(room, token);
    const request = room.gameQueue?.active.find((item) => item.type === "request-roll" && item.payload.playerId === player.id);
    if (!request) throw new Error("Wait for your turn to roll.");
    request.status = "complete";
    this.performRoll(room, request.payload.playerIndex);
    this.enqueue(room, player.id, "navigate", { view: "waiting-turn" });
    this.save(room, rooms);
    return this.privateRoom(room, token);
  }

  resolveLanding(room, playerIndex) {
    const catalog = this.catalog();
    const board = catalog.boards.find((item) => item.id === room.game.boardId) || catalog.boards[0];
    const rules = catalog.rulesets.find((item) => item.id === room.configuration.rulesetId) || catalog.rulesets[0];
    const player = room.game.players[playerIndex];
    const space = board.spaces[player.position] || board.spaces[0];
    const changes = { blue: Number(rules.blueCoins) || 3, red: Number(rules.redCoins) || -3, lucky: Number(rules.luckyCoins) || 7 };
    const activity = space.activity && typeof space.activity === "object" ? space.activity : null;
    const effects = Array.isArray(activity?.effects) ? activity.effects : [];
    const activityCoins = effects.filter((effect) => effect.op === "coins").reduce((total, effect) => total + Number(effect.amount || 0), 0);
    const moveEffect = effects.find((effect) => effect.op === "move");
    const coinChange = (changes[space.type] || 0) + activityCoins;
    player.coins = Math.max(0, player.coins + coinChange);
    let starChange = 0;
    if (player.position === room.game.starPosition && player.coins >= room.game.starCost) {
      player.coins -= room.game.starCost;
      player.stars += 1;
      starChange = 1;
      const spots = board.starSpots?.length ? board.starSpots : [0];
      room.game.starPosition = spots[(Math.max(0, spots.indexOf(room.game.starPosition)) + 1) % spots.length];
    }
    this.enqueue(room, "primary", "game-event", { event: "land-result", playerId: player.id, playerIndex, spaceType: space.type, coinChange, starChange, banner: true, message: starChange ? `${player.nickname} bought a Star!` : coinChange ? `${player.nickname} ${coinChange > 0 ? "gained" : "lost"} ${Math.abs(coinChange)} coins.` : `${player.nickname} landed safely.` });
    const turnEndIndex = room.gameQueue.pending.findIndex((item) => item.type === "turn-end" && item.payload.playerIndex === playerIndex);
    const turnEnd = turnEndIndex >= 0 ? room.gameQueue.pending.splice(turnEndIndex, 1)[0] : null;
    if (activity) {
      this.queueGame(room, "board-event", { playerId: player.id, playerIndex, activityId: activity.id, icon: activity.icon, title: activity.title, message: activity.message }, { duration: 1_900, banner: true, resources: ["ui", "camera"], source: `board:${board.id}` });
      if (moveEffect) {
        const amount = Number(moveEffect.amount || 0);
        const to = (player.position + amount + board.spaces.length) % board.spaces.length;
        this.queueGame(room, "move-space", { playerId: player.id, playerIndex, from: player.position, to, total: Math.abs(amount), activityId: activity.id }, { duration: 700, resources: [`player:${player.id}`, "camera"], source: `board:${board.id}` });
      }
    } else if (space.type === "event") {
      this.queueStudioScene(room, playerIndex);
    }
    this.queueBoardTriggers(room, "land", playerIndex, space.id);
    if (turnEnd) room.gameQueue.pending.push(turnEnd);
  }

  advanceAfterTurn(room) {
    if (room.game.currentPlayerIndex < room.game.players.length - 1) {
      room.game.currentPlayerIndex += 1;
      this.scheduleTurn(room);
      return;
    }
    this.beginRoulette(room);
  }

  beginRoulette(room) {
    this.queueBoardTriggers(room, "before-minigame", room.game.currentPlayerIndex);
    const challenges = this.lightweightChallenges();
    if (!challenges.length) {
      room.summary = { winnerName: null, results: [] };
      this.queueGame(room, "minigame-results", {}, { duration: 1_200 });
      return;
    }
    const options = Array.from({ length: 6 }, () => challenges[this.randomInt(0, challenges.length)]);
    const selectedIndex = this.randomInt(0, options.length);
    room.roulette = { options, selectedIndex, selected: options[selectedIndex] };
    this.queueGame(room, "roulette", { selectedIndex }, { duration: 6_200, resources: ["ui", "camera"] });
  }

  beginMinigame(room) {
    const difficultyChance = { easy: 78, normal: 55, hard: 32 }[room.configuration.aiDifficulty] || 55;
    room.minigame = {
      challenge: room.roulette.selected,
      players: room.game.players.map((player) => ({ playerId: player.id, nickname: player.nickname, kind: player.kind, started: player.kind === "ai", completed: false, result: null, resolveAt: player.kind === "ai" ? this.now() + this.randomInt(1_800, 4_200) : null, winChance: difficultyChance })),
    };
    this.queueGame(room, "minigame", { challengeId: room.minigame.challenge.id }, { barrier: true, resources: ["input", "ui"] });
  }

  startMinigame(code, token) {
    const rooms = this.read();
    const room = this.room(code, rooms);
    const player = this.getPlayer(room, token);
    if (room.status !== "minigame") throw new Error("The mini-game is not ready.");
    const entry = room.minigame.players.find((item) => item.playerId === player.id);
    if (!entry) throw new Error("This player is not in the mini-game.");
    entry.started = true;
    entry.startedAt = this.now();
    this.save(room, rooms);
    return this.privateRoom(room, token);
  }

  submitResult(code, token, input = {}) {
    const rooms = this.read();
    const room = this.room(code, rooms);
    const player = this.getPlayer(room, token);
    if (room.status !== "minigame") throw new Error("The mini-game is not accepting results.");
    const entry = room.minigame.players.find((item) => item.playerId === player.id);
    if (!entry?.started) throw new Error("Press Start before submitting a result.");
    entry.completed = true;
    entry.result = { completed: input.completed !== false, score: Number.isFinite(Number(input.score)) ? Number(input.score) : 0, submittedAt: this.now() };
    this.maybeFinishMinigame(room);
    this.save(room, rooms);
    return this.privateRoom(room, token);
  }

  maybeFinishMinigame(room) {
    if (!room.minigame?.players.length || !room.minigame.players.every((item) => item.completed)) return false;
    const ranked = [...room.minigame.players].sort((a, b) => Number(b.result?.completed) - Number(a.result?.completed) || Number(b.result?.score || 0) - Number(a.result?.score || 0));
    const winnerEntry = ranked[0];
    const winner = room.game.players.find((player) => player.id === winnerEntry.playerId);
    if (winnerEntry.result?.completed && winner) winner.coins += 10;
    room.summary = { winnerPlayerId: winnerEntry.result?.completed ? winner?.id : null, winnerName: winnerEntry.result?.completed ? winner?.nickname : null, challenge: room.minigame.challenge, results: ranked };
    const barrier = room.gameQueue.active.find((item) => item.type === "minigame");
    if (barrier) barrier.status = "complete";
    this.queueGame(room, "minigame-results", {}, { duration: 3_000, resources: ["ui"] });
    return true;
  }

  advanceAfterMinigame(room) {
    this.queueBoardTriggers(room, "after-minigame", room.game.currentPlayerIndex);
    room.minigame = null;
    room.roulette = null;
    room.summary ||= null;
    room.game.round += 1;
    if (room.game.round > room.game.totalRounds) {
      const ranked = [...room.game.players].sort((a, b) => b.stars - a.stars || b.coins - a.coins);
      const best = ranked[0];
      room.game.status = "complete";
      room.game.winnerIds = ranked.filter((player) => player.stars === best.stars && player.coins === best.coins).map((player) => player.id);
      room.status = "complete";
      this.enqueue(room, "primary", "navigate", { view: "final-results" });
      this.enqueuePlayers(room, "navigate", { view: "final-results" });
      return;
    }
    room.summary = null;
    room.game.currentPlayerIndex = 0;
    if (room.game.totalRounds - room.game.round + 1 === 5) this.queueGame(room, "final-five-announcement", { message: "Final five rounds!" }, { duration: 2_200, banner: true, resources: ["ui"] });
    this.scheduleTurn(room);
  }

  startDemo(code) {
    const rooms = this.read();
    let room = this.room(code, rooms);
    if (!room) { this.create(code); room = this.room(code, rooms); }
    const board = this.catalog().boards[0];
    room.configuration = { aiPlayers: [], rounds: 5, packId: this.catalog().packs[0]?.id, rulesetId: this.catalog().rulesets[0]?.id, aiDifficulty: "normal", boardId: board.id };
    room.game = {
      status: "demo", round: 1, totalRounds: 5, currentPlayerIndex: 0, boardId: board.id,
      starPosition: board.starSpots?.[0] ?? 0, starCost: 20,
      players: [
        { id: "demo-nova", nickname: "Nova", characterId: "nova", kind: "ai", position: 8, coins: 10, stars: 0 },
        { id: "demo-luna", nickname: "Luna", characterId: "luna", kind: "ai", position: 14, coins: 10, stars: 0 },
      ], winnerIds: [],
    };
    room.gameQueue = { sequence: 0, pending: [], active: [], history: [] };
    room.demo = { title: "Ghost Challenge", participants: ["demo-nova", "demo-luna"], winnerId: null, inputEndsAt: null };
    room.status = "demo";
    room.queues.primary = [];
    this.enqueue(room, "primary", "navigate", { view: "demo" });
    this.queueGame(room, "demo-title", { message: "HAUNTED HARBOR" }, { duration: 1_400, resources: ["ui"] , source: "ghost-challenge"});
    this.queueGame(room, "demo-gather", { participants: room.demo.participants, location: "Ghost Stage" }, { duration: 1_400, resources: ["player:demo-nova", "player:demo-luna"], source: "ghost-challenge" });
    this.queueGame(room, "demo-ghost-appear", {}, { duration: 1_600, resources: ["ghost"], source: "ghost-challenge" });
    this.queueGame(room, "demo-fog-burst", {}, { duration: 1_000, startsEarly: 1_100, resources: ["effects"], source: "ghost-challenge" });
    this.queueGame(room, "demo-dialogue", { message: "You two look particularly stealable today." }, { duration: 2_400, startsEarly: 500, resources: ["ui"], source: "ghost-challenge" });
    this.queueGame(room, "demo-button-mash", { button: "A", participants: room.demo.participants }, { duration: 5_000, barrier: true, resources: ["input"], source: "ghost-challenge" });
    this.queueGame(room, "demo-reward", { coins: 20 }, { duration: 1_500, resources: ["ui"], source: "ghost-challenge" });
    this.queueGame(room, "demo-restore", {}, { duration: 1_200, resources: ["player:demo-nova", "player:demo-luna"], source: "ghost-challenge" });
    this.queueGame(room, "demo-complete", {}, { duration: 600, source: "ghost-challenge" });
    this.event(room, "demo-started", { message: "Ghost Challenge queue demo started." });
    this.save(room, rooms);
    return this.publicRoom(room);
  }

  tickRoom(room, rooms = this.read()) {
    if (room.status === "countdown" && Number(room.countdownEndsAt) <= this.now()) {
      this.initializeGame(room);
      this.event(room, "game-started", { message: "The Party game is ready." });
      this.save(room, rooms);
      return room;
    }
    let changed = false;
    if (room.status === "minigame" && room.minigame) {
      for (const entry of room.minigame.players.filter((item) => item.kind === "ai" && !item.completed && this.now() >= item.resolveAt)) {
        const completed = this.randomInt(0, 100) < entry.winChance;
        entry.completed = true;
        entry.result = { completed, score: completed ? 100_000 - this.randomInt(100, 1_000) : 0, submittedAt: this.now() };
        changed = true;
      }
      if (this.maybeFinishMinigame(room)) changed = true;
    }
    if (["playing", "roulette", "minigame", "results", "demo"].includes(room.status) && this.processGameQueue(room)) changed = true;
    if (changed) this.save(room, rooms);
    return room;
  }

  tickCountdowns() {
    const rooms = this.read();
    for (const room of rooms) this.tickRoom(room, rooms);
  }

  acknowledgePrimary(code, ids = []) {
    const rooms = this.read();
    const room = this.room(code, rooms);
    if (!room) throw new Error("Party room not found.");
    const acknowledged = new Set(ids.map(Number));
    const queues = this.ensureQueues(room);
    queues.primary = queues.primary.filter((item) => !acknowledged.has(item.id));
    this.save(room, rooms, { bumpVersion: false, touch: false, notify: false });
    return { ok: true };
  }

  acknowledgePlayer(code, token, ids = []) {
    const rooms = this.read();
    const room = this.room(code, rooms);
    if (!room) throw new Error("Party room not found.");
    const player = this.getPlayer(room, token);
    const acknowledged = new Set(ids.map(Number));
    const queues = this.ensureQueues(room);
    queues.players[player.id] = (queues.players[player.id] || []).filter((item) => !acknowledged.has(item.id));
    this.save(room, rooms, { bumpVersion: false, touch: false, notify: false });
    return { ok: true };
  }

  catalog() {
    if (this.catalogCache && this.now() - this.catalogCachedAt < 5_000) return this.catalogCache;
    // Party setup only needs metadata. partyStore.catalog() also parses every
    // large .neschallenge payload, which is deliberately excluded from this hot path.
    const boards = this.partyStore.readCollection("boards");
    const packs = this.partyStore.readCollection("packs");
    const rulesets = this.partyStore.readCollection("rulesets");
    this.catalogCache = {
      characters: CHARACTER_META,
      rounds: ROUND_OPTIONS,
      aiDifficulties: AI_DIFFICULTIES.map((id) => ({ id, name: id[0].toUpperCase() + id.slice(1) })),
      boards: boards.map(({ id, name, description, difficulty, image, spaces, paths, starSpots, starCost, landmarks, triggers, events, objects, regions, spawns, cameras }) => ({ id, name, description, difficulty, image, spaces, paths, starSpots, starCost, landmarks, triggers, events, objects, regions, spawns, cameras })),
      packs: packs.map(({ id, name, description }) => ({ id, name, description })),
      rulesets: rulesets.map(({ id, name, description, startingCoins, minigameEvery, blueCoins, redCoins, luckyCoins, winCondition }) => ({ id, name, description, startingCoins, minigameEvery, blueCoins, redCoins, luckyCoins, winCondition })),
    };
    this.catalogCachedAt = this.now();
    return this.catalogCache;
  }

  publicRoom(input) {
    this.normalizeRoom(input);
    const { queues, ...roomData } = input;
    const room = clone(roomData);
    room.queue = clone(queues?.primary || []);
    room.players = room.players.map(({ token, ...player }) => player);
    room.catalog = this.catalog();
    return room;
  }

  privateRoom(input, token) {
    const room = this.publicRoom(input);
    const source = input.players.find((player) => player.token === token);
    room.self = source ? room.players.find((player) => player.id === source.id) : null;
    room.queue = source ? clone(this.ensureQueues(input).players[source.id] || []) : [];
    return room;
  }

  getPublic(code) {
    const rooms = this.read();
    const room = this.room(code, rooms);
    if (!room) throw new Error("Party room not found.");
    return this.publicRoom(this.tickRoom(room, rooms));
  }

  getPrivate(code, token) {
    const rooms = this.read();
    const room = this.room(code, rooms);
    if (!room) throw new Error("Party room not found.");
    this.tickRoom(room, rooms);
    this.getPlayer(room, token);
    return this.privateRoom(room, token);
  }
}
