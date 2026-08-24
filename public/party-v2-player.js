import { BrowserEmulatorSession } from "./emulator/session.js";

const root = document.querySelector("#party-v2-player");
const headerCode = document.querySelector("#v2-header-code");
const toastNode = document.querySelector("#v2-toast");
const code = (location.pathname.match(/^\/party\/player\/([A-Za-z]{4})\/?$/)?.[1] || "").toUpperCase();
const identityKey = `party-player:${code}`;
const state = { room: null, visible: null, view: "join", setupStep: "ai-players", token: localStorage.getItem(identityKey) || "", pending: [], processed: new Set(), processing: false, ws: null, reconnect: null, countdownTimer: null, inputMask: 0, loadingCore: false, fetchingFrame: false, outcomeSent: false, audio: null, audioCursor: 0 };
const emulator = new BrowserEmulatorSession();
const SETUP_STEPS = ["ai-players", "rounds", "minigames", "ruleset", "ai-difficulty", "board", "review"];

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

async function api(path, options = {}) {
  const config = { ...options, headers: { "Content-Type": "application/json", ...(options.headers || {}) } };
  if (config.body && typeof config.body !== "string") config.body = JSON.stringify(config.body);
  const response = await fetch(path, config);
  const data = await response.json();
  if (!response.ok || data.error) throw new Error(data.error || "Party server error.");
  return data;
}

function toast(message) {
  toastNode.textContent = message;
  toastNode.classList.remove("hidden");
  clearTimeout(toast.timer);
  toast.timer = setTimeout(() => toastNode.classList.add("hidden"), 3200);
}

function character(room, id) { return room.catalog.characters.find((item) => item.id === id) || room.catalog.characters[0]; }
function art(room, id) {
  const item = character(room, id);
  return `<span class="character-art" style="--character-color:${item.color};--character-x:${item.x}%;--character-y:${item.y}%" role="img" aria-label="${escapeHtml(item.name)}"></span>`;
}
function title(value) { return String(value || "").replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function find(items, id) { return items.find((item) => item.id === id); }
function choice(value, selected, copy = "", attributes = "") { return `<button type="button" class="v2-choice ${selected ? "selected" : ""}" ${attributes}><b>${escapeHtml(value)}</b>${copy ? `<small>${escapeHtml(copy)}</small>` : ""}</button>`; }
function progress(step) { const active = SETUP_STEPS.indexOf(step); return `<div class="v2-progress">${SETUP_STEPS.map((_, index) => `<i class="${index < active ? "done" : index === active ? "active" : ""}"></i>`).join("")}</div>`; }
function miniRoster(room) { return `<div class="v2-mini-roster">${room.players.map((player) => `<div class="v2-mini-player">${art(room, player.characterId)}<span><small>${player.primary ? "PRIMARY" : "PLAYER"}</small><br><b>${escapeHtml(player.nickname)}</b></span></div>`).join("")}</div>`; }

function waiting(titleText, copy) {
  return `<section class="v2-phone-card v2-wait"><span class="v2-orbit">✦</span><span class="v2-eyebrow">PLEASE WAIT</span><h1>${escapeHtml(titleText)}</h1><p>${escapeHtml(copy)}</p></section>`;
}

function joinView(room) {
  const used = new Set(room.players.map((player) => player.characterId));
  return `<section class="v2-phone-card"><span class="v2-eyebrow">ROOM ${room.code}</span><h1>Join the party.</h1><p>Enter your username and choose one available avatar.</p><form id="v2-join-form"><label class="v2-field">USERNAME<input name="nickname" maxlength="20" autocomplete="nickname" required placeholder="Your name"></label><div class="v2-options">${room.catalog.characters.map((item) => `<button type="button" class="v2-choice" data-avatar="${item.id}" ${used.has(item.id) ? "disabled" : ""}>${art(room, item.id)}<b>${escapeHtml(item.name)}</b></button>`).join("")}</div><input type="hidden" name="characterId"><button class="v2-button gold" type="submit" disabled>JOIN PARTY →</button></form></section>`;
}

function confirmPlayersView(room) {
  return `<section class="v2-phone-card"><span class="v2-eyebrow">YOU ARE THE PRIMARY PLAYER</span><h1>Is everyone here?</h1><p>Confirming locks the human player count. Nobody else will be able to join.</p>${miniRoster(room)}<button class="v2-button gold" data-action="confirm-players">CONFIRM ${room.players.length} PLAYER${room.players.length === 1 ? "" : "S"}</button></section>`;
}

function setupView(room) {
  const step = state.setupStep || room.setupStep;
  const config = room.configuration;
  const previous = SETUP_STEPS[SETUP_STEPS.indexOf(step) - 1];
  let content = "";
  if (step === "ai-players") {
    const humans = new Set(room.players.map((player) => player.characterId));
    const selected = new Set((config.aiPlayers || []).map((player) => player.characterId));
    const maximum = 4 - room.players.length;
    content = `<h1>Add AI players.</h1><p>Choose up to ${maximum}, or continue with no AI players.</p><div class="v2-options">${room.catalog.characters.filter((item) => !humans.has(item.id)).map((item) => `<button type="button" class="v2-choice ${selected.has(item.id) ? "selected" : ""}" data-ai-avatar="${item.id}">${art(room, item.id)}<b>${escapeHtml(item.name)} CPU</b></button>`).join("")}</div><button class="v2-button" data-action="continue-ai">CHOOSE ROUNDS →</button>`;
  } else if (step === "rounds") {
    content = `<h1>How many rounds?</h1><p>Choose the length of this party.</p><div class="v2-options">${room.catalog.rounds.map((rounds) => choice(`${rounds} rounds`, config.rounds === rounds, "", `data-pick="rounds" data-value="${rounds}" data-next="minigames"`)).join("")}</div>`;
  } else if (step === "minigames") {
    content = `<h1>Mini-game set.</h1><p>Pick the collection used between board rounds.</p><div class="v2-options">${room.catalog.packs.map((pack) => choice(pack.name, config.packId === pack.id, pack.description, `data-pick="packId" data-value="${pack.id}" data-next="ruleset"`)).join("")}</div>`;
  } else if (step === "ruleset") {
    content = `<h1>Choose the rules.</h1><p>Pick the style of play for this party.</p><div class="v2-options">${room.catalog.rulesets.map((rules) => choice(rules.name, config.rulesetId === rules.id, rules.description, `data-pick="rulesetId" data-value="${rules.id}" data-next="ai-difficulty"`)).join("")}</div>`;
  } else if (step === "ai-difficulty") {
    content = `<h1>AI difficulty.</h1><p>How competitive should computer players be?</p><div class="v2-options">${room.catalog.aiDifficulties.map((difficulty) => choice(difficulty.name, config.aiDifficulty === difficulty.id, difficulty.id === "easy" ? "Relaxed rivals" : difficulty.id === "hard" ? "No mercy" : "Balanced play", `data-pick="aiDifficulty" data-value="${difficulty.id}" data-next="board"`)).join("")}</div>`;
  } else if (step === "board") {
    content = `<h1>Choose the board.</h1><p>Pick a world for tonight's adventure.</p><div class="v2-options v2-board-options">${room.catalog.boards.map((board) => `<button type="button" class="v2-choice v2-board-choice ${config.boardId === board.id ? "selected" : ""}" data-pick="boardId" data-value="${board.id}" data-next="review"><i style="background-image:url('${escapeHtml(board.image)}')"></i><span><em>${escapeHtml(board.difficulty || "Party")}</em><b>${escapeHtml(board.name)}</b><small>${escapeHtml(board.description)}</small></span></button>`).join("")}</div>`;
  } else {
    const board = find(room.catalog.boards, config.boardId), pack = find(room.catalog.packs, config.packId), rules = find(room.catalog.rulesets, config.rulesetId);
    content = `<h1>Ready to party?</h1><p>Confirm this setup to start the synchronized countdown.</p><div class="v2-review"><div><small>PLAYERS</small><b>${room.players.length} human · ${(config.aiPlayers || []).length} AI</b></div><div><small>ROUNDS</small><b>${config.rounds}</b></div><div><small>MINI-GAMES</small><b>${escapeHtml(pack?.name)}</b></div><div><small>RULESET</small><b>${escapeHtml(rules?.name)}</b></div><div><small>AI DIFFICULTY</small><b>${title(config.aiDifficulty)}</b></div><div><small>BOARD</small><b>${escapeHtml(board?.name)}</b></div></div><button class="v2-button gold" data-action="confirm-setup">CONFIRM & START ★</button>`;
  }
  return `<section class="v2-phone-card">${progress(step)}<span class="v2-eyebrow">SETUP · ${title(step)}</span>${content}${previous ? `<div class="v2-actions"><button class="v2-button secondary" data-step="${previous}">← BACK</button><span></span></div>` : ""}</section>`;
}

function countdownView(room) {
  setTimeout(updateCountdown, 0);
  return `<section class="v2-phone-card v2-wait"><span class="v2-eyebrow">GET READY</span><span id="v2-player-countdown" class="v2-count-number">5</span><h1>Game starting!</h1><p>Keep this screen open.</p></section>`;
}

function rollView(room) {
  const self = room.game?.players.find((player) => player.id === room.self?.id);
  return `<section class="v2-phone-card v2-wait"><span class="v2-eyebrow">YOUR TURN · ROUND ${room.game?.round}</span>${art(room, self?.characterId)}<h1>Roll, ${escapeHtml(self?.nickname || room.self?.nickname)}!</h1><p>Tap the die and watch your character move on the primary display.</p><button class="v2-dice" data-action="roll">?</button><b>ROLL DICE</b></section>`;
}

function minigamePlayView(room) {
  const entry = room.minigame?.players.find((item) => item.playerId === room.self?.id);
  const challenge = room.minigame?.challenge;
  if (!entry || entry.completed) return waiting("Result sent!", "Watch the primary display while the other results arrive.");
  return `<section class="phone-game-shell"><div class="phone-game-top"><span>${escapeHtml(challenge?.title || "Mini-game")}</span>${entry.started ? '<button data-result="fail">GIVE UP</button>' : ""}</div><div class="phone-console"><canvas id="phone-screen" width="256" height="240" aria-label="NES mini-game"></canvas><i class="phone-scanlines"></i>${entry.started ? "" : '<div class="press-start-banner">PRESS START TO PLAY</div>'}</div><div class="virtual-pad"><div class="dpad"><button class="pad-key up" data-pad="up">▲</button><button class="pad-key left" data-pad="left">◀</button><i class="pad-center"></i><button class="pad-key right" data-pad="right">▶</button><button class="pad-key down" data-pad="down">▼</button></div><div class="system-keys"><button class="system-key" data-pad="select">SELECT</button><button class="system-key" data-pad="start" data-action="minigame-start" ${entry.started ? "disabled" : ""}>START</button></div><div class="action-pad"><button class="round-key" data-pad="b">B</button><button class="round-key" data-pad="a">A</button></div></div></section>`;
}

function finalView(room) {
  const ranked = [...(room.game?.players || [])].sort((a, b) => b.stars - a.stars || b.coins - a.coins);
  const selfPlace = ranked.findIndex((player) => player.id === room.self?.id) + 1;
  return `<section class="v2-phone-card v2-wait"><span class="v2-eyebrow">PARTY COMPLETE</span><span class="v2-orbit">★</span><h1>${selfPlace === 1 ? "You win!" : `${escapeHtml(ranked[0]?.nickname)} wins!`}</h1><p>You finished in place #${selfPlace || "–"}.</p></section>`;
}

function updateCountdown() {
  clearInterval(state.countdownTimer);
  const update = () => { const node = document.querySelector("#v2-player-countdown"); if (node) node.textContent = Math.max(1, Math.ceil((state.room.countdownEndsAt - Date.now()) / 1000)); };
  update(); state.countdownTimer = setInterval(update, 100);
}

function deriveView(room) {
  if (!state.token) return "join";
  if (room.status === "under-construction") return "under-construction";
  if (room.status === "complete") return "final-results";
  if (room.status === "results") return "results";
  if (room.status === "minigame") return "minigame";
  if (room.status === "roulette") return "roulette-wait";
  if (room.status === "playing") {
    const request = room.gameQueue?.active?.find((item) => item.type === "request-roll" && item.payload.playerId === room.self?.id);
    return request ? "roll" : "waiting-turn";
  }
  if (room.status === "countdown") return "countdown";
  if (room.status === "setup") return room.self?.primary ? "setup" : "waiting-for-setup";
  return room.self?.primary ? "confirm-players" : "waiting-for-primary";
}

function render() {
  const room = state.visible || state.room;
  if (!room) return;
  headerCode.textContent = room.code;
  document.body.classList.toggle("phone-playing", state.view === "minigame");
  clearInterval(state.countdownTimer);
  if (state.view === "join") root.innerHTML = joinView(room);
  else if (state.view === "confirm-players") root.innerHTML = confirmPlayersView(room);
  else if (state.view === "waiting-for-primary") root.innerHTML = waiting("You’re in!", "The primary player will confirm the player count when everyone has joined.");
  else if (state.view === "setup") root.innerHTML = setupView(room);
  else if (state.view === "waiting-for-setup") root.innerHTML = waiting("Setup in progress", "The primary player is configuring the board game on their screen.");
  else if (state.view === "countdown") root.innerHTML = countdownView(room);
  else if (state.view === "roll") root.innerHTML = rollView(room);
  else if (state.view === "waiting-turn") { const current = room.game?.players?.[room.game.currentPlayerIndex]; root.innerHTML = waiting(`${current?.nickname || "Player"}'s turn`, "Watch the action on the primary display."); }
  else if (state.view === "roulette-wait") root.innerHTML = waiting("Mini-game roulette!", "Watch the primary display choose the next challenge.");
  else if (state.view === "minigame") root.innerHTML = minigamePlayView(room);
  else if (state.view === "results") root.innerHTML = waiting(room.summary?.winnerName ? `${room.summary.winnerName} wins!` : "Round complete", "The next round will begin automatically.");
  else if (state.view === "final-results") root.innerHTML = finalView(room);
  else root.innerHTML = `<section class="v2-phone-card v2-wait"><span class="v2-construction-mark">✦</span><span class="v2-eyebrow">PARTY PLAYER</span><h1>Syncing…</h1><p>The Director is preparing your next action.</p></section>`;
}

async function startPhoneMinigame(target) {
  if (target?.disabled || state.loadingCore) return;
  if (target) target.disabled = true;
  const AudioEngine = window.AudioContext || window.webkitAudioContext;
  if (AudioEngine) { state.audio ||= new AudioEngine(); state.audio.resume().catch(() => {}); }
  state.loadingCore = true;
  state.outcomeSent = false;
  try {
    const result = await api(`/api/party/rooms/${code}/minigame-start`, { method: "POST", body: { token: state.token } });
    await emulator.loadChallenge(result.runtime);
    state.room = result.room;
    state.visible = structuredClone(result.room);
    state.view = "minigame";
    render();
    state.inputMask &= ~(1 << 3);
  } finally { state.loadingCore = false; }
}

function queueAudio(samples, frames, sampleRate) {
  if (!state.audio || !frames) return;
  const buffer = state.audio.createBuffer(2, frames, sampleRate);
  for (let channel = 0; channel < 2; channel++) { const output = buffer.getChannelData(channel); for (let index = 0; index < frames; index++) output[index] = samples[index * 2 + channel] / 32768; }
  const source = state.audio.createBufferSource(); source.buffer = buffer; source.connect(state.audio.destination);
  const now = state.audio.currentTime; if (state.audioCursor < now || state.audioCursor > now + .2) state.audioCursor = now + .04;
  source.start(state.audioCursor); state.audioCursor += frames / sampleRate;
}

async function gameFrame() {
  const entry = state.room?.minigame?.players?.find((item) => item.playerId === state.room.self?.id);
  if (state.room?.status !== "minigame" || !entry?.started || entry.completed || state.fetchingFrame || state.loadingCore || !emulator.game || document.hidden) return;
  state.fetchingFrame = true;
  try {
    const { width, height, video, audio, sampleRate, outcome } = emulator.runFrame(state.inputMask);
    const canvas = document.querySelector("#phone-screen");
    if (canvas) { if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; } const context = canvas.getContext("2d", { alpha: false }); context.imageSmoothingEnabled = false; context.putImageData(new ImageData(new Uint8ClampedArray(video.buffer, video.byteOffset, video.byteLength), width, height), 0, 0); queueAudio(audio, audio.length / 2, sampleRate); }
    if (outcome && !state.outcomeSent) { state.outcomeSent = true; await sendAction("minigame-result", { completed: outcome.completed, score: outcome.completed ? Math.max(1, 100_000 - emulator.frameNumber) : 0 }); emulator.unload(); }
  } catch (error) { toast(error.message); } finally { state.fetchingFrame = false; }
}

function applyPatch(object, patch) {
  const keys = String(patch.path).split(".");
  const finalKey = keys.pop();
  const parent = keys.reduce((value, key) => value[key] ||= {}, object);
  if (patch.op === "replace") parent[finalKey] = structuredClone(patch.value);
  else if (patch.op === "add") { parent[finalKey] ||= []; if (!patch.value?.id || !parent[finalKey].some((entry) => entry.id === patch.value.id)) parent[finalKey].push(structuredClone(patch.value)); }
  else if (patch.op === "remove" && Array.isArray(parent[finalKey])) { const match = patch.match || {}; parent[finalKey] = parent[finalKey].filter((entry) => !Object.entries(match).every(([key, value]) => entry?.[key] === value)); }
}

function runCommand(item) {
  if (item.command === "patch") for (const patch of item.payload.patches || []) applyPatch(state.visible, patch);
  else if (["navigate", "request-input", "refresh"].includes(item.command)) {
    state.view = item.payload.view;
    if (item.payload.setupStep) state.setupStep = item.payload.setupStep;
  }
  render();
}

async function drainQueue() {
  if (state.processing || !state.pending.length) return;
  state.processing = true;
  const acknowledged = [];
  let refresh = false;
  while (state.pending.length) {
    const item = state.pending.shift();
    if (state.processed.has(item.id)) continue;
    state.processed.add(item.id);
    runCommand(item);
    acknowledged.push(item.id);
    refresh ||= item.command === "refresh";
  }
  if (acknowledged.length) await api(`/api/party/rooms/${code}/ack-player`, { method: "POST", body: { token: state.token, ids: acknowledged }, keepalive: refresh });
  state.processing = false;
  if (refresh) {
    const key = `party-player-refresh:${code}:${Math.max(...acknowledged)}`;
    if (!sessionStorage.getItem(key)) { sessionStorage.setItem(key, "1"); location.reload(); return; }
  }
  state.visible = structuredClone(state.room);
  render();
}

function receive(room) {
  state.room = room;
  if (!state.visible) { state.visible = structuredClone(room); state.view = deriveView(room); state.setupStep = room.setupStep || state.setupStep; }
  for (const item of room.queue || []) if (!state.processed.has(item.id) && !state.pending.some((queued) => queued.id === item.id)) state.pending.push(item);
  state.pending.sort((a, b) => a.id - b.id);
  if (state.pending.length) drainQueue().catch((error) => toast(error.message)); else if (!state.processing) render();
}

function connect() {
  if (!state.token) return;
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  state.ws = new WebSocket(`${protocol}//${location.host}/ws/party?code=${code}&token=${encodeURIComponent(state.token)}`);
  state.ws.addEventListener("message", (event) => { const message = JSON.parse(event.data); if (message.type === "room-update") receive(message.room); else if (message.type === "error") toast(message.error); });
  state.ws.addEventListener("close", () => { clearTimeout(state.reconnect); state.reconnect = setTimeout(connect, 1500); });
}

async function sendAction(action, body = {}) {
  if (state.ws?.readyState === WebSocket.OPEN) state.ws.send(JSON.stringify({ type: "action", action, body }));
  else {
    const room = await api(`/api/party/rooms/${code}/${action}`, { method: "POST", body: { token: state.token, ...body } });
    if (room?.code) receive(room);
  }
}

root.addEventListener("click", async (event) => {
  const avatar = event.target.closest("[data-avatar]");
  if (avatar) {
    root.querySelectorAll("[data-avatar]").forEach((button) => button.classList.toggle("selected", button === avatar));
    root.querySelector("[name='characterId']").value = avatar.dataset.avatar;
    root.querySelector("[type='submit']").disabled = false;
    return;
  }
  try {
    const action = event.target.closest("[data-action]")?.dataset.action;
    if (action === "confirm-players") await sendAction("confirm-players");
    if (action === "confirm-setup") await sendAction("confirm-setup");
    if (action === "roll") { const die = event.target.closest("[data-action='roll']"); die.disabled = true; die.textContent = "🎲"; await sendAction("roll"); }
    if (action === "minigame-start") await startPhoneMinigame(event.target.closest("[data-action='minigame-start']"));
    const result = event.target.closest("[data-result]")?.dataset.result;
    if (result) { await sendAction("minigame-result", { completed: result !== "fail", score: 0 }); emulator.unload(); }
    const step = event.target.closest("[data-step]")?.dataset.step;
    if (step) await sendAction("setup", { setupStep: step });
    const ai = event.target.closest("[data-ai-avatar]");
    if (ai) {
      ai.classList.toggle("selected");
      const chosen = [...root.querySelectorAll("[data-ai-avatar].selected")].map((button) => ({ characterId: button.dataset.aiAvatar }));
      const maximum = 4 - state.room.players.length;
      if (chosen.length > maximum) { ai.classList.remove("selected"); toast(`Choose up to ${maximum} AI player${maximum === 1 ? "" : "s"}.`); return; }
      await sendAction("setup", { aiPlayers: chosen, setupStep: "ai-players" });
    }
    if (action === "continue-ai") {
      const chosen = [...root.querySelectorAll("[data-ai-avatar].selected")].map((button) => ({ characterId: button.dataset.aiAvatar }));
      await sendAction("setup", { aiPlayers: chosen, setupStep: "rounds" });
    }
    const pick = event.target.closest("[data-pick]");
    if (pick) {
      const field = pick.dataset.pick;
      const value = field === "rounds" ? Number(pick.dataset.value) : pick.dataset.value;
      await sendAction("setup", { [field]: value, setupStep: pick.dataset.next });
    }
  } catch (error) { toast(error.message); }
});

root.addEventListener("submit", async (event) => {
  if (event.target.id !== "v2-join-form") return;
  event.preventDefault();
  try {
    const form = new FormData(event.target);
    const joined = await api(`/api/party/rooms/${code}/join`, { method: "POST", body: { nickname: form.get("nickname"), characterId: form.get("characterId") } });
    state.token = joined.token;
    localStorage.setItem(identityKey, state.token);
    state.visible = null;
    receive(joined.room);
    connect();
  } catch (error) { toast(error.message); }
});

const PAD_BITS = { b: 0, select: 2, start: 3, up: 4, down: 5, left: 6, right: 7, a: 8 };
const activeTouches = new Map();
function updatePadMask() {
  const pads = new Set(activeTouches.values());
  state.inputMask = [...pads].reduce((mask, pad) => PAD_BITS[pad] === undefined ? mask : mask | (1 << PAD_BITS[pad]), 0);
  document.querySelectorAll("[data-pad]").forEach((button) => button.classList.toggle("pressed", pads.has(button.dataset.pad)));
}
function handlePadPointer(event) {
  const area = event.target?.closest?.(".virtual-pad");
  const key = event.target?.closest?.("[data-pad]") || (area || activeTouches.has(event.pointerId) ? document.elementFromPoint(event.clientX, event.clientY)?.closest?.("[data-pad]") : null);
  if (!key && !area && !activeTouches.has(event.pointerId)) return;
  if (["pointerdown", "pointermove"].includes(event.type) && key?.dataset.pad) { event.preventDefault(); activeTouches.set(event.pointerId, key.dataset.pad); updatePadMask(); }
  else if (["pointerup", "pointercancel", "pointerout", "pointerleave"].includes(event.type) && activeTouches.delete(event.pointerId)) updatePadMask();
}
for (const type of ["pointerdown", "pointermove", "pointerup", "pointercancel", "pointerleave", "pointerout"]) document.addEventListener(type, handlePadPointer, { passive: false });
window.addEventListener("blur", () => { activeTouches.clear(); updatePadMask(); });
requestAnimationFrame(function frames() { gameFrame(); requestAnimationFrame(frames); });

(async () => {
  try {
    emulator.ensureCore("nes").catch(() => {});
    if (!code) throw new Error("Use a four-letter Party player URL.");
    headerCode.textContent = code;
    if (state.token) {
      try {
        receive(await api(`/api/party/rooms/${code}/player?token=${encodeURIComponent(state.token)}`));
        const entry = state.room?.minigame?.players?.find((item) => item.playerId === state.room.self?.id);
        if (entry?.started && !entry.completed) await startPhoneMinigame(null);
        connect(); return;
      }
      catch { localStorage.removeItem(identityKey); state.token = ""; }
    }
    receive(await api(`/api/party/rooms/${code}`));
  } catch (error) { root.innerHTML = waiting("Room unavailable", error.message); }
})();
