import { fork } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

export class PartyEmulatorManager {
  constructor(root, options = {}) {
    this.root = root;
    this.limit = options.limit || 8;
    this.workers = new Map();
    this.nextId = 1;
  }
  key(code, playerId) { return `${code}:${playerId}`; }
  arm(key, entry) {
    clearTimeout(entry.idleTimer);
    entry.idleTimer = setTimeout(() => this.stop(...key.split(":")), 15 * 60 * 1000);
    entry.idleTimer.unref?.();
  }
  request(entry, message) {
    const id = this.nextId++;
    return new Promise((resolve, reject) => {
      const timer = setTimeout(() => { entry.pending.delete(id); reject(new Error("Phone emulator timed out")); }, 15000);
      entry.pending.set(id, { resolve, reject, timer });
      entry.worker.send({ id, ...message });
    });
  }
  async start(code, playerId, { challenge, game, corePath, addonPath }) {
    const key = this.key(code, playerId);
    if (this.workers.has(key)) return;
    if (this.workers.size >= this.limit) throw new Error("This server has reached its active phone emulator limit");
    const workerPath = path.join(path.dirname(fileURLToPath(import.meta.url)), "party-emulator-worker.js");
    const worker = fork(workerPath, [], { serialization:"advanced", stdio:["ignore","ignore","ignore","ipc"] });
    const entry = { worker, pending:new Map() };
    worker.on("message", (message) => { const pending=entry.pending.get(message.id); if(!pending)return; clearTimeout(pending.timer);entry.pending.delete(message.id);message.error?pending.reject(new Error(message.error)):pending.resolve(message); });
    worker.on("exit", () => { for(const pending of entry.pending.values()){clearTimeout(pending.timer);pending.reject(new Error("Phone emulator stopped"));} this.workers.delete(key); });
    this.workers.set(key, entry);
    this.arm(key, entry);
    try { await this.request(entry, { type:"init", challenge, romPath:game.absolutePath, corePath, addonPath }); }
    catch (error) { this.stop(code, playerId); throw error; }
  }
  frame(code, playerId, input) {
    const key = this.key(code, playerId), entry = this.workers.get(key);
    if (!entry) throw new Error("Press Start to launch this mini-game first");
    this.arm(key, entry);
    return this.request(entry, { type:"frame", input });
  }
  stop(code, playerId) { const key=this.key(code,playerId),entry=this.workers.get(key); if(entry){clearTimeout(entry.idleTimer);this.workers.delete(key);entry.worker.disconnect();} }
  stopRoom(code) { for(const key of [...this.workers.keys()]) if(key.startsWith(`${code}:`)){const entry=this.workers.get(key);clearTimeout(entry.idleTimer);this.workers.delete(key);entry.worker.disconnect();} }
}
