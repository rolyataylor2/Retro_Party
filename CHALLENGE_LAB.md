# NES Challenge Lab

NES Challenge Lab is a custom, headless frontend for this FCEUmm fork. It turns the emulator into an instrumented simulation core that a browser UI can play, inspect, modify, teach, and package into small deterministic challenges.

## What works

- Real-time video and stereo audio from any supported ROM in the library, with safe runtime game switching.
- Keyboard controller input: arrows/WASD, Z/J for B, X/K for A, Enter for Start, and Shift for Select.
- In-memory quick save/load and reset.
- Side-effect-free access to the mapped 64 KB CPU address space, including direct reads, writes, and live watches.
- Classic memory search filters: changed, unchanged, increased, decreased, and exact value.
- RAM freeze modifiers plus raw and Game Genie codes through FCEUmm's cheat engine.
- Create Mini-Game workflow with an exact starting state, repeatable success demonstrations, negative counterexamples, ranked deterministic goal predicates, and a silent verification run.
- `.neschallenge` export/import. Packages contain the ROM hash, save state, goal rule, modifiers, time limit, and presentation metadata; they do not contain the ROM.

The goal learner currently generates and scores byte transitions, final-value predicates, and deltas. It uses consistency across successes, false positives in negative attempts, temporal proximity, and simplicity. Runtime detection is deterministic; an AI semantic-labeling layer can be added later without making gameplay depend on a model.

## Build and run

Requirements: macOS, Clang, GNU Make, and Node.js 20 or newer.

```sh
npm run build
npm test
npm start
```

Then open `http://127.0.0.1:3000`.

ROMs are discovered recursively under `roms/`; `roms/smb.nes` remains the main automated smoke-test fixture. ROM files, cached box art, save states, and generated challenge packages are ignored by Git.

## Architecture

- `src/cheat.c` exposes safe mapped-memory peek, poke, and snapshot primitives.
- `native/nes_web_frontend.cpp` is the browser libretro frontend. It is compiled with FCEUmm to WebAssembly, owns callbacks, and exposes RGBA/audio/state/memory buffers to the client runtime.
- `public/emulator/core-registry.js` is the system boundary. NES is the only registered core today; later systems provide another adapter with the same runtime contract.
- `public/emulator/session.js` runs free play, rewind, challenge playback, failure/goal evaluation, and creator training locally in each browser.
- `server.js` owns the active emulator, traces, memory search, modifiers, challenge packaging, and the HTTP API.
- `lib/game-library.js` scans ROMs, catalogs metadata and save states, retrieves box art, and builds smart playlists.
- `lib/goal-learner.js` contains the explainable goal-rule learner and runtime evaluator.
- `public/` contains the custom browser game UI and original generated pixel-art backdrop.

Each browser owns its own WebAssembly core instance. Node only serves ROM/state/package bytes and persists authored packages; it never advances emulator frames.
