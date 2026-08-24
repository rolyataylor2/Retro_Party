#include <node_api.h>

#include <dlfcn.h>
#include <stdint.h>
#include <stdarg.h>
#include <stdio.h>
#include <string.h>

#include <algorithm>
#include <string>
#include <vector>

#include "libretro.h"

namespace {

void *core_handle = nullptr;
std::string data_directory;
std::vector<uint8_t> frame_rgba;
std::vector<int16_t> frame_audio;
unsigned frame_width = 256;
unsigned frame_height = 240;
unsigned pixel_format = RETRO_PIXEL_FORMAT_XRGB8888;
uint64_t frame_number = 0;
uint16_t input_mask = 0;
bool game_loaded = false;
double core_fps = 60.0988;
double core_sample_rate = 48000.0;

void (*p_retro_set_environment)(retro_environment_t) = nullptr;
void (*p_retro_set_video_refresh)(retro_video_refresh_t) = nullptr;
void (*p_retro_set_audio_sample)(retro_audio_sample_t) = nullptr;
void (*p_retro_set_audio_sample_batch)(retro_audio_sample_batch_t) = nullptr;
void (*p_retro_set_input_poll)(retro_input_poll_t) = nullptr;
void (*p_retro_set_input_state)(retro_input_state_t) = nullptr;
void (*p_retro_init)(void) = nullptr;
void (*p_retro_deinit)(void) = nullptr;
void (*p_retro_get_system_av_info)(struct retro_system_av_info *) = nullptr;
bool (*p_retro_load_game)(const struct retro_game_info *) = nullptr;
void (*p_retro_unload_game)(void) = nullptr;
void (*p_retro_run)(void) = nullptr;
void (*p_retro_reset)(void) = nullptr;
size_t (*p_retro_serialize_size)(void) = nullptr;
bool (*p_retro_serialize)(void *, size_t) = nullptr;
bool (*p_retro_unserialize)(const void *, size_t) = nullptr;
void (*p_retro_cheat_reset)(void) = nullptr;
void (*p_retro_cheat_set)(unsigned, bool, const char *) = nullptr;
bool (*p_cpu_peek)(uint16_t, uint8_t *) = nullptr;
bool (*p_cpu_poke)(uint16_t, uint8_t) = nullptr;
size_t (*p_cpu_snapshot)(uint8_t *, uint8_t *, size_t) = nullptr;

template <typename T>
bool load_symbol(T &target, const char *name) {
  target = reinterpret_cast<T>(dlsym(core_handle, name));
  return target != nullptr;
}

void core_log(enum retro_log_level level, const char *fmt, ...) {
  if (level < RETRO_LOG_WARN)
    return;
  va_list args;
  va_start(args, fmt);
  vfprintf(stderr, fmt, args);
  va_end(args);
}

bool environment_callback(unsigned command, void *data) {
  static retro_log_callback logging = {core_log};
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
      *static_cast<const char **>(data) = data_directory.c_str();
      return true;
    case RETRO_ENVIRONMENT_GET_VARIABLE:
      static_cast<retro_variable *>(data)->value = nullptr;
      return false;
    case RETRO_ENVIRONMENT_GET_VARIABLE_UPDATE:
      *static_cast<bool *>(data) = false;
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

void video_callback(const void *data, unsigned width, unsigned height, size_t pitch) {
  if (!data || data == RETRO_HW_FRAME_BUFFER_VALID)
    return;

  frame_width = width;
  frame_height = height;
  frame_rgba.resize(static_cast<size_t>(width) * height * 4);

  for (unsigned y = 0; y < height; ++y) {
    uint8_t *dest = frame_rgba.data() + static_cast<size_t>(y) * width * 4;
    if (pixel_format == RETRO_PIXEL_FORMAT_XRGB8888) {
      const uint32_t *src = reinterpret_cast<const uint32_t *>(
          static_cast<const uint8_t *>(data) + static_cast<size_t>(y) * pitch);
      for (unsigned x = 0; x < width; ++x) {
        uint32_t pixel = src[x];
        dest[x * 4 + 0] = static_cast<uint8_t>((pixel >> 16) & 0xff);
        dest[x * 4 + 1] = static_cast<uint8_t>((pixel >> 8) & 0xff);
        dest[x * 4 + 2] = static_cast<uint8_t>(pixel & 0xff);
        dest[x * 4 + 3] = 0xff;
      }
    } else {
      const uint16_t *src = reinterpret_cast<const uint16_t *>(
          static_cast<const uint8_t *>(data) + static_cast<size_t>(y) * pitch);
      for (unsigned x = 0; x < width; ++x) {
        uint16_t pixel = src[x];
        if (pixel_format == RETRO_PIXEL_FORMAT_RGB565) {
          dest[x * 4 + 0] = static_cast<uint8_t>(((pixel >> 11) & 31) * 255 / 31);
          dest[x * 4 + 1] = static_cast<uint8_t>(((pixel >> 5) & 63) * 255 / 63);
          dest[x * 4 + 2] = static_cast<uint8_t>((pixel & 31) * 255 / 31);
        } else {
          dest[x * 4 + 0] = static_cast<uint8_t>(((pixel >> 10) & 31) * 255 / 31);
          dest[x * 4 + 1] = static_cast<uint8_t>(((pixel >> 5) & 31) * 255 / 31);
          dest[x * 4 + 2] = static_cast<uint8_t>((pixel & 31) * 255 / 31);
        }
        dest[x * 4 + 3] = 0xff;
      }
    }
  }
}

void audio_sample_callback(int16_t left, int16_t right) {
  frame_audio.push_back(left);
  frame_audio.push_back(right);
}

size_t audio_batch_callback(const int16_t *data, size_t frames) {
  frame_audio.insert(frame_audio.end(), data, data + frames * 2);
  return frames;
}

void input_poll_callback(void) {}

int16_t input_state_callback(unsigned port, unsigned device, unsigned index, unsigned id) {
  if (port != 0 || device != RETRO_DEVICE_JOYPAD || index != 0 || id > 15)
    return 0;
  return (input_mask & (1u << id)) ? 1 : 0;
}

void throw_error(napi_env env, const char *message) {
  napi_throw_error(env, nullptr, message);
}

bool get_string(napi_env env, napi_value value, std::string &out) {
  size_t length = 0;
  if (napi_get_value_string_utf8(env, value, nullptr, 0, &length) != napi_ok)
    return false;
  out.resize(length);
  return napi_get_value_string_utf8(env, value, out.data(), length + 1, &length) == napi_ok;
}

napi_value av_info_object(napi_env env) {
  retro_system_av_info av = {};
  p_retro_get_system_av_info(&av);
  core_fps = av.timing.fps;
  core_sample_rate = av.timing.sample_rate;
  frame_width = av.geometry.base_width;
  frame_height = av.geometry.base_height;

  napi_value result;
  napi_create_object(env, &result);
  napi_value value;
  napi_create_double(env, core_fps, &value);
  napi_set_named_property(env, result, "fps", value);
  napi_create_double(env, core_sample_rate, &value);
  napi_set_named_property(env, result, "sampleRate", value);
  napi_create_uint32(env, frame_width, &value);
  napi_set_named_property(env, result, "width", value);
  napi_create_uint32(env, frame_height, &value);
  napi_set_named_property(env, result, "height", value);
  return result;
}

napi_value js_load(napi_env env, napi_callback_info info) {
  size_t argc = 4;
  napi_value argv[4];
  napi_get_cb_info(env, info, &argc, argv, nullptr, nullptr);
  if (argc != 4) {
    throw_error(env, "load(corePath, romPath, romBuffer, dataDirectory) requires four arguments");
    return nullptr;
  }

  std::string core_path;
  std::string rom_path;
  if (!get_string(env, argv[0], core_path) || !get_string(env, argv[1], rom_path) ||
      !get_string(env, argv[3], data_directory)) {
    throw_error(env, "Invalid path argument");
    return nullptr;
  }

  void *rom_data = nullptr;
  size_t rom_size = 0;
  if (napi_get_buffer_info(env, argv[2], &rom_data, &rom_size) != napi_ok) {
    throw_error(env, "ROM must be a Buffer");
    return nullptr;
  }

  core_handle = dlopen(core_path.c_str(), RTLD_NOW | RTLD_LOCAL);
  if (!core_handle) {
    throw_error(env, dlerror());
    return nullptr;
  }

  bool symbols_ok =
      load_symbol(p_retro_set_environment, "retro_set_environment") &&
      load_symbol(p_retro_set_video_refresh, "retro_set_video_refresh") &&
      load_symbol(p_retro_set_audio_sample, "retro_set_audio_sample") &&
      load_symbol(p_retro_set_audio_sample_batch, "retro_set_audio_sample_batch") &&
      load_symbol(p_retro_set_input_poll, "retro_set_input_poll") &&
      load_symbol(p_retro_set_input_state, "retro_set_input_state") &&
      load_symbol(p_retro_init, "retro_init") &&
      load_symbol(p_retro_deinit, "retro_deinit") &&
      load_symbol(p_retro_get_system_av_info, "retro_get_system_av_info") &&
      load_symbol(p_retro_load_game, "retro_load_game") &&
      load_symbol(p_retro_unload_game, "retro_unload_game") &&
      load_symbol(p_retro_run, "retro_run") &&
      load_symbol(p_retro_reset, "retro_reset") &&
      load_symbol(p_retro_serialize_size, "retro_serialize_size") &&
      load_symbol(p_retro_serialize, "retro_serialize") &&
      load_symbol(p_retro_unserialize, "retro_unserialize") &&
      load_symbol(p_retro_cheat_reset, "retro_cheat_reset") &&
      load_symbol(p_retro_cheat_set, "retro_cheat_set") &&
      load_symbol(p_cpu_peek, "fceumm_cpu_peek") &&
      load_symbol(p_cpu_poke, "fceumm_cpu_poke") &&
      load_symbol(p_cpu_snapshot, "fceumm_cpu_snapshot");

  if (!symbols_ok) {
    throw_error(env, "The emulator core is missing required instrumentation symbols");
    return nullptr;
  }

  p_retro_set_environment(environment_callback);
  p_retro_set_video_refresh(video_callback);
  p_retro_set_audio_sample(audio_sample_callback);
  p_retro_set_audio_sample_batch(audio_batch_callback);
  p_retro_set_input_poll(input_poll_callback);
  p_retro_set_input_state(input_state_callback);
  p_retro_init();

  retro_game_info game = {};
  game.path = rom_path.c_str();
  game.data = rom_data;
  game.size = rom_size;
  game.meta = nullptr;
  if (!p_retro_load_game(&game)) {
    throw_error(env, "FCEUmm could not load the supplied ROM");
    return nullptr;
  }
  game_loaded = true;

  return av_info_object(env);
}

napi_value js_switch_game(napi_env env, napi_callback_info info) {
  size_t argc = 2;
  napi_value argv[2];
  napi_get_cb_info(env, info, &argc, argv, nullptr, nullptr);
  if (argc != 2 || !core_handle) {
    throw_error(env, "switchGame(romPath, romBuffer) requires a loaded core and two arguments");
    return nullptr;
  }

  std::string rom_path;
  void *rom_data = nullptr;
  size_t rom_size = 0;
  if (!get_string(env, argv[0], rom_path) ||
      napi_get_buffer_info(env, argv[1], &rom_data, &rom_size) != napi_ok) {
    throw_error(env, "A ROM path and Buffer are required");
    return nullptr;
  }

  if (game_loaded) p_retro_unload_game();
  p_retro_cheat_reset();
  frame_rgba.clear();
  frame_audio.clear();
  frame_number = 0;
  input_mask = 0;
  pixel_format = RETRO_PIXEL_FORMAT_XRGB8888;

  retro_game_info game = {};
  game.path = rom_path.c_str();
  game.data = rom_data;
  game.size = rom_size;
  game.meta = nullptr;
  if (!p_retro_load_game(&game)) {
    throw_error(env, "FCEUmm could not load the supplied ROM");
    return nullptr;
  }
  game_loaded = true;
  return av_info_object(env);
}

napi_value js_unload_game(napi_env env, napi_callback_info info) {
  (void)info;
  if (game_loaded) {
    p_retro_unload_game();
    p_retro_cheat_reset();
    game_loaded = false;
  }
  frame_rgba.clear();
  frame_audio.clear();
  frame_number = 0;
  input_mask = 0;
  napi_value result;
  napi_get_undefined(env, &result);
  return result;
}

napi_value js_run_frame(napi_env env, napi_callback_info info) {
  size_t argc = 1;
  napi_value argv[1];
  napi_get_cb_info(env, info, &argc, argv, nullptr, nullptr);
  uint32_t mask = 0;
  if (argc)
    napi_get_value_uint32(env, argv[0], &mask);
  input_mask = static_cast<uint16_t>(mask);
  frame_audio.clear();
  p_retro_run();
  frame_number++;

  const size_t header_size = 24;
  const size_t frame_bytes = frame_rgba.size();
  const size_t audio_bytes = frame_audio.size() * sizeof(int16_t);
  const size_t total = header_size + frame_bytes + audio_bytes;
  void *output = nullptr;
  napi_value buffer;
  napi_create_buffer(env, total, &output, &buffer);
  uint8_t *bytes = static_cast<uint8_t *>(output);
  uint32_t header[6] = {
      frame_width, frame_height, static_cast<uint32_t>(frame_bytes),
      static_cast<uint32_t>(frame_audio.size() / 2),
      static_cast<uint32_t>(frame_number & 0xffffffffu),
      static_cast<uint32_t>(core_sample_rate)};
  memcpy(bytes, header, header_size);
  memcpy(bytes + header_size, frame_rgba.data(), frame_bytes);
  memcpy(bytes + header_size + frame_bytes, frame_audio.data(), audio_bytes);
  return buffer;
}

napi_value js_snapshot(napi_env env, napi_callback_info info) {
  (void)info;
  void *data = nullptr;
  napi_value buffer;
  napi_create_buffer(env, 0x20000, &data, &buffer);
  uint8_t *bytes = static_cast<uint8_t *>(data);
  if (p_cpu_snapshot(bytes, bytes + 0x10000, 0x10000) != 0x10000) {
    throw_error(env, "Unable to capture CPU memory");
    return nullptr;
  }
  return buffer;
}

napi_value js_peek(napi_env env, napi_callback_info info) {
  size_t argc = 1;
  napi_value argv[1];
  napi_get_cb_info(env, info, &argc, argv, nullptr, nullptr);
  uint32_t address = 0;
  napi_get_value_uint32(env, argv[0], &address);
  uint8_t value = 0;
  if (!p_cpu_peek(static_cast<uint16_t>(address), &value)) {
    napi_value null_value;
    napi_get_null(env, &null_value);
    return null_value;
  }
  napi_value result;
  napi_create_uint32(env, value, &result);
  return result;
}

napi_value js_poke(napi_env env, napi_callback_info info) {
  size_t argc = 2;
  napi_value argv[2];
  napi_get_cb_info(env, info, &argc, argv, nullptr, nullptr);
  uint32_t address = 0;
  uint32_t value = 0;
  napi_get_value_uint32(env, argv[0], &address);
  napi_get_value_uint32(env, argv[1], &value);
  napi_value result;
  napi_get_boolean(env, p_cpu_poke(static_cast<uint16_t>(address), static_cast<uint8_t>(value)), &result);
  return result;
}

napi_value js_save_state(napi_env env, napi_callback_info info) {
  (void)info;
  size_t size = p_retro_serialize_size();
  void *data = nullptr;
  napi_value buffer;
  napi_create_buffer(env, size, &data, &buffer);
  if (!p_retro_serialize(data, size)) {
    throw_error(env, "Could not serialize emulator state");
    return nullptr;
  }
  return buffer;
}

napi_value js_load_state(napi_env env, napi_callback_info info) {
  size_t argc = 1;
  napi_value argv[1];
  napi_get_cb_info(env, info, &argc, argv, nullptr, nullptr);
  void *data = nullptr;
  size_t size = 0;
  if (!argc || napi_get_buffer_info(env, argv[0], &data, &size) != napi_ok) {
    throw_error(env, "State must be a Buffer");
    return nullptr;
  }
  napi_value result;
  napi_get_boolean(env, p_retro_unserialize(data, size), &result);
  return result;
}

napi_value js_reset(napi_env env, napi_callback_info info) {
  (void)info;
  p_retro_reset();
  napi_value result;
  napi_get_undefined(env, &result);
  return result;
}

napi_value js_set_cheat(napi_env env, napi_callback_info info) {
  size_t argc = 3;
  napi_value argv[3];
  napi_get_cb_info(env, info, &argc, argv, nullptr, nullptr);
  uint32_t index = 0;
  bool enabled = false;
  std::string code;
  napi_get_value_uint32(env, argv[0], &index);
  napi_get_value_bool(env, argv[1], &enabled);
  if (!get_string(env, argv[2], code)) {
    throw_error(env, "Cheat code must be a string");
    return nullptr;
  }
  p_retro_cheat_set(index, enabled, code.c_str());
  napi_value result;
  napi_get_undefined(env, &result);
  return result;
}

napi_value js_reset_cheats(napi_env env, napi_callback_info info) {
  (void)info;
  p_retro_cheat_reset();
  napi_value result;
  napi_get_undefined(env, &result);
  return result;
}

napi_value init(napi_env env, napi_value exports) {
  napi_property_descriptor properties[] = {
      {"load", nullptr, js_load, nullptr, nullptr, nullptr, napi_default, nullptr},
      {"switchGame", nullptr, js_switch_game, nullptr, nullptr, nullptr, napi_default, nullptr},
      {"unloadGame", nullptr, js_unload_game, nullptr, nullptr, nullptr, napi_default, nullptr},
      {"runFrame", nullptr, js_run_frame, nullptr, nullptr, nullptr, napi_default, nullptr},
      {"snapshot", nullptr, js_snapshot, nullptr, nullptr, nullptr, napi_default, nullptr},
      {"peek", nullptr, js_peek, nullptr, nullptr, nullptr, napi_default, nullptr},
      {"poke", nullptr, js_poke, nullptr, nullptr, nullptr, napi_default, nullptr},
      {"saveState", nullptr, js_save_state, nullptr, nullptr, nullptr, napi_default, nullptr},
      {"loadState", nullptr, js_load_state, nullptr, nullptr, nullptr, napi_default, nullptr},
      {"reset", nullptr, js_reset, nullptr, nullptr, nullptr, napi_default, nullptr},
      {"setCheat", nullptr, js_set_cheat, nullptr, nullptr, nullptr, napi_default, nullptr},
      {"resetCheats", nullptr, js_reset_cheats, nullptr, nullptr, nullptr, napi_default, nullptr},
  };
  napi_define_properties(env, exports, sizeof(properties) / sizeof(properties[0]), properties);
  return exports;
}

}  // namespace

NAPI_MODULE(NODE_GYP_MODULE_NAME, init)
