const registrations = new Map();

export function registerCore(descriptor) {
  if (!descriptor?.id || typeof descriptor.create !== "function") throw new Error("Invalid emulator core registration");
  registrations.set(descriptor.id, Object.freeze({ ...descriptor }));
}

export function supportedCores() {
  return [...registrations.values()].map(({ create, ...descriptor }) => descriptor);
}

export async function createCore(id) {
  const descriptor = registrations.get(id);
  if (!descriptor) throw new Error(`This browser does not have the ${id} emulator core installed`);
  return descriptor.create();
}

registerCore({
  id: "nes",
  name: "Nintendo Entertainment System",
  extensions: [".nes", ".fds", ".unf", ".unif"],
  async create() {
    const { NesBrowserCore } = await import("./nes-core.js");
    return NesBrowserCore.create();
  },
});
