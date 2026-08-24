import test from "node:test";
import assert from "node:assert/strict";

import { TasMovie, TasPlaybackEngine } from "../public/emulator/tas-player.js";

test("TasMovie parses FM2 text, subtitles, comments, and input bitmasks", () => {
  const sampleFm2 = [
    "version 3",
    "emuVersion 9813",
    "rerecordCount 120",
    "romFilename supermariobros.nes",
    "guid 12345678-1234-1234-1234-123456789abc",
    "comment Author: HappyLee",
    "comment Category: Any%",
    "subtitle 0 Title Screen",
    "subtitle 180 World 1-1",
    "subtitle 720 Bonus Room",
    "|0|........|",
    "|0|....T...|", // Start (bit 3 = 8)
    "|0|R......A|", // Right (bit 7 = 128) + A (bit 8 = 256) -> 384
    "|0|R.....BA|", // Right (128) + B (1) + A (256) -> 385
    "|0|..D..S..|", // Down (32) + Select (4) -> 36
    "|1|........|", // Reset flag
  ].join("\n");

  const movie = TasMovie.parse(sampleFm2, { title: "Super Mario Bros. Any%" });

  assert.equal(movie.author, "HappyLee");
  assert.equal(movie.category, "Any%");
  assert.equal(movie.totalFrames, 6);
  assert.equal(movie.subtitles.length, 3);
  assert.equal(movie.markers.length, 3);
  assert.equal(movie.markers[1].title, "World 1-1");

  // Verify bitmasks
  assert.equal(movie.getInput(0).mask, 0);
  assert.equal(movie.getInput(1).mask, 8); // Start
  assert.equal(movie.getInput(2).mask, 128 + 256); // Right + A
  assert.equal(movie.getInput(3).mask, 128 + 1 + 256); // Right + B + A
  assert.equal(movie.getInput(4).mask, 32 + 4); // Down + Select
  assert.equal(movie.getInput(5).reset, true); // Reset flag

  // Verify timecode formatting
  assert.equal(TasMovie.formatTimecode(0), "00:00.00");
  assert.equal(TasMovie.formatTimecode(3600), "01:00.00");
  assert.equal(TasMovie.formatTimecode(216000), "01:00:00.00");
});

test("TasMovie parses JSON movie structure", () => {
  const jsonTas = JSON.stringify({
    frames: [
      { mask: 128, reset: false },
      { mask: 384, reset: false },
      { mask: 0, reset: true },
    ],
    markers: [
      { frame: 0, title: "Start" },
      { frame: 1, title: "Action" },
    ],
  });

  const movie = TasMovie.parse(jsonTas, { title: "JSON Test" });
  assert.equal(movie.totalFrames, 3);
  assert.equal(movie.getInput(0).mask, 128);
  assert.equal(movie.getInput(2).reset, true);
  assert.equal(movie.markers.length, 2);
});

test("TasPlaybackEngine manages frame progression, seeking, and state cache", async () => {
  let runFrameCallCount = 0;
  let resetCallCount = 0;
  let saveStateCallCount = 0;
  let loadStateCallCount = 0;

  const mockCore = {
    runFrame: (mask) => {
      runFrameCallCount++;
      return { width: 256, height: 240, video: new Uint8Array(256 * 240 * 4), audio: new Int16Array(100), sampleRate: 48000 };
    },
    reset: () => { resetCallCount++; },
    saveState: () => {
      saveStateCallCount++;
      return new Uint8Array([1, 2, 3, saveStateCallCount]);
    },
    loadState: (state) => {
      loadStateCallCount++;
      return true;
    },
  };

  const mockSession = { core: mockCore };
  const engine = new TasPlaybackEngine(mockSession);
  engine.keyframeInterval = 10;

  const frames = [];
  for (let i = 0; i < 50; i++) {
    frames.push({ mask: i % 2 === 0 ? 128 : 256, reset: false });
  }
  const movie = new TasMovie({ title: "Test Movie" });
  movie.frames = frames;
  movie.totalFrames = frames.length;

  await engine.loadMovie(movie, 0);

  assert.equal(engine.currentFrame, 0);
  assert.equal(engine.stateCache.has(0), true);

  // Step forward
  engine.stepForward(1);
  assert.equal(engine.currentFrame, 1);

  // Seek to frame 25
  await engine.seekTo(25);
  assert.equal(engine.currentFrame, 25);
  assert.equal(engine.stateCache.has(25), true);
  assert.equal(engine.stateCache.has(10), true);
  assert.equal(engine.stateCache.has(20), true);

  // Seek backward to frame 12 (should restore state @ 10 and step 2 frames)
  const prevLoadCount = loadStateCallCount;
  await engine.seekTo(12);
  assert.equal(engine.currentFrame, 12);
  assert.ok(loadStateCallCount > prevLoadCount);

  // Active buttons helper
  const btns = engine.getActiveButtons();
  assert.equal(typeof btns.up, "boolean");
  assert.equal(typeof btns.a, "boolean");
});

test("TasPlaybackEngine supports live DVR recording, periodic savestates, and branching", () => {
  let saveCount = 0;
  const mockCore = {
    runFrame: (mask) => ({ width: 256, height: 240, video: new Uint8Array(256 * 240 * 4), audio: new Int16Array(10), sampleRate: 48000 }),
    reset: () => {},
    saveState: () => {
      saveCount++;
      return new Uint8Array([9, 8, 7, saveCount]);
    },
    loadState: () => true,
  };

  const engine = new TasPlaybackEngine({ core: mockCore });
  engine.keyframeInterval = 10;

  // Record 30 live frames
  for (let f = 0; f < 30; f++) {
    engine.recordLiveFrame(128, { width: 256, height: 240, video: new Uint8Array(256 * 240 * 4) });
  }

  assert.equal(engine.movie.totalFrames, 30);
  assert.equal(engine.currentFrame, 30);
  assert.equal(engine.stateCache.has(0), true);
  assert.equal(engine.stateCache.has(10), true);
  assert.equal(engine.stateCache.has(20), true);

  // Branch live play from frame 15
  engine.branchFromFrame(15);
  assert.equal(engine.movie.totalFrames, 15);
  assert.equal(engine.currentFrame, 15);
  assert.equal(engine.stateCache.has(20), false); // Cleared future cache

  // Record 5 new frames
  for (let f = 0; f < 5; f++) {
    engine.recordLiveFrame(256, { width: 256, height: 240, video: new Uint8Array(256 * 240 * 4) });
  }
  assert.equal(engine.movie.totalFrames, 20);
  assert.equal(engine.currentFrame, 20);
});
