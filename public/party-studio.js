const root = document.querySelector("#party-studio");
const toastNode = document.querySelector("#studio-toast");
const sections = { map: "map", scene: "scenes", event: "events", rules: "rules", data: "data" };
const stationMeta = {
  map: { name: "MAP MAKER", kicker: "DRAFTING TABLE", icon: "✥", copy: "Stamp spaces, sketch paths, and place board toys.", color: "blue" },
  scene: { name: "SCENE DIRECTOR", kicker: "MOVIE SET", icon: "🎬", copy: "Stage overlapping action on a toy-train timeline.", color: "purple" },
  event: { name: "SPACE ACTIONS", kicker: "CUTSCENES & SCRIPTS", icon: "⚡", copy: "Catalog, design spaces, cast characters, and script interactive cutscenes.", color: "orange" },
  rules: { name: "RULE BOOK", kicker: "LAWS OF THE PARTY", icon: "▤", copy: "Decide what the Director queues next.", color: "red" },
  data: { name: "TOY CATALOGUE", kicker: "ITEMS & COLLECTIBLES", icon: "🧸", copy: "Design coins, stars, dice blocks, power-ups, cards, food, and healing items.", color: "green" },
  test: { name: "TEST LAB", kicker: "QUEUE CONTROL ROOM", icon: "⚙", copy: "Pull the lever and watch every queue card move.", color: "yellow" },
};

const mapMarkerKinds = { object: ["objects", "♣", "BOARD TOY"], trigger: ["triggers", "⚡", "EVENT TRIGGER"], region: ["regions", "▧", "BOARD REGION"], spawn: ["spawns", "★", "PLAYER SPAWN"], camera: ["cameras", "🎥", "CAMERA POINT"] };
const eventTriggerKinds = [
  ["land","LANDS ON","A player stops on its connected space."],["pass","WALKS OVER","A player crosses its connected space."],
  ["proximity","COMES NEAR","A player enters the trigger toy's radius."],["round","AT ROUND","The chosen round begins."],
  ["turn","AT TURN","The chosen player's turn begins."],["game-start","GAME STARTS","The board first unfolds."],
  ["before-minigame","BEFORE MINI-GAME","The roulette is about to begin."],["after-minigame","AFTER MINI-GAME","Results have finished."],
];
const weatherEffects = {
  rain: { label: "RAIN", icon: "🌧️", particle: "╱" },
  lightning: { label: "LIGHTNING", icon: "⚡", particle: "ϟ" },
  sandstorm: { label: "SAND STORM", icon: "🏜️", particle: "•" },
  snow: { label: "SNOW STORM", icon: "❄️", particle: "❄" },
  sunny: { label: "SUNNY", icon: "☀️", particle: "✦" },
  cloudy: { label: "CLOUDY", icon: "☁️", particle: "☁" },
  windy: { label: "WINDY", icon: "💨", particle: "〰" },
  leaves: { label: "FALL LEAVES", icon: "🍂", particle: "🍂" },
  blossoms: { label: "SPRING CHERRY BLOSSOMS", icon: "🌸", particle: "🌸" },
  hail: { label: "HAIL", icon: "🌨️", particle: "●" },
};
const toyCategories = {
  currency: { label: "COINS & STARS", icon: "🪙" },
  dice: { label: "DICE BLOCKS", icon: "🎲" },
  powerup: { label: "POWER-UPS", icon: "⚡" },
  card: { label: "CARDS", icon: "🃏" },
  food: { label: "FOOD", icon: "🍎" },
  healing: { label: "HEALING", icon: "❤️" },
  other: { label: "OTHER TOYS", icon: "🧸" },
};
const starterToys = [
  { id: "coins", name: "COINS", icon: "🪙", category: "currency", description: "The standard spendable board currency.", effectType: "coins", amount: 1, stackLimit: 999, consumable: false, rarity: "common" },
  { id: "stars", name: "STARS", icon: "⭐", category: "currency", description: "The primary victory collectible.", effectType: "stars", amount: 1, stackLimit: 99, consumable: false, rarity: "legendary" },
  { id: "standard-die", name: "STANDARD DICE BLOCK", icon: "🎲", category: "dice", description: "Roll from 1 to 6 for normal movement.", effectType: "roll", amount: 1, dieFaces: "1,2,3,4,5,6", stackLimit: 1, consumable: false, rarity: "common" },
  { id: "double-die", name: "DOUBLE DICE BLOCK", icon: "🎲🎲", category: "dice", description: "Roll two dice and move by their total.", effectType: "roll", amount: 2, dieFaces: "1,2,3,4,5,6", stackLimit: 3, consumable: true, rarity: "uncommon" },
  { id: "triple-die", name: "TRIPLE DICE BLOCK", icon: "🎲", category: "dice", description: "Roll three dice and move by their total.", effectType: "roll", amount: 3, dieFaces: "1,2,3,4,5,6", stackLimit: 3, consumable: true, rarity: "rare" },
  { id: "slow-die", name: "SLOW DICE BLOCK", icon: "🐢", category: "dice", description: "Choose a careful roll from 1 to 3.", effectType: "roll", amount: 1, dieFaces: "1,2,3", stackLimit: 3, consumable: true, rarity: "uncommon" },
  { id: "super-mushroom", name: "SUPER MUSHROOM", icon: "🍄", category: "powerup", description: "Boost the player's next movement.", effectType: "move", amount: 3, stackLimit: 3, consumable: true, rarity: "uncommon" },
  { id: "warp-whistle", name: "WARP WHISTLE", icon: "🪈", category: "powerup", description: "Warp to another board space.", effectType: "warp", amount: 1, stackLimit: 1, consumable: true, rarity: "rare" },
  { id: "duel-card", name: "DUEL CARD", icon: "⚔️", category: "card", description: "Challenge another player to a duel.", effectType: "duel", amount: 1, stackLimit: 3, consumable: true, rarity: "rare" },
  { id: "coin-card", name: "COIN BONUS CARD", icon: "🃏", category: "card", description: "Gain a quick coin bonus.", effectType: "coins", amount: 10, stackLimit: 5, consumable: true, rarity: "uncommon" },
  { id: "party-apple", name: "PARTY APPLE", icon: "🍎", category: "food", description: "A small restorative snack.", effectType: "heal", amount: 10, stackLimit: 5, consumable: true, rarity: "common" },
  { id: "celebration-cake", name: "CELEBRATION CAKE", icon: "🍰", category: "food", description: "A powerful treat that restores the whole party.", effectType: "heal-party", amount: 20, stackLimit: 1, consumable: true, rarity: "rare" },
  { id: "heart-potion", name: "HEART POTION", icon: "🧪", category: "healing", description: "Restore health or clear a minor injury.", effectType: "heal", amount: 25, stackLimit: 5, consumable: true, rarity: "uncommon" },
  { id: "first-aid-kit", name: "FIRST AID KIT", icon: "🩹", category: "healing", description: "Restore health and remove a negative status.", effectType: "heal-status", amount: 50, stackLimit: 2, consumable: true, rarity: "rare" },
];
const app = {
  project: null, editor: null, selectedSpace: null, selectedMarker: null, selectedClip: null, selectedCommand: null,
  pathFrom: null, draggingClip: null, draggingSpace: null, ignoreClipClick: false, mapZoom: 1.55, mapPan: { x: 0, y: 0 },
  panning: null, panMoved: false, spaceHeld: false, rulePage: "flow", workshopsOpen: false, saveTimers: {},
  testTimer: null, testStartedAt: null, testNow: 0, audio: null, history: [], future: [],
  // Space Actions Studio State
  spaceActionCatalogView: true, spaceActionFilter: "all", spaceActionTab: "visuals",
  actionPickerOpen: false, actionPickerTarget: { parentId: null, branchKey: null, index: -1 }, actionPickerTab: "dialogue",
  editingCommand: null,
  previewingCutscene: false, previewStep: 0, previewTimer: null, previewState: null,
  // Video Editor Multi-Track Timeline State
  timelinePlaying: false, timelinePlayhead: 0, timelineZoom: 100, timelineRipple: true,
  timelineSelectedClipId: null, timelineActiveTrackId: "track-main",
  timelineDraggingPlayhead: false, timelineDraggingClip: null, timelineTimer: null,
  toyCategory: "all", editingToy: null,
  boardEditorDrawerOpen: false,
};

if (location.pathname === "/party-studio.html") history.replaceState({}, "", "/party");

const html = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
async function api(path, options = {}) {
  const config = { ...options, headers: { "Content-Type": "application/json", ...(options.headers || {}) } };
  if (config.body && typeof config.body !== "string") config.body = JSON.stringify(config.body);
  const response = await fetch(path, config), data = await response.json();
  if (!response.ok || data.error) throw new Error(data.error || "The Party Studio machine jammed.");
  return data;
}
function toast(message) { toastNode.textContent = message; toastNode.classList.add("show"); clearTimeout(toast.timer); toast.timer = setTimeout(() => toastNode.classList.remove("show"), 1800); }
function sound(note = 440, duration = .06) {
  try { const Audio = window.AudioContext || window.webkitAudioContext; app.audio ||= new Audio(); const oscillator = app.audio.createOscillator(), gain = app.audio.createGain(); oscillator.frequency.value = note; oscillator.type = "square"; gain.gain.setValueAtTime(.035, app.audio.currentTime); gain.gain.exponentialRampToValueAtTime(.001, app.audio.currentTime + duration); oscillator.connect(gain).connect(app.audio.destination); oscillator.start(); oscillator.stop(app.audio.currentTime + duration); } catch {}
}
function editorFromPath() { return location.pathname.match(/^\/party\/(?:editor|board\/[a-z0-9-]+\/editor)\/(map|scene|event|rules|data|test)\/?$/)?.[1] || null; }
function boardIdFromPath() { return location.pathname.match(/^\/party\/board\/([a-z0-9-]+)/)?.[1] || null; }
function boardEditorPath(editor) { return `/party/board/${app.project.boardProjects.selectedId}/editor/${editor}`; }
function go(path) {
  const wasOverview = !app.editor && !boardIdFromPath();
  history.pushState({}, "", path);
  app.editor = editorFromPath();
  app.workshopsOpen = false;
  app.boardEditorDrawerOpen = false;
  render();
  if (wasOverview && (app.editor || boardIdFromPath())) {
    document.body.classList.add("party-studio-editor-entering");
    clearTimeout(app.editorEnterTimer);
    app.editorEnterTimer = setTimeout(() => document.body.classList.remove("party-studio-editor-entering"), 650);
  }
  sound(520);
}
function randomCode() { const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ"; return Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join(""); }
function remember() { app.history.push(structuredClone(app.project)); app.history = app.history.slice(-30); app.future = []; }
function frame(meta, content, extra = "") {
  return `<section class="studio-shell editor-${meta.color}"><header class="studio-bar"><button data-nav data-go="/party/board/${app.project.boardProjects.selectedId}" class="studio-back">◀ BOARD</button><div class="studio-mini-logo"><strong>STARLIGHT</strong><small>PARTY STUDIO</small></div><div class="studio-station-title"><small>${meta.kicker}</small><b>${meta.name}</b></div><nav class="studio-quick"><button data-nav data-undo ${app.history.length ? "" : "disabled"}>↶ <span>UNDO</span></button><button data-nav data-redo ${app.future.length ? "" : "disabled"}>↷ <span>REDO</span></button><button data-nav data-test-shortcut>▶ <span>TEST</span></button></nav><span id="save-lamp" class="save-lamp">● SAVED</span></header>${content}<footer class="studio-help"><span>◀▶ MOVE</span><span><i class="key-a">A</i> CHOOSE</span><span><i class="key-b">B</i> BACK</span>${extra}</footer></section>`;
}
function hub() {
  return makerMenu("PARTY STUDIO", "Choose what you want to build", [
    { icon: "🗺️", title: "BOARD MAKER", copy: "Build a complete party board and everything that belongs to it.", path: "/party/boards" },
  ]);
}
function makerMenu(title, copy, choices, back = "") {
  return `<section class="studio-hub"><div class="confabulator-stage"><div class="confabulator-screen"><header class="hub-title">${back ? `<button data-nav data-go="${back}" class="maker-back">◀ BACK</button>` : ""}<small>CONFABULATOR ONLINE</small><h1>${html(title)}</h1><p>${html(copy)}</p></header><div class="maker-choice-grid">${choices.map((choice) => `<${choice.href ? "a" : "button"} data-nav ${choice.href ? `href="${choice.href}"` : `data-go="${choice.path}"`} class="maker-choice"><span>${choice.icon}</span><div><b>${html(choice.title)}</b><p>${html(choice.copy)}</p><em>OPEN ▶</em></div></${choice.href ? "a" : "button"}>`).join("")}</div></div></div><footer class="hub-controls"><span><i class="key-a">A / ENTER</i> OPEN</span><span><i class="key-b">B</i> BACK</span></footer></section>`;
}
function boardPicker() {
  const boards = app.project.boardProjects.entries;
  return `<section class="studio-hub"><div class="confabulator-stage"><div class="confabulator-screen"><header class="hub-title"><button data-nav data-go="/party" class="maker-back">◀ MAKERS</button><small>BOARD MAKER</small><h1>CHOOSE A BOARD</h1><p>Every board keeps its own map, scenes, actions, rules, and toys.</p></header><div class="board-picker-grid">${boards.map((board) => `<button data-nav data-select-board="${html(board.id)}" class="board-picker-card"><span class="board-picker-art ${board.map.image ? "" : "is-grid"}" ${board.map.image ? `style="background-image:url('${html(board.map.image)}')"` : ""}>${board.map.image ? "" : "▦"}</span><b>${html(board.name)}</b><small>${board.map.spaces.length} SPACES · ${board.events.entries.length} ACTIONS</small></button>`).join("")}<button data-nav data-create-board class="board-picker-card create-board"><span>＋</span><b>CREATE NEW BOARD</b><small>START WITH A GREEN GRID</small></button></div></div></div></section>`;
}
function boardShowcase() {
  const map = app.project.map;
  const spaces = map.spaces.map((space) => `<span class="showcase-space map-space ${space.type} shape-${space.shape || "oval"}" style="left:${space.x}%;top:${space.y}%;--space-size:${space.size || 3};transform:translate(-50%,-50%) rotate(${space.rotation || 0}deg)"></span>`).join("");
  const markers = Object.entries(mapMarkerKinds).flatMap(([kind, [collection, icon]]) => (map[collection] || []).map((marker) => `<span class="showcase-marker" style="left:${marker.x}%;top:${marker.y}%" title="${html(marker.name || kind)}">${icon}</span>`)).join("");
  const editors = Object.entries(stationMeta).filter(([id]) => id !== "minigame").map(([id, meta]) => `<button data-nav data-go="${boardEditorPath(id)}" class="board-editor-link"><i>${meta.icon}</i><span><b>${meta.name}</b><small>${meta.kicker}</small></span><em>▶</em></button>`).join("");
  return `<section class="studio-shell board-showcase-shell"><header class="board-showcase-header"><button data-nav data-go="/party/boards">◀ ALL BOARDS</button><div><small>BOARD MAKER</small><h1>${html(map.name)}</h1><p>${map.spaces.length} spaces · ${app.project.events.entries.length} actions · ${app.project.data.toys?.length || 0} toys</p></div></header><main class="board-showcase-stage"><div class="board-showcase-map ${map.image ? "" : "is-grid"}" ${map.image ? `style="background-image:url('${html(map.image)}')"` : ""}>${pathsSvg(map)}${spaces}${markers}${!map.image && !map.spaces.length ? `<div class="empty-board-message"><b>YOUR NEW BOARD</b><span>Open Map Maker to upload artwork and place the first space.</span></div>` : ""}</div></main><div class="board-editor-drawer ${app.boardEditorDrawerOpen ? "open" : ""}"><button data-nav data-board-editor-drawer class="board-editor-toggle"><span>${app.boardEditorDrawerOpen ? "×" : "✦"}</span><b>${app.boardEditorDrawerOpen ? "CLOSE" : "EDIT BOARD"}</b></button>${app.boardEditorDrawerOpen ? `<aside><header><small>${html(map.name)}</small><b>BOARD WORKSHOPS</b></header>${editors}</aside>` : ""}</div></section>`;
}
function pathsSvg(map) {
  const byId = new Map(map.spaces.map((space) => [space.id, space]));
  return `<svg class="map-paths" viewBox="0 0 100 100" preserveAspectRatio="none">${map.paths.map((path) => { const from = byId.get(path.from), to = byId.get(path.to); return from && to ? `<line x1="${from.x}" y1="${from.y}" x2="${to.x}" y2="${to.y}"/>` : ""; }).join("")}</svg>`;
}
function mapEditor() {
  const map = app.project.map, selected = map.spaces.find((space) => space.id === app.selectedSpace);
  const markerKinds = mapMarkerKinds;
  const workshops = ["scene", "event", "rules", "data", "test"].map((id) => `<button data-nav data-go="${boardEditorPath(id)}" class="workshop-link station-${stationMeta[id].color}"><i>${stationMeta[id].icon}</i><span><small>${stationMeta[id].kicker}</small><b>${stationMeta[id].name}</b></span><em>OPEN ▶</em></button>`).join("");
  const tools = [["pan","✋"],["space","●"],["path","〰"],["object","♣"],["trigger","⚡"],["region","▧"],["spawn","★"],["camera","🎥"]].map(([id, icon]) => `<button data-nav data-map-tool="${id}" class="${map.tool === id ? "active" : ""}"><i>${icon}</i>${id.toUpperCase()}</button>`).join("");
  const spaces = map.spaces.map((space) => `<button data-nav data-space="${space.id}" class="map-space ${space.type} shape-${space.shape || "oval"} ${space.activity ? "has-activity" : ""} ${app.pathFrom === space.id ? "path-origin" : ""} ${selected?.id === space.id ? "selected" : ""}" style="left:${space.x}%;top:${space.y}%;--space-size:${space.size};transform:translate(-50%,-50%) rotate(${space.rotation}deg)" title="${html(space.activity?.title || `${space.type} space`)}">${space.activity ? `<span>${html(space.activity.icon || "✦")}</span>` : ""}</button>`).join("");
  const markers = Object.entries(markerKinds).flatMap(([kind, [collection, icon]]) => (map[collection] || []).map((marker) => `<button data-nav data-marker-kind="${kind}" data-marker-id="${html(marker.id)}" class="map-marker marker-${kind} ${app.selectedMarker?.kind === kind && app.selectedMarker?.id === marker.id ? "selected" : ""}" style="left:${marker.x}%;top:${marker.y}%" title="${html(marker.name || kind)}"><i>${icon}</i></button>`)).join("");
  const markerMeta = app.selectedMarker && markerKinds[app.selectedMarker.kind], marker = markerMeta && (map[markerMeta[0]] || []).find((item) => item.id === app.selectedMarker.id);
  const boundEvent=marker?.eventId&&app.project.events.entries.find(entry=>entry.id===marker.eventId),boundTrigger=boundEvent?.trigger&&typeof boundEvent.trigger==="object"?boundEvent.trigger:{kind:"proximity"};
  const triggerControls=marker&&app.selectedMarker.kind==="trigger"?`<section class="marker-trigger-controls"><small>SENDS THIS EVENT</small><div><button data-nav data-marker-event="-1">◀</button><b>${html(boundEvent?.name||"CHOOSE AN EVENT")}</b><button data-nav data-marker-event="1">▶</button></div><small>WHEN?</small><strong>${html((eventTriggerKinds.find(([id])=>id===boundTrigger.kind)?.[1]||"COMES NEAR"))}</strong>${boundTrigger.kind==="proximity"?`<label>RADIUS <span>${marker.radius||boundTrigger.radius||10}</span><button data-nav data-marker-radius="-2">−</button><button data-nav data-marker-radius="2">＋</button></label>`:""}${marker.spaceId!=null?`<em>SNAPPED TO SPACE ${Number(marker.spaceId)+1}</em>`:`<em>FREE ON THE MAP</em>`}</section>`:"";
  const toolbox = selected ? `<aside class="toy-toolbox"><header><i class="property-space ${selected.type}"></i><div><small>SPACE ${selected.id + 1}</small><h2>${selected.type.toUpperCase()} SPACE</h2></div></header><label>SIZE <span class="property-pips">${"●".repeat(selected.size)}${"○".repeat(5-selected.size)}</span><button data-nav data-space-adjust="size:-1">◀</button><button data-nav data-space-adjust="size:1">▶</button></label><label>SHAPE <span>${(selected.shape || "oval").toUpperCase()}</span><button data-nav data-space-shape="-1">◀</button><button data-nav data-space-shape="1">▶</button></label><label>ROTATION <span>${selected.rotation}°</span><button data-nav data-space-adjust="rotation:-15">◀</button><button data-nav data-space-adjust="rotation:15">▶</button></label><label>DEPTH <span>${selected.depth}</span><button data-nav data-space-adjust="depth:-1">◀</button><button data-nav data-space-adjust="depth:1">▶</button></label><div class="property-action"><small>ACTION</small><b>${html((selected.action || `${selected.type}-space-event`).replace(/-/g," ").toUpperCase())}</b><i>▼</i></div><div class="space-paints">${["blue","red","lucky","event","start"].map((type) => `<button data-nav data-space-type="${type}" class="${type} ${selected.type === type ? "active" : ""}">${type.toUpperCase()}</button>`).join("")}</div><button data-nav data-delete-space class="danger-button">POOF! DELETE</button></aside>` : marker ? `<aside class="toy-toolbox marker-toolbox"><header><i>${markerMeta[1]}</i><div><small>${app.selectedMarker.kind.toUpperCase()}</small><h2>${html(marker.name || markerMeta[2])}</h2></div></header><div class="marker-readout"><small>BOARD POSITION</small><b>${Math.round(marker.x)} · ${Math.round(marker.y)}</b><p>This piece travels with the board and can be targeted by scenes and events.</p></div>${triggerControls}<button data-nav data-delete-marker class="danger-button">POOF! DELETE</button></aside>` : `<aside class="toy-toolbox empty"><span>${map.tool === "path" ? "〰" : markerKinds[map.tool]?.[1] || "☝"}</span><h2>${map.tool === "path" ? app.pathFrom == null ? "PICK THE FIRST SPACE" : "PICK THE NEXT SPACE" : markerKinds[map.tool] ? `STAMP A ${markerKinds[map.tool][2]}` : "PICK A SPACE"}</h2><p>${map.tool === "path" ? app.pathFrom == null ? "Connectors snap together as you sketch." : "The new path is glowing—finish the connection." : map.tool==="trigger"?"Press a space to snap it, or press anywhere for a free trigger.":"Press the board to place it."}</p></aside>`;
  return frame(stationMeta.map, `<div class="map-document-bar"><span>BOARD:</span><b>${html(map.name)}</b><em>${map.spaces.length} SPACES · ${map.paths.length} PATHS · ${Object.values(markerKinds).reduce((total,[collection])=>total+(map[collection]||[]).length,0)} TOYS</em><button data-nav data-workshop-toggle><kbd>W</kbd> WORKSHOPS</button></div><div class="map-workbench"><nav class="tool-wheel"><strong>TOOLS</strong>${tools}</nav><div class="drafting-table"><div class="ruler top"></div><div id="map-viewport" class="map-canvas-viewport"><div id="map-board" class="studio-map party-board-surface tool-${map.tool}" style="background-image:url('${html(map.image)}');transform:translate(${app.mapPan.x}px,${app.mapPan.y}px) scale(${app.mapZoom})">${pathsSvg(map)}${spaces}${markers}<div class="map-tape one"></div><div class="map-tape two"></div><div class="glove-cursor">☝</div></div></div><div class="map-zoom"><button data-nav data-map-zoom="-.2" aria-label="Zoom out">−</button><b>${Math.round(app.mapZoom*100)}%</b><button data-nav data-map-zoom=".2" aria-label="Zoom in">＋</button><button data-nav data-map-reset aria-label="Reset view">⌂</button></div><div class="pencil-cup">✎<br>✐</div></div>${toolbox}</div>${app.workshopsOpen ? `<div class="workshop-shade"><section class="workshop-switcher"><header><div><small>MAP MAKER SHORTCUT</small><h2>VISIT A WORKSHOP</h2><p>Your board is already saved. Jump out and come back whenever you like.</p></div><button data-nav data-workshop-toggle aria-label="Close">×</button></header><div>${workshops}</div><footer><kbd>W</kbd> CLOSE WORKSHOPS</footer></section></div>` : ""}`, `<span><kbd>SPACE</kbd> PAN</span><span>WHEEL ZOOM</span><span><i class="key-x">X</i> TOOLS</span><button data-nav data-workshop-toggle class="help-workshops"><kbd>W</kbd> WORKSHOPS</button>`);
}
function sceneEditor() {
  const scene = app.project.scenes.entries.find((entry) => entry.id === app.project.scenes.selectedId) || app.project.scenes.entries[0];
  const tracks = ["camera","actor","players","effects","dialogue","input","game"];
  const clips = tracks.map((track) => `<div class="timeline-track"><b>${({camera:"🎥",actor:"👻",players:"👤",effects:"✦",dialogue:"💬",input:"Ⓐ",game:"★"})[track]}</b><div>${scene.clips.filter((clip) => clip.track === track).map((clip) => `<button data-nav data-clip="${clip.id}" class="timeline-clip clip-${clip.color} ${app.selectedClip === clip.id ? "selected" : ""}" style="left:${clip.start/scene.duration*100}%;width:${clip.duration/scene.duration*100}%"><span>${html(clip.label)}</span>${clip.barrier ? "<em>HARD BARRIER</em>" : ""}</button>`).join("")}</div></div>`).join("");
  const selected = scene.clips.find((clip) => clip.id === app.selectedClip);
  const controls = selected ? `<div class="clip-controls"><b>${html(selected.label)}</b><span>WHEN? ${selected.start.toFixed(2)}s</span><button data-nav data-clip-adjust="start:-.25">◀ EARLIER</button><button data-nav data-clip-adjust="start:.25">LATER ▶</button><span>HOW LONG? ${selected.duration.toFixed(2)}s</span><button data-nav data-clip-adjust="duration:-.25">− SHORTER</button><button data-nav data-clip-adjust="duration:.25">+ LONGER</button></div>` : `<div class="clip-controls empty"><b>PICK A TRAIN CAR</b><span>Overlapping cars happen together.</span></div>`;
  return frame(stationMeta.scene, `<div class="scene-stage"><div class="scene-preview"><div class="scene-moon">☾</div><div class="scene-ghost">👻</div><div class="tiny-director">🎬<span>Places, everyone!</span></div></div><section class="timeline-machine"><header><button data-nav data-scene-play class="clapper">▶ CLACK! PLAY</button><h2>${html(scene.name)}</h2><button data-nav data-add-clip>＋ ADD CAR</button></header><div class="time-ruler">${Array.from({length:13},(_,i)=>`<i>${i}s</i>`).join("")}</div><div class="scene-playhead" style="left:${Math.min(100,app.testNow/scene.duration*100)}%"></div>${clips}</section>${controls}</div>`);
}
// --- Web Audio Chiptune SFX Synthesizer ---
function playSfx(type) {
  try {
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    app.audio ||= new AudioCtx();
    const ctx = app.audio;
    const now = ctx.currentTime;

    const playTone = (freq, start, duration, wave = "square", vol = 0.08) => {
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.type = wave;
      osc.frequency.setValueAtTime(freq, now + start);
      gain.gain.setValueAtTime(vol, now + start);
      gain.gain.exponentialRampToValueAtTime(0.001, now + start + duration);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(now + start); osc.stop(now + start + duration);
    };

    if (type === "coin") {
      playTone(987.77, 0, 0.08, "sine", 0.12);
      playTone(1318.51, 0.07, 0.22, "sine", 0.14);
    } else if (type === "star" || type === "fanfare") {
      [523.25, 659.25, 783.99, 1046.50, 783.99, 1046.50].forEach((f, i) => playTone(f, i * 0.09, 0.18, "triangle", 0.15));
    } else if (type === "thunder" || type === "shock") {
      const bufferSize = ctx.sampleRate * 0.4;
      const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
      const data = buffer.getChannelData(0);
      for (let i = 0; i < bufferSize; i++) data[i] = Math.random() * 2 - 1;
      const noise = ctx.createBufferSource();
      noise.buffer = buffer;
      const filter = ctx.createBiquadFilter();
      filter.type = "lowpass"; filter.frequency.setValueAtTime(800, now);
      filter.frequency.exponentialRampToValueAtTime(80, now + 0.38);
      const gain = ctx.createGain();
      gain.gain.setValueAtTime(0.3, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.4);
      noise.connect(filter); filter.connect(gain); gain.connect(ctx.destination);
      noise.start(now);
    } else if (type === "warp") {
      const osc = ctx.createOscillator(), gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.setValueAtTime(880, now);
      osc.frequency.exponentialRampToValueAtTime(110, now + 0.3);
      gain.gain.setValueAtTime(0.12, now); gain.gain.exponentialRampToValueAtTime(0.01, now + 0.3);
      osc.connect(gain); gain.connect(ctx.destination);
      osc.start(now); osc.stop(now + 0.3);
    } else if (type === "dice") {
      [400, 600, 500, 800].forEach((f, i) => playTone(f, i * 0.05, 0.04, "square", 0.06));
    } else if (type === "chest" || type === "item") {
      [440, 554.37, 659.25, 880].forEach((f, i) => playTone(f, i * 0.08, 0.15, "triangle", 0.1));
    } else if (type === "mystery") {
      [311.13, 370.0, 440.0, 523.25].forEach((f, i) => playTone(f, i * 0.07, 0.14, "sine", 0.09));
    } else if (type === "lose") {
      [349.23, 329.63, 311.13, 277.18].forEach((f, i) => playTone(f, i * 0.12, 0.25, "sawtooth", 0.08));
    } else if (type === "laugh") {
      [440, 550, 440, 550, 440].forEach((f, i) => playTone(f, i * 0.08, 0.07, "square", 0.08));
    } else if (type === "dialogue-blip") {
      playTone(600 + Math.random() * 200, 0, 0.03, "triangle", 0.05);
    } else if (type === "whistle") {
      playTone(1200, 0, 0.15, "sine", 0.08); playTone(1500, 0.15, 0.25, "sine", 0.09);
    } else {
      playTone(480, 0, 0.08, "square", 0.08);
    }
  } catch {}
}

function renderSpaceToken(space = {}, extraClass = "") {
  const shape = space.shape || "oval";
  const color = space.color || "violet";
  const effect = space.effect || "sparkles";
  const customImg = space.customImage;
  const icon = space.icon || "⚡";

  return `
    <div class="space-token-visual shape-${html(shape)} color-${html(color)} ${effect !== "none" ? `effect-${html(effect)}` : ""} ${extraClass}">
      ${customImg ? `<img src="${html(customImg)}" class="space-custom-img" alt="Custom space">` : (shape === "none" ? `<span style="opacity:0.9;">${html(icon)}</span>` : `<span>${html(icon)}</span>`)}
    </div>
  `;
}

function commandWeatherType(command = {}) {
  if (command.weatherType && weatherEffects[command.weatherType]) return command.weatherType;
  const label = String(command.label || "").toLowerCase();
  if (label.includes("lightning") || label.includes("thunder")) return "lightning";
  if (label.includes("sand")) return "sandstorm";
  if (label.includes("snow")) return "snow";
  if (label.includes("sunny")) return "sunny";
  if (label.includes("cloud")) return "cloudy";
  if (label.includes("wind")) return "windy";
  if (label.includes("leaves")) return "leaves";
  if (label.includes("blossom")) return "blossoms";
  if (label.includes("hail")) return "hail";
  if (label.includes("rain") || label.includes("storm")) return "rain";
  return "";
}

function syncTimelineToCommands(entry) {
  if (!entry.timeline || !entry.timeline.tracks) return;
  const allClips = [];
  for (const track of entry.timeline.tracks) {
    if (track.muted) continue;
    for (const clip of track.clips || []) {
      allClips.push(clip);
    }
  }
  allClips.sort((a, b) => (a.start || 0) - (b.start || 0));
  entry.commands = allClips.map((clip) => ({
    id: clip.id,
    category: clip.category || "dialogue",
    kind: clip.kind || (clip.category === "logic" ? "condition" : clip.category === "rewards" ? "player" : "action"),
    label: clip.label || "Cutscene Action",
    speaker: clip.speaker,
    text: clip.text,
    style: clip.style,
    camAction: clip.camAction,
    zoom: clip.zoom,
    intensity: clip.intensity,
    target: clip.target,
    actorAction: clip.actorAction,
    pose: clip.pose,
    rewardType: clip.rewardType,
    amount: clip.amount,
    condType: clip.condType,
    condValue: clip.condValue,
    sfx: clip.sfx,
    bgm: clip.bgm,
    worldAction: clip.worldAction,
    weatherType: clip.weatherType,
    weatherIntensity: clip.weatherIntensity,
    particleImage: clip.particleImage,
    waitForInput: clip.waitForInput,
    start: clip.start,
    duration: clip.duration,
    open: true,
    depth: 0,
  }));
}

function findClipInTimeline(timeline, clipId) {
  if (!timeline || !timeline.tracks) return null;
  for (let tIdx = 0; tIdx < timeline.tracks.length; tIdx++) {
    const track = timeline.tracks[tIdx];
    const cIdx = (track.clips || []).findIndex((c) => c.id === clipId);
    if (cIdx !== -1) {
      return { clip: track.clips[cIdx], track, trackIndex: tIdx, clipIndex: cIdx };
    }
  }
  return null;
}

function findCommandInTree(cmds, targetId, parent = null, branch = null) {
  for (let i = 0; i < cmds.length; i++) {
    const cmd = cmds[i];
    if (cmd.id === targetId) return { cmd, index: i, list: cmds, parent, branch };
    if (cmd.thenCommands) {
      const found = findCommandInTree(cmd.thenCommands, targetId, cmd, "then");
      if (found) return found;
    }
    if (cmd.elseCommands) {
      const found = findCommandInTree(cmd.elseCommands, targetId, cmd, "else");
      if (found) return found;
    }
  }
  return null;
}

function ensureSpaceActionDefaults(entry, index = 0) {
  entry.space ||= {
    type: "event", shape: "oval", color: "violet", icon: "⚡",
    effect: "sparkles", customImage: "",
    glow: true, title: entry.name || `Space Action ${index + 1}`,
    description: "Triggers custom cutscenes and rule modifications.",
  };
  entry.space.shape ||= "oval";
  entry.space.effect ||= "sparkles";
  entry.space.customImage ||= "";

  entry.characters ||= [
    { id: "host-1", name: "Host Guide", role: "Host", isHost: true, icon: "✦", sprite: "", anchor: "center", animation: "float" }
  ];
  if (entry.characters.length && !entry.characters.some((c) => c.isHost || c.role === "Host")) {
    entry.characters[0].isHost = true;
    entry.characters[0].role = "Host";
  }

  entry.activations ||= {
    movement: { land: true, pass: false, reverse: false },
    proximity: { enabled: false, radius: 10 },
    timing: { round: 0, interval: 0, turn: 0, gameStart: false, finalRounds: false },
    conditions: { minCoins: 0, requiredItem: "", mapState: "any" },
    minigames: { beforeMinigame: false, afterMinigame: false },
  };
  entry.trigger ||= { kind: "land", spaceId: 7, radius: 10, round: 1, turn: 1 };
  entry.commands ||= [];

  // Multi-Track Video Editor Timeline setup
  entry.timeline ||= {
    duration: 16,
    tracks: [
      {
        id: "track-main",
        name: "Track 1 · Main Sequence",
        kind: "main",
        color: "violet",
        locked: false,
        muted: false,
        clips: []
      }
    ]
  };
  entry.timeline.duration ||= 16;
  entry.timeline.tracks ||= [];
  if (!entry.timeline.tracks.length) {
    entry.timeline.tracks.push({
      id: "track-main",
      name: "Track 1 · Main Sequence",
      kind: "main",
      color: "violet",
      locked: false,
      muted: false,
      clips: []
    });
  }

  // Populate timeline clips if tracks are empty but commands exist
  const mainTrack = entry.timeline.tracks[0];
  if (mainTrack && !mainTrack.clips.length && entry.commands.length) {
    let t = 0;
    for (let i = 0; i < entry.commands.length; i++) {
      const cmd = entry.commands[i];
      const dur = cmd.duration || (cmd.category === "dialogue" ? 2.5 : 1.8);
      const isLogic = cmd.category === "logic" || cmd.kind === "condition";
      const clip = {
        id: cmd.id || `clip-${Date.now()}-${i}`,
        start: t,
        duration: dur,
        category: cmd.category || (cmd.kind === "condition" ? "logic" : cmd.kind === "player" ? "rewards" : "dialogue"),
        kind: cmd.kind || "action",
        label: cmd.label || "Action",
        speaker: cmd.speaker,
        text: cmd.text,
        style: cmd.style,
        camAction: cmd.camAction,
        zoom: cmd.zoom,
        intensity: cmd.intensity,
        target: cmd.target,
        actorAction: cmd.actorAction,
        pose: cmd.pose,
        rewardType: cmd.rewardType,
        amount: cmd.amount,
        condType: cmd.condType,
        condValue: cmd.condValue,
        sfx: cmd.sfx,
        bgm: cmd.bgm,
        worldAction: cmd.worldAction,
        weatherType: cmd.weatherType,
        weatherIntensity: cmd.weatherIntensity,
        particleImage: cmd.particleImage,
        waitForInput: cmd.waitForInput,
        isDecision: isLogic,
      };
      mainTrack.clips.push(clip);

      if (isLogic && cmd.elseCommands && cmd.elseCommands.length) {
        let branchTrack = entry.timeline.tracks.find((tr) => tr.kind === "branch-false");
        if (!branchTrack) {
          branchTrack = {
            id: `track-branch-${Date.now()}`,
            name: "Branch 2 · False / Otherwise",
            kind: "branch-false",
            color: "amber",
            locked: false,
            muted: false,
            clips: []
          };
          entry.timeline.tracks.push(branchTrack);
        }
        let bt = t;
        for (const eCmd of cmd.elseCommands) {
          branchTrack.clips.push({
            id: eCmd.id || `clip-else-${Date.now()}`,
            start: bt,
            duration: eCmd.duration || 2.0,
            category: eCmd.category || "rewards",
            kind: eCmd.kind || "action",
            label: eCmd.label || "Else Action",
            isFalseBranchStart: bt === t,
          });
          bt += 2.0;
        }
      }
      t += dur + 0.2;
    }
    entry.timeline.duration = Math.max(16, Math.ceil(t + 4));
  }

  syncTimelineToCommands(entry);
  entry.music ||= { track: "default", autoRestore: true };
  entry.variables ||= {};
  return entry;
}

// --- Space Actions Catalog View ---
function spaceActionsCatalog() {
  const entries = app.project.events.entries.map((entry, index) => ensureSpaceActionDefaults(entry, index));
  const filter = app.spaceActionFilter || "all";
  const filtered = filter === "all" ? entries : entries.filter((e) => (e.space?.type || "event") === filter);

  const filterButtons = [
    ["all", "ALL SPACES"], ["event", "⚡ EVENT"], ["lucky", "🍀 LUCKY"], ["shop", "🛒 SHOP"],
    ["duel", "⚔️ DUEL"], ["warp", "🌀 WARP"], ["trap", "💀 TRAP"], ["custom", "✦ CUSTOM"]
  ].map(([key, label]) => `
    <button data-nav data-space-filter="${key}" class="catalog-filter-pill ${filter === key ? "active" : ""}">
      ${label}
    </button>
  `).join("");

  const cards = filtered.map((entry) => {
    const space = entry.space || { type: "event", shape: "oval", color: "violet", icon: "⚡" };
    const cast = entry.characters || [];
    const commands = entry.commands || [];
    const activations = entry.activations || { movement: { land: true } };

    const actTags = [];
    if (activations.movement?.land || entry.trigger?.kind === "land") actTags.push("🎯 LAND ON");
    if (activations.movement?.pass || entry.trigger?.kind === "pass") actTags.push("🚶 WALK OVER");
    if (activations.proximity?.enabled || entry.trigger?.kind === "proximity") actTags.push(`◎ RADIUS ${activations.proximity?.radius || entry.trigger?.radius || 10}`);
    if (activations.timing?.interval > 0) actTags.push(`⏰ EVERY ${activations.timing.interval} ROUNDS`);
    if (activations.timing?.round > 0) actTags.push(`⏰ ROUND ${activations.timing.round}`);
    if (activations.conditions?.minCoins > 0) actTags.push(`💰 >= ${activations.conditions.minCoins} COINS`);
    if (!actTags.length) actTags.push("⚡ ON TRIGGER");

    const host = cast.find((c) => c.isHost || c.role === "Host");
    const castAvatars = cast.slice(0, 3).map((c) => `
      <span class="cast-avatar-pill ${c.isHost ? "is-host" : ""}" title="${html(c.name)} (${html(c.role)})">
        ${c.sprite ? `<img src="${html(c.sprite)}" class="cast-avatar-img" alt="${html(c.name)}">` : `<span>${html(c.icon || "👤")}</span>`}
        <b>${c.isHost ? "👑 " : ""}${html(c.name)}</b>
      </span>
    `).join("");

    return `
      <article class="space-action-card" data-space-action-edit="${html(entry.id)}">
        <div class="card-hero-preview">
          ${renderSpaceToken(space)}
          <div class="card-meta">
            <small>${html(space.type || "EVENT")} SPACE · ${html(space.shape || "oval").toUpperCase()}</small>
            <h3>${html(entry.name || "Untitled Action")}</h3>
          </div>
        </div>

        ${cast.length ? `<div class="card-cast-strip"><small>CAST</small>${castAvatars}</div>` : ""}

        <div class="card-tags-row">
          ${actTags.map((tag) => `<span class="card-tag highlight">${tag}</span>`).join("")}
          <span class="card-tag">⚡ ${commands.length} SCRIPT STEP${commands.length === 1 ? "" : "S"}</span>
          ${space.effect && space.effect !== "none" ? `<span class="card-tag">✨ ${html(space.effect).toUpperCase()}</span>` : ""}
        </div>

        <div class="card-buttons-row">
          <button data-nav data-space-action-edit="${html(entry.id)}" class="card-btn primary">✏️ EDIT</button>
          <button data-nav data-space-action-clone="${html(entry.id)}" class="card-btn secondary">📋 CLONE</button>
          <button data-nav data-space-action-delete="${html(entry.id)}" class="card-btn danger">🗑️</button>
        </div>
      </article>
    `;
  }).join("");

  const newCard = `
    <button data-nav data-space-action-create class="space-action-card new-card">
      <span style="font-size:3.5rem;">＋</span>
      <b style="font-size:1.2rem;color:#ffe47a;margin-top:8px;">NEW SPACE ACTION</b>
      <small style="color:#ad97d6;">Create space, cast actors &amp; script cutscene</small>
    </button>
  `;

  return frame(stationMeta.event, `
    <div class="space-catalog-shell">
      <header class="catalog-top-bar">
        <div class="catalog-title-group">
          <small>CATALOG OF BOARD MOMENTS &amp; CUTSCENES</small>
          <h1>🪐 Space Actions Catalog</h1>
        </div>
        <div class="catalog-actions">
          <button data-nav data-space-action-create class="card-btn primary" style="padding:10px 18px;">＋ NEW SPACE ACTION</button>
        </div>
      </header>

      <div class="catalog-filter-bar">
        ${filterButtons}
      </div>

      <div class="space-catalog-grid">
        ${cards}
        ${newCard}
      </div>
    </div>
  `);
}

// --- Video Editor Multi-Track Timeline View ---
// --- Video Editor Multi-Track Timeline View ---
function cutsceneTimelineView(entry) {
  const timeline = entry.timeline;
  const playhead = Math.max(0, app.timelinePlayhead || 0);
  const pxPerSec = app.timelineZoom || 100;
  const duration = Math.max(16, timeline.duration || 16);
  const totalPx = Math.max(1400, Math.ceil(duration * pxPerSec) + 200);

  const formatTime = (sec) => {
    const m = Math.floor(sec / 60);
    const s = (sec % 60).toFixed(2);
    return `${String(m).padStart(2, "0")}:${s.padStart(5, "0")}`;
  };

  // Find parent logic/input decisions for branch tracks
  const branchLogicMap = new Map();
  timeline.tracks.forEach((track, tIdx) => {
    (track.clips || []).forEach((clip) => {
      const isBranching = clip.category === "logic" || clip.category === "input" || clip.kind === "condition" || clip.isDecision || clip.inputType || clip.condType || (clip.label && clip.label.toLowerCase().includes("prompt")) || (clip.label && clip.label.toLowerCase().includes("question")) || (clip.label && clip.label.toLowerCase().includes("qte"));
      if (isBranching && tIdx + 1 < timeline.tracks.length) {
        const branchTrack = timeline.tracks[tIdx + 1];
        branchLogicMap.set(branchTrack.id, { parentClip: clip, parentTrack: track, logicStart: clip.start || 0 });
      }
    });
  });

  // Generate Ruler Ticks
  const ticks = [];
  for (let s = 0; s <= duration; s++) {
    ticks.push(`
      <div class="ruler-tick-sec" style="left:${s * pxPerSec}px;">
        <span>${formatTime(s)}</span>
      </div>
    `);
    if (s < duration) {
      for (let sub = 1; sub <= 3; sub++) {
        ticks.push(`
          <div class="ruler-subtick" style="left:${(s + sub * 0.25) * pxPerSec}px;"></div>
        `);
      }
    }
  }

  // Left Sidebar: Track Headers
  const trackHeaders = timeline.tracks.map((track, tIdx) => {
    const isLocked = track.locked === true;
    const isMuted = track.muted === true;
    const isBoundToLogic = track.kind === "branch-false" || branchLogicMap.has(track.id);

    return `
      <div class="track-header-item ${isLocked ? "is-locked" : ""}" data-track-id="${html(track.id)}">
        <div class="track-header-title-row">
          <span class="track-color-pip" style="background:var(--color-${track.color || "violet"}, #aa77ee);"></span>
          <b class="track-name-label" title="${html(track.name)}">${html(track.name)}</b>
        </div>
        <div class="track-header-tools-row">
          <div style="display:flex;gap:4px;">
            <button data-nav data-toggle-track-lock="${html(track.id)}" class="track-tool-btn ${isLocked ? "active-lock" : ""}" title="${isLocked ? "Unlock Track" : "Lock Track (Protect from Ripple Edits)"}">
              ${isLocked ? "🔒 LOCKED" : "🔓 UNLOCKED"}
            </button>
            <button data-nav data-toggle-track-mute="${html(track.id)}" class="track-tool-btn ${isMuted ? "active-mute" : ""}" title="${isMuted ? "Unmute Track" : "Mute Track"}">
              ${isMuted ? "🔇 MUTE" : "🔊 LIVE"}
            </button>
          </div>
          ${isBoundToLogic ? `
            <span style="font-size:.55rem;font-weight:900;color:#ee6655;padding:2px 5px;border:1px solid #ee6655;border-radius:4px;background:rgba(238,102,85,.12);" title="Cannot delete track while tied to a logic condition">
              🔒 BOUND TO LOGIC
            </span>
          ` : (tIdx > 0 ? `
            <button data-nav data-delete-track="${html(track.id)}" class="track-tool-btn" style="color:#ee6655;" title="Delete Track">🗑</button>
          ` : "")}
        </div>
      </div>
    `;
  }).join("");

  const catIcons = {
    dialogue: "💬", camera: "📷", actors: "👤", vfx: "✨",
    inventory: "🎒", rewards: "🎒", logic: "🔀", world: "🌍", audio: "🎵", input: "🎮"
  };

  const branchConnectors = [];

  // Right Canvas: Track Lanes & Clip Blocks
  const trackLanes = timeline.tracks.map((track, tIdx) => {
    const isLocked = track.locked === true;
    const boundInfo = branchLogicMap.get(track.id);
    const logicStart = boundInfo ? (boundInfo.logicStart || 0) : (track.kind === "branch-false" ? 2.0 : 0);

    const clipsHtml = (track.clips || []).map((clip) => {
      const isSelected = (app.timelineSelectedClipIds && app.timelineSelectedClipIds.has(clip.id)) || app.timelineSelectedClipId === clip.id;
      const cat = clip.category || (clip.kind === "condition" ? "logic" : "dialogue");
      const isBranching = cat === "logic" || cat === "input" || clip.kind === "condition" || clip.isDecision || clip.inputType || clip.condType || (clip.label && clip.label.toLowerCase().includes("prompt")) || (clip.label && clip.label.toLowerCase().includes("question")) || (clip.label && clip.label.toLowerCase().includes("qte"));
      const leftPx = (clip.start || 0) * pxPerSec;
      const widthPx = Math.max(48, (clip.duration || 2.0) * pxPerSec);

      // Check if clip requires waiting for input
      const needsInput = clip.waitForInput === true || (clip.waitForInput !== false && (cat === "dialogue" || cat === "input" || isBranching || (clip.label && clip.label.toLowerCase().includes("prompt"))));

      // Overlapping Tall Logic/Input Block calculation
      const hasBranchBelow = isBranching && (tIdx + 1 < timeline.tracks.length);
      const isTallBlock = hasBranchBelow;
      const tallHeight = isTallBlock ? 138 : 62;

      // Calculate end-cap labels
      let upperCap = "TRUE";
      let lowerCap = "FALSE";
      if (clip.choice1) upperCap = clip.choice1.toUpperCase();
      if (clip.choice2) lowerCap = clip.choice2.toUpperCase();
      if (clip.passLabel) upperCap = clip.passLabel.toUpperCase();
      if (clip.failLabel) lowerCap = clip.failLabel.toUpperCase();
      if (clip.inputType === "prompt-yes-no") { upperCap = "YES"; lowerCap = "NO"; }
      else if (clip.inputType === "qte-mash") { upperCap = "PASS"; lowerCap = "FAIL"; }
      else if (clip.inputType === "reaction-stop") { upperCap = "WIN"; lowerCap = "LOSE"; }
      else if (clip.condType === "random-percent") { upperCap = "HEADS"; lowerCap = "TAILS"; }

      if (isTallBlock) {
        return `
          <div class="timeline-clip-block tall-logic-block cat-${cat} ${isSelected ? "clip-selected" : ""}"
               data-clip-id="${html(clip.id)}"
               data-track-id="${html(track.id)}"
               style="left:${leftPx}px;width:${widthPx}px;height:${tallHeight}px;"
               title="${html(clip.label || "Decision / Split Action")} (Double-click to Edit)">
            
            <div class="clip-trim-handle left" data-clip-trim-left="${html(clip.id)}"></div>
            <div class="clip-trim-handle right" data-clip-trim-right="${html(clip.id)}"></div>
            ${needsInput ? `<span class="clip-stop-input-badge" title="Waits for player input">🕹️</span>` : ""}

            <!-- Top Lane: Main Condition / Choice 1 & continuation -->
            <div class="logic-lane-band">
              <div class="clip-top-meta">
                <span class="clip-cat-badge">
                  <span>${catIcons[cat] || "⚡"}</span> ${html(cat)}
                </span>
                <span class="clip-duration-tag">${(clip.duration || 2).toFixed(1)}s</span>
              </div>

              <div class="clip-label-text" style="color:#ffe47a;">
                <b>${cat === "input" ? "🎮 ASK:" : "🔀 IF:"}</b> ${html(clip.questionText || clip.label || "Check Condition")}
              </div>

              <div class="clip-tools-strip">
                <button data-nav data-script-edit="${html(clip.id)}" class="clip-mini-btn" title="Edit Parameters">✏️</button>
                <button data-nav data-timeline-clip-clone="${html(clip.id)}" class="clip-mini-btn" title="Duplicate">📋</button>
                <button data-nav data-timeline-clip-delete="${html(clip.id)}" class="clip-mini-btn" title="Delete" style="color:#ee6655;">🗑</button>
              </div>

              <!-- Right-Hanging Upper Cap -->
              <span class="logic-cap-tag true-cap">${html(upperCap)} ▶</span>
            </div>

            <!-- Lower Lane: Spans over the branch track below with Lower end-cap -->
            <div class="logic-lane-band branch-target-band">
              <div style="display:flex;align-items:center;height:100%;">
                <span style="font-size:.62rem;font-weight:900;color:#ff9988;">✕ ON ${html(lowerCap)} / OTHERWISE</span>
              </div>

              <!-- Right-Hanging Lower Cap -->
              <span class="logic-cap-tag false-cap">${html(lowerCap)} ▶</span>
            </div>
          </div>
        `;
      }

      return `
        <div class="timeline-clip-block cat-${cat} ${isSelected ? "clip-selected" : ""}"
             data-clip-id="${html(clip.id)}"
             data-track-id="${html(track.id)}"
             style="left:${leftPx}px;width:${widthPx}px;height:62px;"
             title="${html(clip.label || "Action")} (Double-click to Edit)">
          
          <div class="clip-trim-handle left" data-clip-trim-left="${html(clip.id)}"></div>
          <div class="clip-trim-handle right" data-clip-trim-right="${html(clip.id)}"></div>
          ${needsInput ? `<span class="clip-stop-input-badge" title="Waits for player confirmation / input">🕹️</span>` : ""}

          <div class="clip-top-meta">
            <span class="clip-cat-badge">
              <span>${catIcons[cat] || "⚡"}</span> ${html(cat)}
            </span>
            <span class="clip-duration-tag">${(clip.duration || 2).toFixed(1)}s</span>
          </div>

          <div class="clip-label-text">
            ${isBranching ? `<b>🔀 IF:</b> ` : ""}${html(clip.label || "Cutscene Action")}
          </div>

          <div class="clip-tools-strip">
            ${isBranching ? `<span class="branch-true-arrow">✓ TRUE ➔</span>` : ""}
            <button data-nav data-script-edit="${html(clip.id)}" class="clip-mini-btn" title="Edit Event Parameters">✏️</button>
            <button data-nav data-timeline-clip-clone="${html(clip.id)}" class="clip-mini-btn" title="Duplicate Clip">📋</button>
            <button data-nav data-timeline-clip-delete="${html(clip.id)}" class="clip-mini-btn" title="Delete Clip" style="color:#ee6655;">🗑</button>
          </div>
        </div>
      `;
    }).join("");

    return `
      <div class="timeline-track-lane ${isLocked ? "locked-lane" : ""}" data-track-id="${html(track.id)}" style="width:${totalPx}px;">
        ${(track.kind === "branch-false" || boundInfo) && logicStart > 0 ? `
          <div class="branch-pre-inactive-zone" style="width:${logicStart * pxPerSec}px;">
            <span class="pre-inactive-label">⛔ INACTIVE BEFORE DECISION POINT (${logicStart.toFixed(1)}s)</span>
          </div>
        ` : ""}
        ${clipsHtml}
      </div>
    `;
  }).join("");

  const isPlaying = app.timelinePlaying === true;
  const isRippleOn = app.timelineRipple !== false;

  return `
    <div class="video-timeline-shell">
      <!-- Top Transport & Playback Control Bar -->
      <div class="timeline-transport-bar">
        <div class="transport-controls-group">
          <button data-nav data-timeline-rewind class="transport-btn" title="Rewind to 0.0s">
            ⏮ REWIND
          </button>
          <button data-nav data-timeline-play class="transport-btn primary ${isPlaying ? "active" : ""}" title="Play / Pause Timeline">
            ${isPlaying ? "⏸ PAUSE" : "▶ PLAY"}
          </button>
          <div class="time-readout-pill">
            <span style="color:#8b78af;">⏱</span>
            <span>${formatTime(playhead)}</span>
            <span style="color:#6d5f85;">/ ${formatTime(duration)}</span>
          </div>
        </div>

        <div class="timeline-actions-group">
          <button data-nav data-open-action-picker-timeline class="transport-btn primary" style="background:#54d682;color:#072613;">
            ＋ ADD EVENT AT CURSOR (${playhead.toFixed(1)}s)
          </button>
          <button data-nav data-add-track class="transport-btn">
            ＋ ADD TRACK
          </button>
          <button data-nav data-toggle-ripple class="transport-btn ${isRippleOn ? "active" : ""}" title="When ON, adding/moving clips shifts following clips forward on unlocked tracks">
            ${isRippleOn ? "🌊 RIPPLE EDIT: ON" : "⚓ RIPPLE EDIT: OFF"}
          </button>
          <div style="display:flex;align-items:center;gap:4px;background:#090615;padding:3px 8px;border-radius:8px;border:2px solid #080d20;">
            <button data-nav data-timeline-zoom="-20" class="clip-mini-btn">🔍−</button>
            <span style="font-size:.65rem;color:#ffe47a;font-weight:900;padding:0 4px;">${pxPerSec}px/s</span>
            <button data-nav data-timeline-zoom="20" class="clip-mini-btn">🔍＋</button>
          </div>
        </div>
      </div>

      <!-- Main Timeline Workspace: Headers & Canvas -->
      <div class="timeline-workspace" id="timeline-workspace-root">
        <!-- Left Sidebar: Track Headers -->
        <aside class="timeline-headers-sidebar">
          <div class="headers-corner-cell">
            <span>TRACKS &amp; FLOW</span>
            <span style="color:#8b78af;">${timeline.tracks.length} LANES</span>
          </div>
          ${trackHeaders}
        </aside>

        <!-- Right Viewport: Scrollable Canvas with Ruler, Playhead & Lanes -->
        <main class="timeline-tracks-viewport" id="timeline-canvas-viewport">
          <!-- Time Ruler -->
          <div class="timeline-ruler" id="timeline-ruler" style="width:${totalPx}px;">
            ${ticks.join("")}
          </div>

          <!-- Scrubbing Playhead Needle -->
          <div class="timeline-playhead-needle" id="timeline-playhead-cursor" style="left:${playhead * pxPerSec}px;">
            <div class="playhead-head-handle" data-playhead-handle title="Drag or click ruler to scrub">
              <span style="font-size:.48rem;font-weight:900;color:#fff;">${playhead.toFixed(1)}</span>
            </div>
          </div>

          <!-- Track Lanes -->
          <div class="timeline-lanes-stack" style="width:${totalPx}px;">
            ${trackLanes}
          </div>
        </main>
      </div>
    </div>
  `;
}

// --- Space Action Multi-Tab Editor ---
function spaceActionEditor(entry) {
  ensureSpaceActionDefaults(entry);
  const tab = app.spaceActionTab || "visuals";
  const space = entry.space;
  const cast = entry.characters;
  const activations = entry.activations;

  const tabButtons = [
    ["visuals", "🎨 SPACE VISUALS"],
    ["cast", "👤 CHARACTERS & CAST"],
    ["activations", "⚡ ACTIVATIONS"],
    ["script", "🎬 CUTSCENE TIMELINE"]
  ].map(([id, label]) => `
    <button data-nav data-editor-tab="${id}" class="editor-tab-btn ${tab === id ? "active" : ""}">
      ${label}
    </button>
  `).join("");

  let tabContent = "";

  // Tab 1: Visuals & Appearance
  if (tab === "visuals") {
    const shapes = [
      ["oval", "OVAL"], ["round", "ROUND"], ["star", "STAR"],
      ["diamond", "DIAMOND"], ["hex", "HEX"], ["shield", "SHIELD"],
      ["none", "NO GRAPHIC"]
    ];
    const colors = ["violet", "coral", "cyan", "gold", "mint", "ruby", "dark", "rainbow"];
    const effects = [
      ["sparkles", "✨ SPARKLES"], ["halo", "🌟 HALO RING"], ["pulse", "💓 PULSE BEACON"],
      ["fire", "🔥 FIRE AURA"], ["electric", "⚡ ELECTRIC"], ["spectral", "👻 SPECTRAL MIST"],
      ["stars", "💫 STARS ORBIT"], ["none", "✕ NO EFFECT"]
    ];
    const iconPresets = [
      "⚡", "👻", "🤖", "🧚", "⚔️", "🛒", "💎", "🎲", "🔑", "💣", "🌋", "🌟",
      "🎪", "🍄", "🏰", "🎁", "🔥", "❄️", "☠️", "✨", "👑", "🔮", "🛳️", "🏆"
    ];

    tabContent = `
      <div class="visuals-form-grid">
        <div class="visuals-live-stage">
          <small style="color:#ffc83b;font-weight:900;letter-spacing:.14em;">LIVE SPACE PREVIEW</small>
          ${renderSpaceToken(space, "stage-preview-token")}
          <b style="font-size:1.2rem;color:#fff;">${html(entry.name)}</b>
          <p style="font-size:.75rem;color:#c9bee6;margin:0;">${html(space.description)}</p>
          ${space.customImage ? `<button data-nav data-remove-space-image class="cmd-btn danger" style="margin-top:6px;">✕ REMOVE CUSTOM IMAGE</button>` : ""}
        </div>

        <div class="visuals-inputs">
          <div class="input-row-group">
            <label>SPACE ACTION NAME</label>
            <input data-nav id="input-action-name" value="${html(entry.name)}" maxlength="60" placeholder="e.g. Haunted Harbor Ghost">
          </div>

          <div class="input-row-group">
            <label>SPACE TYPE CATEGORY</label>
            <select data-nav id="input-action-type">
              ${["event", "lucky", "blue", "red", "shop", "duel", "warp", "star", "mystery", "battle", "trap", "custom"].map((t) => `
                <option value="${t}" ${space.type === t ? "selected" : ""}>${t.toUpperCase()} SPACE</option>
              `).join("")}
            </select>
          </div>

          <div class="input-row-group">
            <label>SPACE SHAPE &amp; DISPLAY</label>
            <div class="shape-picker-row">
              ${shapes.map(([s, lbl]) => `
                <button data-nav data-set-shape="${s}" class="picker-btn ${space.shape === s ? "active" : ""}">
                  ${lbl}
                </button>
              `).join("")}
            </div>
          </div>

          <div class="input-row-group">
            <label>CUSTOM SPACE IMAGE (PNG / WEBP)</label>
            <div style="display:flex;align-items:center;gap:10px;">
              <button type="button" data-nav data-trigger-upload="space-image-upload" class="picker-btn primary" style="background:#54d682;color:#0b2e18;padding:9px 16px;">
                📁 ${space.customImage ? "CHANGE SPACE IMAGE" : "UPLOAD CUSTOM SPACE IMAGE"}
              </button>
              <input type="file" id="space-image-upload" accept="image/png,image/webp,image/gif,image/jpeg" style="display:none;">
              <small style="color:#c9bee6;">${space.customImage ? "Custom image loaded!" : "Upload custom tile artwork"}</small>
            </div>
          </div>

          <div class="input-row-group">
            <label>SPACE EFFECT ATTRIBUTE</label>
            <div class="shape-picker-row">
              ${effects.map(([eff, lbl]) => `
                <button data-nav data-set-effect="${eff}" class="picker-btn ${(space.effect || "sparkles") === eff ? "active" : ""}">
                  ${lbl}
                </button>
              `).join("")}
            </div>
          </div>

          <div class="input-row-group">
            <label>COLOR THEME</label>
            <div class="color-picker-row">
              ${colors.map((c) => `
                <button data-nav data-set-color="${c}" class="picker-btn ${space.color === c ? "active" : ""}">
                  ${c.toUpperCase()}
                </button>
              `).join("")}
            </div>
          </div>

          <div class="input-row-group">
            <label>SPACE ICON / STICKER</label>
            <div class="emoji-palette">
              ${iconPresets.map((icon) => `
                <button data-nav data-set-icon="${icon}" class="emoji-btn ${space.icon === icon ? "active" : ""}">
                  ${icon}
                </button>
              `).join("")}
            </div>
          </div>

          <div class="input-row-group">
            <label>DESCRIPTION &amp; LORE</label>
            <textarea data-nav id="input-action-desc" rows="2">${html(space.description)}</textarea>
          </div>
        </div>
      </div>
    `;
  }

  // Tab 2: Characters & Cast
  else if (tab === "cast") {
    const host = cast.find((c) => c.isHost || c.role === "Host");
    const otherCast = cast.filter((c) => !(c.isHost || c.role === "Host"));

    const renderCastCard = (char, isHostCard = false) => `
      <div class="cast-card ${isHostCard ? "is-host" : ""}">
        <div class="cast-card-header">
          <div class="cast-avatar-box">
            ${char.sprite ? `<img src="${html(char.sprite)}" alt="${html(char.name)}">` : `<span>${html(char.icon || (isHostCard ? "👑" : "👤"))}</span>`}
          </div>
          <div>
            <div style="display:flex;align-items:center;gap:6px;">
              <b>${html(char.name)}</b>
              ${isHostCard ? `<span class="host-crown-badge">👑 STAGE HOST</span>` : ""}
            </div>
            <small style="display:block;color:#ffc83b;">${html(char.role)} · ${html(char.anchor || "center")}</small>
          </div>
          <button data-nav data-cast-remove="${html(char.id)}" class="cmd-btn danger" style="margin-left:auto;">🗑</button>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:.72rem;">
          <div><label style="color:#ad99ce;">POSE / MOTION</label><b>${html(char.animation || "float").toUpperCase()}</b></div>
          <div><label style="color:#ad99ce;">ANCHOR</label><b>${html(char.anchor || "center").toUpperCase()}</b></div>
        </div>
      </div>
    `;

    tabContent = `
      <div>
        <div style="margin-bottom:16px;">
          <h3 style="margin:0;font-size:1.3rem;color:#ffe47a;">Cast &amp; Character Sprites</h3>
          <p style="margin:4px 0 0;color:#c9bee6;font-size:.8rem;">Design the special Stage Host and additional actor sprites that speak and animate in cutscenes.</p>
        </div>

        <!-- SPECIAL HOST SECTION -->
        <div style="margin-bottom:20px;">
          <h4 style="margin:0 0 10px;color:#ffe47a;font-size:.85rem;letter-spacing:.1em;">👑 STAGE HOST (PRIMARY CHARACTER)</h4>
          ${host ? renderCastCard(host, true) : `
            <div class="restore-host-box">
              <span style="font-size:2rem;">👑</span>
              <b style="color:#ffe47a;">NO HOST ASSIGNED</b>
              <p style="margin:0;font-size:.75rem;color:#c9bee6;">The Host welcomes players, leads cutscenes, and offers choices on this space.</p>
              <div style="display:flex;flex-wrap:wrap;gap:8px;justify-content:center;margin-top:6px;">
                <button data-nav data-restore-host="Host Guide:✦:float" class="card-btn primary" style="padding:8px 16px;">👑 RESTORE DEFAULT HOST</button>
                <button data-nav data-restore-host="Spooky Host:👻:float" class="picker-btn">👻 GHOST HOST</button>
                <button data-nav data-restore-host="Bolt-0:🤖:pulse" class="picker-btn">🤖 ROBOT HOST</button>
                <button data-nav data-restore-host="Star Fairy:🧚:float" class="picker-btn">🧚 FAIRY HOST</button>
              </div>
            </div>
          `}
        </div>

        <!-- OTHER CAST MEMBERS -->
        <h4 style="margin:0 0 10px;color:#ffc83b;font-size:.85rem;letter-spacing:.1em;">👥 SUPPORTING CAST &amp; ACTORS</h4>
        <div class="cast-grid-wrapper">
          ${otherCast.map((c) => renderCastCard(c, false)).join("")}

          <!-- Upload Dropzone Button (Focusable with data-nav) -->
          <button type="button" data-nav data-trigger-upload="char-file-upload" class="cast-dropzone">
            <span style="font-size:2.4rem;">📁</span>
            <b style="color:#54d682;">UPLOAD CHARACTER PNG</b>
            <small style="color:#ad99ce;">Click or press A to choose file</small>
          </button>
          <input type="file" id="char-file-upload" accept="image/png,image/webp,image/gif,image/jpeg" style="display:none;">
        </div>

        <div style="margin-top:24px;padding-top:18px;border-top:2px solid rgba(255,255,255,.1);">
          <h4 style="margin:0 0 10px;color:#ffc83b;font-size:.85rem;">QUICK ADD PRESET RETRO SPRITES</h4>
          <div style="display:flex;flex-wrap:wrap;gap:8px;">
            <button data-nav data-add-preset-actor="Ghost:👻:Nemesis:float" class="picker-btn">👻 SPOOKY GHOST</button>
            <button data-nav data-add-preset-actor="Bolt-0:🤖:Vendor:pulse" class="picker-btn">🤖 BOLT-0 ROBOT</button>
            <button data-nav data-add-preset-actor="Star Fairy:🧚:Ally:float" class="picker-btn">🧚 STAR FAIRY</button>
            <button data-nav data-add-preset-actor="Mystic Wizard:🧙:Host:bounce" class="picker-btn">🧙 WIZARD</button>
            <button data-nav data-add-preset-actor="Bandit:🦹:Thief:shake" class="picker-btn">🦹 BANDIT</button>
            <button data-nav data-add-preset-actor="Lucky Cat:🐱:Mascot:bounce" class="picker-btn">🐱 LUCKY CAT</button>
          </div>
        </div>
      </div>
    `;
  }

  // Tab 3: Activations
  else if (tab === "activations") {
    tabContent = `
      <div class="activations-grid">
        <!-- 1. Movement -->
        <div class="activation-card">
          <div class="activation-toggle-header">
            <b>🚶 BOARD MOVEMENT TRIGGERS</b>
          </div>
          <p style="font-size:.75rem;color:#c9bee6;margin:0;">When should players encounter this space?</p>
          <label style="display:flex;align-items:center;gap:8px;font-size:.8rem;cursor:pointer;margin-top:8px;">
            <input type="checkbox" id="act-move-land" ${activations.movement?.land ? "checked" : ""}>
            <span>LANDING ON THIS SPACE (Stop on tile)</span>
          </label>
          <label style="display:flex;align-items:center;gap:8px;font-size:.8rem;cursor:pointer;">
            <input type="checkbox" id="act-move-pass" ${activations.movement?.pass ? "checked" : ""}>
            <span>PASSING OVER SPACE (Walk-by event)</span>
          </label>
          <label style="display:flex;align-items:center;gap:8px;font-size:.8rem;cursor:pointer;">
            <input type="checkbox" id="act-move-reverse" ${activations.movement?.reverse ? "checked" : ""}>
            <span>REVERSING DIRECTION OVER SPACE</span>
          </label>
        </div>

        <!-- 2. Proximity -->
        <div class="activation-card">
          <div class="activation-toggle-header">
            <b>◎ PROXIMITY &amp; RADIUS RANGE</b>
          </div>
          <p style="font-size:.75rem;color:#c9bee6;margin:0;">Trigger when any player walks near the space area.</p>
          <label style="display:flex;align-items:center;gap:8px;font-size:.8rem;cursor:pointer;margin:8px 0;">
            <input type="checkbox" id="act-prox-enabled" ${activations.proximity?.enabled ? "checked" : ""}>
            <span>ENABLE PROXIMITY RADIUS</span>
          </label>
          <div style="display:flex;align-items:center;gap:12px;">
            <input type="range" id="act-prox-radius" min="2" max="30" value="${activations.proximity?.radius || 10}" style="flex:1;">
            <b id="prox-radius-label" style="color:#ffc83b;font-size:.9rem;">${activations.proximity?.radius || 10} UNITS</b>
          </div>
        </div>

        <!-- 3. Rounds & Timing -->
        <div class="activation-card">
          <div class="activation-toggle-header">
            <b>⏰ ROUNDS &amp; TIMING GATES</b>
          </div>
          <div style="display:grid;gap:8px;margin-top:6px;font-size:.8rem;">
            <label style="display:flex;align-items:center;justify-content:space-between;">
              <span>AT SPECIFIC ROUND:</span>
              <input type="number" id="act-time-round" min="0" max="50" value="${activations.timing?.round || 0}" style="width:60px;padding:4px;">
            </label>
            <label style="display:flex;align-items:center;justify-content:space-between;">
              <span>EVERY X ROUNDS (INTERVAL):</span>
              <input type="number" id="act-time-interval" min="0" max="10" value="${activations.timing?.interval || 0}" style="width:60px;padding:4px;">
            </label>
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
              <input type="checkbox" id="act-time-start" ${activations.timing?.gameStart ? "checked" : ""}>
              <span>ON BOARD GAME START</span>
            </label>
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;">
              <input type="checkbox" id="act-time-final" ${activations.timing?.finalRounds ? "checked" : ""}>
              <span>DURING FINAL 5 ROUNDS</span>
            </label>
          </div>
        </div>

        <!-- 4. Conditions & State -->
        <div class="activation-card">
          <div class="activation-toggle-header">
            <b>💰 STATE &amp; INVENTORY CONDITIONS</b>
          </div>
          <div style="display:grid;gap:8px;margin-top:6px;font-size:.8rem;">
            <label style="display:flex;align-items:center;justify-content:space-between;">
              <span>MINIMUM COINS REQUIRED:</span>
              <input type="number" id="act-cond-coins" min="0" max="999" value="${activations.conditions?.minCoins || 0}" style="width:70px;padding:4px;">
            </label>
            <label style="display:flex;align-items:center;justify-content:space-between;">
              <span>REQUIRED MAP STATE:</span>
              <select id="act-cond-map" style="padding:4px 8px;">
                <option value="any" ${activations.conditions?.mapState === "any" ? "selected" : ""}>Any State</option>
                <option value="night" ${activations.conditions?.mapState === "night" ? "selected" : ""}>Night Time</option>
                <option value="storm" ${activations.conditions?.mapState === "storm" ? "selected" : ""}>Stormy</option>
                <option value="haunted" ${activations.conditions?.mapState === "haunted" ? "selected" : ""}>Haunted</option>
              </select>
            </label>
          </div>
        </div>
      </div>
    `;
  }

  // Tab 4: Cutscene Timeline (Video Editor Multi-Track System)
  else if (tab === "script") {
    tabContent = `
      <div>
        <div style="margin-bottom:12px;display:flex;align-items:center;justify-content:space-between;">
          <div>
            <h3 style="margin:0;font-size:1.3rem;color:#ffe47a;">Cutscene Multi-Track Timeline</h3>
            <p style="margin:4px 0 0;color:#c9bee6;font-size:.8rem;">Interactive NLE video editor tracks: drag playhead to scrub, script logic branching lanes, and ripple edit.</p>
          </div>
        </div>

        ${cutsceneTimelineView(entry)}
      </div>
    `;
  }

  return frame(stationMeta.event, `
    <div class="space-editor-layout">
      <nav class="editor-sub-nav">
        <button data-nav data-back-to-catalog class="studio-back">◀ CATALOG</button>
        <div class="editor-tabs-group">
          ${tabButtons}
        </div>
        <div style="display:flex;align-items:center;gap:8px;">
          <button data-nav data-preview-cutscene class="card-btn secondary" style="background:#8b5ce6;color:#fff;">▶ PREVIEW</button>
          <button data-nav data-save-space-action class="card-btn primary">💾 SAVE ACTION</button>
        </div>
      </nav>

      <section class="tab-content-card">
        ${tabContent}
      </section>

      ${app.actionPickerOpen ? actionPickerModal() : ""}
      ${app.editingCommand ? commandEditorModal(entry) : ""}
      ${app.previewingCutscene ? cutscenePreviewTheater(entry) : ""}
    </div>
  `);
}

// --- Action Inspector / Command Edit Modal ---
function commandEditorModal(entry) {
  const target = app.editingCommand;
  if (!target || !target.cmd) return "";
  const cmd = target.cmd;
  const cast = entry.characters || [];
  const cat = cmd.category || "dialogue";

  let fields = "";

  if (cat === "dialogue") {
    fields = `
      <div class="cmd-editor-field">
        <label>SPEAKER (PORTRAIT &amp; ACTOR)</label>
        <select id="edit-cmd-speaker">
          <option value="Active Player" ${cmd.speaker === "Active Player" ? "selected" : ""}>👤 Active Player</option>
          ${cast.map((c) => `
            <option value="${html(c.name)}" ${cmd.speaker === c.name ? "selected" : ""}>
              ${c.isHost ? "👑 " : "🎭 "}${html(c.name)} (${html(c.role)})
            </option>
          `).join("")}
          <option value="Narrator" ${cmd.speaker === "Narrator" ? "selected" : ""}>📢 Narrator (Voiceover)</option>
        </select>
      </div>

      <div class="cmd-editor-field">
        <label>DIALOGUE TEXT / MESSAGE</label>
        <textarea id="edit-cmd-text" rows="3" placeholder="Enter message text...">${html(cmd.text || cmd.label || "")}</textarea>
      </div>

      <div class="cmd-editor-field">
        <label>SPEECH BUBBLE STYLE</label>
        <select id="edit-cmd-style">
          <option value="speech" ${cmd.style === "speech" ? "selected" : ""}>💬 Speech Bubble (Standard)</option>
          <option value="thought" ${cmd.style === "thought" ? "selected" : ""}>💭 Thought Bubble</option>
          <option value="shout" ${cmd.style === "shout" ? "selected" : ""}>💥 Shout / Warning (Bold)</option>
          <option value="banner" ${cmd.style === "banner" ? "selected" : ""}>📢 Celebratory Banner Overlay</option>
          <option value="toast" ${cmd.style === "toast" ? "selected" : ""}>🔔 Mini Toast Notification</option>
        </select>
      </div>
    `;
  } else if (cat === "camera") {
    fields = `
      <div class="cmd-editor-field">
        <label>CAMERA ACTION</label>
        <select id="edit-cmd-cam-action">
          <option value="zoom" ${cmd.camAction === "zoom" ? "selected" : ""}>🔍 Zoom in on Space</option>
          <option value="pan-player" ${cmd.camAction === "pan-player" ? "selected" : ""}>🎥 Pan to Active Player</option>
          <option value="shake" ${cmd.camAction === "shake" ? "selected" : ""}>⚡ Screen Shake (Earthquake)</option>
          <option value="flash" ${cmd.camAction === "flash" ? "selected" : ""}>✨ Screen Flash (Color Burst)</option>
          <option value="reset" ${cmd.camAction === "reset" ? "selected" : ""}>🌐 Reset Camera to Wide Board</option>
        </select>
      </div>

      <div class="cmd-editor-field">
        <label>ZOOM LEVEL MULTIPLIER</label>
        <select id="edit-cmd-zoom">
          <option value="1.2" ${cmd.zoom === "1.2" ? "selected" : ""}>1.2x Subtle Focus</option>
          <option value="1.5" ${cmd.zoom === "1.5" ? "selected" : ""}>1.5x Medium Focus</option>
          <option value="1.8" ${(!cmd.zoom || cmd.zoom === "1.8") ? "selected" : ""}>1.8x Dramatic Focus</option>
          <option value="2.5" ${cmd.zoom === "2.5" ? "selected" : ""}>2.5x Close Up</option>
        </select>
      </div>

      <div class="cmd-editor-field">
        <label>SHAKE INTENSITY / FLASH TINT</label>
        <select id="edit-cmd-intensity">
          <option value="light" ${cmd.intensity === "light" ? "selected" : ""}>Light Rumble / Golden Radiance</option>
          <option value="heavy" ${(!cmd.intensity || cmd.intensity === "heavy") ? "selected" : ""}>Heavy Earthquake / White Burst</option>
          <option value="danger" ${cmd.intensity === "danger" ? "selected" : ""}>Violent Shock / Red Danger</option>
        </select>
      </div>
    `;
  } else if (cat === "actors") {
    fields = `
      <div class="cmd-editor-field">
        <label>TARGET ACTOR</label>
        <select id="edit-cmd-actor-target">
          <option value="Active Player" ${cmd.target === "Active Player" ? "selected" : ""}>👤 Active Player Token</option>
          ${cast.map((c) => `
            <option value="${html(c.name)}" ${cmd.target === c.name ? "selected" : ""}>
              ${c.isHost ? "👑 " : "🎭 "}${html(c.name)} (${html(c.role)})
            </option>
          `).join("")}
        </select>
      </div>

      <div class="cmd-editor-field">
        <label>ACTION / BEHAVIOR</label>
        <select id="edit-cmd-actor-action">
          <option value="pose" ${cmd.actorAction === "pose" ? "selected" : ""}>🤸 Play Pose Animation</option>
          <option value="emote" ${cmd.actorAction === "emote" ? "selected" : ""}>💭 Pop Emote Balloon</option>
          <option value="move" ${cmd.actorAction === "move" ? "selected" : ""}>🏃 Hop / Move to Position</option>
          <option value="spawn" ${cmd.actorAction === "spawn" ? "selected" : ""}>✨ Spawn on Stage</option>
          <option value="despawn" ${cmd.actorAction === "despawn" ? "selected" : ""}>💨 Despawn (Poof Disappear)</option>
        </select>
      </div>

      <div class="cmd-editor-field">
        <label>POSE OR EMOTE BALLOON</label>
        <select id="edit-cmd-pose">
          <option value="cheer" ${cmd.pose === "cheer" ? "selected" : ""}>Jump &amp; Cheer (❤️ Heart Balloon)</option>
          <option value="shocked" ${cmd.pose === "shocked" ? "selected" : ""}>Shocked Tremble (❗ Alert Balloon)</option>
          <option value="spin" ${cmd.pose === "spin" ? "selected" : ""}>Victory Spin (💡 Idea Balloon)</option>
          <option value="curse" ${cmd.pose === "curse" ? "selected" : ""}>Cursed Shake (💀 Skull Balloon)</option>
          <option value="spark" ${cmd.pose === "spark" ? "selected" : ""}>Electric Spark (⚡ Spark Balloon)</option>
        </select>
      </div>
    `;
  } else if (cat === "inventory" || cat === "rewards") {
    fields = `
      <div class="cmd-editor-field">
        <label>INVENTORY OPERATION</label>
        <select id="edit-cmd-inv-op">
          <option value="give-coins" ${cmd.rewardType === "give-coins" || cmd.invOp === "give-coins" ? "selected" : ""}>🪙 Give Coins to Player (+)</option>
          <option value="take-coins" ${cmd.rewardType === "take-coins" || cmd.invOp === "take-coins" ? "selected" : ""}>💸 Deduct Coins from Player (Penalty -)</option>
          <option value="give-star" ${cmd.rewardType === "give-star" || cmd.invOp === "give-star" ? "selected" : ""}>⭐ Award Star to Player (+1)</option>
          <option value="take-star" ${cmd.rewardType === "take-star" || cmd.invOp === "take-star" ? "selected" : ""}>💔 Steal / Deduct Star (-1)</option>
          <option value="grant-item" ${cmd.rewardType === "grant-item" || cmd.invOp === "grant-item" ? "selected" : ""}>🗝️ Grant Special Item to Pouch</option>
          <option value="remove-item" ${cmd.invOp === "remove-item" ? "selected" : ""}>🗑️ Remove / Consume Item from Pouch</option>
          <option value="swap-spaces" ${cmd.rewardType === "swap-spaces" || cmd.invOp === "swap-spaces" ? "selected" : ""}>🔄 Swap Board Positions with Opponent</option>
          <option value="clear-inventory" ${cmd.invOp === "clear-inventory" ? "selected" : ""}>⚠️ Clear Player Pouch (Reset Items)</option>
        </select>
      </div>

      <div class="cmd-editor-field">
        <label>ITEM NAME (If granting or removing items)</label>
        <input type="text" id="edit-cmd-inv-item" list="toy-catalogue-options" value="${html(cmd.itemName || cmd.condValue || "Skeleton Key")}" placeholder="Choose a Toy Catalogue item or enter a custom name">
        <datalist id="toy-catalogue-options">${ensureToyCatalogue(app.project.data).map((toy) => `<option value="${html(toy.name)}">${html(toyCategories[toy.category]?.label || "OTHER TOYS")}</option>`).join("")}</datalist>
      </div>

      <div class="cmd-editor-field">
        <label>COIN OR STAR AMOUNT</label>
        <input type="number" id="edit-cmd-amount" value="${cmd.amount || 10}" min="1" max="999">
      </div>
    `;
  } else if (cat === "logic" || cmd.kind === "condition") {
    fields = `
      <div class="cmd-editor-field">
        <label>LOGIC OPERATION TYPE</label>
        <select id="edit-cmd-logic-op">
          <option value="coins-at-least" ${cmd.condType === "coins-at-least" ? "selected" : ""}>💰 Conditional: Player Coins >= Value (Split Path)</option>
          <option value="has-item" ${cmd.condType === "has-item" ? "selected" : ""}>🗝️ Conditional: Player Holds Item (Split Path)</option>
          <option value="variable-equals" ${cmd.condType === "variable-equals" ? "selected" : ""}>🏷️ Conditional: Variable Equals Value (Split Path)</option>
          <option value="random-percent" ${cmd.condType === "random-percent" ? "selected" : ""}>🎲 Conditional: Random 50/50 Coin Flip (Split Path)</option>
          <option value="set-variable" ${cmd.logicOp === "set-variable" ? "selected" : ""}>📝 Set Game Variable (state = value)</option>
          <option value="add-variable" ${cmd.logicOp === "add-variable" ? "selected" : ""}>➕ Increment / Decrement Variable (+= / -=)</option>
          <option value="timer-delay" ${cmd.logicOp === "timer-delay" ? "selected" : ""}>⏳ Wait / Timer Delay (Pause seconds)</option>
          <option value="exit-cutscene" ${cmd.logicOp === "exit-cutscene" ? "selected" : ""}>⏹️ Exit Cutscene Immediately (Return to board)</option>
        </select>
      </div>

      <div class="cmd-editor-field">
        <label>VARIABLE NAME / CONDITION TARGET</label>
        <input type="text" id="edit-cmd-var-name" value="${html(cmd.varName || "game_stage")}" placeholder="e.g. visited_space, has_boss_key, turn_streak">
      </div>

      <div class="cmd-editor-field">
        <label>VALUE / AMOUNT / COMPARISON</label>
        <input type="text" id="edit-cmd-cond-value" value="${html(cmd.condValue || cmd.varValue || "20")}" placeholder="e.g. 20, true, unlocked, 1.5">
      </div>
    `;
  } else if (cat === "input") {
    fields = `
      <div class="cmd-editor-field">
        <label>INPUT / DECISION TYPE</label>
        <select id="edit-cmd-input-type">
          <option value="question-custom" ${(!cmd.inputType || cmd.inputType === "question-custom") ? "selected" : ""}>❓ Ask Question Dialog with Custom Answers (Split)</option>
          <option value="prompt-yes-no" ${cmd.inputType === "prompt-yes-no" ? "selected" : ""}>⚖️ Decision Prompt: [YES] or [NO] (Split)</option>
          <option value="qte-mash" ${cmd.inputType === "qte-mash" ? "selected" : ""}>🎮 Button Mash QTE Challenge (Pass / Fail Split)</option>
          <option value="reaction-stop" ${cmd.inputType === "reaction-stop" ? "selected" : ""}>⏱️ Timed Reaction Roulette Stop (Win / Lose Split)</option>
          <option value="dice-roll" ${cmd.inputType === "dice-roll" ? "selected" : ""}>🎲 Bonus Dice Roll Threshold (Win / Lose Split)</option>
          <option value="chest-pick" ${cmd.inputType === "chest-pick" ? "selected" : ""}>🎁 Mystery Chest Pick (Choice Split)</option>
        </select>
      </div>

      <div class="cmd-editor-field">
        <label>QUESTION / PROMPT BANNER TEXT</label>
        <textarea id="edit-cmd-prompt-text" rows="2" placeholder="e.g. Would you like to buy a Star for 20 Coins?">${html(cmd.questionText || cmd.text || cmd.label || "Choose your path:")}</textarea>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <div class="cmd-editor-field">
          <label style="color:#54d682;">CHOICE 1 / TRUE (Primary Track)</label>
          <input type="text" id="edit-cmd-choice-1" value="${html(cmd.choice1 || "YES")}" placeholder="e.g. YES / ACCEPT">
        </div>
        <div class="cmd-editor-field">
          <label style="color:#ff8877;">CHOICE 2 / FALSE (Branch Track)</label>
          <input type="text" id="edit-cmd-choice-2" value="${html(cmd.choice2 || "NO")}" placeholder="e.g. NO / DECLINE">
        </div>
      </div>
    `;
  } else if (cat === "world" && (cmd.worldAction === "weather" || commandWeatherType(cmd))) {
    const weatherType = commandWeatherType(cmd) || "rain";
    fields = `
      <div class="cmd-editor-field">
        <label>WEATHER EFFECT</label>
        <select id="edit-cmd-weather-type">
          ${Object.entries(weatherEffects).map(([id, weather]) => `<option value="${id}" ${weatherType === id ? "selected" : ""}>${weather.icon} ${weather.label}</option>`).join("")}
        </select>
      </div>

      <div class="cmd-editor-field">
        <label>WEATHER INTENSITY</label>
        <select id="edit-cmd-weather-intensity">
          <option value="light" ${cmd.weatherIntensity === "light" ? "selected" : ""}>Light · Sparse particles</option>
          <option value="medium" ${(!cmd.weatherIntensity || cmd.weatherIntensity === "medium") ? "selected" : ""}>Medium · Standard coverage</option>
          <option value="heavy" ${cmd.weatherIntensity === "heavy" ? "selected" : ""}>Heavy · Dense storm</option>
        </select>
      </div>

      <div class="cmd-editor-field">
        <label>CUSTOM PARTICLE IMAGE (OPTIONAL)</label>
        <div class="weather-particle-upload-row">
          <button type="button" data-nav data-trigger-upload="weather-particle-upload" class="picker-btn primary">⬆ UPLOAD PNG / WEBP / GIF</button>
          <input type="file" id="weather-particle-upload" accept="image/png,image/webp,image/gif,image/jpeg" style="display:none;">
          ${cmd.particleImage ? `<div class="weather-particle-thumb"><img src="${html(cmd.particleImage)}" alt="Custom weather particle"><button type="button" data-nav data-remove-weather-particle title="Use the built-in particle">✕</button></div>` : `<span class="weather-particle-empty">Using the built-in ${html(weatherEffects[weatherType].particle)} particle</span>`}
        </div>
        <small style="color:#ad99ce;font-size:.7rem;">The uploaded image is repeated as the particle for this event and saved with the cutscene.</small>
      </div>
    `;
  } else if (cat === "audio") {
    const sfxList = ["coin", "star-fanfare", "thunder-strike", "warp-pipe", "dice-roll", "chest", "mystery", "lose", "laugh", "whistle"];
    fields = `
      <div class="cmd-editor-field">
        <label>CHIPTUNE SOUND EFFECT</label>
        <div style="display:flex;gap:8px;">
          <select id="edit-cmd-sfx" style="flex:1;">
            ${sfxList.map((s) => `<option value="${s}" ${cmd.sfx === s ? "selected" : ""}>${s.toUpperCase()}</option>`).join("")}
          </select>
          <button type="button" data-nav data-test-cmd-sfx class="picker-btn" style="background:#ffc83b;color:#18112e;">▶ TEST SFX</button>
        </div>
      </div>

      <div class="cmd-editor-field">
        <label>TEMPORARY BACKGROUND MUSIC</label>
        <select id="edit-cmd-bgm">
          <option value="default" ${cmd.bgm === "default" ? "selected" : ""}>Keep Board Theme</option>
          <option value="suspense" ${cmd.bgm === "suspense" ? "selected" : ""}>Suspense Theme</option>
          <option value="haunted" ${cmd.bgm === "haunted" ? "selected" : ""}>Haunted Mansion Theme</option>
          <option value="bonus" ${cmd.bgm === "bonus" ? "selected" : ""}>Bonus Round Fanfare</option>
          <option value="silence" ${cmd.bgm === "silence" ? "selected" : ""}>Silence (Dramatic Pause)</option>
        </select>
      </div>
    `;
  } else {
    fields = `
      <div class="cmd-editor-field">
        <label>ACTION SUMMARY LABEL</label>
        <input type="text" id="edit-cmd-generic-label" value="${html(cmd.label || "")}">
      </div>
    `;
  }

  return `
    <div class="cmd-editor-modal-backdrop">
      <div class="cmd-editor-modal-dialog">
        <header class="action-modal-header">
          <h2>✏️ Edit Event Action · ${cat.toUpperCase()}</h2>
          <button data-nav data-close-cmd-editor class="modal-close-window-btn" title="Close Window">✕</button>
        </header>

        <div class="cmd-editor-body">
          ${fields}

          <div class="cmd-editor-field" style="margin-top:8px;padding-top:12px;border-top:1px solid rgba(255,255,255,.1);">
            <label style="display:flex;align-items:center;gap:8px;cursor:pointer;color:#ffe47a;font-size:.78rem;">
              <input type="checkbox" id="edit-cmd-wait-input" ${cmd.waitForInput !== false ? "checked" : ""}>
              <span>⏸ WAIT FOR PLAYER INPUT / CONFIRMATION (Pause Until A Pressed)</span>
            </label>
            <small style="color:#ad99ce;font-size:.7rem;">When checked, playback and cutscene progress will hold on this step until the player presses A.</small>
          </div>
        </div>

        <footer class="cmd-editor-footer">
          <button data-nav data-save-cmd-edit class="card-btn primary" style="padding:10px 20px;">💾 SAVE CHANGES</button>
          <button data-nav data-close-cmd-editor class="card-btn secondary" style="padding:10px 16px;">CANCEL</button>
        </footer>
      </div>
    </div>
  `;
}

// --- RPG Maker Command Picker Modal ---
function actionPickerModal() {
  const activeTab = app.actionPickerTab || "dialogue";

  const tabs = [
    ["dialogue", "💬 DIALOGUE"],
    ["camera", "📷 CAMERA"],
    ["actors", "👤 ACTORS"],
    ["vfx", "✨ VFX & OVERLAYS"],
    ["inventory", "🎒 INVENTORY"],
    ["logic", "🔀 LOGIC"],
    ["world", "🌍 WORLD"],
    ["audio", "🎵 AUDIO"],
    ["input", "🎮 INPUT & DECISIONS"]
  ].map(([id, label]) => `
    <button data-nav data-action-modal-tab="${id}" class="action-cat-tab ${activeTab === id ? "active" : ""}">
      ${label}
    </button>
  `).join("");

  const presetsByTab = {
    dialogue: [
      { label: 'SHOW SPEECH BUBBLE: "Welcome to the space!"', category: "dialogue", icon: "💬", desc: "Display dialogue box with character portrait and typing tone.", waitForInput: true },
      { label: "BANNER ANNOUNCEMENT: Epic Title Overlay", category: "dialogue", icon: "📢", desc: "Full-width celebratory banner across the screen.", waitForInput: false },
      { label: 'QUICK TOAST NOTIFICATION: "Space Alert!"', category: "dialogue", icon: "🔔", desc: "Brief informational popup banner at top of screen (No coin change).", waitForInput: false },
    ],
    camera: [
      { label: "ZOOM IN ON SPACE (1.8x Focus)", category: "camera", icon: "🔍", desc: "Smoothly zoom camera into the active board space.", waitForInput: false },
      { label: "PAN CAMERA TO PLAYER", category: "camera", icon: "🎥", desc: "Center camera view on the active player token.", waitForInput: false },
      { label: "SCREEN SHAKE (Earthquake Rumble)", category: "camera", icon: "⚡", desc: "Shake the screen violently for dramatic impact.", waitForInput: false },
      { label: "SCREEN FLASH: Golden Radiance", category: "camera", icon: "✨", desc: "Flash white/gold across the screen.", waitForInput: false },
      { label: "RESET CAMERA VIEW TO FULL BOARD", category: "camera", icon: "🌐", desc: "Restore standard wide board camera perspective.", waitForInput: false },
    ],
    actors: [
      { label: "SPAWN CHARACTER ON STAGE", category: "actors", icon: "👤", desc: "Bring an actor sprite onto the board space.", waitForInput: false },
      { label: "PLAY POSE ANIMATION: Jump & Cheer", category: "actors", icon: "🤸", desc: "Make the selected actor or player jump happily.", waitForInput: false },
      { label: "SHOW EMOTE BALLOON (❤️ / 💡 / 💀)", category: "actors", icon: "💭", desc: "Pop a retro emote bubble above the actor's head.", waitForInput: false },
      { label: "MOVE ACTOR: Hop to Center Space", category: "actors", icon: "🏃", desc: "Animate character sliding or hopping into place.", waitForInput: false },
      { label: "DESPAWN ACTOR (Poof & Disappear)", category: "actors", icon: "💨", desc: "Send character away in a cloud of smoke.", waitForInput: false },
    ],
    vfx: [
      { label: "COIN SHOWER PARTICLES", category: "vfx", icon: "💰", desc: "Burst of shimmering gold coins showering down.", waitForInput: false },
      { label: "STAR CELEBRATION BURST", category: "vfx", icon: "🌟", desc: "Explosion of colorful sparkling star particles.", waitForInput: false },
      { label: "LIGHTNING STORM OVERLAY", category: "vfx", icon: "⚡", desc: "Full screen flashing lightning and thunder atmosphere.", waitForInput: false },
      { label: "RAIN DOWNPOUR OVERLAY", category: "vfx", icon: "🌧️", desc: "Ambient rain streaming across the board screen.", waitForInput: false },
      { label: "DARKNESS & SPOTLIGHT VIGNETTE", category: "vfx", icon: "🔦", desc: "Dim the screen and shine a spotlight on the space.", waitForInput: false },
    ],
    inventory: [
      { label: "GIVE PLAYER +10 COINS", category: "inventory", icon: "🪙", desc: "Award 10 gold coins into active player's pouch.", invOp: "give-coins", rewardType: "give-coins", amount: 10, waitForInput: true },
      { label: "TAKE -10 COINS (Penalty)", category: "inventory", icon: "💸", desc: "Deduct 10 gold coins from player.", invOp: "take-coins", rewardType: "take-coins", amount: 10, waitForInput: true },
      { label: "AWARD +1 STAR TO PLAYER", category: "inventory", icon: "⭐", desc: "Award a Star to the active player with fanfare.", invOp: "give-star", rewardType: "give-star", amount: 1, waitForInput: true },
      { label: "STEAL -1 STAR FROM OPPONENT", category: "inventory", icon: "💔", desc: "Take a star from another rival player.", invOp: "take-star", rewardType: "take-star", amount: 1, waitForInput: true },
      { label: "GRANT ITEM: Skeleton Key", category: "inventory", icon: "🗝️", desc: "Place a special item into player's bag.", invOp: "grant-item", rewardType: "grant-item", itemName: "Skeleton Key", amount: 1, waitForInput: true },
      { label: "REMOVE / CONSUME ITEM", category: "inventory", icon: "🗑️", desc: "Use up or take an item out of player's pouch.", invOp: "remove-item", itemName: "Skeleton Key", waitForInput: true },
      { label: "SWAP INVENTORIES WITH OPPONENT", category: "inventory", icon: "🔄", desc: "Exchange coins and items with a rival player.", invOp: "swap-spaces", rewardType: "swap-spaces", waitForInput: true },
      { label: "CLEAR / RESET INVENTORY", category: "inventory", icon: "⚠️", desc: "Empty out all items in player bag.", invOp: "clear-inventory", waitForInput: true },
    ],
    logic: [
      { label: "SET VARIABLE: state = value", category: "logic", icon: "📝", desc: "Update persistent game variable (e.g. has_key = true).", logicOp: "set-variable", varName: "has_key", varValue: "true", waitForInput: false },
      { label: "INCREMENT VARIABLE (+= / -=)", category: "logic", icon: "➕", desc: "Add or subtract value from a variable (e.g. visited += 1).", logicOp: "add-variable", varName: "visited_count", varValue: "1", waitForInput: false },
      { label: "IF VARIABLE == VALUE (Branch Path)", category: "logic", icon: "🏷️", desc: "Branch execution based on persistent variable check.", condType: "variable-equals", condValue: "true", isDecision: true, choice1: "TRUE", choice2: "FALSE", waitForInput: false },
      { label: "IF COINS >= 20 THEN (Branch Path)", category: "logic", icon: "🔀", desc: "Check if active player holds at least 20 coins.", condType: "coins-at-least", condValue: "20", isDecision: true, choice1: "TRUE", choice2: "FALSE", waitForInput: false },
      { label: "IF HAS INVENTORY ITEM: Skeleton Key", category: "logic", icon: "🗝️", desc: "Check if active player possesses specific item in bag.", condType: "has-item", condValue: "Skeleton Key", isDecision: true, choice1: "TRUE", choice2: "FALSE", waitForInput: false },
      { label: "RANDOM 50/50 COIN FLIP (Branch Path)", category: "logic", icon: "🎲", desc: "50% chance to take path A, 50% for path B.", condType: "random-percent", condValue: "50", isDecision: true, choice1: "HEADS", choice2: "TAILS", waitForInput: false },
      { label: "SWITCH / MULTI-CASE VARIABLE", category: "logic", icon: "📑", desc: "Evaluate a variable across multiple branch lanes.", condType: "variable-equals", condValue: "1", isDecision: true, choice1: "CASE 1", choice2: "DEFAULT", waitForInput: false },
      { label: "WAIT / TIMER DELAY (1.5s Pause)", category: "logic", icon: "⏳", desc: "Pause script execution pacing for timing.", logicOp: "timer-delay", condValue: "1.5", waitForInput: false },
      { label: "STOP / EXIT CUTSCENE", category: "logic", icon: "⏹️", desc: "End cutscene execution immediately and return to board.", logicOp: "exit-cutscene", waitForInput: false },
    ],
    world: [
      { label: "CHANGE BOARD TIME: Night Mode", category: "world", icon: "🌙", desc: "Turn the board sky dark and reveal ghosts.", waitForInput: false },
      { label: "WEATHER: RAIN", category: "world", worldAction: "weather", weatherType: "rain", weatherIntensity: "medium", icon: "🌧️", desc: "Start a rain effect across the board.", waitForInput: false },
      { label: "WEATHER: LIGHTNING", category: "world", worldAction: "weather", weatherType: "lightning", weatherIntensity: "medium", icon: "⚡", desc: "Flash lightning independently from rain.", waitForInput: false },
      { label: "WEATHER: SAND STORM", category: "world", worldAction: "weather", weatherType: "sandstorm", weatherIntensity: "medium", icon: "🏜️", desc: "Sweep sand and dust across the board.", waitForInput: false },
      { label: "WEATHER: SNOW STORM", category: "world", worldAction: "weather", weatherType: "snow", weatherIntensity: "medium", icon: "❄️", desc: "Send snowflakes swirling across the board.", waitForInput: false },
      { label: "WEATHER: SUNNY", category: "world", worldAction: "weather", weatherType: "sunny", weatherIntensity: "medium", icon: "☀️", desc: "Brighten the board with warm sunshine.", waitForInput: false },
      { label: "WEATHER: CLOUDY", category: "world", worldAction: "weather", weatherType: "cloudy", weatherIntensity: "medium", icon: "☁️", desc: "Cover the board in drifting clouds.", waitForInput: false },
      { label: "WEATHER: WINDY", category: "world", worldAction: "weather", weatherType: "windy", weatherIntensity: "medium", icon: "💨", desc: "Blow gusts and airborne particles across the board.", waitForInput: false },
      { label: "WEATHER: FALL LEAVES", category: "world", worldAction: "weather", weatherType: "leaves", weatherIntensity: "medium", icon: "🍂", desc: "Scatter autumn leaves through the scene.", waitForInput: false },
      { label: "WEATHER: SPRING CHERRY BLOSSOMS", category: "world", worldAction: "weather", weatherType: "blossoms", weatherIntensity: "medium", icon: "🌸", desc: "Float spring cherry blossoms through the scene.", waitForInput: false },
      { label: "WEATHER: HAIL", category: "world", worldAction: "weather", weatherType: "hail", weatherIntensity: "medium", icon: "🌨️", desc: "Drop bouncing hailstones across the board.", waitForInput: false },
      { label: "TRIGGER TRAP: Close Gate Barrier", category: "world", icon: "🔒", desc: "Lower a gate blocking a junction on the board.", waitForInput: true },
    ],
    audio: [
      { label: 'PLAY SFX: "coin"', category: "audio", icon: "🎵", desc: "Play classic coin ding sound effect.", sfx: "coin", waitForInput: false },
      { label: 'PLAY SFX: "fanfare"', category: "audio", icon: "🎺", desc: "Play celebratory 6-tone brass fanfare.", sfx: "fanfare", waitForInput: false },
      { label: 'PLAY SFX: "thunder"', category: "audio", icon: "⚡", desc: "Play heavy lowpass filtered thunderclap.", sfx: "thunder", waitForInput: false },
      { label: 'OVERRIDE BGM: Suspense Theme', category: "audio", icon: "📻", desc: "Switch background music to suspenseful tempo.", bgm: "suspense", waitForInput: false },
    ],
    input: [
      { label: "DECISION PROMPT: [YES] or [NO]", category: "input", icon: "⚖️", desc: "Prompt the active player to choose between two branch outcomes.", inputType: "prompt-yes-no", isDecision: true, choice1: "YES", choice2: "NO", questionText: "Proceed with the space action?", waitForInput: true },
      { label: "ASK QUESTION WITH CUSTOM ANSWERS", category: "input", icon: "❓", desc: "Prompt player with custom question and multi-choice buttons.", inputType: "question-custom", isDecision: true, choice1: "ACCEPT", choice2: "DECLINE", questionText: "Choose your action path:", waitForInput: true },
      { label: "BUTTON MASH QTE (5s Challenge)", category: "input", icon: "🎮", desc: "Player must mash A button (Pass / Fail branch).", inputType: "qte-mash", isDecision: true, choice1: "SUCCESS", choice2: "FAIL", waitForInput: true },
      { label: "TIMED REACTION STOP (Roulette)", category: "input", icon: "⏱️", desc: "Stop moving cursor on target (Win / Lose branch).", inputType: "reaction-stop", isDecision: true, choice1: "WIN", choice2: "LOSE", waitForInput: true },
      { label: "BONUS DICE ROLL (1-10 Threshold)", category: "input", icon: "🎲", desc: "Roll a die for high stakes outcome.", inputType: "dice-roll", isDecision: true, choice1: "HIGH ROLL", choice2: "LOW ROLL", waitForInput: true },
      { label: "MYSTERY CHEST PICK (1 of 3)", category: "input", icon: "🎁", desc: "Player chooses one of three treasure chests.", inputType: "chest-pick", isDecision: true, choice1: "CHEST A", choice2: "CHEST B", waitForInput: true },
    ]
  };

  const currentPresets = presetsByTab[activeTab] || presetsByTab.dialogue;

  const presetCards = currentPresets.map((p) => `
    <button data-nav data-add-preset-cmd="${html(encodeURIComponent(JSON.stringify(p)))}" class="preset-action-card">
      <div class="preset-icon">${p.icon}</div>
      <div class="preset-meta">
        <b>${html(p.label)}</b>
        <small>${html(p.desc)}</small>
      </div>
    </button>
  `).join("");

  return `
    <div class="action-modal-backdrop">
      <div class="action-modal-dialog">
        <header class="action-modal-header">
          <h2>＋ Add Event / Cutscene Action</h2>
          <button data-nav data-close-action-picker class="modal-close-window-btn" title="Close Window">✕</button>
        </header>

        <nav class="action-categories-bar">
          ${tabs}
        </nav>

        <div class="action-presets-grid">
          ${presetCards}
        </div>
      </div>
    </div>
  `;
}

function renderWeatherOverlay(state) {
  const type = state.weather;
  if (!type || !weatherEffects[type]) return "";
  const weather = weatherEffects[type];
  const intensity = ["light", "medium", "heavy"].includes(state.weatherIntensity) ? state.weatherIntensity : "medium";
  const particleCount = intensity === "light" ? 12 : intensity === "heavy" ? 42 : 26;
  const particles = Array.from({ length: particleCount }, (_, index) => {
    const style = `--particle-x:${(index * 37) % 101}%;--particle-delay:-${((index * 17) % 31) / 10}s;--particle-duration:${1.4 + ((index * 13) % 20) / 10}s;--particle-size:${14 + (index % 5) * 3}px;--particle-drift:${-55 + (index * 29) % 110}px;`;
    return state.particleImage
      ? `<img class="weather-particle" src="${html(state.particleImage)}" alt="" style="${style}">`
      : `<span class="weather-particle" style="${style}">${html(weather.particle)}</span>`;
  }).join("");
  return `<div class="theater-weather-overlay weather-${html(type)} intensity-${html(intensity)}" aria-label="${html(weather.label)} weather effect">${particles}</div>`;
}

function previewStateForCommand(command, step = 0) {
  const state = { step, text: "", banner: "", shake: false, weather: "", weatherIntensity: "medium", particleImage: "" };
  if (!command) return state;
  const weatherType = command.category === "world" || command.category === "vfx" ? commandWeatherType(command) : "";
  if (weatherType) {
    state.weather = weatherType;
    state.weatherIntensity = command.weatherIntensity || "medium";
    state.particleImage = command.particleImage || "";
  }
  if (command.category === "dialogue") state.text = command.text || command.label.replace(/^SHOW SPEECH BUBBLE: /i, "").replace(/["']/g, "");
  if (command.category === "camera" && command.label.includes("SHAKE")) state.shake = true;
  if (command.category === "rewards" || command.category === "inventory") state.banner = command.label;
  return state;
}

// --- Live Cutscene Theater Preview Modal ---
function cutscenePreviewTheater(entry) {
  const space = entry.space || { shape: "oval", color: "violet", icon: "⚡" };
  const characters = entry.characters || [];
  const commands = entry.commands || [];
  const state = app.previewState || { step: 0, text: "", banner: "", shake: false, weather: "", actorPos: "center" };

  return `
    <div class="theater-modal-stage">
      <div class="theater-screen-box ${state.shake ? "screen-shake" : ""}">
        <div class="theater-viewport">
          ${renderWeatherOverlay(state)}

          <div class="theater-space-center">
            ${renderSpaceToken(space, "stage-preview-token")}
          </div>

          ${characters.map((c) => `
            <div class="theater-actor-sprite" style="left:${c.anchor === "left" ? "20%" : c.anchor === "right" ? "75%" : "50%"};top:${c.anchor === "float" ? "25%" : "45%"};transform:translate(-50%,-50%);">
              ${c.sprite ? `<img src="${html(c.sprite)}" style="height:90px;object-fit:contain;" alt="${html(c.name)}">` : `<span style="font-size:4rem;">${html(c.icon || (c.isHost ? "👑" : "👤"))}</span>`}
            </div>
          `).join("")}

          ${state.banner ? `<div class="theater-banner">${html(state.banner)}</div>` : ""}
          ${state.text ? `<div class="theater-speech-bubble"><b>💬 ${html(state.text)}</b></div>` : ""}
        </div>

        <footer style="padding:12px 18px;display:flex;align-items:center;justify-content:space-between;background:#0d0a1d;border-top:3px solid #080d20;">
          <span style="color:#ffe47a;font-size:.8rem;font-weight:900;">
            STEP ${(app.previewStep || 0) + 1} OF ${commands.length || 1}
          </span>
          <div style="display:flex;gap:8px;">
            <button data-nav data-preview-next-step class="card-btn primary">NEXT STEP ▶</button>
            <button data-nav data-close-preview class="card-btn danger">CLOSE PREVIEW</button>
          </div>
        </footer>
      </div>
    </div>
  `;
}

function eventEditor() {
  if (app.spaceActionCatalogView !== false) {
    return spaceActionsCatalog();
  }
  const activeAction = app.project.events.entries.find((e) => e.id === app.activeSpaceActionId) || app.project.events.entries[0];
  return spaceActionEditor(activeAction);
}
function rulesEditor() {
  const rules = app.project.rules, page = rules.pages[app.rulePage];
  const cartridges = rules.cartridges.map((item) => `<button data-nav data-cartridge="${item.id}" class="rule-cartridge ${item.color} ${rules.activeCartridge===item.id?"active":""}"><i></i><b>${item.name}</b><small>${rules.activeCartridge===item.id?"INSERTED":"PRESS A"}</small></button>`).join("");
  const tabs = Object.keys(rules.pages).map((id) => `<button data-nav data-rule-page="${id}" class="${app.rulePage===id?"active":""}">${id.toUpperCase()}</button>`).join("");
  const disabled = new Set(page.disabled || []);
  return frame(stationMeta.rules, `<div class="rules-desk"><aside class="cartridge-tray"><small>CHOOSE A STARTING RULESET</small>${cartridges}</aside><section class="rule-book"><nav>${tabs}</nav><div class="book-pages"><article><small>${app.rulePage.toUpperCase()}</small><h1>${html(page.title)}</h1><div class="rule-cards">${page.cards.map((card,index)=>`<button data-nav data-rule-toggle="${index}" class="${disabled.has(index)?"disabled":""}"><i>${disabled.has(index)?"○":"✓"}</i><b>${html(card)}</b></button>`).join("")}</div></article><article class="rule-helper"><div>✦</div><h2>THE DIRECTOR SAYS…</h2><p>${app.rulePage==="flow"?"When the queue is empty, these cards decide what gets sent next.":"Flip any card off to change the laws of your party."}</p></article></div></section></div>`);
}

function ensureToyCatalogue(data) {
  if (Array.isArray(data.toys)) return data.toys;
  const legacyCurrencies = (data.currencies || []).map((item) => ({
    id: item.id, name: item.name, icon: item.icon, category: "currency",
    description: `${item.name || "Currency"} that players can collect and spend.`,
    effectType: item.id === "stars" ? "stars" : "coins", amount: 1,
    stackLimit: item.id === "stars" ? 99 : 999, consumable: false, rarity: item.id === "stars" ? "legendary" : "common",
  }));
  const legacyItems = (data.items || []).map((item) => ({
    id: item.id, name: item.name, icon: item.icon, category: item.id?.includes("die") ? "dice" : "other",
    description: "A player-obtainable catalogue item.", effectType: item.id?.includes("die") ? "roll" : "custom",
    amount: item.id?.includes("double") ? 2 : 1, dieFaces: item.id?.includes("die") ? "1,2,3,4,5,6" : "",
    stackLimit: 3, consumable: true, rarity: "common",
  }));
  const seen = new Set();
  data.toys = [...legacyCurrencies, ...legacyItems, ...starterToys].filter((toy) => toy.id && !seen.has(toy.id) && seen.add(toy.id));
  return data.toys;
}

function toyEditorModal() {
  const draft = app.editingToy;
  if (!draft?.toy) return "";
  const toy = draft.toy;
  return `
    <div class="cmd-editor-modal-backdrop">
      <div class="cmd-editor-modal-dialog toy-editor-dialog">
        <header class="action-modal-header">
          <h2>${draft.isNew ? "＋ CREATE TOY" : "✏️ EDIT TOY"}</h2>
          <button data-nav data-close-toy-editor class="modal-close-window-btn" title="Close Window">✕</button>
        </header>
        <div class="cmd-editor-body toy-editor-fields">
          <div class="toy-identity-row">
            <div class="toy-image-preview">${toy.image ? `<img src="${html(toy.image)}" alt="${html(toy.name || "Toy")}">` : `<span>${html(toy.icon || "🧸")}</span>`}</div>
            <div>
              <button type="button" data-nav data-trigger-upload="toy-image-upload" class="picker-btn primary">⬆ UPLOAD TOY IMAGE</button>
              <input type="file" id="toy-image-upload" accept="image/png,image/webp,image/gif,image/jpeg" style="display:none;">
              ${toy.image ? `<button type="button" data-nav data-remove-toy-image class="picker-btn">USE ICON</button>` : ""}
              <small>Optional PNG, WebP, GIF, or JPEG artwork.</small>
            </div>
          </div>
          <div class="toy-fields-grid">
            <div class="cmd-editor-field"><label>TOY NAME</label><input id="edit-toy-name" type="text" value="${html(toy.name || "NEW TOY")}" maxlength="60"></div>
            <div class="cmd-editor-field"><label>ICON / EMOJI</label><input id="edit-toy-icon" type="text" value="${html(toy.icon || "🧸")}" maxlength="8"></div>
            <div class="cmd-editor-field"><label>CATEGORY</label><select id="edit-toy-category">${Object.entries(toyCategories).map(([id, meta]) => `<option value="${id}" ${toy.category === id ? "selected" : ""}>${meta.icon} ${meta.label}</option>`).join("")}</select></div>
            <div class="cmd-editor-field"><label>RARITY</label><select id="edit-toy-rarity">${["common","uncommon","rare","legendary"].map((rarity) => `<option value="${rarity}" ${toy.rarity === rarity ? "selected" : ""}>${rarity.toUpperCase()}</option>`).join("")}</select></div>
            <div class="cmd-editor-field"><label>GAMEPLAY EFFECT</label><select id="edit-toy-effect">
              ${[["coins","Change coins"],["stars","Change stars"],["roll","Roll dice block"],["move","Extra movement"],["warp","Warp player"],["duel","Start duel"],["heal","Heal player"],["heal-party","Heal party"],["heal-status","Heal + clear status"],["status","Apply status"],["custom","Custom scripted effect"]].map(([id,label]) => `<option value="${id}" ${toy.effectType === id ? "selected" : ""}>${label}</option>`).join("")}
            </select></div>
            <div class="cmd-editor-field"><label>EFFECT AMOUNT / DICE COUNT</label><input id="edit-toy-amount" type="number" value="${Number(toy.amount) || 1}" min="-999" max="999"></div>
            <div class="cmd-editor-field"><label>DICE FACES (Comma-separated)</label><input id="edit-toy-die-faces" type="text" value="${html(toy.dieFaces || "")}" placeholder="1,2,3,4,5,6"></div>
            <div class="cmd-editor-field"><label>MAXIMUM STACK</label><input id="edit-toy-stack" type="number" value="${Number(toy.stackLimit) || 1}" min="1" max="999"></div>
          </div>
          <div class="cmd-editor-field"><label>DESCRIPTION</label><textarea id="edit-toy-description" rows="3" maxlength="240">${html(toy.description || "")}</textarea></div>
          <div class="toy-check-row">
            <label><input id="edit-toy-consumable" type="checkbox" ${toy.consumable ? "checked" : ""}> CONSUMED WHEN USED</label>
            <label><input id="edit-toy-tradable" type="checkbox" ${toy.tradable !== false ? "checked" : ""}> CAN BE TRADED</label>
          </div>
        </div>
        <footer class="cmd-editor-footer">
          <button data-nav data-save-toy class="card-btn primary">💾 SAVE TO CATALOGUE</button>
          ${draft.isNew ? "" : `<button data-nav data-delete-toy="${html(toy.id)}" class="card-btn danger">🗑 DELETE TOY</button>`}
          <button data-nav data-close-toy-editor class="card-btn secondary">CANCEL</button>
        </footer>
      </div>
    </div>`;
}

function dataEditor() {
  const data = app.project.data;
  const toys = ensureToyCatalogue(data);
  const category = app.toyCategory || "all";
  const visibleToys = category === "all" ? toys : toys.filter((toy) => toy.category === category);
  const filters = [["all", { label: "ALL TOYS", icon: "🧸" }], ...Object.entries(toyCategories)].map(([id, meta]) => `<button data-nav data-toy-category="${id}" class="toy-filter ${category === id ? "active" : ""}">${meta.icon} ${meta.label}<small>${id === "all" ? toys.length : toys.filter((toy) => toy.category === id).length}</small></button>`).join("");
  const cards = visibleToys.map((toy) => `<button data-nav data-edit-toy="${html(toy.id)}" class="toy-catalogue-card rarity-${html(toy.rarity || "common")}">
    <span class="toy-card-art">${toy.image ? `<img src="${html(toy.image)}" alt="">` : html(toy.icon || "🧸")}</span>
    <span class="toy-card-copy"><small>${html(toyCategories[toy.category]?.label || "OTHER TOYS")} · ${html(toy.rarity || "common")}</small><b>${html(toy.name)}</b><em>${html(toy.description || "No description yet.")}</em><i>${toy.effectType === "roll" ? `${Number(toy.amount) || 1} DICE · ${html(toy.dieFaces || "1–6")}` : `${html(String(toy.effectType || "custom").replace(/-/g, " ").toUpperCase())} ${Number(toy.amount) ? (Number(toy.amount) > 0 ? "+" : "") + Number(toy.amount) : ""}`}</i></span>
    <span class="toy-card-edit">EDIT ▶</span>
  </button>`).join("");
  const cabinet = (title, icon, key, entries) => `<section class="parts-cabinet cabinet-${key}"><header><span>${icon}</span><div><small>BOARD DATA CABINET</small><h2>${title}</h2></div></header><div>${entries.map((entry,index)=>`<button data-nav data-data-remove="${key}:${index}"><i>${html(entry.icon || "●")}</i><b>${html(entry.name || entry)}</b><small>PRESS A TO POOF</small></button>`).join("")}<button data-nav data-data-add="${key}" class="add-part">＋ NEW PART</button></div></section>`;
  return frame(stationMeta.data, `<div class="toy-catalogue-shell">
    <header class="toy-catalogue-header"><div><small>PLAYER-OBTAINABLE ITEMS</small><h1>🧸 TOY CATALOGUE</h1><p>Build every collectible players can earn, buy, trade, or use.</p></div><button data-nav data-add-toy class="card-btn primary">＋ CREATE NEW TOY</button></header>
    <nav class="toy-category-bar">${filters}</nav>
    <section class="toy-catalogue-grid">${cards || `<div class="toy-empty"><span>${toyCategories[category]?.icon || "🧸"}</span><h2>THIS SHELF IS EMPTY</h2><p>Create a toy for this category.</p></div>`}</section>
    <details class="board-data-drawers"><summary>BOARD DATA DRAWERS · Spaces, statuses &amp; minigame pools</summary><div class="parts-room">${cabinet("SPACE STICKERS","●","spaceTypes",data.spaceTypes)}${cabinet("STATUS STAMPS","✦","statuses",data.statuses)}${cabinet("MINI-GAME CARTS","▣","minigamePools",data.minigamePools)}</div></details>
  </div>${toyEditorModal()}`);
}
function studioIssues() {
  const issues=[],map=app.project.map,outgoing=new Set(map.paths.map(path=>Number(path.from))),ids=new Set(map.spaces.map(space=>Number(space.id)));
  if(!map.spaces.length)issues.push({editor:"map",icon:"🗺",title:"THE BOARD IS EMPTY!",copy:"Stamp at least one space so players have somewhere to stand."});
  for(const space of map.spaces.filter(space=>!outgoing.has(Number(space.id))).slice(0,4))issues.push({editor:"map",space:space.id,icon:"😵",title:`SPACE ${space.id+1} IS A DEAD END`,copy:"A player can arrive here, but no path tells them where to go next."});
  if(map.paths.some(path=>!ids.has(Number(path.from))||!ids.has(Number(path.to))))issues.push({editor:"map",icon:"✂",title:"A PATH LOST ITS SPACE",copy:"One connector points to a deleted space. Open Map Maker to reconnect it."});
  if(!(map.spawns||[]).length)issues.push({editor:"map",icon:"★",title:"WHO STARTS WHERE?",copy:"Place at least one Spawn toy on the board."});
  const flow=app.project.rules.pages.flow;if(flow?.cards?.length&&(flow.disabled||[]).length>=flow.cards.length)issues.push({editor:"rules",icon:"📕",title:"THE GAME CAN GET STUCK!",copy:"Every WHAT HAPPENS NEXT rule is switched off."});
  if(!app.project.events.entries.some(entry=>entry.commands.length))issues.push({editor:"event",icon:"⚡",title:"NOTHING CAN HAPPEN YET",copy:"Add at least one command card to an event deck."});
  for(const event of app.project.events.entries){const trigger=event.trigger&&typeof event.trigger==="object"?event.trigger:{kind:"land"},markers=(map.triggers||[]).filter(marker=>marker.eventId===event.id);if(["land","pass"].includes(trigger.kind)&&!markers.some(marker=>marker.spaceId!=null))issues.push({editor:"map",icon:"⚡",title:`${event.name.toUpperCase()} NEEDS A SPACE`,copy:`Its ${trigger.kind==="land"?"landing":"walk-over"} trigger must be snapped onto a board space.`});if(trigger.kind==="proximity"&&!markers.length)issues.push({editor:"map",icon:"◎",title:`${event.name.toUpperCase()} NEEDS A TRIGGER`,copy:"Place its proximity trigger anywhere on the map."});}
  if((map.triggers||[]).some(marker=>!app.project.events.entries.some(event=>event.id===marker.eventId)))issues.push({editor:"map",icon:"?",title:"A TRIGGER LOST ITS EVENT",copy:"Delete the orphan trigger or bind it to another event deck."});
  if(!app.project.scenes.entries.some(entry=>entry.clips.length))issues.push({editor:"scene",icon:"🎬",title:"THE SET IS EMPTY",copy:"Add a timeline car before testing a scene."});
  return issues;
}
function testEditor() {
  const scene = app.project.scenes.entries[0], now = app.testNow;
  const issues=studioIssues();
  const active = scene.clips.filter((clip) => now >= clip.start && now < clip.start + clip.duration);
  const pending = scene.clips.filter((clip) => now < clip.start);
  const history = scene.clips.filter((clip) => now >= clip.start + clip.duration);
  const cards = (items, kind) => items.map((clip) => `<div class="queue-card ${kind} clip-${clip.color}"><i>${kind === "active" ? "NOW" : kind === "done" ? "✓" : "→"}</i><b>${html(clip.label)}</b>${clip.barrier ? "<em>HARD BARRIER</em>" : clip.resources?.length ? `<small>${clip.resources.join(" + ")}</small>` : ""}</div>`).join("");
  return frame(stationMeta.test, `<div class="test-control-room"><section class="test-crt"><header><span>QUEUE MONITOR</span><i class="record-light ${app.testStartedAt?"on":""}"></i></header><div class="now-platform"><small>NOW</small>${cards(active,"active") || "<p>The Director is thinking…</p>"}</div><div class="queue-conveyor">${cards(pending,"pending") || "<div class='queue-empty'>QUEUE CLEAR!</div>"}</div><div class="queue-history">${cards(history.slice(-4),"done")}</div></section><aside class="test-console"><div class="gauge"><i style="--turn:${Math.min(280,now/scene.duration*280)}deg"></i><b>${now.toFixed(1)}s</b><small>SCENE CLOCK</small></div><button data-nav data-test-lever class="test-lever"><i></i><b>${app.testStartedAt?"STOP TEST":"PULL TO TEST"}</b></button><section class="workshop-check ${issues.length?"has-issues":"all-clear"}"><header><span>${issues.length?"🔧":"✓"}</span><div><small>WORKSHOP CHECK</small><b>${issues.length?`${issues.length} THING${issues.length===1?"":"S"} TO FIX`:"READY TO PARTY!"}</b></div></header>${issues.slice(0,4).map(issue=>`<button data-nav data-show-issue="${issue.editor}" ${issue.space==null?"":`data-issue-space="${issue.space}"`}><i>${issue.icon}</i><span><b>${issue.title}</b><small>${issue.copy}</small></span><em>SHOW ME ▶</em></button>`).join("")}</section><a data-nav href="/party/DEMO?demo=1" class="full-demo"><span>👻</span><b>PLAY HAUNTED HARBOR</b><small>FULL LIVE QUEUE DEMO</small></a><div class="test-leds"><i class="green"></i> DATABASE<i class="green"></i> QUEUE<i class="${active.length?"yellow":"green"}"></i> DIRECTOR</div></aside></div>`);
}
function updateConfabulatorViewport() {
  const focused = Boolean(app.editor || (boardIdFromPath() && !editorFromPath()));
  document.body.classList.toggle("party-studio-editor-view", focused);
}
function render() {
  clearInterval(app.testTimer); app.testTimer = null;
  app.editor = editorFromPath();
  if (!app.editor && location.pathname === "/party/boards") root.innerHTML = boardPicker();
  else if (!app.editor && boardIdFromPath()) root.innerHTML = boardShowcase();
  else if (!app.editor) root.innerHTML = hub();
  else if (app.editor === "map") root.innerHTML = mapEditor();
  else if (app.editor === "scene") root.innerHTML = sceneEditor();
  else if (app.editor === "event") root.innerHTML = eventEditor();
  else if (app.editor === "rules") root.innerHTML = rulesEditor();
  else if (app.editor === "data") root.innerHTML = dataEditor();
  else root.innerHTML = testEditor();
  updateConfabulatorViewport();
  if (app.testStartedAt && ["scene","test"].includes(app.editor)) startTestClock();
}
let confabulatorResizeFrame = 0;
function queueConfabulatorResize() {
  cancelAnimationFrame(confabulatorResizeFrame);
  confabulatorResizeFrame = requestAnimationFrame(updateConfabulatorViewport);
}
window.addEventListener("resize", queueConfabulatorResize);
window.visualViewport?.addEventListener("resize", queueConfabulatorResize);
function save(section) {
  const lamp = document.querySelector("#save-lamp"); if (lamp) { lamp.textContent = "● SAVING"; lamp.classList.add("busy"); }
  clearTimeout(app.saveTimers[section]); app.saveTimers[section] = setTimeout(async () => { try { app.project = await api(`/api/party/studio/${sections[section]}`, { method: "PUT", body: app.project[sections[section]] }); toast("SAVED! ★"); sound(660,.12); const next=document.querySelector("#save-lamp"); if(next){next.textContent="● SAVED";next.classList.remove("busy");} } catch(error){ toast(error.message); } }, 280);
}
function startTestClock() {
  clearInterval(app.testTimer);
  app.testTimer = setInterval(() => { const duration = app.project.scenes.entries[0].duration; app.testNow = (performance.now() - app.testStartedAt) / 1000; if (app.testNow >= duration) { app.testNow = duration; app.testStartedAt = null; clearInterval(app.testTimer); } render(); }, 100);
}
function boardPoint(board, event) {
  const rect = board.getBoundingClientRect();
  return { x: Math.max(0, Math.min(100, Math.round((event.clientX - rect.left) / rect.width * 1000) / 10)), y: Math.max(0, Math.min(100, Math.round((event.clientY - rect.top) / rect.height * 1000) / 10)) };
}
root.addEventListener("click", async (event) => {
  const goTarget = event.target.closest("[data-go]"); if (goTarget) { event.preventDefault(); go(goTarget.dataset.go); return; }
  const boardTarget = event.target.closest("[data-select-board]"); if (boardTarget) { try { app.project = await api(`/api/party/studio/boards/${boardTarget.dataset.selectBoard}/select`, { method: "POST" }); app.history=[];app.future=[];go(`/party/board/${app.project.boardProjects.selectedId}`); } catch(error) { toast(error.message); } return; }
  if (event.target.closest("[data-create-board]")) { const name=prompt("Name your new board:","New Board");if(!name)return;try{app.project=await api("/api/party/studio/boards",{method:"POST",body:{name}});app.history=[];app.future=[];go(`/party/board/${app.project.boardProjects.selectedId}`);}catch(error){toast(error.message);}return; }
  if (event.target.closest("[data-board-editor-drawer]")) { app.boardEditorDrawerOpen=!app.boardEditorDrawerOpen;render();sound(app.boardEditorDrawerOpen?620:320);return; }
  if (event.target.closest("[data-new-party]")) { const code=randomCode(); try { await api(`/api/party/rooms/${code}`,{method:"POST"}); location.href=`/party/${code}`; } catch(error){toast(error.message);} return; }
  if (event.target.closest("[data-test-shortcut]")) { go(boardEditorPath("test")); return; }
  if (event.target.closest("[data-workshop-toggle]")) { app.workshopsOpen = !app.workshopsOpen; render(); sound(app.workshopsOpen ? 620 : 320); return; }
  const issueTarget=event.target.closest("[data-show-issue]");if(issueTarget){const editor=issueTarget.dataset.showIssue;if(editor==="map"&&issueTarget.dataset.issueSpace!=null){app.project.map.tool="path";app.pathFrom=Number(issueTarget.dataset.issueSpace);app.selectedSpace=null;}go(boardEditorPath(editor));setTimeout(()=>toast(editor==="map"&&app.pathFrom!=null?"CONNECT THIS SPACE TO FINISH ITS PATH 〰":"HERE'S THE TROUBLE SPOT!"),0);return;}
  if (event.target.closest("[data-undo]") && app.history.length && sections[app.editor]) { app.future.push(structuredClone(app.project)); app.project=app.history.pop(); save(app.editor); render(); sound(280); return; }
  if (event.target.closest("[data-redo]") && app.future.length && sections[app.editor]) { app.history.push(structuredClone(app.project)); app.project=app.future.pop(); save(app.editor); render(); sound(380); return; }
  if (event.target.closest("[data-map-zoom]")) { app.mapZoom=Math.max(1,Math.min(3,app.mapZoom+Number(event.target.closest("[data-map-zoom]").dataset.mapZoom)));render();sound(460);return; }
  if (event.target.closest("[data-map-reset]")) { app.mapZoom=1.55;app.mapPan={x:0,y:0};render();sound(520);return; }
  const boardMutation = event.target.closest("#map-board") && ["space",...Object.keys(mapMarkerKinds)].includes(app.project.map.tool) && !event.target.closest("[data-space],[data-marker-kind]") && !app.panMoved;
  if (boardMutation || event.target.closest("[data-space-adjust],[data-space-shape],[data-space-type],[data-delete-space],[data-delete-marker],[data-marker-event],[data-marker-radius],[data-clip-adjust],[data-add-clip],[data-add-command],[data-command-move],[data-command-toggle],[data-command-delete],[data-command-kind],[data-command-amount],[data-command-phrase],[data-trigger-kind],[data-trigger-adjust],[data-event-add],[data-event-delete],[data-cartridge],[data-rule-toggle],[data-data-remove],[data-data-add]")) remember();
  const tool = event.target.closest("[data-map-tool]"); if(tool){app.project.map.tool=tool.dataset.mapTool;app.pathFrom=null;app.selectedSpace=null;app.selectedMarker=null;save("map");render();sound(420);return;}
  const spaceButton = event.target.closest("[data-space]"); if(spaceButton){event.stopPropagation();const id=Number(spaceButton.dataset.space),space=app.project.map.spaces.find(item=>item.id===id);if(app.project.map.tool==="trigger"){remember();const eventId=app.project.events.selectedId||app.project.events.entries[0]?.id,eventDeck=app.project.events.entries.find(entry=>entry.id===eventId),markerId=`trigger-${Date.now()}`;app.project.map.triggers||=[];app.project.map.triggers.push({id:markerId,kind:"trigger",name:eventDeck?.name||"EVENT TRIGGER",eventId,spaceId:id,x:space.x,y:space.y,radius:Number(eventDeck?.trigger?.radius)||10});app.selectedMarker={kind:"trigger",id:markerId};app.selectedSpace=null;save("map");render();sound(760,.12);return;}if(app.project.map.tool==="path"){if(app.pathFrom==null){app.pathFrom=id;app.selectedSpace=null;toast("FIRST SPACE READY — PICK THE NEXT! 〰");sound(240);render();return;}if(app.pathFrom!==id){const exists=app.project.map.paths.some(path=>path.from===app.pathFrom&&path.to===id);if(!exists){remember();app.project.map.paths.push({id:`path-${Date.now()}`,from:app.pathFrom,to:id});save("map");sound(720,.13);}else{sound(110);toast("THOSE SPACES ARE ALREADY CONNECTED");}app.pathFrom=id;render();return;}}app.selectedSpace=id;app.selectedMarker=null;render();sound(360);return;}
  const markerButton = event.target.closest("[data-marker-kind]"); if(markerButton){event.stopPropagation();app.selectedMarker={kind:markerButton.dataset.markerKind,id:markerButton.dataset.markerId};app.selectedSpace=null;render();sound(360);return;}
  const board = event.target.closest("#map-board");
  if(board && !app.panMoved && app.project.map.tool==="space"){const point=boardPoint(board,event),map=app.project.map,id=Math.max(-1,...map.spaces.map(s=>s.id))+1,type=map.spaceType||"blue",space={id,...point,type,size:3,depth:2,rotation:0,shape:"oval",action:`${type}-space-event`};const previous=map.spaces.at(-1);map.spaces.push(space);if(previous)map.paths.push({id:`path-${Date.now()}`,from:previous.id,to:id});app.selectedSpace=id;app.selectedMarker=null;save("map");render();sound(220,.08);return;}
  if(board && !app.panMoved && mapMarkerKinds[app.project.map.tool]){const map=app.project.map,kind=app.project.map.tool,[collection,,name]=mapMarkerKinds[kind],point=boardPoint(board,event),id=`${kind}-${Date.now()}`,marker={id,kind,name,...point};if(kind==="trigger"){const eventId=app.project.events.selectedId||app.project.events.entries[0]?.id,eventDeck=app.project.events.entries.find(entry=>entry.id===eventId);marker.eventId=eventId;marker.name=eventDeck?.name||name;marker.radius=Number(eventDeck?.trigger?.radius)||10;}map[collection] ||= [];map[collection].push(marker);app.selectedMarker={kind,id};app.selectedSpace=null;save("map");render();sound(kind==="trigger"?760:280,.1);return;}
  const adjust = event.target.closest("[data-space-adjust]"); if(adjust){const [key,amount]=adjust.dataset.spaceAdjust.split(":"),space=app.project.map.spaces.find(s=>s.id===app.selectedSpace);space[key]=Math.max(key==="size"?1:key==="depth"?0:-180,Math.min(key==="size"?5:key==="depth"?5:180,Number(space[key])+Number(amount)));save("map");render();return;}
  const shape = event.target.closest("[data-space-shape]"); if(shape){const options=["oval","round","star"],space=app.project.map.spaces.find(s=>s.id===app.selectedSpace),index=options.indexOf(space.shape||"oval");space.shape=options[(index+Number(shape.dataset.spaceShape)+options.length)%options.length];save("map");render();return;}
  const type = event.target.closest("[data-space-type]"); if(type){const space=app.project.map.spaces.find(s=>s.id===app.selectedSpace),oldDefault=`${space.type}-space-event`;space.type=type.dataset.spaceType;if(!space.action||space.action===oldDefault)space.action=`${space.type}-space-event`;app.project.map.spaceType=space.type;save("map");render();sound(300);return;}
  if(event.target.closest("[data-delete-space]")){const map=app.project.map;map.spaces=map.spaces.filter(s=>s.id!==app.selectedSpace);map.paths=map.paths.filter(p=>p.from!==app.selectedSpace&&p.to!==app.selectedSpace);app.selectedSpace=null;save("map");render();sound(120,.14);return;}
  if(event.target.closest("[data-delete-marker]")){const meta=mapMarkerKinds[app.selectedMarker?.kind],map=app.project.map;if(meta)map[meta[0]]=(map[meta[0]]||[]).filter(item=>item.id!==app.selectedMarker.id);app.selectedMarker=null;save("map");render();sound(120,.14);return;}
  const markerEvent=event.target.closest("[data-marker-event]");if(markerEvent){const marker=app.project.map.triggers.find(item=>item.id===app.selectedMarker?.id),events=app.project.events.entries,index=Math.max(0,events.findIndex(entry=>entry.id===marker.eventId)),next=events[(index+Number(markerEvent.dataset.markerEvent)+events.length)%events.length];marker.eventId=next.id;marker.name=next.name;marker.radius=Number(next.trigger?.radius)||marker.radius||10;save("map");render();sound(480);return;}
  const markerRadius=event.target.closest("[data-marker-radius]");if(markerRadius){const marker=app.project.map.triggers.find(item=>item.id===app.selectedMarker?.id);marker.radius=Math.max(2,Math.min(50,(Number(marker.radius)||10)+Number(markerRadius.dataset.markerRadius)));save("map");render();return;}
  const clipButton=event.target.closest("[data-clip]");if(clipButton){if(app.ignoreClipClick)return;app.selectedClip=clipButton.dataset.clip;render();return;}
  const clipAdjust=event.target.closest("[data-clip-adjust]");if(clipAdjust){const scene=app.project.scenes.entries[0],[key,amount]=clipAdjust.dataset.clipAdjust.split(":"),clip=scene.clips.find(c=>c.id===app.selectedClip);clip[key]=Math.max(key==="duration"?.25:0,Math.min(scene.duration,Number(clip[key])+Number(amount)));save("scene");render();return;}
  if(event.target.closest("[data-add-clip]")){const scene=app.project.scenes.entries[0],id=`clip-${Date.now()}`;scene.clips.push({id,track:"effects",label:"NEW SURPRISE",start:Math.min(scene.duration-1,scene.clips.length),duration:1,color:"cyan",resources:["effects"]});app.selectedClip=id;save("scene");render();sound(240);return;}
  if(event.target.closest("[data-scene-play]")){app.testStartedAt=app.testStartedAt?null:performance.now();app.testNow=0;render();sound(180,.12);return;}

  // --- Video Editor Multi-Track Timeline Transport & Controls ---
  const currentAction = () => {
    const act = app.project.events.entries.find((e) => e.id === app.activeSpaceActionId) || app.project.events.entries[0];
    if (act) ensureSpaceActionDefaults(act);
    return act;
  };

  // Timeline Play / Pause
  if (event.target.closest("[data-timeline-play]")) {
    const act = currentAction();
    if (app.timelinePlaying) {
      if (app.timelineTimer) clearInterval(app.timelineTimer);
      app.timelineTimer = null;
      app.timelinePlaying = false;
      render(); playSfx("dialogue-blip");
    } else {
      app.timelinePlaying = true;
      const pxPerSec = app.timelineZoom || 100;
      const duration = Math.max(16, act.timeline?.duration || 16);
      let lastTime = performance.now();

      app.timelineTimer = setInterval(() => {
        const now = performance.now();
        const dt = (now - lastTime) / 1000;
        lastTime = now;
        app.timelinePlayhead = (app.timelinePlayhead || 0) + dt;

        if (app.timelinePlayhead >= duration) {
          app.timelinePlayhead = 0;
        }

        const needleEl = document.querySelector("#timeline-playhead-cursor");
        if (needleEl) {
          needleEl.style.left = `${app.timelinePlayhead * pxPerSec}px`;
          const handleEl = needleEl.querySelector(".playhead-head-handle span");
          if (handleEl) handleEl.textContent = app.timelinePlayhead.toFixed(1);
        }
        const readoutEl = document.querySelector(".time-readout-pill span:nth-child(2)");
        if (readoutEl) {
          const m = Math.floor(app.timelinePlayhead / 60);
          const s = (app.timelinePlayhead % 60).toFixed(2);
          readoutEl.textContent = `${String(m).padStart(2, "0")}:${s.padStart(5, "0")}`;
        }

        // Live Audio/SFX triggers on clip hits
        for (const track of act.timeline?.tracks || []) {
          if (track.muted) continue;
          for (const clip of track.clips || []) {
            if (Math.abs(clip.start - app.timelinePlayhead) < 0.06) {
              if (clip.sfx) playSfx(clip.sfx);
              else if (clip.category === "rewards") playSfx("coin");
              else if (clip.category === "camera" && (clip.camAction === "shake" || clip.label?.includes("SHAKE"))) playSfx("thunder");
              else if (clip.category === "dialogue") playSfx("dialogue-blip");
            }
          }
        }
      }, 35);
      render(); playSfx("fanfare");
    }
    return;
  }

  // Timeline Rewind
  if (event.target.closest("[data-timeline-rewind]")) {
    app.timelinePlayhead = 0;
    render(); playSfx("dialogue-blip"); return;
  }

  // Open Action Picker from Timeline Header
  if (event.target.closest("[data-open-action-picker-timeline]") || event.target.closest("[data-open-action-picker-root]")) {
    app.actionPickerOpen = true;
    app.actionPickerTab = "dialogue";
    render(); playSfx("chest"); return;
  }

  // Add Track
  if (event.target.closest("[data-add-track]")) {
    const act = currentAction();
    act.timeline ||= { duration: 16, tracks: [] };
    const num = act.timeline.tracks.length + 1;
    const colors = ["cyan", "amber", "rose", "emerald", "violet", "indigo"];
    const col = colors[(num - 1) % colors.length];
    act.timeline.tracks.push({
      id: `track-${Date.now()}`,
      name: `Track ${num} · Stream`,
      kind: "stream",
      color: col,
      locked: false,
      muted: false,
      clips: []
    });
    save("event"); render(); playSfx("star"); toast("NEW TRACK LANE ADDED! ★");
    return;
  }

  // Toggle Track Lock
  const trackLockBtn = event.target.closest("[data-toggle-track-lock]");
  if (trackLockBtn) {
    const trackId = trackLockBtn.dataset.toggleTrackLock;
    const act = currentAction();
    const tr = act.timeline?.tracks?.find((t) => t.id === trackId);
    if (tr) {
      tr.locked = !tr.locked;
      save("event"); render(); playSfx("dice");
      toast(tr.locked ? "TRACK LOCKED (STATIC / PROTECTED)" : "TRACK UNLOCKED");
    }
    return;
  }

  // Toggle Track Mute
  const trackMuteBtn = event.target.closest("[data-toggle-track-mute]");
  if (trackMuteBtn) {
    const trackId = trackMuteBtn.dataset.toggleTrackMute;
    const act = currentAction();
    const tr = act.timeline?.tracks?.find((t) => t.id === trackId);
    if (tr) {
      tr.muted = !tr.muted;
      syncTimelineToCommands(act);
      save("event"); render(); playSfx("dice");
      toast(tr.muted ? "TRACK MUTED" : "TRACK ACTIVE");
    }
    return;
  }

  // Delete Track
  const deleteTrackBtn = event.target.closest("[data-delete-track]");
  if (deleteTrackBtn) {
    const trackId = deleteTrackBtn.dataset.deleteTrack;
    const act = currentAction();
    act.timeline.tracks = act.timeline.tracks.filter((t) => t.id !== trackId);
    syncTimelineToCommands(act);
    save("event"); render(); playSfx("thunder"); toast("TRACK REMOVED");
    return;
  }

  // Toggle Ripple Edit
  if (event.target.closest("[data-toggle-ripple]")) {
    app.timelineRipple = !app.timelineRipple;
    render(); playSfx("star");
    toast(app.timelineRipple ? "RIPPLE EDIT ENABLED (Followers Shift)" : "RIPPLE EDIT DISABLED (Clips Static)");
    return;
  }

  // Adjust Zoom
  const zoomBtn = event.target.closest("[data-timeline-zoom]");
  if (zoomBtn) {
    const delta = Number(zoomBtn.dataset.timelineZoom);
    app.timelineZoom = Math.max(40, Math.min(220, (app.timelineZoom || 100) + delta));
    render(); playSfx("dialogue-blip"); return;
  }

  // Timeline Clip Clone
  const cloneClipBtn = event.target.closest("[data-timeline-clip-clone]");
  if (cloneClipBtn) {
    const clipId = cloneClipBtn.dataset.timelineClipClone;
    const act = currentAction();
    const found = findClipInTimeline(act.timeline, clipId);
    if (found) {
      const cloned = structuredClone(found.clip);
      cloned.id = `clip-${Date.now()}`;
      cloned.start = (found.clip.start || 0) + (found.clip.duration || 2.0) + 0.2;
      found.track.clips.push(cloned);
      found.track.clips.sort((a, b) => a.start - b.start);
      syncTimelineToCommands(act);
      save("event"); render(); playSfx("star"); toast("CLIP DUPLICATED! ★");
    }
    return;
  }

  // Timeline Clip Delete
  const delClipBtn = event.target.closest("[data-timeline-clip-delete]");
  if (delClipBtn) {
    const clipId = delClipBtn.dataset.timelineClipDelete;
    const act = currentAction();
    const found = findClipInTimeline(act.timeline, clipId);
    if (found) {
      found.track.clips.splice(found.clipIndex, 1);
      syncTimelineToCommands(act);
      save("event"); render(); playSfx("lose"); toast("CLIP DELETED");
    }
    return;
  }

  // Clicking on Ruler or Canvas Track area to Scrub Playhead Cursor
  const rulerTarget = event.target.closest("#timeline-ruler") || event.target.closest(".timeline-track-lane");
  if (rulerTarget && !event.target.closest(".timeline-clip-block, .clip-mini-btn, button")) {
    const viewport = document.querySelector("#timeline-canvas-viewport");
    if (viewport) {
      const rect = viewport.getBoundingClientRect();
      const clickX = event.clientX - rect.left + viewport.scrollLeft;
      const pxPerSec = app.timelineZoom || 100;
      app.timelinePlayhead = Math.max(0, Math.round((clickX / pxPerSec) * 10) / 10);
      render(); playSfx("dialogue-blip");
      return;
    }
  }

  // Upload Trigger Buttons (keyboard & click support)
  const triggerUploadBtn = event.target.closest("[data-trigger-upload]");
  if (triggerUploadBtn) {
    const inputId = triggerUploadBtn.dataset.triggerUpload;
    const input = document.getElementById(inputId);
    if (input) input.click();
    return;
  }

  // Catalog Filter
  const filterBtn = event.target.closest("[data-space-filter]");
  if (filterBtn) {
    app.spaceActionFilter = filterBtn.dataset.spaceFilter;
    render(); playSfx("dialogue-blip"); return;
  }

  // Edit Space Action
  const editBtn = event.target.closest("[data-space-action-edit]");
  if (editBtn) {
    app.activeSpaceActionId = editBtn.dataset.spaceActionEdit;
    app.spaceActionCatalogView = false;
    app.spaceActionTab = "visuals";
    render(); playSfx("dialogue-blip"); return;
  }

  // Clone Space Action
  const cloneBtn = event.target.closest("[data-space-action-clone]");
  if (cloneBtn) {
    const target = app.project.events.entries.find((e) => e.id === cloneBtn.dataset.spaceActionClone);
    if (target) {
      remember();
      const cloned = structuredClone(target);
      cloned.id = `event-${Date.now()}`;
      cloned.name = `${cloned.name} (Copy)`;
      if (cloned.space) cloned.space.title = cloned.name;
      app.project.events.entries.push(cloned);
      save("event"); render(); playSfx("star"); toast("SPACE ACTION DUPLICATED! ★");
    }
    return;
  }

  // Delete Space Action
  const deleteBtn = event.target.closest("[data-space-action-delete]");
  if (deleteBtn) {
    if (app.project.events.entries.length <= 1) {
      toast("KEEP AT LEAST ONE SPACE ACTION"); playSfx("lose"); return;
    }
    remember();
    const id = deleteBtn.dataset.spaceActionDelete;
    app.project.events.entries = app.project.events.entries.filter((e) => e.id !== id);
    if (app.activeSpaceActionId === id) app.activeSpaceActionId = app.project.events.entries[0]?.id;
    save("event"); render(); playSfx("thunder"); toast("SPACE ACTION DELETED");
    return;
  }

  // Create Space Action
  if (event.target.closest("[data-space-action-create]")) {
    remember();
    const newId = `event-${Date.now()}`;
    const count = app.project.events.entries.length + 1;
    const newEntry = {
      id: newId,
      name: `Space Event ${count}`,
      trigger: { kind: "land", spaceId: 7, radius: 10, round: 1, turn: 1 },
      space: {
        type: "event", shape: "oval", color: "violet", icon: "⚡",
        effect: "sparkles", customImage: "",
        glow: true, title: `Space Event ${count}`,
        description: "A mysterious space on the board.",
      },
      characters: [
        { id: `host-${Date.now()}`, name: "Guide", role: "Host", isHost: true, icon: "✦", sprite: "", anchor: "center", animation: "float" }
      ],
      activations: {
        movement: { land: true, pass: false, reverse: false },
        proximity: { enabled: false, radius: 10 },
        timing: { round: 0, interval: 0, turn: 0, gameStart: false, finalRounds: false },
        conditions: { minCoins: 0, requiredItem: "", mapState: "any" },
        minigames: { beforeMinigame: false, afterMinigame: false },
      },
      timeline: {
        duration: 16,
        tracks: [
          {
            id: "track-main",
            name: "Track 1 · Main Sequence",
            kind: "main",
            color: "violet",
            locked: false,
            muted: false,
            clips: [
              { id: `clip-${Date.now()}-1`, start: 0, duration: 2.0, category: "camera", kind: "action", label: "ZOOM IN ON SPACE (1.8x Focus)" },
              { id: `clip-${Date.now()}-2`, start: 2.2, duration: 2.8, category: "dialogue", kind: "scene", label: 'SHOW SPEECH BUBBLE: "Welcome to this space!"' },
              { id: `clip-${Date.now()}-3`, start: 5.2, duration: 2.0, category: "rewards", kind: "player", label: "GIVE PLAYER +10 COINS" }
            ]
          }
        ]
      },
      commands: [],
      music: { track: "default", autoRestore: true },
      variables: {}
    };
    syncTimelineToCommands(newEntry);
    app.project.events.entries.push(newEntry);
    app.activeSpaceActionId = newId;
    app.spaceActionCatalogView = false;
    app.spaceActionTab = "visuals";
    save("event"); render(); playSfx("star"); toast("NEW SPACE ACTION CREATED! ★");
    return;
  }

  // Back to Catalog
  if (event.target.closest("[data-back-to-catalog]")) {
    if (app.timelineTimer) clearInterval(app.timelineTimer);
    app.timelinePlaying = false;
    app.spaceActionCatalogView = true;
    app.actionPickerOpen = false;
    app.editingCommand = null;
    app.previewingCutscene = false;
    render(); playSfx("dialogue-blip"); return;
  }

  // Switch Editor Tab
  const tabBtn = event.target.closest("[data-editor-tab]");
  if (tabBtn) {
    app.spaceActionTab = tabBtn.dataset.editorTab;
    render(); playSfx("dialogue-blip"); return;
  }

  // Visuals Tab: Set Shape, Color, Icon, Effect, Remove Custom Image
  const shapeBtn = event.target.closest("[data-set-shape]");
  if (shapeBtn) {
    const act = currentAction();
    act.space ||= {};
    act.space.shape = shapeBtn.dataset.setShape;
    save("event"); render(); playSfx("dice"); return;
  }
  const effectBtn = event.target.closest("[data-set-effect]");
  if (effectBtn) {
    const act = currentAction();
    act.space ||= {};
    act.space.effect = effectBtn.dataset.setEffect;
    save("event"); render(); playSfx("star"); return;
  }
  const colorBtn = event.target.closest("[data-set-color]");
  if (colorBtn) {
    const act = currentAction();
    act.space ||= {};
    act.space.color = colorBtn.dataset.setColor;
    save("event"); render(); playSfx("coin"); return;
  }
  const iconBtn = event.target.closest("[data-set-icon]");
  if (iconBtn) {
    const act = currentAction();
    act.space ||= {};
    act.space.icon = iconBtn.dataset.setIcon;
    save("event"); render(); playSfx("star"); return;
  }
  if (event.target.closest("[data-remove-space-image]")) {
    const act = currentAction();
    if (act.space) act.space.customImage = "";
    save("event"); render(); playSfx("lose"); toast("CUSTOM SPACE IMAGE REMOVED"); return;
  }

  // Cast Tab: Remove character
  const removeCastBtn = event.target.closest("[data-cast-remove]");
  if (removeCastBtn) {
    const act = currentAction();
    const charId = removeCastBtn.dataset.castRemove;
    act.characters = (act.characters || []).filter((c) => c.id !== charId);
    save("event"); render(); playSfx("thunder"); return;
  }

  // Cast Tab: Restore Host
  const restoreHostBtn = event.target.closest("[data-restore-host]");
  if (restoreHostBtn) {
    const [name, icon, animation] = restoreHostBtn.dataset.restoreHost.split(":");
    const act = currentAction();
    act.characters ||= [];
    act.characters.forEach((c) => { c.isHost = false; if (c.role === "Host") c.role = "Actor"; });
    act.characters.unshift({
      id: `host-${Date.now()}`,
      name: name || "Host Guide",
      icon: icon || "✦",
      role: "Host",
      isHost: true,
      sprite: "",
      anchor: "center",
      animation: animation || "float"
    });
    save("event"); render(); playSfx("fanfare"); toast(`👑 ${name.toUpperCase()} ASSIGNED AS HOST! ★`);
    return;
  }

  // Cast Tab: Add Preset Actor
  const presetActorBtn = event.target.closest("[data-add-preset-actor]");
  if (presetActorBtn) {
    const [name, icon, role, animation] = presetActorBtn.dataset.addPresetActor.split(":");
    const act = currentAction();
    act.characters ||= [];
    act.characters.push({
      id: `char-${Date.now()}`,
      name, icon, role, isHost: false, sprite: "",
      anchor: "center", animation: animation || "float"
    });
    save("event"); render(); playSfx("chest"); toast(`ADDED ${name.toUpperCase()} TO CAST! ★`);
    return;
  }

  // Close Action Picker Modal
  if (event.target.closest("[data-close-action-picker]")) {
    app.actionPickerOpen = false;
    render(); playSfx("dialogue-blip"); return;
  }

  // Switch Category Tab in Action Picker
  const modalTabBtn = event.target.closest("[data-action-modal-tab]");
  if (modalTabBtn) {
    app.actionPickerTab = modalTabBtn.dataset.actionModalTab;
    render(); playSfx("dialogue-blip"); return;
  }

  // Add Preset Command from Modal onto Video Editor Timeline
  const addCmdBtn = event.target.closest("[data-add-preset-cmd]");
  if (addCmdBtn) {
    try {
      const presetData = JSON.parse(decodeURIComponent(addCmdBtn.dataset.addPresetCmd));
      const act = currentAction();
      ensureSpaceActionDefaults(act);

      const insertTime = Math.max(0, app.timelinePlayhead || 0);
      const isLogic = presetData.category === "logic";
      const dur = presetData.category === "dialogue" ? 2.5 : 1.8;

      const newClip = {
        ...presetData,
        id: `clip-${Date.now()}`,
        start: insertTime,
        duration: dur,
        category: presetData.category,
        kind: presetData.category === "logic" ? "condition" : presetData.category === "rewards" ? "player" : "action",
        label: presetData.label,
        isDecision: isLogic,
      };

      // Target track (active track or first unlocked track)
      let targetTrack = act.timeline.tracks.find((t) => t.id === app.timelineActiveTrackId && !t.locked) ||
                        act.timeline.tracks.find((t) => !t.locked) ||
                        act.timeline.tracks[0];

      // Ripple edit on unlocked tracks
      if (app.timelineRipple !== false) {
        for (const track of act.timeline.tracks) {
          if (track.locked) continue; // Locked tracks stay static!
          for (const clip of track.clips || []) {
            if (clip.start >= insertTime) {
              clip.start += newClip.duration;
            }
          }
        }
      }

      targetTrack.clips ||= [];
      targetTrack.clips.push(newClip);
      targetTrack.clips.sort((a, b) => a.start - b.start);

      // If logic condition, automatically spawn paired False branch track below if not existing
      if (isLogic) {
        let branchTrack = act.timeline.tracks.find((tr) => tr.kind === "branch-false");
        if (!branchTrack) {
          branchTrack = {
            id: `track-branch-${Date.now()}`,
            name: "Branch 2 · False / Otherwise",
            kind: "branch-false",
            color: "amber",
            locked: false,
            muted: false,
            clips: []
          };
          act.timeline.tracks.push(branchTrack);
        }
      }

      // Expand duration if needed
      const maxEnd = Math.max(...act.timeline.tracks.flatMap((t) => (t.clips || []).map((c) => (c.start || 0) + (c.duration || 2))), 14);
      act.timeline.duration = Math.max(16, Math.ceil(maxEnd + 4));

      // Advance playhead past the newly inserted clip
      app.timelinePlayhead = insertTime + newClip.duration;

      syncTimelineToCommands(act);
      app.actionPickerOpen = false;
      save("event"); render();
      playSfx(presetData.category === "rewards" ? "coin" : presetData.category === "audio" ? "fanfare" : "chest");
      toast("EVENT INSERTED ON TIMELINE! ★");
    } catch {}
    return;
  }

  // Edit Action Inspector Modal
  const editScriptBtn = event.target.closest("[data-script-edit]");
  if (editScriptBtn) {
    const cmdId = editScriptBtn.dataset.scriptEdit;
    const act = currentAction();
    const foundClip = findClipInTimeline(act.timeline, cmdId);
    const foundCmd = findCommandInTree(act.commands, cmdId);
    const targetObj = foundClip ? foundClip.clip : (foundCmd ? foundCmd.cmd : null);
    if (targetObj) {
      app.editingCommand = { id: cmdId, cmd: structuredClone(targetObj) };
      render(); playSfx("dialogue-blip");
    }
    return;
  }

  if (event.target.closest("[data-close-cmd-editor]")) {
    app.editingCommand = null;
    render(); playSfx("dialogue-blip"); return;
  }

  if (event.target.closest("[data-test-cmd-sfx]")) {
    const sfxVal = document.querySelector("#edit-cmd-sfx")?.value || "coin";
    playSfx(sfxVal); return;
  }

  if (event.target.closest("[data-remove-weather-particle]") && app.editingCommand?.cmd) {
    app.editingCommand.cmd.particleImage = "";
    render(); playSfx("dialogue-blip"); return;
  }

  if (event.target.closest("[data-save-cmd-edit]")) {
    if (!app.editingCommand) return;
    const act = currentAction();
    const foundClip = findClipInTimeline(act.timeline, app.editingCommand.id);
    const foundCmd = findCommandInTree(act.commands, app.editingCommand.id);
    const targetObj = foundClip ? foundClip.clip : (foundCmd ? foundCmd.cmd : null);

    if (targetObj) {
      const cat = targetObj.category || "dialogue";
      if (cat === "dialogue") {
        const spk = document.querySelector("#edit-cmd-speaker")?.value || "Active Player";
        const txt = document.querySelector("#edit-cmd-text")?.value.trim() || "";
        const sty = document.querySelector("#edit-cmd-style")?.value || "speech";
        targetObj.speaker = spk;
        targetObj.text = txt;
        targetObj.style = sty;
        targetObj.label = `${spk}: "${txt}"`;
      } else if (cat === "camera") {
        const camAct = document.querySelector("#edit-cmd-cam-action")?.value || "zoom";
        const zoom = document.querySelector("#edit-cmd-zoom")?.value || "1.8";
        const intensity = document.querySelector("#edit-cmd-intensity")?.value || "heavy";
        targetObj.camAction = camAct;
        targetObj.zoom = zoom;
        targetObj.intensity = intensity;
        targetObj.label = camAct === "zoom" ? `ZOOM IN ON SPACE (${zoom}x Focus)` : camAct === "shake" ? `SCREEN SHAKE (${intensity.toUpperCase()})` : `CAMERA: ${camAct.toUpperCase()}`;
      } else if (cat === "actors") {
        const target = document.querySelector("#edit-cmd-actor-target")?.value || "Stage Host";
        const actAction = document.querySelector("#edit-cmd-actor-action")?.value || "pose";
        const pose = document.querySelector("#edit-cmd-pose")?.value || "cheer";
        targetObj.target = target;
        targetObj.actorAction = actAction;
        targetObj.pose = pose;
        targetObj.label = `${target.toUpperCase()}: ${actAction.toUpperCase()} (${pose.toUpperCase()})`;
      } else if (cat === "inventory" || cat === "rewards") {
        const invOp = document.querySelector("#edit-cmd-inv-op")?.value || "give-coins";
        const itemName = document.querySelector("#edit-cmd-inv-item")?.value.trim() || "Skeleton Key";
        const amount = Number(document.querySelector("#edit-cmd-amount")?.value) || 10;
        targetObj.category = "inventory";
        targetObj.invOp = invOp;
        targetObj.rewardType = invOp;
        targetObj.itemName = itemName;
        targetObj.amount = amount;
        targetObj.label = (invOp === "grant-item" || invOp === "remove-item")
          ? `${invOp.toUpperCase().replace(/-/g, " ")}: ${itemName}`
          : `${invOp.toUpperCase().replace(/-/g, " ")}: ${amount}`;
      } else if (cat === "logic" || targetObj.kind === "condition") {
        const logicOp = document.querySelector("#edit-cmd-logic-op")?.value || "coins-at-least";
        const varName = document.querySelector("#edit-cmd-var-name")?.value.trim() || "game_state";
        const condValue = document.querySelector("#edit-cmd-cond-value")?.value.trim() || "20";
        targetObj.category = "logic";
        targetObj.logicOp = logicOp;
        targetObj.varName = varName;
        targetObj.condValue = condValue;
        targetObj.condType = logicOp;
        if (logicOp === "set-variable") targetObj.label = `SET ${varName.toUpperCase()} = ${condValue}`;
        else if (logicOp === "add-variable") targetObj.label = `VAR ${varName.toUpperCase()} += ${condValue}`;
        else if (logicOp === "timer-delay") targetObj.label = `WAIT / DELAY ${condValue}s`;
        else if (logicOp === "exit-cutscene") targetObj.label = `EXIT CUTSCENE`;
        else targetObj.label = `IF ${logicOp.replace(/-/g, " ").toUpperCase()} [${condValue}]`;
      } else if (cat === "input") {
        const inputType = document.querySelector("#edit-cmd-input-type")?.value || "question-custom";
        const promptText = document.querySelector("#edit-cmd-prompt-text")?.value.trim() || "Choose action:";
        const choice1 = document.querySelector("#edit-cmd-choice-1")?.value.trim() || "YES";
        const choice2 = document.querySelector("#edit-cmd-choice-2")?.value.trim() || "NO";
        targetObj.category = "input";
        targetObj.inputType = inputType;
        targetObj.questionText = promptText;
        targetObj.choice1 = choice1;
        targetObj.choice2 = choice2;
        targetObj.label = `ASK: "${promptText}" [${choice1} / ${choice2}]`;
      } else if (cat === "world" && (targetObj.worldAction === "weather" || commandWeatherType(targetObj))) {
        const weatherType = document.querySelector("#edit-cmd-weather-type")?.value || "rain";
        const weatherIntensity = document.querySelector("#edit-cmd-weather-intensity")?.value || "medium";
        const weather = weatherEffects[weatherType] || weatherEffects.rain;
        targetObj.worldAction = "weather";
        targetObj.weatherType = weatherType;
        targetObj.weatherIntensity = weatherIntensity;
        targetObj.particleImage = app.editingCommand.cmd.particleImage || "";
        targetObj.label = `WEATHER: ${weather.label}`;
      } else if (cat === "audio") {
        const sfx = document.querySelector("#edit-cmd-sfx")?.value || "coin";
        const bgm = document.querySelector("#edit-cmd-bgm")?.value || "default";
        targetObj.sfx = sfx;
        targetObj.bgm = bgm;
        targetObj.label = `PLAY SFX: "${sfx}" · BGM: ${bgm.toUpperCase()}`;
      } else {
        const genLbl = document.querySelector("#edit-cmd-generic-label")?.value.trim();
        if (genLbl) targetObj.label = genLbl;
      }
      targetObj.waitForInput = document.querySelector("#edit-cmd-wait-input")?.checked === true;
      syncTimelineToCommands(act);
      app.editingCommand = null;
      save("event"); render(); playSfx("star"); toast("ACTION UPDATED! ★");
    }
    return;
  }

  // Save Space Action
  if (event.target.closest("[data-save-space-action]")) {
    const act = currentAction();
    const nameInput = document.querySelector("#input-action-name");
    const typeSelect = document.querySelector("#input-action-type");
    const descInput = document.querySelector("#input-action-desc");
    if (nameInput) { act.name = nameInput.value.trim() || act.name; if (act.space) act.space.title = act.name; }
    if (typeSelect && act.space) act.space.type = typeSelect.value;
    if (descInput && act.space) act.space.description = descInput.value.trim();

    syncTimelineToCommands(act);
    save("event"); playSfx("star"); toast("SPACE ACTION SAVED SUCCESSFULLY! ★");
    return;
  }

  // Live Cutscene Theater Preview
  if (event.target.closest("[data-preview-cutscene]")) {
    const act = currentAction();
    syncTimelineToCommands(act);
    app.previewingCutscene = true;
    app.previewStep = 0;
    const firstCmd = act.commands[0];
    app.previewState = previewStateForCommand(firstCmd, 0);
    render(); playSfx("dialogue-blip"); return;
  }

  if (event.target.closest("[data-preview-next-step]")) {
    const act = currentAction();
    app.previewStep = (app.previewStep || 0) + 1;
    if (app.previewStep >= act.commands.length) {
      app.previewingCutscene = false;
      toast("CUTSCENE PREVIEW COMPLETE! ★");
      playSfx("fanfare"); render(); return;
    }

    const cmd = act.commands[app.previewStep];
    app.previewState = previewStateForCommand(cmd, app.previewStep);
    if (cmd) {
      if (cmd.category === "dialogue") {
        playSfx("dialogue-blip");
      } else if (cmd.category === "camera" && cmd.label.includes("SHAKE")) {
        playSfx("thunder");
      } else if (commandWeatherType(cmd) === "lightning") {
        playSfx("thunder");
      } else if (cmd.category === "rewards" || cmd.category === "inventory") {
        playSfx("coin");
      } else if (cmd.category === "audio") {
        playSfx("fanfare");
      } else {
        playSfx("dice");
      }
    }
    render(); return;
  }

  if (event.target.closest("[data-close-preview]")) {
    app.previewingCutscene = false;
    render(); playSfx("dialogue-blip"); return;
  }

  // --- End Space Actions ---

  const toyCategoryBtn = event.target.closest("[data-toy-category]");
  if (toyCategoryBtn) {
    app.toyCategory = toyCategoryBtn.dataset.toyCategory;
    render(); playSfx("dialogue-blip"); return;
  }

  const editToyBtn = event.target.closest("[data-edit-toy]");
  if (editToyBtn) {
    const toy = ensureToyCatalogue(app.project.data).find((item) => item.id === editToyBtn.dataset.editToy);
    if (toy) app.editingToy = { isNew: false, toy: structuredClone(toy) };
    render(); playSfx("dialogue-blip"); return;
  }

  if (event.target.closest("[data-add-toy]")) {
    const category = app.toyCategory && app.toyCategory !== "all" ? app.toyCategory : "other";
    app.editingToy = { isNew: true, toy: { id: `toy-${Date.now()}`, name: "NEW TOY", icon: toyCategories[category]?.icon || "🧸", category, description: "", effectType: category === "dice" ? "roll" : "custom", amount: 1, dieFaces: category === "dice" ? "1,2,3,4,5,6" : "", stackLimit: 1, consumable: true, tradable: true, rarity: "common", image: "" } };
    render(); playSfx("chest"); return;
  }

  if (event.target.closest("[data-close-toy-editor]")) {
    app.editingToy = null;
    render(); playSfx("dialogue-blip"); return;
  }

  if (event.target.closest("[data-remove-toy-image]") && app.editingToy?.toy) {
    app.editingToy.toy.image = "";
    render(); playSfx("dialogue-blip"); return;
  }

  if (event.target.closest("[data-save-toy]") && app.editingToy?.toy) {
    const toys = ensureToyCatalogue(app.project.data);
    const draft = app.editingToy;
    const name = document.querySelector("#edit-toy-name")?.value.trim() || "UNTITLED TOY";
    const baseId = name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || `toy-${Date.now()}`;
    let id = draft.isNew ? baseId : draft.toy.id;
    if (draft.isNew) {
      let suffix = 2;
      while (toys.some((toy) => toy.id === id)) id = `${baseId}-${suffix++}`;
    }
    const toy = {
      ...draft.toy,
      id,
      name,
      icon: document.querySelector("#edit-toy-icon")?.value.trim() || "🧸",
      category: document.querySelector("#edit-toy-category")?.value || "other",
      rarity: document.querySelector("#edit-toy-rarity")?.value || "common",
      effectType: document.querySelector("#edit-toy-effect")?.value || "custom",
      amount: Math.max(-999, Math.min(999, Number(document.querySelector("#edit-toy-amount")?.value) || 0)),
      dieFaces: document.querySelector("#edit-toy-die-faces")?.value.trim() || "",
      stackLimit: Math.max(1, Math.min(999, Number(document.querySelector("#edit-toy-stack")?.value) || 1)),
      description: document.querySelector("#edit-toy-description")?.value.trim() || "",
      consumable: document.querySelector("#edit-toy-consumable")?.checked === true,
      tradable: document.querySelector("#edit-toy-tradable")?.checked === true,
    };
    remember();
    if (draft.isNew) toys.push(toy);
    else {
      const index = toys.findIndex((item) => item.id === draft.toy.id);
      if (index >= 0) toys.splice(index, 1, toy);
    }
    app.toyCategory = toy.category;
    app.editingToy = null;
    save("data"); render(); playSfx("star"); toast("TOY SAVED TO THE CATALOGUE! ★"); return;
  }

  const deleteToyBtn = event.target.closest("[data-delete-toy]");
  if (deleteToyBtn) {
    remember();
    app.project.data.toys = ensureToyCatalogue(app.project.data).filter((toy) => toy.id !== deleteToyBtn.dataset.deleteToy);
    app.editingToy = null;
    save("data"); render(); playSfx("lose"); toast("TOY REMOVED FROM THE CATALOGUE"); return;
  }

  const cartridge=event.target.closest("[data-cartridge]");if(cartridge){app.project.rules.activeCartridge=cartridge.dataset.cartridge;save("rules");render();sound(100,.1);return;}
  const rulePage=event.target.closest("[data-rule-page]");if(rulePage){app.rulePage=rulePage.dataset.rulePage;render();sound(480);return;}
  const toggle=event.target.closest("[data-rule-toggle]");if(toggle){const page=app.project.rules.pages[app.rulePage],index=Number(toggle.dataset.ruleToggle);page.disabled ||= [];page.disabled=page.disabled.includes(index)?page.disabled.filter(i=>i!==index):[...page.disabled,index];save("rules");render();return;}
  const remove=event.target.closest("[data-data-remove]");if(remove){const [key,index]=remove.dataset.dataRemove.split(":");app.project.data[key].splice(Number(index),1);save("data");render();sound(100);return;}
  const add=event.target.closest("[data-data-add]");if(add){const key=add.dataset.dataAdd,presets={items:{id:`item-${Date.now()}`,name:"LUCKY CHARM",icon:"♣"},currencies:{id:`currency-${Date.now()}`,name:"GEMS",icon:"◆",color:"green"},spaceTypes:"BOOST",statuses:"GLOWING",minigamePools:{id:`pool-${Date.now()}`,name:"NEW MIX",enabled:true}};app.project.data[key].push(presets[key]);save("data");render();sound(260);return;}
  if(event.target.closest("[data-test-lever]")){app.testStartedAt=app.testStartedAt?null:performance.now();app.testNow=0;render();sound(140,.14);}
});

// Change Listener for Inputs & File Uploads
root.addEventListener("change", (event) => {
  // Toy Catalogue Artwork Upload (kept in the edit draft until saved)
  const toyImageInput = event.target.closest("#toy-image-upload");
  if (toyImageInput && toyImageInput.files && toyImageInput.files[0]) {
    const file = toyImageInput.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      if (!app.editingToy?.toy) return;
      app.editingToy.toy.image = e.target.result;
      render(); playSfx("star"); toast("TOY ARTWORK READY — SAVE TO APPLY! ★");
    };
    reader.readAsDataURL(file);
    return;
  }

  // Weather Particle Image Upload (kept in the edit draft until Save Changes)
  const weatherParticleInput = event.target.closest("#weather-particle-upload");
  if (weatherParticleInput && weatherParticleInput.files && weatherParticleInput.files[0]) {
    const file = weatherParticleInput.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      if (!app.editingCommand?.cmd) return;
      app.editingCommand.cmd.particleImage = e.target.result;
      render(); playSfx("star"); toast("WEATHER PARTICLE READY — SAVE CHANGES TO APPLY! ★");
    };
    reader.readAsDataURL(file);
    return;
  }

  // Custom Space Tile Image Upload
  const spaceImgInput = event.target.closest("#space-image-upload");
  if (spaceImgInput && spaceImgInput.files && spaceImgInput.files[0]) {
    const file = spaceImgInput.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      const act = app.project.events.entries.find((entry) => entry.id === app.activeSpaceActionId) || app.project.events.entries[0];
      act.space ||= {};
      act.space.customImage = dataUrl;
      save("event"); render(); playSfx("star"); toast("SPACE IMAGE UPLOADED! ★");
    };
    reader.readAsDataURL(file);
    return;
  }

  // Character PNG Upload
  const fileInput = event.target.closest("#char-file-upload");
  if (fileInput && fileInput.files && fileInput.files[0]) {
    const file = fileInput.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      const act = app.project.events.entries.find((entry) => entry.id === app.activeSpaceActionId) || app.project.events.entries[0];
      act.characters ||= [];
      act.characters.push({
        id: `char-${Date.now()}`,
        name: file.name.replace(/\.[^/.]+$/, ""),
        role: "Custom NPC",
        isHost: false,
        sprite: dataUrl,
        icon: "🖼️",
        anchor: "center",
        animation: "float"
      });
      save("event"); render(); playSfx("star"); toast("CHARACTER PNG UPLOADED! ★");
    };
    reader.readAsDataURL(file);
    return;
  }

  // Activations Inputs
  const act = app.project.events.entries.find((entry) => entry.id === app.activeSpaceActionId) || app.project.events.entries[0];
  if (!act) return;
  act.activations ||= {};

  if (event.target.id === "act-move-land") { act.activations.movement ||= {}; act.activations.movement.land = event.target.checked; save("event"); }
  if (event.target.id === "act-move-pass") { act.activations.movement ||= {}; act.activations.movement.pass = event.target.checked; save("event"); }
  if (event.target.id === "act-move-reverse") { act.activations.movement ||= {}; act.activations.movement.reverse = event.target.checked; save("event"); }
  if (event.target.id === "act-prox-enabled") { act.activations.proximity ||= {}; act.activations.proximity.enabled = event.target.checked; save("event"); }
  if (event.target.id === "act-prox-radius") { act.activations.proximity ||= {}; act.activations.proximity.radius = Number(event.target.value); const lbl = document.querySelector("#prox-radius-label"); if (lbl) lbl.textContent = `${event.target.value} UNITS`; save("event"); }
  if (event.target.id === "act-time-round") { act.activations.timing ||= {}; act.activations.timing.round = Number(event.target.value); save("event"); }
  if (event.target.id === "act-time-interval") { act.activations.timing ||= {}; act.activations.timing.interval = Number(event.target.value); save("event"); }
  if (event.target.id === "act-time-start") { act.activations.timing ||= {}; act.activations.timing.gameStart = event.target.checked; save("event"); }
  if (event.target.id === "act-time-final") { act.activations.timing ||= {}; act.activations.timing.finalRounds = event.target.checked; save("event"); }
  if (event.target.id === "act-cond-coins") { act.activations.conditions ||= {}; act.activations.conditions.minCoins = Number(event.target.value); save("event"); }
  if (event.target.id === "act-cond-map") { act.activations.conditions ||= {}; act.activations.conditions.mapState = event.target.value; save("event"); }
});

root.addEventListener("input", (event) => {
  if (event.target.id === "act-prox-radius") {
    const lbl = document.querySelector("#prox-radius-label");
    if (lbl) lbl.textContent = `${event.target.value} UNITS`;
  }
});
// Helper: Detect whether a clip is an originating branching / decision / logic block
function isBranchingDecisionClip(clip) {
  if (!clip) return false;
  const cat = clip.category || (clip.kind === "condition" ? "logic" : "dialogue");
  return cat === "logic" || cat === "input" || clip.kind === "condition" || clip.isDecision || Boolean(clip.inputType) || Boolean(clip.condType) || (clip.label && /prompt|question|qte|decision/i.test(clip.label));
}

// Helper: Detect whether a track is a bound-to-logic secondary branch track
function isBoundBranchTrack(timeline, trackId) {
  if (!timeline || !timeline.tracks) return false;
  const tIdx = timeline.tracks.findIndex((t) => t.id === trackId);
  if (tIdx <= 0) return false;
  const track = timeline.tracks[tIdx];
  if (track.kind === "branch-false") return true;
  const prevTrack = timeline.tracks[tIdx - 1];
  return (prevTrack.clips || []).some(isBranchingDecisionClip);
}

// Helper: Shortest-route magnetic non-overlapping track placement (shifts left or right based on shortest path)
function placeClipWithoutOverlap(track, clip, desiredStart, minAllowedStart = 0) {
  clip.start = Math.max(minAllowedStart, Math.round(desiredStart * 4) / 4);
  const clipDur = clip.duration || 2.0;
  const clipEnd = clip.start + clipDur;

  // Filter other clips on the same track
  const otherClips = (track.clips || [])
    .filter((c) => c.id !== clip.id)
    .sort((a, b) => (a.start || 0) - (b.start || 0));

  const leftClips = [];
  const rightClips = [];

  for (const other of otherClips) {
    const otherDur = other.duration || 2.0;
    const otherEnd = (other.start || 0) + otherDur;
    const isOverlapping = Math.max(clip.start, other.start || 0) < Math.min(clipEnd, otherEnd);

    if (!isOverlapping) {
      if ((other.start || 0) < clip.start) {
        leftClips.push(other);
      } else {
        rightClips.push(other);
      }
      continue;
    }

    // Overlapping clip: calculate left vs right shift distance
    const targetLeftStart = clip.start - otherDur;
    const distLeft = (other.start || 0) - targetLeftStart; // distance to move left
    const targetRightStart = clipEnd;
    const distRight = targetRightStart - (other.start || 0); // distance to move right

    const canShiftLeft = targetLeftStart >= minAllowedStart;

    // Move in the direction of shortest distance
    if (canShiftLeft && distLeft < distRight) {
      other.start = Math.round(targetLeftStart * 4) / 4;
      leftClips.push(other);
    } else {
      other.start = Math.round(targetRightStart * 4) / 4;
      rightClips.push(other);
    }
  }

  // Resolve leftward cascades (working backwards from clip.start)
  leftClips.sort((a, b) => (a.start || 0) - (b.start || 0));
  let rightBoundary = clip.start;
  for (let i = leftClips.length - 1; i >= 0; i--) {
    const lClip = leftClips[i];
    const lDur = lClip.duration || 2.0;
    if ((lClip.start || 0) + lDur > rightBoundary) {
      lClip.start = Math.round((rightBoundary - lDur) * 4) / 4;
    }
    rightBoundary = lClip.start;
  }

  // If left cascading pushed below minAllowedStart, shift left clips forward
  if (leftClips.length && leftClips[0].start < minAllowedStart) {
    let leftCursor = minAllowedStart;
    for (let i = 0; i < leftClips.length; i++) {
      leftClips[i].start = Math.round(leftCursor * 4) / 4;
      leftCursor = leftClips[i].start + (leftClips[i].duration || 2.0);
    }
    if (leftCursor > clip.start) {
      clip.start = Math.round(leftCursor * 4) / 4;
    }
  }

  // Resolve rightward cascades (working forwards from clip.start + clip.duration)
  rightClips.sort((a, b) => (a.start || 0) - (b.start || 0));
  let leftBoundary = clip.start + (clip.duration || 2.0);
  for (let i = 0; i < rightClips.length; i++) {
    const rClip = rightClips[i];
    const rDur = rClip.duration || 2.0;
    if ((rClip.start || 0) < leftBoundary) {
      rClip.start = Math.round(leftBoundary * 4) / 4;
    }
    leftBoundary = rClip.start + rDur;
  }

  track.clips.sort((a, b) => (a.start || 0) - (b.start || 0));
}

// Helper: When logic moves forward, push branch events to prevent entering inactive area
function pushDependentBranchEvents(timeline, logicClip) {
  const logicStart = logicClip.start || 0;
  const parentTrackIdx = timeline.tracks.findIndex((t) => (t.clips || []).some((c) => c.id === logicClip.id));
  if (parentTrackIdx >= 0 && parentTrackIdx + 1 < timeline.tracks.length) {
    const branchTrack = timeline.tracks[parentTrackIdx + 1];
    let cursor = logicStart;
    const sorted = (branchTrack.clips || []).sort((a, b) => (a.start || 0) - (b.start || 0));
    for (const bClip of sorted) {
      if (bClip.start < cursor) {
        bClip.start = Math.round(cursor * 4) / 4;
      }
      cursor = bClip.start + (bClip.duration || 2.0);
    }
  }
}

// Double-Click on Timeline Clip opens Action Inspector Modal
root.addEventListener("dblclick", (event) => {
  const timelineClip = event.target.closest(".timeline-clip-block");
  if (timelineClip) {
    const clipId = timelineClip.dataset.clipId;
    const act = app.project.events.entries.find((e) => e.id === app.activeSpaceActionId) || app.project.events.entries[0];
    const found = findClipInTimeline(act?.timeline, clipId);
    if (found) {
      app.editingCommand = { id: clipId, cmd: structuredClone(found.clip) };
      render();
      playSfx("dialogue-blip");
    }
  }
});

root.addEventListener("pointerdown",(event)=>{
  // Video Editor Timeline Clip Dragging (Space Actions) with Multi-Select
  const timelineClip = event.target.closest(".timeline-clip-block");
  if (timelineClip && !event.target.closest(".clip-mini-btn, .clip-trim-handle, button") && event.button === 0) {
    const act = app.project.events.entries.find((e) => e.id === app.activeSpaceActionId) || app.project.events.entries[0];
    const clipId = timelineClip.dataset.clipId;
    const trackId = timelineClip.dataset.trackId;
    app.timelineSelectedClipIds ||= new Set();

    if (event.shiftKey || event.ctrlKey || event.metaKey) {
      if (app.timelineSelectedClipIds.has(clipId)) {
        app.timelineSelectedClipIds.delete(clipId);
      } else {
        app.timelineSelectedClipIds.add(clipId);
      }
    } else {
      if (!app.timelineSelectedClipIds.has(clipId)) {
        app.timelineSelectedClipIds.clear();
        app.timelineSelectedClipIds.add(clipId);
      }
    }
    app.timelineSelectedClipId = clipId;

    const found = findClipInTimeline(act?.timeline, clipId);
    if (found) {
      // Snapshot of all selected clips for group dragging
      const groupItems = [];
      for (const sId of app.timelineSelectedClipIds) {
        const itemFound = findClipInTimeline(act?.timeline, sId);
        if (itemFound) {
          const tIdx = act.timeline.tracks.findIndex((t) => t.id === itemFound.track.id);
          groupItems.push({
            clipId: sId,
            trackId: itemFound.track.id,
            trackIndex: tIdx,
            originalStart: itemFound.clip.start || 0,
            duration: itemFound.clip.duration || 2.0
          });
        }
      }

      app.timelineDraggingClip = {
        pointerId: event.pointerId,
        primaryClipId: clipId,
        primaryTrackId: trackId,
        primaryOriginalStart: found.clip.start || 0,
        groupItems,
        startX: event.clientX,
        startY: event.clientY,
        moved: false,
        targetTrackId: trackId
      };

      timelineClip.setPointerCapture?.(event.pointerId);
      timelineClip.classList.add("is-dragging");
      groupItems.forEach((g) => {
        const node = document.querySelector(`[data-clip-id="${g.clipId}"]`);
        if (node) node.classList.add("is-group-dragging");
      });
      event.preventDefault();
      return;
    }
  }

  // Scene Editor Clip Dragging
  const clip=event.target.closest("[data-clip]");
  if(clip&&app.editor==="scene"&&event.button===0){const scene=app.project.scenes.entries[0],item=scene.clips.find(entry=>entry.id===clip.dataset.clip),track=clip.parentElement;if(item&&track){app.draggingClip={pointerId:event.pointerId,id:item.id,startX:event.clientX,originalStart:item.start,duration:scene.duration,width:track.getBoundingClientRect().width,before:structuredClone(app.project),moved:false};app.selectedClip=item.id;clip.setPointerCapture?.(event.pointerId);clip.classList.add("dragging");event.preventDefault();}return;}
  const viewport=event.target.closest("#map-viewport"),board=event.target.closest("#map-board");if(!viewport||!board)return;
  const space=event.target.closest("[data-space]");
  if(space&&app.project.map.tool==="space"&&event.button===0){const item=app.project.map.spaces.find(entry=>entry.id===Number(space.dataset.space));if(item){app.draggingSpace={pointerId:event.pointerId,id:item.id,before:structuredClone(app.project),moved:false};space.setPointerCapture?.(event.pointerId);event.preventDefault();}return;}
  if(app.project.map.tool==="pan"||app.spaceHeld||event.button===1||event.button===2){app.panning={pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,panX:app.mapPan.x,panY:app.mapPan.y,moved:false};app.panMoved=false;viewport.setPointerCapture?.(event.pointerId);viewport.classList.add("grabbing");event.preventDefault();}
});

root.addEventListener("pointermove",(event)=>{
  // Video Editor Timeline Clip Dragging Movement (Group support)
  if (app.timelineDraggingClip?.pointerId === event.pointerId) {
    const drag = app.timelineDraggingClip;
    const act = app.project.events.entries.find((e) => e.id === app.activeSpaceActionId) || app.project.events.entries[0];
    const pxPerSec = app.timelineZoom || 100;
    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;
    const deltaSec = deltaX / pxPerSec;

    if (Math.abs(deltaX) > 4 || Math.abs(deltaY) > 4) {
      drag.moved = true;
    }

    // Live update DOM position for all selected items in the group
    drag.groupItems.forEach((item) => {
      const newStart = Math.max(0, Math.round((item.originalStart + deltaSec) * 4) / 4);
      const clipNode = document.querySelector(`[data-clip-id="${item.clipId}"]`);
      if (clipNode) {
        clipNode.style.left = `${newStart * pxPerSec}px`;
      }
    });

    // Detect target track under cursor (prevent targeting secondary branch track if moving logic)
    const elements = document.elementsFromPoint(event.clientX, event.clientY) || [];
    const hoveredLane = elements.find((el) => el.classList && el.classList.contains("timeline-track-lane"));
    document.querySelectorAll(".timeline-track-lane.drag-target-hover").forEach((el) => el.classList.remove("drag-target-hover"));
    if (hoveredLane && hoveredLane.dataset.trackId) {
      const isBranchTrack = isBoundBranchTrack(act?.timeline, hoveredLane.dataset.trackId);
      const isDraggingBranchLogic = drag.groupItems.some((item) => {
        const f = findClipInTimeline(act?.timeline, item.clipId);
        return f && isBranchingDecisionClip(f.clip);
      });
      if (!(isBranchTrack && isDraggingBranchLogic)) {
        drag.targetTrackId = hoveredLane.dataset.trackId;
        hoveredLane.classList.add("drag-target-hover");
      }
    }
    return;
  }

  if(app.draggingClip?.pointerId===event.pointerId){const drag=app.draggingClip,item=app.project.scenes.entries[0].clips.find(entry=>entry.id===drag.id),node=document.querySelector(`[data-clip="${drag.id}"]`);if(!item||!node)return;const pixels=event.clientX-drag.startX,next=Math.max(0,Math.min(drag.duration-item.duration,Math.round((drag.originalStart+pixels/drag.width*drag.duration)*4)/4));if(Math.abs(pixels)>3)drag.moved=true;item.start=next;node.style.left=`${next/drag.duration*100}%`;return;}
  if(app.draggingSpace?.pointerId===event.pointerId){const board=document.querySelector("#map-board"),button=document.querySelector(`[data-space="${app.draggingSpace.id}"]`);if(!board||!button)return;const point=boardPoint(board,event),item=app.project.map.spaces.find(entry=>entry.id===app.draggingSpace.id);if(Math.abs(event.movementX)+Math.abs(event.movementY)>0)app.draggingSpace.moved=true;item.x=point.x;item.y=point.y;button.style.left=`${point.x}%`;button.style.top=`${point.y}%`;return;}
  if(app.panning?.pointerId!==event.pointerId)return;const viewport=document.querySelector("#map-viewport"),board=document.querySelector("#map-board");if(!viewport||!board)return;const dx=event.clientX-app.panning.startX,dy=event.clientY-app.panning.startY,maxX=viewport.clientWidth*(app.mapZoom-1)/2,maxY=viewport.clientHeight*(app.mapZoom-1)/2;app.mapPan={x:Math.max(-maxX,Math.min(maxX,app.panning.panX+dx)),y:Math.max(-maxY,Math.min(maxY,app.panning.panY+dy))};if(Math.abs(dx)+Math.abs(dy)>4){app.panning.moved=true;app.panMoved=true;}board.style.transform=`translate(${app.mapPan.x}px,${app.mapPan.y}px) scale(${app.mapZoom})`;
});

root.addEventListener("pointerup",(event)=>{
  // Video Editor Timeline Clip Drop (Group & Shortest-Route Magnetic Displacement)
  if (app.timelineDraggingClip?.pointerId === event.pointerId) {
    const drag = app.timelineDraggingClip;
    app.timelineDraggingClip = null;
    document.querySelectorAll(".timeline-track-lane.drag-target-hover").forEach((el) => el.classList.remove("drag-target-hover"));
    document.querySelectorAll(".timeline-clip-block.is-dragging, .timeline-clip-block.is-group-dragging").forEach((el) => {
      el.classList.remove("is-dragging", "is-group-dragging");
    });

    if (drag.moved) {
      const act = app.project.events.entries.find((e) => e.id === app.activeSpaceActionId) || app.project.events.entries[0];
      const pxPerSec = app.timelineZoom || 100;
      const deltaX = event.clientX - drag.startX;
      const deltaSec = deltaX / pxPerSec;

      // Track index offset for primary clip
      const primaryTrackIdx = act.timeline.tracks.findIndex((t) => t.id === drag.primaryTrackId);
      const targetTrackIdx = act.timeline.tracks.findIndex((t) => t.id === drag.targetTrackId);
      const trackOffset = (targetTrackIdx >= 0 && primaryTrackIdx >= 0) ? (targetTrackIdx - primaryTrackIdx) : 0;

      const affectedTracks = new Set();
      const movedLogicClips = [];

      // Move each clip in the selected group
      drag.groupItems.forEach((item) => {
        const found = findClipInTimeline(act?.timeline, item.clipId);
        if (found) {
          // Compute new target track for this item
          let destTrackIdx = item.trackIndex + trackOffset;
          destTrackIdx = Math.max(0, Math.min(act.timeline.tracks.length - 1, destTrackIdx));
          let destTrack = act.timeline.tracks[destTrackIdx];

          // Originating logic / decision blocks cannot be moved down into bound branch tracks!
          if (isBranchingDecisionClip(found.clip) && isBoundBranchTrack(act.timeline, destTrack.id)) {
            destTrack = found.track; // protect and retain original track
          }

          // Compute new start
          let newStart = Math.max(0, Math.round((item.originalStart + deltaSec) * 4) / 4);

          // Clamping to pre-logic zone on branch tracks
          let minAllowed = 0;
          if (destTrack.kind === "branch-false" || isBoundBranchTrack(act.timeline, destTrack.id)) {
            for (const tr of act.timeline.tracks) {
              for (const cl of tr.clips || []) {
                if (isBranchingDecisionClip(cl)) minAllowed = Math.max(minAllowed, cl.start || 0);
              }
            }
            newStart = Math.max(minAllowed, newStart);
          }

          // Remove from old track
          found.track.clips.splice(found.clipIndex, 1);
          affectedTracks.add(found.track);

          // Place magnetically on new track using shortest route displacement (left or right)
          destTrack.clips.push(found.clip);
          placeClipWithoutOverlap(destTrack, found.clip, newStart, minAllowed);
          affectedTracks.add(destTrack);

          if (isBranchingDecisionClip(found.clip)) {
            movedLogicClips.push(found.clip);
          }
        }
      });

      // If logic clips moved forward, push dependent branch events
      movedLogicClips.forEach((lClip) => {
        pushDependentBranchEvents(act.timeline, lClip);
      });

      // Expand duration if needed
      const maxEnd = Math.max(...act.timeline.tracks.flatMap((t) => (t.clips || []).map((c) => (c.start || 0) + (c.duration || 2))), 14);
      act.timeline.duration = Math.max(16, Math.ceil(maxEnd + 4));

      syncTimelineToCommands(act);
      save("event"); render(); playSfx("star"); toast("CLIPS MOVED ON TIMELINE! ★");
    }
    return;
  }

  if(app.draggingClip?.pointerId===event.pointerId){const drag=app.draggingClip;app.draggingClip=null;if(drag.moved){app.history.push(drag.before);app.history=app.history.slice(-30);app.future=[];app.ignoreClipClick=true;save("scene");sound(540,.08);render();setTimeout(()=>{app.ignoreClipClick=false;},0);}return;}
  if(app.draggingSpace?.pointerId===event.pointerId){const drag=app.draggingSpace;app.draggingSpace=null;if(drag.moved){app.history.push(drag.before);app.history=app.history.slice(-30);app.future=[];app.selectedSpace=drag.id;save("map");sound(180,.1);render();}return;}
  if(app.panning?.pointerId!==event.pointerId)return;const moved=app.panning.moved;app.panning=null;document.querySelector("#map-viewport")?.classList.remove("grabbing");if(moved)setTimeout(()=>{app.panMoved=false;},0);
});
root.addEventListener("wheel",(event)=>{if(!event.target.closest("#map-viewport"))return;event.preventDefault();app.mapZoom=Math.max(1,Math.min(3,app.mapZoom+(event.deltaY<0?.12:-.12)));render();},{passive:false});
root.addEventListener("contextmenu",(event)=>{if(event.target.closest("#map-viewport"))event.preventDefault();});
async function renderRoute() {
  const routeBoard = boardIdFromPath();
  if (routeBoard && routeBoard !== app.project.boardProjects.selectedId) {
    try { app.project = await api(`/api/party/studio/boards/${routeBoard}/select`, { method: "POST" }); app.history=[];app.future=[]; }
    catch (error) { history.replaceState({}, "", "/party/boards"); toast(error.message); }
  }
  render();
}
window.addEventListener("popstate",renderRoute);
document.addEventListener("keydown",(event)=>{
  if(["Enter"," "].includes(event.key)&&document.activeElement?.hasAttribute("data-trigger-upload")){
    event.preventDefault();
    const inputId=document.activeElement.getAttribute("data-trigger-upload");
    document.getElementById(inputId)?.click();
    return;
  }
  if(event.key==="Escape"&&app.editingCommand){event.preventDefault();app.editingCommand=null;render();return;}
  if(event.key==="Escape"&&app.actionPickerOpen){event.preventDefault();app.actionPickerOpen=false;render();return;}
  if(event.key==="Escape"&&app.previewingCutscene){event.preventDefault();app.previewingCutscene=false;render();return;}
  if(event.code==="Space"&&app.editor==="map"&&!event.repeat){app.spaceHeld=true;document.querySelector("#map-viewport")?.classList.add("pan-ready");event.preventDefault();return;}
  if(event.key.toLowerCase()==="w"&&app.editor==="map"){event.preventDefault();app.workshopsOpen=!app.workshopsOpen;render();sound(app.workshopsOpen?620:320);return;}

  const nodes=[...document.querySelectorAll("[data-nav]")].filter(node=>!node.disabled&&node.offsetParent!==null);
  if(!nodes.length)return;
  const current=Math.max(0,nodes.indexOf(document.activeElement));
  if(["ArrowRight","ArrowDown"].includes(event.key)){event.preventDefault();nodes[(current+1)%nodes.length].focus();}
  else if(["ArrowLeft","ArrowUp"].includes(event.key)){event.preventDefault();nodes[(current-1+nodes.length)%nodes.length].focus();}
  else if(event.key==="Escape"&&app.pathFrom!=null){event.preventDefault();app.pathFrom=null;render();sound(220);}
  else if(event.key==="Escape"&&app.workshopsOpen){event.preventDefault();app.workshopsOpen=false;render();}
  else if(event.key==="Escape"&&app.editor){event.preventDefault();go(`/party/board/${app.project.boardProjects.selectedId}`);}
  else if(event.key==="Escape"&&boardIdFromPath()){event.preventDefault();go("/party/boards");}
});
document.addEventListener("keyup",(event)=>{
  if(event.code==="Space"){app.spaceHeld=false;document.querySelector("#map-viewport")?.classList.remove("pan-ready");}
});
(async()=>{
  try{
    app.project=await api("/api/party/studio");
    await renderRoute();
  }catch(error){
    root.innerHTML=`<section class="studio-loading"><span>!</span><h1>Studio machine jammed</h1><p>${html(error.message)}</p></section>`;
  }
})();
