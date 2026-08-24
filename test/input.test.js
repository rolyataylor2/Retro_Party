import assert from "node:assert/strict";
import test from "node:test";

import { bitsToMask, firstConnectedGamepad, gamepadInputMask } from "../public/input.js";

function pad({ pressed = [], axes = [0, 0] } = {}) {
  return {
    axes,
    buttons: Array.from({ length: 16 }, (_, index) => ({ pressed: pressed.includes(index) })),
  };
}

test("uses the first connected gamepad even when slot zero is empty", () => {
  const controller = pad();
  assert.equal(firstConnectedGamepad([null, controller]), controller);
});

test("maps standard buttons and axis-based d-pads to NES input", () => {
  assert.equal(gamepadInputMask(pad({ pressed: [0, 1, 9] })), (1 << 8) | (1 << 0) | (1 << 3));
  assert.equal(gamepadInputMask(pad({ axes: [-1, .8] })), (1 << 6) | (1 << 5));
});

test("keyboard and controller masks can be combined without erasing either", () => {
  const keyboard = bitsToMask(new Set([7]));
  const controller = gamepadInputMask(pad({ pressed: [0] }));
  assert.equal(keyboard | controller, (1 << 7) | (1 << 8));
});

test("supports remapped controller gameplay buttons", () => {
  assert.equal(gamepadInputMask(pad({ pressed: [6] }), { a: 6 }), 1 << 8);
});
