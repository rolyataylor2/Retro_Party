import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const ROM_EXTENSIONS = new Set([".nes", ".fds", ".unf", ".unif"]);
const THUMBNAIL_ROOT = "https://thumbnails.libretro.com/Nintendo%20-%20Nintendo%20Entertainment%20System/Named_Boxarts";

function slug(value, fallback = "nes-game") {
  return String(value || fallback).toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "").slice(0, 72) || fallback;
}

function atomicJSON(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temporary = `${file}.${process.pid}.${crypto.randomUUID()}.tmp`;
  fs.writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`);
  fs.renameSync(temporary, file);
}

function readJSON(file, fallback) {
  try { return JSON.parse(fs.readFileSync(file, "utf8")); } catch { return fallback; }
}

function cleanTitle(filename) {
  const stem = path.basename(filename, path.extname(filename));
  if (/^smb$/i.test(stem)) return "Super Mario Bros.";
  return stem
    .replace(/\s*[\[(](?:u|usa|e|europe|j|japan|world|rev[^\])]*|prototype|beta|!)[^\])]*[\])]\s*/gi, " ")
    .replace(/[_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim() || stem;
}

function inferredMetadata(title) {
  const name = title.toLowerCase();
  if (name.includes("mega man")) return { series: "Mega Man", genres: ["Action", "Platforming"], difficulty: "Hard" };
  if (name.includes("mario")) return { series: "Super Mario", genres: ["Platforming", "Action"], difficulty: "Medium" };
  if (name.includes("zelda")) return { series: "The Legend of Zelda", genres: ["Adventure", "Action"], difficulty: "Medium" };
  if (name.includes("metroid")) return { series: "Metroid", genres: ["Adventure", "Action", "Platforming"], difficulty: "Hard" };
  if (/kirby/.test(name)) return { series: "Kirby", genres: ["Platforming", "Action"], difficulty: "Easy" };
  if (/contra|castlevania|ninja gaiden/.test(name)) return { series: title.split(/\s+[0-9ivx]+$/i)[0], genres: ["Action", "Platforming"], difficulty: "Hard" };
  if (/tetris|puzzle|dr\. mario|lode runner/.test(name)) return { series: title, genres: ["Puzzle"], difficulty: "Medium" };
  if (/race|racing|excitebike|rad racer/.test(name)) return { series: title, genres: ["Racing", "Action"], difficulty: "Medium" };
  if (/adventure|quest|dragon warrior|final fantasy/.test(name)) return { series: title, genres: ["Adventure"], difficulty: "Medium" };
  return { series: title.replace(/\s+[0-9ivx]+$/i, ""), genres: ["Action"], difficulty: "Medium" };
}

function walkRoms(directory) {
  if (!fs.existsSync(directory)) return [];
  const found = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) found.push(...walkRoms(full));
    else if (entry.isFile() && ROM_EXTENSIONS.has(path.extname(entry.name).toLowerCase())) found.push(full);
  }
  return found.sort((a, b) => a.localeCompare(b));
}

function artworkNames(game) {
  const stem = path.basename(game.relativePath, path.extname(game.relativePath));
  const normalized = stem
    .replace(/\(U\)/gi, "(USA)")
    .replace(/\(E\)/gi, "(Europe)")
    .replace(/\(J\)/gi, "(Japan)");
  const names = [normalized, game.title];
  if (game.title === "Super Mario Bros.") names.unshift("Super Mario Bros. (World)");
  names.push(`${game.title} (World)`, `${game.title} (USA)`);
  return [...new Set(names.map((name) => name.replace(/[&*/:`<>?\\|]/g, "_").trim()).filter(Boolean))];
}

export class GameLibrary {
  constructor(root) {
    this.root = root;
    this.romPath = path.join(root, "roms");
    this.dataPath = path.join(root, "data", "library.json");
    this.stateIndexPath = path.join(root, "data", "save-states.json");
    this.statesPath = path.join(root, "states");
    this.artPath = path.join(root, "public", "boxart");
    fs.mkdirSync(this.romPath, { recursive: true });
    fs.mkdirSync(this.statesPath, { recursive: true });
    fs.mkdirSync(this.artPath, { recursive: true });
  }

  scan() {
    const saved = readJSON(this.dataPath, { games: [] });
    const byHash = new Map((saved.games || []).map((game) => [game.sha256, game]));
    const games = walkRoms(this.romPath).map((file) => {
      const buffer = fs.readFileSync(file);
      const sha256 = crypto.createHash("sha256").update(buffer).digest("hex");
      const previous = byHash.get(sha256) || {};
      const relativePath = path.relative(this.romPath, file);
      const title = previous.title || cleanTitle(relativePath);
      const inferred = inferredMetadata(title);
      const id = previous.id || `${slug(title)}-${sha256.slice(0, 8)}`;
      const artFile = path.join(this.artPath, `${id}.png`);
      return {
        id, title, relativePath, fileHint: path.basename(file), sha256,
        size: buffer.length,
        series: previous.series || inferred.series,
        genres: Array.isArray(previous.genres) && previous.genres.length ? previous.genres : inferred.genres,
        difficulty: previous.difficulty || inferred.difficulty,
        boxArt: fs.existsSync(artFile) ? `/boxart/${id}.png` : null,
        artworkSource: previous.artworkSource || null,
        addedAt: previous.addedAt || new Date().toISOString(),
      };
    });
    atomicJSON(this.dataPath, { scannedAt: new Date().toISOString(), games });
    return games;
  }

  games() { return this.scan(); }

  game(id) { return this.games().find((game) => game.id === id) || null; }

  gameByHash(sha256) { return this.games().find((game) => game.sha256 === sha256) || null; }

  absolutePath(game) {
    const file = path.resolve(this.romPath, game.relativePath);
    if (!file.startsWith(`${this.romPath}${path.sep}`)) throw new Error("Invalid ROM path");
    return file;
  }

  updateGame(id, input) {
    const data = readJSON(this.dataPath, { games: this.scan() });
    const game = data.games.find((item) => item.id === id);
    if (!game) throw new Error("Game not found");
    if (input.title) game.title = String(input.title).trim().slice(0, 100);
    if (input.series) game.series = String(input.series).trim().slice(0, 80);
    if (input.difficulty) game.difficulty = String(input.difficulty).trim().slice(0, 30);
    if (Array.isArray(input.genres)) game.genres = [...new Set(input.genres.map(String).map((v) => v.trim()).filter(Boolean))].slice(0, 8);
    atomicJSON(this.dataPath, data);
    return game;
  }

  listStates(gameId) {
    const index = readJSON(this.stateIndexPath, []);
    return index.filter((item) => item.gameId === gameId && fs.existsSync(path.join(this.statesPath, item.file)));
  }

  saveState(gameId, title, buffer) {
    if (!this.game(gameId)) throw new Error("Game not found");
    const id = crypto.randomUUID();
    const directory = path.join(this.statesPath, gameId);
    fs.mkdirSync(directory, { recursive: true });
    const relative = path.join(gameId, `${id}.state`);
    fs.writeFileSync(path.join(this.statesPath, relative), buffer);
    const item = { id, gameId, title: String(title || "Starting Moment").trim().slice(0, 80), file: relative, bytes: buffer.length, createdAt: new Date().toISOString() };
    const index = readJSON(this.stateIndexPath, []);
    index.push(item);
    atomicJSON(this.stateIndexPath, index);
    return item;
  }

  loadState(gameId, stateId) {
    const item = this.listStates(gameId).find((state) => state.id === stateId);
    if (!item) throw new Error("Save state not found for this game");
    return { item, buffer: fs.readFileSync(path.join(this.statesPath, item.file)) };
  }

  renameState(gameId, stateId, newTitle) {
    const index = readJSON(this.stateIndexPath, []);
    const item = index.find((state) => state.gameId === gameId && state.id === stateId);
    if (!item) throw new Error("Save state not found");
    item.title = String(newTitle || "Moment").trim().slice(0, 80) || "Moment";
    atomicJSON(this.stateIndexPath, index);
    return item;
  }

  deleteState(gameId, stateId) {
    const index = readJSON(this.stateIndexPath, []);
    const itemIndex = index.findIndex((state) => state.gameId === gameId && state.id === stateId);
    if (itemIndex < 0) throw new Error("Save state not found");
    const [item] = index.splice(itemIndex, 1);
    if (item && item.file) {
      const fullPath = path.join(this.statesPath, item.file);
      if (fs.existsSync(fullPath)) {
        try { fs.unlinkSync(fullPath); } catch {}
      }
    }
    atomicJSON(this.stateIndexPath, index);
    return { ok: true, id: stateId };
  }

  async downloadBoxArt(gameId) {
    const game = this.game(gameId);
    if (!game) throw new Error("Game not found");
    for (const name of artworkNames(game)) {
      const source = `${THUMBNAIL_ROOT}/${encodeURIComponent(name)}.png`;
      const response = await fetch(source, { signal: AbortSignal.timeout(12000), headers: { "User-Agent": "Starlight-Party/0.3" } });
      if (!response.ok) continue;
      const bytes = Buffer.from(await response.arrayBuffer());
      if (!bytes.length || bytes.length > 6 * 1024 * 1024 || !String(response.headers.get("content-type")).includes("image")) continue;
      const file = path.join(this.artPath, `${game.id}.png`);
      const temporary = `${file}.${process.pid}.${crypto.randomUUID()}.tmp`;
      fs.writeFileSync(temporary, bytes);
      fs.renameSync(temporary, file);
      const updated = this.updateGame(game.id, {});
      const data = readJSON(this.dataPath, { games: [] });
      const stored = data.games.find((item) => item.id === game.id);
      stored.boxArt = `/boxart/${game.id}.png`;
      stored.artworkSource = source;
      atomicJSON(this.dataPath, data);
      return { ...updated, boxArt: stored.boxArt, artworkSource: source };
    }
    throw new Error(`No matching Libretro box art was found for ${game.title}`);
  }

  async downloadMissingBoxArt() {
    const results = [];
    for (const game of this.games()) {
      if (game.boxArt) { results.push({ id: game.id, status: "cached" }); continue; }
      try { await this.downloadBoxArt(game.id); results.push({ id: game.id, status: "downloaded" }); }
      catch (error) { results.push({ id: game.id, status: "missing", error: error.message }); }
    }
    return results;
  }

  smartPacks(challenges) {
    const games = this.games();
    const packs = [];
    const add = (id, name, description, selected, kind) => {
      if (!selected.length) return;
      packs.push({ id: `smart-${slug(id)}`, name, description, challengeIds: selected.map((item) => item.id), categories: [kind], playerCounts: [1, 2, 3, 4], smart: true, featured: false });
    };
    for (const level of ["Easy", "Medium", "Hard"]) {
      add(`difficulty-${level}`, `${level} Mix`, `${level}-difficulty mini-games from across your library.`, challenges.filter((c) => c.difficulty.toLowerCase() === level.toLowerCase()), "Difficulty");
    }
    for (const genre of ["Action", "Adventure", "Platforming", "Puzzle", "Racing"]) {
      add(`genre-${genre}`, `${genre} Party`, `A playlist built from ${genre.toLowerCase()} games.`, challenges.filter((c) => games.find((g) => g.id === c.gameId)?.genres?.some((v) => v.toLowerCase() === genre.toLowerCase()) || c.category.toLowerCase() === genre.toLowerCase()), "Genre");
    }
    for (const game of games) add(`game-${game.id}`, `${game.title} Collection`, `Every mini-game created for ${game.title}.`, challenges.filter((c) => c.gameId === game.id || c.gameName === game.title), "Game");
    for (const series of [...new Set(games.map((game) => game.series).filter(Boolean))]) {
      const gameIds = new Set(games.filter((game) => game.series === series).map((game) => game.id));
      add(`series-${series}`, `${series} Series`, `Mini-games spanning the ${series} series.`, challenges.filter((c) => gameIds.has(c.gameId)), "Series");
    }
    return packs;
  }
}

export const gameLibraryInternals = { cleanTitle, inferredMetadata, artworkNames };
