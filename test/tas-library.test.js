import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import assert from "node:assert/strict";

import { TasLibrary } from "../lib/tas-library.js";

test("TasLibrary initializes built-ins and lists TAS movies for games", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "starlight-tas-"));
  const library = new TasLibrary(root);

  const allMovies = library.list();
  assert.ok(allMovies.length >= 3);

  const smbMovies = library.list("Super Mario Bros.");
  assert.ok(smbMovies.length >= 2);
  assert.ok(smbMovies.some((m) => m.category === "Any%"));
  assert.ok(smbMovies.some((m) => m.category === "All Levels"));

  const content = library.readContent(smbMovies[0].id);
  assert.ok(content.includes("version 3"));
  assert.ok(content.includes("|0|"));
});

test("TasLibrary allows uploading and managing custom TAS runs", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "starlight-tas-custom-"));
  const library = new TasLibrary(root);

  const customFm2 = [
    "version 3",
    "emuVersion 9813",
    "rerecordCount 50",
    "subtitle 0 Opening Scene",
    "subtitle 100 Boss Gate",
    "|0|........|",
    "|0|R......A|",
    "|0|R.....BA|",
  ].join("\n");

  const saved = library.saveCustomTas({
    gameId: "smb-0b3d9e1f",
    gameTitle: "Super Mario Bros.",
    title: "1-1 Speed Demo",
    category: "Individual Level",
    author: "SpeedyPlayer",
    description: "Lightning fast level 1-1",
    filename: "smb-1-1.fm2",
    content: customFm2,
  });

  assert.equal(saved.title, "1-1 Speed Demo");
  assert.equal(saved.author, "SpeedyPlayer");
  assert.equal(saved.totalFrames, 3);

  const found = library.get(saved.id);
  assert.ok(found);
  assert.equal(library.readContent(saved.id), customFm2);

  const deleted = library.delete(saved.id);
  assert.equal(deleted.ok, true);
  assert.equal(library.get(saved.id), null);
});
