# Starlight Party

This fork includes a full controller-first party game wrapped around a browser-hosted emulator runtime. It turns saved NES moments into a couch-game collection with:

- client-side WebAssembly emulation: video, audio, input, save states, rewind, memory instrumentation, goal detection, and mini-game training all run in each player's browser;
- a core registry and system-neutral runtime boundary, with NES registered today and room for future SNES or Game Boy adapters without coupling those systems to the UI;

- a persistent turn-based board game for one to four players, with an original six-character draft;
- two illustrated boards, animated step-by-step movement, red/blue space rewards, coins, stars, and the roaming BOLT-0 star shop;
- a filtered mini-game arcade grouped by category, source game, and player count;
- custom mini-game packs and reusable board rule sets;
- a teach-by-playing creator that learns deterministic goals from demonstrations;
- a multi-ROM cartridge library with live game switching and reusable per-game starting states;
- controller-friendly Library and Settings screens with ROM scanning and locally cached Libretro box art;
- automatic difficulty, genre, game, and series playlists that grow as mini-games are created;
- full-cartridge free play with a rolling rewind buffer and one-button creator handoff;
- server-persisted keyboard and controller bindings for play, save, rewind, creator, and training verdicts;
- server-side challenge packaging in `minigames/` (the ROM is never included);
- original procedural menu music, NES game audio, UI sound effects, and original party-game artwork.
- a server-persisted Party Mode where phones join a passive Prime display, the first player becomes Primary, and setup, full-round rolls, CPU turns, mini-game roulette, and live results stay synchronized.

Run it locally:

```sh
npm run build
npm test
npm start
```

Then open `http://127.0.0.1:3000`. Use a connected gamepad, or use the arrow keys to move, X/K/Enter to choose, and Z/J/Escape to go back. During NES play, arrows/WASD move, Z/J is B, X/K is A, and Enter is Start.

Choose **Party Studio** on the home screen or open `http://<server-address>:3000/party`. Start a room there, leave `http://<server-address>:3000/party/PLAY` on the passive primary display, and open `http://<server-address>:3000/party/player/PLAY` on every phone (replace `PLAY` with the room code). Rooms and private reconnect tokens are persisted in `data/party-rooms.json`.

Party Mode runs each active mini-game directly in each phone's browser. Its persistent Director queue controls setup, turns, step-by-step movement, landing rewards, roulette, results, rounds, CPU players, and final standings. Creator training history is stripped from cached play-only challenge packages, keeping the mini-game start path small and fast.

Party Studio includes the Map Maker, Scene Director, Event Builder, Rule Book, Game Parts, and Test Lab at `/party/editor/...`. The Haunted Harbor queue showcase runs at `http://<server-address>:3000/party/DEMO?demo=1`.

`npm run build` creates the browser NES core in `public/cores/nes/` and requires Emscripten (`emcc`). `npm run build:all` additionally builds the legacy native development artifacts; the application server does not load or execute them.

In collection menus, press NES **Select** (Shift by default) or right-click a mini-game, party pack, or rule set to open its edit/delete popover. The logo and music control are intentionally mouse-only and are excluded from controller navigation.

Party packs, rule sets, and board sessions are saved in `data/`. Created mini-games are saved as `.neschallenge` files in `minigames/`. See [CHALLENGE_LAB.md](CHALLENGE_LAB.md) for the emulator instrumentation and challenge format.

Add `.nes`, `.fds`, `.unf`, or `.unif` files anywhere under `roms/`, then choose **Settings → Scan ROM Folder**. **Download Missing Art** matches filenames against the community-maintained [Libretro thumbnail library](https://docs.libretro.com/guides/roms-playlists-thumbnails/) and caches results under `public/boxart/`. Thumbnail access is free and does not require an account; the underlying game artwork remains the property of its respective owners.

In the creator, choose and load a game first. You can play to a useful location and save it as a reusable **Starting Moment**, or load one already saved for that game, before capturing and training the mini-game.

Selecting a cartridge in **Game Library** now starts normal free play. Save the current moment, rewind recent play, or send that moment into the creator from the console toolbar or configured hotkeys. The emulator unloads after returning to menu-only screens. Control bindings live in **Settings → Control Room**.

When editing a saved mini-game, the final creator card offers a two-step delete action. Deleted packages are moved to `data/trash/minigames/` so an accidental deletion remains recoverable, and references are removed from custom packs.

To correct a mini-game, open **Mini Games → Edit**. The original starting state, learned goal, timing, and presentation are restored. Record false wins with **That Was a Loss**, demonstrate the real goal again, verify the revised rule, and save; the existing server package is updated in place.

# FCEUmm (libretro)

FCEUmm is a libretro core based on FCE Ultra "mappers modified", an
unofficial build of FCE Ultra by CaH4e3 that adds support for a large
number of extra mappers, including many obscure and unlicensed boards.
It emulates the NES, Famicom, Famicom Disk System and Dendy, including
the VS. System arcade hardware.

Licensed under the GNU GPL v2. See the source headers for details.

## Supported content

| Extension | Content |
|---|---|
| `.nes` | iNES / NES 2.0 ROM images |
| `.fds` | Famicom Disk System images (requires BIOS, see below) |
| `.unf` / `.unif` | UNIF ROM images |

Region (NTSC / PAL / Dendy) is detected automatically from the ROM
database and header, and can be forced with the **Region** core option.

## BIOS

| File | Description | Required |
|---|---|---|
| `disksys.rom` | Famicom Disk System BIOS (8 KB), placed in the frontend's system directory | For FDS content only |
| `gamegenie.nes` | Game Genie ROM, placed in the system directory | Only when the **Game Genie Add-On** option is enabled |
| `nes.pal` | Custom 64-entry palette (192 bytes RGB), placed in the system directory | Optional |

## Features

- Wide mapper coverage, including hundreds of multicart, pirate and
  homebrew boards on top of the standard licensed set.
- Full expansion audio: FDS, MMC5, Namco 163, Sunsoft 5B, VRC6 and
  VRC7, each with an individual volume/enable option, plus per-channel
  toggles for the five internal APU channels.
- Selectable output samplerate with an **Auto** mode that matches the
  frontend's preferred rate, quality levels, stereo delay effect,
  low-pass filter, square-duty swap for famiclone-style sound, and DMC
  pop reduction.
- 22 built-in colour palettes (Wavebeam, Royaltea, the FBX set, Sony
  CXA, RGB PPU and more), a raw palette mode, custom palette support
  (`nes.pal`) and automatic per-game palettes from the internal
  database.
- Blargg NTSC filter (composite / S-Video / RGB / monochrome).
- Overscan cropping with independent top/bottom/left/right controls.
- Aspect ratio options: 8:7 PAR, 4:3, and PP (pixel perfect).
- CPU overclocking (2x, with post-render or vblank timing) for
  reducing slowdown in demanding games.
- Optional removal of the 8-sprites-per-scanline limit.
- Turbo buttons with configurable period, and an option to allow
  simultaneous opposing d-pad directions.
- VS. System DIP switches and coin input via the frontend's core
  options.
- Game Genie add-on emulation, savestates, configurable RAM power-on
  state ($FF / $00 / per-game deterministic random), runahead support, and
  in-game saves for battery-backed boards and the FDS.
- **Mesen-format HD texture packs** with custom backgrounds and
  OGG/WAV music and sound effects (see below).

## Input devices

Selectable per port from the frontend's controller menu:

| Device | Notes |
|---|---|
| Gamepad | Standard controller; turbo A/B available |
| 4-Player Adaptor | Famicom 4-player adaptor / NES Four Score (auto-enabled for known games) |
| Zapper | Light gun; can be driven by mouse, pointer/touch, or a lightgun device. Both classic and Sequential Targets light guns are supported ("Gun Aux A" serves as the light-sensor input in Sequential Targets mode) |
| Arkanoid paddle | Mouse, pointer, absolute-mouse and Stelladaptor modes |
| Power Pad A/B | Both button layouts |
| Family Trainer A/B | Famicom mat controller |
| Family Keyboard / Subor keyboard / PEC-586 keyboard | Requires frontend keyboard focus (Game Focus mode) |
| Oeka Kids tablet | Pointer-driven |
| Space Shadow gun | Hyper Shot light gun |
| Hyper Shot pads | Konami Hyper Shot |
| Mouse | With adjustable sensitivity |
| Crosshair | On-screen crosshair for gun games can be toggled |

## HD texture packs

The core can replace a game's graphics with high-resolution artwork
and its music with streamed audio using HD packs in the format
established by the Mesen emulator (`hires.txt`, format versions up to
109). Existing Mesen packs work as-is; the core also accepts some
additional file formats (see below).

### Setting up a pack

1. Make sure the **HD Texture Packs (Restart)** core option is enabled
   (it is by default).
2. Place the pack in the frontend's **system directory** under
   `HdPacks/<rom name>/`, where `<rom name>` is the content file name
   without its extension. The pack's `hires.txt` must sit directly in
   that folder:

   ```
   <system>/
     HdPacks/
       Mega Man (USA)/
         hires.txt
         tiles.png
         music_01.ogg
         ...
   ```

   For example, loading `Mega Man (USA).nes` looks for
   `<system>/HdPacks/Mega Man (USA)/hires.txt`.

3. Load (or restart) the game. When a pack is found the core switches
   to XRGB8888 output at the pack's scale factor; the log will show
   `HD pack loaded: scale Nx, ...`.

If nothing changes on screen, check that the folder name matches the
ROM file name exactly and that the frontend supports 32-bit
(XRGB8888) video output.

### Supported pack features

- Replacement tiles for both CHR ROM and CHR RAM games, at any integer
  scale from 1x to 10x, with per-tile brightness and transparency.
- All Mesen condition types: `hmirror`, `vmirror`, `bgpriority`,
  `sppalette0-3`, `tileAtPosition`, `tileNearby`, `spriteAtPosition`,
  `spriteNearby`, `memoryCheck`, `memoryCheckConstant`,
  `ppuMemoryCheck`, `ppuMemoryCheckConstant`, `frameRange`,
  `positionCheckX/Y` and `originPositionCheckX/Y`, including the `!`
  inverted forms.
- Custom background layers with scroll ratios, 40 priority levels
  across four compositing depths, and Alpha / Add / Subtract blend
  modes.
- Additional sprites (`<addition>`), fallback tiles (`<fallback>` and
  the `automaticFallbackTiles` option), custom palettes
  (`palette.dat`), and the `<options>` flags `disableSpriteLimit`,
  `alternateRegisterRange`, `disableCache` and `disableOriginalTiles`.
- Background music and sound effects (`<bgm>` / `<sfx>`) driven by the
  game through the HD audio device at `$4100-$4106` (or the alternate
  `$3002 + N*$10` write / `$4018-$4019` read range), with BGM looping,
  loop positions, 16 simultaneous sound-effect voices, and volume
  registers. The currently playing BGM track and position are saved in
  savestates and resume on load.

### File formats

Images referenced by `<img>` and `<background>` may be:

| Format | Notes |
|---|---|
| `.png` | As in Mesen |
| `.dds` | libretro extension; uncompressed and BC1-BC5 block-compressed |
| `.webp` | libretro extension; lossless (VP8L) and lossy (VP8) |

Audio referenced by `<bgm>` and `<sfx>` may be:

| Format | Notes |
|---|---|
| `.ogg` | Ogg Vorbis, as in Mesen |
| `.wav` | libretro extension; 16-bit PCM, mono or stereo, any samplerate |

### Differences from Mesen

- `<patch>` tags are fully supported: the pack's IPS is applied to an
  in-memory copy of the ROM at load time when the ROM's SHA-1 matches
  the tag (a mismatching ROM revision runs unpatched, with a log
  message). The original file on disk is never modified.
- A pack's `<overscan>` setting is parsed but the core's own overscan
  crop options control the visible area.
- The Blargg NTSC filter is bypassed while a pack is active (the HD
  frame is composed directly).
- Mid-scanline palette changes are approximated per scanline.
- The PEC-586 board's interleaved CHR fetch layout is not supported.
- HD pack support is compiled out on very constrained targets
  (PS2, PSP, 3DS, DOS, GameCube, Wii).

## Building

```
make -f Makefile.libretro
```

Cross builds use the usual `platform=` targets (`win`, `osx`, `ios`,
`android`, `emscripten`, `wiiu`, `psl1ght`, `vita`, `libnx`, the
`windows_msvc*` toolchains, and others - see `Makefile.libretro`).
HD texture pack support is controlled by `HAVE_HDPACK` (enabled by
default on capable platforms) and bundles its own prefixed zlib, so no
external zlib is required on any target.
