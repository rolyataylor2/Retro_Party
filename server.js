import fs from "node:fs";
import http from "node:http";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";
import { WebSocketServer, WebSocket } from "ws";

import { GameLibrary } from "./lib/game-library.js";
import { ModifierLibrary } from "./lib/modifier-library.js";
import { PartyStore } from "./lib/party-store.js";
import { PartyStudioStore } from "./lib/party-studio-store.js";
import { PartyV2RoomStore } from "./lib/party-v2-room-store.js";
import { TasLibrary } from "./lib/tas-library.js";

const root = path.dirname(fileURLToPath(import.meta.url));
const publicPath = path.join(root, "public");
const gameLibrary = new GameLibrary(root);
const modifierLibrary = new ModifierLibrary(root);
const tasLibrary = new TasLibrary(root);
const initialGames = gameLibrary.scan();
if (!initialGames.length) throw new Error("No supported ROMs were found in the roms folder");
const partyStore = new PartyStore(root, {
  gameResolver: (sha256) => gameLibrary.gameByHash(sha256),
  extraPacks: (challenges) => gameLibrary.smartPacks(challenges),
});
const partyStudio = new PartyStudioStore(root, partyStore);
const partyV2Rooms = new PartyV2RoomStore(root, partyStore, { studioStore: partyStudio });

const DEFAULT_CONTROLS = {
  keyboard: { b: "z", a: "x", select: "shift", start: "enter", up: "arrowup", down: "arrowdown", left: "arrowleft", right: "arrowright", saveState: "p", rewind: "backspace", creator: "c", success: "q", failure: "r", exit: "escape" },
  gamepad: { b: 1, a: 0, select: 8, start: 9, up: 12, down: 13, left: 14, right: 15, saveState: 3, rewind: 2, creator: 10, success: 4, failure: 5, exit: 11 },
};
const controlsFile = path.join(root, "data", "controls.json");

function controls() {
  try {
    if (fs.existsSync(controlsFile)) return JSON.parse(fs.readFileSync(controlsFile, "utf8"));
  } catch {}
  return DEFAULT_CONTROLS;
}

function saveControls(data) {
  const current = controls();
  const next = {
    keyboard: { ...current.keyboard, ...(data?.keyboard || {}) },
    gamepad: { ...current.gamepad, ...(data?.gamepad || {}) },
  };
  fs.mkdirSync(path.dirname(controlsFile), { recursive: true });
  fs.writeFileSync(controlsFile, `${JSON.stringify(next, null, 2)}\n`);
  return next;
}

function browserGame(game) {
  return { ...game, coreId: "nes", system: "nes", contentUrl: `/api/library/${game.id}/content` };
}

async function bodyJSON(request) {
  const chunks = [];
  for await (const chunk of request) chunks.push(chunk);
  if (!chunks.length) return {};
  return JSON.parse(Buffer.concat(chunks).toString("utf8"));
}

function sendJSON(response, status, data) {
  const body = JSON.stringify(data);
  response.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Content-Length": Buffer.byteLength(body),
    "Cache-Control": "no-store",
  });
  response.end(body);
}

function sendError(response, error) {
  console.error(error);
  sendJSON(response, 400, { error: error.message || String(error) });
}

function mimeType(file) {
  return ({
    ".html": "text/html; charset=utf-8",
    ".js": "text/javascript; charset=utf-8",
    ".mjs": "text/javascript; charset=utf-8",
    ".css": "text/css; charset=utf-8",
    ".png": "image/png",
    ".webp": "image/webp",
    ".svg": "image/svg+xml",
    ".ico": "image/x-icon",
    ".wasm": "application/wasm",
    ".wav": "audio/wav",
    ".mp3": "audio/mpeg",
    ".ogg": "audio/ogg",
  })[path.extname(file)] || "application/octet-stream";
}

// In-memory static asset cache to serve images, audio, and scripts with 0ms disk delay
const staticCache = new Map();

function getCachedFile(file, type) {
  const stat = fs.statSync(file);
  let entry = staticCache.get(file);
  if (!entry || entry.mtimeMs !== stat.mtimeMs) {
    const buffer = fs.readFileSync(file);
    const etag = `"${stat.size.toString(16)}-${Math.floor(stat.mtimeMs).toString(16)}"`;
    const isCompressible = /^(text\/|application\/javascript|application\/json|image\/svg\+xml)/.test(type);
    let gzippedBuffer = null;
    if (isCompressible && buffer.length > 512) {
      try {
        gzippedBuffer = zlib.gzipSync(buffer, { level: 6 });
      } catch {}
    }
    entry = {
      buffer,
      gzippedBuffer,
      stat,
      mtimeMs: stat.mtimeMs,
      mtimeUTC: stat.mtime.toUTCString(),
      etag,
      type,
    };
    if (buffer.length <= 15 * 1024 * 1024) {
      staticCache.set(file, entry);
    }
  }
  return entry;
}

function serveStatic(request, response, requestPath) {
  if (request.socket) request.socket.setNoDelay(true);

  const sharedFiles = {
    "/lib/goal-learner.js": path.join(root, "lib", "goal-learner.js"),
    "/lib/challenge-runtime.js": path.join(root, "lib", "challenge-runtime.js"),
    "/vendor/pixi.mjs": path.join(root, "node_modules", "pixi.js", "dist", "pixi.min.mjs"),
  };

  const isShared = Boolean(sharedFiles[requestPath]);
  const PAGE_MAP = {
    "/": "index.html",
    "/party": "party-studio.html",
    "/party/": "party-studio.html",
    "/mini-game-maker": "mini-game-maker.html",
    "/mini-game-maker/": "mini-game-maker.html",
    "/party/mini-games": "mini-game-maker.html",
    "/party/mini-games/": "mini-game-maker.html",
    "/party/editor/minigame": "mini-game-maker.html",
    "/party/editor/minigame/": "mini-game-maker.html",
  };

  const dynamicPage = /^\/party\/player\/[A-Za-z]{4}\/?$/.test(requestPath)
    ? "party-v2-player.html"
    : /^\/party\/[A-Za-z]{4}\/?$/.test(requestPath)
      ? "party-v2-primary.html"
      : /^\/party\/boards\/?$/.test(requestPath)
        ? "party-studio.html"
      : /^\/party\/board\/[a-z0-9-]+(?:\/editor\/(?:map|actors|scene|event|rules|data|effects|placements|test))?\/?$/.test(requestPath)
        ? "party-studio.html"
      : /^\/party\/editor\/(map|actors|scene|event|rules|data|effects|placements|test)\/?$/.test(requestPath)
        ? "party-studio.html"
      : null;

  const file = isShared
    ? sharedFiles[requestPath]
    : (() => {
        const relative = dynamicPage || PAGE_MAP[requestPath] || requestPath.slice(1);
        return path.resolve(publicPath, relative);
      })();

  if (typeof file !== "string" || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
    sendJSON(response, 404, { error: "Not found" });
    return;
  }

  if (!isShared && !file.startsWith(`${publicPath}${path.sep}`)) {
    sendJSON(response, 403, { error: "Forbidden" });
    return;
  }

  const type = mimeType(file);
  const isImmutableAsset = requestPath.startsWith("/cores/") || requestPath.startsWith("/assets/") || requestPath.startsWith("/boxart/");
  const cacheControl = (file.endsWith(".html") || file.endsWith(".js") || file.endsWith(".css"))
    ? "no-cache"
    : isImmutableAsset
    ? "public, max-age=31536000, immutable"
    : "public, max-age=86400";

  const entry = getCachedFile(file, type);
  const etag = entry.etag;

  // ETag conditional check (304 Not Modified)
  const ifNoneMatch = request.headers?.["if-none-match"];
  const ifModifiedSince = request.headers?.["if-modified-since"];
  if (ifNoneMatch === etag || (ifModifiedSince && ifModifiedSince === entry.mtimeUTC)) {
    response.writeHead(304, {
      "ETag": etag,
      "Last-Modified": entry.mtimeUTC,
      "Cache-Control": cacheControl,
    });
    response.end();
    return;
  }

  const total = entry.buffer.length;
  const range = request.headers?.range;

  if (range) {
    const parts = range.replace(/bytes=/, "").split("-");
    const start = parseInt(parts[0], 10);
    const end = parts[1] ? parseInt(parts[1], 10) : total - 1;
    if (start >= total || end >= total || start > end) {
      response.writeHead(416, { "Content-Range": `bytes */${total}` });
      response.end();
      return;
    }
    const chunksize = (end - start) + 1;
    const slice = entry.buffer.subarray(start, end + 1);
    response.writeHead(206, {
      "Content-Range": `bytes ${start}-${end}/${total}`,
      "Accept-Ranges": "bytes",
      "Content-Length": chunksize,
      "Content-Type": type,
      "ETag": etag,
      "Last-Modified": entry.mtimeUTC,
      "Cache-Control": cacheControl,
    });
    response.end(slice);
    return;
  }

  // Gzip compression for scripts, stylesheets, wasm, and text
  const acceptEncoding = request.headers?.["accept-encoding"] || "";
  if (entry.gzippedBuffer && /\bgzip\b/.test(acceptEncoding)) {
    response.writeHead(200, {
      "Content-Type": type,
      "Content-Encoding": "gzip",
      "Content-Length": entry.gzippedBuffer.length,
      "ETag": etag,
      "Last-Modified": entry.mtimeUTC,
      "Accept-Ranges": "bytes",
      "Cache-Control": cacheControl,
      "Vary": "Accept-Encoding",
    });
    response.end(entry.gzippedBuffer);
    return;
  }

  response.writeHead(200, {
    "Content-Type": type,
    "Content-Length": total,
    "ETag": etag,
    "Last-Modified": entry.mtimeUTC,
    "Accept-Ranges": "bytes",
    "Cache-Control": cacheControl,
  });
  response.end(entry.buffer);
}

async function handleAPI(request, response, url) {
  if (request.method === "GET" && url.pathname === "/api/party/studio") return sendJSON(response, 200, partyStudio.get());
  if (request.method === "POST" && url.pathname === "/api/party/studio/boards") return sendJSON(response, 201, partyStudio.createBoard(await bodyJSON(request)));
  const studioBoardMatch = url.pathname.match(/^\/api\/party\/studio\/boards\/([a-z0-9-]+)\/select$/);
  if (request.method === "POST" && studioBoardMatch) return sendJSON(response, 200, partyStudio.selectBoard(studioBoardMatch[1]));
  const studioSectionMatch = url.pathname.match(/^\/api\/party\/studio\/(map|actors|scenes|events|rules|data)$/);
  if (request.method === "PUT" && studioSectionMatch) return sendJSON(response, 200, partyStudio.update(studioSectionMatch[1], await bodyJSON(request)));
  if (request.method === "POST" && url.pathname === "/api/party/studio/reset") return sendJSON(response, 200, partyStudio.reset());

  const partyV2RoomMatch = url.pathname.match(/^\/api\/party\/rooms\/([A-Za-z]{4})$/);
  if (request.method === "POST" && partyV2RoomMatch) {
    return sendJSON(response, 201, partyV2Rooms.create(partyV2RoomMatch[1]));
  }
  if (request.method === "GET" && partyV2RoomMatch) {
    return sendJSON(response, 200, partyV2Rooms.getPublic(partyV2RoomMatch[1]));
  }

  const partyV2PlayerMatch = url.pathname.match(/^\/api\/party\/rooms\/([A-Za-z]{4})\/player$/);
  if (request.method === "GET" && partyV2PlayerMatch) {
    return sendJSON(response, 200, partyV2Rooms.getPrivate(partyV2PlayerMatch[1], url.searchParams.get("token")));
  }

  const partyV2JoinMatch = url.pathname.match(/^\/api\/party\/rooms\/([A-Za-z]{4})\/join$/);
  if (request.method === "POST" && partyV2JoinMatch) {
    return sendJSON(response, 201, partyV2Rooms.join(partyV2JoinMatch[1], await bodyJSON(request)));
  }

  const partyV2ActionMatch = url.pathname.match(/^\/api\/party\/rooms\/([A-Za-z]{4})\/(confirm-players|setup|confirm-setup|roll|minigame-start|minigame-result|demo|ack-primary|ack-player)$/);
  if (request.method === "POST" && partyV2ActionMatch) {
    const body = await bodyJSON(request);
    const [, code, action] = partyV2ActionMatch;
    if (action === "confirm-players") return sendJSON(response, 200, partyV2Rooms.confirmPlayers(code, body.token));
    if (action === "setup") return sendJSON(response, 200, partyV2Rooms.updateSetup(code, body.token, body));
    if (action === "confirm-setup") return sendJSON(response, 200, partyV2Rooms.confirmSetup(code, body.token));
    if (action === "roll") return sendJSON(response, 200, partyV2Rooms.roll(code, body.token));
    if (action === "minigame-start") {
      const room = partyV2Rooms.startMinigame(code, body.token);
      const challenge = partyStore.challengeRuntimePackage(room.minigame.challenge.id);
      const game = gameLibrary.gameByHash(challenge.rom?.sha256);
      if (!game) throw new Error("The mini-game ROM is not in this server's library");
      return sendJSON(response, 200, { room, runtime: { challenge, game: browserGame(game) } });
    }
    if (action === "minigame-result") return sendJSON(response, 200, partyV2Rooms.submitResult(code, body.token, body));
    if (action === "demo") return sendJSON(response, 200, partyV2Rooms.startDemo(code));
    if (action === "ack-primary") return sendJSON(response, 200, partyV2Rooms.acknowledgePrimary(code, body.ids));
    if (action === "ack-player") return sendJSON(response, 200, partyV2Rooms.acknowledgePlayer(code, body.token, body.ids));
  }

  if (request.method === "GET" && url.pathname === "/api/catalog") {
    return sendJSON(response, 200, { ...partyStore.catalog(), games: gameLibrary.games().map(browserGame), activeGameId: null, cores: [{ id: "nes", system: "Nintendo Entertainment System" }] });
  }

  if (request.method === "GET" && url.pathname === "/api/controls") return sendJSON(response, 200, controls());
  if (request.method === "POST" && url.pathname === "/api/controls") return sendJSON(response, 200, saveControls(await bodyJSON(request)));

  if (request.method === "POST" && url.pathname === "/api/library/unload") {
    return sendJSON(response, 200, { ok: true });
  }

  if (request.method === "GET" && url.pathname === "/api/library") {
    return sendJSON(response, 200, { games: gameLibrary.games().map(browserGame), activeGameId: null });
  }

  if (request.method === "POST" && url.pathname === "/api/library/scan") {
    const games = gameLibrary.scan();
    return sendJSON(response, 200, { games: games.map(browserGame), activeGameId: null });
  }

  if (request.method === "POST" && url.pathname === "/api/library/artwork") {
    const results = await gameLibrary.downloadMissingBoxArt();
    return sendJSON(response, 200, { results, games: gameLibrary.games() });
  }

  const gameMatch = url.pathname.match(/^\/api\/library\/([a-z0-9-]+)$/);
  if (request.method === "POST" && gameMatch) {
    return sendJSON(response, 200, gameLibrary.updateGame(gameMatch[1], await bodyJSON(request)));
  }

  const gameContentMatch = url.pathname.match(/^\/api\/library\/([a-z0-9-]+)\/content$/);
  if (request.method === "GET" && gameContentMatch) {
    const game = gameLibrary.game(gameContentMatch[1]);
    if (!game) throw new Error("Game not found");
    const contents = fs.readFileSync(gameLibrary.absolutePath(game));
    response.writeHead(200, { "Content-Type": "application/octet-stream", "Content-Length": contents.length, "Cache-Control": "private, max-age=3600" });
    return response.end(contents);
  }

  const gameLoadMatch = url.pathname.match(/^\/api\/library\/([a-z0-9-]+)\/load$/);
  if (request.method === "POST" && gameLoadMatch) {
    const game = gameLibrary.game(gameLoadMatch[1]);
    if (!game) throw new Error("Game not found");
    return sendJSON(response, 200, { game: browserGame(game) });
  }

  const gameStatesMatch = url.pathname.match(/^\/api\/library\/([a-z0-9-]+)\/states$/);
  if (request.method === "GET" && gameStatesMatch) {
    return sendJSON(response, 200, { states: gameLibrary.listStates(gameStatesMatch[1]) });
  }
  if (request.method === "POST" && gameStatesMatch) {
    const body = await bodyJSON(request);
    if (!body.stateBase64) throw new Error("The browser did not include an emulator state");
    const saved = gameLibrary.saveState(gameStatesMatch[1], body.title, Buffer.from(body.stateBase64, "base64"));
    return sendJSON(response, 201, saved);
  }

  const gameStateLoadMatch = url.pathname.match(/^\/api\/library\/([a-z0-9-]+)\/states\/([a-f0-9-]+)\/load$/);
  if (request.method === "POST" && gameStateLoadMatch) {
    const saved = gameLibrary.loadState(gameStateLoadMatch[1], gameStateLoadMatch[2]);
    return sendJSON(response, 200, { ...saved.item, stateBase64: saved.buffer.toString("base64") });
  }

  const gameStateItemMatch = url.pathname.match(/^\/api\/library\/([a-z0-9-]+)\/states\/([a-f0-9-]+)$/);
  if (request.method === "PATCH" && gameStateItemMatch) {
    const body = await bodyJSON(request);
    const updated = gameLibrary.renameState(gameStateItemMatch[1], gameStateItemMatch[2], body.title);
    return sendJSON(response, 200, { state: updated });
  }
  if (request.method === "DELETE" && gameStateItemMatch) {
    const result = gameLibrary.deleteState(gameStateItemMatch[1], gameStateItemMatch[2]);
    return sendJSON(response, 200, result);
  }

  const gameModifiersMatch = url.pathname.match(/^\/api\/library\/([a-z0-9-]+)\/modifiers$/);
  if (request.method === "GET" && gameModifiersMatch) {
    const game = gameLibrary.game(gameModifiersMatch[1]);
    const modifiers = modifierLibrary.listModifiers(gameModifiersMatch[1], game?.fileHint || "");
    return sendJSON(response, 200, { modifiers });
  }
  if (request.method === "POST" && gameModifiersMatch) {
    const game = gameLibrary.game(gameModifiersMatch[1]);
    const body = await bodyJSON(request);
    const saved = modifierLibrary.addModifier(gameModifiersMatch[1], game?.fileHint || "", body);
    return sendJSON(response, 201, { modifier: saved });
  }

  const gameModifierDeleteMatch = url.pathname.match(/^\/api\/library\/([a-z0-9-]+)\/modifiers\/([a-zA-Z0-9_-]+)$/);
  if (request.method === "DELETE" && gameModifierDeleteMatch) {
    const game = gameLibrary.game(gameModifierDeleteMatch[1]);
    const ok = modifierLibrary.deleteModifier(gameModifierDeleteMatch[1], game?.fileHint || "", gameModifierDeleteMatch[2]);
    return sendJSON(response, 200, { ok });
  }

  if (request.method === "GET" && url.pathname === "/api/tas") {
    const filter = url.searchParams.get("gameId") || url.searchParams.get("gameTitle") || "";
    return sendJSON(response, 200, { movies: tasLibrary.list(filter) });
  }

  const tasContentMatch = url.pathname.match(/^\/api\/tas\/([a-zA-Z0-9_-]+)\/content$/);
  if (request.method === "GET" && tasContentMatch) {
    const tasId = tasContentMatch[1];
    const item = tasLibrary.get(tasId);
    if (!item) throw new Error("TAS movie not found");
    const content = tasLibrary.readContent(tasId);
    response.writeHead(200, {
      "Content-Type": "text/plain; charset=utf-8",
      "Content-Length": Buffer.byteLength(content),
      "Cache-Control": "no-store",
    });
    return response.end(content);
  }

  const tasItemMatch = url.pathname.match(/^\/api\/tas\/([a-zA-Z0-9_-]+)$/);
  if (request.method === "GET" && tasItemMatch) {
    const item = tasLibrary.get(tasItemMatch[1]);
    if (!item) throw new Error("TAS movie not found");
    return sendJSON(response, 200, item);
  }
  if (request.method === "DELETE" && tasItemMatch) {
    return sendJSON(response, 200, tasLibrary.delete(tasItemMatch[1]));
  }

  if (request.method === "POST" && url.pathname === "/api/tas") {
    const body = await bodyJSON(request);
    const saved = tasLibrary.saveCustomTas(body);
    return sendJSON(response, 201, saved);
  }

  if (request.method === "POST" && url.pathname === "/api/packs") {
    return sendJSON(response, 200, partyStore.savePack(await bodyJSON(request)));
  }

  const packDeleteMatch = url.pathname.match(/^\/api\/packs\/([a-z0-9-]+)$/);
  if (request.method === "DELETE" && packDeleteMatch) {
    return sendJSON(response, 200, partyStore.deletePack(packDeleteMatch[1]));
  }

  if (request.method === "POST" && url.pathname === "/api/rulesets") {
    return sendJSON(response, 200, partyStore.saveRuleset(await bodyJSON(request)));
  }

  const rulesetDeleteMatch = url.pathname.match(/^\/api\/rulesets\/([a-z0-9-]+)$/);
  if (request.method === "DELETE" && rulesetDeleteMatch) {
    return sendJSON(response, 200, partyStore.deleteRuleset(rulesetDeleteMatch[1]));
  }

  if (request.method === "POST" && url.pathname === "/api/sessions") {
    return sendJSON(response, 201, partyStore.createSession(await bodyJSON(request)));
  }

  const sessionMatch = url.pathname.match(/^\/api\/sessions\/([a-f0-9-]+)$/);
  if (request.method === "GET" && sessionMatch) {
    const session = partyStore.session(sessionMatch[1]);
    if (!session) throw new Error("Board game session not found");
    return sendJSON(response, 200, session);
  }

  const rollMatch = url.pathname.match(/^\/api\/sessions\/([a-f0-9-]+)\/roll$/);
  if (request.method === "POST" && rollMatch) {
    return sendJSON(response, 200, partyStore.roll(rollMatch[1]));
  }

  const resultMatch = url.pathname.match(/^\/api\/sessions\/([a-f0-9-]+)\/minigame-result$/);
  if (request.method === "POST" && resultMatch) {
    return sendJSON(response, 200, partyStore.finishMinigame(resultMatch[1], await bodyJSON(request)));
  }

  const challengeMatch = url.pathname.match(/^\/api\/challenges\/([a-z0-9-]+)\/play$/);
  if (request.method === "POST" && challengeMatch) {
    const challenge = partyStore.challengeRuntimePackage(challengeMatch[1]);
    const game = gameLibrary.gameByHash(challenge.rom?.sha256);
    if (!game) throw new Error("The required ROM is not in the library");
    return sendJSON(response, 200, { challenge: { ...challenge, id: challengeMatch[1] }, game: browserGame(game) });
  }

  const challengeEditMatch = url.pathname.match(/^\/api\/challenges\/([a-z0-9-]+)\/edit$/);
  if (request.method === "POST" && challengeEditMatch) {
    const challenge = partyStore.challengePackage(challengeEditMatch[1]);
    const game = gameLibrary.gameByHash(challenge.rom?.sha256);
    if (!game) throw new Error("The required ROM is not in the library");
    return sendJSON(response, 200, { challenge: { ...challenge, id: challengeEditMatch[1] }, game: browserGame(game) });
  }

  const challengeDeleteMatch = url.pathname.match(/^\/api\/challenges\/([a-z0-9-]+)$/);
  if (request.method === "DELETE" && challengeDeleteMatch) {
    const deleted = partyStore.deleteChallenge(challengeDeleteMatch[1]);
    return sendJSON(response, 200, deleted);
  }

  if (request.method === "POST" && url.pathname === "/api/creator/save") {
    const saved = partyStore.saveChallenge(await bodyJSON(request));
    return sendJSON(response, 200, { ok: true, ...saved });
  }

  const retiredEmulatorRoute = /^\/api\/(?:frame|status|info|rewind|reset|memory|watch|modifier|search|state\/|creator\/(?!save)|challenge\/load)/;
  if (retiredEmulatorRoute.test(url.pathname)) {
    return sendJSON(response, 410, { error: "Emulator execution moved to the browser client" });
  }


  return sendJSON(response, 404, { error: "API route not found" });
}

const server = http.createServer(async (request, response) => {
  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  try {
    if (url.pathname.startsWith("/api/")) await handleAPI(request, response, url);
    else serveStatic(request, response, url.pathname);
  } catch (error) {
    if (!response.headersSent) sendError(response, error);
    else response.destroy(error);
  }
});

const wss = new WebSocketServer({ noServer: true });
const partySockets = new Map();

function broadcastPartyRoom(room) {
  const sockets = partySockets.get(room.code);
  if (!sockets) return;
  for (const ws of sockets) {
    if (ws.readyState !== WebSocket.OPEN) continue;
    try {
      const data = ws.token ? partyV2Rooms.privateRoom(room, ws.token) : partyV2Rooms.publicRoom(room);
      ws.send(JSON.stringify({ type: "room-update", room: data }));
    } catch (error) {
      ws.send(JSON.stringify({ type: "error", error: error.message || String(error) }));
    }
  }
}

partyV2Rooms.onUpdate(broadcastPartyRoom);

server.on("upgrade", (request, socket, head) => {
  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  if (url.pathname === "/ws/party") {
    wss.handleUpgrade(request, socket, head, (ws) => {
      wss.emit("connection", ws, request);
    });
  } else {
    socket.destroy();
  }
});

wss.on("connection", (ws, request) => {
  const url = new URL(request.url, `http://${request.headers.host || "localhost"}`);
  const code = (url.searchParams.get("code") || "").toUpperCase();
  const token = url.searchParams.get("token") || "";
  ws.token = token;
  ws.roomCode = code;

  try {
    const room = token ? partyV2Rooms.getPrivate(code, token) : partyV2Rooms.getPublic(code);
    if (!partySockets.has(code)) partySockets.set(code, new Set());
    partySockets.get(code).add(ws);
    ws.send(JSON.stringify({ type: "room-update", room }));
  } catch (error) {
    ws.send(JSON.stringify({ type: "error", error: error.message || String(error) }));
  }

  ws.on("message", (raw) => {
    try {
      const message = JSON.parse(raw);
      if (message.type !== "action") return;
      let room = null;
      if (message.action === "confirm-players") room = partyV2Rooms.confirmPlayers(code, token);
      else if (message.action === "setup") room = partyV2Rooms.updateSetup(code, token, message.body || {});
      else if (message.action === "confirm-setup") room = partyV2Rooms.confirmSetup(code, token);
      else if (message.action === "roll") room = partyV2Rooms.roll(code, token);
      else if (message.action === "minigame-result") room = partyV2Rooms.submitResult(code, token, message.body || {});
      else if (message.action === "demo") room = partyV2Rooms.startDemo(code);
      else if (message.action === "ack-primary") partyV2Rooms.acknowledgePrimary(code, message.body?.ids || []);
      else if (message.action === "ack-player") partyV2Rooms.acknowledgePlayer(code, token, message.body?.ids || []);
      else throw new Error("Unknown Party action.");
      // Mutating actions are delivered by the store's single room broadcast.
      // Sending the returned snapshot here would duplicate every update.
    } catch (error) {
      ws.send(JSON.stringify({ type: "error", error: error.message || String(error) }));
    }
  });

  ws.on("close", () => {
    partySockets.get(code)?.delete(ws);
    if (!partySockets.get(code)?.size) partySockets.delete(code);
  });
});

const partyCountdownTimer = setInterval(() => partyV2Rooms.tickCountdowns(), 250);
partyCountdownTimer.unref();

const host = process.env.HOST || "0.0.0.0";
const port = Number(process.env.PORT || 3000);
server.listen(port, host, () => {
  console.log(`Starlight Party running at http://localhost:${port} and on your local network (e.g. http://10.0.0.55:${port})`);
  console.log(`Console idle — ${initialGames.length} game${initialGames.length === 1 ? "" : "s"} found; ROMs load on demand`);
});
