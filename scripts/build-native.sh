#!/bin/sh
set -eu

make -j4
mkdir -p build/Release

clang++ \
  -std=c++17 \
  -O2 \
  -bundle \
  -undefined dynamic_lookup \
  -DNODE_GYP_MODULE_NAME=nes_core \
  -I/usr/local/include/node \
  -Isrc/drivers/libretro/libretro-common/include \
  native/nes_addon.cc \
  -o build/Release/nes_core.node

if command -v emcc >/dev/null 2>&1; then
  emmake make -f Makefile.libretro platform=emscripten -j4
  mkdir -p public/cores/nes
  em++ \
    -std=c++17 \
    -O3 \
    -Isrc/drivers/libretro/libretro-common/include \
    native/nes_web_frontend.cpp \
    -Wl,--whole-archive fceumm_libretro_emscripten.a -Wl,--no-whole-archive \
    -s MODULARIZE=1 \
    -s EXPORT_ES6=1 \
    -s ENVIRONMENT=web,worker,node \
    -s ALLOW_MEMORY_GROWTH=1 \
    -s FILESYSTEM=1 \
    -s EXPORTED_FUNCTIONS='["_malloc","_free"]' \
    -s EXPORTED_RUNTIME_METHODS='["cwrap","HEAPU8"]' \
    -o public/cores/nes/fceumm.js
else
  echo "warning: emcc not found; skipping browser core build" >&2
fi
