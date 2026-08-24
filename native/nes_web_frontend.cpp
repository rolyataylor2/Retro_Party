#include <emscripten/emscripten.h>
#include <stdint.h>
#include <stdarg.h>
#include <stdio.h>
#include <string.h>

#include <string>
#include <vector>

#include "libretro.h"

namespace {

std::string content_path;
std::string content_name;
std::string content_extension;
std::string system_directory = "/system";
retro_game_info_ext extended_game = {};
std::vector<uint8_t> video;
std::vector<int16_t> audio;
std::vector<uint8_t> state;
std::vector<uint8_t> memory(0x20000);
unsigned width = 256;
unsigned height = 240;
unsigned pixel_format = RETRO_PIXEL_FORMAT_XRGB8888;
unsigned sample_rate = 48000;
uint16_t input_mask = 0;
bool loaded = false;

void log_message(enum retro_log_level level, const char *format, ...) {
  if (level < RETRO_LOG_WARN) return;
  va_list args;
  va_start(args, format);
  vfprintf(stderr, format, args);
  va_end(args);
}

bool environment(unsigned command, void *data) {
  static retro_log_callback logging = {log_message};
  static bool can_dupe = true;
  static unsigned language = RETRO_LANGUAGE_ENGLISH;
  switch (command) {
    case RETRO_ENVIRONMENT_SET_PIXEL_FORMAT:
      pixel_format = *static_cast<unsigned *>(data);
      return pixel_format == RETRO_PIXEL_FORMAT_XRGB8888 ||
             pixel_format == RETRO_PIXEL_FORMAT_RGB565 ||
             pixel_format == RETRO_PIXEL_FORMAT_0RGB1555;
    case RETRO_ENVIRONMENT_GET_LOG_INTERFACE:
      *static_cast<retro_log_callback *>(data) = logging;
      return true;
    case RETRO_ENVIRONMENT_GET_CAN_DUPE:
      *static_cast<bool *>(data) = can_dupe;
      return true;
    case RETRO_ENVIRONMENT_GET_LANGUAGE:
      *static_cast<unsigned *>(data) = language;
      return true;
    case RETRO_ENVIRONMENT_GET_SYSTEM_DIRECTORY:
    case RETRO_ENVIRONMENT_GET_SAVE_DIRECTORY:
    case RETRO_ENVIRONMENT_GET_CORE_ASSETS_DIRECTORY:
      *static_cast<const char **>(data) = system_directory.c_str();
      return true;
    case RETRO_ENVIRONMENT_GET_VARIABLE: {
      auto *var = static_cast<retro_variable *>(data);
      if (var && var->key) {
        if (!strcmp(var->key, "fceumm_up_down_allowed")) {
          var->value = "enabled";
          return true;
        }
      }
      if (var) var->value = nullptr;
      return false;
    }
    case RETRO_ENVIRONMENT_GET_VARIABLE_UPDATE:
      *static_cast<bool *>(data) = false;
      return true;
    case RETRO_ENVIRONMENT_GET_GAME_INFO_EXT:
      if (!extended_game.data) return false;
      *static_cast<const retro_game_info_ext **>(data) = &extended_game;
      return true;
    case RETRO_ENVIRONMENT_SET_SUPPORT_NO_GAME:
    case RETRO_ENVIRONMENT_SET_VARIABLES:
    case RETRO_ENVIRONMENT_SET_CORE_OPTIONS:
    case RETRO_ENVIRONMENT_SET_CORE_OPTIONS_INTL:
    case RETRO_ENVIRONMENT_SET_CORE_OPTIONS_V2:
    case RETRO_ENVIRONMENT_SET_CORE_OPTIONS_V2_INTL:
    case RETRO_ENVIRONMENT_SET_INPUT_DESCRIPTORS:
    case RETRO_ENVIRONMENT_SET_CONTROLLER_INFO:
    case RETRO_ENVIRONMENT_SET_MEMORY_MAPS:
    case RETRO_ENVIRONMENT_SET_PERFORMANCE_LEVEL:
    case RETRO_ENVIRONMENT_SET_SERIALIZATION_QUIRKS:
    case RETRO_ENVIRONMENT_SET_GEOMETRY:
      return true;
    default:
      return false;
  }
}

void video_refresh(const void *data, unsigned next_width, unsigned next_height, size_t pitch) {
  if (!data || data == RETRO_HW_FRAME_BUFFER_VALID) return;
  width = next_width;
  height = next_height;
  video.resize(static_cast<size_t>(width) * height * 4);
  for (unsigned y = 0; y < height; ++y) {
    uint8_t *dest = video.data() + static_cast<size_t>(y) * width * 4;
    if (pixel_format == RETRO_PIXEL_FORMAT_XRGB8888) {
      const uint32_t *source = reinterpret_cast<const uint32_t *>(static_cast<const uint8_t *>(data) + static_cast<size_t>(y) * pitch);
      for (unsigned x = 0; x < width; ++x) {
        const uint32_t pixel = source[x];
        dest[x * 4] = (pixel >> 16) & 0xff;
        dest[x * 4 + 1] = (pixel >> 8) & 0xff;
        dest[x * 4 + 2] = pixel & 0xff;
        dest[x * 4 + 3] = 0xff;
      }
    } else {
      const uint16_t *source = reinterpret_cast<const uint16_t *>(static_cast<const uint8_t *>(data) + static_cast<size_t>(y) * pitch);
      for (unsigned x = 0; x < width; ++x) {
        const uint16_t pixel = source[x];
        const bool rgb565 = pixel_format == RETRO_PIXEL_FORMAT_RGB565;
        dest[x * 4] = static_cast<uint8_t>(((pixel >> (rgb565 ? 11 : 10)) & 31) * 255 / 31);
        dest[x * 4 + 1] = static_cast<uint8_t>(((pixel >> 5) & (rgb565 ? 63 : 31)) * 255 / (rgb565 ? 63 : 31));
        dest[x * 4 + 2] = static_cast<uint8_t>((pixel & 31) * 255 / 31);
        dest[x * 4 + 3] = 0xff;
      }
    }
  }
}

void audio_sample(int16_t left, int16_t right) {
  audio.push_back(left);
  audio.push_back(right);
}

size_t audio_batch(const int16_t *samples, size_t frames) {
  audio.insert(audio.end(), samples, samples + frames * 2);
  return frames;
}

void input_poll() {}

int16_t input_state(unsigned port, unsigned device, unsigned index, unsigned id) {
  if (port || device != RETRO_DEVICE_JOYPAD || index || id > 15) return 0;
  return (input_mask & (1u << id)) ? 1 : 0;
}

}  // namespace

extern "C" {
bool fceumm_cpu_peek(uint16_t address, uint8_t *value);
bool fceumm_cpu_poke(uint16_t address, uint8_t value);
size_t fceumm_cpu_snapshot(uint8_t *values, uint8_t *valid, size_t size);

EMSCRIPTEN_KEEPALIVE int web_init() {
  retro_set_environment(environment);
  retro_set_video_refresh(video_refresh);
  retro_set_audio_sample(audio_sample);
  retro_set_audio_sample_batch(audio_batch);
  retro_set_input_poll(input_poll);
  retro_set_input_state(input_state);
  retro_init();
  return 1;
}

EMSCRIPTEN_KEEPALIVE int web_load_game(const char *path, const uint8_t *bytes, size_t size) {
  if (loaded) retro_unload_game();
  retro_cheat_reset();
  video.clear();
  audio.clear();
  content_path = path ? path : "game.nes";
  const size_t slash = content_path.find_last_of("/\\");
  const size_t dot = content_path.find_last_of('.');
  const size_t name_start = slash == std::string::npos ? 0 : slash + 1;
  const size_t name_end = dot == std::string::npos || dot < name_start ? content_path.size() : dot;
  content_name = content_path.substr(name_start, name_end - name_start);
  content_extension = dot == std::string::npos ? "nes" : content_path.substr(dot + 1);
  extended_game = {};
  extended_game.full_path = content_path.c_str();
  extended_game.dir = "/";
  extended_game.name = content_name.c_str();
  extended_game.ext = content_extension.c_str();
  extended_game.data = bytes;
  extended_game.size = size;
  extended_game.persistent_data = false;
  retro_game_info game = {content_path.c_str(), bytes, size, nullptr};
  loaded = retro_load_game(&game);
  extended_game.data = nullptr;
  if (!loaded) return 0;
  retro_system_av_info info = {};
  retro_get_system_av_info(&info);
  width = info.geometry.base_width;
  height = info.geometry.base_height;
  sample_rate = static_cast<unsigned>(info.timing.sample_rate);
  return 1;
}

EMSCRIPTEN_KEEPALIVE void web_unload_game() {
  if (loaded) retro_unload_game();
  retro_cheat_reset();
  loaded = false;
  video.clear();
  audio.clear();
}

EMSCRIPTEN_KEEPALIVE void web_deinit() {
  web_unload_game();
  retro_deinit();
}

EMSCRIPTEN_KEEPALIVE void web_run_frame(unsigned mask) {
  input_mask = static_cast<uint16_t>(mask);
  audio.clear();
  retro_run();
}

EMSCRIPTEN_KEEPALIVE void web_reset() { retro_reset(); }
EMSCRIPTEN_KEEPALIVE unsigned web_width() { return width; }
EMSCRIPTEN_KEEPALIVE unsigned web_height() { return height; }
EMSCRIPTEN_KEEPALIVE unsigned web_sample_rate() { return sample_rate; }
EMSCRIPTEN_KEEPALIVE uintptr_t web_video_pointer() { return reinterpret_cast<uintptr_t>(video.data()); }
EMSCRIPTEN_KEEPALIVE size_t web_video_size() { return video.size(); }
EMSCRIPTEN_KEEPALIVE uintptr_t web_audio_pointer() { return reinterpret_cast<uintptr_t>(audio.data()); }
EMSCRIPTEN_KEEPALIVE size_t web_audio_frames() { return audio.size() / 2; }

EMSCRIPTEN_KEEPALIVE uintptr_t web_save_state() {
  state.resize(retro_serialize_size());
  return retro_serialize(state.data(), state.size()) ? reinterpret_cast<uintptr_t>(state.data()) : 0;
}
EMSCRIPTEN_KEEPALIVE size_t web_state_size() { return state.size(); }
EMSCRIPTEN_KEEPALIVE int web_load_state(const uint8_t *bytes, size_t size) { return retro_unserialize(bytes, size); }

EMSCRIPTEN_KEEPALIVE uintptr_t web_snapshot() {
  return fceumm_cpu_snapshot(memory.data(), memory.data() + 0x10000, 0x10000) == 0x10000
    ? reinterpret_cast<uintptr_t>(memory.data()) : 0;
}
EMSCRIPTEN_KEEPALIVE int web_peek(unsigned address) {
  uint8_t value = 0;
  return fceumm_cpu_peek(static_cast<uint16_t>(address), &value) ? value : -1;
}
EMSCRIPTEN_KEEPALIVE int web_poke(unsigned address, unsigned value) {
  return fceumm_cpu_poke(static_cast<uint16_t>(address), static_cast<uint8_t>(value));
}
EMSCRIPTEN_KEEPALIVE void web_set_cheat(unsigned index, int enabled, const char *code) {
  retro_cheat_set(index, enabled != 0, code);
}
EMSCRIPTEN_KEEPALIVE void web_reset_cheats() { retro_cheat_reset(); }
}
