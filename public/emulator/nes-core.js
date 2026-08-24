const copyFromHeap = (heap, pointer, length) => heap.slice(pointer, pointer + length);

let cachedWasmBinary = null;
let wasmFetchPromise = null;

async function getWasmBinary() {
  if (cachedWasmBinary) return cachedWasmBinary;
  if (!wasmFetchPromise) {
    wasmFetchPromise = fetch("/cores/nes/fceumm.wasm")
      .then((res) => {
        if (!res.ok) throw new Error("The NES WebAssembly core binary could not be downloaded");
        return res.arrayBuffer();
      })
      .then((buffer) => {
        cachedWasmBinary = buffer;
        return buffer;
      });
  }
  return wasmFetchPromise;
}

export class NesBrowserCore {
  static async preload() {
    return getWasmBinary();
  }

  static async create() {
    const [{ default: createFceumm }, wasmBinary] = await Promise.all([
      import("/cores/nes/fceumm.js"),
      getWasmBinary(),
    ]);
    const module = await createFceumm({
      wasmBinary: wasmBinary.slice(0),
      locateFile: (file) => `/cores/nes/${file}`,
    });
    const core = new NesBrowserCore(module);
    if (!core.api.init()) throw new Error("The NES WebAssembly core could not initialize");
    return core;
  }

  constructor(module) {
    this.module = module;
    this.loaded = false;
    this.api = {
      init: module.cwrap("web_init", "number", []),
      load: module.cwrap("web_load_game", "number", ["string", "number", "number"]),
      unload: module.cwrap("web_unload_game", null, []),
      run: module.cwrap("web_run_frame", null, ["number"]),
      reset: module.cwrap("web_reset", null, []),
      width: module.cwrap("web_width", "number", []),
      height: module.cwrap("web_height", "number", []),
      rate: module.cwrap("web_sample_rate", "number", []),
      videoPointer: module.cwrap("web_video_pointer", "number", []),
      videoSize: module.cwrap("web_video_size", "number", []),
      audioPointer: module.cwrap("web_audio_pointer", "number", []),
      audioFrames: module.cwrap("web_audio_frames", "number", []),
      saveState: module.cwrap("web_save_state", "number", []),
      stateSize: module.cwrap("web_state_size", "number", []),
      loadState: module.cwrap("web_load_state", "number", ["number", "number"]),
      snapshot: module.cwrap("web_snapshot", "number", []),
      peek: module.cwrap("web_peek", "number", ["number"]),
      poke: module.cwrap("web_poke", "number", ["number", "number"]),
      resetCheats: module.cwrap("web_reset_cheats", null, []),
    };
  }

  withBytes(bytes, callback) {
    const source = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
    const pointer = this.module._malloc(source.byteLength);
    try {
      this.module.HEAPU8.set(source, pointer);
      return callback(pointer, source.byteLength);
    } finally {
      this.module._free(pointer);
    }
  }

  async loadGame(game, bytes) {
    const ok = this.withBytes(bytes, (pointer, size) => this.api.load(game.fileHint || `${game.id}.nes`, pointer, size));
    if (!ok) throw new Error(`The NES core could not load ${game.title || game.fileHint}`);
    this.loaded = true;
    return { width: this.api.width(), height: this.api.height(), sampleRate: this.api.rate() };
  }

  unloadGame() {
    if (this.loaded) this.api.unload();
    this.loaded = false;
  }

  runFrame(mask = 0) {
    if (!this.loaded) throw new Error("No game is loaded in the browser core");
    this.api.run(mask & 0xffff);
    const videoBytes = this.api.videoSize();
    const audioFrames = this.api.audioFrames();
    return {
      width: this.api.width(), height: this.api.height(), sampleRate: this.api.rate(),
      video: copyFromHeap(this.module.HEAPU8, this.api.videoPointer(), videoBytes),
      audio: new Int16Array(copyFromHeap(this.module.HEAPU8, this.api.audioPointer(), audioFrames * 4).buffer),
    };
  }

  saveState() {
    const pointer = this.api.saveState();
    if (!pointer) throw new Error("Could not serialize emulator state");
    return copyFromHeap(this.module.HEAPU8, pointer, this.api.stateSize());
  }

  loadState(bytes) { return Boolean(this.withBytes(bytes, (pointer, size) => this.api.loadState(pointer, size))); }
  snapshot() {
    const pointer = this.api.snapshot();
    if (!pointer) throw new Error("Could not capture emulator memory");
    return copyFromHeap(this.module.HEAPU8, pointer, 0x20000);
  }
  peek(address) { const value = this.api.peek(address & 0xffff); return value < 0 ? null : value; }
  poke(address, value) { return Boolean(this.api.poke(address & 0xffff, value & 0xff)); }
  reset() { this.api.reset(); }
  resetCheats() { this.api.resetCheats(); }
}
