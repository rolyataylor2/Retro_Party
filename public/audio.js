const TRACKS = {
  title: "/assets/music/title_screen.mp3",
  menu: "/assets/music/menu_main.mp3",
};

export class PartyAudio {
  constructor() {
    this.context = null;
    this.master = null;
    const saved = typeof localStorage !== "undefined" ? localStorage.getItem("starlight_music_enabled") : null;
    this.enabled = saved !== "false";
    this.theme = "title";
    this.currentTrack = null;
    this.activeAudio = null;
    this.audioElements = new Map();
    this.targetVolume = 0.55;
  }

  start() {
    if (!this.enabled) return;
    if (!this.context) {
      const AudioCtor = window.AudioContext || window.webkitAudioContext;
      if (AudioCtor) {
        this.context = new AudioCtor({ latencyHint: "interactive" });
        this.master = this.context.createGain();
        this.master.gain.value = 0.55;
        this.master.connect(this.context.destination);
      }
    }
    if (this.context && this.context.state === "suspended") {
      this.context.resume().catch(() => {});
    }

    // Ensure appropriate track is playing for current route
    let trackName = this.theme === "title" ? "title" : (new Set(["home", "minigames", "games", "settings", "packs", "rules", "board-setup", "board"]).has(this.theme) ? "menu" : null);

    if (trackName) {
      const el = this.getAudioElement(trackName);
      if (el && (el.paused || this.activeAudio !== el)) {
        if (this.activeAudio && this.activeAudio !== el) {
          this.activeAudio.pause();
          this.activeAudio.currentTime = 0;
        }
        this.currentTrack = trackName;
        this.activeAudio = el;
        el.volume = this.targetVolume;
        if (trackName === "title" && el.currentTime < 1.0) {
          el.currentTime = 1.0;
        }
        el.play().catch(() => {});
      }
    }
  }

  getAudioElement(trackName) {
    if (!this.audioElements.has(trackName)) {
      const src = TRACKS[trackName];
      if (!src) return null;
      const el = new Audio(src);
      el.loop = true;
      el.preload = "auto";
      this.audioElements.set(trackName, el);
    }
    return this.audioElements.get(trackName);
  }

  playTrackForRoute(route) {
    if (!this.enabled) return;
    let trackName = null;
    if (route === "title") {
      trackName = "title";
    } else if (new Set(["home", "minigames", "games", "settings", "packs", "rules", "board-setup", "board"]).has(route)) {
      trackName = "menu";
    } else {
      // In-game gameplay or editor: pause / mute menu music
      trackName = null;
    }

    if (!trackName) {
      this.fadeOutCurrent(300);
      this.currentTrack = null;
      return;
    }

    if (trackName === this.currentTrack && this.activeAudio && !this.activeAudio.paused) {
      return;
    }

    const nextAudio = this.getAudioElement(trackName);
    if (!nextAudio) return;

    if (this.activeAudio && this.activeAudio !== nextAudio) {
      const prevAudio = this.activeAudio;
      this.fadeOutElement(prevAudio, 250, () => {
        prevAudio.pause();
        prevAudio.currentTime = 0;
      });
    }

    this.currentTrack = trackName;
    this.activeAudio = nextAudio;
    nextAudio.volume = this.targetVolume;
    if (trackName === "title" && nextAudio.currentTime < 1.0) {
      nextAudio.currentTime = 1.0;
    }
    const playPromise = nextAudio.play();
    if (playPromise) {
      playPromise.catch(() => {
        // Will start on first user interaction via start()
      });
    }
  }

  fadeOutCurrent(duration = 400, onDone = null) {
    if (this.activeAudio) {
      const el = this.activeAudio;
      this.fadeOutElement(el, duration, () => {
        el.pause();
        if (onDone) onDone();
      });
    } else if (onDone) {
      onDone();
    }
  }

  fadeOutElement(el, duration = 300, onDone = null) {
    if (!el) {
      if (onDone) onDone();
      return;
    }
    const startVol = el.volume;
    if (startVol <= 0.01) {
      el.volume = 0;
      if (onDone) onDone();
      return;
    }
    const startTime = performance.now();
    const fade = () => {
      const elapsed = performance.now() - startTime;
      const progress = Math.min(1, elapsed / duration);
      el.volume = Math.max(0, startVol * (1 - progress));
      if (progress < 1) {
        requestAnimationFrame(fade);
      } else {
        el.volume = 0;
        if (onDone) onDone();
      }
    };
    requestAnimationFrame(fade);
  }

  fadeInElement(el, targetVol = 0.55, duration = 400) {
    if (!el || !this.enabled) return;
    const startTime = performance.now();
    const startVol = el.volume;
    const fade = () => {
      if (!this.enabled || this.activeAudio !== el) return;
      const elapsed = performance.now() - startTime;
      const progress = Math.min(1, elapsed / duration);
      el.volume = Math.min(targetVol, startVol + (targetVol - startVol) * progress);
      if (progress < 1) {
        requestAnimationFrame(fade);
      } else {
        el.volume = targetVol;
      }
    };
    requestAnimationFrame(fade);
  }

  setTheme(route) {
    this.theme = route;
    this.playTrackForRoute(route);
  }

  tone(frequency, duration, gain, type = "square", destination = this.master, delay = 0) {
    if (!this.context || !this.enabled) return;
    const now = this.context.currentTime + delay;
    const oscillator = this.context.createOscillator();
    const envelope = this.context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    envelope.gain.setValueAtTime(.0001, now);
    envelope.gain.exponentialRampToValueAtTime(gain, now + .012);
    envelope.gain.exponentialRampToValueAtTime(.0001, now + duration);
    oscillator.connect(envelope).connect(destination);
    oscillator.start(now);
    oscillator.stop(now + duration + .02);
  }

  sfx(name) {
    this.start();
    const patterns = {
      move: [[660, .035, .05]],
      confirm: [[523, .07, .09], [784, .1, .08, .06]],
      back: [[440, .07, .07], [294, .1, .06, .055]],
      roll: [[220, .05, .08], [330, .05, .08, .06], [494, .08, .1, .12]],
      win: [[523, .1, .1], [659, .1, .1, .1], [784, .1, .1, .2], [1047, .28, .12, .3]],
      save: [[392, .08, .08], [523, .08, .09, .08], [659, .2, .1, .16]],
    };
    for (const [frequency, duration, gain, delay = 0] of patterns[name] || patterns.confirm) this.tone(frequency, duration, gain, "square", this.master, delay);
  }

  toggle() {
    this.enabled = !this.enabled;
    if (typeof localStorage !== "undefined") {
      localStorage.setItem("starlight_music_enabled", String(this.enabled));
    }
    if (this.enabled) {
      this.start();
      if (this.master && this.context) this.master.gain.setTargetAtTime(.55, this.context.currentTime, .05);
      if (this.activeAudio) {
        this.activeAudio.play().then(() => {
          this.fadeInElement(this.activeAudio, this.targetVolume, 200);
        }).catch(() => {});
      } else {
        this.playTrackForRoute(this.theme);
      }
    } else {
      if (this.master && this.context) this.master.gain.setTargetAtTime(.0001, this.context.currentTime, .05);
      if (this.activeAudio) {
        this.activeAudio.pause();
      }
    }
    return this.enabled;
  }
}
