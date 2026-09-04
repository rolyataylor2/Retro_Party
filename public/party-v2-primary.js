import { destroyBoardRenderers, mountBoardRenderer } from "./board-renderer.js";

const root = document.querySelector("#party-v2-primary");
const code = (location.pathname.match(/^\/party\/([A-Za-z]{4})\/?$/)?.[1] || "").toUpperCase();
const state = { room: null, visible: null, pending: [], processing: false, ws: null, reconnect: null, countdownTimer: null, lastGameEvent: null, lastAnimation: null, boardRenderer:null, boardGeneration:0 };

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

function character(room, id) { return room.catalog.characters.find((item) => item.id === id); }
function art(room, id) {
  const item = character(room, id) || room.catalog.characters[0];
  return `<span class="character-art" style="--character-color:${item.color};--character-x:${item.x}%;--character-y:${item.y}%" role="img" aria-label="${escapeHtml(item.name)}"></span>`;
}
function lookup(items, id) { return items.find((item) => item.id === id); }
function label(value) { return value ? String(value).replace(/-/g, " ").replace(/\b\w/g, (letter) => letter.toUpperCase()) : "Not chosen yet"; }
function roster(room) {
  const entries = [...room.players, ...(room.configuration.aiPlayers || []).map((player) => ({ ...player, ai: true }))];
  return `<div class="v2-roster">${Array.from({ length: 4 }, (_, index) => {
    const player = entries[index];
    if (!player) return `<div class="v2-roster-card empty"><b>OPEN SPOT</b><small>WAITING</small></div>`;
    return `<div class="v2-roster-card">${art(room, player.characterId)}<b>${escapeHtml(player.nickname)}</b><small>${player.ai ? "AI PLAYER" : player.primary ? "PRIMARY PLAYER" : "PLAYER"}</small></div>`;
  }).join("")}</div>`;
}

function construction() {
  return `<section class="v2-panel v2-construction"><div><span class="v2-construction-mark">✦</span><span class="v2-eyebrow">PARTY DISPLAY</span><h1>Syncing the next scene…</h1><p>The Director is preparing the display queue.</p></div></section>`;
}

function gameBoard(room) {
  const game = room.game;
  const board = room.catalog.boards.find((item) => item.id === game.boardId) || room.catalog.boards[0];
  const scores = game.players.map((player, index) => `<article class="v2-game-score ${index === game.currentPlayerIndex ? "active" : ""}">${art(room, player.characterId)}<span><b>${escapeHtml(player.nickname)}</b><small>★ ${player.stars} &nbsp; ● ${player.coins}</small></span></article>`).join("");
  const event = state.lastGameEvent;
  return `<section class="v2-game-stage"><div class="v2-game-hud"><div><small>PARTY · ${room.code}</small><b>ROUND ${game.round} <i>OF ${game.totalRounds}</i></b></div><strong>${game.lastRoll ? `🎲 ${game.lastRoll}` : "★"}</strong></div><div class="v2-board party-board-surface pixi-board-host" data-pixi-board="gameplay"></div><nav class="v2-board-camera" aria-label="Board camera"><button data-board-camera="left">←</button><button data-board-camera="up">↑</button><button data-board-camera="down">↓</button><button data-board-camera="right">→</button><button data-board-camera="out">−</button><button data-board-camera="in">＋</button><button data-board-camera="rotate-left">↶</button><button data-board-camera="rotate-right">↷</button><button data-board-camera="reset">⌂</button></nav><div class="v2-game-scores">${scores}</div>${event ? `<div class="v2-game-banner"><small>${escapeHtml(event.icon || "")} ${escapeHtml(event.title || titleForEvent(event.event))}</small><b>${escapeHtml(event.message || event.label || (event.roll ? `${game.players[event.playerIndex]?.nickname || "Player"} rolls ${event.roll}!` : "Party update!"))}</b></div>` : ""}</section>`;
}
async function mountGameplayBoard(room){const host=root.querySelector('[data-pixi-board="gameplay"]');if(!host)return;const generation=++state.boardGeneration,sourceBoard=room.catalog.boards.find(item=>item.id===room.game.boardId)||room.catalog.boards[0],board=structuredClone(sourceBoard),overrides=room.game.spaceAppearanceOverrides||{};for(const space of board.spaces||[]){const appearance=overrides[space.id];if(appearance)Object.assign(space,appearance);}const actors=room.game.players.map((player,index)=>{const avatar=character(room,player.characterId)||{};return{id:player.id,name:player.nickname,color:avatar.color,position:player.position,icon:String(index+1),spriteSheet:"/assets/rainshadow-roster.png",spriteX:avatar.x,spriteY:avatar.y};});const renderer=await mountBoardRenderer(host,board,{interactive:true,starPosition:room.game.starPosition});if(generation!==state.boardGeneration){renderer?.destroy();return;}state.boardRenderer=renderer;renderer.setActors(actors);}
async function mountSetupBoard(board){const host=root.querySelector('[data-pixi-board="setup"]');if(host&&board)await mountBoardRenderer(host,board,{interactive:false});}

function titleForEvent(event) { return String(event || "party update").replace(/-/g, " ").toUpperCase(); }

function rouletteView(room) {
  return `<section class="v2-panel v2-roulette-view"><span class="v2-eyebrow">MINI-GAME ROULETTE</span><h1>What’s next?</h1><div class="v2-roulette-list">${(room.roulette?.options || []).map((item, index) => `<article class="${index === room.roulette.selectedIndex ? "selected" : ""}"><i>${index === room.roulette.selectedIndex ? "▶" : "•"}</i><b>${escapeHtml(item.title)}</b><small>${escapeHtml(item.category)}</small></article>`).join("")}</div></section>`;
}

function minigameView(room) {
  const challenge = room.minigame?.challenge;
  return `<section class="v2-panel v2-live-results"><span class="v2-eyebrow">LIVE MINI-GAME</span><h1>${escapeHtml(challenge?.title || "Mini-game time!")}</h1><p>${escapeHtml(challenge?.instructions || "Look at your player screen.")}</p><div class="v2-result-grid">${(room.minigame?.players || []).map((entry) => `<article class="${entry.completed ? entry.result?.completed ? "win" : "out" : ""}"><b>${escapeHtml(entry.nickname)}</b><strong>${entry.completed ? entry.result?.completed ? "FINISHED!" : "OUT" : entry.started ? "PLAYING" : "READY"}</strong></article>`).join("")}</div></section>`;
}

function resultsView(room) {
  return `<section class="v2-panel v2-construction"><div><span class="v2-eyebrow">MINI-GAME RESULTS</span><h1>${room.summary?.winnerName ? `${escapeHtml(room.summary.winnerName)} wins!` : "No winner this time"}</h1><p>${room.summary?.winnerName ? "+10 coins · Returning to the board…" : "Returning to the board…"}</p></div></section>`;
}

function finalResults(room) {
  const ranked = [...(room.game?.players || [])].sort((a, b) => b.stars - a.stars || b.coins - a.coins);
  return `<section class="v2-panel v2-final"><span class="v2-eyebrow">FINAL RESULTS</span><h1>${escapeHtml(ranked[0]?.nickname || "Everybody")} wins!</h1><div class="v2-final-podium">${ranked.map((player, index) => `<article class="place-${index + 1}"><strong>${index + 1}</strong>${art(room, player.characterId)}<b>${escapeHtml(player.nickname)}</b><small>★ ${player.stars} · ● ${player.coins}</small></article>`).join("")}</div></section>`;
}

function demoView(room) {
  const queue = room.gameQueue || { active: [], pending: [], history: [] };
  const active = queue.active[0];
  const progress = active?.endsAt && active?.startedAt ? Math.max(0, Math.min(100, (Date.now() - active.startedAt) / (active.endsAt - active.startedAt) * 100)) : 0;
  const mash = active?.type === "demo-button-mash";
  const winner = room.game?.players.find((player) => player.id === room.demo?.winnerId);
  return `<section class="v2-demo-stage"><div class="v2-demo-scene"><div class="v2-demo-moon">☾</div><div class="v2-demo-ghost ${active?.type?.includes("ghost") || queue.history.some((item) => item.type === "demo-ghost-appear") ? "visible" : ""}">👻</div><div class="v2-demo-players">${room.game.players.map((player) => `<div>${art(room, player.characterId)}<b>${escapeHtml(player.nickname)}</b><small>● ${player.coins}</small></div>`).join("")}</div>${active?.type === "demo-dialogue" ? `<div class="v2-demo-dialogue">“${escapeHtml(active.payload.message)}”</div>` : ""}${mash ? `<div class="v2-mash"><b>MASH A!</b><i><span style="width:${progress}%"></span></i><small>INPUT BARRIER · QUEUE PAUSED</small></div>` : ""}${winner ? `<div class="v2-demo-winner">${escapeHtml(winner.nickname)} WINS +20 COINS!</div>` : ""}</div><aside class="v2-queue-inspector"><span class="v2-eyebrow">LIVE QUEUE INSPECTOR</span><h2>Ghost Challenge</h2><div class="v2-queue-now"><small>NOW</small>${queue.active.map((item) => `<article><b>${titleForEvent(item.type)}</b><i><span style="width:${item.endsAt ? Math.max(2, Math.min(100, (Date.now()-item.startedAt)/(item.endsAt-item.startedAt)*100)) : 100}%"></span></i>${item.startsEarly ? `<em>overlap ${item.startsEarly}ms</em>` : item.barrier ? "<em>hard barrier</em>" : ""}</article>`).join("") || "<p>Director is choosing…</p>"}</div><div class="v2-queue-pending"><small>NEXT</small>${queue.pending.slice(0,6).map((item) => `<div><i>→</i>${titleForEvent(item.type)}</div>`).join("")}</div></aside></section>`;
}

function render(room = state.visible || state.room) {
  if (!room) return;
  destroyBoardRenderers(root);state.boardRenderer=null;
  clearInterval(state.countdownTimer);
  const view = room.displayView || room.status;
  if (["board", "playing", "roulette", "minigame", "results", "final-results", "complete"].includes(view) && !room.game) {
    root.innerHTML = `<section class="v2-panel v2-construction"><div><span class="v2-orbit">✦</span><span class="v2-eyebrow">RESTORING PARTY</span><h1>Getting the board ready…</h1><p>The server is repairing this room’s saved game state.</p></div></section>`;
    return;
  }
  if (view === "under-construction") { root.innerHTML = construction(); return; }
  if (["board", "playing"].includes(view)) { root.innerHTML = gameBoard(room); mountGameplayBoard(room).catch(showError); return; }
  if (["roulette"].includes(view)) { root.innerHTML = rouletteView(room); return; }
  if (["minigame"].includes(view)) { root.innerHTML = minigameView(room); return; }
  if (["results"].includes(view)) { root.innerHTML = resultsView(room); return; }
  if (["final-results", "complete"].includes(view)) { root.innerHTML = finalResults(room); return; }
  if (["demo", "demo-complete"].includes(view)) { root.innerHTML = demoView(room); state.countdownTimer = setInterval(() => { if (state.room?.status === "demo") root.innerHTML = demoView(state.room); }, 100); return; }
  if (view === "countdown") {
    root.innerHTML = `<section class="v2-panel v2-countdown"><div><span class="v2-eyebrow">EVERYONE GET READY</span><span id="v2-count-number" class="v2-count-number">5</span><h1>Party starting!</h1></div></section>`;
    const update = () => {
      const node = document.querySelector("#v2-count-number");
      if (node) node.textContent = Math.max(1, Math.ceil((room.countdownEndsAt - Date.now()) / 1000));
    };
    update(); state.countdownTimer = setInterval(update, 100);
    return;
  }
  if (view === "registration") {
    root.innerHTML = `<section class="v2-panel"><div class="v2-primary-top"><div><span class="v2-eyebrow">PARTY · PRIMARY DISPLAY</span><h1>Build your crew.</h1><p>Open the player address on another browser, then register a name and avatar.</p><div class="v2-join-url">${escapeHtml(location.host)}/party/player/${room.code}</div></div><div class="v2-code">${room.code}</div></div>${roster(room)}</section>`;
    return;
  }

  const config = room.configuration || {};
  const board = lookup(room.catalog.boards, config.boardId);
  const pack = lookup(room.catalog.packs, config.packId);
  const rules = lookup(room.catalog.rulesets, config.rulesetId);
  const selection = (step, title, value) => `<div class="v2-selection ${room.setupStep === step ? "current" : ""}"><small>${title}</small><b>${escapeHtml(value)}</b></div>`;
  root.innerHTML = `<section class="v2-panel"><div class="v2-primary-top"><div><span class="v2-eyebrow">LIVE PARTY SETUP · ${room.code}</span><h1>${room.setupStep === "review" ? "Final check." : "Primary is choosing…"}</h1><p>Every selection is arriving through the persistent display queue.</p></div><div class="v2-code">${room.code}</div></div><div class="v2-setup-layout"><div><div class="v2-selection-list">
    ${selection("ai-players", "AI players", Array.isArray(config.aiPlayers) ? (config.aiPlayers.length ? config.aiPlayers.map((item) => item.nickname).join(" · ") : "No AI players") : "Not chosen yet")}
    ${selection("rounds", "Rounds", config.rounds ? `${config.rounds} rounds` : "Not chosen yet")}
    ${selection("minigames", "Mini-game set", pack?.name || "Not chosen yet")}
    ${selection("ruleset", "Ruleset", rules?.name || "Not chosen yet")}
    ${selection("ai-difficulty", "AI difficulty", label(config.aiDifficulty))}
    ${selection("board", "Board", board?.name || "Not chosen yet")}
  </div>${roster(room)}</div><div class="v2-preview pixi-board-host" data-pixi-board="setup"><div class="v2-preview-copy"><span class="v2-eyebrow">CURRENT STEP</span><h2>${label(room.setupStep)}</h2><p>${escapeHtml(board?.description || "Selections will appear here as the primary player moves through the wizard.")}</p></div></div></div></section>`;
  mountSetupBoard(board).catch(showError);
}

function applyPatch(object, patch) {
  const keys = String(patch.path).split(".");
  const finalKey = keys.pop();
  const parent = keys.reduce((value, key) => value[key] ||= {}, object);
  if (patch.op === "replace") parent[finalKey] = structuredClone(patch.value);
  else if (patch.op === "add") {
    parent[finalKey] ||= [];
    const identityKey = patch.value?.id ? "id" : patch.value?.characterId ? "characterId" : null;
    if (!identityKey || !parent[finalKey].some((entry) => entry?.[identityKey] === patch.value[identityKey])) parent[finalKey].push(structuredClone(patch.value));
  } else if (patch.op === "remove" && Array.isArray(parent[finalKey])) {
    const match = patch.match || {};
    parent[finalKey] = parent[finalKey].filter((entry) => !Object.entries(match).every(([key, value]) => entry?.[key] === value));
  }
}
root.addEventListener("click",event=>{const control=event.target.closest("[data-board-camera]")?.dataset.boardCamera,renderer=state.boardRenderer;if(!control||!renderer)return;if(control==="left")renderer.panBy(90,0);else if(control==="right")renderer.panBy(-90,0);else if(control==="up")renderer.panBy(0,70);else if(control==="down")renderer.panBy(0,-70);else if(control==="in")renderer.zoomBy(1.2);else if(control==="out")renderer.zoomBy(.84);else if(control==="rotate-left")renderer.rotateBy(-Math.PI/24);else if(control==="rotate-right")renderer.rotateBy(Math.PI/24);else renderer.setCamera({x:0,y:0,zoom:1,rotation:0});});

function applyQueueItem(item, latest) {
  const visible = state.visible;
  if (!visible) return;
  if (item.command === "patch") for (const patch of item.payload.patches || []) applyPatch(visible, patch);
  else if (item.command === "navigate" || item.command === "request-input" || item.command === "refresh") {
    visible.displayView = item.payload.view;
    for (const [key, value] of Object.entries(item.payload)) if (!["view", "animation"].includes(key)) visible[key] = value;
  } else if (item.command === "game-event" && item.payload.banner === true) state.lastGameEvent = item.payload;
  else if (item.command === "animate") state.lastAnimation = item.payload;
  visible.catalog = latest.catalog;
  render(visible);
}

async function drainQueue() {
  if (state.processing || !state.pending.length) return;
  state.processing = true;
  const acknowledged = [];
  let shouldRefresh = false;
  while (state.pending.length) {
    const item = state.pending.shift();
    applyQueueItem(item, state.room);
    acknowledged.push(item.id);
    shouldRefresh ||= item.command === "refresh";
  }
  if (acknowledged.length) await api(`/api/party/rooms/${code}/ack-primary`, { method: "POST", body: { ids: acknowledged }, keepalive: shouldRefresh });
  state.processing = false;
  if (shouldRefresh) {
    const refreshKey = `party-primary-refresh:${code}:${Math.max(...acknowledged)}`;
    if (!sessionStorage.getItem(refreshKey)) { sessionStorage.setItem(refreshKey, "1"); location.reload(); return; }
  }
  state.visible = structuredClone(state.room);
  render();
}

function receive(room) {
  state.room = room;
  if (!state.visible) state.visible = structuredClone(room);
  const known = new Set(state.pending.map((item) => item.id));
  for (const item of room.queue || []) if (!known.has(item.id)) state.pending.push(item);
  state.pending.sort((a, b) => a.id - b.id);
  if (state.pending.length) drainQueue().catch(showError); else { state.visible = structuredClone(room); render(); }
}

function connect() {
  const protocol = location.protocol === "https:" ? "wss:" : "ws:";
  state.ws = new WebSocket(`${protocol}//${location.host}/ws/party?code=${code}`);
  state.ws.addEventListener("message", (event) => {
    const message = JSON.parse(event.data);
    if (message.type === "room-update") receive(message.room);
    else if (message.type === "error") showError(new Error(message.error));
  });
  state.ws.addEventListener("close", () => { clearTimeout(state.reconnect); state.reconnect = setTimeout(connect, 1500); });
}

function showError(error) {
  root.innerHTML = `<section class="v2-panel v2-construction"><div><span class="v2-construction-mark">!</span><h1>Party couldn’t open</h1><p>${escapeHtml(error.message)}</p></div></section>`;
}

(async () => {
  try {
    if (!code) throw new Error("Use a four-letter room URL, such as /party/PLAY.");
    receive(await api(`/api/party/rooms/${code}`, { method: "POST" }));
    if (new URLSearchParams(location.search).get("demo") === "1") receive(await api(`/api/party/rooms/${code}/demo`, { method: "POST" }));
    connect();
  } catch (error) { showError(error); }
})();
