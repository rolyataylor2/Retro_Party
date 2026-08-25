import test from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { ModifierLibrary } from "../lib/modifier-library.js";

test("manages per-game cheat modifiers and custom additions", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "nes-mod-test-"));
  try {
    const lib = new ModifierLibrary(tmp);
    const smbMods = lib.listModifiers("smb", "smb.nes");
    assert.ok(smbMods.length >= 4, "Should have default SMB presets");
    assert.ok(smbMods.some((m) => m.name === "Always Fire Mario"));

    const added = lib.addModifier("smb", "smb.nes", {
      name: "Super Jump 255",
      address: 0x0700,
      value: 255,
    });
    assert.equal(added.address, 0x0700);
    assert.equal(added.value, 255);

    const updated = lib.listModifiers("smb", "smb.nes");
    assert.ok(updated.some((m) => m.id === added.id));

    const deleted = lib.deleteModifier("smb", "smb.nes", added.id);
    assert.equal(deleted, true);

    const afterDelete = lib.listModifiers("smb", "smb.nes");
    assert.ok(!afterDelete.some((m) => m.id === added.id));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("collapses multipart (1 of 2) (2 of 2) cheat codes into a single modifier", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "nes-cheat-test-"));
  try {
    const cheatsDir = path.join(tmp, "cheats", "FCEUX Cheat Code Pack");
    fs.mkdirSync(cheatsDir, { recursive: true });
    
    // Create a mock cheat file with both single and multipart codes
    const chtContent = [
      "S0080:05:Single Code",
      "SC9298:ad:20:Invincibility (1 of 2)",
      "SC94e9:ad:20:Invincibility (2 of 2)",
      "SCb44e:30:b0:Hit anywhere (1 of 4)",
      "SCb4b5:ad:9d:Hit anywhere (2 of 4)",
      "SCb404:ad:9d:Hit anywhere (3 of 4)",
      "SCb44b:ad:20:Hit anywhere (4 of 4)",
    ].join("\n");
    fs.writeFileSync(path.join(cheatsDir, "TestGame (USA).cht"), chtContent);

    const lib = new ModifierLibrary(tmp);
    const mods = lib.listModifiers("test-game", "TestGame (USA).nes");

    // We should have exactly 3 modifiers: Single Code, Invincibility, Hit anywhere
    assert.equal(mods.length, 3);

    const singleMod = mods.find((m) => m.name === "Single Code");
    assert.ok(singleMod);
    assert.equal(singleMod.entries.length, 1);
    assert.equal(singleMod.address, 0x0080);
    assert.equal(singleMod.value, 5);

    const invincibilityMod = mods.find((m) => m.name === "Invincibility");
    assert.ok(invincibilityMod, "Invincibility should exist as a single combined modifier");
    assert.equal(invincibilityMod.entries.length, 2, "Invincibility should have 2 entries");
    assert.equal(invincibilityMod.entries[0].address, 0x9298);
    assert.equal(invincibilityMod.entries[0].value, 0xad);
    assert.equal(invincibilityMod.entries[1].address, 0x94e9);
    assert.equal(invincibilityMod.entries[1].value, 0xad);
    assert.ok(invincibilityMod.description.includes("2 parts"));

    const hitMod = mods.find((m) => m.name === "Hit anywhere");
    assert.ok(hitMod, "Hit anywhere should exist as a single combined modifier");
    assert.equal(hitMod.entries.length, 4, "Hit anywhere should have 4 entries");
    assert.equal(hitMod.entries[0].part, 1);
    assert.equal(hitMod.entries[1].part, 2);
    assert.equal(hitMod.entries[2].part, 3);
    assert.equal(hitMod.entries[3].part, 4);
    assert.ok(hitMod.description.includes("4 parts"));
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("merges saved modifiers with the complete flattened cheat catalogue", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "nes-cheat-merge-test-"));
  try {
    const cheatsDir = path.join(tmp, "cheats", "FCEUX Cheat Code Pack");
    fs.mkdirSync(cheatsDir, { recursive: true });
    fs.writeFileSync(path.join(cheatsDir, "Merge Game.cht"), [
      "S0080:05:Catalogue Only",
      "SC9298:ad:20:Combined Power (1 of 2)",
      "SC94e9:ad:20:Combined Power (2 of 2)",
    ].join("\n"));
    const lib = new ModifierLibrary(tmp);
    lib.addModifier("merge-game", "Merge Game.nes", { name: "Saved Only", address: 0x12, value: 3 });

    const modifiers = lib.listModifiers("merge-game", "Merge Game.nes");
    assert.ok(modifiers.some((modifier) => modifier.name === "Saved Only"));
    assert.ok(modifiers.some((modifier) => modifier.name === "Catalogue Only"));
    assert.equal(modifiers.find((modifier) => modifier.name === "Combined Power").entries.length, 2);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});

test("keeps deleted cheat-catalogue modifiers hidden", () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "nes-cheat-delete-test-"));
  try {
    const cheatsDir = path.join(tmp, "cheats", "FCEUX Cheat Code Pack");
    fs.mkdirSync(cheatsDir, { recursive: true });
    fs.writeFileSync(path.join(cheatsDir, "Delete Game.cht"), "S0080:05:Catalogue Cheat\n");
    const lib = new ModifierLibrary(tmp);
    const modifier = lib.listModifiers("delete-game", "Delete Game.nes")[0];

    assert.equal(lib.deleteModifier("delete-game", "Delete Game.nes", modifier.id), true);
    assert.deepEqual(lib.listModifiers("delete-game", "Delete Game.nes"), []);
  } finally {
    fs.rmSync(tmp, { recursive: true, force: true });
  }
});
