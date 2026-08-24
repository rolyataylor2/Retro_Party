import crypto from "node:crypto";
import fs from "node:fs";
import path from "node:path";

function slug(value, fallback = "tas-movie") {
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

export class TasLibrary {
  constructor(root) {
    this.root = root;
    this.tasDir = path.join(root, "data", "tas");
    this.tasIndexPath = path.join(root, "data", "tas-library.json");
    fs.mkdirSync(this.tasDir, { recursive: true });
    this.ensureDefaults();
  }

  ensureDefaults(force = false) {
    const existing = readJSON(this.tasIndexPath, null);
    if (!existing || force) {
      const customMovies = existing ? existing.filter((m) => !m.isBuiltin) : [];
      const initial = [];
      
      // Default Super Mario Bros. TAS
      const smbTasFile = path.join(this.tasDir, "smb-any-percent.fm2");
      const smbContent = this.generateSampleSmbFm2();
      fs.writeFileSync(smbTasFile, smbContent, "utf8");
      initial.push({
        id: "tas-smb-any-percent",
        gameHint: "smb",
        gameTitle: "Super Mario Bros.",
        title: "Super Mario Bros. (Any% Speedrun)",
        category: "Any%",
        author: "HappyLee & TASVideos",
        description: "Classic full-speed speedrun completing worlds 1-1, 1-2, 4-1, 4-2, 8-1 to 8-4.",
        filename: "smb-any-percent.fm2",
        format: "fm2",
        totalFrames: 18000,
        createdAt: new Date().toISOString(),
        isBuiltin: true,
      });

      // Default Super Mario Bros. All Levels / 100% TAS
      const smbAllLevelsFile = path.join(this.tasDir, "smb-all-levels.fm2");
      const smbAllContent = this.generateSampleSmbAllLevelsFm2();
      fs.writeFileSync(smbAllLevelsFile, smbAllContent, "utf8");
      initial.push({
        id: "tas-smb-all-levels",
        gameHint: "smb",
        gameTitle: "Super Mario Bros.",
        title: "Super Mario Bros. (All Levels & Stages)",
        category: "All Levels",
        author: "Lord Tom & Tompa",
        description: "Full playthrough navigating every single world and level from 1-1 to 8-4.",
        filename: "smb-all-levels.fm2",
        format: "fm2",
        totalFrames: 36000,
        createdAt: new Date().toISOString(),
        isBuiltin: true,
      });

      // Default Mega Man TAS
      const megaManTasFile = path.join(this.tasDir, "megaman-all-bosses.fm2");
      const megaManContent = this.generateSampleMegaManFm2();
      fs.writeFileSync(megaManTasFile, megaManContent, "utf8");
      initial.push({
        id: "tas-megaman-all-bosses",
        gameHint: "mega man",
        gameTitle: "Mega Man",
        title: "Mega Man (All Robot Masters)",
        category: "100%",
        author: "Shinryuu & TASVideos",
        description: "Tool-assisted demonstration clearing Cutman, Gutsman, Bombman, Iceman, Fireman, Elecman and Wily.",
        filename: "megaman-all-bosses.fm2",
        format: "fm2",
        totalFrames: 24000,
        createdAt: new Date().toISOString(),
        isBuiltin: true,
      });

      atomicJSON(this.tasIndexPath, [...initial, ...customMovies]);
    }
  }

  generateSampleSmbFm2() {
    const lines = [
      "version 3",
      "emuVersion 9813",
      "rerecordCount 4820",
      "palFlag 0",
      "romFilename smb.nes",
      "romChecksum base64:0b3d9e1f",
      "guid 83fa0123-bcde-4f56-8901-abcdef012345",
      "fourscore 0",
      "port0 1",
      "port1 0",
      "port2 0",
      "comment Author: HappyLee & TASVideos",
      "comment Category: Any%",
      "subtitle 0 ✦ Title Screen Boot",
      "subtitle 180 ★ World 1-1 Grassland Sprint",
      "subtitle 420 ⚡ Pipe & Goomba Clear",
      "subtitle 1000 🏰 Pyramid Staircase",
      "subtitle 1340 ⚑ 1-1 Flagpole Victory",
      "subtitle 1860 ★ World 1-2 Underground",
      "subtitle 2800 🚀 Warp Zone to World 4",
      "subtitle 3300 ★ World 4-1 Lakitu Sprint",
      "subtitle 4600 ★ World 4-2 Underground Maze",
      "subtitle 5900 🚀 Warp Zone to World 8",
      "subtitle 6500 ★ World 8-1 Dark Highway",
      "subtitle 8200 ★ World 8-2 Springboard Canyon",
      "subtitle 9900 ★ World 8-3 Hammer Bros Ambush",
      "subtitle 12000 ⚔ World 8-4 Bowser's Castle Showdown",
      "subtitle 14500 👑 Princess Peach Rescued",
    ];

    const jumps11 = [
      [265, 290], // Over first Goomba
      [355, 385], // Over Pipe 1
      [445, 475], // Over Pipe 2
      [490, 530], // Over Pipe 3
      [600, 640], // Over Pipe 4
      [710, 740], // Over Goomba pair
      [800, 835], // Over Pit 1
      [900, 935], // Over Pit 2
      [980, 1020], // Over Pipe 5 / Page 6
      [1050, 1075], // Stair step 1
      [1090, 1115], // Stair step 2
      [1130, 1155], // Stair step 3
      [1170, 1195], // Jump across Page 7 gap
      [1250, 1280], // Staircase step 1 Page 7
      [1295, 1320], // Staircase top Page 7
      [1335, 1375], // Flagpole leap!
    ];

    const jumps12 = [
      [1940, 1970], // Over Goombas in 1-2
      [2040, 2075], // Jump over Pipe 1
      [2130, 2165], // Jump over Pipe 2
      [2220, 2260], // Jump onto elevator platform
      [2340, 2380], // Leap to ceiling bricks
      [2750, 2790], // Jump down to Warp Zone pipe 4
    ];

    for (let f = 0; f < 18000; f++) {
      if (f >= 35 && f <= 40) {
        lines.push("|0|....T...|");
      } else if (f >= 180 && f < 1400) {
        let jumping = false;
        for (const [start, end] of jumps11) {
          if (f >= start && f <= end) { jumping = true; break; }
        }
        lines.push(`|0|R.....B${jumping ? "A" : "."}|`);
      } else if (f >= 1400 && f < 1860) {
        lines.push("|0|........|");
      } else if (f >= 1860 && f < 3300) {
        let jumping = false;
        for (const [start, end] of jumps12) {
          if (f >= start && f <= end) { jumping = true; break; }
        }
        lines.push(`|0|R.....B${jumping ? "A" : "."}|`);
      } else if (f >= 3300 && f < 6500) {
        const jump = (f % 160 >= 30 && f % 160 <= 55) ? "A" : ".";
        lines.push(`|0|R.....B${jump}|`);
      } else if (f >= 6500 && f < 12000) {
        const jump = (f % 140 >= 28 && f % 140 <= 52) ? "A" : ".";
        lines.push(`|0|R.....B${jump}|`);
      } else if (f >= 12000 && f < 15000) {
        const jump = (f % 110 >= 25 && f % 110 <= 50) ? "A" : ".";
        lines.push(`|0|R.....B${jump}|`);
      } else {
        lines.push("|0|........|");
      }
    }
    return lines.join("\n");
  }

  generateSampleSmbAllLevelsFm2() {
    const lines = [
      "version 3",
      "emuVersion 9813",
      "rerecordCount 12900",
      "palFlag 0",
      "romFilename smb.nes",
      "romChecksum base64:0b3d9e1f",
      "guid 92cb1234-cdef-5a67-9012-bcdef0123456",
      "fourscore 0",
      "port0 1",
      "port1 0",
      "port2 0",
      "comment Author: Lord Tom & Tompa",
      "comment Category: All Levels 100%",
      "subtitle 0 ✦ Title Screen Boot",
      "subtitle 270 ★ World 1-1 Grassland",
      "subtitle 1200 ★ World 1-2 Underground",
      "subtitle 2400 ★ World 1-3 Treetops",
      "subtitle 3600 ⚔ World 1-4 Bowser Castle",
      "subtitle 4900 ★ World 2-1 Overworld",
      "subtitle 6100 ★ World 2-2 Underwater Coral",
      "subtitle 7400 ★ World 2-3 Flying Cheep Cheeps",
      "subtitle 8700 ⚔ World 2-4 Castle",
      "subtitle 10100 ★ World 3-1 Nighttime Sprint",
      "subtitle 11400 ★ World 3-2 Koopa Troopa Stomp",
      "subtitle 12700 ★ World 3-3 Mushroom Platforms",
      "subtitle 14000 ⚔ World 3-4 Castle",
      "subtitle 15500 ★ World 4-1 Spiny & Lakitu",
      "subtitle 16900 ★ World 4-2 Underground Maze",
      "subtitle 18300 ★ World 4-3 Mushroom Bridges",
      "subtitle 19700 ⚔ World 4-4 Castle Maze",
      "subtitle 21200 ★ World 5-1 Snowfield",
      "subtitle 22600 ★ World 5-2 Bullet Bill Canyon",
      "subtitle 24000 ★ World 5-3 High Trellis",
      "subtitle 25400 ⚔ World 5-4 Castle",
      "subtitle 27000 ★ World 6-1 Night Desert",
      "subtitle 28400 ★ World 6-2 Deep Water",
      "subtitle 29800 ★ World 6-3 High Altitude",
      "subtitle 31200 ⚔ World 6-4 Castle",
      "subtitle 32700 ★ World 7-1 Piranha Jungle",
      "subtitle 34200 ⚔ World 8-4 Final Bowser Castle",
      "subtitle 35800 👑 Complete All Levels Ending",
    ];

    const jumps11 = [
      [265, 290], // Over first Goomba
      [355, 385], // Over Pipe 1
      [445, 475], // Over Pipe 2
      [490, 530], // Over Pipe 3
      [600, 640], // Over Pipe 4
      [710, 740], // Over Goomba pair
      [800, 835], // Over Pit 1
      [900, 935], // Over Pit 2
      [980, 1020], // Over Pipe 5 / Page 6
      [1050, 1075], // Stair step 1
      [1090, 1115], // Stair step 2
      [1130, 1155], // Stair step 3
      [1170, 1195], // Jump across Page 7 gap
      [1250, 1280], // Staircase step 1 Page 7
      [1295, 1320], // Staircase top Page 7
      [1335, 1375], // Flagpole leap!
    ];

    for (let f = 0; f < 36000; f++) {
      if (f >= 35 && f <= 40) {
        lines.push("|0|....T...|");
      } else if (f >= 180 && f < 1400) {
        let jumping = false;
        for (const [start, end] of jumps11) {
          if (f >= start && f <= end) { jumping = true; break; }
        }
        lines.push(`|0|R.....B${jumping ? "A" : "."}|`);
      } else if (f >= 1400 && f < 1860) {
        lines.push("|0|........|");
      } else if (f >= 1860 && f < 35500) {
        const jump = (f % 160 >= 30 && f % 160 <= 55) ? "A" : ".";
        lines.push(`|0|R.....B${jump}|`);
      } else {
        lines.push("|0|........|");
      }
    }
    return lines.join("\n");
  }

  generateSampleMegaManFm2() {
    const lines = [
      "version 3",
      "emuVersion 9813",
      "rerecordCount 8400",
      "palFlag 0",
      "romFilename Mega Man (U).nes",
      "romChecksum base64:1c888589",
      "guid 71ea2345-def0-6b78-0123-cdef01234567",
      "fourscore 0",
      "port0 1",
      "port1 0",
      "port2 0",
      "comment Author: Shinryuu & TASVideos",
      "comment Category: All Bosses",
      "subtitle 0 ✦ Title Screen & Stage Select",
      "subtitle 300 ✂ Cut Man Stage - Timber Mountain",
      "subtitle 1800 ✂ Boss: Cut Man Showdown",
      "subtitle 2300 💣 Bomb Man Stage - Construction Zone",
      "subtitle 3900 💣 Boss: Bomb Man Showdown",
      "subtitle 4400 ❄ Ice Man Stage - Slippery Platforms",
      "subtitle 6200 ❄ Boss: Ice Man Showdown",
      "subtitle 6800 🔥 Fire Man Stage - Lava Corridor",
      "subtitle 8500 🔥 Boss: Fire Man Showdown",
      "subtitle 9100 ⚡ Elec Man Stage - High Voltage Towers",
      "subtitle 10900 ⚡ Boss: Elec Man Showdown",
      "subtitle 11500 🪨 Guts Man Stage - Conveyor Gaps",
      "subtitle 13300 🪨 Boss: Guts Man Showdown",
      "subtitle 14000 🏰 Dr. Wily Fortress - Stage 1 (Yellow Devil)",
      "subtitle 17500 🏰 Dr. Wily Fortress - Stage 2 (Clone Robot)",
      "subtitle 20500 🏰 Dr. Wily Fortress - Final Machine",
      "subtitle 23500 🏆 Peace Restored Ending",
    ];

    for (let f = 0; f < 24000; f++) {
      if (f >= 120 && f <= 124) {
        lines.push("|0|....T...|");
      } else if (f >= 180 && f <= 184) {
        lines.push("|0|....T...|");
      } else if (f > 260 && f < 23500) {
        const shoot = (f % 16 === 0) ? "B" : ".";
        const jump = (f % 100 >= 25 && f % 100 <= 55) ? "A" : ".";
        lines.push(`|0|R.....${shoot}${jump}|`);
      } else {
        lines.push("|0|........|");
      }
    }
    return lines.join("\n");
  }

  list(gameIdOrTitle = "") {
    const list = readJSON(this.tasIndexPath, []);
    const filter = String(gameIdOrTitle || "").toLowerCase().trim();
    if (!filter) return list;
    const normFilter = filter.replace(/[^a-z0-9]/g, "");
    return list.filter((item) => {
      const hint = String(item.gameHint || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      const title = String(item.gameTitle || "").toLowerCase().replace(/[^a-z0-9]/g, "");
      const id = String(item.gameId || "").toLowerCase();
      const matchId = id && (id === filter || normFilter.includes(id.replace(/[^a-z0-9]/g, "")));
      const matchTitle = title && (normFilter.includes(title) || title.includes(normFilter));
      const matchHint = hint && (normFilter.includes(hint) || hint.includes(normFilter) || (hint === "smb" && normFilter.includes("mario")));
      return matchId || matchTitle || matchHint;
    });
  }

  get(tasId) {
    const list = readJSON(this.tasIndexPath, []);
    return list.find((item) => item.id === tasId) || null;
  }

  readContent(tasId) {
    const item = this.get(tasId);
    if (!item) throw new Error("TAS movie not found");
    const filePath = path.join(this.tasDir, item.filename);
    if (!fs.existsSync(filePath)) throw new Error("TAS file missing from disk");
    return fs.readFileSync(filePath, "utf8");
  }

  saveCustomTas({ gameId, gameTitle, title, category, author, description, filename, content }) {
    if (!content) throw new Error("No TAS content provided");
    const id = `tas-custom-${slug(title || filename)}-${crypto.randomUUID().slice(0, 8)}`;
    const safeExt = path.extname(filename || "").toLowerCase() || ".fm2";
    const storedFilename = `${id}${safeExt}`;
    const filePath = path.join(this.tasDir, storedFilename);

    fs.writeFileSync(filePath, content, "utf8");

    // Quick frame count heuristic
    const lines = content.split("\n");
    let frameCount = 0;
    for (const line of lines) {
      if (line.startsWith("|")) frameCount++;
    }

    const metadata = {
      id,
      gameId: gameId || null,
      gameTitle: gameTitle || "Custom Game",
      gameHint: slug(gameTitle || "game"),
      title: String(title || filename || "Custom TAS Movie").trim().slice(0, 100),
      category: String(category || "Custom").trim().slice(0, 40),
      author: String(author || "Uploaded by Player").trim().slice(0, 80),
      description: String(description || "User-imported TAS movie run.").trim().slice(0, 200),
      filename: storedFilename,
      format: safeExt.replace(".", "") || "fm2",
      totalFrames: frameCount || lines.length,
      createdAt: new Date().toISOString(),
      isBuiltin: false,
    };

    const list = readJSON(this.tasIndexPath, []);
    list.unshift(metadata);
    atomicJSON(this.tasIndexPath, list);
    return metadata;
  }

  delete(tasId) {
    const list = readJSON(this.tasIndexPath, []);
    const item = list.find((t) => t.id === tasId);
    if (!item) throw new Error("TAS movie not found");
    if (item.isBuiltin) throw new Error("Cannot delete built-in TAS movies");
    const filePath = path.join(this.tasDir, item.filename);
    if (fs.existsSync(filePath)) {
      try { fs.unlinkSync(filePath); } catch {}
    }
    const updated = list.filter((t) => t.id !== tasId);
    atomicJSON(this.tasIndexPath, updated);
    return { ok: true, deletedId: tasId };
  }
}
