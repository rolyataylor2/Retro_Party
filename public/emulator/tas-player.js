export class TasMovie {
  constructor(metadata = {}) {
    this.id = metadata.id || `tas-${Date.now()}`;
    this.title = metadata.title || "TAS Movie";
    this.gameTitle = metadata.gameTitle || "NES Game";
    this.gameId = metadata.gameId || null;
    this.category = metadata.category || "Any%";
    this.author = metadata.author || "TAS Author";
    this.description = metadata.description || "";
    this.format = metadata.format || "fm2";
    this.headers = {};
    this.subtitles = [];
    this.markers = [];
    this.frames = []; // Array of { mask: number, reset: boolean, comment?: string }
    this.totalFrames = 0;
  }

  static parse(content, metadata = {}) {
    const movie = new TasMovie(metadata);
    if (!content || typeof content !== "string") return movie;

    // Check if JSON
    const trimmed = content.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      try {
        const parsed = JSON.parse(trimmed);
        if (Array.isArray(parsed)) {
          movie.frames = parsed.map((item) => {
            if (typeof item === "number") return { mask: item, reset: false };
            return { mask: item.mask || 0, reset: Boolean(item.reset) };
          });
        } else if (parsed.frames) {
          movie.frames = parsed.frames;
          movie.subtitles = parsed.subtitles || [];
          movie.markers = parsed.markers || [];
        }
        movie.totalFrames = movie.frames.length;
        movie.buildMarkers();
        return movie;
      } catch {}
    }

    // Parse FM2 / BK2 / text format
    const lines = content.split(/\r?\n/);
    for (let index = 0; index < lines.length; index++) {
      const line = lines[index].trim();
      if (!line) continue;

      // FM2 Header
      if (/^[a-zA-Z0-9_-]+\s+/.test(line) && !line.startsWith("|")) {
        const spaceIndex = line.indexOf(" ");
        const key = line.slice(0, spaceIndex).trim();
        const val = line.slice(spaceIndex + 1).trim();
        movie.headers[key] = val;

        if (key.toLowerCase() === "subtitle") {
          // Format: subtitle <frame> <text>
          const subMatch = val.match(/^([0-9]+)\s+(.+)$/);
          if (subMatch) {
            movie.subtitles.push({
              frame: Number(subMatch[1]),
              title: subMatch[2].trim(),
            });
          }
        } else if (key.toLowerCase() === "comment" && val.toLowerCase().startsWith("author:")) {
          movie.author = val.replace(/^author:\s*/i, "");
        } else if (key.toLowerCase() === "comment" && val.toLowerCase().startsWith("category:")) {
          movie.category = val.replace(/^category:\s*/i, "");
        }
        continue;
      }

      // Input log line: |flags|port0|port1|...|
      if (line.startsWith("|")) {
        // Remove leading and trailing empty entries
        const parts = line.split("|").slice(1, -1);
        let reset = false;
        let p1Str = "";

        if (parts.length >= 2) {
          const flagStr = parts[0];
          reset = flagStr.includes("1") || flagStr.includes("2") || flagStr.toLowerCase().includes("r");
          p1Str = parts[1];
        } else if (parts.length === 1) {
          p1Str = parts[0];
        }

        const mask = TasMovie.parseButtons(p1Str);
        movie.frames.push({ mask, reset, raw: p1Str });
      }
    }

    movie.totalFrames = movie.frames.length;
    movie.buildMarkers();
    return movie;
  }

  static parseButtons(str) {
    if (!str) return 0;
    let mask = 0;
    const p = str.trim();

    // Standard FM2 format is 8 characters matching R L D U T S B A (or R L D U S T B A)
    // Position 0: R (Right) -> 1 << 7 (128)
    // Position 1: L (Left)  -> 1 << 6 (64)
    // Position 2: D (Down)  -> 1 << 5 (32)
    // Position 3: U (Up)    -> 1 << 4 (16)
    // Position 4: T (Start) or S (Select)
    // Position 5: S (Select) or T (Start)
    // Position 6: B (B)     -> 1 << 0 (1)
    // Position 7: A (A)     -> 1 << 8 (256)
    if (p.length >= 8) {
      if (p[0] === 'R' || p[0] === 'r') mask |= (1 << 7);
      if (p[1] === 'L' || p[1] === 'l') mask |= (1 << 6);
      if (p[2] === 'D' || p[2] === 'd') mask |= (1 << 5);
      if (p[3] === 'U' || p[3] === 'u') mask |= (1 << 4);

      // Start vs Select positions
      if (p[4] === 'T' || p[4] === 't') mask |= (1 << 3);
      else if (p[4] === 'S' || p[4] === 's') {
        if (p[5] === 'T' || p[5] === 't') mask |= (1 << 2); // 4=Select, 5=Start
        else mask |= (1 << 3); // 4=Start, 5=Select
      }

      if (p[5] === 'T' || p[5] === 't') mask |= (1 << 3);
      else if (p[5] === 'S' || p[5] === 's') mask |= (1 << 2);

      if (p[6] === 'B' || p[6] === 'b') mask |= (1 << 0);
      if (p[7] === 'A' || p[7] === 'a') mask |= (1 << 8);
      return mask;
    }

    // Fallback for non-8-char / mnemonic strings
    const s = p.toUpperCase();
    if (s.includes("R") && !s.includes("RESET")) mask |= (1 << 7);
    if (s.includes("L")) mask |= (1 << 6);
    if (s.includes("D")) mask |= (1 << 5);
    if (s.includes("U")) mask |= (1 << 4);
    if (s.includes("T") || s.includes("START")) mask |= (1 << 3);
    if (s.includes("SEL") || s.includes("SELECT")) mask |= (1 << 2);
    if (s.includes("B")) mask |= (1 << 0);
    if (s.includes("A")) mask |= (1 << 8);

    return mask;
  }

  buildMarkers() {
    if (this.markers.length === 0 && this.subtitles.length > 0) {
      this.markers = [...this.subtitles];
    }
    if (!this.markers.length) {
      const total = Math.max(this.totalFrames, 1800);
      const step = Math.min(1800, Math.floor(total / 6)); // ~30 second chunks
      this.markers.push({ frame: 0, title: "Start / Boot" });
      for (let f = step; f < total; f += step) {
        const timecode = TasMovie.formatTimecode(f);
        this.markers.push({ frame: f, title: `Checkpoint (${timecode})` });
      }
    }
    this.markers.sort((a, b) => a.frame - b.frame);
  }

  addMarker(frame, title) {
    const existing = this.markers.find((m) => m.frame === frame);
    if (existing) {
      existing.title = title;
    } else {
      this.markers.push({ frame, title: String(title).trim().slice(0, 50) });
      this.markers.sort((a, b) => a.frame - b.frame);
    }
  }

  removeMarker(frame) {
    this.markers = this.markers.filter((m) => m.frame !== frame);
  }

  getInput(frameIndex) {
    if (frameIndex < 0 || frameIndex >= this.frames.length) return { mask: 0, reset: false };
    return this.frames[frameIndex];
  }

  static formatTimecode(frame) {
    const totalFrames = Math.max(0, Math.floor(frame));
    const fractionalFrames = totalFrames % 60;
    const totalSeconds = Math.floor(totalFrames / 60);
    const hours = Math.floor(totalSeconds / 3600);
    const minutes = Math.floor((totalSeconds % 3600) / 60);
    const seconds = totalSeconds % 60;

    const pad = (n, len = 2) => String(n).padStart(len, "0");
    if (hours > 0) {
      return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}.${pad(fractionalFrames)}`;
    }
    return `${pad(minutes)}:${pad(seconds)}.${pad(fractionalFrames)}`;
  }
}

export class TasPlaybackEngine {
  constructor(emulatorSession) {
    this.session = emulatorSession;
    this.movie = null;
    this.currentFrame = 0;
    this.isPlaying = false;
    this.playbackSpeed = 1.0; // 0.25, 0.5, 1, 2, 4
    this.stateCache = new Map(); // frameIndex -> stateBuffer (Uint8Array)
    this.screenshotCache = new Map(); // frameIndex -> dataUrl (string)
    this.keyframeInterval = 60; // Cache state and screenshot every 60 frames (~1 sec)
    this.onFrameUpdate = null;
    this.onStateCached = null;
    this.animFrameId = null;
    this.lastRenderTime = 0;
    this.accumulator = 0;
    this.isSeeking = false;
    this.bgIndexerActive = false;
    this.lastOutput = null;
    this.isLiveRecording = false;

    // Reusable offscreen thumbnail canvas
    if (typeof document !== "undefined") {
      this.thumbCanvas = document.createElement("canvas");
      this.thumbCanvas.width = 128;
      this.thumbCanvas.height = 120;
      this.thumbCtx = this.thumbCanvas.getContext("2d", { alpha: false });
      if (this.thumbCtx) this.thumbCtx.imageSmoothingEnabled = true;
    }
  }

  createThumbnail(output) {
    if (!output?.video || !this.thumbCtx) return null;
    try {
      const { width, height, video } = output;
      const srcCanvas = document.createElement("canvas");
      srcCanvas.width = width;
      srcCanvas.height = height;
      const srcCtx = srcCanvas.getContext("2d", { alpha: false });
      const imgData = new ImageData(new Uint8ClampedArray(video.buffer, video.byteOffset, video.byteLength), width, height);
      srcCtx.putImageData(imgData, 0, 0);
      
      this.thumbCtx.drawImage(srcCanvas, 0, 0, this.thumbCanvas.width, this.thumbCanvas.height);
      return this.thumbCanvas.toDataURL("image/jpeg", 0.6);
    } catch {
      return null;
    }
  }

  cleanMaskForCore(mask) {
    let m = mask || 0;
    // If both Right (128) and Left (64) are active, keep Right so the core's default SOCD filter doesn't zero both out
    if ((m & 128) && (m & 64)) {
      m &= ~64;
    }
    if ((m & 16) && (m & 32)) {
      m &= ~32;
    }
    return m;
  }

  async loadMovie(movie, initialFrame = 0, startState = null) {
    this.pause();
    this.movie = movie;
    this.stateCache.clear();
    this.screenshotCache.clear();
    this.currentFrame = 0;
    this.lastOutput = null;

    // Reset core or load starting state, and cache frame 0 initial state & thumbnail
    if (this.session.core) {
      if (startState) {
        this.session.core.loadState(startState);
      } else {
        this.session.core.reset();
      }
      const state0 = startState || this.session.core.saveState();
      this.stateCache.set(0, state0);
      const input0 = this.movie.getInput(0);
      this.lastOutput = this.session.core.runFrame(this.cleanMaskForCore(input0.mask));
      const thumb0 = this.createThumbnail(this.lastOutput);
      if (thumb0) this.screenshotCache.set(0, thumb0);
      this.session.core.loadState(state0);
    }

    if (initialFrame > 0) {
      await this.seekTo(initialFrame);
    }

    this.notifyUpdate(this.lastOutput);
  }

  recordLiveFrame(mask = 0, output = null) {
    if (!this.movie) {
      this.movie = new TasMovie({
        id: `dvr-${Date.now()}`,
        title: "Live Gameplay Recording",
        category: "Live",
      });
    }

    const frameIdx = this.movie.frames.length;
    this.movie.frames.push({ mask, reset: false });
    this.movie.totalFrames = this.movie.frames.length;
    this.currentFrame = this.movie.totalFrames;

    if (output) this.lastOutput = output;

    // Periodic state & screenshot caching
    if (frameIdx % this.keyframeInterval === 0 && this.session.core) {
      this.stateCache.set(frameIdx, this.session.core.saveState());
      if (output) {
        const thumb = this.createThumbnail(output);
        if (thumb) this.screenshotCache.set(frameIdx, thumb);
      }
      if (this.onStateCached) this.onStateCached(frameIdx, this.getCachedRatio());
    }

    this.notifyUpdate(this.lastOutput);
  }

  branchFromFrame(targetFrame) {
    if (!this.movie) return;
    const target = Math.max(0, Math.min(targetFrame, this.movie.totalFrames));
    this.movie.frames = this.movie.frames.slice(0, target);
    this.movie.totalFrames = this.movie.frames.length;
    this.currentFrame = target;

    // Clear future caches beyond target
    for (const key of Array.from(this.stateCache.keys())) {
      if (key > target) this.stateCache.delete(key);
    }
    for (const key of Array.from(this.screenshotCache.keys())) {
      if (key > target) this.screenshotCache.delete(key);
    }

    // Load state at target
    this.seekTo(target);
  }

  getThumbnailForFrame(frameIndex) {
    if (this.screenshotCache.has(frameIndex)) {
      return this.screenshotCache.get(frameIndex);
    }
    // Find closest preceding thumbnail
    let nearest = -1;
    for (const k of this.screenshotCache.keys()) {
      if (k <= frameIndex && k > nearest) nearest = k;
    }
    return nearest >= 0 ? this.screenshotCache.get(nearest) : null;
  }

  renderCurrentFrame() {
    return this.lastOutput;
  }

  async seekTo(targetFrame, onProgress = null) {
    if (!this.movie || !this.session.core) return;
    const total = this.movie.totalFrames;
    const target = Math.max(0, Math.min(targetFrame, total));

    this.isSeeking = true;

    // 1. Check exact cache match
    if (this.stateCache.has(target)) {
      const exactState = this.stateCache.get(target);
      this.session.core.loadState(exactState);
      this.currentFrame = target;
      // Get preview frame without corrupting state
      const input = this.movie.getInput(target);
      this.lastOutput = this.session.core.runFrame(this.cleanMaskForCore(input.mask));
      this.session.core.loadState(exactState);
      this.isSeeking = false;
      this.notifyUpdate(this.lastOutput);
      return;
    }

    // 2. Find closest preceding cached keyframe K <= target
    let nearestK = 0;
    for (const cachedFrame of this.stateCache.keys()) {
      if (cachedFrame <= target && cachedFrame > nearestK) {
        nearestK = cachedFrame;
      }
    }

    // 3. Load nearest cached state
    const baseState = this.stateCache.get(nearestK);
    if (baseState) {
      this.session.core.loadState(baseState);
    } else {
      this.session.core.reset();
    }

    // 4. Fast forward from nearestK to target without audio/video render
    const stepBatch = 120;
    let finalOutput = null;
    for (let f = nearestK; f < target; f++) {
      const frameInput = this.movie.getInput(f);
      if (frameInput.reset) {
        this.session.core.reset();
      } else {
        finalOutput = this.session.core.runFrame(this.cleanMaskForCore(frameInput.mask));
      }

      // Periodically cache keyframes and screenshots along the way
      if (f % this.keyframeInterval === 0 && !this.stateCache.has(f)) {
        this.stateCache.set(f, this.session.core.saveState());
        if (finalOutput) {
          const thumb = this.createThumbnail(finalOutput);
          if (thumb) this.screenshotCache.set(f, thumb);
        }
        if (this.onStateCached) this.onStateCached(f, this.getCachedRatio());
      }

      if (onProgress && f % stepBatch === 0) {
        onProgress((f - nearestK) / (target - nearestK || 1));
      }
    }

    // If target === nearestK (e.g. 0), generate output
    if (!finalOutput) {
      const curInput = this.movie.getInput(target);
      const state = this.session.core.saveState();
      finalOutput = this.session.core.runFrame(this.cleanMaskForCore(curInput.mask));
      this.session.core.loadState(state);
    }

    // 5. Cache target state
    const finalState = this.session.core.saveState();
    this.stateCache.set(target, finalState);
    if (finalOutput && !this.screenshotCache.has(target)) {
      const thumb = this.createThumbnail(finalOutput);
      if (thumb) this.screenshotCache.set(target, thumb);
    }
    this.currentFrame = target;
    this.lastOutput = finalOutput;
    this.isSeeking = false;
    this.notifyUpdate(this.lastOutput);
  }

  stepForward(frames = 1) {
    if (!this.movie || !this.session.core) return;
    this.pause();
    const target = Math.min(this.currentFrame + frames, this.movie.totalFrames - 1);
    if (target === this.currentFrame + 1) {
      const input = this.movie.getInput(this.currentFrame);
      if (input.reset) {
        this.session.core.reset();
      } else {
        this.lastOutput = this.session.core.runFrame(this.cleanMaskForCore(input.mask));
      }
      this.currentFrame = target;
      if (this.currentFrame % this.keyframeInterval === 0 && !this.stateCache.has(this.currentFrame)) {
        this.stateCache.set(this.currentFrame, this.session.core.saveState());
        const thumb = this.createThumbnail(this.lastOutput);
        if (thumb) this.screenshotCache.set(this.currentFrame, thumb);
      }
      this.notifyUpdate(this.lastOutput);
    } else {
      this.seekTo(target);
    }
  }

  stepBackward(frames = 1) {
    if (!this.movie || !this.session.core) return;
    this.pause();
    const target = Math.max(0, this.currentFrame - frames);
    this.seekTo(target);
  }

  play() {
    if (!this.movie || !this.session.core || this.isPlaying) return;
    this.isPlaying = true;
    this.lastRenderTime = performance.now();
    this.accumulator = 0;
    this.loop();
    this.notifyUpdate(this.lastOutput);
  }

  pause() {
    if (!this.isPlaying) return;
    this.isPlaying = false;
    if (this.animFrameId) {
      cancelAnimationFrame(this.animFrameId);
      this.animFrameId = null;
    }
    this.notifyUpdate(this.lastOutput);
  }

  togglePlay() {
    if (this.isPlaying) this.pause();
    else this.play();
  }

  setSpeed(speed) {
    this.playbackSpeed = Math.max(0.1, Number(speed) || 1.0);
    this.notifyUpdate(this.lastOutput);
  }

  loop = () => {
    if (!this.isPlaying) return;
    const now = performance.now();
    const elapsed = (now - this.lastRenderTime) / 1000;
    this.lastRenderTime = now;

    // NES frame rate ~60.0988 fps -> dt per frame ~ 1/60.0988 s
    const targetFrameDuration = 1 / 60.0988;
    this.accumulator += elapsed * this.playbackSpeed;

    const maxFramesPerTick = 10;
    let framesAdvanced = 0;
    let lastOutput = null;

    while (this.accumulator >= targetFrameDuration && framesAdvanced < maxFramesPerTick) {
      if (this.currentFrame >= this.movie.totalFrames - 1) {
        this.pause();
        break;
      }
      const input = this.movie.getInput(this.currentFrame);
      if (input.reset) {
        this.session.core.reset();
      } else {
        lastOutput = this.session.core.runFrame(this.cleanMaskForCore(input.mask));
      }
      this.currentFrame++;
      framesAdvanced++;
      this.accumulator -= targetFrameDuration;

      // Periodically cache
      if (this.currentFrame % this.keyframeInterval === 0 && !this.stateCache.has(this.currentFrame)) {
        this.stateCache.set(this.currentFrame, this.session.core.saveState());
        if (lastOutput) {
          const thumb = this.createThumbnail(lastOutput);
          if (thumb) this.screenshotCache.set(this.currentFrame, thumb);
        }
        if (this.onStateCached) this.onStateCached(this.currentFrame, this.getCachedRatio());
      }
    }

    if (this.accumulator > targetFrameDuration * 2) {
      this.accumulator = 0;
    }

    if (lastOutput) {
      this.lastOutput = lastOutput;
    }

    this.notifyUpdate(this.lastOutput);

    if (this.isPlaying) {
      this.animFrameId = requestAnimationFrame(this.loop);
    }
  };

  getCachedRatio() {
    if (!this.movie || this.movie.totalFrames <= 0) return 0;
    return Math.min(1.0, this.stateCache.size / (Math.ceil(this.movie.totalFrames / this.keyframeInterval) || 1));
  }

  getActiveButtons() {
    if (!this.movie) return { up: false, down: false, left: false, right: false, a: false, b: false, select: false, start: false };
    const input = this.movie.getInput(this.currentFrame);
    const mask = input.mask || 0;
    return {
      b: Boolean(mask & (1 << 0)),
      select: Boolean(mask & (1 << 2)),
      start: Boolean(mask & (1 << 3)),
      up: Boolean(mask & (1 << 4)),
      down: Boolean(mask & (1 << 5)),
      left: Boolean(mask & (1 << 6)),
      right: Boolean(mask & (1 << 7)),
      a: Boolean(mask & (1 << 8)),
      reset: Boolean(input.reset),
    };
  }

  getCurrentChapter() {
    if (!this.movie || !this.movie.markers.length) return null;
    let active = this.movie.markers[0];
    for (const marker of this.movie.markers) {
      if (marker.frame <= this.currentFrame) {
        active = marker;
      } else {
        break;
      }
    }
    return active;
  }

  notifyUpdate(output = this.lastOutput) {
    if (this.onFrameUpdate) {
      this.onFrameUpdate({
        currentFrame: this.currentFrame,
        totalFrames: this.movie ? this.movie.totalFrames : 0,
        timecode: TasMovie.formatTimecode(this.currentFrame),
        totalTimecode: TasMovie.formatTimecode(this.movie ? this.movie.totalFrames : 0),
        isPlaying: this.isPlaying,
        speed: this.playbackSpeed,
        buttons: this.getActiveButtons(),
        chapter: this.getCurrentChapter(),
        cachedRatio: this.getCachedRatio(),
      }, output);
    }
  }

  captureState() {
    if (!this.session.core) throw new Error("No active emulator core");
    return this.session.core.saveState();
  }
}
