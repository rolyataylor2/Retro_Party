# Space Action Sound Effects (SFX) Library

This directory is the designated storage location for custom sound effects (`.wav`, `.mp3`, `.ogg`, `.webm`) used by **Space Actions**, cutscene triggers, and board events in Starlight Party.

---

## 🎵 File Formats & Recommendations
- **Format**: Standard 16-bit PCM WAV (`.wav`), MP3 (`.mp3`), or Ogg Vorbis (`.ogg`).
- **Sample Rate**: 44.1 kHz or 48.0 kHz.
- **Duration**: Short UI sound bites and fanfare effects should ideally be between **0.1s – 3.0s**.
- **Naming Convention**: Use lowercase kebab-case for easy referencing in cutscenes, e.g.:
  - `coin-pouch.wav`
  - `ghost-laugh.wav`
  - `warp-pipe.wav`
  - `thunder-strike.wav`
  - `vendor-chime.wav`
  - `star-fanfare.wav`

---

## 🔊 Built-in Chiptune & Synthesized SFX
Starlight Party also features a built-in zero-latency Web Audio chiptune synthesizer engine that provides immediate playback for:
- `coin` / `coin-shower` / `star` / `star-fanfare`
- `dice-roll` / `dice-hit` / `jump` / `warp` / `spring`
- `chest-open` / `item-get` / `powerup` / `badge-chime`
- `shock` / `thunder` / `explosion` / `trap` / `freeze`
- `whistle` / `buzzer` / `error` / `laugh` / `fanfare`
- `dialogue-blip` / `banner-sting` / `gong` / `level-up`

When you add audio files to this folder, they will be automatically selectable in the **Space Actions Editor** Audio & Sound palette.
