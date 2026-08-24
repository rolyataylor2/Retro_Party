export function bitsToMask(bits) {
  let mask = 0;
  for (const bit of bits) mask |= 1 << bit;
  return mask;
}

export function firstConnectedGamepad(gamepads) {
  return Array.from(gamepads || []).find(Boolean) || null;
}

export const nesBits = { b: 0, select: 2, start: 3, up: 4, down: 5, left: 6, right: 7, a: 8 };

export function gamepadInputMask(pad, bindings = {}) {
  if (!pad) return 0;
  const defaults = { b: 1, a: 0, select: 8, start: 9, up: 12, down: 13, left: 14, right: 15 };
  let mask = Object.entries(nesBits).reduce((value, [action, bit]) => value | (pad.buttons?.[bindings[action] ?? defaults[action]]?.pressed ? 1 << bit : 0), 0);
  const x = pad.axes?.[0] || 0;
  const y = pad.axes?.[1] || 0;
  if (x < -.55) mask |= 1 << 6;
  if (x > .55) mask |= 1 << 7;
  if (y < -.55) mask |= 1 << 4;
  if (y > .55) mask |= 1 << 5;
  return mask;
}
