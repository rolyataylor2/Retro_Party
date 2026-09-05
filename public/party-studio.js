import { destroyBoardRenderers, mountBoardRenderer, mountTimelinePreviewRenderer } from "./board-renderer.js";
import { ActorAnimationRenderer, defaultActorAnimation, ensureActorAnimations, sampleActorAnimation } from "./actor-animation-renderer.js";
import { RagdollEditor, ensureRagdoll } from "./ragdoll-editor.js";
import { PixiRagdollRenderer } from "./pixi-ragdoll-renderer.js";

const root = document.querySelector("#party-studio");
const toastNode = document.querySelector("#studio-toast");
const sections = { map: "map", actors: "actors", scene: "scenes", event: "events", rules: "rules", data: "data", effects: "data", placements: "map" };
const stationMeta = {
  map: { name: "SPACE/PATH EDITOR", kicker: "DRAFTING TABLE", icon: "✥", copy: "Place spaces, shape paths, and arrange the board.", color: "blue" },
  actors: { name: "HOST & ACTORS", kicker: "CAST & CHARACTERS", icon: "🎭", copy: "Design board-wide actors, manage animations and ragdolls, and assign the host.", color: "orange" },
  scene: { name: "SCENE DIRECTOR", kicker: "MOVIE SET", icon: "🎬", copy: "Stage overlapping action on a toy-train timeline.", color: "purple" },
  event: { name: "SPACE ACTIONS", kicker: "CUTSCENES & SCRIPTS", icon: "⚡", copy: "Catalog, design spaces, cast characters, and script interactive cutscenes.", color: "orange" },
  rules: { name: "RULE BOOK", kicker: "LAWS OF THE PARTY", icon: "▤", copy: "Decide what the Director queues next.", color: "red" },
  data: { name: "TOY CATALOGUE", kicker: "ITEMS & COLLECTIBLES", icon: "🧸", copy: "Design coins, stars, dice blocks, power-ups, cards, food, and healing items.", color: "green" },
  effects: { name: "SPECIAL EFFECTS", kicker: "PARTICLES, LIGHT & AUDIO", icon: "✨", copy: "Create reusable particles, glow, distortion, lighting, music, and sounds.", color: "purple" },
  placements: { name: "SFX PLACEMENTS", kicker: "BOARD EFFECT LAYOUT", icon: "✺", copy: "Place reusable special effects directly onto the board.", color: "cyan" },
  test: { name: "TEST LAB", kicker: "QUEUE CONTROL ROOM", icon: "⚙", copy: "Pull the lever and watch every queue card move.", color: "yellow" },
};

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
  pathFrom: null, draggingClip: null, draggingSpace: null, ignoreClipClick: false, mapZoom: 1, mapPan: { x: 0, y: 0 },
  panning: null, panMoved: false, spaceHeld: false, mapRotation:0, rulePage: "flow", workshopsOpen: false, saveTimers: {},
  testTimer: null, testStartedAt: null, testNow: 0, audio: null, history: [], future: [],
  // Space Actions Studio State
  spaceActionCatalogView: true, spaceActionFilter: "all", spaceActionTab: "visuals",
  confirmDeleteSpaceAction: null,
  actionPickerOpen: false, actionPickerTarget: { parentId: null, branchKey: null, index: -1 }, actionPickerTab: "dialogue",
  editingCommand: null, playerSelectorEditor: null, valuePickerEditor: null, particlePickerEditor: null,
  previewingCutscene: false, previewStep: 0, previewTimer: null, previewState: null,
  // Video Editor Multi-Track Timeline State
  timelinePlaying: false, timelinePlayhead: 0, timelineZoom: 100, timelineScrollLeft: 0, timelineTriggeringPlayer: 1,
  timelineSelectedClipId: null, timelineActiveTrackId: "track-main",
  timelineDraggingPlayhead: false, timelineDraggingClip: null, timelineTimer: null,
  timelinePreviewWaiting: null, timelinePreviewHandled: new Set(), timelinePreviewBranches: {}, editingActivationId: null,
  toyCategory: "all", editingToy: null,
  boardEditorDrawerOpen: false, mapSettingsOpen: false, mapSettingsTab: "details", selectedSpaces: new Set(), activeEffectId: null, placementEffectId: null, placementInspectorId: null, effectPresetMenu: false, newEffectMenu: false, effectPropertyTab: "identity",
  mapInspector: null, mapInspectorTab: "space", mapHold: null, mapHoldMenu: null, suppressMapClick: false,
  pathPickFrom: null, editingPath: null, pathPointMenu: null, pathPointHoldMenu: null, draggingPathPoint: null, mapPathHold: null,
  actorEditorId: null, actorEditorTab: "ragdoll-animations", actorAnimationId: null, actorPreviewTime: 0, actorPreviewPlaying: false, actorKeyframeIndex: 0, actorKeyframeSelected: false,
};

if (location.pathname === "/party-studio.html") history.replaceState({}, "", "/party");

const html = (value) => String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
function ragdollAnimations(actor){return actor?ensureRagdoll(actor).animations:[];}
const MAP_MUSIC = [{value:"",label:"No music"},{value:"/assets/music/menu_main.mp3",label:"Main Menu"},{value:"/assets/music/title_screen.mp3",label:"Title Screen"}];
async function api(path, options = {}) {
  const config = { ...options, headers: { "Content-Type": "application/json", ...(options.headers || {}) } };
  if (config.body && typeof config.body !== "string") config.body = JSON.stringify(config.body);
  const response = await fetch(path, config), data = await response.json();
  if (!response.ok || data.error) { const error = new Error(data.error || `Request failed (${response.status})`); console.error("Party Studio API error", { path, status: response.status, error }); throw error; }
  return data;
}
function toast(message) { toastNode.textContent = message; toastNode.classList.add("show"); clearTimeout(toast.timer); toast.timer = setTimeout(() => toastNode.classList.remove("show"), 1800); }
function sound(note = 440, duration = .06) {
  try { const Audio = window.AudioContext || window.webkitAudioContext; app.audio ||= new Audio(); const oscillator = app.audio.createOscillator(), gain = app.audio.createGain(); oscillator.frequency.value = note; oscillator.type = "square"; gain.gain.setValueAtTime(.035, app.audio.currentTime); gain.gain.exponentialRampToValueAtTime(.001, app.audio.currentTime + duration); oscillator.connect(gain).connect(app.audio.destination); oscillator.start(); oscillator.stop(app.audio.currentTime + duration); } catch {}
}
function editorFromPath() { return location.pathname.match(/^\/party\/(?:editor|board\/[a-z0-9-]+\/editor)\/(map|actors|scene|event|rules|data|effects|placements|test)\/?$/)?.[1] || null; }
function boardIdFromPath() { return location.pathname.match(/^\/party\/board\/([a-z0-9-]+)/)?.[1] || null; }
function boardEditorPath(editor) { return `/party/board/${app.project.boardProjects.selectedId}/editor/${editor}`; }
function migrateGhostSpaceActors(project) {
  // Rainshadow Reach historically kept its cast on the Ghost Space event. Bring
  // those full actor records into the board roster once, preserving IDs so the
  // existing space action continues to reference the same characters.
  const boardId = project?.id || project?.project?.id || project?.boardProjects?.selectedId;
  if (!project || boardId !== "rainshadow-reach" || !Array.isArray(project.events?.entries)) return false;
  const ghostSpace = project.events.entries.find((entry) => entry.id === "ghost-space" || /ghost\s+space/i.test(entry.name || ""));
  const cast = Array.isArray(ghostSpace?.characters) ? ghostSpace.characters.filter((actor) => actor && actor.id) : [];
  if (!cast.length) return false;
  const roster = Array.isArray(project.actors) ? project.actors : (project.actors = []);
  const existing = new Set(roster.map((actor) => String(actor.id)));
  let migrated = false;
  for (const source of cast) {
    if (existing.has(String(source.id))) continue;
    const actor = structuredClone(source);
    ensureActorAnimations(actor);
    roster.push(actor);
    existing.add(String(actor.id));
    migrated = true;
  }
  // An imported event host is the most useful board host. Keep existing actors,
  // but make sure the roster exposes exactly one stage host.
  const importedHost = cast.find((actor) => actor.isHost && existing.has(String(actor.id)));
  if (importedHost && roster.some((actor) => String(actor.id) === String(importedHost.id))) {
    const hostId = String(importedHost.id);
    const hostChanged = roster.some((actor) => Boolean(actor.isHost) !== (String(actor.id) === hostId));
    roster.forEach((actor) => { actor.isHost = String(actor.id) === hostId; });
    migrated ||= hostChanged;
  }
  return migrated;
}
function ensureBoardActors(project = app.project) {
  if (!project) return [];
  if (!Array.isArray(project.actors)) {
    project.actors = [
      { id: "host-1", name: "Host Guide", role: "Host", isHost: true, icon: "✦", sprite: "", anchor: "center", animation: "float" }
    ];
  }
  if (!project.actors.length) {
    project.actors.push({ id: "host-1", name: "Host Guide", role: "Host", isHost: true, icon: "✦", sprite: "", anchor: "center", animation: "float" });
  }
  if (!project.actors.some(a => a.isHost)) {
    project.actors[0].isHost = true;
  }
  if (migrateGhostSpaceActors(project) && project === app.project) app.actorMigrationPendingSave = true;
  return project.actors;
}
function go(path) {
  const wasOverview = !app.editor && !boardIdFromPath();
  const wasMapEditor = app.editor === "map";
  history.pushState({}, "", path);
  app.editor = editorFromPath();
  if (app.editor === "map" || wasMapEditor) { app.mapZoom = 1; app.mapPan = { x: 0, y: 0 }; app.mapRotation=0; }
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
function frame(meta, content, extra = "", options = {}) {
  const compact = options.compact === true;
  const header = compact ? "" : `<header class="studio-bar"><button data-nav data-go="/party/board/${app.project.boardProjects.selectedId}" class="studio-back">◀ BOARD</button><div class="studio-mini-logo"><strong>STARLIGHT</strong><small>PARTY STUDIO</small></div><div class="studio-station-title"><small>${meta.kicker}</small><b>${meta.name}</b></div><nav class="studio-quick"><button data-nav data-undo ${app.history.length ? "" : "disabled"}>↶ <span>UNDO</span></button><button data-nav data-redo ${app.future.length ? "" : "disabled"}>↷ <span>REDO</span></button></nav></header>`;
  return `<section class="studio-shell editor-${meta.color} ${compact ? "compact-editor-frame" : ""}">${header}${content}<footer class="studio-help"><span>◀▶ MOVE</span><span><i class="key-a">A</i> CHOOSE</span><span><i class="key-b">B</i> BACK</span>${extra}</footer></section>`;
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
  return `<section class="studio-hub"><div class="confabulator-stage"><div class="confabulator-screen"><header class="hub-title"><button data-nav data-go="/party" class="maker-back">◀ MAKERS</button><small>BOARD MAKER</small><h1>CHOOSE A BOARD</h1><p>Every board keeps its own map, scenes, actions, rules, and toys.</p></header><div class="board-picker-grid">${boards.map((board) => `<button data-nav data-select-board="${html(board.id)}" class="board-picker-card"><span class="board-picker-art pixi-board-host" data-pixi-board-preview="${html(board.id)}"></span><b>${html(board.name)}</b><small>${board.map.spaces.length} SPACES · ${board.events.entries.length} ACTIONS</small></button>`).join("")}<button data-nav data-create-board class="board-picker-card create-board"><span>＋</span><b>CREATE NEW BOARD</b><small>START WITH A GREEN GRID</small></button></div></div></div></section>`;
}
function mapSettingsModal(){if(!app.mapSettingsOpen)return "";const map=app.project.map,tab=app.mapSettingsTab,defaults={spaceSize:3,spaceType:"blue",spaceShape:"oval",spaceRotation:0,pathWidth:5,pathPattern:"solid",pathCurve:"hard",pathColor:"#fff0a9",pathOpacity:1,pathBorder:true,pathHidden:false,pathDirection:"both",...(map.defaults||{})};const option=(value,current)=>`<option value="${value}" ${current===value?"selected":""}>${value.toUpperCase()}</option>`;return `<div class="map-settings-backdrop"><section class="map-settings-dialog"><header><div><small>BOARD OVERVIEW</small><b>MAP SETTINGS</b></div><button data-close-map-settings>×</button></header><nav>${[["details","DETAILS"],["image","UPLOAD"],["appearance","DEFAULTS"],["audio","AUDIO"]].map(([id,label])=>`<button data-map-settings-tab="${id}" class="${tab===id?"active":""}">${label}</button>`).join("")}</nav><div class="map-settings-body">${tab==="details"?`<label>MAP NAME<input data-map-setting="name" value="${html(map.name)}" maxlength="80"></label><label>DESCRIPTION<textarea data-map-setting="description" maxlength="180">${html(map.description||"")}</textarea></label>`:tab==="image"?`<div class="map-image-setting-section"><label class="map-image-label">CURRENT MAP IMAGE</label>${map.image?`<div class="map-image-preview-card"><div class="map-image-thumb-box"><img src="${map.image}" alt="Current Map Artwork" class="map-image-thumb" /></div><div class="map-image-meta"><b>${map.image.startsWith("data:")?"Custom Uploaded Artwork":html(map.image)}</b><small>${map.image.startsWith("data:")?"Saved directly in Board Project":"Asset Path"}</small><div class="map-image-actions"><button type="button" data-nav data-trigger-upload="map-image-upload" class="map-image-btn primary">⬆ REPLACE IMAGE</button><button type="button" data-remove-map-image class="map-image-btn danger">✕ REMOVE / USE GRID</button></div></div></div>`:`<div class="map-image-empty-card"><span class="empty-icon">🗺️</span><div><b>NO MAP ARTWORK LOADED</b><small>The board is currently displaying the default green phosphor grid.</small></div><button type="button" data-nav data-trigger-upload="map-image-upload" class="map-image-btn primary">⬆ UPLOAD MAP IMAGE</button></div>`}<input type="file" id="map-image-upload" accept="image/png,image/webp,image/gif,image/jpeg,image/svg+xml" style="display:none;"><hr><label class="map-image-label">FOREGROUND LAYER</label><p>This full-board transparent image renders above characters and objects while remaining locked to the map.</p>${map.foreground?`<div class="map-image-preview-card"><div class="map-image-thumb-box"><img src="${map.foreground}" alt="Foreground layer" class="map-image-thumb"></div><div class="map-image-meta"><b>FOREGROUND LOADED</b><div class="map-image-actions"><button type="button" data-trigger-upload="map-foreground-upload" class="map-image-btn primary">⬆ REPLACE FOREGROUND</button><button type="button" data-remove-map-foreground class="map-image-btn danger">✕ REMOVE</button></div></div></div>`:`<button type="button" data-trigger-upload="map-foreground-upload" class="map-image-btn primary">⬆ UPLOAD FOREGROUND</button>`}<input type="file" id="map-foreground-upload" accept="image/png,image/webp,image/gif,image/jpeg" style="display:none;"><div class="map-image-url-row"><label>IMAGE URL / ASSET PATH<input data-map-setting="image" value="${html(map.image||"")}" placeholder="/assets/rainshadow-reach.png or data:image/..." maxlength="15000000"></label></div><p>Upload a PNG, WebP, JPEG, or GIF image to serve as the map backdrop. Board spaces and paths render directly over this artwork.</p></div>`:tab==="appearance"?`<fieldset><legend>SPACE DEFAULTS</legend><label>TYPE<select data-map-default="spaceType">${["blue","red","lucky","event","start","shop","duel","warp","trap"].map(value=>option(value,defaults.spaceType)).join("")}</select></label><label>SHAPE<select data-map-default="spaceShape">${["oval","round","star","diamond","hex","shield"].map(value=>option(value,defaults.spaceShape)).join("")}</select></label><label>SIZE <output>${Number(defaults.spaceSize).toFixed(2)}</output><input type="range" min=".25" max="5" step=".25" data-map-default="spaceSize" value="${defaults.spaceSize}"></label><label>ROTATION<input type="number" min="-180" max="180" data-map-default="spaceRotation" value="${defaults.spaceRotation}"></label><label>OUTLINE WIDTH<input type="range" min="0" max="16" step=".5" data-map-default="spaceBorderWidth" value="${defaults.spaceBorderWidth??3}"></label><label>OUTLINE COLOR<input type="color" data-map-default="spaceBorderColor" value="${defaults.spaceBorderColor??"#ffffff"}"></label><label>OUTLINE OPACITY<input type="range" min="0" max="1" step=".05" data-map-default="spaceBorderOpacity" value="${defaults.spaceBorderOpacity??1}"></label><label class="setting-check"><input type="checkbox" data-map-default="spaceShadow" ${defaults.spaceShadow?"checked":""}> DROP SHADOW</label><label>SHADOW COLOR<input type="color" data-map-default="spaceShadowColor" value="${defaults.spaceShadowColor??"#000000"}"></label><label>SHADOW OPACITY<input type="range" min="0" max="1" step=".05" data-map-default="spaceShadowOpacity" value="${defaults.spaceShadowOpacity??.45}"></label><label>SHADOW BLUR<input type="range" min="0" max="30" step="1" data-map-default="spaceShadowBlur" value="${defaults.spaceShadowBlur??8}"></label><label>SHADOW OFFSET<input type="range" min="-30" max="30" step="1" data-map-default="spaceShadowOffset" value="${defaults.spaceShadowOffset??5}"></label></fieldset><fieldset><legend>PATH DEFAULTS</legend><label>WIDTH <output>${Number(defaults.pathWidth).toFixed(2)}</output><input type="range" min=".25" max="20" step=".25" data-map-default="pathWidth" value="${defaults.pathWidth}"></label><label>STYLE<select data-map-default="pathPattern">${["solid","dashed","dotted"].map(value=>option(value,defaults.pathPattern)).join("")}</select></label><label>SHAPE<select data-map-default="pathCurve">${["hard","smooth"].map(value=>option(value,defaults.pathCurve)).join("")}</select></label><label>DIRECTION<select data-map-default="pathDirection">${["both","forward","reverse"].map(value=>option(value,defaults.pathDirection)).join("")}</select></label><label>COLOR<input type="color" data-map-default="pathColor" value="${html(defaults.pathColor)}"></label><label>OPACITY<input type="range" min="0" max="1" step=".05" data-map-default="pathOpacity" value="${defaults.pathOpacity}"></label><label class="setting-check"><input type="checkbox" data-map-default="pathBorder" ${defaults.pathBorder?"checked":""}> SIDE BORDERS</label><label class="setting-check"><input type="checkbox" data-map-default="pathHidden" ${defaults.pathHidden?"checked":""}> INVISIBLE BY DEFAULT</label></fieldset><p>Resetting an individual space or path makes it inherit these values.</p>`:`<label>BACKGROUND MUSIC<select data-map-setting="music">${MAP_MUSIC.map(track=>`<option value="${track.value}" ${map.music===track.value?"selected":""}>${track.label}</option>`).join("")}</select></label><button type="button" data-preview-map-music>▶ PREVIEW TRACK</button>`}</div></section></div>`;}
function boardShowcase() {
  const map = app.project.map;
  const editors = Object.entries(stationMeta).filter(([id]) => id !== "minigame").map(([id, meta]) => `<button data-nav data-go="${boardEditorPath(id)}" class="board-editor-link"><i>${meta.icon}</i><span><b>${meta.name}</b><small>${meta.kicker}</small></span><em>▶</em></button>`).join("");
  return `<section class="studio-shell board-showcase-shell"><header class="board-showcase-header"><button data-nav data-go="/party/boards">◀ ALL BOARDS</button><div><small>BOARD MAKER</small><h1>${html(map.name)}</h1><p>${map.spaces.length} spaces · ${app.project.events.entries.length} actions · ${app.project.data.toys?.length || 0} toys</p></div><button class="map-settings-button" data-open-map-settings>⚙ MAP SETTINGS</button></header><main class="board-showcase-stage"><div class="board-showcase-map pixi-board-host" data-pixi-board="overview"></div></main><div class="board-editor-drawer ${app.boardEditorDrawerOpen ? "open" : ""}"><button data-nav data-board-editor-drawer class="board-editor-toggle"><span>${app.boardEditorDrawerOpen ? "×" : "✦"}</span><b>${app.boardEditorDrawerOpen ? "CLOSE" : "EDIT BOARD"}</b></button>${app.boardEditorDrawerOpen ? `<aside><header><small>${html(map.name)}</small><b>BOARD WORKSHOPS</b></header>${editors}</aside>` : ""}</div>${mapSettingsModal()}</section>`;
}
function pathGeometry(path, from, to) {
  const points = [{ x: from.x, y: from.y }, ...(path.points || []), { x: to.x, y: to.y }];
  if (path.render?.curve === "smooth" && points.length > 2) {
    let d = `M ${points[0].x} ${points[0].y}`;
    for (let index = 1; index < points.length - 1; index++) { const point = points[index], next = points[index + 1]; d += ` Q ${point.x} ${point.y} ${(point.x + next.x) / 2} ${(point.y + next.y) / 2}`; }
    d += ` T ${points.at(-1).x} ${points.at(-1).y}`;
    return { tag: "path", attrs: `d="${d}"` };
  }
  return { tag: "polyline", attrs: `points="${points.map(point => `${point.x},${point.y}`).join(" ")}"` };
}
function pathsSvg(map, editable = false) {
  const byId = new Map(map.spaces.map((space) => [space.id, space]));
  const defs = `<defs><marker id="path-arrow" markerWidth="6" markerHeight="6" refX="5" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 Z"/></marker></defs>`;
  const paths = map.paths.map((path) => { const from = byId.get(path.from), to = byId.get(path.to); if (!from || !to) return ""; const geometry = pathGeometry(path, from, to), render = path.render || {}, selected = app.editingPath === path.id, arrow = path.oneWay ? path.direction === "reverse" ? `marker-start="url(#path-arrow)"` : `marker-end="url(#path-arrow)"` : ""; return `<g class="board-path ${selected ? "selected" : ""} ${render.hidden ? "is-hidden" : ""} ${render.border === false ? "no-border" : ""}" data-path-id="${html(path.id)}" style="--path-color:${html(render.color || "#fff0a9")};--path-opacity:${Number(render.opacity ?? 1)};--path-width:${Number(render.width || 1.8)};--path-border:${html(render.borderColor || "#172340")}"><${geometry.tag} class="path-border" ${geometry.attrs}/><${geometry.tag} class="path-visible ${render.pattern ? `pattern-${html(render.pattern)}` : ""}" ${geometry.attrs} ${arrow}/>${editable ? `<${geometry.tag} class="path-hit" ${geometry.attrs}/>` : ""}${editable && selected ? (path.points || []).map((point,index)=>`<circle class="path-control-point" data-path-point="${index}" cx="${point.x}" cy="${point.y}" r="1.15"/>`).join("") : ""}</g>`; }).join("");
  return `<svg class="map-paths ${editable ? "editable" : ""}" viewBox="0 0 100 100" preserveAspectRatio="none">${defs}${paths}</svg>`;
}
function mapSpaceAction(space, action, index) {
  const characters = (action.characters || []).map((char) => ({
    id: char.id,
    name: char.name,
    icon: char.icon,
    sprite: char.sprite,
    color: char.color,
    offsetX: Number(char.offsetX ?? 0),
    offsetY: Number(char.offsetY ?? -34),
    scale: Number(char.scale ?? 1.0),
    alwaysVisible: char.alwaysVisible !== false && char.visibleOnBoard !== false,
    isHost: Boolean(char.isHost),
    animation: char.animation || "float",
    idleAnimationId: char.idleAnimationId || char.ragdoll?.idleAnimationId,
    ragdoll: char.ragdoll,
    spriteSheet: char.spriteSheet,
    spriteX: char.spriteX,
    spriteY: char.spriteY
  }));
  return {
    ...space,
    type: action.space?.type || "event",
    shape: action.space?.shape || "oval",
    size: Number(action.space?.size || 3),
    rotation: Number(action.space?.rotation || 0),
    color: action.space?.color,
    action: action.id,
    actors: characters,
    activity: {
      id: action.id,
      icon: action.space?.icon || "⚡",
      title: action.name || `Space Action ${index + 1}`
    }
  };
}
function spaceInspectorModal() {
  const space = app.project.map.spaces.find(item => item.id === app.mapInspector); if (!space) return "";
  const defaults=app.project.map.defaults||{},connected = app.project.map.paths.filter(path => path.from === space.id || path.to === space.id), tab = app.mapInspectorTab;
  return `<div class="map-modal-backdrop"><section class="map-inspector"><header><div><small>SPACE ${space.id + 1}</small><b>${html(space.activity?.title || `${space.type} space`)}</b></div><button data-close-map-inspector>×</button></header><nav><button data-map-inspector-tab="space" class="${tab === "space" ? "active" : ""}">SPACE</button><button data-map-inspector-tab="paths" class="${tab === "paths" ? "active" : ""}">PATHS <i>${connected.length}</i></button></nav>${tab === "paths" ? `<div class="path-list">${connected.map(path => { const other = path.from === space.id ? path.to : path.from; return `<article><span><b>TO SPACE ${other + 1}</b><small>${path.oneWay ? "ONE-WAY" : "TWO-WAY"} · ${html(path.render?.pattern || "SOLID")}</small></span><button data-edit-path="${html(path.id)}">EDIT</button><button data-delete-path="${html(path.id)}">DELETE</button></article>`; }).join("") || `<p>No paths connect to this space yet.</p>`}<button class="map-primary" data-add-path-from="${space.id}">＋ ADD PATH</button></div>` : `<form class="space-edit-form"><label>NAME<input data-space-edit="name" value="${html(space.activity?.title || "")}" placeholder="Space name"></label><label>TYPE<select data-space-edit="type">${["blue","red","lucky","event","start","shop","duel","warp","trap"].map(value=>`<option ${value===(space.type??defaults.spaceType??"blue")?"selected":""}>${value}</option>`).join("")}</select></label><label>SIZE<input data-space-edit="size" type="range" min=".25" max="5" step=".25" value="${space.size ?? defaults.spaceSize ?? 3}"></label><label>SHAPE<select data-space-edit="shape">${["oval","round","star","diamond","hex","shield"].map(value => `<option ${(space.shape??defaults.spaceShape??"oval") === value ? "selected" : ""}>${value}</option>`).join("")}</select></label><label>ROTATION<input data-space-edit="rotation" type="number" min="-180" max="180" value="${space.rotation ?? defaults.spaceRotation ?? 0}"></label><label>OUTLINE WIDTH<input data-space-edit="borderWidth" type="range" min="0" max="16" step=".5" value="${space.borderWidth??defaults.spaceBorderWidth??3}"></label><label>OUTLINE COLOR<input data-space-edit="borderColor" type="color" value="${space.borderColor??defaults.spaceBorderColor??"#ffffff"}"></label><label>OUTLINE OPACITY<input data-space-edit="borderOpacity" type="range" min="0" max="1" step=".05" value="${space.borderOpacity??defaults.spaceBorderOpacity??1}"></label><label><input data-space-edit="shadow" type="checkbox" ${(space.shadow??defaults.spaceShadow??false)?"checked":""}> DROP SHADOW</label><label>SHADOW COLOR<input data-space-edit="shadowColor" type="color" value="${space.shadowColor??defaults.spaceShadowColor??"#000000"}"></label><label>SHADOW OPACITY<input data-space-edit="shadowOpacity" type="range" min="0" max="1" step=".05" value="${space.shadowOpacity??defaults.spaceShadowOpacity??.45}"></label><label>SHADOW BLUR<input data-space-edit="shadowBlur" type="range" min="0" max="30" step="1" value="${space.shadowBlur??defaults.spaceShadowBlur??8}"></label><label>SHADOW OFFSET<input data-space-edit="shadowOffset" type="range" min="-30" max="30" step="1" value="${space.shadowOffset??defaults.spaceShadowOffset??5}"></label><button type="button" data-reset-space-defaults>↺ RESET TO MAP DEFAULTS</button><button type="button" class="danger-button" data-delete-space>DELETE SPACE</button></form>`}</section></div>`;
}
function pathInspectorModal() {
  const path = app.project.map.paths.find(item => item.id === app.editingPath); if (!path) return ""; const render = path.render ||= {},defaults=app.project.map.defaults||{};
  return `<div class="map-modal-backdrop path-editor-backdrop"><section class="map-inspector path-inspector"><header><div><small>PATH EDITOR</small><b>SPACE ${path.from + 1} → ${path.to + 1}</b></div><button data-close-path-editor>×</button></header><p>Click the highlighted route to add a control point, then drag points to shape it.</p><div class="path-options"><label>DIRECTION<select data-path-edit="direction"><option value="both" ${(path.oneWay==null?(defaults.pathDirection??"both")==="both":!path.oneWay) ? "selected" : ""}>↔ Two-way</option><option value="forward" ${(path.oneWay==null?defaults.pathDirection==="forward":path.oneWay&&path.direction!=="reverse") ? "selected" : ""}>→ One-way</option><option value="reverse" ${(path.oneWay==null?defaults.pathDirection==="reverse":path.oneWay&&path.direction==="reverse") ? "selected" : ""}>← One-way</option></select></label><label>WIDTH<input data-path-render="width" type="range" min=".25" max="20" step=".25" value="${Number(render.width ?? defaults.pathWidth ?? 5)}"></label><label>CURVE<select data-path-render="curve"><option value="hard" ${(render.curve??defaults.pathCurve??"hard") !== "smooth" ? "selected" : ""}>Hard edges</option><option value="smooth" ${(render.curve??defaults.pathCurve??"hard") === "smooth" ? "selected" : ""}>Smooth curve</option></select></label><label>🎨 LINE<select data-path-render="pattern"><option value="solid" ${(render.pattern??defaults.pathPattern??"solid")==="solid"?"selected":""}>Solid</option><option value="dashed" ${(render.pattern??defaults.pathPattern)==="dashed" ? "selected" : ""}>Dashed</option><option value="dotted" ${(render.pattern??defaults.pathPattern)==="dotted" ? "selected" : ""}>Dotted</option></select></label><label>COLOR<input data-path-render="color" type="color" value="${html(render.color??defaults.pathColor??"#fff0a9")}"></label><label>OPACITY<input data-path-render="opacity" type="range" min="0" max="1" step=".05" value="${Number(render.opacity??defaults.pathOpacity??1)}"></label><label><input data-path-render="border" type="checkbox" ${(render.border??defaults.pathBorder??true) ? "checked" : ""}> SIDE BORDERS</label><label><input data-path-render="hidden" type="checkbox" ${(render.hidden??defaults.pathHidden??false) ? "checked" : ""}> INVISIBLE IN GAME</label></div><button data-reset-path-defaults>↺ RESET TO MAP DEFAULTS</button><button class="danger-button" data-delete-path="${html(path.id)}">DELETE PATH</button></section></div>`;
}
function pointInspectorModal() { const menu = app.pathPointMenu, path = menu && app.project.map.paths.find(item => item.id === menu.pathId), point = path?.points?.[menu.index]; if (!point) return ""; return `<div class="map-modal-backdrop"><section class="map-inspector point-inspector"><header><div><small>PATH CONTROL POINT</small><b>MOVEMENT & ENVIRONMENT</b></div><button data-close-point-editor>×</button></header><div class="path-options"><label>MOVEMENT<select data-point-edit="movement">${["walk","hop","climb","crawl","swim","slide","fly","teleport"].map(value => `<option ${point.movement === value ? "selected" : ""}>${value}</option>`).join("")}</select></label><label>SPEED<input data-point-edit="speed" type="range" min=".1" max="3" step=".1" value="${Number(point.speed || 1)}"></label><label>LIGHTING<select data-point-edit="lighting">${["unchanged","brighten","dim","dark","spotlight"].map(value => `<option ${point.lighting === value ? "selected" : ""}>${value}</option>`).join("")}</select></label><label>WALK SOUND<input data-point-edit="sound" value="${html(point.sound || "default")}"></label><label><input data-point-edit="hidden" type="checkbox" ${point.hidden ? "checked" : ""}> HIDE CHARACTER HERE</label><label>INTERACTION<input data-point-edit="interaction" value="${html(point.interaction || "")}" placeholder="duck under branch, open door…"></label></div><button class="danger-button" data-delete-path-point>DELETE POINT</button></section></div>`; }
function mapHoldMenu() { const space = app.project.map.spaces.find(item => item.id === app.mapHoldMenu); return space ? `<div class="map-hold-menu"><b>${html(space.activity?.title || `Space ${space.id + 1}`)}</b><button data-hold-edit-space="${space.id}">EDIT</button><button data-hold-delete-space="${space.id}">DELETE</button><button data-close-hold-menu>CANCEL</button></div>` : ""; }
function pointHoldMenu() { const menu=app.pathPointHoldMenu;return menu?`<div class="map-hold-menu"><b>PATH CONTROL POINT</b><button data-hold-edit-point>EDIT</button><button data-hold-delete-point>DELETE</button><button data-close-point-hold>CANCEL</button></div>`:""; }
function multiSpaceInspectorModal(){const ids=[...app.selectedSpaces];if(app.mapInspector==null||ids.length<2)return "";return `<div class="map-modal-backdrop"><section class="map-inspector"><header><div><small>MULTI-EDIT</small><b>${ids.length} SPACES SELECTED</b></div><button data-close-map-inspector>×</button></header><div class="space-edit-form"><p>Changes below apply to every selected space.</p><label>SIZE<input data-multi-space-edit="size" type="range" min=".25" max="5" step=".25" value="3"></label><label>SHAPE<select data-multi-space-edit="shape"><option value="">Keep individual shapes</option>${["oval","round","star","diamond","hex","shield"].map(value=>`<option>${value}</option>`).join("")}</select></label><label>TYPE<select data-multi-space-edit="type"><option value="">Keep individual types</option>${["blue","red","lucky","event","start","shop","duel","warp","trap"].map(value=>`<option>${value}</option>`).join("")}</select></label><label>ROTATION<input data-multi-space-edit="rotation" type="number" min="-180" max="180" value="0"></label><button type="button" class="danger-button" data-delete-selected-spaces>DELETE ${ids.length} SPACES</button></div></section></div>`;}
function mapEditor() {
  const map = app.project.map, actions = app.project.events.entries.map(ensureSpaceActionDefaults), selected = map.spaces.find(space => space.id === app.selectedSpace);
  const spaces = map.spaces.map(space => {
    const spaceActors = space.actors || (actions.find(a => a.id === space.action || a.id === space.activity?.id)?.characters) || [];
    const sizeRatio = Number(space.size || 3) / 3;
    const actorPins = spaceActors.filter(a => a.alwaysVisible !== false && a.visibleOnBoard !== false).map(a => `
      <span class="space-board-actor" style="left:calc(50% + ${(Number(a.offsetX ?? 0)) * sizeRatio}px);top:calc(50% + ${(Number(a.offsetY ?? -34)) * sizeRatio}px);transform:translate(-50%,-50%) scale(${Math.max(0.2, (Number(a.scale ?? 1.0)) * sizeRatio)});">
        ${a.sprite ? `<img src="${html(a.sprite)}" style="width:28px;height:28px;object-fit:contain;">` : `<span style="font-size:1.2rem;">${html(a.icon || (a.isHost ? "👑" : "👤"))}</span>`}
      </span>
    `).join("");
    return `<button data-space="${space.id}" class="showcase-space map-space ${space.type} shape-${space.shape || "oval"} ${space.activity ? "has-activity" : ""} ${app.selectedSpaces.has(space.id)||selected?.id === space.id ? "selected" : ""} ${app.pathPickFrom === space.id ? "path-origin" : ""}" style="left:${space.x}%;top:${space.y}%;--space-size:${space.size || 3};transform:translate(-50%,-50%) rotate(${space.rotation || 0}deg)" title="${html(space.activity?.title || `${space.type} space`)}">${space.activity ? `<span class="space-action-icon">${html(space.activity.icon || "✦")}</span>` : ""}<small class="space-editor-number">${space.id + 1}</small>${actorPins}</button>`;
  }).join("");
  const catalog = `<aside class="map-action-catalog"><header><small>SPACE ACTIONS</small><b>DRAG ONTO BOARD</b></header><div>${actions.map((action,index) => `<button data-catalog-action="${html(action.id)}">${renderSpaceToken(action.space || {}, "catalog-token")}<span><b>${html(action.name)}</b><small>${html(action.space?.type || "event")} · USE ANY NUMBER OF TIMES</small></span></button>`).join("") || `<p>Create Space Actions in the catalog first.</p>`}</div><button data-go="${boardEditorPath("event")}">EDIT SPACE ACTION CATALOG</button></aside>`;
  const overlayStyle=`transform:translate(${app.mapPan.x}px,${app.mapPan.y}px) scale(${app.mapZoom}) rotate(${app.mapRotation||0}rad)`;
  return `<section class="studio-shell board-showcase-shell map-maker-overview"><header class="board-showcase-header"><button data-go="/party/board/${app.project.boardProjects.selectedId}">◀ BOARD OVERVIEW</button><div><small>SPACE/PATH EDITOR</small><h1>${html(map.name)}</h1><p>${map.spaces.length} spaces · ${map.paths.length} paths</p></div></header><main class="board-showcase-stage map-editor-stage"><div id="map-viewport" class="board-showcase-map pixi-board-host" data-pixi-board="editor"><div id="map-board" class="map-interaction-overlay" style="${overlayStyle}">${pathsSvg(map,true)}${spaces}</div></div></main>${catalog}<nav class="map-floating-toolbar"><button data-map-tool="select" class="${map.tool !== "pan" ? "active" : ""}">⌁ SELECT</button><button data-map-tool="pan" class="${map.tool === "pan" ? "active" : ""}">✋ PAN</button><button data-undo ${app.history.length ? "" : "disabled"}>↶ UNDO</button><button data-redo ${app.future.length ? "" : "disabled"}>↷ REDO</button><button data-map-rotate="-.087">↶</button><button data-map-zoom="-.2">−</button><b>${Math.round(app.mapZoom * 100)}%</b><button data-map-zoom=".2">＋</button><button data-map-rotate=".087">↷</button><button data-map-reset>⌂</button></nav>${mapHoldMenu()}${pointHoldMenu()}${app.selectedSpaces.size>1?multiSpaceInspectorModal():spaceInspectorModal()}${pathInspectorModal()}${pointInspectorModal()}</section>`;
}
const starterEffects = [
  {id:"sfx-smoke",name:"Smoke",kind:"particle",type:"smoke",icon:"☁",color:"#b8c2c8",secondaryColor:"#515966",shape:"circle",blend:"normal",rate:14,count:36,life:3.5,size:22,sizeEnd:50,speed:22,spread:34,angle:-90,gravity:-4,drag:.96,opacity:.55,radius:70},
  {id:"sfx-leaves",name:"Leaves",kind:"particle",type:"falling",icon:"🍂",color:"#d87924",secondaryColor:"#f1c453",shape:"leaf",blend:"normal",rate:10,count:42,life:5,size:11,sizeEnd:8,speed:65,spread:85,angle:90,gravity:24,drag:.99,spin:150,radius:110},
  {id:"sfx-rain",name:"Rain",kind:"particle",type:"falling",icon:"🌧",color:"#8fd7ff",secondaryColor:"#dff6ff",shape:"line",blend:"screen",rate:42,count:90,life:1.8,size:12,sizeEnd:12,speed:190,spread:18,angle:100,gravity:90,drag:1,radius:130},
  {id:"sfx-sparks",name:"Sparks",kind:"particle",type:"sparks",icon:"✦",color:"#ffd34d",secondaryColor:"#ff6038",shape:"star",blend:"add",rate:24,count:55,life:1.2,size:5,sizeEnd:1,speed:135,spread:360,angle:-90,gravity:110,drag:.97,radius:65},
  {id:"sfx-emitter",name:"Point Emitter",kind:"controller",type:"emitter",icon:"⊙",color:"#7dffad",emitterShape:"point",rate:18,count:48,radius:55,boundEffectId:"sfx-sparks"},
  {id:"sfx-attractor",name:"Attractor",kind:"controller",type:"attractor",icon:"◎",color:"#70b7ff",radius:80,force:120},
  {id:"sfx-deflector",name:"Deflector",kind:"controller",type:"deflector",icon:"◈",color:"#ffe86e",radius:75,force:140},
  {id:"sfx-repeller",name:"Repeller",kind:"controller",type:"repeller",icon:"◉",color:"#ff8c65",radius:90,force:160},
  {id:"sfx-destroyer",name:"Particle Destroyer",kind:"controller",type:"destroyer",icon:"⊗",color:"#ef6dff",radius:65,force:100},
];
function newEffect(overrides={}){return {id:`effect-${Date.now()}-${Math.random().toString(36).slice(2,6)}`,name:"New Particle",kind:"particle",type:"particle",icon:"✦",color:"#7dffad",colorEnd:"#ffffff",shape:"circle",blend:"add",degradeTime:2,size:8,sizeEnd:1,sizeRandomness:0,speed:80,speedRandomness:0,direction:-90,directionStartRandomness:0,directionChangeStrength:0,directionChangeRate:0,lateralStrength:0,lateralFrequency:1,rotation:0,rotationRandomStart:0,rotationSpeed:0,gravity:20,gravityDirection:90,drag:.98,opacity:1,opacityEnd:0,lifetimeRandomness:0,breakParticleId:"",deathSpawnCount:0,controllerShape:"circle",rate:18,count:48,radius:55,distance:120,force:80,forceMode:"constant",collisionMode:"bounce",boundEffectId:"",lightRadius:90,lightIntensity:1,...overrides};}
function newEffectChooser(){return app.newEffectMenu?`<div class="new-effect-backdrop"><section class="new-effect-chooser"><header><div><small>NEW SPECIAL EFFECT ASSET</small><b>WHAT ARE YOU BUILDING?</b></div><button data-close-new-effect>×</button></header><button data-create-effect-kind="particle"><i>•</i><span><b>PARTICLE</b><small>One particle definition: appearance, movement, lifetime and destruction behavior.</small></span></button><button data-create-effect-kind="controller"><i>◎</i><span><b>CONTROLLER</b><small>An emitter, attractor, blocker, destroyer or deflector placed on the board.</small></span></button><button data-create-effect-kind="lightsource"><i>☀</i><span><b>LIGHT SOURCE</b><small>A placeable ambient, point, spot or beam light.</small></span></button></section></div>`:"";}
function ensureEffects(){app.project.data.effects||=[];app.project.map.effectPlacements||=[];if(!app.project.data.effectsSeeded&&app.project.data.effects.length===0){app.project.data.effects=starterEffects.map(effect=>newEffect(structuredClone(effect)));app.project.data.effectsSeeded=true;}return app.project.data.effects;}
const effectOptions=(values,current)=>values.map(value=>`<option value="${value}" ${current===value?"selected":""}>${value.replaceAll("-"," ").toUpperCase()}</option>`).join("");
function effectPreview(effect){const count=Math.min(42,Math.max(8,Number(effect.count||24))),scale=Math.max(0,Number(effect.sizeEnd||1)/Math.max(1,Number(effect.size||8))),particles=Array.from({length:count},(_,index)=>{const seeded=((index*47)%101)/100-.5,angle=(Number(effect.direction??-90)+seeded*Number(effect.directionStartRandomness||0))*Math.PI/180,distance=(20+(index*31)%48)*(1+seeded*Number(effect.speedRandomness||0)),gravityAngle=Number(effect.gravityDirection??90)*Math.PI/180,gravity=Number(effect.gravity||0)*.12,tx=Math.cos(angle)*distance+Math.cos(gravityAngle)*gravity,ty=Math.sin(angle)*distance+Math.sin(gravityAngle)*gravity,lateral=Math.sin(index*Number(effect.lateralFrequency||1))*Number(effect.lateralStrength||0)*.15;return `<i style="--i:${index};--tx:${tx+lateral}px;--ty:${ty}px;--size:${Math.max(1,Number(effect.size||8)*(1+seeded*Number(effect.sizeRandomness||0)))}px;--scale:${scale};--rotation:${Number(effect.rotation||0)+seeded*Number(effect.rotationRandomStart||0)}deg;--spin:${Number(effect.rotationSpeed||0)}deg;--delay:${-(index/Math.max(1,Number(effect.rate||12)))}s"></i>`;}).join("");return `<div class="effect-preview type-${html(effect.type)} shape-${html(effect.shape)}" style="--effect-color:${html(effect.color)};--effect-color-2:${html(effect.colorEnd||effect.color)};--effect-life:${Number(effect.degradeTime||2)}s;--effect-opacity:${Number(effect.opacity??1)}"><div class="preview-grid"></div><div class="preview-emitter emitter-${html(effect.controllerShape||"point")}"></div><div class="preview-particles">${particles}</div><span>${html(effect.icon||"✦")}</span></div>`;}
function effectsEditor(){
  const effects=ensureEffects(),selected=effects.find(item=>item.id===app.activeEffectId)||effects[0];if(selected)app.activeEffectId=selected.id;
  const cards=effects.map(effect=>`<article class="effect-card ${selected?.id===effect.id?"selected":""}"><button data-select-effect="${html(effect.id)}"><i>${html(effect.icon||"✦")}</i><span><b>${html(effect.name)}</b><small>${html(effect.type||"emitter")}</small></span></button><div><button title="Duplicate" data-duplicate-effect="${html(effect.id)}">⧉</button><button title="Delete" data-delete-effect="${html(effect.id)}">×</button></div></article>`).join("");
  if(!selected)return frame(stationMeta.effects,`<div class="effects-workbench"><aside><header><b>EFFECT LIBRARY</b><button data-add-effect>＋ NEW</button></header>${cards}</aside><section class="effect-form empty"><h2>Create your first special effect.</h2></section></div>${newEffectChooser()}`);
  const field=(label,key,type="number",attrs="")=>`<label>${label}<input type="${type}" data-effect-edit="${key}" value="${html(selected[key]??"")}" ${attrs}></label>`;
  const kind=selected.kind||(["emitter","attractor","blocker","deflector","repeller","destroyer"].includes(selected.type)?"controller":"particle"),types=kind==="controller"?["emitter","attractor","blocker","destroyer","deflector"]:kind==="lightsource"?["ambient-light","point-light","spotlight","laser"]:["particle"];
  const particles=effects.filter(item=>(item.kind||"particle")==="particle"&&item.id!==selected.id),controllers=effects.filter(item=>item.kind==="controller"&&item.id!==selected.id),optionsFor=(items,current)=>items.map(item=>`<option value="${html(item.id)}" ${current===item.id?"selected":""}>${html(item.name)}</option>`).join("");
  const identity=`<fieldset><legend>IDENTITY & TYPE</legend>${field("NAME","name","text")}${field("ICON","icon","text",'maxlength="4"')}<label>ASSET CLASS<select data-effect-edit="kind">${effectOptions(["particle","controller","lightsource"],kind)}</select></label><label>BEHAVIOR<select data-effect-edit="type">${effectOptions(types,selected.type)}</select></label>${field("PRIMARY COLOR","color","color")}</fieldset>`;
  const particleProperties=`<fieldset><legend>SINGLE PARTICLE</legend><label>SHAPE<select data-effect-edit="shape">${effectOptions(["circle","square","line","star","leaf","image"],selected.shape)}</select></label>${field("START COLOR","color","color")}${field("END COLOR","colorEnd","color")}${field("START ALPHA","opacity","range",'min="0" max="1" step=".05"')}${field("END ALPHA","opacityEnd","range",'min="0" max="1" step=".05"')}${field("DEGRADE TIME","degradeTime","range",'min=".1" max="20" step=".1"')}${field("LIFETIME RANDOMNESS","lifetimeRandomness","range",'min="0" max="1" step=".05"')}${field("START SIZE","size","range",'min="1" max="80" step="1"')}${field("END SIZE","sizeEnd","range",'min="0" max="120" step="1"')}${field("SIZE RANDOMNESS","sizeRandomness","range",'min="0" max="1" step=".05"')}${field("BASE SPEED","speed","range",'min="0" max="300" step="1"')}${field("SPEED RANDOMNESS","speedRandomness","range",'min="0" max="1" step=".05"')}${field("START DIRECTION","direction","range",'min="-180" max="180" step="1"')}${field("RANDOM START DIRECTION","directionStartRandomness","range",'min="0" max="360" step="1"')}${field("DIRECTION CHANGE STRENGTH","directionChangeStrength","range",'min="0" max="360" step="1"')}${field("DIRECTION CHANGE RATE","directionChangeRate","range",'min="0" max="20" step=".1"')}${field("LATERAL / WAVE STRENGTH","lateralStrength","range",'min="0" max="300" step="1"')}${field("LATERAL FREQUENCY","lateralFrequency","range",'min="0" max="20" step=".1"')}${field("START ROTATION","rotation","range",'min="-180" max="180" step="1"')}${field("RANDOM START ROTATION","rotationRandomStart","range",'min="0" max="360" step="1"')}${field("ROTATION SPEED","rotationSpeed","range",'min="-720" max="720" step="5"')}${field("GRAVITY STRENGTH","gravity","range",'min="0" max="500" step="1"')}${field("GRAVITY DIRECTION","gravityDirection","range",'min="-180" max="180" step="1"')}${field("DRAG","drag","range",'min=".8" max="1" step=".01"')}<label>BREAK INTO WHEN DESTROYED<select data-effect-edit="breakParticleId"><option value="">NOTHING</option>${optionsFor(particles,selected.breakParticleId)}</select></label>${field("PARTICLES SPAWNED ON DEATH","deathSpawnCount","range",'min="0" max="64" step="1"')}</fieldset>`;
  const controllerProperties=`<fieldset><legend>CONTROLLER PHYSICS</legend><label>CONTROLLER SHAPE<select data-effect-edit="controllerShape">${effectOptions(["circle","box","line","cone"],selected.controllerShape)}</select></label>${field("EFFECT DISTANCE / SIZE","radius","range",'min="5" max="240" step="5"')}${field("INFLUENCE DISTANCE","distance","range",'min="5" max="500" step="5"')}${field("FORCE / GRAVITY","force","range",'min="0" max="500" step="5"')}<label>FORCE MODEL<select data-effect-edit="forceMode">${effectOptions(["constant","gravity"],selected.forceMode)}</select></label>${selected.type==="deflector"?`<label>DEFLECTION<select data-effect-edit="collisionMode">${effectOptions(["bounce","anti-gravity","constant-force"],selected.collisionMode)}</select></label>`:""}${selected.type==="emitter"?`${field("PARTICLES / SECOND","rate","range",'min="1" max="100" step="1"')}${field("MAX LIVE PARTICLES","count","range",'min="1" max="240" step="1"')}`:""}<label>AFFECTED / EMITTED PARTICLE<select data-effect-edit="boundEffectId"><option value="">ALL PARTICLES</option>${optionsFor(particles,selected.boundEffectId)}</select></label><p>Emitters create the chosen particle. Attractors pull it. Blockers prevent entry and allow sliding. Destroyers remove it on contact. Deflectors bounce it or apply an outward force.</p></fieldset>`;
  const lightProperties=`<fieldset><legend>LIGHT SOURCE</legend><label>LIGHT SHAPE<select data-effect-edit="controllerShape">${effectOptions(["circle","cone","line","box"],selected.controllerShape)}</select></label>${field("COLOR","color","color")}${field("DISTANCE / RADIUS","lightRadius","range",'min="5" max="400" step="5"')}${field("INTENSITY","lightIntensity","range",'min=".05" max="4" step=".05"')}${field("DIRECTION","angle","range",'min="-180" max="180" step="1"')}</fieldset>`;
  const media=kind==="particle"?`<fieldset><legend>PARTICLE MEDIA</legend><label>PARTICLE IMAGE<button type="button" data-trigger-upload="effect-image-upload">⬆ UPLOAD IMAGE</button><input hidden type="file" id="effect-image-upload" accept="image/png,image/webp,image/gif,image/jpeg"></label><label>SOUND EFFECT<button type="button" data-trigger-upload="effect-sound-upload">⬆ UPLOAD SOUND</button><input hidden type="file" id="effect-sound-upload" accept="audio/*"></label><small>${selected.image?"✓ Particle image":"No particle image"} · ${selected.sound?"✓ Sound":"No sound"}</small></fieldset>`:"";
  const presets=app.effectPresetMenu?`<div class="effect-preset-menu"><b>LOAD A PARTICLE PRESET</b>${starterEffects.filter(item=>item.kind==="particle").map(item=>`<button data-apply-effect-preset="${html(item.id)}">${html(item.icon)} ${html(item.name)}</button>`).join("")}<button data-close-effect-presets>CANCEL</button></div>`:"";
  const tabs=kind==="particle"?[["identity","IDENTITY"],["particle","PARTICLE"],["media","IMAGE & AUDIO"]]:[["identity","IDENTITY"],[kind==="controller"?"physics":"light",kind==="controller"?"PHYSICS":"LIGHT"]],validTabs=tabs.map(([id])=>id),activeTab=validTabs.includes(app.effectPropertyTab)?app.effectPropertyTab:"identity",panel=(id,markup)=>markup.replace("<fieldset",`<fieldset data-effect-panel="${id}" class="${activeTab===id?"active":""}"`);
  const form=`<section class="effect-form kind-${kind}"><header><div><small>${kind==="controller"?"CONTROLLER / PHYSICS LAB":kind==="lightsource"?"LIGHT SOURCE LAB":"SINGLE PARTICLE LAB"}</small><h2>${html(selected.name)}</h2></div><div><button data-load-preset>▣ LOAD PRESET</button><button data-preview-effect>↻ PREVIEW</button><button data-duplicate-effect="${html(selected.id)}">⧉ DUPLICATE</button><button data-delete-effect="${html(selected.id)}">DELETE</button></div></header>${presets}${effectPreview(selected)}<nav class="effect-property-tabs">${tabs.map(([id,label])=>`<button data-effect-property-tab="${id}" class="${activeTab===id?"active":""}">${label}</button>`).join("")}</nav><div class="effect-controls">${panel("identity",identity)}${kind==="controller"?panel("physics",controllerProperties):kind==="lightsource"?panel("light",lightProperties):panel("particle",particleProperties)}${media?panel("media",media):""}</div></section>`;
  return frame(stationMeta.effects,`<div class="effects-workbench"><aside><header><b>EFFECT LIBRARY</b><button data-add-effect>＋ NEW</button></header>${cards}</aside>${form}</div>${newEffectChooser()}`);
}
function placementsEditor(){const effects=ensureEffects().filter(effect=>(effect.kind||(["emitter","attractor","deflector","repeller","destroyer"].includes(effect.type)?"controller":"particle"))==="controller"),placements=app.project.map.effectPlacements,selected=placements.find(item=>item.id===app.placementInspectorId);const markers=placements.map(item=>`<button class="effect-placement-marker type-${html(item.type)}" data-effect-placement="${html(item.id)}" style="left:${item.x}%;top:${item.y}%;--placement-color:${html(item.color||"#7dffad")};--placement-radius:${Math.max(24,Number(item.radius||55))}px" title="Drag to move · hold for settings">${html(item.icon||"✦")}</button>`).join(""),inspector=selected?`<div class="placement-inspector-backdrop"><section class="placement-inspector"><header><div><small>PLACED CONTROLLER</small><b>${html(selected.name)}</b></div><button data-close-placement-inspector>×</button></header><label>FIELD / EMITTER SIZE <output>${Number(selected.radius||55)}</output><input type="range" min="5" max="240" step="5" data-placement-edit="radius" value="${Number(selected.radius||55)}"></label><label>PARTICLES RELEASED / SECOND <output>${Number(selected.rate||18)}</output><input type="range" min="1" max="100" step="1" data-placement-edit="rate" value="${Number(selected.rate||18)}"></label><button data-delete-placement="${html(selected.id)}">DELETE PLACEMENT</button></section></div>`:"";return frame(stationMeta.placements,`<div class="placements-shell"><main><div id="placement-viewport" class="pixi-board-host" data-pixi-board="placements"><div id="effects-board" class="effect-placement-overlay">${markers}</div><nav class="placement-zoom"><button data-map-zoom="-.2">−</button><b>${Math.round(app.mapZoom*100)}%</b><button data-map-zoom=".2">＋</button><button data-map-reset>⌂</button></nav></div></main><aside><header><b>PLACE A CONTROLLER</b><small>Drag an emitter, force field, or destroyer onto the board.</small></header>${effects.map(effect=>`<button draggable="true" data-placement-effect="${html(effect.id)}" class="placement-library-card ${app.placementEffectId===effect.id?"selected":""}"><i>${html(effect.icon||"✦")}</i><span><b>${html(effect.name)}</b><small>${html(effect.type)}</small></span><em>DRAG</em></button>`).join("")||"<p>Create controllers in Special Effects first.</p>"}</aside>${inspector}</div>`);}
function placementEditorV2(){const all=ensureEffects(),effects=all.filter(effect=>["controller","lightsource"].includes(effect.kind)),placements=app.project.map.effectPlacements,selected=placements.find(item=>item.id===app.placementInspectorId);const markers=placements.map(item=>`<button class="effect-placement-marker type-${html(item.type)}" data-effect-placement="${html(item.id)}" style="left:${item.x}%;top:${item.y}%;--placement-color:${html(item.color||"#7dffad")};--placement-radius:${Math.max(24,Number(item.radius||item.lightRadius||55))}px" title="Drag to move · hold for settings">${html(item.icon||"✦")}</button>`).join(""),inspector=selected?`<div class="placement-inspector-backdrop"><section class="placement-inspector"><header><div><small>PLACED ${selected.kind==="lightsource"?"LIGHT SOURCE":"CONTROLLER"}</small><b>${html(selected.name)}</b></div><button data-close-placement-inspector>×</button></header><label>SIZE / DISTANCE <output>${Number(selected.radius||selected.lightRadius||55)}</output><input type="range" min="5" max="400" step="5" data-placement-edit="${selected.kind==="lightsource"?"lightRadius":"radius"}" value="${Number(selected.radius||selected.lightRadius||55)}"></label>${selected.type==="emitter"?`<label>PARTICLES RELEASED / SECOND <output>${Number(selected.rate||18)}</output><input type="range" min="1" max="100" step="1" data-placement-edit="rate" value="${Number(selected.rate||18)}"></label>`:""}<button data-delete-placement="${html(selected.id)}">DELETE PLACEMENT</button></section></div>`:"";return frame(stationMeta.placements,`<div class="placements-shell"><main><div id="placement-viewport" class="pixi-board-host" data-pixi-board="placements"><div id="effects-board" class="effect-placement-overlay">${markers}</div><nav class="placement-zoom"><button data-map-zoom="-.2">−</button><b>${Math.round(app.mapZoom*100)}%</b><button data-map-zoom=".2">＋</button><button data-map-reset>⌂</button></nav></div></main><aside><header><b>PLACE CONTROLLERS & LIGHTS</b><small>Particles are assets and cannot be placed directly.</small></header>${effects.map(effect=>`<button draggable="true" data-placement-effect="${html(effect.id)}" class="placement-library-card"><i>${html(effect.icon||"✦")}</i><span><b>${html(effect.name)}</b><small>${html(effect.kind)} · ${html(effect.type)}</small></span><em>DRAG</em></button>`).join("")||"<p>Create a controller or light source first.</p>"}</aside>${inspector}</div>`);}
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
  const compiled = allClips.map((clip) => ({
    id: clip.id,
    op: clip.op,
    icon: clip.icon,
    desc: clip.desc,
    parameters: clip.parameters,
    parameterSchema: clip.parameterSchema,
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
    actorId: clip.actorId,
    animationId: clip.animationId,
    transition: clip.transition,
    stageEffect: clip.stageEffect,
    particleDump: clip.particleDump,
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
  entry.commands = compiled;
  const sequence = activeSpaceSequence(entry);
  if (sequence) sequence.commands = compiled;
}

function currentSpaceAction() {
  const act = app.project?.events?.entries?.find((e) => e.id === app.activeSpaceActionId) || app.project?.events?.entries?.[0];
  if (act) ensureSpaceActionDefaults(act);
  return act;
}

// Timeline and actor-editor actions share the selected Space Action.
// Keep this short alias for the action handlers that use the timeline naming.
function currentAction() { return currentSpaceAction(); }

function findClipInTimeline(timelineOrEntry, clipId) {
  if (!timelineOrEntry || !clipId) return null;
  const timeline = timelineOrEntry.tracks ? timelineOrEntry : (timelineOrEntry.timeline || timelineOrEntry.sequences?.[0]?.timeline);
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
  const boardActors = ensureBoardActors();
  if (boardActors && boardActors.length) {
    entry.characters = entry.characters.map((char) => {
      const match = boardActors.find((ba) => String(ba.id) === String(char.id));
      if (match) {
        return {
          ...char,
          id: match.id,
          name: match.name,
          role: match.role,
          isHost: Boolean(match.isHost),
          icon: match.icon,
          sprite: match.sprite,
          anchor: match.anchor || char.anchor || "center",
          animation: match.animation || char.animation || "float",
          animations: match.animations || char.animations || [],
          idleAnimationId: match.idleAnimationId || match.ragdoll?.idleAnimationId || char.idleAnimationId,
          ragdoll: match.ragdoll || char.ragdoll
        };
      }
      return char;
    });
  }
  entry.characters.forEach((char) => {
    ensureActorAnimations(char);
    char.offsetX = Number(char.offsetX ?? 0);
    char.offsetY = Number(char.offsetY ?? -34);
    char.scale = Number(char.scale ?? 1.0);
    if (char.alwaysVisible == null && char.visibleOnBoard == null) {
      char.alwaysVisible = true;
      char.visibleOnBoard = true;
    } else {
      char.alwaysVisible = char.alwaysVisible !== false && char.visibleOnBoard !== false;
      char.visibleOnBoard = char.alwaysVisible;
    }
  });
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
  entry.sequences ||= [{ id: "sequence-main", name: "Main Event", description: "Primary space behavior", timeline: entry.timeline }];
  if (!entry.sequences.length) entry.sequences.push({ id: "sequence-main", name: "Main Event", description: "Primary space behavior", timeline: entry.timeline });
  entry.activeSequenceId ||= entry.sequences[0].id;
  const activeSequence = entry.sequences.find((sequence) => sequence.id === entry.activeSequenceId) || entry.sequences[0];
  activeSequence.timeline ||= entry.timeline;
  entry.timeline = activeSequence.timeline;
  entry.activationRules ||= [];
  if (!entry.activationRules.length) {
    const activationKey = entry.id || index || "space";
    if (entry.activations.movement?.land) entry.activationRules.push({ id: `activation-land-${activationKey}`, name: "Land on space", trigger: "land", sequenceId: activeSequence.id, mode: "blocking", scope: "triggering-player", replay: "every-time", priority: 50, cooldown: 0, enabled: true });
    if (entry.activations.movement?.pass) entry.activationRules.push({ id: `activation-pass-${activationKey}`, name: "Pass over space", trigger: "pass", sequenceId: activeSequence.id, mode: "interrupt-movement", scope: "triggering-player", replay: "every-time", priority: 60, cooldown: 0, enabled: true });
    if (entry.activations.proximity?.enabled) entry.activationRules.push({ id: `activation-near-${activationKey}`, name: "Enter proximity", trigger: "proximity", radius: entry.activations.proximity.radius || 10, sequenceId: activeSequence.id, mode: "background", scope: "triggering-player", replay: "once-per-turn", priority: 20, cooldown: 0, enabled: true });
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
        actorId: cmd.actorId,
        animationId: cmd.animationId,
        transition: cmd.transition,
        stageEffect: cmd.stageEffect,
        particleDump: cmd.particleDump,
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

function activeSpaceSequence(entry) {
  return entry.sequences?.find((sequence) => sequence.id === entry.activeSequenceId) || entry.sequences?.[0];
}

function timelineDecisionChoice(clip) {
  return app.timelinePreviewBranches?.[clip.id];
}

function timelineTrackState(timeline, track, time = app.timelinePlayhead || 0) {
  if (!track || track.muted) return "disabled";
  if (!timeline || !Array.isArray(timeline.tracks)) return "active";

  const trackIndex = timeline.tracks.indexOf(track);
  const isBranch = track.boundDecisionId || track.kind === "branch-false" || track.kind === "branch-outcome" || isBoundBranchTrack(timeline, track.id);

  if (isBranch) {
    let decisionId = track.boundDecisionId;
    let decisionClip = null;
    let decisionTrack = null;

    if (decisionId) {
      const found = findClipInTimeline(timeline, decisionId);
      if (found) {
        decisionClip = found.clip;
        decisionTrack = found.track;
      }
    }

    if (!decisionClip) {
      for (let i = trackIndex - 1; i >= 0; i--) {
        const candidateTrack = timeline.tracks[i];
        const clip = (candidateTrack.clips || []).find(isBranchingDecisionClip);
        if (clip) {
          decisionClip = clip;
          decisionTrack = candidateTrack;
          decisionId = clip.id;
          break;
        }
      }
    }

    if (!decisionClip) return "active";

    const decisionStart = Number(decisionClip.start || 0);
    if (time < decisionStart) return "pending";

    if (decisionTrack) {
      if (decisionTrack.muted) return "disabled";
      const isParentBranch = decisionTrack.boundDecisionId || decisionTrack.kind === "branch-false" || decisionTrack.kind === "branch-outcome" || isBoundBranchTrack(timeline, decisionTrack.id);
      if (isParentBranch) {
        const parentStateAtDecision = timelineTrackState(timeline, decisionTrack, Math.max(0, decisionStart - 0.001));
        if (parentStateAtDecision === "disabled") return "disabled";
      }
    }

    const chosen = timelineDecisionChoice(decisionClip);
    const expected = track.outcomeId || "false";

    if (chosen != null) {
      return String(chosen) === String(expected) ? "active" : "disabled";
    }

    // Default execution during playback is Track 1 (the True / first branch).
    // Secondary branch tracks (False branch) remain disabled unless selected.
    return "disabled";
  }

  for (const clip of track.clips || []) {
    if (!isBranchingDecisionClip(clip) || time < Number(clip.start || 0)) continue;
    const chosen = timelineDecisionChoice(clip);
    if (chosen == null) continue;
    const first = clip.op === "choice" ? ensureChoiceOptions(clip)[0]?.id : "true";
    if (String(chosen) !== String(first)) return "disabled";
  }
  return "active";
}

function playbackTracks(timeline, time = app.timelinePlayhead || 0) {
  return (timeline?.tracks || []).filter((track) => timelineTrackState(timeline, track, time) === "active");
}

function timelineTrackDisablePoint(track, time = app.timelinePlayhead || 0) {
  for (const clip of track?.clips || []) {
    if (!isBranchingDecisionClip(clip) || time < Number(clip.start || 0)) continue;
    const chosen = timelineDecisionChoice(clip);
    const first = clip.op === "choice" ? ensureChoiceOptions(clip)[0]?.id : "true";
    if (chosen != null && String(chosen) !== String(first)) return Number(clip.start || 0);
  }
  return null;
}

function spaceActionDeleteConfirmModal() {
  const targetId = app.confirmDeleteSpaceAction;
  if (!targetId) return "";
  const target = app.project.events.entries.find((e) => e.id === targetId);
  if (!target) return "";
  const space = target.space || {};

  return `
    <div class="cmd-editor-modal-backdrop" data-close-delete-space-action-backdrop>
      <div class="cmd-editor-modal-dialog" style="max-width:520px;border-color:#ff5566;" role="dialog" aria-modal="true" aria-label="Confirm Delete">
        <header class="action-modal-header" style="background:#2a111a;border-bottom-color:#5c1825;">
          <h2 style="color:#ff8899;display:flex;align-items:center;gap:8px;">🗑️ Delete Space Action</h2>
          <button data-nav data-cancel-delete-space-action class="modal-close-window-btn" title="Close Window">✕</button>
        </header>
        <div class="cmd-editor-body" style="padding:24px;text-align:center;">
          <div style="display:flex;justify-content:center;margin-bottom:14px;">
            ${renderSpaceToken(space)}
          </div>
          <h3 style="margin:0 0 8px;font-size:1.15rem;color:#ffe47a;">${html(target.name || "Untitled Action")}</h3>
          <p style="margin:0;color:#e8d4dc;font-size:.85rem;line-height:1.5;">
            Are you sure you want to permanently delete this space action from your catalog? Any board spaces using this action may lose their events.
          </p>
        </div>
        <footer class="cmd-editor-footer" style="background:#1e0d14;border-top-color:#5c1825;justify-content:flex-end;gap:10px;">
          <button type="button" data-nav data-cancel-delete-space-action class="card-btn secondary">CANCEL</button>
          <button type="button" data-nav data-confirm-delete-space-action="${html(target.id)}" class="card-btn danger" style="background:#ee4455;color:#fff;">🗑️ CONFIRM DELETE</button>
        </footer>
      </div>
    </div>
  `;
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
      <article class="space-action-card" data-space-action-card="${html(entry.id)}">
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
        <div class="catalog-actions compact-history-controls">
          <button data-nav data-undo ${app.history.length ? "" : "disabled"} title="Undo">↶</button>
          <button data-nav data-redo ${app.future.length ? "" : "disabled"} title="Redo">↷</button>
          <button data-nav data-go="/party/board/${app.project.boardProjects.selectedId}" class="catalog-board-link">BOARD</button>
        </div>
      </header>

      <div class="catalog-filter-bar">
        ${filterButtons}
      </div>

      <div class="space-catalog-grid">
        ${cards}
        ${newCard}
      </div>
      ${app.confirmDeleteSpaceAction ? spaceActionDeleteConfirmModal() : ""}
    </div>
  `, "", { compact: true });
}

// --- Video Editor Multi-Track Timeline View ---
function getActiveTimelineClips(timeline, time = app.timelinePlayhead || 0) {
  if (!timeline || !Array.isArray(timeline.tracks)) return [];
  return timeline.tracks.flatMap((track) => {
    const state = timelineTrackState(timeline, track, time);
    const disable = state === "disabled" ? timelineTrackDisablePoint(track, time) : null;
    if (state !== "active" && disable == null) return [];

    let branchMinStart = 0;
    if (state === "active" && (track.boundDecisionId || track.kind === "branch-false" || track.kind === "branch-outcome" || isBoundBranchTrack(timeline, track.id))) {
      let decisionClip = null;
      if (track.boundDecisionId) {
        decisionClip = findClipInTimeline(timeline, track.boundDecisionId)?.clip;
      }
      if (!decisionClip) {
        const tIdx = timeline.tracks.indexOf(track);
        for (let i = tIdx - 1; i >= 0; i--) {
          const clip = (timeline.tracks[i].clips || []).find(isBranchingDecisionClip);
          if (clip) { decisionClip = clip; break; }
        }
      }
      if (decisionClip) {
        branchMinStart = Number(decisionClip.start || 0);
      }
    }

    return (track.clips || []).filter((clip) => {
      const clipStart = Number(clip.start || 0);
      if (branchMinStart > 0 && clipStart < branchMinStart) return false;
      if (state === "active") return true;
      if (disable != null && clipStart < disable) return true;
      return false;
    });
  });
}

function isActorDespawnClip(clip) {
  if (!clip) return false;
  if (["despawn-actor", "despawn"].includes(clip.op)) return true;
  if (clip.actorAction === "despawn") return true;
  return false;
}

function isActorSpawnClip(clip) {
  if (!clip) return false;
  if (["spawn-actor", "spawn"].includes(clip.op)) return true;
  if (clip.actorAction === "spawn") return true;
  return false;
}

function isActorLifecycleClip(clip) {
  return isActorDespawnClip(clip) || isActorSpawnClip(clip);
}

function evaluateActorTimelineLifecycle(entry, playhead) {
  const hidden = new Set(), spawnPending = new Set(), cast = entry?.characters || [];
  const activeClips = getActiveTimelineClips(entry?.timeline, playhead);

  for (const actor of cast) {
    const actorIdStr = String(actor.id);
    const actorClips = activeClips.filter((clip) => {
      const targetActor = selectedSpaceActor(cast, clip.actorId || clip.parameters?.actor || clip.target);
      return targetActor?.id === actor.id || String(clip.actorId || clip.parameters?.actor || "") === actorIdStr || clip.target === actor.name;
    }).sort((a, b) => Number(a.start || 0) - Number(b.start || 0));

    const lifecycleClips = actorClips.filter(isActorLifecycleClip);

    if (lifecycleClips.length === 0) {
      if (actor.visible === false) hidden.add(actorIdStr);
      continue;
    }

    const firstSpawn = lifecycleClips.find(isActorSpawnClip);

    if (firstSpawn && lifecycleClips[0] === firstSpawn && playhead < Number(firstSpawn.start || 0)) {
      spawnPending.add(actorIdStr);
    }

    let isCurrentlyVisible = actor.visible !== false && !spawnPending.has(actorIdStr);
    for (const clip of lifecycleClips) {
      const start = Number(clip.start || 0);
      const duration = Number(clip.duration || clip.parameters?.duration || 1);
      if (playhead < start) continue;
      const isDespawn = isActorDespawnClip(clip);
      if (isDespawn) {
        if (playhead >= start + duration) {
          isCurrentlyVisible = false;
        } else {
          isCurrentlyVisible = true;
        }
      } else {
        isCurrentlyVisible = true;
      }
    }

    if (!isCurrentlyVisible) {
      hidden.add(actorIdStr);
    }
  }

  return { hidden: [...hidden], spawnPending: [...spawnPending] };
}

function timelinePreviewState(entry) {
  const playhead = Math.max(0, app.timelinePlayhead || 0);
  const activePathClips = getActiveTimelineClips(entry?.timeline, playhead);
  const active = activePathClips.filter((clip) => playhead >= Number(clip.start || 0) && playhead < Number(clip.start || 0) + Number(clip.duration || 2));
  const latest = (category) => active.filter((clip) => clip.category === category).at(-1);
  const camera = latest("camera");
  const decision = active.find((clip) => isBranchingDecisionClip(clip) && clip.waitForInput !== false);
  const playerChoice = active.find((clip) => clip.op === "choose-player" && clip.waitForInput !== false);
  const dialogue = latest("dialogue") || active.find((clip) => clip.op === "dialogue") || decision || playerChoice;
  const waitingCandidate = app.timelinePreviewWaiting ? active.find((clip) => clip.id === app.timelinePreviewWaiting) : null;
  const waiting = waitingCandidate && waitingCandidate.waitForInput !== false && waitingCandidate !== dialogue && waitingCandidate !== decision && waitingCandidate !== playerChoice ? waitingCandidate : null;
  const actorClips = active.filter((clip) => ["actors", "stage", "screen"].includes(clip.category) || clip.op === "spawn-particles" || String(clip.label || "").toLowerCase().includes("particle"));

  const cameraHistory = activePathClips.filter((clip) => clip.category === "camera" && Number(clip.start || 0) <= playhead).sort((a, b) => Number(a.start || 0) - Number(b.start || 0));
  let zoom = 2, panX = 0, panY = 0, shake = false;
  for (const cameraClip of cameraHistory) {
    const local = Math.max(0, Math.min(1, (playhead - Number(cameraClip.start || 0)) / Math.max(0.01, Number(cameraClip.duration || 1))));
    const eased = 1 - (1 - local) ** 3;
    const action = cameraClip.camAction || cameraClip.op || "";
    if (action === "zoom" || /zoom/i.test(cameraClip.label || "")) zoom = 2 + (Math.max(0.7, Number(cameraClip.zoom || cameraClip.parameters?.zoom || 2)) - 2) * eased;
    if (action === "pan-target" || /pan/i.test(cameraClip.label || "")) {
      panX = (String(cameraClip.parameters?.target || cameraClip.target || "").includes("Actor") ? -12 : 8) * eased;
      panY = -5 * eased;
    }
  }
  if (camera) {
    const action = camera.camAction || camera.op || "";
    shake = action === "shake" || /shake/i.test(camera.label || "");
  }

  const { hidden, spawnPending } = evaluateActorTimelineLifecycle(entry, playhead);

  return {
    playhead,
    active,
    dialogue,
    decision,
    playerChoice,
    waiting,
    actorClips,
    weather: latest("world"),
    vfx: latest("vfx") || latest("screen"),
    banner: active.find((clip) => clip.style === "banner" || clip.banner),
    zoom,
    panX,
    panY,
    shake,
    leadIn: Boolean(app.timelinePreviewLeadInUntil),
    activation: previewActivation(entry),
    despawnedActorIds: hidden,
    spawnPendingActorIds: spawnPending
  };
}
function previewActivation(entry){const rule=(entry.activationRules||[]).find(item=>item.enabled!==false&&item.sequenceId===entry.activeSequenceId)||{},trigger=rule.trigger||(entry.activations?.movement?.pass?"pass":entry.activations?.proximity?.enabled?"proximity":entry.activations?.movement?.land!==false?"land":"interact");return {trigger,label:{land:"LAND ON SPACE",pass:"PASS OVER SPACE",proximity:"ENTER PROXIMITY",interact:"PRESS A TO INTERACT","round-start":"ROUND START",signal:"SIGNAL RECEIVED"}[trigger]||"ACTIVATE SPACE"};}
function timelineStagePosition(clip,fallback={x:0,y:0}){const position=clip?.stagePosition||clip?.parameters?.stagePosition||clip?.parameters?.position||clip?.position||fallback;return{x:Math.max(-90,Math.min(90,Number(position.x??fallback.x)||0)),y:Math.max(-70,Math.min(70,Number(position.y??fallback.y)||0))};}
function timelineStageStyle(position){return `left:${50+position.x/2}%;top:${53+position.y/2}%;right:auto;transform:translate(-50%,-50%)`;}
function isStageMoveClip(clip){return Boolean(clip)&&((clip.category==="actors"&&["move","spawn"].includes(clip.actorAction||clip.op))||(clip.category==="player"&&["gather-players","move-stage","move-player","teleport"].includes(clip.op)));}
function selectedStageMove(entry){const found=app.timelineSelectedClipId&&findClipInTimeline(entry,app.timelineSelectedClipId),clip=found?.clip;if(!isStageMoveClip(clip))return null;return{clip,kind:clip.category==="actors"?"actor":"player",targetId:clip.actorId||clip.parameters?.actor||""};}
function stageMoveForActor(entry,actor,playhead){const activeClips=getActiveTimelineClips(entry?.timeline,playhead);return activeClips.filter(clip=>clip.category==="actors"&&["move","spawn"].includes(clip.actorAction||clip.op)&&(String(clip.actorId||clip.parameters?.actor||"")===String(actor.id)||clip.target===actor.name)&&Number(clip.start||0)<=playhead).sort((a,b)=>Number(a.start||0)-Number(b.start||0)).at(-1);}
function stageMoveForPlayer(entry,playhead){const activeClips=getActiveTimelineClips(entry?.timeline,playhead);return activeClips.filter(clip=>clip.category==="player"&&["gather-players","move-stage","move-player","teleport"].includes(clip.op)&&Number(clip.start||0)<=playhead).sort((a,b)=>Number(a.start||0)-Number(b.start||0)).at(-1);}
function eligiblePreviewPlayerSeats(clip, triggeringSeat = app.timelineTriggeringPlayer || 1) {
  const p = clip?.parameters || {};
  const eligible = p.eligiblePlayers || clip?.eligiblePlayers;
  let seats = [1, 2, 3, 4];

  if (eligible && typeof eligible === "object") {
    if (eligible.mode === "specific" && Array.isArray(eligible.seats) && eligible.seats.length > 0) {
      seats = seats.filter((s) => eligible.seats.map(Number).includes(Number(s)));
    }
    if (eligible.excludeTriggering === true || eligible.excludeTriggeringPlayer === true || eligible.allowSelf === false) {
      seats = seats.filter((s) => Number(s) !== Number(triggeringSeat));
    }
  }

  const excludeTriggering = p.excludeTriggering === true ||
    p.excludeTriggeringPlayer === true ||
    clip?.excludeTriggering === true ||
    clip?.excludeTriggeringPlayer === true ||
    p.allowSelf === false ||
    clip?.allowSelf === false ||
    p.excludeSelf === true ||
    clip?.excludeSelf === true;

  if (excludeTriggering) {
    seats = seats.filter((s) => Number(s) !== Number(triggeringSeat));
  }

  return seats.length ? seats : [1, 2, 3, 4];
}

function previewDialogueMarkup(state){const clip=state.dialogue;if(!clip)return "";const speaker=clip.speaker||clip.parameters?.speaker||"NARRATOR",text=clip.text||clip.parameters?.text||clip.parameters?.prompt||clip.questionText||clip.confirmationPrompt||"…",needsButton=clip!==state.decision&&clip!==state.playerChoice&&clip.waitForInput!==false;return `<small>${html(speaker)}</small><p>${html(text)}</p>${needsButton?`<button type="button" data-preview-continue="${html(clip.id)}">OK</button>`:""}`;}
function previewPromptMarkup(state){const clip=state.decision||state.playerChoice||state.waiting;if(!clip)return "";if(state.decision){const choices=clip.op==="choice"?ensureChoiceOptions(clip):[{id:"true",label:clip.parameters?.trueLabel||clip.trueLabel||clip.choice1||clip.passLabel||"YES"},{id:"false",label:clip.parameters?.falseLabel||clip.falseLabel||clip.choice2||clip.failLabel||"NO"}];return `<small>CONFIRM</small>${choices.map((choice,index)=>`<button type="button" data-preview-branch="${html(clip.id)}:${html(choice.id)}"><i>${index===0?"▶":""}</i>${html(choice.label)}</button>`).join("")}`;}if(state.playerChoice){const seats=eligiblePreviewPlayerSeats(clip,app.timelineTriggeringPlayer||1);return `<small>CHOOSE A PLAYER</small>${seats.map((seat,index)=>`<button type="button" data-preview-player="${html(clip.id)}:${seat}"><i>${index===0?"▶":""}</i><b>P${seat}</b> PLAYER ${seat}</button>`).join("")}`;}return `<small>PLAYER INPUT</small><button type="button" data-preview-continue="${html(clip.id)}"><i>▶</i>OK</button>`;}
function previewEventChips(state){return state.active.filter(clip=>!(["dialogue","input","ui"].includes(clip.category)||["dialogue","confirm","choice","choose-player"].includes(clip.op))).map(clip=>`<span>${html(clip.icon||"⚡")} ${html(clip.label||clip.op||"Event")}</span>`).join("");}
function timelinePreviewActorsMarkup(entry,state){const selected=selectedStageMove(entry);return (entry.characters||[]).map(actor=>{const move=stageMoveForActor(entry,actor,state.playhead),position=timelineStagePosition(move,{x:actor.anchor==="left"?-46:actor.anchor==="right"?46:0,y:0}),editing=selected?.kind==="actor"&&String(selected.targetId)===String(actor.id);return `<div class="timeline-pixi-actor actor-${html(actor.anchor||"center")}" data-timeline-pixi-actor="${html(actor.id)}" style="${timelineStageStyle(position)}" ${editing?`data-preview-stage-drag="actor" data-preview-stage-clip="${html(selected.clip.id)}" title="Drag to set actor destination relative to this space"`:""}>${editing?"<span class=\"preview-stage-drag-point\">✥</span>":""}</div>`;}).join("");}
function timelinePreviewGatheredPlayers(state){const gather=state.active.find(clip=>clip.category==="player"&&clip.op==="gather-players");if(!gather)return "";return [2,3,4].map((seat,index)=>`<div class="preview-gathered-player gathered-${seat}" style="${timelineStageStyle({x:[-38,0,38][index],y:22})}"><b>P${seat}</b></div>`).join("");}
function timelinePixiState(entry,state){
  const selected=selectedStageMove(entry),playerMove=selected?.kind==="player"?selected.clip:stageMoveForPlayer(entry,state.playhead),cast=entry.characters||[];
  const despawned=new Set((state.despawnedActorIds||[]).map(String)), spawnPending=new Set((state.spawnPendingActorIds||[]).map(String));
  const actors=cast.map(assigned=>{
    const actor=canonicalSpaceActor(assigned),move=stageMoveForActor(entry,actor,state.playhead),
          active=state.actorClips.find(clip=>{const targetActor=selectedSpaceActor(cast,clip.actorId||clip.parameters?.actor||clip.target);return (targetActor?.id===actor.id||String(clip.actorId||clip.parameters?.actor||"")===String(actor.id))&&(clip.animationId||clip.parameters?.animation);}),
          isHidden=despawned.has(String(actor.id))||spawnPending.has(String(actor.id));
    const idleId=actor.idleAnimationId||actor.ragdoll?.idleAnimationId||actor.ragdoll?.activeAnimationId||actor.animationId;
    return {...actor,visible:!isHidden,stagePosition:timelineStagePosition(move,{x:actor.anchor==="left"?-46:actor.anchor==="right"?46:0,y:0}),animationId:active?.animationId||active?.parameters?.animation||idleId,animationTime:active?Math.max(0,state.playhead-Number(active.start||0)):state.playhead};
  });
  const gather=state.active.find(clip=>clip.category==="player"&&clip.op==="gather-players"),players=[{id:"p1",label:"P1",color:"#4da6ff",stagePosition:timelineStagePosition(playerMove),visible:true},...(gather?[2,3,4].map((seat,index)=>({id:`p${seat}`,label:`P${seat}`,color:"#f1a64d",stagePosition:{x:[-38,0,38][index],y:22},visible:true})):[])],particles=ensureEffects();
  const transitions=state.actorClips.filter(clip=>{
    return isActorLifecycleClip(clip) || (clip.category === "actors" && clip.stageEffect && clip.stageEffect !== "none") || clip.op === "spawn-particles" || String(clip.label || "").toLowerCase().includes("particle");
  }).map(clip=>{
    const isDespawn = isActorDespawnClip(clip);
    const isSpawn = isActorSpawnClip(clip);
    const isPureParticle = !isDespawn && !isSpawn && (clip.op === "spawn-particles" || clip.category !== "actors");
    const targetActor = isPureParticle ? null : selectedSpaceActor(cast, clip.actorId || clip.parameters?.actor || clip.parameters?.target || clip.target);
    const pKey = clip.particleDump?.effectId || clip.parameters?.preset || clip.preset || clip.parameters?.particle || clip.particle || clip.parameters?.effectId;
    return {
      ...clip,
      actorId: targetActor?.id || null,
      isParticleBurst: isPureParticle,
      actorAction: isDespawn ? "despawn" : isSpawn ? "spawn" : (clip.actorAction || "pose"),
      stageEffect: clip.stageEffect || (isDespawn ? "smoke-poof" : isSpawn ? "fade" : "none"),
      duration: Number(clip.duration || clip.parameters?.duration || 1),
      start: Number(clip.start || 0),
      particle: particles.find(effect => effect.id === pKey || effect.name === pKey || effect.id === clip.particleDump?.effectId)
    };
  });
  return{actors,players,center:{x:500,y:281},camera:{zoom:state.zoom,x:state.panX*4,y:state.panY*4,shake:state.shake},transitions,playhead:state.playhead,playing:Boolean(app.timelinePlaying),despawnedActorIds:state.despawnedActorIds||[],spawnPendingActorIds:state.spawnPendingActorIds||[]};
}
function timelinePreviewMarkup(entry) {const state=timelinePreviewState(entry);return `<div class="timeline-preview-scene" data-preview-scene><div class="timeline-pixi-preview" data-timeline-pixi-preview></div><div class="preview-dialogue style-${html(state.dialogue?.style||state.dialogue?.parameters?.style||"speech")}" data-preview-dialogue ${state.dialogue?"":"hidden"}>${previewDialogueMarkup(state)}</div><div class="preview-decision ${state.playerChoice?"preview-player-choice":""}" data-preview-prompt ${state.decision||state.playerChoice||state.waiting?"":"hidden"}>${previewPromptMarkup(state)}</div><div class="preview-active-events" data-preview-events>${previewEventChips(state)}</div><div class="preview-idle" data-preview-idle ${state.active.length||state.leadIn?"hidden":""}><b>${html(entry.name||"SPACE ACTION")}</b><span>${html(state.activation.label)} · press play to simulate</span></div></div>`;}
function mountTimelinePixiStage(entry,state=timelinePreviewState(entry)){const host=root.querySelector("[data-timeline-pixi-preview]");if(!host)return;mountTimelinePreviewRenderer(host,app.project.map,timelinePixiState(entry,state)).catch(error=>console.error("Timeline PIXI preview failed",error));}
function updateTimelinePreviewLive(entry){const scene=root.querySelector("[data-preview-scene]");if(!scene)return;const state=timelinePreviewState(entry);const set=(selector,content,visible,className="")=>{const node=scene.querySelector(selector);if(!node)return;node.hidden=!visible;if(className)node.className=className;const next=content||"";if(node.innerHTML!==next)node.innerHTML=next;};set("[data-preview-dialogue]",previewDialogueMarkup(state),Boolean(state.dialogue),`preview-dialogue style-${state.dialogue?.style||state.dialogue?.parameters?.style||"speech"}`);set("[data-preview-prompt]",previewPromptMarkup(state),Boolean(state.decision||state.playerChoice||state.waiting),`preview-decision ${state.playerChoice?"preview-player-choice":""}`);set("[data-preview-events]",previewEventChips(state),Boolean(previewEventChips(state)));const idle=scene.querySelector("[data-preview-idle]");if(idle)idle.hidden=state.active.length>0||state.leadIn;mountTimelinePixiStage(entry,state);}

function activationRulesPanel(entry) {
  const rules = (entry.activationRules || []).filter((rule) => rule.sequenceId === entry.activeSequenceId);
  return `<aside class="activation-rules-panel"><header><div><small>THIS SEQUENCE</small><b>ACTIVATIONS</b></div><button data-nav data-add-activation-rule title="Add activation">＋</button></header><div class="activation-rule-list">${rules.map((rule) => `<article class="activation-rule-card ${rule.enabled === false ? "disabled" : ""}" data-activation-rule="${html(rule.id)}"><div class="activation-rule-heading"><span>${rule.trigger === "land" ? "◎" : rule.trigger === "pass" ? "➜" : rule.trigger === "proximity" ? "◉" : "⚡"}</span><input data-activation-field="name" value="${html(rule.name || "Activation")}" aria-label="Activation name"><button data-nav data-edit-activation="${html(rule.id)}" title="Edit conditions and appearance">⚙</button><button data-nav data-delete-activation-rule="${html(rule.id)}" title="Delete activation">×</button></div><label>WHEN<select data-activation-field="trigger">${[["land","Land on space"],["pass","Pass over space"],["proximity","Enter proximity"],["interact","Player interacts"],["round-start","Round starts"],["game-start","Game starts"],["path-attempt","Attempts path exit"],["signal","Signal received"]].map(([id,label]) => `<option value="${id}" ${rule.trigger === id ? "selected" : ""}>${label}</option>`).join("")}</select></label><div class="activation-two-col"><label>MODE<select data-activation-field="mode">${[["blocking","Blocking"],["interrupt-movement","Interrupt movement"],["background","Background"]].map(([id,label]) => `<option value="${id}" ${rule.mode === id ? "selected" : ""}>${label}</option>`).join("")}</select></label><label>REPLAY<select data-activation-field="replay">${[["every-time","Every time"],["once","Once"],["once-per-player","Once / player"],["once-per-turn","Once / turn"],["once-per-round","Once / round"]].map(([id,label]) => `<option value="${id}" ${rule.replay === id ? "selected" : ""}>${label}</option>`).join("")}</select></label></div><div class="activation-rule-footer"><label><input type="checkbox" data-activation-field="enabled" ${rule.enabled !== false ? "checked" : ""}> ENABLED</label><span>PRIORITY <input type="number" min="0" max="100" data-activation-field="priority" value="${Number(rule.priority) || 50}"></span></div></article>`).join("") || `<p class="selector-empty">No activations run this sequence yet.</p>`}</div></aside>`;
}

function sequenceBar(entry) {
  const sequence = activeSpaceSequence(entry);
  return `<div class="sequence-bar"><div class="sequence-tabs">${(entry.sequences || []).map((item) => `<div class="sequence-tab-wrap ${item.id === entry.activeSequenceId ? "active" : ""}"><button data-nav data-select-sequence="${html(item.id)}"><span>▶</span>${html(item.name)}</button><button data-nav data-rename-sequence="${html(item.id)}" title="Rename sequence">✎</button></div>`).join("")}<button data-nav data-add-sequence class="add-sequence">＋ SEQUENCE</button></div><div class="sequence-actions"><span>${entry.timeline.tracks.reduce((total, track) => total + (track.clips?.length || 0), 0)} events</span>${(entry.sequences || []).length > 1 ? `<button data-nav data-delete-sequence="${html(sequence?.id || "")}" title="Delete current sequence">🗑</button>` : ""}</div></div>`;
}

function activationEditorModal(entry) {
  const rule = (entry.activationRules || []).find((item) => item.id === app.editingActivationId);
  if (!rule) return "";
  const condition = rule.condition || {};
  const appearance = rule.appearance || {};
  return `<div class="cmd-editor-modal-backdrop"><section class="activation-page-dialog"><header><div><small>SEQUENCE PAGE RULE</small><b>${html(rule.name || "Activation")}</b></div><button data-nav data-close-activation-editor>×</button></header><div class="activation-page-body"><section><h3>Activation logic</h3><p>All enabled requirements must pass before this sequence can become active.</p><label><input type="checkbox" data-activation-condition="enabled" ${condition.enabled ? "checked" : ""}> REQUIRE LOGIC</label><div class="activation-condition-grid"><label>VARIABLE<input data-activation-condition="variable" value="${html(condition.variable || "")}" placeholder="doorUnlocked"></label><label>COMPARISON<select data-activation-condition="operator">${[["equals","Equals"],["not-equals","Does not equal"],["greater","Greater than"],["at-least","At least"],["less","Less than"],["at-most","At most"],["truthy","Is true"],["falsy","Is false"]].map(([id,label]) => `<option value="${id}" ${condition.operator === id ? "selected" : ""}>${label}</option>`).join("")}</select></label><label>VALUE<input data-activation-condition="value" value="${html(condition.value ?? "true")}"></label><label>SCOPE<select data-activation-condition="scope">${["event","space","board"].map((scope) => `<option value="${scope}" ${condition.scope === scope ? "selected" : ""}>${scope.toUpperCase()}</option>`).join("")}</select></label></div></section><section><h3>Space appearance for this page</h3><p>When this sequence wins its activation logic, these values override the normal space visual.</p><div class="activation-condition-grid"><label>ICON<input data-activation-appearance="icon" value="${html(appearance.icon || "")}" placeholder="Keep default"></label><label>COLOR<select data-activation-appearance="color"><option value="">Keep default</option>${["violet","coral","cyan","gold","mint","ruby","dark","rainbow"].map((value) => `<option ${appearance.color === value ? "selected" : ""}>${value}</option>`).join("")}</select></label><label>SHAPE<select data-activation-appearance="shape"><option value="">Keep default</option>${["oval","round","star","diamond","hex","shield","none"].map((value) => `<option ${appearance.shape === value ? "selected" : ""}>${value}</option>`).join("")}</select></label><label>EFFECT<select data-activation-appearance="effect"><option value="">Keep default</option>${["sparkles","halo","pulse","fire","electric","spectral","stars","none"].map((value) => `<option ${appearance.effect === value ? "selected" : ""}>${value}</option>`).join("")}</select></label></div><div class="activation-appearance-preview">${renderSpaceToken({...entry.space,...appearance}, "stage-preview-token")}<div><b>${html(entry.name)}</b><small>${html(activeSpaceSequence(entry)?.name || "Sequence")}</small></div></div></section></div><footer><button data-nav data-close-activation-editor class="card-btn primary">DONE</button></footer></section></div>`;
}

function timelineValidation(entry) {
  const issues = [];
  if (!(entry.activationRules || []).length) issues.push("Add at least one activation entry point.");
  for (const rule of entry.activationRules || []) if (!(entry.sequences || []).some((sequence) => sequence.id === rule.sequenceId)) issues.push(`${rule.name || "Activation"} points to a missing sequence.`);
  const clips = entry.timeline.tracks.flatMap((track) => track.clips || []);
  if (!clips.length) issues.push("This sequence is empty.");
  for (const clip of clips) {
    if (isBranchingDecisionClip(clip) && !entry.timeline.tracks[entry.timeline.tracks.findIndex((track) => track.clips?.includes(clip)) + 1]) issues.push(`${clip.label || "Decision"} needs a branch lane.`);
    if (clip.category === "audio" && !clip.sfx && !clip.bgm) issues.push(`${clip.label || "Audio event"} has no sound selected.`);
  }
  return `<div class="timeline-validation ${issues.length ? "has-issues" : "valid"}"><span>${issues.length ? "⚠" : "✓"}</span><div><b>${issues.length ? `${issues.length} CHECK${issues.length === 1 ? "" : "S"} NEEDED` : "SEQUENCE READY"}</b><small>${issues[0] || "Activations and timeline structure are valid."}</small></div>${issues.length > 1 ? `<em>+${issues.length - 1} more</em>` : ""}</div>`;
}

function timelineLivePreview(entry) {
  return `<section class="timeline-live-preview" aria-label="Live cutscene preview"><header><span><i></i> LIVE PREVIEW</span><b>${html(entry.name || "Untitled Action")}</b><time>${(app.timelinePlayhead || 0).toFixed(1)}s</time></header><div id="timeline-live-preview-content">${timelinePreviewMarkup(entry)}</div></section>`;
}

function actorSettingsModal(entry) {
  const actors = ensureBoardActors();
  const actor = actors.find((item) => String(item.id) === String(app.actorEditorId)) || (entry?.characters || []).find((item) => String(item.id) === String(app.actorEditorId));
  if (!actor) return "";
  ensureRagdoll(actor);
  const tab = app.actorEditorTab === "animations" ? "ragdoll-animations" : (app.actorEditorTab || "ragdoll-animations");
  app.actorEditorTab = tab;
  return `<div class="actor-settings-backdrop"><section class="actor-settings-dialog"><header><div><small>ACTOR SETTINGS</small><b>${html(actor.name)}</b></div><button data-close-actor-settings>×</button></header><nav><button data-actor-settings-tab="details" class="${tab==="details"?"active":""}">DETAILS &amp; ANCHOR</button><button type="button" data-actor-settings-tab="ragdoll-paint" class="${tab==="ragdoll-paint"?"active":""}">RAGDOLL PAINT</button><button type="button" data-actor-settings-tab="ragdoll-infill" class="${tab==="ragdoll-infill"?"active":""}">RAGDOLL INFILL</button><button type="button" data-actor-settings-tab="ragdoll-test" class="${tab==="ragdoll-test"?"active":""}">RAGDOLL TEST</button><button type="button" data-actor-settings-tab="ragdoll-animations" class="${tab==="ragdoll-animations"?"active":""}">ANIMATIONS</button></nav>${tab==="details"?`<div class="actor-details-form"><label>ACTOR NAME<input data-actor-field="name" value="${html(actor.name)}"></label><label>ROLE<input data-actor-field="role" value="${html(actor.role||"Actor")}"></label><label>STAGE ANCHOR<select data-actor-field="anchor">${["left","center","right","float"].map(value=>`<option value="${value}" ${actor.anchor===value?"selected":""}>${value.toUpperCase()}</option>`).join("")}</select></label><p>The stage anchor is shared by the timeline preview and final board renderer.</p></div>`:`<div class="ragdoll-tab-host"></div>`}<footer><button class="card-btn primary" data-close-actor-settings>DONE</button></footer></section></div>`;
}

function computeTrackOverlapLayout(track) {
  const clips = track.clips || [];
  if (clips.length <= 1) {
    const clipLayout = new Map();
    if (clips[0]) clipLayout.set(clips[0].id, { layer: 0, top: 6, height: 62, isShrunk: false });
    return { trackHeight: 76, maxLayers: 1, clipLayout };
  }

  // Sort by start time ascending, then longer duration first
  const sorted = [...clips].sort((a, b) => (Number(a.start) || 0) - (Number(b.start) || 0) || (Number(b.duration) || 2) - (Number(a.duration) || 2));
  const layerEndTimes = [];
  const clipLayout = new Map();
  const END_BUFFER_SEC = 0.08; // Buffer threshold: contiguous or near-touching clips (start == end) do not overlap

  for (const clip of sorted) {
    const start = Number(clip.start || 0);
    const duration = Math.max(0.1, Number(clip.duration || 2.0));
    const end = start + duration;
    let assignedLayer = -1;

    for (let i = 0; i < layerEndTimes.length; i++) {
      if (start >= layerEndTimes[i] - END_BUFFER_SEC) {
        assignedLayer = i;
        layerEndTimes[i] = end;
        break;
      }
    }
    if (assignedLayer === -1) {
      assignedLayer = layerEndTimes.length;
      layerEndTimes.push(end);
    }
    clipLayout.set(clip.id, { layer: assignedLayer });
  }

  const maxLayers = Math.max(1, layerEndTimes.length);
  // Track height scales directly with number of overlapping layers: 1 layer = 76px (1x), 2 layers = 152px (2x), 3 layers = 228px (3x), etc.
  const trackHeight = maxLayers * 76;

  for (const [id, info] of clipLayout) {
    info.height = 62; // Clips maintain their full standard size
    info.top = 6 + info.layer * 76;
    info.isShrunk = false;
  }

  return { trackHeight, maxLayers, clipLayout };
}

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
      const isBranching = isBranchingDecisionClip(clip);
      if (isBranching && tIdx + 1 < timeline.tracks.length) {
        const branchTrack = timeline.tracks[tIdx + 1];
        branchLogicMap.set(branchTrack.id, { parentClip: clip, parentTrack: track, logicStart: clip.start || 0 });
      }
    });
  });
  timeline.tracks.forEach((track) => {
    if (!track.boundDecisionId) return;
    const found = findClipInTimeline(timeline, track.boundDecisionId);
    if (found) branchLogicMap.set(track.id, { parentClip:found.clip, parentTrack:found.track, logicStart:found.clip.start || 0, outcomeId:track.outcomeId });
  });

  // Calculate dynamic overlap layout per track
  const trackOverlapMap = new Map();
  timeline.tracks.forEach((track) => {
    trackOverlapMap.set(track.id, computeTrackOverlapLayout(track));
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
    const playbackState = timelineTrackState(timeline, track, playhead);
    const overlapInfo = trackOverlapMap.get(track.id) || { trackHeight: 76 };
    const laneHeight = overlapInfo.trackHeight;

    return `
      <div class="track-header-item ${isLocked ? "is-locked" : ""} ${app.timelineActiveTrackId === track.id ? "active-track" : ""} playback-${playbackState}" data-track-id="${html(track.id)}" style="height:${laneHeight}px;min-height:${laneHeight}px;">
        <div class="track-header-title-row">
          <span class="track-color-pip" style="background:var(--color-${track.color || "violet"}, #aa77ee);"></span>
          <b class="track-name-label" title="${html(track.name)}">${html(track.name)}</b>
        </div>
        <div class="track-header-tools-row">
          <div style="display:flex;gap:4px;">
            <button data-nav data-toggle-track-lock="${html(track.id)}" class="track-tool-btn ${isLocked ? "active-lock" : ""}" title="${isLocked ? "Unlock Track" : "Lock Track"}">
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
          ` : (timeline.tracks.length > 1 ? `
            <button data-nav data-delete-track="${html(track.id)}" class="track-tool-btn" style="color:#ee6655;" title="Delete Track">🗑</button>
          ` : "")}
        </div>
      </div>
    `;
  }).join("");

  const catIcons = {
    dialogue: "💬", camera: "📷", actors: "👤", vfx: "✨",
    inventory: "🎒", rewards: "🎒", logic: "🔀", world: "🌍", audio: "🎵", input: "🎮",
    flow:"⏵",assets:"◆",variables:"▣",selectors:"⌕",player:"♟",status:"⬆",board:"◎",stage:"▣",screen:"✨",minigame:"🎮",ui:"💬",sound:"♪"
  };

  const branchConnectors = [];

  // Right Canvas: Track Lanes & Clip Blocks
  const trackLanes = timeline.tracks.map((track, tIdx) => {
    const isLocked = track.locked === true;
    const boundInfo = branchLogicMap.get(track.id);
    const logicStart = boundInfo ? (boundInfo.logicStart || 0) : (track.kind === "branch-false" ? 2.0 : 0);
    const playbackState = timelineTrackState(timeline, track, playhead);
    const disablePoint = timelineTrackDisablePoint(track, playhead);
    const overlapInfo = trackOverlapMap.get(track.id) || { trackHeight: 76, clipLayout: new Map() };
    const laneHeight = overlapInfo.trackHeight;

    const clipsHtml = (track.clips || []).map((clip) => {
      const isSelected = (app.timelineSelectedClipIds && app.timelineSelectedClipIds.has(clip.id)) || app.timelineSelectedClipId === clip.id;
      const cat = clip.category || (clip.kind === "condition" ? "logic" : "dialogue");
      const isBranching = isBranchingDecisionClip(clip);
      const leftPx = (clip.start || 0) * pxPerSec;
      const widthPx = Math.max(48, (clip.duration || 2.0) * pxPerSec);

      const layout = overlapInfo.clipLayout?.get(clip.id) || { top: 6, height: 62, isShrunk: false };
      const topPx = layout.top ?? 6;
      const clipHeightPx = layout.height ?? 62;
      const isShrunk = layout.isShrunk === true;

      // Check if clip requires waiting for input
      const needsInput = clip.waitForInput === true || (clip.waitForInput !== false && (cat === "dialogue" || cat === "input" || isBranching || (clip.label && clip.label.toLowerCase().includes("prompt"))));

      // Overlapping Tall Logic/Input Block calculation
      const choiceOptions = clip.op === "choice" ? ensureChoiceOptions(clip) : null;
      const outcomeTrackCount = choiceOptions ? Math.max(1, choiceOptions.length - 1) : 1;
      const hasBranchBelow = isBranching && (tIdx + 1 < timeline.tracks.length);
      const isTallBlock = hasBranchBelow;

      const trueBandHeight = Math.max(62, laneHeight - 12);
      const branchBandsInfo = [];
      let totalTallHeight = trueBandHeight;

      if (isTallBlock) {
        for (let bi = 1; bi <= outcomeTrackCount && tIdx + bi < timeline.tracks.length; bi++) {
          const nextTrackId = timeline.tracks[tIdx + bi].id;
          const nextOverlap = trackOverlapMap.get(nextTrackId) || { trackHeight: 76 };
          const nextLaneHeight = nextOverlap.trackHeight;
          const bandHeight = Math.max(62, nextLaneHeight - 12);
          branchBandsInfo.push({ bandHeight, trackId: nextTrackId });
          totalTallHeight += 12 + bandHeight;
        }
      }

      // Calculate end-cap labels
      let upperCap = clip.parameters?.trueLabel ? clip.parameters.trueLabel.toUpperCase() : "TRUE";
      let lowerCap = clip.parameters?.falseLabel ? clip.parameters.falseLabel.toUpperCase() : "FALSE";
      if (clip.choice1) upperCap = clip.choice1.toUpperCase();
      if (clip.choice2) lowerCap = clip.choice2.toUpperCase();
      if (clip.passLabel) upperCap = clip.passLabel.toUpperCase();
      if (clip.failLabel) lowerCap = clip.failLabel.toUpperCase();
      if (clip.inputType === "prompt-yes-no") { upperCap = clip.parameters?.trueLabel?.toUpperCase() || "YES"; lowerCap = clip.parameters?.falseLabel?.toUpperCase() || "NO"; }
      else if (clip.inputType === "qte-mash") { upperCap = "PASS"; lowerCap = "FAIL"; }
      else if (clip.inputType === "reaction-stop") { upperCap = "WIN"; lowerCap = "LOSE"; }
      else if (clip.condType === "random-percent") { upperCap = "HEADS"; lowerCap = "TAILS"; }
      if (choiceOptions) { upperCap = choiceOptions[0]?.label || "OPTION 1"; lowerCap = choiceOptions[1]?.label || "OPTION 2"; }

      if (isTallBlock) {
        const branchChoices = choiceOptions ? choiceOptions.slice(1) : [{ label: lowerCap }];
        return `
          <div class="timeline-clip-block tall-logic-block cat-${cat} ${isSelected ? "clip-selected" : ""} ${isShrunk ? "is-shrunk" : ""}"
               data-clip-id="${html(clip.id)}"
               data-track-id="${html(track.id)}"
               style="left:${leftPx}px;top:6px;width:${widthPx}px;--logic-height:${totalTallHeight}px;height:${totalTallHeight}px;"
               title="${html(clip.label || "Decision / Split Action")} (Double-click to Edit)">
            
            <div class="clip-trim-handle left" data-clip-trim-left="${html(clip.id)}"></div>
            <div class="clip-trim-handle right" data-clip-trim-right="${html(clip.id)}"></div>
            ${needsInput ? `<span class="clip-stop-input-badge" title="Waits for player input">🕹️</span>` : ""}

            <!-- Top Lane: Main Condition / Choice 1 & continuation (Matches True Track) -->
            <div class="logic-lane-band" style="height:${trueBandHeight}px;min-height:${trueBandHeight}px;">
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

              <!-- Right-Hanging Upper Cap (True) -->
              <span class="logic-cap-tag true-cap">${html(upperCap)} ▶</span>
            </div>

            <!-- Lower Lane(s): Spans over the branch track(s) below, matching each branch track's height -->
            ${branchChoices.map((choice, index) => {
              const bInfo = branchBandsInfo[index] || { bandHeight: 64 };
              return `
                <div class="logic-lane-band branch-target-band" style="--choice-color:${html(choice.color || "#ee6655")};height:${bInfo.bandHeight}px;min-height:${bInfo.bandHeight}px;margin-top:12px;">
                  <div style="display:flex;align-items:center;height:100%;">
                    <span style="font-size:.62rem;font-weight:900;color:${html(choice.color || "#ff9988")};">
                      ${choiceOptions ? `◆ OPTION ${index + 2}` : "✕ OTHERWISE"} · ${html(choice.label || lowerCap)}
                    </span>
                  </div>
                  <span class="logic-cap-tag false-cap" style="background:${html(choice.color || "")}">
                    ${html(choice.label || lowerCap)} ▶
                  </span>
                </div>
              `;
            }).join("")}
          </div>
        `;
      }

      return `
        <div class="timeline-clip-block cat-${cat} ${isSelected ? "clip-selected" : ""} ${isShrunk ? "is-shrunk" : ""}"
             data-clip-id="${html(clip.id)}"
             data-track-id="${html(track.id)}"
             style="left:${leftPx}px;top:${topPx}px;width:${widthPx}px;height:${clipHeightPx}px;"
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
      <div class="timeline-track-lane ${isLocked ? "locked-lane" : ""} ${app.timelineActiveTrackId === track.id ? "active-track" : ""} playback-${playbackState}" data-track-id="${html(track.id)}" style="width:${totalPx}px;height:${laneHeight}px;min-height:${laneHeight}px;">
        ${(track.kind === "branch-false" || boundInfo) && logicStart > 0 ? `
          <div class="branch-pre-inactive-zone" style="width:${logicStart * pxPerSec}px;">
            <span class="pre-inactive-label">⛔ INACTIVE BEFORE DECISION POINT (${logicStart.toFixed(1)}s)</span>
          </div>
        ` : ""}
        ${clipsHtml}
        ${disablePoint != null ? `<div class="timeline-disabled-region" style="left:${disablePoint * pxPerSec}px"><span>PATH DISABLED</span></div>` : ""}
      </div>
    `;
  }).join("");

  const isPlaying = app.timelinePlaying === true;

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
          <button data-nav data-timeline-step class="transport-btn" title="Advance to the next event">▸ STEP</button>
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
    ["details", "📝 NAME & DETAILS"],
    ["visuals", "🎨 SPACE APPEARANCE"],
    ["cast", "👤 ACTOR & CAST"],
    ["script", "🎬 TIMELINE"]
  ].map(([id, label]) => `
    <button data-nav data-editor-tab="${id}" class="editor-tab-btn ${tab === id ? "active" : ""}">
      ${label}
    </button>
  `).join("");

  let tabContent = "";

  if (tab === "details") {
    tabContent = `<div class="action-details-tab">
      <div><small>SPACE ACTION</small><h2>Identity &amp; description</h2><p>Define how this action appears in the catalog and which board-space category it belongs to.</p></div>
      <div class="visuals-inputs">
        <div class="input-row-group"><label>SPACE ACTION NAME</label><input data-nav id="input-action-name" value="${html(entry.name)}" maxlength="60" placeholder="e.g. Haunted Harbor Ghost"></div>
        <div class="input-row-group"><label>SPACE TYPE CATEGORY</label><select data-nav id="input-action-type">${["event", "lucky", "blue", "red", "shop", "duel", "warp", "star", "mystery", "battle", "trap", "custom"].map((type) => `<option value="${type}" ${space.type === type ? "selected" : ""}>${type.toUpperCase()} SPACE</option>`).join("")}</select></div>
        <div class="input-row-group"><label>DESCRIPTION &amp; LORE</label><textarea data-nav id="input-action-desc" rows="5">${html(space.description)}</textarea></div>
      </div>
    </div>`;
  }

  // Tab 1: Visuals & Appearance
  else if (tab === "visuals") {
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
    const spaceCast = cast || [];
    const expandedActorId = app.spaceAppearanceActorId;
    const previewScale = app.spacePreviewScale || 1.0;

    tabContent = `
      <div class="visuals-form-grid">
        <div class="visuals-live-stage">
          <div style="display:flex;align-items:center;justify-content:space-between;width:100%;">
            <small style="color:#ffc83b;font-weight:900;letter-spacing:.14em;">LIVE SPACE PREVIEW</small>
            <small style="color:#ad99ce;font-size:.68rem;">Drag actors around the space to position</small>
          </div>
          <div class="space-preview-arena" id="space-preview-arena">
            <div class="space-preview-token-wrap" style="transform:scale(${previewScale});pointer-events:none;">
              ${renderSpaceToken(space, "stage-preview-token")}
            </div>
            ${spaceCast.map((char) => {
              const isSelected = expandedActorId && String(char.id) === String(expandedActorId);
              const isVisible = char.alwaysVisible !== false && char.visibleOnBoard !== false;
              const offX = Number(char.offsetX ?? 0) * previewScale;
              const offY = Number(char.offsetY ?? -34) * previewScale;
              const sc = Math.max(0.2, Number(char.scale ?? 1.0) * previewScale);
              return `
                <div class="space-preview-actor ${isSelected ? "selected" : ""} ${isVisible ? "is-visible" : "cutscene-only"}"
                     data-space-actor-drag="${html(char.id)}"
                     title="${html(char.name)}: Drag to position around space"
                     style="left:calc(50% + ${offX}px);top:calc(50% + ${offY}px);transform:translate(-50%,-50%) scale(${sc});cursor:grab;z-index:${isSelected ? 10 : 5};">
                  <div class="space-preview-actor-avatar">
                    ${char.sprite ? `<img src="${html(char.sprite)}" alt="${html(char.name)}" style="width:48px;height:48px;object-fit:contain;pointer-events:none;">` : `<span style="font-size:2.2rem;pointer-events:none;line-height:1;">${html(char.icon || (char.isHost ? "👑" : "👤"))}</span>`}
                    ${char.isHost ? `<span style="position:absolute;top:-6px;right:-6px;font-size:12px;filter:drop-shadow(0 1px 2px #000);">👑</span>` : ""}
                  </div>
                  <div class="space-preview-actor-tag">${html(char.name)}</div>
                  ${!isVisible ? `<span class="space-actor-hidden-badge">CUTSCENE ONLY</span>` : ""}
                </div>
              `;
            }).join("")}
          </div>

          <div style="display:flex;align-items:center;gap:10px;width:100%;font-size:.72rem;">
            <span style="color:#ad99ce;white-space:nowrap;">PREVIEW SPACE SIZE:</span>
            <input type="range" min="0.5" max="3.0" step="0.1" data-space-preview-scale value="${previewScale}" style="flex:1;">
            <b style="color:#ffe47a;min-width:32px;">${previewScale.toFixed(1)}x</b>
          </div>

          <b style="font-size:1.15rem;color:#fff;">${html(entry.name)}</b>
          ${space.customImage ? `<button data-nav data-remove-space-image class="cmd-btn danger" style="margin-top:2px;">✕ REMOVE CUSTOM IMAGE</button>` : ""}
        </div>

        <div class="visuals-inputs">
          <!-- Space Actors List & Folded Controls -->
          <div class="input-row-group actor-placement-group" style="border:2px solid rgba(84,214,130,.4);border-radius:12px;padding:16px;background:rgba(12,28,18,.65);">
            <div style="margin-bottom:12px;">
              <h3 style="margin:0;color:#54d682;font-size:.95rem;letter-spacing:.08em;">🎭 SPACE ACTORS &amp; PLACEMENT</h3>
              <small style="color:#c9bee6;font-size:.72rem;">Click an actor to fold/unfold their settings, toggle board visibility, and drag them in the preview arena.</small>
            </div>

            ${spaceCast.length ? `
              <div class="space-actors-list">
                ${spaceCast.map((char) => {
                  const isSelected = expandedActorId && String(char.id) === String(expandedActorId);
                  const isVisible = char.alwaysVisible !== false && char.visibleOnBoard !== false;
                  return `
                    <div class="space-actor-container ${isSelected ? "selected" : ""}" data-select-appearance-actor="${html(char.id)}">
                      <div class="space-actor-header">
                        <div class="space-actor-row-info">
                          <div class="space-actor-icon-preview">
                            ${char.sprite ? `<img src="${html(char.sprite)}" alt="${html(char.name)}" style="width:32px;height:32px;object-fit:contain;">` : `<span style="font-size:1.5rem;">${html(char.icon || (char.isHost ? "👑" : "👤"))}</span>`}
                          </div>
                          <div>
                            <b style="color:#fff;font-size:.84rem;display:flex;align-items:center;gap:6px;">
                              ${html(char.name)}
                              ${char.isHost ? `<span style="font-size:.65rem;color:#ffd55a;">👑 HOST</span>` : ""}
                            </b>
                            <small style="font-size:.7rem;color:${isVisible ? "#54d682" : "#ff9cab"};">
                              ${isVisible ? "● Visible on Board" : "○ Cutscene Only"}
                            </small>
                          </div>
                        </div>

                        <div style="display:flex;align-items:center;gap:6px;">
                          <button type="button" data-toggle-actor-visibility="${html(char.id)}" class="actor-visibility-btn ${isVisible ? "is-visible" : "is-hidden"}" title="${isVisible ? "Always visible on board (Click to hide)" : "Hidden on board (Click to show)"}">
                            ${isVisible ? `
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle></svg>
                              <span>ON BOARD</span>
                            ` : `
                              <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line></svg>
                              <span>HIDDEN</span>
                            `}
                          </button>
                          <button type="button" data-space-actor-remove="${html(char.id)}" class="cmd-btn danger" style="padding:4px 7px;font-size:.7rem;border-radius:6px;min-width:26px;" title="Remove ${html(char.name)} from this space">🗑</button>
                          <span style="color:#ad99ce;font-size:.7rem;display:inline-block;transform:${isSelected ? "rotate(90deg)" : "rotate(0deg)"};transition:transform .15s ease;pointer-events:none;margin-left:2px;">▶</span>
                        </div>
                      </div>

                      ${isSelected ? `
                        <div class="space-actor-folded-body">
                          <!-- Idle Animation Dropdown Folded Inside Actor -->
                          <div class="input-row-group" style="gap:4px;">
                            <label style="font-size:.65rem;color:#ffe47a;letter-spacing:.05em;">IDLE ANIMATION</label>
                            <select data-space-actor-field="animation" data-actor-id="${html(char.id)}" style="padding:7px 10px;font-size:.78rem;background:#100d24;">
                              ${(() => {
                                const allActors = ensureBoardActors();
                                const fullActor = allActors.find((a) => String(a.id) === String(char.id)) || char;
                                const anims = ragdollAnimations(fullActor);
                                if (anims && anims.length > 0) {
                                  return `
                                    <option value="" ${!char.animation && !char.idleAnimationId ? "selected" : ""}>Default Idle Pose</option>
                                    ${anims.map((a) => {
                                      const isSel = String(char.animation) === String(a.id) || String(char.idleAnimationId) === String(a.id);
                                      return `<option value="${html(a.id)}" ${isSel ? "selected" : ""}>${html(a.name || a.id)} (${Number(a.duration || 2).toFixed(1)}s)</option>`;
                                    }).join("")}
                                  `;
                                } else {
                                  return `
                                    <option value="idle" ${char.animation === "idle" || !char.animation ? "selected" : ""}>Idle Breathing</option>
                                    <option value="float" ${char.animation === "float" ? "selected" : ""}>Floating / Hover</option>
                                    <option value="bounce" ${char.animation === "bounce" ? "selected" : ""}>Gentle Bounce</option>
                                    <option value="pulse" ${char.animation === "pulse" ? "selected" : ""}>Pulse Beacon</option>
                                    <option value="still" ${char.animation === "still" ? "selected" : ""}>Still Stance</option>
                                  `;
                                }
                              })()}
                            </select>
                          </div>

                          <!-- Actor Size Modifier Folded Inside Actor -->
                          <div class="input-row-group" style="gap:4px;margin-top:6px;">
                            <label style="display:flex;justify-content:space-between;font-size:.65rem;color:#ffe47a;letter-spacing:.05em;">
                              <span>ACTOR SIZE (RELATIVE TO SPACE)</span>
                              <output style="color:#54d682;font-weight:bold;">${Number(char.scale ?? 1.0).toFixed(2)}x</output>
                            </label>
                            <input type="range" min="0.25" max="3.0" step="0.05" data-space-actor-field="scale" data-actor-id="${html(char.id)}" value="${Number(char.scale ?? 1.0)}">
                          </div>
                        </div>
                      ` : ""}
                    </div>
                  `;
                }).join("")}
              </div>

              <button type="button" data-open-space-actor-picker class="picker-btn primary" style="width:100%;margin-top:10px;padding:9px 14px;background:#1b4d2e;border-color:#54d682;color:#fff;font-size:.8rem;font-weight:900;display:flex;align-items:center;justify-content:center;gap:6px;">
                <span>＋</span> ADD ACTOR TO SPACE
              </button>
            ` : `
              <div style="padding:16px;text-align:center;background:rgba(0,0,0,.3);border-radius:8px;">
                <p style="margin:0 0 10px;font-size:.8rem;color:#c9bee6;">No actors assigned to this space yet.</p>
                <button type="button" data-open-space-actor-picker class="picker-btn primary" style="background:#1b4d2e;border-color:#54d682;padding:8px 16px;">＋ ADD ACTOR TO SPACE</button>
              </div>
            `}
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

        </div>
      </div>
    `;
  }

  // Tab 2: Characters & Cast
  else if (tab === "cast") {
    const boardActors = ensureBoardActors();
    const spaceCast = cast || [];
    const availableBoardActors = boardActors.filter((ba) => !spaceCast.some((sc) => String(sc.id) === String(ba.id)));

    const renderSpaceCastCard = (rawChar) => {
      const char = canonicalSpaceActor(rawChar) || rawChar;
      return `
      <div class="cast-card ${char.isHost ? "is-host" : ""}">
        <div class="cast-card-header">
          <div class="cast-avatar-box">
            ${char.sprite ? `<img src="${html(char.sprite)}" alt="${html(char.name)}">` : `<span>${html(char.icon || (char.isHost ? "👑" : "👤"))}</span>`}
          </div>
          <div>
            <div style="display:flex;align-items:center;gap:6px;">
              <b>${html(char.name)}</b>
              ${char.isHost ? `<span class="host-crown-badge">👑 STAGE HOST</span>` : ""}
            </div>
            <small style="display:block;color:#ffc83b;">${html(char.role || "Actor")} · ${html(char.anchor || "center")}</small>
          </div>
          <button type="button" data-nav data-cast-remove="${html(char.id)}" class="cmd-btn danger" style="margin-left:auto;" title="Remove from this space">🗑</button>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:.72rem;">
          <div><label style="color:#ad99ce;">POSE / MOTION</label><b>${html((char.animation || "float").toUpperCase())}</b></div>
          <div><label style="color:#ad99ce;">ANCHOR</label><b>${html((char.anchor || "center").toUpperCase())}</b></div>
        </div>
      </div>
    `;
    };

    tabContent = `
      <div>
        <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:16px;margin-bottom:16px;flex-wrap:wrap;">
          <div>
            <h3 style="margin:0;font-size:1.3rem;color:#ffe47a;">Space Cast &amp; Participating Actors</h3>
            <p style="margin:4px 0 0;color:#c9bee6;font-size:.8rem;">Choose which characters from the board's cast participate in this space's cutscenes.</p>
          </div>
          <button type="button" data-nav data-go="${boardEditorPath('actors')}" class="card-btn primary" style="white-space:nowrap;">
            🎭 OPEN HOST &amp; ACTORS WORKSHOP
          </button>
        </div>

        <div style="margin-bottom:24px;">
          <h4 style="margin:0 0 10px;color:#ffe47a;font-size:.85rem;letter-spacing:.1em;">CHARACTERS ON THIS SPACE (${spaceCast.length})</h4>
          ${spaceCast.length ? `
            <div class="cast-grid-wrapper">
              ${spaceCast.map(renderSpaceCastCard).join("")}
            </div>
          ` : `
            <div class="restore-host-box" style="padding:24px;text-align:center;">
              <span style="font-size:2.4rem;">👥</span>
              <b style="color:#ffe47a;font-size:1rem;">NO ACTORS ON THIS SPACE YET</b>
              <p style="margin:4px 0 12px;font-size:.78rem;color:#c9bee6;">Add actors from the board roster below to speak or animate in this cutscene.</p>
            </div>
          `}
        </div>

        <div style="margin-top:20px;padding-top:18px;border-top:2px solid rgba(255,255,255,.1);">
          <h4 style="margin:0 0 10px;color:#54d682;font-size:.85rem;letter-spacing:.1em;">＋ ADD BOARD ACTORS TO THIS SPACE</h4>
          ${availableBoardActors.length ? `
            <div style="display:flex;flex-wrap:wrap;gap:10px;">
              ${availableBoardActors.map((actor) => `
                <button type="button" data-nav data-add-board-actor-to-space="${html(actor.id)}" class="picker-btn" style="display:flex;align-items:center;gap:8px;padding:8px 14px;">
                  <span style="font-size:1.2rem;">${actor.sprite ? "🖼️" : html(actor.icon || (actor.isHost ? "👑" : "👤"))}</span>
                  <b>＋ ${html(actor.name)}</b>
                  <small style="color:#ffe47a;">(${html(actor.role || (actor.isHost ? "Host" : "Actor"))})</small>
                </button>
              `).join("")}
            </div>
          ` : `
            <p style="font-size:.8rem;color:#ad99ce;">All board actors are currently added to this space. To create new characters or adjust rigs and animations, open the Host &amp; Actors workshop.</p>
          `}
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
      <div class="cutscene-edit-workspace">
        ${sequenceBar(entry)}
        <div class="timeline-authoring-grid">
          ${activationRulesPanel(entry)}
          <div class="timeline-center-column">${timelineLivePreview(entry)}</div>
          <div class="timeline-full-width">${cutsceneTimelineView(entry)}${timelineValidation(entry)}</div>
        </div>
      </div>
    `;
  }

function spaceActorPickerModal(entry) {
  if (!app.spaceActorPickerOpen) return "";
  const boardActors = ensureBoardActors();
  const spaceChars = entry?.characters || [];

  return `
    <div class="map-modal-backdrop space-actor-picker-backdrop">
      <section class="map-inspector" style="width:min(560px,94vw);max-height:85vh;display:flex;flex-direction:column;border:3px solid #54d682;border-radius:14px;background:#0d0919;box-shadow:0 20px 80px #000;overflow:hidden;">
        <header style="display:flex;align-items:center;justify-content:space-between;padding:14px 18px;background:#17122e;border-bottom:1px solid #4e386d;">
          <div>
            <small style="color:#54d682;font-weight:900;letter-spacing:.1em;display:block;">BOARD ACTOR ROSTER</small>
            <b style="color:#fff;font-size:1.1rem;">ADD ACTOR TO SPACE</b>
          </div>
          <button type="button" data-close-space-actor-picker style="font-size:1.5rem;background:transparent;border:0;color:#fff;cursor:pointer;">×</button>
        </header>

        <div style="padding:16px;overflow-y:auto;flex:1;display:flex;flex-direction:column;gap:12px;">
          <p style="margin:0;font-size:.78rem;color:#c9bee6;">Choose a character from the board's actor roster to stand at this space:</p>
          ${boardActors.length ? `
            <div style="display:grid;grid-template-columns:repeat(auto-fill, minmax(230px, 1fr));gap:10px;">
              ${boardActors.map((actor) => {
                const alreadyAdded = spaceChars.some((c) => String(c.id) === String(actor.id));
                return `
                  <div style="display:flex;align-items:center;justify-content:space-between;padding:10px 12px;background:rgba(20,16,40,.85);border:2px solid ${alreadyAdded ? "rgba(84,214,130,.4)" : "rgba(255,255,255,.12)"};border-radius:10px;gap:8px;">
                    <div style="display:flex;align-items:center;gap:10px;min-width:0;">
                      <div style="width:36px;height:36px;display:grid;place-items:center;font-size:1.5rem;flex-shrink:0;">
                        ${actor.sprite ? `<img src="${html(actor.sprite)}" style="width:32px;height:32px;object-fit:contain;">` : html(actor.icon || (actor.isHost ? "👑" : "👤"))}
                      </div>
                      <div style="min-width:0;">
                        <b style="color:#fff;font-size:.82rem;display:block;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${html(actor.name)}</b>
                        <small style="color:#ffe47a;font-size:.68rem;">${html(actor.role || (actor.isHost ? "Host" : "Actor"))}</small>
                      </div>
                    </div>

                    ${alreadyAdded ? `
                      <span style="color:#54d682;font-size:.7rem;font-weight:bold;white-space:nowrap;padding:4px 8px;background:rgba(84,214,130,.15);border-radius:6px;">✓ IN SPACE</span>
                    ` : `
                      <button type="button" data-add-board-actor-to-space="${html(actor.id)}" class="card-btn primary" style="padding:6px 12px;font-size:.74rem;white-space:nowrap;">
                        ＋ ADD
                      </button>
                    `}
                  </div>
                `;
              }).join("")}
            </div>
          ` : `
            <div style="padding:24px;text-align:center;background:rgba(0,0,0,.3);border-radius:10px;">
              <p style="color:#c9bee6;margin:0 0 10px;font-size:.85rem;">No actors created on this board yet.</p>
              <button type="button" data-nav data-go="${boardEditorPath('actors')}" class="card-btn primary">🎭 CREATE ACTORS IN WORKSHOP</button>
            </div>
          `}
        </div>

        <footer style="padding:12px 18px;display:flex;align-items:center;justify-content:space-between;background:#17122e;border-top:1px solid #4e386d;">
          <button type="button" data-nav data-go="${boardEditorPath('actors')}" class="picker-btn" style="font-size:.75rem;">
            🎭 OPEN HOST &amp; ACTORS WORKSHOP
          </button>
          <button type="button" data-close-space-actor-picker class="card-btn primary" style="padding:7px 18px;">
            DONE
          </button>
        </footer>
      </section>
    </div>
  `;
}

  return frame(stationMeta.event, `
    <div class="space-editor-layout">
      <nav class="editor-sub-nav consolidated-editor-bar">
        <button data-nav data-back-to-catalog class="studio-back">◀ CATALOG</button>
        <div class="editor-action-title"><small>SPACE ACTION</small><b>${html(entry.name)}</b></div>
        <div class="editor-tabs-group">
          ${tabButtons}
        </div>
        <div class="editor-save-group">
          <button data-nav data-undo ${app.history.length ? "" : "disabled"} class="compact-history-btn" title="Undo">↶</button>
          <button data-nav data-redo ${app.future.length ? "" : "disabled"} class="compact-history-btn" title="Redo">↷</button>
          <button data-nav data-save-space-action class="card-btn primary">💾 SAVE ACTION</button>
        </div>
      </nav>

      <section class="tab-content-card ${tab === "script" ? "timeline-tab-content" : ""}">
        ${tabContent}
      </section>

      ${app.actionPickerOpen ? actionPickerModal() : ""}
      ${app.editingCommand ? commandEditorModal(entry) : ""}
      ${app.playerSelectorEditor ? playerSelectorDialog() : ""}
      ${app.valuePickerEditor ? typedValuePickerDialog() : ""}
      ${app.particlePickerEditor ? particlePickerDialog() : ""}
      ${activationEditorModal(entry)}
      ${actorSettingsModal(entry)}
      ${spaceActorPickerModal(entry)}
    </div>
  `, "", { compact: true });
}

function normalizePlayerSelector(value, multiple = false) {
  if (value && typeof value === "object" && value.kind === "player-selector") return structuredClone(value);
  const legacy = String(value || (multiple ? "All Players" : "Triggering Player"));
  return { kind:"player-selector", mode:"dynamic", seats:[], base:legacy === "All Players" ? "all" : legacy === "Active Player" ? "active" : "triggering", multiple:multiple || legacy === "All Players", filters:[], sort:{ by:"turn-order", direction:"ascending", asset:"Coins" }, limit:multiple || legacy === "All Players" ? 4 : 1, excludeTriggering:false, fallback:"triggering" };
}
function playerSelectorSummary(value) {
  const selector = normalizePlayerSelector(value);
  if (selector.mode === "reference") return `Variable: ${selector.reference || "selectedPlayer"}`;
  if (selector.mode === "specific") return selector.seats?.length ? selector.seats.map((seat) => `P${seat}`).join(", ") : "Choose seats";
  const base = {all:"All players",triggering:"Triggering player",active:"Active player"}[selector.base] || "Eligible players";
  const filters = selector.filters?.length ? ` · ${selector.filters.length} filter${selector.filters.length === 1 ? "" : "s"}` : "";
  const sorted = selector.sort?.by && selector.sort.by !== "turn-order" ? ` · ${selector.sort.by}` : "";
  return `${selector.multiple ? "Multiple: " : "One: "}${base}${filters}${sorted}`;
}
function availablePlayerReferences() {
  const entry = app.project.events.entries.find((item) => item.id === app.activeSpaceActionId) || app.project.events.entries[0];
  const references = new Set(["selectedPlayer"]);
  for (const sequence of entry?.sequences || []) for (const track of sequence.timeline?.tracks || []) for (const clip of track.clips || []) if (clip.parameters?.saveAs) references.add(String(clip.parameters.saveAs));
  for (const name of Object.keys(entry?.variables || {})) references.add(name);
  return [...references];
}
function playerSelectorDialog() {
  const editor = app.playerSelectorEditor;
  if (!editor) return "";
  const selector = editor.selector;
  const toys = ensureToyCatalogue(app.project.data);
  const fieldOptions = [["asset","Asset quantity"],["has-item","Has item"],["item-tag","Has item tag"],["status","Has status"],["no-status","Does not have status"],["rank","Current rank"],["is-leading","Is leading"],["is-last","Is in last place"],["distance","Distance from trigger"],["remaining-movement","Remaining movement"]];
  return `<div class="cmd-editor-modal-backdrop player-selector-backdrop"><section class="player-selector-dialog" role="dialog" aria-modal="true" aria-label="Player selector"><header><div><small>UNIVERSAL SELECTOR</small><b>Choose player target</b></div><button data-nav data-close-player-selector>×</button></header><div class="player-selector-body"><div class="selector-mode-tabs"><button data-nav data-player-selector-mode="dynamic" class="${selector.mode === "dynamic" ? "active" : ""}">⌕ DYNAMIC</button><button data-nav data-player-selector-mode="specific" class="${selector.mode === "specific" ? "active" : ""}">① SPECIFIC SEATS</button><button data-nav data-player-selector-mode="reference" class="${selector.mode === "reference" ? "active" : ""}">▣ VARIABLE / OUTPUT</button></div>${selector.mode === "specific" ? `<div class="seat-picker"><p>Select one or several player seats.</p>${[1,2,3,4].map((seat) => `<label class="${selector.seats.includes(seat) ? "selected" : ""}"><input type="checkbox" data-player-seat="${seat}" ${selector.seats.includes(seat) ? "checked" : ""}><span>PLAYER ${seat}</span><small>P${seat}</small></label>`).join("")}</div>` : selector.mode === "reference" ? `<div class="player-reference-picker"><div><small>PLAYER VARIABLES &amp; OUTPUTS</small><b>Use a previously selected player</b><p>The value is resolved when the event runs, so later actions can target the player chosen earlier.</p></div><div class="reference-chip-grid">${availablePlayerReferences().map((reference) => `<button data-nav data-player-reference="${html(reference)}" class="${(selector.reference || "selectedPlayer") === reference ? "selected" : ""}"><span>▣</span><b>${html(reference)}</b><small>PLAYER REFERENCE</small></button>`).join("")}</div><label>CUSTOM VARIABLE NAME<input data-player-selector-field="reference" value="${html(selector.reference || "selectedPlayer")}" placeholder="selectedPlayer"></label></div>` : `<div class="selector-builder"><div class="selector-basics"><label>STARTING POOL<select data-player-selector-field="base"><option value="triggering" ${selector.base === "triggering" ? "selected" : ""}>Triggering player</option><option value="active" ${selector.base === "active" ? "selected" : ""}>Active-turn player</option><option value="all" ${selector.base === "all" ? "selected" : ""}>All four players</option></select></label><label>RESULT SHAPE<select data-player-selector-field="multiple"><option value="false" ${!selector.multiple ? "selected" : ""}>One player</option><option value="true" ${selector.multiple ? "selected" : ""}>Multiple players</option></select></label><label class="selector-checkbox"><input type="checkbox" data-player-selector-field="excludeTriggering" ${selector.excludeTriggering ? "checked" : ""}> Exclude triggering player</label></div><section class="selector-filters"><header><div><b>FILTERS</b><small>All filters must match</small></div><button data-nav data-add-player-filter>＋ ADD FILTER</button></header>${(selector.filters || []).map((filter,index) => `<div class="selector-filter-row" data-player-filter-index="${index}"><select data-player-filter-field="field">${fieldOptions.map(([id,label]) => `<option value="${id}" ${filter.field === id ? "selected" : ""}>${label}</option>`).join("")}</select><select data-player-filter-field="operator">${[["equals","equals"],["not-equals","does not equal"],["at-least","at least"],["at-most","at most"],["has","has"],["not-has","does not have"]].map(([id,label]) => `<option value="${id}" ${filter.operator === id ? "selected" : ""}>${label}</option>`).join("")}</select>${filter.field === "asset" || filter.field === "has-item" ? `<select data-player-filter-field="subject">${toys.map((toy) => `<option value="${html(toy.id)}" ${filter.subject === toy.id ? "selected" : ""}>${html(toy.icon)} ${html(toy.name)}</option>`).join("")}</select>` : `<input data-player-filter-field="subject" value="${html(filter.subject || "")}" placeholder="Value or name">`}<input type="number" data-player-filter-field="value" value="${Number(filter.value) || 0}" aria-label="Comparison value"><button data-nav data-delete-player-filter="${index}">×</button></div>`).join("") || `<p class="selector-empty">No filters—all players in the pool are eligible.</p>`}</section><div class="selector-output"><label>SORT RESULTS<select data-player-sort="by">${[["turn-order","Turn order"],["random","Random authoritative order"],["rank","Current ranking"],["asset","ToyBox asset amount"],["distance-nearest","Nearest to trigger"],["distance-farthest","Farthest from trigger"],["remaining-movement","Remaining movement"]].map(([id,label]) => `<option value="${id}" ${selector.sort.by === id ? "selected" : ""}>${label}</option>`).join("")}</select></label>${selector.sort.by === "asset" ? `<label>ASSET<select data-player-sort="asset">${toys.map((toy) => `<option value="${html(toy.id)}" ${selector.sort.asset === toy.id ? "selected" : ""}>${html(toy.icon)} ${html(toy.name)}</option>`).join("")}</select></label>` : ""}<label>DIRECTION<select data-player-sort="direction"><option value="ascending" ${selector.sort.direction === "ascending" ? "selected" : ""}>Lowest / nearest first</option><option value="descending" ${selector.sort.direction === "descending" ? "selected" : ""}>Highest / farthest first</option></select></label><label>MAX RESULTS<input type="number" min="1" max="4" data-player-selector-field="limit" value="${selector.multiple ? Math.max(1,Math.min(4,Number(selector.limit)||4)) : 1}" ${selector.multiple ? "" : "disabled"}></label><label>IF NONE MATCH<select data-player-selector-field="fallback"><option value="triggering" ${selector.fallback === "triggering" ? "selected" : ""}>Use triggering player</option><option value="random" ${selector.fallback === "random" ? "selected" : ""}>Use random player</option><option value="empty" ${selector.fallback === "empty" ? "selected" : ""}>Return no players</option><option value="cancel" ${selector.fallback === "cancel" ? "selected" : ""}>Cancel sequence</option></select></label></div></div>`}</div><footer><div><small>RESULT</small><b>${html(playerSelectorSummary(selector))}</b></div><button data-nav data-close-player-selector>CANCEL</button><button data-nav data-save-player-selector class="primary">USE SELECTOR</button></footer></section></div>`;
}

function typedValueSummary(type, value) {
  if (type === "space-picker" && value && typeof value === "object") return value.mode === "specific" ? `Space ${value.spaceId || "not selected"}` : `${value.selector || "This Space"}${value.tag ? ` · #${value.tag}` : ""}`;
  if (type === "toy-picker") { const toy = ensureToyCatalogue(app.project?.data).find((item) => item.id === value || item.name === value); return toy ? `${toy.icon || "◆"} ${toy.name}` : String(value || "Choose ToyBox asset"); }
  return String(value || "Choose value");
}
function typedValuePickerDialog() {
  const editor = app.valuePickerEditor;
  if (!editor) return "";
  if (editor.type === "color-picker") {
    const colors = ["#ffffff","#080d20","#ff4055","#ff8a3d","#ffc83b","#54d682","#35c9ff","#8b5ce6","#ff69b4","#000000"];
    return `<div class="cmd-editor-modal-backdrop typed-picker-backdrop"><section class="typed-picker-dialog color-picker-dialog" role="dialog" aria-modal="true" aria-label="Color picker"><header><div><small>UNIVERSAL PICKER</small><b>Choose color</b></div><button type="button" data-nav data-close-value-picker>×</button></header><div class="typed-picker-body"><input class="large-color-input" type="color" data-color-picker-value value="${html(editor.value || "#ffffff")}"><div class="color-swatch-grid">${colors.map((color) => `<button type="button" data-nav data-pick-color="${color}" style="--swatch:${color}" title="${color}"></button>`).join("")}</div><label>HEX COLOR<input data-color-picker-text value="${html(editor.value || "#ffffff")}" maxlength="9"></label></div><footer><button type="button" data-nav data-close-value-picker>CANCEL</button><button type="button" data-nav data-save-value-picker class="primary">USE COLOR</button></footer></section></div>`;
  }
  if (editor.type === "toy-picker") {
    const toys = ensureToyCatalogue(app.project?.data), categories = [...new Set(toys.map((toy) => toy.category || "other"))];
    return `<div class="cmd-editor-modal-backdrop typed-picker-backdrop"><section class="typed-picker-dialog" role="dialog" aria-modal="true" aria-label="Toybox item picker"><header><div><small>TOYBOX</small><b>Choose asset or item</b></div><button type="button" data-nav data-close-value-picker>×</button></header><div class="typed-picker-body"><div class="typed-picker-search"><input id="typed-picker-search" type="search" placeholder="Search assets, items, tags…"><select id="typed-picker-category"><option value="all">All categories</option>${categories.map((category) => `<option value="${html(category)}">${html(category.toUpperCase())}</option>`).join("")}</select></div><div class="toy-picker-grid">${toys.map((toy) => `<button type="button" data-nav data-pick-toy="${html(toy.id)}" data-picker-search="${html(`${toy.name} ${toy.category} ${toy.description || ""}`.toLowerCase())}" data-picker-category="${html(toy.category || "other")}" class="${editor.value === toy.id || editor.value === toy.name ? "selected" : ""}"><span>${html(toy.icon || "◆")}</span><div><b>${html(toy.name)}</b><small>${html(toy.category || "Other")} · ${html(toy.description || "")}</small></div></button>`).join("")}</div></div><footer><div><small>SELECTED</small><b>${html(typedValueSummary(editor.type, editor.value))}</b></div><button type="button" data-nav data-close-value-picker>CANCEL</button><button type="button" data-nav data-save-value-picker class="primary">USE ASSET</button></footer></section></div>`;
  }
  const selector = editor.value && typeof editor.value === "object" ? editor.value : { kind:"space-selector", mode:"dynamic", selector:"This Space", spaceId:"", tag:"", filters:{ type:"any", traversable:"any", visible:"any" }, sort:"nearest" };
  editor.value = selector;
  const spaces = app.project?.map?.spaces || [];
  return `<div class="cmd-editor-modal-backdrop typed-picker-backdrop"><section class="typed-picker-dialog" role="dialog" aria-modal="true" aria-label="Space picker"><header><div><small>UNIVERSAL SELECTOR</small><b>Choose space or board reference</b></div><button type="button" data-nav data-close-value-picker>×</button></header><div class="typed-picker-body"><div class="selector-mode-tabs"><button type="button" data-nav data-space-picker-mode="dynamic" class="${selector.mode !== "specific" ? "active" : ""}">⌕ DYNAMIC</button><button type="button" data-nav data-space-picker-mode="specific" class="${selector.mode === "specific" ? "active" : ""}">◎ SPECIFIC SPACE</button></div>${selector.mode === "specific" ? `<div class="space-picker-grid">${spaces.map((space) => `<button type="button" data-nav data-pick-space="${space.id}" class="${String(selector.spaceId) === String(space.id) ? "selected" : ""}">${renderSpaceToken(space,"picker-space-token")}<div><b>SPACE ${space.id}</b><small>${html(space.type || "space")} ${space.activity?.title ? `· ${html(space.activity.title)}` : ""}</small></div></button>`).join("") || `<p>No board spaces are available.</p>`}</div>` : `<div class="space-selector-builder"><label>RESOLVE TO<select data-space-selector-field="selector">${["This Space","Triggering Player's Space","Selected Player's Space","External Space Reference","Space With Tag","Random Matching Space","Nearest Matching Space","Previous Space On Route","Next Space On Route"].map((option) => `<option ${selector.selector === option ? "selected" : ""}>${option}</option>`).join("")}</select></label><label>REFERENCE / TAG<input data-space-selector-field="tag" value="${html(selector.tag || "")}" placeholder="e.g. Villain Lair or shop"></label><div class="space-filter-grid"><label>SPACE TYPE<select data-space-filter-field="type"><option value="any">Any type</option>${["event","lucky","blue","red","shop","duel","warp","trap","custom"].map((type) => `<option value="${type}" ${selector.filters?.type === type ? "selected" : ""}>${type.toUpperCase()}</option>`).join("")}</select></label><label>TRAVERSABLE<select data-space-filter-field="traversable"><option value="any">Either</option><option value="yes" ${selector.filters?.traversable === "yes" ? "selected" : ""}>Traversable</option><option value="no" ${selector.filters?.traversable === "no" ? "selected" : ""}>Scene anchor only</option></select></label><label>VISIBILITY<select data-space-filter-field="visible"><option value="any">Either</option><option value="yes" ${selector.filters?.visible === "yes" ? "selected" : ""}>Visible</option><option value="no" ${selector.filters?.visible === "no" ? "selected" : ""}>Hidden</option></select></label><label>SORT<select data-space-selector-field="sort"><option value="nearest" ${selector.sort === "nearest" ? "selected" : ""}>Nearest first</option><option value="farthest" ${selector.sort === "farthest" ? "selected" : ""}>Farthest first</option><option value="random" ${selector.sort === "random" ? "selected" : ""}>Random authoritative</option><option value="route" ${selector.sort === "route" ? "selected" : ""}>Route order</option></select></label></div></div>`}</div><footer><div><small>RESULT</small><b>${html(typedValueSummary(editor.type, selector))}</b></div><button type="button" data-nav data-close-value-picker>CANCEL</button><button type="button" data-nav data-save-value-picker class="primary">USE SPACE</button></footer></section></div>`;
}

function ensureChoiceOptions(cmd) {
  cmd.parameters ||= {};
  if (!Array.isArray(cmd.parameters.choices)) {
    const labels = String(cmd.parameters.choices || "Yes, No").split(",").map((label) => label.trim()).filter(Boolean);
    cmd.parameters.choices = (labels.length >= 2 ? labels : ["Yes","No"]).map((label,index) => ({ id:`choice-${index + 1}`, label, value:label.toLowerCase().replace(/[^a-z0-9]+/g,"-"), color:["#54d682","#ff6655","#35c9ff","#ffc83b"][index % 4] }));
  }
  return cmd.parameters.choices;
}
function presentChoiceEditorFields(cmd) {
  const choices = ensureChoiceOptions(cmd);
  return `<div class="primitive-editor-intro"><span>◇</span><div><b>PRESENT CHOICE</b><small>Each option creates an exclusive outcome track. Only the chosen track runs.</small></div></div><div class="cmd-editor-field"><label>PROMPT</label><textarea id="edit-choice-prompt" rows="3">${html(cmd.parameters.prompt || "Choose an option")}</textarea></div><div class="choice-option-editor"><header><div><b>CHOICES &amp; OUTCOME TRACKS</b><small>Drag events onto the matching tracks after saving.</small></div><button type="button" data-nav data-add-choice-option>＋ ADD CHOICE</button></header>${choices.map((choice,index) => `<article data-choice-option="${index}"><span class="choice-index">${index + 1}</span><label>BUTTON LABEL<input data-choice-field="label" value="${html(choice.label)}" maxlength="40"></label><label>OUTPUT VALUE<input data-choice-field="value" value="${html(choice.value)}" maxlength="40"></label><label>COLOR<input type="color" data-choice-field="color" value="${html(choice.color || "#54d682")}"></label><button type="button" data-nav data-delete-choice-option="${index}" ${choices.length <= 2 ? "disabled" : ""}>×</button></article>`).join("")}</div><div class="choice-settings-grid"><label class="primitive-check"><input id="edit-choice-cancel" type="checkbox" ${cmd.parameters.allowCancel ? "checked" : ""}><span>ALLOW CANCEL</span></label><div class="cmd-editor-field"><label>STORE CHOICE AS</label><input id="edit-choice-output" value="${html(cmd.parameters.saveAs || "selectedChoice")}" maxlength="48"></div></div>`;
}
function parameterOptions(key) {
  return {
    operation:["Add","Subtract","Set","Multiply","Clamp","Toggle","Remove","Add Duration","Add Stacks"],
    scope:["Event","Space","Board","Game","Player"],
    comparison:["Equals","Does not equal",">=","<=",">","<","Has","Does not have"],
    easing:["Linear","Ease In","Ease Out","Ease In Out","Back Out","Elastic Out","Bounce Out"],
    direction:["To","From","Up","Down","Left","Right","ascending","descending"],
    unit:["Turns","Rounds","Activations","Seconds","Spaces"],
    activationPropagation:["Normal","Suppress Landing Events","Suppress Pass Events","Suppress All Space Events","Only Explicit Events"],
    style:["Speech","Thought","Shout","Banner","Toast"],
    formation:["Semicircle","Line","Circle","2 vs 2","1 vs 3","Facing Host","Custom Anchors"],
    transition:["Cut","Fade","Wipe","Iris","Zoom"],
    space:["World","Screen"],
    field:["Winner","Losers","Ranking","Score per player","Success","Custom output"],
    teams:["Free for all","1 vs 3","2 vs 2","Co-op","Custom"],
    status:["Sluggish","Speedy","Poisoned","Frozen","Shielded","Cursed","Double Roll","Confused","Invincible","Burned"],
    sound:["coin","star-fanfare","thunder-strike","warp-pipe","dice-roll","chest","mystery","lose","laugh","whistle"],
    music:["Event Theme","Rainshadow Reach","Suspense Theme","Haunted Mansion Theme","Bonus Round Fanfare","Silence (Dramatic Pause)"],
    game:["Choose Minigame","Mega Man Challenge","Super Mario Race","Challenge Lab QTE","Custom Minigame"],
    filter:["Any","Consumable","Key Item","Dice","Power-Up","Equipment"],
    anchor:["Actor","Center","Left","Right","Above Space","Player Stage 1","Player Stage 2"],
    animation:["Appear Pop","Disappear Pop","Fade In","Fade Out","Slide In","Slide Out","Bounce","Float","Pulse"],
    emote:["Happy Bounce","Shocked","Alert !","Heart","Skull","Spark","Idea","Angry"],
    mode:["Dim","Show","Hide","Blocking","Background","Interrupt Movement"],
    waitFor:["Previous event","Player Input","Movement Completion","Sequence Finish"],
    query:["Current Round","Current Turn","Active Player ID","Player Ranking","Leader (1st Place)","Last Place","Turns Remaining"],
    target:["This Space","Triggering Player","Active Player","Primary Actor","Stage Center","Full Board"],
    targets:["All Players","All Opponents","Triggering Player & Host","All Stage Actors"]
  }[key] || null;
}
function parameterRange(key, value) {
  const ranges = { volume:[0,1,.05], intensity:[0,1,.05], zoom:[.25,4,.05], duration:[0,30,.1], seconds:[0,60,.1], strength:[0,1,.05], padding:[0,50,1], deadZone:[0,50,1], frequency:[1,60,1], amount:[-999,999,1], minimumSelections:[1,4,1], maximumSelections:[1,4,1], limit:[1,4,1] };
  return typeof value === "number" ? ranges[key] : null;
}
function canonicalSpaceActor(actor){return ensureBoardActors().find(item=>String(item.id)===String(actor?.id))||actor||null;}
function selectedSpaceActor(cast,value){return canonicalSpaceActor(cast.find(actor=>String(actor.id)===String(value))||cast.find(actor=>actor.name===value)||cast[0]);}
function actorPickerOptions(cast,value){return cast.length?cast.map(assigned=>{const actor=canonicalSpaceActor(assigned);return `<option value="${html(actor.id)}" ${String(actor.id)===String(value)||actor.name===value?"selected":""}>${actor.isHost?"👑":"🎭"} ${html(actor.name)} · ${html(actor.role||"Actor")}</option>`;}).join(""):`<option value="">No actors assigned to this space</option>`;}
function particlePickerOptions(value){const particles=ensureEffects().filter(e=>(e.kind||"particle")==="particle");return particles.length?particles.map(p=>`<option value="${html(p.id)}" ${String(p.id)===String(value)||p.name===value?"selected":""}>${html(p.icon||"✦")} ${html(p.name)} (${html(p.shape||"circle").toUpperCase()})</option>`).join(""):`<option value="">No particles created yet</option>`;}
function ragdollAnimationPickerOptions(actor,value){const animations=ragdollAnimations(actor),idleId=actor?.idleAnimationId||actor?.ragdoll?.idleAnimationId;return animations.length?animations.map(animation=>{const isIdle=String(animation.id)===String(idleId);return `<option value="${html(animation.id)}" ${String(animation.id)===String(value)?"selected":""}>${html(animation.name||"Untitled")}${isIdle?" (⭐ Idle)":""} · ${Number(animation.duration||2).toFixed(1)}s · ${animation.snapshots?.length||0} poses</option>`;}).join(""):`<option value="">No ragdoll animations created</option>`;}

function syncActorToAllSpaceActions(actorId, oldName, updatedActor) {
  if (!updatedActor || !app.project?.events?.entries) return;
  const entries = app.project.events.entries;
  let changed = false;
  const actorIdStr = String(actorId || updatedActor.id || "");
  const oldNameNorm = (oldName || "").trim();
  const oldNameUpper = oldNameNorm.toUpperCase();
  const newNameNorm = (updatedActor.name || "").trim();
  const newNameUpper = newNameNorm.toUpperCase();

  for (const entry of entries) {
    if (Array.isArray(entry.characters)) {
      for (let i = 0; i < entry.characters.length; i++) {
        const char = entry.characters[i];
        if (String(char.id) === actorIdStr || (oldNameNorm && char.name === oldNameNorm)) {
          entry.characters[i] = {
            ...char,
            id: updatedActor.id || char.id,
            name: updatedActor.name,
            role: updatedActor.role || char.role,
            isHost: Boolean(updatedActor.isHost),
            icon: updatedActor.icon || char.icon,
            sprite: updatedActor.sprite ?? char.sprite,
            anchor: updatedActor.anchor || char.anchor || "center",
            animation: updatedActor.animation || char.animation || "float",
            animations: updatedActor.animations || char.animations || [],
            idleAnimationId: updatedActor.idleAnimationId || updatedActor.ragdoll?.idleAnimationId || char.idleAnimationId,
            ragdoll: updatedActor.ragdoll || char.ragdoll
          };
          changed = true;
        }
      }
    }
    const updateClipOrCmd = (item) => {
      if (!item) return;
      const isTarget = String(item.actorId || "") === actorIdStr || (oldNameNorm && (item.target === oldNameNorm || item.parameters?.actor === oldNameNorm));
      if (isTarget) {
        item.actorId = updatedActor.id;
        item.target = updatedActor.name;
        if (item.parameters && typeof item.parameters.actor === "string") {
          item.parameters.actor = updatedActor.name;
        }
        if (item.label && oldNameUpper && item.label.toUpperCase().startsWith(oldNameUpper + ":")) {
          item.label = `${newNameUpper}:${item.label.slice(oldNameUpper.length + 1)}`;
        }
        changed = true;
      }
      const isSpeaker = (oldNameNorm && (item.speaker === oldNameNorm || item.parameters?.speaker === oldNameNorm)) || String(item.speakerId || "") === actorIdStr;
      if (isSpeaker) {
        item.speaker = updatedActor.name;
        if (item.parameters && typeof item.parameters.speaker === "string") {
          item.parameters.speaker = updatedActor.name;
        }
        if (item.label && oldNameNorm && item.label.startsWith(oldNameNorm + ":")) {
          item.label = `${newNameNorm}:${item.label.slice(oldNameNorm.length + 1)}`;
        }
        changed = true;
      }
    };
    if (entry.timeline?.tracks) {
      for (const track of entry.timeline.tracks) {
        for (const clip of track.clips || []) {
          updateClipOrCmd(clip);
        }
      }
    }
    if (Array.isArray(entry.commands)) {
      const walkCmds = (cmds) => {
        for (const cmd of cmds) {
          updateClipOrCmd(cmd);
          if (Array.isArray(cmd.children)) walkCmds(cmd.children);
          if (Array.isArray(cmd.branches)) {
            for (const b of cmd.branches) if (Array.isArray(b.children)) walkCmds(b.children);
          }
        }
      };
      walkCmds(entry.commands);
    }
  }
  if (changed) {
    save("event");
  }
}

function syncSpaceActionToMapSpaces(actionId, action) {
  if (!app.project?.map?.spaces || !action) return;
  const chars = (action.characters || []).map((char) => ({
    id: char.id,
    name: char.name,
    icon: char.icon,
    sprite: char.sprite,
    color: char.color,
    offsetX: Number(char.offsetX ?? 0),
    offsetY: Number(char.offsetY ?? -34),
    scale: Number(char.scale ?? 1.0),
    alwaysVisible: char.alwaysVisible !== false && char.visibleOnBoard !== false,
    isHost: Boolean(char.isHost),
    animation: char.animation || "float",
    idleAnimationId: char.idleAnimationId || char.ragdoll?.idleAnimationId,
    ragdoll: char.ragdoll,
    spriteSheet: char.spriteSheet,
    spriteX: char.spriteX,
    spriteY: char.spriteY
  }));
  for (const space of app.project.map.spaces) {
    if (space.action === actionId || space.activity?.id === actionId) {
      space.actors = structuredClone(chars);
      if (action.space?.shape) space.shape = action.space.shape;
      if (action.space?.color) space.color = action.space.color;
    }
  }
}

// --- Action Inspector / Command Edit Modal ---
function actorStageEffectsMarkup(cmd){
  const dump=cmd.particleDump||{},particle=ensureEffects().find(effect=>effect.id===dump.effectId),count=Math.max(1,Math.min(300,Number(dump.count)||24));
  return `<section class="actor-stage-effect-editor"><header><div><small>STAGE TRANSITION</small><h4>SPAWN / DESPAWN EFFECT</h4></div><span>${cmd.actorAction==="despawn"||["despawn-actor","despawn"].includes(cmd.op)?"EXIT":"ENTRANCE"}</span></header><div class="actor-stage-effect-grid"><label>EFFECT<select id="edit-cmd-stage-effect">${["none","fade","fade-from-black","fade-from-white","teleport","warp-gate","pixel-dissolve","smoke-poof","starburst","confetti-pop","spiral","drop-in","bounce-in","slide-in","shrink-pop","glitch","lightning-strike"].map(effect=>`<option value="${effect}" ${cmd.stageEffect===effect?"selected":""}>${effect.replaceAll("-"," ").toUpperCase()}</option>`).join("")}</select></label><div class="actor-particle-picker-field"><label>ACTOR-SHAPED PARTICLE DUMP</label><button type="button" data-nav data-open-particle-picker><span class="particle-picker-mini-preview shape-${html(dump.shape||particle?.shape||"circle")}" style="--particle-color:${html(particle?.color||"#8deaaa")};--particle-color-2:${html(particle?.colorEnd||particle?.color||"#ffffff")}"><i></i><i></i><i></i></span><div><b>${particle?`${html(particle.icon||"✦")} ${html(particle.name)}`:"NO PARTICLE PRESET"}</b><small>${count} particles · ${html(dump.shape||particle?.shape||"circle").toUpperCase()}</small></div><em>CHOOSE ▸</em></button></div></div><small class="actor-stage-effect-help">The selected reusable particle preset bursts from the actor silhouette during this transition.</small></section>`;
}

function particlePickerDialog(){
  const picker=app.particlePickerEditor,particles=ensureEffects().filter(effect=>effect.kind==="particle"),selected=particles.find(effect=>effect.id===picker.effectId),shape=picker.shape||selected?.shape||"circle",color=selected?.color||"#8deaaa",colorEnd=selected?.colorEnd||color,title=picker.kind==="transition"?"Choose a transition burst":picker.kind==="placement"?"Choose a controller particle":picker.kind==="timeline-param"?"Choose a particle preset":"Choose a particle spawn";
  const previewParticles=Array.from({length:18},(_,index)=>`<i style="--delay:-${(index%6)*.23}s;--tx:${((index%6)-2.5)*22}px;--ty:${-22-Math.floor(index/6)*25}px"></i>`).join("");
  return `<div class="cmd-editor-modal-backdrop particle-picker-backdrop"><section class="particle-picker-dialog" role="dialog" aria-modal="true" aria-label="Particle picker"><header><div><small>REUSABLE PARTICLE PICKER</small><b>${title}</b></div><button type="button" data-nav data-close-particle-picker>×</button></header><div class="particle-picker-body"><section class="particle-picker-library"><header><b>PARTICLE PRESETS</b><small>${particles.length} reusable effects</small></header><div class="particle-preset-grid"><button type="button" data-nav data-pick-transition-particle="" class="particle-preset-card none ${selected?"":"selected"}"><span>∅</span><div><b>NO PARTICLES</b><small>Use only the parent effect</small></div></button>${particles.map(effect=>`<button type="button" data-nav data-pick-transition-particle="${html(effect.id)}" class="particle-preset-card ${picker.effectId===effect.id?"selected":""}"><span class="particle-card-shape shape-${html(effect.shape||"circle")}" style="--particle-color:${html(effect.color||"#fff")};--particle-color-2:${html(effect.colorEnd||effect.color||"#fff")}"></span><div><b>${html(effect.icon||"✦")} ${html(effect.name)}</b><small>${html(effect.shape||"circle").toUpperCase()} · ${Number(effect.size||4)}px</small></div></button>`).join("")}</div></section><aside class="particle-picker-settings"><div class="particle-picker-preview shape-${html(shape)}" style="--effect-color:${html(color)};--effect-color-2:${html(colorEnd)};--effect-life:${Math.max(.4,Number(selected?.degradeTime||1.4))}s;--effect-opacity:${Number(selected?.opacity??1)};--size:${Math.max(4,Number(selected?.size||6))}px;--end:${Math.max(2,Number(selected?.sizeEnd||selected?.size||6))}px"><div class="preview-grid"></div><span class="preview-emitter"></span><div class="preview-particles">${previewParticles}</div></div><label>TOTAL PARTICLES <output>${Number(picker.count||24)}</output><input type="range" min="1" max="300" step="1" data-particle-picker-field="count" value="${Number(picker.count||24)}"></label><label>BURST SHAPE<select data-particle-picker-field="shape">${["circle","square","line","star","leaf"].map(value=>`<option value="${value}" ${shape===value?"selected":""}>${value.toUpperCase()}</option>`).join("")}</select></label><p>${selected?`Uses <b>${html(selected.name)}</b> and keeps its authored color, size, motion, and lifetime.`:"No particle preset is selected."}</p></aside></div><footer><div><small>SELECTION</small><b>${selected?html(selected.name):"No particles"} · ${Number(picker.count||24)} total</b></div><button type="button" data-nav data-close-particle-picker>CANCEL</button><button type="button" data-nav data-save-particle-picker class="primary">USE PARTICLES</button></footer></section></div>`;
}

function commandEditorModal(entry) {
  const target = app.editingCommand;
  if (!target || !target.cmd) return "";
  const cmd = target.cmd;
  const cast = entry.characters || [];
  const cat = cmd.category || "dialogue";
  const labelTitle = cmd.label ? cmd.label.split(":")[0].replace(/^✏️\s*/, "") : cat.toUpperCase();

  let fields = "";

  if (cmd.op === "dialogue" || cat === "dialogue") {
    const spkVal = cmd.speaker || cmd.parameters?.speaker || "Active Player";
    const styVal = (cmd.style || cmd.parameters?.style || "speech").toLowerCase();
    fields = `
      <div class="primitive-editor-intro">
        <span>💬</span>
        <div><b>DIALOGUE &amp; SPEECH BUBBLE</b><small>Portrait dialogue with character portrait, speaker, style, and text.</small></div>
      </div>
      <div class="cmd-editor-field">
        <label>SPEAKER (PORTRAIT &amp; ACTOR)</label>
        <select id="edit-cmd-speaker">
          <option value="Active Player" ${spkVal === "Active Player" ? "selected" : ""}>👤 Active Player</option>
          ${cast.map((c) => {
            const actor = canonicalSpaceActor(c) || c;
            return `
            <option value="${html(actor.name)}" ${spkVal === actor.name ? "selected" : ""}>
              ${actor.isHost ? "👑 " : "🎭 "}${html(actor.name)} (${html(actor.role || "Actor")})
            </option>
          `;
          }).join("")}
          <option value="Narrator" ${spkVal === "Narrator" ? "selected" : ""}>📢 Narrator (Voiceover)</option>
        </select>
      </div>

      <div class="cmd-editor-field">
        <label>DIALOGUE TEXT / MESSAGE</label>
        <textarea id="edit-cmd-text" rows="3" placeholder="Enter message text...">${html(cmd.text || cmd.parameters?.text || cmd.label || "")}</textarea>
      </div>

      <div class="cmd-editor-field">
        <label>SPEECH BUBBLE STYLE</label>
        <select id="edit-cmd-style">
          <option value="speech" ${styVal === "speech" ? "selected" : ""}>💬 Speech Bubble (Standard)</option>
          <option value="thought" ${styVal === "thought" ? "selected" : ""}>💭 Thought Bubble</option>
          <option value="shout" ${styVal === "shout" ? "selected" : ""}>💥 Shout / Warning (Bold)</option>
          <option value="banner" ${styVal === "banner" ? "selected" : ""}>📢 Celebratory Banner Overlay</option>
          <option value="toast" ${styVal === "toast" ? "selected" : ""}>🔔 Mini Toast Notification</option>
        </select>
      </div>
    `;
  } else if (cmd.op === "confirm") {
    const p = cmd.parameters || {};
    fields = `
      <div class="primitive-editor-intro">
        <span>✓</span>
        <div><b>CONFIRM PROMPT &amp; BRANCHES</b><small>Ask for player confirmation. Creates True and False outcome tracks.</small></div>
      </div>
      <div class="cmd-editor-field">
        <label>CONFIRMATION PROMPT TEXT</label>
        <textarea id="edit-confirm-prompt" rows="2" placeholder="e.g. Would you like to buy a Star for 20 Coins?">${html(p.prompt || cmd.prompt || "Are you sure?")}</textarea>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">
        <div class="cmd-editor-field">
          <label style="color:#54d682;">PRIMARY TRACK / TRUE LABEL</label>
          <input type="text" id="edit-confirm-true" value="${html(p.trueLabel || cmd.choice1 || "YES")}" placeholder="e.g. YES / ACCEPT / CONFIRM">
        </div>
        <div class="cmd-editor-field">
          <label style="color:#ff8877;">BRANCH TRACK / FALSE LABEL</label>
          <input type="text" id="edit-confirm-false" value="${html(p.falseLabel || cmd.choice2 || "NO")}" placeholder="e.g. NO / DECLINE / CANCEL">
        </div>
      </div>
    `;
  } else if (cmd.op === "choice") {
    fields = presentChoiceEditorFields(cmd);
  } else if (Array.isArray(cmd.parameterSchema) && cmd.parameterSchema.length > 0) {
    fields = `<div class="primitive-editor-intro"><span>${html(cmd.icon || "⚡")}</span><div><b>${html(cmd.label || "Timeline Event")}</b><small>${html(cmd.desc || "Configure this event's runtime parameters.")}</small></div></div><div class="primitive-parameter-grid">${cmd.parameterSchema.map((parameter) => {
      const value = cmd.parameters?.[parameter.key];
      if (parameter.type === "actor-picker" || actorParameterKeys.has(parameter.key) || (cmd.op === "select-actor" && parameter.key === "selector")) return `<div class="cmd-editor-field"><label>${html(parameter.label)}</label><select data-generic-param="${html(parameter.key)}" data-space-actor-picker>${actorPickerOptions(cast,value)}</select><small>Only actors assigned in this Space Action’s Cast tab are available.</small></div>`;
      if (parameter.type === "animation-picker" || animationParameterKeys.has(parameter.key)) { const actor=selectedSpaceActor(cast,cmd.parameters?.actor); return `<div class="cmd-editor-field"><label>${html(parameter.label)}</label><select data-generic-param="${html(parameter.key)}" data-ragdoll-animation-picker>${ragdollAnimationPickerOptions(actor,value)}</select><small>Ragdoll animation for ${html(actor?.name||"the selected actor")}.</small></div>`; }
      if (parameter.type === "player-selector" || playerParameterKeys.has(parameter.key) || (cmd.op === "select-player" && parameter.key === "selector")) return `<div class="cmd-editor-field selector-parameter"><label>${html(parameter.label)}</label><button type="button" data-nav data-open-player-selector="${html(parameter.key)}"><span>👥</span><div><b>${html(playerSelectorSummary(value))}</b><small>Open universal player selector</small></div><em>EDIT ▸</em></button></div>`;
      if (parameter.type === "particle-picker" || particleParameterKeys.has(parameter.key)) {
        const particles = ensureEffects().filter(e => (e.kind || "particle") === "particle");
        const selectedParticle = particles.find(p => String(p.id) === String(value) || p.name === value) || particles[0];
        const currentId = selectedParticle?.id || value || "";
        return `<div class="cmd-editor-field selector-parameter"><label>${html(parameter.label)}</label><div style="display:flex;gap:8px;align-items:center;"><select data-generic-param="${html(parameter.key)}" style="flex:1;">${particlePickerOptions(currentId)}</select><button type="button" data-nav data-open-particle-param-picker="${html(parameter.key)}" style="white-space:nowrap;padding:7px 12px;font-size:12px;display:flex;align-items:center;gap:6px;" title="Open Visual Particle Browser"><span class="particle-picker-mini-preview shape-${html(selectedParticle?.shape || "circle")}" style="--particle-color:${html(selectedParticle?.color || "#8deaaa")};--particle-color-2:${html(selectedParticle?.colorEnd || selectedParticle?.color || "#ffffff")};width:16px;height:16px;display:inline-block;vertical-align:middle;"></span>BROWSE ▸</button></div><small>Authored board particles from Special Effects.</small></div>`;
      }
      const inferredPicker = parameter.type === "toy-picker" || toyParameterKeys.has(parameter.key) ? "toy-picker" : parameter.type === "space-picker" || spaceParameterKeys.has(parameter.key) ? "space-picker" : parameter.type === "color-picker" || parameter.key.toLowerCase().includes("color") ? "color-picker" : "";
      if (inferredPicker) return `<div class="cmd-editor-field selector-parameter"><label>${html(parameter.label)}</label><button type="button" data-nav data-open-value-picker="${html(parameter.key)}" data-picker-type="${inferredPicker}"><span>${inferredPicker === "toy-picker" ? "◆" : inferredPicker === "space-picker" ? "◎" : "🎨"}</span><div><b>${html(typedValueSummary(inferredPicker,value))}</b><small>Open ${inferredPicker.replace("-", " ")}</small></div><em>EDIT ▸</em></button></div>`;
      if (parameter.type === "boolean") return `<label class="primitive-check"><input type="checkbox" data-generic-param="${html(parameter.key)}" ${value ? "checked" : ""}><span>${html(parameter.label)}</span></label>`;
      const options = parameterOptions(parameter.key);
      if (options) return `<div class="cmd-editor-field"><label>${html(parameter.label)}</label><select data-generic-param="${html(parameter.key)}">${options.map((option) => `<option value="${html(option)}" ${String(value).toLowerCase() === option.toLowerCase() ? "selected" : ""}>${html(option)}</option>`).join("")}</select></div>`;
      const range = parameterRange(parameter.key, value);
      if (range) return `<div class="cmd-editor-field parameter-range"><label>${html(parameter.label)} <output>${html(value)}</output></label><input data-generic-param="${html(parameter.key)}" type="range" min="${range[0]}" max="${range[1]}" step="${range[2]}" value="${html(value)}"></div>`;
      if (["prompt","text","note","outcomes","offers","cases","faces"].includes(parameter.key)) return `<div class="cmd-editor-field parameter-wide"><label>${html(parameter.label)}</label><textarea data-generic-param="${html(parameter.key)}" rows="3">${html(value ?? "")}</textarea></div>`;
      return `<div class="cmd-editor-field"><label>${html(parameter.label)}</label><input data-generic-param="${html(parameter.key)}" type="${parameter.type === "number" ? "number" : "text"}" value="${html(value ?? "")}"></div>`;
    }).join("")}</div>` + (["spawn-actor","despawn-actor","spawn","despawn"].includes(cmd.op) ? actorStageEffectsMarkup(cmd) : "");
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
  } else if (cat === "actors" || cmd.actorAction === "spawn" || cmd.actorAction === "despawn" || ["spawn-actor","despawn-actor","spawn","despawn"].includes(cmd.op)) {
    const selectedActor = selectedSpaceActor(cast, cmd.actorId || cmd.target);
    fields = `
      <div class="cmd-editor-field">
        <label>TARGET ACTOR</label>
        <select id="edit-cmd-actor-target" data-space-actor-picker>
          ${actorPickerOptions(cast,selectedActor?.id)}
        </select>
        <small>Actors are managed in this Space Action’s Cast tab.</small>
      </div>

      <div class="cmd-editor-field">
        <label>ACTION / BEHAVIOR</label>
        <select id="edit-cmd-actor-action">
          <option value="pose" ${cmd.actorAction === "pose" ? "selected" : ""}>🤸 Play Pose Animation</option>
          <option value="emote" ${cmd.actorAction === "emote" ? "selected" : ""}>💭 Pop Emote Balloon</option>
          <option value="move" ${cmd.actorAction === "move" ? "selected" : ""}>🏃 Hop / Move to Position</option>
          <option value="spawn" ${cmd.actorAction === "spawn" || ["spawn-actor","spawn"].includes(cmd.op) ? "selected" : ""}>✨ Spawn on Stage</option>
          <option value="despawn" ${cmd.actorAction === "despawn" || ["despawn-actor","despawn"].includes(cmd.op) ? "selected" : ""}>💨 Despawn (Poof Disappear)</option>
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
      <div class="cmd-editor-field">
        <label>RAGDOLL ANIMATION</label>
        <select id="edit-cmd-animation" data-ragdoll-animation-picker>
          ${ragdollAnimationPickerOptions(selectedActor,cmd.animationId)}
        </select>
        <small>Only animations authored in the selected actor’s Ragdoll Animations tab are shown.</small>
      </div>
      <div class="cmd-editor-field">
        <label>SMOOTH TRANSITION</label>
        <select id="edit-cmd-transition"><option value="crossfade" ${cmd.transition!=="none"?"selected":""}>Crossfade / blend</option><option value="none" ${cmd.transition==="none"?"selected":""}>Immediate</option></select>
      </div>
      ${actorStageEffectsMarkup(cmd)}
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
  } else if (cat === "logic") {
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
          <h2>✏️ Edit Event Action · ${html(labelTitle)}</h2>
          <button data-nav data-close-cmd-editor class="modal-close-window-btn" title="Close Window">✕</button>
        </header>

        <div class="cmd-editor-body">
          ${fields}

          <div class="cmd-editor-field"><label>EVENT LENGTH / ANIMATION SPEED (SECONDS)</label><input id="edit-cmd-duration" type="number" min=".1" max="60" step=".1" value="${Number(cmd.duration||2)}"><small>The selected animation is time-scaled smoothly to this block length.</small></div>

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

const playerParameterKeys = new Set(["player", "players", "buyer", "recipient", "participants", "challenger", "opponent", "from", "to", "choosingPlayer", "eligiblePlayers"]);
const toyParameterKeys = new Set(["asset", "costAsset", "rewardAsset", "wagerAsset", "stakeAsset", "item"]);
const spaceParameterKeys = new Set(["space", "connection", "reference"]);
const actorParameterKeys = new Set(["actor"]);
const animationParameterKeys = new Set(["animation"]);
const particleParameterKeys = new Set(["particle", "preset", "particleId", "effectId"]);
const timelineBlock = (category, op, label, icon, desc, parameters = {}) => ({
  category, op, label, icon, desc, parameters,
  parameterSchema: Object.entries(parameters).map(([key, value]) => ({ key, label: key.replace(/([A-Z])/g, " $1").replace(/^./, (char) => char.toUpperCase()), type: actorParameterKeys.has(key) || (op === "select-actor" && key === "selector") ? "actor-picker" : animationParameterKeys.has(key) ? "animation-picker" : playerParameterKeys.has(key) || (op === "select-player" && key === "selector") ? "player-selector" : toyParameterKeys.has(key) ? "toy-picker" : spaceParameterKeys.has(key) ? "space-picker" : particleParameterKeys.has(key) ? "particle-picker" : key.toLowerCase().includes("color") ? "color-picker" : typeof value === "boolean" ? "boolean" : typeof value === "number" ? "number" : "text" })),
  waitForInput: ["dialogue", "choice", "confirm", "choose-player", "select-player", "select-asset", "select-item", "select-space", "select-quantity", "launch-minigame", "trade-menu"].includes(op)
});

function completeTimelineBlockLibrary() {
  const b = timelineBlock;
  const firstParticle = ensureEffects().find(effect => (effect.kind || "particle") === "particle");
  const defaultPreset = firstParticle ? firstParticle.id : "";
  return {
    flow: [
      b("flow","entry","ENTRY · Begin sequence","⏵","Named starting point for this sequence.",{entryName:"Main"}), b("flow","end","END · Complete sequence","⏹","Finish normally and release owned resources."), b("flow","delay","DELAY","◷","Wait in event time without blocking unrelated background events.",{seconds:1}), b("flow","barrier","FLOW BARRIER","⏸","Do not advance until the selected interaction or action completes.",{waitFor:"Previous event"}), b("flow","call-sequence","CALL SEQUENCE","↗","Run a reusable Space, Board, or Game sequence.",{scope:"Space",sequence:"Main Event",wait:true}), b("flow","return","RETURN","↩","Return to the sequence that called this one."), b("flow","cancel-sequence","CANCEL SEQUENCE","⊘","Cancel a selected concurrently running sequence.",{sequence:"Sequence name"}), b("flow","cancel-event","CANCEL EVENT","■","Safely terminate the whole Space Action and run cleanup."), b("flow","emit-signal","EMIT SIGNAL","⌁","Broadcast a named signal to board systems and other spaces.",{signal:"gate.opened",payload:""}), b("flow","checkpoint","CHECKPOINT","⚑","Create a safe resume/debug point.",{name:"Checkpoint"}), b("flow","comment","COMMENT / ANNOTATION","✎","Add a non-executing note to the timeline.",{note:"Explain this section"})
    ],
    assets: [
      b("assets","modify-asset","MODIFY ASSET","＋","Add, subtract, multiply, clamp, or toggle any ToyBox quantity.",{player:"Triggering Player",asset:"Coins",operation:"Add",amount:10}), b("assets","set-asset","SET ASSET","＝","Set a ToyBox asset quantity exactly.",{player:"Triggering Player",asset:"Coins",amount:0}), b("assets","transfer-asset","TRANSFER ASSET","⇄","Move an asset atomically between players, pots, or board holders.",{from:"Triggering Player",to:"Selected Player",asset:"Coins",amount:10}), b("assets","grant-asset","GRANT INVENTORY ASSET","🎁","Grant a stacked, unique, key, collection, or equipment asset.",{player:"Triggering Player",asset:"Skeleton Key",amount:1}), b("assets","remove-asset","REMOVE ASSET","−","Remove or consume an asset from a holder.",{player:"Triggering Player",asset:"Skeleton Key",amount:1}), b("assets","transaction","ATOMIC TRANSACTION","⇆","Consume multiple requirements and grant results only if the whole trade succeeds.",{buyer:"Triggering Player",costAsset:"Coins",cost:20,rewardAsset:"Star",reward:1}), b("assets","check-assets","CHECK ASSETS","?","Branch on possession, quantity, capacity, tags, or eligibility.",{player:"Triggering Player",asset:"Coins",comparison:">=",amount:20}), b("assets","trade-menu","TRADE MENU / SHOP","🛒","Present one or more ToyBox-backed offers and return purchase or cancel outputs.",{player:"Triggering Player",offers:"Offer Set",allowMultiple:false}), b("assets","deposit","DEPOSIT TO POT","🏦","Take an asset from a player and add it to a persistent named pot.",{player:"Triggering Player",asset:"Coins",amount:5,pot:"Bank Pot"}), b("assets","withdraw-pot","WITHDRAW POT","💰","Transfer the contents of a named persistent pot to a player.",{player:"Triggering Player",pot:"Bank Pot"}), b("assets","toll","COLLECT TOLL","🚧","Collect a pass-event resource with paid, declined, and cannot-afford outputs.",{player:"Triggering Player",asset:"Coins",amount:5}), b("assets","service-purchase","SERVICE PURCHASE","🤝","Charge an asset then emit success, decline, or cannot-afford output.",{player:"Triggering Player",asset:"Coins",amount:10,service:"Service"})
    ],
    variables: [
      b("variables","set-variable","SET VARIABLE","▣","Assign an Event, Space, or Board variable.",{scope:"Space",name:"Opened",value:"true"}), b("variables","modify-variable","MODIFY VARIABLE","±","Add, subtract, multiply, clamp, append, or toggle a variable.",{scope:"Space",name:"Visits",operation:"Add",value:1}), b("variables","copy-value","COPY OUTPUT TO VARIABLE","⧉","Store a selector, query, choice, random, or minigame output.",{output:"Previous Result",scope:"Event",name:"result"}), b("variables","query-state","QUERY GAME STATE","⌕","Read turn, round, ranking, movement, player, space, or board state.",{query:"Current Round",saveAs:"round"}), b("variables","compare","DECISION / COMPARE","◇","Create exclusive true and false branch regions.",{left:"Variable",comparison:"Equals",right:"true"}), b("variables","weighted-random","WEIGHTED RANDOM","🎲","Exclusive weighted outcomes with eligibility, cooldown, and no-repeat behavior.",{outcomes:"Outcome A:50, Outcome B:50",noRepeat:true}), b("variables","switch","SWITCH / MULTI-CASE","⑂","Route one value into several exclusive branch regions.",{value:"Event.result",cases:"A, B, Default"}), b("variables","for-each-player","FOR EACH PLAYER","♻","Run a nested region once for each selected player.",{players:"All Players",order:"Turn order"}), b("variables","loop","BOUNDED LOOP","↻","Repeat a region with mandatory iteration protection.",{count:3,maxIterations:20})
    ],
    selectors: [
      b("selectors","select-player","SELECT PLAYER","👥","Resolve triggering, active, ranked, random, nearest, farthest, or filtered players.",{selector:"Triggering Player",saveAs:"selectedPlayer"}), b("selectors","select-asset","SELECT ASSET","◆","Choose a specific ToyBox asset, tag match, random eligible asset, or previous output.",{selector:"Specific Asset",asset:"Coins",saveAs:"selectedAsset"}), b("selectors","select-item","SELECT INVENTORY ITEM","🎒","Let a player choose an eligible inventory item.",{player:"Triggering Player",filter:"Any",saveAs:"selectedItem"}), b("selectors","select-space","SELECT SPACE / REFERENCE","◎","Resolve this space, player space, external reference, tag, route neighbor, or previous output.",{selector:"This Space",reference:"",saveAs:"selectedSpace"}), b("selectors","select-quantity","SELECT QUANTITY","＃","Ask for a bounded amount and return it.",{minimum:1,maximum:10,saveAs:"quantity"}), b("selectors","select-actor","SELECT ACTOR","♙","Resolve primary, secondary, spawned, or previous actor output.",{selector:"Primary Actor",saveAs:"selectedActor"})
    ],
    player: [
      b("player","pause-movement","PAUSE BOARD MOVEMENT","⏸","Suspend logical movement while preserving remaining steps."), b("player","resume-movement","RESUME BOARD MOVEMENT","▶","Continue safely from preserved remaining movement."), b("player","modify-movement","MODIFY REMAINING MOVEMENT","±","Add, subtract, set, multiply, or reverse remaining movement.",{player:"Triggering Player",operation:"Add",amount:3}), b("player","cancel-movement","CANCEL REMAINING MOVEMENT","■","End the current movement intentionally.",{player:"Triggering Player"}), b("player","move-board","MOVE ALONG BOARD","➜","Move through real board connections with activation propagation control.",{player:"Triggering Player",steps:3,activationPropagation:"Normal"}), b("player","teleport","TELEPORT PLAYER","✦","Move logically to a symbolic Space reference.",{player:"Triggering Player",space:"Selected Space",activationPropagation:"Suppress Landing Events"}), b("player","set-space","SET PLAYER BOARD SPACE","⌖","Set logical position immediately without cinematic movement.",{player:"Triggering Player",space:"Selected Space",activationPropagation:"Only Explicit Events"}), b("player","gather-players","GATHER PLAYERS","👥","Temporarily arrange selected players at named stage anchors.",{players:"All Players",stage:"This Space",formation:"Semicircle"}), b("player","restore-players","RESTORE PLAYER PRESENTATION","↩","Restore saved visual locations without changing logical board spaces."), b("player","lock-input","LOCK PLAYER INPUT","🔒","Acquire input ownership for a blocking interaction.",{players:"Triggering Player"}), b("player","release-input","RELEASE PLAYER INPUT","🔓","Return input to normal board controls.")
    ],
    status: [
      b("status","apply-status","APPLY STATUS","⬆","Apply a data-defined status with duration and stacking policy.",{player:"Triggering Player",status:"Sluggish",duration:2,unit:"Turns"}), b("status","remove-status","REMOVE STATUS","✕","Remove a selected status or matching status tag.",{player:"Triggering Player",status:"Sluggish"}), b("status","modify-status","MODIFY STATUS","±","Change status duration, stacks, or configured value.",{player:"Triggering Player",status:"Sluggish",operation:"Add Duration",amount:1}), b("status","check-status","CHECK STATUS","?","Branch based on status presence, stacks, duration, or tags.",{player:"Triggering Player",status:"Sluggish"})
    ],
    board: [
      b("board","enable-connection","ENABLE CONNECTION","🔓","Open a symbolic board path connection.",{connection:"External Reference"}), b("board","disable-connection","DISABLE CONNECTION","🔒","Close a connection with route-safety validation.",{connection:"External Reference"}), b("board","toggle-connection","TOGGLE CONNECTION","⇆","Switch a connection between enabled and disabled.",{connection:"External Reference"}), b("board","force-connection","FORCE NEXT CONNECTION","➜","Force the selected player's next route edge.",{player:"Triggering Player",connection:"External Reference"}), b("board","request-path","REQUEST PATH CHOICE","⑂","Open route selection and return the chosen connection.",{player:"Triggering Player",saveAs:"chosenPath"}), b("board","set-space-enabled","SET SPACE ENABLED","◉","Enable or disable a symbolic space target.",{space:"External Reference",enabled:true}), b("board","activate-space","ACTIVATE ANOTHER SPACE","⚡","Explicitly invoke another space with nested-event protection.",{space:"External Reference",activation:"Default"}), b("board","change-space-state","CHANGE SPACE STATE","◈","Change visual/behavioral state of a target space.",{space:"This Space",state:"Activated"}), b("board","spawn-object","SPAWN BOARD OBJECT","⬟","Create a temporary or persistent board object at an anchor.",{object:"Object",target:"This Space.Center",persistent:false}), b("board","remove-object","REMOVE BOARD OBJECT","⌫","Remove a spawned board object.",{object:"Previous Object"})
    ],
    stage: [
      b("stage","enter-stage","ENTER CINEMATIC STAGE","▣","Save board presentation and transition actors/players to a named stage.",{stage:"Local Stage",transition:"Fade",music:"Keep Current"}), b("stage","exit-stage","EXIT STAGE / RESTORE BOARD","□","Restore board camera, HUD, music, actors, and player presentation."), b("stage","create-local-stage","CREATE LOCAL BOARD STAGE","⌂","Arrange a scene around the current space while keeping the board visible.",{formation:"Semicircle"}), b("stage","create-anchor","CREATE NAMED ANCHOR","⌖","Create or update a reusable actor, player, camera, or particle anchor.",{name:"Player Stage 1",x:50,y:50}), b("stage","spawn-actor","SPAWN ACTOR","♙","Spawn a configured actor into a named anchor.",{actor:"Primary Actor",anchor:"Actor",animation:"Appear Pop"}), b("stage","despawn-actor","DESPAWN ACTOR","♙","Remove a temporary actor with an exit animation.",{actor:"Primary Actor",animation:"Disappear Pop"}), b("stage","transform-actor","ANIMATE ACTOR TRANSFORM","↝","Keyframe position, rotation, scale, opacity, tint, and easing.",{actor:"Primary Actor",anchor:"Center",duration:1,easing:"Ease Out"}), b("stage","actor-emote","ACTOR EMOTE","☺","Play a reusable transform-based emote.",{actor:"Primary Actor",emote:"Happy Bounce"})
    ],
    camera: [
      b("camera","focus-target","FOCUS CAMERA","⌖","Center on a player, space, actor, anchor, or world target.",{target:"This Space",zoom:1.5}), b("camera","pan-target","PAN TO TARGET","→","Tween camera position to a symbolic target.",{target:"Primary Actor",duration:1,easing:"Ease In Out"}), b("camera","zoom","ZOOM CAMERA","⌕","Animate camera zoom with easing and board clamping.",{zoom:1.8,duration:.8,easing:"Ease Out"}), b("camera","frame-targets","FRAME TARGETS","▣","Automatically frame several selected targets.",{targets:"All Players",padding:10,duration:1}), b("camera","follow-target","FOLLOW TARGET","◎","Track a moving target using strength and dead-zone settings.",{target:"Triggering Player",strength:.8,deadZone:5}), b("camera","set-offset","SET CAMERA OFFSET","↔","Offset current target framing.",{x:0,y:-10,duration:.5}), b("camera","shake","SHAKE CAMERA","⚡","Procedural positional and rotational shake with falloff.",{strength:"Medium",duration:.5,frequency:18}), b("camera","bump","BUMP CAMERA","✹","Single short impact motion.",{strength:"Medium",direction:"Down"}), b("camera","save","SAVE CAMERA","↓","Push the current camera configuration onto automatic cleanup."), b("camera","restore","RESTORE CAMERA","↑","Restore the most recently saved camera configuration.",{duration:.8}), b("camera","release","RELEASE CAMERA","○","Return ownership to normal board-camera behavior.")
    ],
    screen: [
      b("screen","flash","FLASH SCREEN","☀","Overlay flash with color, intensity, and fade.",{color:"#ffffff",intensity:1,duration:.3}), b("screen","fade","FADE SCREEN","◐","Fade to or from a color overlay.",{direction:"To",color:"#000000",duration:.5}), b("screen","tint","TINT SCREEN","▧","Apply a temporary color treatment.",{color:"#663399",strength:.5,duration:2}), b("screen","vignette","VIGNETTE","◉","Focus or threaten with a configurable vignette.",{strength:.6,duration:2}), b("screen","letterbox","LETTERBOX","═","Animate cinematic top and bottom framing bars.",{enabled:true,duration:.4}), b("screen","freeze-frame","FREEZE FRAME","❄","Freeze presentation without losing event state.",{duration:.2}), b("screen","hit-stop","HIT STOP","✹","Apply a tiny dramatic presentation freeze.",{duration:.08}), b("screen","spawn-particles","SPAWN PARTICLES","✦","Run a particle preset at a target or screen anchor.",{preset:defaultPreset,target:"Triggering Player",duration:1,follow:true,space:"World"})
    ],
    minigame: [
      b("minigame","launch-minigame","LAUNCH MINIGAME","🎮","Suspend the event, run an emulator minigame, and expose authoritative results.",{game:"Choose Minigame",participants:"Triggering Player",teams:"Free for all",wagerAsset:"Coins",wager:0,saveAs:"minigameResult"}), b("minigame","start-duel","START DUEL","⚔","Select two players, stakes, minigame, and winner settlement.",{challenger:"Triggering Player",opponent:"Selected Player",stakeAsset:"Coins",stake:10}), b("minigame","start-battle","START BATTLE","💥","Gather contributions, launch multiplayer game, and distribute the pot by ranking.",{players:"All Players",asset:"Coins",contribution:10}), b("minigame","start-team-game","START TEAM MINIGAME","👥","Form teams and launch a selected game or pool.",{players:"All Players",formation:"2 vs 2",game:"Choose Minigame"}), b("minigame","solo-challenge","START SOLO CHALLENGE","🏆","Run a one-player emulator challenge with reward/failure outputs.",{player:"Triggering Player",game:"Choose Minigame",reward:"Reward Sequence"}), b("minigame","read-result","READ MINIGAME RESULT","📊","Extract winner, ranking, scores, success, or custom emulator output.",{result:"minigameResult",field:"Winner",saveAs:"winner"})
    ],
    ui: [
      b("dialogue","dialogue","SHOW DIALOGUE","💬","Portrait dialogue with speaker, style, text speed, and input barrier.",{speaker:"Active Player",text:"Welcome to the space!",style:"speech",waitForInput:true}), b("ui","choice","PRESENT CHOICE","◇","Show choices and create exclusive output branches.",{prompt:"Choose an option",choices:"Yes, No",saveAs:"choice"}), b("ui","choose-player","CHOOSE ANOTHER PLAYER","👥","Ask one player to choose from an eligibility-filtered list of players and save the result as selectedPlayer.",{choosingPlayer:"Triggering Player",eligiblePlayers:"All Players",prompt:"Choose a player",allowSelf:false,allowCancel:false,multiple:false,minimumSelections:1,maximumSelections:1,saveAs:"selectedPlayer"}), b("ui","confirm","CONFIRM","✓","Ask for confirmation with customizable True/False outcome branches.",{prompt:"Are you sure?",trueLabel:"YES",falseLabel:"NO"}), b("ui","toast","TOAST NOTIFICATION","🔔","Show brief non-blocking feedback.",{text:"Updated",duration:2}), b("ui","banner","BANNER ANNOUNCEMENT","📢","Show a cinematic or celebratory banner.",{text:"Event!",duration:2}), b("ui","roulette","SPIN RANDOM SELECTOR","◉","Display an authoritative weighted roulette result.",{outcomes:"A, B, C",saveAs:"rouletteResult"}), b("ui","roll-event-dice","ROLL EVENT DICE","🎲","Show a configurable event die and return its result.",{faces:"1,2,3,4,5,6",saveAs:"roll"}), b("ui","hud-visibility","SET HUD VISIBILITY","▤","Hide, show, or dim board HUD with automatic cleanup.",{mode:"Dim"}), b("ui","animate-hud","ANIMATE HUD ASSET","＋","Animate a ToyBox asset quantity changing in the HUD.",{player:"Triggering Player",asset:"Coins",amount:10})
    ],
    sound: [
      b("sound","play-sfx","PLAY SOUND EFFECT","♪","Play a sound globally or at a target anchor.",{sound:"coin",target:"Screen",volume:1}), b("sound","play-music","PLAY / OVERRIDE MUSIC","♫","Play board or event music with fade and cleanup.",{music:"Event Theme",fade:1,loop:true}), b("sound","stop-music","STOP MUSIC","■","Stop selected event music.",{fade:1}), b("sound","duck-music","DUCK BOARD MUSIC","⌄","Temporarily lower normal board music.",{volume:.35,duration:2}), b("sound","restore-music","RESTORE BOARD MUSIC","⌃","Return automatically saved board music settings."), b("sound","spatial-sound","PLAY SPATIAL SOUND","◖","Play sound at a world target with distance falloff.",{sound:"thunder",target:"This Space",radius:30})
    ]
  };
}

// --- RPG Maker Command Picker Modal ---
function actionPickerModal() {
  const activeTab = app.actionPickerTab || "flow";

  const tabs = [
    ["flow","⏵ FLOW"],["assets","◆ ASSETS & TRADE"],["variables","▣ LOGIC & DATA"],["selectors","⌕ SELECTORS"],
    ["player","♟ PLAYERS"],["status","⬆ STATUSES"],["board","◎ BOARD & PATHS"],["stage","▣ STAGE & ACTORS"],
    ["camera","📷 CAMERA"],["screen","✨ SCREEN & VFX"],["ui","💬 UI & INPUT"],["sound","🎵 AUDIO"],["minigame","🎮 MINIGAMES"]
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
  Object.assign(presetsByTab, completeTimelineBlockLibrary());

  const currentPresets = presetsByTab[activeTab] || presetsByTab.flow;

  const presetCards = currentPresets.map((p) => `
    <button data-nav data-add-preset-cmd="${html(encodeURIComponent(JSON.stringify(p)))}" data-preset-search="${html(`${p.label} ${p.desc}`.toLowerCase())}" class="preset-action-card">
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

        <div class="action-search-row"><span>⌕</span><input id="action-block-search" type="search" placeholder="Search ${html(activeTab)} events…" autocomplete="off"><kbd>ESC</kbd></div>

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

function ensureToyCatalogue(data = app.project?.data) {
  if (!data) return starterToys;
  if (!Array.isArray(data.toys)) {
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
  }
  return data.toys;
}

function toyEditorModal() {
  const draft = app.editingToy;
  if (!draft?.toy) return "";
  const toy = draft.toy;
  return `
    <div class="cmd-editor-modal-backdrop toy-editor-backdrop">
      <div class="cmd-editor-modal-dialog toy-editor-dialog">
        <header class="action-modal-header">
          <h2>${draft.isNew ? "＋ CREATE TOY" : "✏️ EDIT TOY"}</h2>
          <button type="button" data-nav data-close-toy-editor class="modal-close-window-btn" title="Close Window">✕</button>
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
          <button type="button" data-nav data-save-toy class="card-btn primary">💾 SAVE TO CATALOGUE</button>
          ${draft.isNew ? "" : `<button type="button" data-nav data-delete-toy="${html(toy.id)}" class="card-btn danger">🗑 DELETE TOY</button>`}
          <button type="button" data-nav data-close-toy-editor class="card-btn secondary">CANCEL</button>
        </footer>
      </div>
    </div>`;
}

function dataEditor() {
  if (!app.project) return "";
  app.project.data ||= {};
  const data = app.project.data;
  data.spaceTypes ||= ["START", "BLUE", "RED", "LUCKY", "EVENT"];
  data.statuses ||= ["TRAIL READY", "TAILWIND", "RAIN SOAKED", "HOT-SPRING GLOW"];
  data.minigamePools ||= [{ id: "party-mix", name: "PARTY MIX", enabled: true }];
  const toys = ensureToyCatalogue(data);
  const category = app.toyCategory || "all";
  const visibleToys = category === "all" ? toys : toys.filter((toy) => toy.category === category);
  const filters = [["all", { label: "ALL TOYS", icon: "🧸" }], ...Object.entries(toyCategories)].map(([id, meta]) => `<button data-nav data-toy-category="${id}" class="toy-filter ${category === id ? "active" : ""}">${meta.icon} ${meta.label}<small>${id === "all" ? toys.length : toys.filter((toy) => toy.category === id).length}</small></button>`).join("");
  const cards = visibleToys.map((toy) => `<button data-nav data-edit-toy="${html(toy.id)}" class="toy-catalogue-card rarity-${html(toy.rarity || "common")}">
    <span class="toy-card-art">${toy.image ? `<img src="${html(toy.image)}" alt="">` : html(toy.icon || "🧸")}</span>
    <span class="toy-card-copy"><small>${html(toyCategories[toy.category]?.label || "OTHER TOYS")} · ${html(toy.rarity || "common")}</small><b>${html(toy.name)}</b><em>${html(toy.description || "No description yet.")}</em><i>${toy.effectType === "roll" ? `${Number(toy.amount) || 1} DICE · ${html(toy.dieFaces || "1–6")}` : `${html(String(toy.effectType || "custom").replace(/-/g, " ").toUpperCase())} ${Number(toy.amount) ? (Number(toy.amount) > 0 ? "+" : "") + Number(toy.amount) : ""}`}</i></span>
    <span class="toy-card-edit">EDIT ▶</span>
  </button>`).join("");
  const cabinet = (title, icon, key, entries = []) => `<section class="parts-cabinet cabinet-${key}"><header><span>${icon}</span><div><small>BOARD DATA CABINET</small><h2>${title}</h2></div></header><div>${(entries || []).map((entry,index)=>`<button data-nav data-data-remove="${key}:${index}"><i>${html(entry?.icon || "●")}</i><b>${html(entry?.name || entry)}</b><small>PRESS A TO POOF</small></button>`).join("")}<button data-nav data-data-add="${key}" class="add-part">＋ NEW PART</button></div></section>`;
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
  const flow=app.project.rules.pages.flow;if(flow?.cards?.length&&(flow.disabled||[]).length>=flow.cards.length)issues.push({editor:"rules",icon:"📕",title:"THE GAME CAN GET STUCK!",copy:"Every WHAT HAPPENS NEXT rule is switched off."});
  if(!app.project.events.entries.some(entry=>entry.commands.length))issues.push({editor:"event",icon:"⚡",title:"NOTHING CAN HAPPEN YET",copy:"Add at least one command card to an event deck."});
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
let studioBoardRenderer=null,studioBoardGeneration=0,studioBoardSignature="",studioSelectedPath=null;
let actorRenderers=[];
function destroyActorRenderers(){actorRenderers.forEach(renderer=>renderer.destroy());actorRenderers=[];app.ragdollRenderer?.destroy();app.ragdollRenderer=null;}
function upsertActorKeyframe(animation,frame){const selected=app.actorKeyframeSelected?animation.keyframes[app.actorKeyframeIndex]:null,time=selected?Number(selected.time):Math.max(0,Math.min(1,Number(frame.time)||0)),existing=selected?app.actorKeyframeIndex:animation.keyframes.findIndex(item=>Math.abs(Number(item.time)-time)<.015),next={...(selected||{}),...frame,time,effect:frame.effect||selected?.effect||"ease-in-out"};if(existing>=0){animation.keyframes[existing]=next;app.actorKeyframeIndex=existing;}else{animation.keyframes.push(next);animation.keyframes.sort((a,b)=>a.time-b.time);app.actorKeyframeIndex=animation.keyframes.indexOf(next);}app.actorKeyframeSelected=true;save("actors");save("event");render();}
function selectedActorAnimation(){const actor=ensureBoardActors().find(item=>String(item.id)===String(app.actorEditorId))||currentSpaceAction()?.characters?.find(item=>String(item.id)===String(app.actorEditorId)),animation=actor&&ensureActorAnimations(actor).find(item=>item.id===app.actorAnimationId);return {actor,animation,frame:app.actorKeyframeSelected?animation?.keyframes?.[app.actorKeyframeIndex]:null};}
function moveSelectedKeyframe(seconds){const {animation,frame}=selectedActorAnimation();if(!animation||!frame)return;frame.time=Math.max(0,Math.min(1,Number(seconds)/animation.duration));app.actorKeyframeIndex=animation.keyframes.indexOf(frame);app.actorPreviewTime=frame.time*animation.duration;app.actorKeyframeSelected=true;}
function updateSelectedFrameControls(frame){const selected=selectedActorAnimation().frame;if(!selected||!frame)return;selected.corners=frame.corners.map(point=>({...point}));selected.anchor={...frame.anchor};selected.corners.forEach((point,index)=>{for(const axis of ["x","y"]){const input=root.querySelector(`[data-keyframe-point="${index}:${axis}"]`);if(input)input.value=Number(point[axis]).toFixed(1);}});for(const axis of ["x","y"]){const input=root.querySelector(`[data-keyframe-anchor="${axis}"]`);if(input)input.value=Number(selected.anchor[axis]).toFixed(1);}}
function updateActorPreviewDecorations(preview,animation,time,force=false){if(!preview||!animation)return;const duration=Math.max(.1,animation.duration),position=time/duration,frames=[...animation.keyframes].sort((a,b)=>a.time-b.time),frame=[...frames].reverse().find(item=>Number(item.time)<=position+.002),hitTime=frame?Number(frame.time)*duration:-99,visible=Boolean(frame?.emote?.enabled)&&time-hitTime>=-.02&&time-hitTime<Math.min(1,Math.max(.35,duration*.35));preview.className=preview.className.replace(/\s?has-emote|\s?emote-(?:round|thought|burst|square|cloud)|\s?emote-anim-[\w-]+/g,"");if(!visible){delete preview.dataset.emote;return;}preview.dataset.emote=frame.emote.icon||"!";preview.style.setProperty("--emote-color",frame.emote.color||"#ffffff");preview.classList.add("has-emote",`emote-${frame.emote.shape||"round"}`,`emote-anim-${frame.emote.animation||"pop"}`);if(force||app.actorLastEmoteFrame!==frame){app.actorLastEmoteFrame=frame;preview.classList.remove(`emote-anim-${frame.emote.animation||"pop"}`);void preview.offsetWidth;preview.classList.add(`emote-anim-${frame.emote.animation||"pop"}`);}}
function keyframeInspectorMarkup(){const {animation,frame}=selectedActorAnimation();if(!animation||!frame)return `<section class="keyframe-inspector empty"><b>SELECT A KEYFRAME</b><p>Choose a dot to edit its timing, warp points, emote, sound, and particles.</p></section>`;frame.corners ||= [{x:-60,y:-75},{x:60,y:-75},{x:-60,y:75},{x:60,y:75}];frame.anchor ||= {x:0,y:0};frame.emote ||= {enabled:false,icon:"!",shape:"round",animation:"pop",color:"#ffffff"};frame.particles ||= [];const particles=ensureEffects().filter(effect=>(effect.kind||"particle")==="particle");return `<section class="keyframe-inspector"><header><div><small>SELECTED KEYFRAME</small><b>${(frame.time*animation.duration).toFixed(2)}s</b></div><label>TIME <input data-keyframe-time type="number" min="0" max="${animation.duration}" step=".01" value="${(frame.time*animation.duration).toFixed(2)}"></label></header><div class="keyframe-inspector-tabs"><section><h4>WARP POINTS</h4><div class="point-coordinate-grid">${frame.corners.map((point,index)=>`<fieldset><legend>${["TOP LEFT","TOP RIGHT","BOTTOM LEFT","BOTTOM RIGHT"][index]}</legend><label>X<input data-keyframe-point="${index}:x" type="number" value="${Number(point.x).toFixed(1)}"></label><label>Y<input data-keyframe-point="${index}:y" type="number" value="${Number(point.y).toFixed(1)}"></label></fieldset>`).join("")}<fieldset class="anchor-coordinates"><legend>ANCHOR</legend><label>X<input data-keyframe-anchor="x" type="number" value="${Number(frame.anchor.x).toFixed(1)}"></label><label>Y<input data-keyframe-anchor="y" type="number" value="${Number(frame.anchor.y).toFixed(1)}"></label></fieldset></div></section><section><h4>EMOTE BUBBLE</h4><label class="keyframe-check"><input data-keyframe-emote="enabled" type="checkbox" ${frame.emote.enabled?"checked":""}> SHOW ABOVE ACTOR</label><div class="keyframe-form-grid"><label>ICON<input data-keyframe-emote="icon" value="${html(frame.emote.icon)}" maxlength="4"></label><label>SHAPE<select data-keyframe-emote="shape">${["round","thought","burst","square","cloud"].map(value=>`<option ${frame.emote.shape===value?"selected":""}>${value}</option>`).join("")}</select></label><label>APPEAR ANIMATION<select data-keyframe-emote="animation">${["pop","fade","bounce","spin","elastic","slide-down","rubberband"].map(value=>`<option ${frame.emote.animation===value?"selected":""}>${value}</option>`).join("")}</select></label><label>COLOR<input data-keyframe-emote="color" type="color" value="${html(frame.emote.color)}"></label></div><h4>SOUND EFFECT</h4><div class="sound-picker-row"><select data-keyframe-sound><option value="">No sound</option>${["coin","star-fanfare","thunder-strike","warp-pipe","dice-roll","chest","mystery","lose","laugh","whistle"].map(value=>`<option value="${value}" ${frame.sound===value?"selected":""}>${value}</option>`).join("")}</select><button data-preview-keyframe-sound>▶ TEST</button></div></section><section class="keyframe-particles"><header><h4>PARTICLE SPAWNS</h4><button data-add-keyframe-particle ${particles.length?"":"disabled"}>＋ ADD SPAWN</button></header>${frame.particles.map((spawn,index)=>`<article data-keyframe-particle="${index}"><select data-particle-spawn-field="effectId">${particles.map(p=>`<option value="${html(p.id)}" ${spawn.effectId===p.id?"selected":""}>${html(p.name)}</option>`).join("")}</select><label>X <input data-particle-spawn-field="x" type="number" min="-200" max="200" value="${Number(spawn.x||0)}"></label><label>Y <input data-particle-spawn-field="y" type="number" min="-200" max="200" value="${Number(spawn.y||-80)}"></label><label>COUNT <input data-particle-spawn-field="count" type="number" min="1" max="100" value="${Number(spawn.count||12)}"></label><button data-remove-keyframe-particle="${index}">×</button></article>`).join("")||`<p>No particle spawns on this keyframe. Add one and position it relative to the actor.</p>`}</section></div></section>`;}
function mountActorStages(){
  const entry=currentAction?.();
  if(!entry)return;
  const now=Number(app.timelinePlayhead||0);
  const activePathClips=getActiveTimelineClips(entry.timeline,now);
  const {hidden,spawnPending}=evaluateActorTimelineLifecycle(entry,now);
  const hiddenSet=new Set(hidden),pendingSet=new Set(spawnPending);

  for(const host of root.querySelectorAll("[data-timeline-pixi-actor]")){
    const assigned=entry.characters.find(item=>String(item.id)===String(host.dataset.timelinePixiActor)),actor=canonicalSpaceActor(assigned);
    if(!actor)continue;
    const actorIdStr=String(actor.id);
    const isHidden=hiddenSet.has(actorIdStr)||pendingSet.has(actorIdStr)||(actor.visible===false&&!activePathClips.some(c=>(String(c.actorId||c.parameters?.actor||"")===actorIdStr||c.target===actor.name)&&["spawn-actor","spawn"].includes(c.op||c.actorAction)&&now>=Number(c.start||0)));
    const visible=!isHidden;
    if(host.dataset.stageVisible!==String(visible)){
      host.dataset.stageVisible=String(visible);
      host.classList.toggle("is-stage-hidden",!visible);
    }
    const actorClips=activePathClips.filter(clip=>["actors","stage"].includes(clip.category)&&(String(clip.actorId||clip.parameters?.actor||"")===actorIdStr||clip.target===actor.name));
    const activeClips=actorClips.filter(clip=>now>=Number(clip.start||0)&&now<Number(clip.start||0)+Number(clip.duration||2));
    const active=activeClips.find(clip=>clip.animationId||clip.parameters?.animation)||activeClips.at(-1);
    const animations=ragdollAnimations(actor),idleId=actor.idleAnimationId||actor.ragdoll?.idleAnimationId||actor.ragdoll?.activeAnimationId||actor.animationId,animation=animations.find(item=>String(item.id)===String(active?.animationId||active?.parameters?.animation||idleId))||animations[0],playbackAnimation=active?animation:{...animation,loop:true},local=active?Math.max(0,now-Number(active.start||0)):now;
    let renderer=actorRenderers.find(item=>item.host===host||String(item.actor?.id)===actorIdStr);
    if(renderer instanceof PixiRagdollRenderer){
      if(renderer.host!==host){
        renderer.destroy();
        actorRenderers.splice(actorRenderers.indexOf(renderer),1);
        renderer=null;
      } else renderer.setPlayback(playbackAnimation,local,active?.duration);
    }
    if(!renderer){
      renderer=new PixiRagdollRenderer({host,className:"pixi-ragdoll-canvas"});
      actorRenderers.push(renderer);
      renderer.init().then(()=>renderer.setActor(actor,playbackAnimation,local,active?.duration)).catch(error=>console.error("Timeline actor preview failed",error));
    }
  }
}
function mountRagdollTab(){const dialog=root.querySelector(".actor-settings-dialog");if(!dialog)return;const nav=dialog.querySelector(":scope > nav");if(!nav?.querySelector('[data-actor-settings-tab="ragdoll-paint"]'))nav.insertAdjacentHTML("beforeend",`<button type="button" data-actor-settings-tab="ragdoll-paint" class="${app.actorEditorTab==="ragdoll-paint"?"active":""}">RAGDOLL PAINT</button><button type="button" data-actor-settings-tab="ragdoll-infill" class="${app.actorEditorTab==="ragdoll-infill"?"active":""}">RAGDOLL INFILL</button><button type="button" data-actor-settings-tab="ragdoll-test" class="${app.actorEditorTab==="ragdoll-test"?"active":""}">RAGDOLL TEST</button><button type="button" data-actor-settings-tab="ragdoll-animations" class="${app.actorEditorTab==="ragdoll-animations"?"active":""}">RAGDOLL ANIMATIONS</button>`);nav?.querySelectorAll("[data-actor-settings-tab]").forEach(button=>button.classList.toggle("active",button.dataset.actorSettingsTab===app.actorEditorTab));if(!app.actorEditorTab?.startsWith("ragdoll-"))return;actorRenderers.forEach(renderer=>renderer.destroy());actorRenderers=[];app.ragdollRenderer?.destroy();const actor=ensureBoardActors().find(item=>String(item.id)===String(app.actorEditorId))||currentSpaceAction()?.characters?.find(item=>String(item.id)===String(app.actorEditorId)),workspace=dialog.querySelector(".actor-animation-workspace,.ragdoll-tab-host");if(!actor||!workspace){toast("RAGDOLL WORKSPACE COULD NOT OPEN");return;}ensureRagdoll(actor);if(!workspace.classList.contains("ragdoll-tab-host"))workspace.outerHTML=`<div class="ragdoll-tab-host"></div>`;const host=dialog.querySelector(".ragdoll-tab-host");host.innerHTML=`<div class="ragdoll-loading">PREPARING RIGID ARTWORK…</div>`;const mode=app.actorEditorTab==="ragdoll-animations"?"animations":app.actorEditorTab==="ragdoll-test"?"test":app.actorEditorTab==="ragdoll-infill"?"infill":"paint",renderer=new RagdollEditor(host,actor,{mode,onChange:(rig)=>{if(rig?.idleAnimationId)actor.idleAnimationId=rig.idleAnimationId;syncActorToAllSpaceActions(actor.id,actor.name,actor);save("actors");save("event");}});app.ragdollRenderer=renderer;renderer.init().catch(error=>{host.innerHTML=`<div class="ragdoll-error">${html(error.message)}</div>`;toast(`RAGDOLL EDITOR: ${error.message}`);});}
function syncMapOverlayCamera(camera){for(const board of root.querySelectorAll("#map-board,#effects-board"))board.style.transform=`translate(${camera.x}px,${camera.y}px) scale(${camera.zoom}) rotate(${camera.rotation}rad)`;}
function mapVisualSignature(){return JSON.stringify({image:app.project.map.image,foreground:app.project.map.foreground,layers:app.project.map.layers,spaces:app.project.map.spaces,paths:app.project.map.paths,objects:app.project.map.objects,triggers:app.project.map.triggers,regions:app.project.map.regions,spawns:app.project.map.spawns,cameras:app.project.map.cameras,effectPlacements:app.project.map.effectPlacements});}
function mountStudioBoard(){const generation=++studioBoardGeneration,host=root.querySelector("[data-pixi-board]"),options={editable:app.editor==="map",showNumbers:app.editor==="map",selectedPath:app.editingPath,interactive:false,showEffectMarkers:app.editor==="placements",onCameraChange:syncMapOverlayCamera};if(host){const signature=mapVisualSignature();if(studioBoardRenderer&&studioBoardRenderer.host===host){studioBoardRenderer.options={...studioBoardRenderer.options,...options};if(signature!==studioBoardSignature){studioBoardSignature=signature;studioSelectedPath=app.editingPath;studioBoardRenderer.setBoard(app.project.map,options).then(()=>{if(app.justPlacedSpace!=null){studioBoardRenderer?.animateSpaceIn(app.justPlacedSpace);app.justPlacedSpace=null;}}).catch(error=>toast(`BOARD RENDERER: ${error.message}`));}else if(studioSelectedPath!==app.editingPath){studioSelectedPath=app.editingPath;studioBoardRenderer.refreshPaths();}studioBoardRenderer.setCamera({x:app.mapPan.x,y:app.mapPan.y,zoom:app.mapZoom,rotation:app.mapRotation||0});}else mountBoardRenderer(host,app.project.map,options).then(renderer=>{if(generation!==studioBoardGeneration){renderer?.destroy();return;}studioBoardRenderer=renderer;studioBoardSignature=signature;studioSelectedPath=app.editingPath;renderer?.setCamera({x:app.mapPan.x,y:app.mapPan.y,zoom:app.mapZoom,rotation:app.mapRotation||0},true);if(app.justPlacedSpace!=null){renderer?.animateSpaceIn(app.justPlacedSpace);app.justPlacedSpace=null;}}).catch(error=>toast(`BOARD RENDERER: ${error.message}`));}for(const preview of root.querySelectorAll("[data-pixi-board-preview]")){const board=app.project.boardProjects.entries.find(item=>item.id===preview.dataset.pixiBoardPreview);if(board)mountBoardRenderer(preview,board.map,{interactive:false}).catch(()=>{});}}
function hydratePlacementParticlePicker(){const inspector=root.querySelector(".placement-inspector"),placement=app.project.map.effectPlacements.find(item=>item.id===app.placementInspectorId);if(!inspector||!placement||placement.kind!=="controller")return;const particles=ensureEffects().filter(effect=>effect.kind==="particle"),assigned=particles.find(particle=>particle.id===placement.boundEffectId);if(assigned&&placement.type==="emitter"&&placement.color!==assigned.color){bindParticleToPlacement(placement,assigned);save("map");}const label=placement.type==="emitter"?"PARTICLE TO EMIT":"PARTICLE TO AFFECT",scale=Number(placement.particleScale||1),shape=assigned?.shape||"circle";inspector.querySelector("[data-delete-placement]")?.insertAdjacentHTML("beforebegin",`<div class="actor-particle-picker-field"><label>${label}</label><button type="button" data-open-placement-particle-picker><span class="particle-picker-mini-preview shape-${html(shape)}" style="--particle-color:${html(assigned?.color||"#8deaaa")};--particle-color-2:${html(assigned?.colorEnd||assigned?.color||"#fff")}"><i></i><i></i><i></i></span><div><b>${assigned?html(assigned.name):placement.type==="emitter"?"SELECT A PARTICLE":"ALL PARTICLES"}</b><small>${shape.toUpperCase()} reusable preset</small></div><em>CHOOSE ▸</em></button></div>${placement.type==="emitter"?`<label>PARTICLE SCALE <output>${scale.toFixed(2)}×</output><input type="range" min=".1" max="4" step=".05" data-placement-edit="particleScale" value="${scale}"></label>`:""}`);}
function bindParticleToPlacement(placement,particle){placement.boundEffectId=particle?.id||"";placement.particle=particle?structuredClone(particle):null;placement.particleScale=Number(placement.particleScale||1);if(!particle||placement.type!=="emitter")return;const keys=["color","colorEnd","shape","image","blend","opacity","opacityEnd","degradeTime","lifetimeRandomness","size","sizeEnd","sizeRandomness","speed","speedRandomness","direction","directionStartRandomness","directionChangeStrength","directionChangeRate","lateralStrength","lateralFrequency","rotation","rotationRandomStart","rotationSpeed","gravity","gravityDirection","drag","breakParticleId","deathSpawnCount"];for(const key of keys)placement[key]=structuredClone(particle[key]);placement.secondaryColor=particle.colorEnd||particle.color;placement.angle=Number(particle.direction??-90);placement.life=Number(particle.degradeTime||2);}

function actorsEditor() {
  const actors = ensureBoardActors();
  if (app.actorMigrationPendingSave) {
    app.actorMigrationPendingSave = false;
    save("actors");
    toast("GHOST SPACE CAST MIGRATED TO BOARD ACTORS");
  }
  const host = actors.find((a) => a.isHost) || actors[0];

  const renderActorCard = (actor, isHost = false) => `
    <div class="actor-grid-card ${isHost ? "is-host-card" : ""}" draggable="true" data-draggable-actor="${html(actor.id)}">
      <div class="actor-card-badge-row">
        ${isHost ? `<span class="host-crown-badge">👑 STAGE HOST</span>` : `<span class="actor-drag-handle" title="Drag to Host spot">⠿ DRAG TO HOST</span>`}
        <div class="actor-card-mini-actions">
          ${!isHost ? `<button type="button" data-nav data-set-host="${html(actor.id)}" class="actor-card-btn host-btn" title="Make this character the Stage Host">👑 MAKE HOST</button>` : ""}
          <button type="button" data-nav data-clone-actor="${html(actor.id)}" class="actor-card-btn" title="Duplicate Actor">⧉</button>
          <button type="button" data-nav data-delete-actor="${html(actor.id)}" class="actor-card-btn danger" title="Delete Actor">🗑</button>
        </div>
      </div>
      <div class="actor-card-avatar-wrap">
        ${actor.sprite ? `<img src="${html(actor.sprite)}" alt="${html(actor.name)}" class="actor-card-sprite">` : `<span class="actor-card-emoji">${html(actor.icon || (isHost ? "👑" : "👤"))}</span>`}
      </div>
      <div class="actor-card-info">
        <b class="actor-card-name">${html(actor.name)}</b>
        <small class="actor-card-role">${html(actor.role || (isHost ? "Stage Host" : "Cast Actor"))}</small>
      </div>
      <div class="actor-card-meta-row">
        <div><span>POSE</span><b>${html((actor.animation || "float").toUpperCase())}</b></div>
        <div><span>ANCHOR</span><b>${html((actor.anchor || "center").toUpperCase())}</b></div>
      </div>
      <button type="button" data-nav data-edit-actor="${html(actor.id)}" class="card-btn primary actor-adjust-btn">
        ⚙ ADJUST ACTOR &amp; RAGDOLL
      </button>
    </div>
  `;

  return frame(stationMeta.actors, `
    <div class="actors-workbench">
      <!-- ROW 1: THE HOST ROW -->
      <section class="host-row-section">
        <header class="host-row-header">
          <div class="host-header-copy">
            <span class="host-section-icon">👑</span>
            <div>
              <small>PRIMARY BOARD CHARACTER</small>
              <h2>STAGE HOST</h2>
            </div>
          </div>
          <p class="host-header-hint">
            Drag and drop any actor card into the Host spot below, or click <b>👑 MAKE HOST</b> on any character.
          </p>
        </header>

        <div class="host-dropzone ${host ? "has-host" : ""}" data-host-dropzone>
          ${host ? `
            <div class="host-spotlight-card" draggable="true" data-draggable-actor="${html(host.id)}">
              <div class="host-spotlight-glow"></div>
              <div class="host-avatar-huge">
                ${host.sprite ? `<img src="${html(host.sprite)}" alt="${html(host.name)}">` : `<span>${html(host.icon || "👑")}</span>`}
              </div>
              <div class="host-spotlight-content">
                <div class="host-spotlight-title-row">
                  <span class="host-crown-badge-huge">👑 STAGE HOST</span>
                  <h3>${html(host.name)}</h3>
                  <small class="host-spotlight-role">${html(host.role || "Host")}</small>
                </div>
                <p class="host-spotlight-desc">Welcomes players, announces board events, and leads cutscenes.</p>
                <div class="host-spotlight-meta">
                  <div class="host-meta-pill"><span>DEFAULT MOTION</span><b>${html((host.animation || "float").toUpperCase())}</b></div>
                  <div class="host-meta-pill"><span>STAGE ANCHOR</span><b>${html((host.anchor || "center").toUpperCase())}</b></div>
                  <div class="host-meta-pill"><span>RAGDOLL ANIMATIONS</span><b>${ragdollAnimations(host).length} SAVED</b></div>
                </div>
              </div>
              <div class="host-spotlight-actions">
                <button type="button" data-nav data-edit-actor="${html(host.id)}" class="card-btn primary host-adjust-btn">
                  ⚙ ADJUST HOST &amp; RAGDOLL
                </button>
                <div class="host-drop-hint">✦ DRAG ANOTHER ACTOR HERE TO SWAP ✦</div>
              </div>
            </div>
          ` : `
            <div class="host-empty-dropzone">
              <span class="host-empty-icon">👑</span>
              <b>NO HOST ASSIGNED</b>
              <p>Drag any actor from the cast grid below and drop them here to assign as Host.</p>
            </div>
          `}
        </div>
      </section>

      <!-- ROW 2+: ACTORS GRID -->
      <section class="actors-grid-section">
        <header class="actors-grid-header">
          <div>
            <small>BOARD-WIDE CAST</small>
            <h2>CAST &amp; ACTORS (${actors.length})</h2>
          </div>
          <p>All actors created here are available board-wide and can be added to any space cutscene.</p>
        </header>

        <div class="actors-grid">
          ${actors.map((actor) => renderActorCard(actor, actor.id === host?.id)).join("")}

          <!-- LAST CARD IN GRID: CREATE NEW ACTOR CARD -->
          <div class="actor-grid-card new-actor-card">
            <div class="new-actor-card-header">
              <span class="new-actor-icon">＋</span>
              <b>CREATE NEW ACTOR</b>
              <small>Add a new character to the board cast</small>
            </div>

            <div class="new-actor-actions">
              <button type="button" data-nav data-trigger-upload="board-actor-file-upload" class="card-btn primary upload-actor-btn">
                📁 UPLOAD SPRITE PNG
              </button>
              <input type="file" id="board-actor-file-upload" accept="image/png,image/webp,image/gif,image/jpeg" style="display:none;">

              <button type="button" data-nav data-add-board-actor class="picker-btn blank-actor-btn">
                ＋ NEW BLANK ACTOR
              </button>
            </div>

            <div class="new-actor-presets">
              <small>QUICK PRESET SPRITES</small>
              <div class="preset-chips-row">
                <button type="button" data-nav data-add-preset-board-actor="Spooky Ghost:👻:Nemesis:float" class="preset-chip">👻 GHOST</button>
                <button type="button" data-nav data-add-preset-board-actor="Bolt-0:🤖:Vendor:pulse" class="preset-chip">🤖 BOLT-0</button>
                <button type="button" data-nav data-add-preset-board-actor="Star Fairy:🧚:Ally:float" class="preset-chip">🧚 FAIRY</button>
                <button type="button" data-nav data-add-preset-board-actor="Mystic Wizard:🧙:Host:bounce" class="preset-chip">🧙 WIZARD</button>
                <button type="button" data-nav data-add-preset-board-actor="Bandit:🦹:Thief:shake" class="preset-chip">🦹 BANDIT</button>
                <button type="button" data-nav data-add-preset-board-actor="Lucky Cat:🐱:Mascot:bounce" class="preset-chip">🐱 LUCKY CAT</button>
                <button type="button" data-nav data-add-preset-board-actor="King Golem:🗿:Guardian:pulse" class="preset-chip">🗿 GOLEM</button>
                <button type="button" data-nav data-add-preset-board-actor="Dragon:🐉:Boss:float" class="preset-chip">🐉 DRAGON</button>
              </div>
            </div>
          </div>
        </div>
      </section>

      ${actorSettingsModal()}
    </div>
  `);
}

function render() {
  clearInterval(app.testTimer); app.testTimer = null;
  const preserveTimelineActors=app.spaceActionTab==="timeline"&&Boolean(root.querySelector("[data-timeline-pixi-actor]"));
  if(!preserveTimelineActors)destroyActorRenderers();const previousTimelineViewport = root.querySelector("#timeline-canvas-viewport");
  if (previousTimelineViewport) app.timelineScrollLeft = previousTimelineViewport.scrollLeft;
  const reusableViewport=app.editor==="map"?root.querySelector("#map-viewport"):null;
  app.editor = editorFromPath();
  if(app.editor!=="map"||!reusableViewport){destroyBoardRenderers(root);studioBoardRenderer=null;studioBoardSignature="";}
  if (!app.editor && location.pathname === "/party/boards") root.innerHTML = boardPicker();
  else if (!app.editor && boardIdFromPath()) root.innerHTML = boardShowcase();
  else if (!app.editor) root.innerHTML = hub();
  else if (app.editor === "map") {const shell=document.createElement("div");shell.innerHTML=mapEditor();if(reusableViewport){const fresh= shell.querySelector("#map-viewport"),freshOverlay=fresh?.querySelector("#map-board"),oldOverlay=reusableViewport.querySelector("#map-board");if(fresh&&freshOverlay&&oldOverlay){oldOverlay.innerHTML=freshOverlay.innerHTML;oldOverlay.style.cssText=freshOverlay.style.cssText;fresh.replaceWith(reusableViewport);}}root.replaceChildren(...shell.childNodes);}
  else if (app.editor === "actors") root.innerHTML = actorsEditor();
  else if (app.editor === "scene") root.innerHTML = sceneEditor();
  else if (app.editor === "event") root.innerHTML = eventEditor();
  else if (app.editor === "rules") root.innerHTML = rulesEditor();
  else if (app.editor === "data") root.innerHTML = dataEditor();
  else if (app.editor === "effects") root.innerHTML = effectsEditor();
  else if (app.editor === "placements") root.innerHTML = placementEditorV2();
  else root.innerHTML = testEditor();
  if(app.editor==="placements")hydratePlacementParticlePicker();
  const nextTimelineViewport = root.querySelector("#timeline-canvas-viewport");
  if (nextTimelineViewport) nextTimelineViewport.scrollLeft = Math.max(0, Math.min(app.timelineScrollLeft || 0, nextTimelineViewport.scrollWidth - nextTimelineViewport.clientWidth));
  updateConfabulatorViewport();
  mountStudioBoard();
  if(app.editor==="event"&&app.spaceActionTab==="timeline")mountTimelinePixiStage(currentAction());
  mountRagdollTab();
  if (app.testStartedAt && ["scene","test"].includes(app.editor)) startTestClock();
}
let confabulatorResizeFrame = 0;
function queueConfabulatorResize() {
  cancelAnimationFrame(confabulatorResizeFrame);
  confabulatorResizeFrame = requestAnimationFrame(updateConfabulatorViewport);
}
window.addEventListener("resize", queueConfabulatorResize);
window.visualViewport?.addEventListener("resize", queueConfabulatorResize);
function acceptSavedSection(section, savedProject) {
  const key = sections[section], liveSection = app.project?.[key];
  if (!key || !liveSection || !savedProject) return;
  if (savedProject.project) app.project.project = savedProject.project;
  const selectedId = app.project.boardProjects?.selectedId;
  const activeBoard = app.project.boardProjects?.entries?.find(board => board.id === selectedId);
  if (activeBoard) {
    activeBoard[key] = structuredClone(liveSection);
    if (key === "map") activeBoard.name = liveSection.name || activeBoard.name;
  }
}
function save(section) {
  const lamp = document.querySelector("#save-lamp"); if (lamp) { lamp.textContent = "● SAVING"; lamp.classList.add("busy"); }
  clearTimeout(app.saveTimers[section]); app.saveTimers[section] = setTimeout(async () => { try { const savedProject = await api(`/api/party/studio/${sections[section]}`, { method: "PUT", body: app.project[sections[section]] }); acceptSavedSection(section,savedProject); toast("SAVED! ★"); sound(660,.12); const next=document.querySelector("#save-lamp"); if(next){next.textContent="● SAVED";next.classList.remove("busy");} } catch(error){ toast(error.message); } }, 280);
}
async function saveActorEditorNow() {
  if (!app.actorEditorId) return true;
  app.ragdollRenderer?.flush?.();
  const actor = ensureBoardActors().find((item) => String(item.id) === String(app.actorEditorId)) || currentAction()?.characters?.find((item) => String(item.id) === String(app.actorEditorId));
  if (actor) {
    const dialog = root.querySelector(".actor-settings-dialog");
    if (dialog) {
      const oldName = actor.name;
      dialog.querySelectorAll("[data-actor-field]").forEach((input) => {
        const field = input.dataset.actorField;
        if (field) actor[field] = input.value;
      });
      syncActorToAllSpaceActions(actor.id, oldName, actor);
    }
  }
  clearTimeout(app.saveTimers.actors);
  app.saveTimers.actors = null;
  clearTimeout(app.saveTimers.event);
  app.saveTimers.event = null;
  const isBoardActor = ensureBoardActors().some((a) => String(a.id) === String(app.actorEditorId));
  const sectionKey = isBoardActor ? "actors" : "events";
  const sectionProp = isBoardActor ? "actors" : "events";
  const lamp = document.querySelector("#save-lamp");
  if (lamp) { lamp.textContent = "● SAVING"; lamp.classList.add("busy"); }
  try {
    const savedProject = await api(`/api/party/studio/${sectionKey}`, { method: "PUT", body: app.project[sectionProp] });
    acceptSavedSection(isBoardActor ? "actors" : "event", savedProject);
    if (isBoardActor && app.project.events) {
      const savedEvents = await api(`/api/party/studio/events`, { method: "PUT", body: app.project.events });
      acceptSavedSection("event", savedEvents);
    }
    if (lamp) { lamp.textContent = "● SAVED"; lamp.classList.remove("busy"); }
    toast("ACTOR SAVED! ★");
    sound(660,.12);
  } catch (error) {
    console.warn("Actor editor save note:", error);
    if (lamp) { lamp.textContent = "● LOCAL"; lamp.classList.remove("busy"); }
  }
  return true;
}
function startTestClock() {
  clearInterval(app.testTimer);
  app.testTimer = setInterval(() => { const duration = app.project.scenes.entries[0].duration; app.testNow = (performance.now() - app.testStartedAt) / 1000; if (app.testNow >= duration) { app.testNow = duration; app.testStartedAt = null; clearInterval(app.testTimer); } render(); }, 100);
}
function boardPoint(board, event) {
  if(studioBoardRenderer&&app.editor==="map"){const rect=studioBoardRenderer.app.canvas.getBoundingClientRect();return studioBoardRenderer.percentFromScreen(event.clientX-rect.left,event.clientY-rect.top);}
  const rect = board.getBoundingClientRect();
  return { x: Math.max(0, Math.min(100, Math.round((event.clientX - rect.left) / rect.width * 1000) / 10)), y: Math.max(0, Math.min(100, Math.round((event.clientY - rect.top) / rect.height * 1000) / 10)) };
}
function updateMapCamera(next={},immediate=false){if(next.zoom!=null)app.mapZoom=Math.max(.8,Math.min(8,Number(next.zoom)));if(next.x!=null)app.mapPan.x=Number(next.x);if(next.y!=null)app.mapPan.y=Number(next.y);if(next.rotation!=null)app.mapRotation=Number(next.rotation);studioBoardRenderer?.setCamera({x:app.mapPan.x,y:app.mapPan.y,zoom:app.mapZoom,rotation:app.mapRotation||0},immediate);const readout=root.querySelector(".map-floating-toolbar > b,.placement-zoom > b");if(readout)readout.textContent=`${Math.round(app.mapZoom*100)}%`;}
root.addEventListener("click", async (event) => {
  const setHost = event.target.closest("[data-set-host]");
  if (setHost) {
    const actorId = setHost.dataset.setHost;
    const actors = ensureBoardActors();
    const actor = actors.find((a) => String(a.id) === String(actorId));
    if (actor) {
      actors.forEach((a) => (a.isHost = false));
      actor.isHost = true;
      actor.role = "Host";
      syncActorToAllSpaceActions(actor.id, actor.name, actor);
      save("actors");
      save("event");
      render();
      playSfx("fanfare");
      toast(`👑 ${actor.name.toUpperCase()} IS NOW THE STAGE HOST! ★`);
    }
    return;
  }
  const delActor = event.target.closest("[data-delete-actor]");
  if (delActor) {
    const actorId = delActor.dataset.deleteActor;
    const actors = ensureBoardActors();
    if (actors.length <= 1) {
      toast("KEEP AT LEAST ONE ACTOR ON THE BOARD");
      return;
    }
    const idx = actors.findIndex((a) => String(a.id) === String(actorId));
    if (idx >= 0) {
      const deleted = actors.splice(idx, 1)[0];
      if (deleted.isHost && actors.length > 0) {
        actors[0].isHost = true;
        actors[0].role = "Host";
      }
      save("actors");
      save("event");
      render();
      playSfx("lose");
      toast("ACTOR REMOVED");
    }
    return;
  }
  const cloneActor = event.target.closest("[data-clone-actor]");
  if (cloneActor) {
    const actorId = cloneActor.dataset.cloneActor;
    const actors = ensureBoardActors();
    const source = actors.find((a) => String(a.id) === String(actorId));
    if (source) {
      const copy = structuredClone(source);
      copy.id = `actor-${Date.now()}`;
      copy.name = `${source.name} Copy`;
      copy.isHost = false;
      copy.role = "Actor";
      actors.push(copy);
      save("actors");
      render();
      playSfx("star");
      toast("ACTOR CLONED! ★");
    }
    return;
  }
  if (event.target.closest("[data-add-board-actor]")) {
    const actors = ensureBoardActors();
    const count = actors.length + 1;
    actors.push({
      id: `actor-${Date.now()}`,
      name: `Actor ${count}`,
      role: "Actor",
      isHost: false,
      icon: "👤",
      sprite: "",
      anchor: "center",
      animation: "float",
      animations: [],
    });
    save("actors");
    render();
    playSfx("star");
    toast("NEW ACTOR CREATED! ★");
    return;
  }
  const presetBoardActorBtn = event.target.closest("[data-add-preset-board-actor]");
  if (presetBoardActorBtn) {
    const [name, icon, role, anim] = presetBoardActorBtn.dataset.addPresetBoardActor.split(":");
    const actors = ensureBoardActors();
    actors.push({
      id: `actor-${Date.now()}`,
      name,
      role: role || "Actor",
      isHost: false,
      icon: icon || "👤",
      sprite: "",
      anchor: "center",
      animation: anim || "float",
      animations: [],
    });
    save("actors");
    render();
    playSfx("star");
    toast(`${name.toUpperCase()} ADDED TO CAST! ★`);
    return;
  }
  const addBoardActorToSpace = event.target.closest("[data-add-board-actor-to-space]");
  if (addBoardActorToSpace) {
    const actorId = addBoardActorToSpace.dataset.addBoardActorToSpace;
    const boardActors = ensureBoardActors();
    const source = boardActors.find((a) => String(a.id) === String(actorId));
    const act = currentAction();
    if (source && act) {
      act.characters ||= [];
      if (!act.characters.some((c) => String(c.id) === String(source.id))) {
        const newChar = structuredClone(source);
        newChar.offsetX = 0;
        newChar.offsetY = -34;
        newChar.scale = 1.0;
        newChar.alwaysVisible = true;
        newChar.visibleOnBoard = true;
        act.characters.push(newChar);
        app.spaceAppearanceActorId = newChar.id;
        syncSpaceActionToMapSpaces(act.id, act);
        save("event");
        save("map");
        render();
        playSfx("star");
        toast(`${source.name.toUpperCase()} ADDED TO THIS SPACE! ★`);
      }
    }
    return;
  }
  const castRemove = event.target.closest("[data-cast-remove], [data-space-actor-remove]");
  if (castRemove) {
    const charId = castRemove.dataset.spaceActorRemove || castRemove.dataset.castRemove;
    const act = currentAction();
    if (act && act.characters) {
      const removed = act.characters.find((c) => String(c.id) === String(charId));
      act.characters = act.characters.filter((c) => String(c.id) !== String(charId));
      if (String(app.spaceAppearanceActorId) === String(charId)) {
        app.spaceAppearanceActorId = null;
      }
      syncSpaceActionToMapSpaces(act.id, act);
      save("event");
      save("map");
      render();
      playSfx("thunder");
      toast(`${(removed?.name || "ACTOR").toUpperCase()} REMOVED FROM THIS SPACE`);
    }
    return;
  }
  const editActor=event.target.closest("[data-edit-actor]");if(editActor){event.preventDefault();event.stopPropagation();const actors=ensureBoardActors(),actor=actors.find(item=>String(item.id)===String(editActor.dataset.editActor))||currentSpaceAction()?.characters?.find(item=>String(item.id)===String(editActor.dataset.editActor));if(!actor){toast("ACTOR COULD NOT BE FOUND");return;}const rig=ensureRagdoll(actor);app.actorEditorId=actor.id;app.actorAnimationId=rig.activeAnimationId;app.actorEditorTab="ragdoll-animations";app.actorPreviewTime=0;app.actorPreviewPlaying=false;app.actorKeyframeIndex=0;app.actorKeyframeSelected=false;render();return;}
  if(event.target.closest("[data-close-actor-settings]")){if(!await saveActorEditorNow())return;app.actorEditorId=null;app.actorPreviewRenderer=null;render();return;}
  const actorTab=event.target.closest("[data-actor-settings-tab]");if(actorTab){event.preventDefault();const nextTab=actorTab.dataset.actorSettingsTab;if(nextTab===app.actorEditorTab)return;if(!await saveActorEditorNow())return;app.actorEditorTab=nextTab;render();return;}
  const selectAnimation=event.target.closest("[data-select-actor-animation]");if(selectAnimation){event.preventDefault();const actors=ensureBoardActors(),actor=actors.find(item=>String(item.id)===String(app.actorEditorId))||currentSpaceAction()?.characters?.find(item=>String(item.id)===String(app.actorEditorId));if(!actor){toast("ACTOR COULD NOT BE FOUND");return;}const animation=ensureActorAnimations(actor).find(item=>String(item.id)===String(selectAnimation.dataset.selectActorAnimation));if(!animation){toast("ANIMATION COULD NOT BE FOUND");return;}actor.animationId=animation.id;app.actorAnimationId=animation.id;app.actorPreviewTime=0;app.actorPreviewPlaying=true;app.actorLastEmoteFrame=null;app.actorKeyframeIndex=0;app.actorKeyframeSelected=false;root.querySelectorAll("[data-select-actor-animation]").forEach(button=>button.classList.toggle("active",button===selectAnimation));const renderer=app.actorPreviewRenderer;if(renderer&&!renderer.destroyed){renderer.playing=false;await renderer.setActor(actor,animation,0);renderer.playing=true;renderer.onPreviewFrame=updateSelectedFrameControls;renderer.onPause=()=>{app.actorPreviewPlaying=false;const button=root.querySelector("[data-actor-preview-play]");if(button)button.textContent="▶";};renderer.onTick=(time)=>updateActorPreviewDecorations(renderer.host,animation,time);const play=root.querySelector("[data-actor-preview-play]");if(play)play.textContent="⏸";}const scrub=root.querySelector("[data-actor-preview-scrub]");if(scrub){scrub.max=String(animation.duration);scrub.value="0";}const time=root.querySelector("[data-actor-preview-time]");if(time)time.textContent="0.00s";const track=root.querySelector(".actor-keyframe-track");if(track)track.innerHTML=animation.keyframes.map((frame,index)=>`<button data-actor-keyframe="${index}" class="actor-keyframe-dot" style="left:${Number(frame.time||0)*100}%" title="Keyframe ${(Number(frame.time||0)*animation.duration).toFixed(2)}s"></button>`).join("");const name=root.querySelector('[data-animation-field="name"]');if(name)name.value=animation.name;const duration=root.querySelector('[data-animation-field="duration"]');if(duration)duration.value=String(animation.duration);root.querySelector(".keyframe-inspector")?.replaceWith(Object.assign(document.createElement("div"),{outerHTML:keyframeInspectorMarkup()}));updateActorPreviewDecorations(renderer?.host,animation,0,true);toast(`${animation.name.toUpperCase()} PLAYING`);return;}
  if(event.target.closest("[data-add-actor-animation]")){const actors=ensureBoardActors(),actor=actors.find(item=>String(item.id)===String(app.actorEditorId))||currentSpaceAction()?.characters?.find(item=>String(item.id)===String(app.actorEditorId));if(!actor){toast("SELECT AN ACTOR FIRST");return;}const animations=ensureActorAnimations(actor),animation=defaultActorAnimation("Untitled");animations.push(animation);actor.animationId=animation.id;app.actorAnimationId=animation.id;app.actorPreviewTime=0;app.actorPreviewPlaying=false;app.actorKeyframeIndex=0;app.actorKeyframeSelected=false;save("actors");save("event");render();toast("UNTITLED ANIMATION ADDED");return;}
  if(event.target.closest("[data-actor-preview-play]")){const playing=app.actorPreviewRenderer?.toggle();app.actorPreviewPlaying=Boolean(playing);event.target.textContent=playing?"⏸":"▶";return;}
  const keyDot=event.target.closest("[data-actor-keyframe]");if(keyDot){const actors=ensureBoardActors(),actor=actors.find(item=>item.id===app.actorEditorId)||currentAction()?.characters?.find(item=>item.id===app.actorEditorId),animation=actor&&ensureActorAnimations(actor).find(item=>item.id===app.actorAnimationId),index=Number(keyDot.dataset.actorKeyframe);if(animation?.keyframes[index]){app.actorKeyframeIndex=index;app.actorKeyframeSelected=true;app.actorPreviewPlaying=false;app.actorPreviewTime=animation.keyframes[index].time*animation.duration;if(app.actorPreviewRenderer){app.actorPreviewRenderer.playing=false;app.actorPreviewRenderer.seek(app.actorPreviewTime);}root.querySelectorAll("[data-actor-keyframe]").forEach(dot=>dot.classList.toggle("selected",dot===keyDot));const play=root.querySelector("[data-actor-preview-play]");if(play)play.textContent="▶";const effect=root.querySelector("[data-keyframe-effect]");if(effect)effect.value=animation.keyframes[index].effect||"linear";updateActorPreviewDecorations(root.querySelector("[data-actor-preview]"),animation,app.actorPreviewTime,true);}return;}
  if(event.target.closest("[data-add-keyframe]")){const actors=ensureBoardActors(),actor=actors.find(item=>item.id===app.actorEditorId)||currentAction()?.characters?.find(item=>item.id===app.actorEditorId),animation=actor&&ensureActorAnimations(actor).find(item=>item.id===app.actorAnimationId);if(!animation){toast("SELECT AN ANIMATION FIRST");return;}app.actorPreviewPlaying=false;app.actorPreviewRenderer&&(app.actorPreviewRenderer.playing=false);const normalized=app.actorPreviewTime/animation.duration,existing=animation.keyframes.findIndex(item=>Math.abs(Number(item.time)-normalized)<.015);app.actorKeyframeSelected=false;const frame=app.actorPreviewRenderer?.frameAt(app.actorPreviewTime)||sampleActorAnimation(animation,app.actorPreviewTime);upsertActorKeyframe(animation,{...frame,time:normalized,effect:root.querySelector("[data-keyframe-effect]")?.value||"ease-in-out"});toast(existing>=0?"KEYFRAME AT PLAYHEAD SELECTED":"KEYFRAME ADDED");return;}
  if(event.target.closest("[data-add-keyframe-particle]")){const particle=ensureEffects().find(effect=>(effect.kind||"particle")==="particle");if(particle){app.particlePickerEditor={kind:"keyframe",index:null,effectId:particle.id,count:12,shape:particle.shape||"circle"};render();}return;}
  const editKeyframeParticle=event.target.closest("[data-open-keyframe-particle-picker]");if(editKeyframeParticle){const {frame}=selectedActorAnimation(),index=Number(editKeyframeParticle.dataset.openKeyframeParticlePicker),spawn=frame?.particles?.[index];if(spawn){const particle=ensureEffects().find(effect=>effect.id===spawn.effectId);app.particlePickerEditor={kind:"keyframe",index,effectId:spawn.effectId||"",count:Number(spawn.count||12),shape:spawn.shape||particle?.shape||"circle"};render();}return;}
  const removeParticle=event.target.closest("[data-remove-keyframe-particle]");if(removeParticle){const {frame}=selectedActorAnimation();if(frame){frame.particles.splice(Number(removeParticle.dataset.removeKeyframeParticle),1);save("actors");save("event");render();}return;}
  if(event.target.closest("[data-preview-keyframe-sound]")){const {frame}=selectedActorAnimation();if(frame?.sound)playSfx(frame.sound);return;}
  if (event.target.closest("[data-add-choice-option]") && app.editingCommand?.cmd?.op === "choice") {
    const cmd = app.editingCommand.cmd, choices = ensureChoiceOptions(cmd), index = choices.length;
    cmd.parameters.prompt = document.querySelector("#edit-choice-prompt")?.value || cmd.parameters.prompt;
    choices.push({ id:`choice-${Date.now()}`, label:`Option ${index + 1}`, value:`option-${index + 1}`, color:["#54d682","#ff6655","#35c9ff","#ffc83b","#8b5ce6"][index % 5] }); render(); return;
  }
  const deleteChoiceOption = event.target.closest("[data-delete-choice-option]");
  if (deleteChoiceOption && app.editingCommand?.cmd?.op === "choice") { const choices = ensureChoiceOptions(app.editingCommand.cmd); if (choices.length > 2) choices.splice(Number(deleteChoiceOption.dataset.deleteChoiceOption),1); render(); return; }
  const openPlayerSelector = event.target.closest("[data-open-player-selector]");
  if (openPlayerSelector && app.editingCommand?.cmd) {
    const key = openPlayerSelector.dataset.openPlayerSelector;
    const value = app.editingCommand.cmd.parameters?.[key];
    app.playerSelectorEditor = { key, selector: normalizePlayerSelector(value, ["players","participants","eligiblePlayers"].includes(key)) };
    render(); return;
  }
  if (event.target.closest("[data-close-player-selector]")) { app.playerSelectorEditor = null; render(); return; }
  const selectorMode = event.target.closest("[data-player-selector-mode]");
  if (selectorMode && app.playerSelectorEditor) { app.playerSelectorEditor.selector.mode = selectorMode.dataset.playerSelectorMode; render(); return; }
  const playerReference = event.target.closest("[data-player-reference]");
  if (playerReference && app.playerSelectorEditor) {
    app.playerSelectorEditor.selector.mode = "reference";
    app.playerSelectorEditor.selector.reference = playerReference.dataset.playerReference;
    render(); return;
  }
  if (event.target.closest("[data-add-player-filter]") && app.playerSelectorEditor) { app.playerSelectorEditor.selector.filters.push({ field:"asset", operator:"at-least", subject:"coins", value:1 }); render(); return; }
  const deletePlayerFilter = event.target.closest("[data-delete-player-filter]");
  if (deletePlayerFilter && app.playerSelectorEditor) { app.playerSelectorEditor.selector.filters.splice(Number(deletePlayerFilter.dataset.deletePlayerFilter), 1); render(); return; }
  if (event.target.closest("[data-save-player-selector]") && app.playerSelectorEditor && app.editingCommand?.cmd) {
    app.editingCommand.cmd.parameters ||= {};
    app.editingCommand.cmd.parameters[app.playerSelectorEditor.key] = structuredClone(app.playerSelectorEditor.selector);
    app.playerSelectorEditor = null; render(); return;
  }
  const openValuePicker = event.target.closest("[data-open-value-picker]");
  if (openValuePicker && app.editingCommand?.cmd) { const key = openValuePicker.dataset.openValuePicker; app.valuePickerEditor = { key, type:openValuePicker.dataset.pickerType, value:structuredClone(app.editingCommand.cmd.parameters?.[key] ?? "") }; render(); return; }
  if (event.target.closest("[data-close-value-picker]") || event.target.classList.contains("typed-picker-backdrop")) { app.valuePickerEditor = null; render(); return; }
  const pickToy = event.target.closest("[data-pick-toy]"); if (pickToy && app.valuePickerEditor) { app.valuePickerEditor.value = pickToy.dataset.pickToy; render(); return; }
  const pickColor = event.target.closest("[data-pick-color]"); if (pickColor && app.valuePickerEditor) { app.valuePickerEditor.value = pickColor.dataset.pickColor; render(); return; }
  const spaceMode = event.target.closest("[data-space-picker-mode]"); if (spaceMode && app.valuePickerEditor) { app.valuePickerEditor.value.mode = spaceMode.dataset.spacePickerMode; render(); return; }
  const pickSpace = event.target.closest("[data-pick-space]"); if (pickSpace && app.valuePickerEditor) { app.valuePickerEditor.value.spaceId = pickSpace.dataset.pickSpace; render(); return; }
  if (event.target.closest("[data-save-value-picker]") && app.valuePickerEditor && app.editingCommand?.cmd) { app.editingCommand.cmd.parameters ||= {}; app.editingCommand.cmd.parameters[app.valuePickerEditor.key] = structuredClone(app.valuePickerEditor.value); app.valuePickerEditor = null; render(); return; }
  if(event.target.closest("[data-open-particle-picker]")&&app.editingCommand?.cmd){const dump=app.editingCommand.cmd.particleDump||{},particle=ensureEffects().find(effect=>effect.id===dump.effectId);app.particlePickerEditor={kind:"transition",effectId:dump.effectId||"",count:Number(dump.count||24),shape:dump.shape||particle?.shape||"circle"};render();return;}
  const openParticleParam=event.target.closest("[data-open-particle-param-picker]");
  if(openParticleParam&&app.editingCommand?.cmd){const key=openParticleParam.dataset.openParticleParamPicker,currentVal=app.editingCommand.cmd.parameters?.[key],particles=ensureEffects().filter(effect=>(effect.kind||"particle")==="particle"),particle=particles.find(effect=>effect.id===currentVal||effect.name===currentVal)||particles[0];app.particlePickerEditor={kind:"timeline-param",key,effectId:particle?.id||"",count:24,shape:particle?.shape||"circle"};render();return;}
  if(event.target.closest("[data-open-placement-particle-picker]")){const placement=app.project.map.effectPlacements.find(item=>item.id===app.placementInspectorId),particle=ensureEffects().find(effect=>effect.id===placement?.boundEffectId);if(placement){app.particlePickerEditor={kind:"placement",placementId:placement.id,effectId:placement.boundEffectId||"",count:Number(placement.rate||18),shape:particle?.shape||"circle"};render();}return;}
  if(event.target.closest("[data-close-particle-picker]")){app.particlePickerEditor=null;render();return;}
  const pickTransitionParticle=event.target.closest("[data-pick-transition-particle]");if(pickTransitionParticle&&app.particlePickerEditor){const effectId=pickTransitionParticle.dataset.pickTransitionParticle,particle=ensureEffects().find(effect=>effect.id===effectId);app.particlePickerEditor.effectId=effectId;app.particlePickerEditor.shape=particle?.shape||app.particlePickerEditor.shape||"circle";render();return;}
  if(event.target.closest("[data-save-particle-picker]")&&app.particlePickerEditor){const picker=app.particlePickerEditor,choice={effectId:picker.effectId||"",count:Math.max(1,Math.min(300,Number(picker.count)||24)),shape:picker.shape||"circle"};if(picker.kind==="transition"&&app.editingCommand?.cmd)app.editingCommand.cmd.particleDump={...app.editingCommand.cmd.particleDump,...choice};else if(picker.kind==="timeline-param"&&app.editingCommand?.cmd){app.editingCommand.cmd.parameters ||= {};const selectedParticle=ensureEffects().find(effect=>effect.id===picker.effectId);app.editingCommand.cmd.parameters[picker.key]=selectedParticle?selectedParticle.id:(picker.effectId||"");}else if(picker.kind==="keyframe"){const {frame}=selectedActorAnimation();if(frame){frame.particles ||= [];const spawn={id:`spawn-${Date.now()}`,...choice,x:0,y:-80};if(picker.index==null)frame.particles.push(spawn);else Object.assign(frame.particles[picker.index]||spawn,choice);save("actors");save("event");}}else if(picker.kind==="placement"){const placement=app.project.map.effectPlacements.find(item=>item.id===picker.placementId),particle=ensureEffects().find(effect=>effect.id===choice.effectId);if(placement){bindParticleToPlacement(placement,particle);placement.rate=choice.count;placement.shape=choice.shape;save("map");}}app.particlePickerEditor=null;render();return;}
  if(event.target.closest("[data-open-map-settings]")){app.mapSettingsOpen=true;render();return;}
  if(event.target.closest("[data-remove-map-foreground]")){remember();app.project.map.foreground="";save("map");render();toast("FOREGROUND REMOVED");return;}
  if(event.target.closest("[data-add-effect]")){app.newEffectMenu=true;render();return;}
  if(event.target.closest("[data-close-new-effect]")){app.newEffectMenu=false;render();return;}
  const createEffectKind=event.target.closest("[data-create-effect-kind]");if(createEffectKind){const kind=createEffectKind.dataset.createEffectKind,effects=ensureEffects(),defaults=kind==="controller"?{name:"New Controller",kind,type:"emitter",icon:"⊙"}:kind==="lightsource"?{name:"New Light Source",kind,type:"point-light",icon:"☀",color:"#fff0b5"}:{name:"New Particle",kind,type:"particle",icon:"•"},effect=newEffect(defaults);effects.push(effect);app.activeEffectId=effect.id;app.newEffectMenu=false;save("data");render();return;}
  const duplicateEffect=event.target.closest("[data-duplicate-effect]");if(duplicateEffect){const effects=ensureEffects(),source=effects.find(item=>item.id===duplicateEffect.dataset.duplicateEffect);if(source){const copy=newEffect({...structuredClone(source),id:undefined,name:`${source.name} Copy`});copy.id=`effect-${Date.now()}-${Math.random().toString(36).slice(2,6)}`;effects.push(copy);app.activeEffectId=copy.id;save("data");render();toast("EFFECT DUPLICATED");}return;}
  if(event.target.closest("[data-preview-effect]")){const preview=root.querySelector(".effect-preview");if(preview){preview.classList.remove("replaying");requestAnimationFrame(()=>preview.classList.add("replaying"));}return;}
  const propertyTab=event.target.closest("[data-effect-property-tab]");if(propertyTab){app.effectPropertyTab=propertyTab.dataset.effectPropertyTab;render();return;}
  if(event.target.closest("[data-load-preset]")){app.effectPresetMenu=!app.effectPresetMenu;render();return;}
  if(event.target.closest("[data-close-effect-presets]")){app.effectPresetMenu=false;render();return;}
  const applyPreset=event.target.closest("[data-apply-effect-preset]");if(applyPreset){const effect=ensureEffects().find(item=>item.id===app.activeEffectId),preset=starterEffects.find(item=>item.id===applyPreset.dataset.applyEffectPreset);if(effect&&preset){const identity={id:effect.id,name:effect.name};Object.assign(effect,newEffect(structuredClone(preset)),identity);app.effectPresetMenu=false;save("data");render();toast(`${preset.name.toUpperCase()} PRESET LOADED`);}return;}
  const selectEffect=event.target.closest("[data-select-effect]");if(selectEffect){app.activeEffectId=selectEffect.dataset.selectEffect;app.effectPropertyTab="identity";render();return;}
  const deleteEffect=event.target.closest("[data-delete-effect]");if(deleteEffect){app.project.data.effects=ensureEffects().filter(item=>item.id!==deleteEffect.dataset.deleteEffect);app.project.map.effectPlacements=app.project.map.effectPlacements.filter(item=>item.effectId!==deleteEffect.dataset.deleteEffect);app.activeEffectId=null;save("data");save("map");render();return;}
  const placementEffect=event.target.closest("[data-placement-effect]");if(placementEffect){app.placementEffectId=placementEffect.dataset.placementEffect;render();return;}
  if(event.target.closest("[data-close-placement-inspector]")){app.placementInspectorId=null;render();return;}
  const deletePlacement=event.target.closest("[data-delete-placement]");if(deletePlacement){app.project.map.effectPlacements=app.project.map.effectPlacements.filter(item=>item.id!==deletePlacement.dataset.deletePlacement);app.placementInspectorId=null;save("map");render();toast("CONTROLLER REMOVED");return;}
  if(event.target.closest("[data-close-map-settings]")){app.mapSettingsOpen=false;app.mapPreviewAudio?.pause();render();return;}
  if(event.target.closest("[data-remove-map-image]")){remember();app.project.map.image="";save("map");render();sound(240,.12);toast("MAP IMAGE REMOVED (DEFAULT GRID ACTIVE)");return;}
  const settingsTab=event.target.closest("[data-map-settings-tab]");if(settingsTab){app.mapSettingsTab=settingsTab.dataset.mapSettingsTab;render();return;}
  if(event.target.closest("[data-preview-map-music]")){app.mapPreviewAudio?.pause();if(app.project.map.music){app.mapPreviewAudio=new Audio(app.project.map.music);app.mapPreviewAudio.volume=.45;app.mapPreviewAudio.play().catch(()=>toast("THIS TRACK COULD NOT BE PREVIEWED"));}return;}
  if(event.target.closest("[data-delete-selected-spaces]")){remember();const ids=app.selectedSpaces,map=app.project.map;map.spaces=map.spaces.filter(space=>!ids.has(space.id));map.paths=map.paths.filter(path=>!ids.has(path.from)&&!ids.has(path.to));app.selectedSpaces.clear();app.mapInspector=null;save("map");render();toast("SELECTED SPACES DELETED");return;}
  if(event.target.closest("[data-reset-space-defaults]")){const space=app.project.map.spaces.find(item=>item.id===app.mapInspector);if(space){remember();for(const key of ["type","size","shape","rotation","borderWidth","borderColor","borderOpacity","shadow","shadowColor","shadowOpacity","shadowBlur","shadowOffset"])delete space[key];save("map");render();toast("SPACE NOW USES MAP DEFAULTS");}return;}
  if(event.target.closest("[data-reset-path-defaults]")){const path=app.project.map.paths.find(item=>item.id===app.editingPath);if(path){remember();delete path.render;delete path.oneWay;delete path.direction;save("map");render();toast("PATH NOW USES MAP DEFAULTS");}return;}
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
  if (event.target.closest("[data-map-zoom]")) {updateMapCamera({zoom:app.mapZoom+Number(event.target.closest("[data-map-zoom]").dataset.mapZoom)});sound(460);return; }
  if (event.target.closest("[data-map-reset]")) {updateMapCamera({zoom:1,x:0,y:0,rotation:0});sound(520);return; }
  const rotateMap=event.target.closest("[data-map-rotate]");if(rotateMap){updateMapCamera({rotation:(app.mapRotation||0)+Number(rotateMap.dataset.mapRotate)});sound(430);return;}
  if (event.target.closest("[data-close-hold-menu]")) { app.mapHoldMenu=null;render();return; }
  const holdEdit=event.target.closest("[data-hold-edit-space]");if(holdEdit){app.mapHoldMenu=null;app.mapInspector=Number(holdEdit.dataset.holdEditSpace);if(!app.selectedSpaces.has(app.mapInspector)){app.selectedSpaces.clear();app.selectedSpaces.add(app.mapInspector);}app.mapInspectorTab="space";render();return;}
  const holdDelete=event.target.closest("[data-hold-delete-space]");if(holdDelete){remember();const id=Number(holdDelete.dataset.holdDeleteSpace),map=app.project.map;map.spaces=map.spaces.filter(space=>space.id!==id);map.paths=map.paths.filter(path=>path.from!==id&&path.to!==id);app.mapHoldMenu=null;save("map");render();toast("SPACE DELETED");return;}
  if(event.target.closest("[data-close-map-inspector]")){app.mapInspector=null;render();return;}
  const inspectorTab=event.target.closest("[data-map-inspector-tab]");if(inspectorTab){app.mapInspectorTab=inspectorTab.dataset.mapInspectorTab;render();return;}
  const addPath=event.target.closest("[data-add-path-from]");if(addPath){app.pathPickFrom=Number(addPath.dataset.addPathFrom);app.mapInspector=null;app.project.map.tool="select";render();toast("SELECT ANOTHER SPACE TO CONNECT");return;}
  const editPath=event.target.closest("[data-edit-path]");if(editPath){app.editingPath=editPath.dataset.editPath;app.mapInspector=null;render();toast("CLICK THE PATH TO ADD A CONTROL POINT");return;}
  const deletePath=event.target.closest("[data-delete-path]");if(deletePath){remember();app.project.map.paths=app.project.map.paths.filter(path=>path.id!==deletePath.dataset.deletePath);if(app.editingPath===deletePath.dataset.deletePath)app.editingPath=null;save("map");render();toast("PATH DELETED");return;}
  if(event.target.closest("[data-close-path-editor]")){app.editingPath=null;render();return;}
  const pathHit=event.target.closest(".path-hit");if(pathHit){event.stopPropagation();if(app.suppressMapClick){app.suppressMapClick=false;return;}const pathId=pathHit.closest("[data-path-id]")?.dataset.pathId;if(!pathId)return;if(app.editingPath&&app.editingPath===pathId){const board=document.querySelector("#map-board"),path=app.project.map.paths.find(item=>item.id===pathId);if(board&&path){remember();const point=boardPoint(board,event);path.points||=[];path.points.push({...point,movement:"walk",speed:1,lighting:"unchanged",sound:"default"});save("map");render();toast("CONTROL POINT ADDED — DRAG TO SHAPE");}}else if(app.editingPath||app.mapInspector!=null||app.pathPointMenu){app.editingPath=pathId;app.mapInspector=null;app.pathPointMenu=null;render();toast("PATH FOCUS CHANGED");}return;}
  if(event.target.closest("[data-close-point-editor]")){app.pathPointMenu=null;render();return;}
  if(event.target.closest("[data-close-point-hold]")){app.pathPointHoldMenu=null;render();return;}
  if(event.target.closest("[data-hold-edit-point]")){app.pathPointMenu=app.pathPointHoldMenu;app.pathPointHoldMenu=null;render();return;}
  if(event.target.closest("[data-hold-delete-point]")){const menu=app.pathPointHoldMenu,path=menu&&app.project.map.paths.find(item=>item.id===menu.pathId);if(path){remember();path.points.splice(menu.index,1);app.pathPointHoldMenu=null;save("map");render();toast("CONTROL POINT DELETED");}return;}
  if(event.target.closest("[data-delete-path-point]")){const menu=app.pathPointMenu,path=menu&&app.project.map.paths.find(item=>item.id===menu.pathId);if(path){remember();path.points.splice(menu.index,1);app.pathPointMenu=null;save("map");render();toast("CONTROL POINT DELETED");}return;}
  const boardMutation = event.target.closest("#map-board") && app.project.map.tool === "space" && !event.target.closest("[data-space]") && !app.panMoved;
  if (boardMutation || event.target.closest("[data-space-adjust],[data-space-shape],[data-space-type],[data-delete-space],[data-clip-adjust],[data-add-clip],[data-add-command],[data-command-move],[data-command-toggle],[data-command-delete],[data-command-kind],[data-command-amount],[data-command-phrase],[data-trigger-kind],[data-trigger-adjust],[data-event-add],[data-event-delete],[data-cartridge],[data-rule-toggle],[data-data-remove],[data-data-add]")) remember();
  const tool = event.target.closest("[data-map-tool]"); if(tool){app.project.map.tool=tool.dataset.mapTool;app.pathFrom=null;app.selectedSpace=null;app.selectedMarker=null;save("map");render();sound(420);return;}
  const spaceButton = event.target.closest("[data-space]"); if(spaceButton){event.stopPropagation();const id=Number(spaceButton.dataset.space),space=app.project.map.spaces.find(item=>item.id===id);if(app.suppressMapClick){app.suppressMapClick=false;return;}if(event.shiftKey||event.metaKey||event.ctrlKey){app.selectedSpaces.has(id)?app.selectedSpaces.delete(id):app.selectedSpaces.add(id);app.selectedSpace=id;render();return;}if(!app.selectedSpaces.has(id)){app.selectedSpaces.clear();app.selectedSpaces.add(id);}if(app.pathPickFrom!=null){if(app.pathPickFrom!==id){const exists=app.project.map.paths.some(path=>(path.from===app.pathPickFrom&&path.to===id)||(path.from===id&&path.to===app.pathPickFrom));if(!exists){remember();const path={id:`path-${Date.now()}`,from:app.pathPickFrom,to:id,points:[],oneWay:false,render:{pattern:"solid",curve:"hard",color:"#fff0a9",opacity:1,border:true}};app.project.map.paths.push(path);app.editingPath=path.id;save("map");toast("PATH CREATED");}else toast("THOSE SPACES ARE ALREADY CONNECTED");}app.pathPickFrom=null;render();return;}if(app.mapInspector!=null||app.editingPath||app.pathPointMenu){app.mapInspector=id;app.mapInspectorTab="space";app.editingPath=null;app.pathPointMenu=null;render();return;}if(app.project.map.tool==="path"){if(app.pathFrom==null){app.pathFrom=id;app.selectedSpace=null;toast("FIRST SPACE READY — PICK THE NEXT! 〰");sound(240);render();return;}if(app.pathFrom!==id){const exists=app.project.map.paths.some(path=>path.from===app.pathFrom&&path.to===id);if(!exists){remember();app.project.map.paths.push({id:`path-${Date.now()}`,from:app.pathFrom,to:id});save("map");sound(720,.13);}else{sound(110);toast("THOSE SPACES ARE ALREADY CONNECTED");}app.pathFrom=id;render();return;}}app.selectedSpace=id;app.selectedMarker=null;render();sound(360);return;}
  const board = event.target.closest("#map-board");
  if(board && !app.panMoved && app.project.map.tool==="space"){const point=boardPoint(board,event),map=app.project.map,id=Math.max(-1,...map.spaces.map(s=>s.id))+1,type=map.spaceType||"blue",space={id,...point,type,size:3,depth:2,rotation:0,shape:"oval",action:`${type}-space-event`};const previous=map.spaces.at(-1);map.spaces.push(space);if(previous)map.paths.push({id:`path-${Date.now()}`,from:previous.id,to:id});app.selectedSpace=id;app.selectedMarker=null;save("map");render();sound(220,.08);return;}
  const adjust = event.target.closest("[data-space-adjust]"); if(adjust){const [key,amount]=adjust.dataset.spaceAdjust.split(":"),space=app.project.map.spaces.find(s=>s.id===app.selectedSpace);space[key]=Math.max(key==="size"?1:key==="depth"?0:-180,Math.min(key==="size"?5:key==="depth"?5:180,Number(space[key])+Number(amount)));save("map");render();return;}
  const shape = event.target.closest("[data-space-shape]"); if(shape){const options=["oval","round","star"],space=app.project.map.spaces.find(s=>s.id===app.selectedSpace),index=options.indexOf(space.shape||"oval");space.shape=options[(index+Number(shape.dataset.spaceShape)+options.length)%options.length];save("map");render();return;}
  const type = event.target.closest("[data-space-type]"); if(type){const space=app.project.map.spaces.find(s=>s.id===app.selectedSpace),oldDefault=`${space.type}-space-event`;space.type=type.dataset.spaceType;if(!space.action||space.action===oldDefault)space.action=`${space.type}-space-event`;app.project.map.spaceType=space.type;save("map");render();sound(300);return;}
  if(event.target.closest("[data-delete-space]")){const map=app.project.map;map.spaces=map.spaces.filter(s=>s.id!==app.selectedSpace);map.paths=map.paths.filter(p=>p.from!==app.selectedSpace&&p.to!==app.selectedSpace);app.selectedSpace=null;save("map");render();sound(120,.14);return;}
  const clipButton=event.target.closest("[data-clip]");if(clipButton){if(app.ignoreClipClick)return;app.selectedClip=clipButton.dataset.clip;render();return;}
  const clipAdjust=event.target.closest("[data-clip-adjust]");if(clipAdjust){const scene=app.project.scenes.entries[0],[key,amount]=clipAdjust.dataset.clipAdjust.split(":"),clip=scene.clips.find(c=>c.id===app.selectedClip);clip[key]=Math.max(key==="duration"?.25:0,Math.min(scene.duration,Number(clip[key])+Number(amount)));save("scene");render();return;}
  if(event.target.closest("[data-add-clip]")){const scene=app.project.scenes.entries[0],id=`clip-${Date.now()}`;scene.clips.push({id,track:"effects",label:"NEW SURPRISE",start:Math.min(scene.duration-1,scene.clips.length),duration:1,color:"cyan",resources:["effects"]});app.selectedClip=id;save("scene");render();sound(240);return;}
  if(event.target.closest("[data-scene-play]")){app.testStartedAt=app.testStartedAt?null:performance.now();app.testNow=0;render();sound(180,.12);return;}

  // --- Video Editor Multi-Track Timeline Transport & Controls ---
  if (event.target.closest("[data-add-activation-rule]")) {
    const act = currentAction();
    const sequence = activeSpaceSequence(act);
    remember();
    act.activationRules.push({ id: `activation-${Date.now()}`, name: "New activation", trigger: "land", sequenceId: sequence.id, mode: "blocking", scope: "triggering-player", replay: "every-time", priority: 50, cooldown: 0, enabled: true });
    save("event"); render(); return;
  }
  const deleteActivation = event.target.closest("[data-delete-activation-rule]");
  if (deleteActivation) {
    const act = currentAction(); remember();
    act.activationRules = act.activationRules.filter((rule) => rule.id !== deleteActivation.dataset.deleteActivationRule);
    save("event"); render(); return;
  }
  const editActivation = event.target.closest("[data-edit-activation]");
  if (editActivation) { app.editingActivationId = editActivation.dataset.editActivation; render(); return; }
  if (event.target.closest("[data-close-activation-editor]")) { app.editingActivationId = null; render(); return; }
  const selectSequence = event.target.closest("[data-select-sequence]");
  if (selectSequence) {
    const act = currentAction();
    if (app.timelineTimer) clearInterval(app.timelineTimer);
    app.timelineTimer = null; app.timelinePlaying = false; app.timelinePreviewWaiting = null;
    app.timelinePreviewHandled = new Set(); app.timelinePreviewBranches = {};
    act.activeSequenceId = selectSequence.dataset.selectSequence;
    act.timeline = activeSpaceSequence(act).timeline;
    app.timelinePlayhead = 0; app.timelineActiveTrackId = act.timeline.tracks[0]?.id;
    render(); return;
  }
  const renameSequence = event.target.closest("[data-rename-sequence]");
  if (renameSequence) {
    const act = currentAction();
    const sequence = act.sequences.find((item) => item.id === renameSequence.dataset.renameSequence);
    if (sequence) { const next = prompt("Sequence name:", sequence.name); if (next?.trim()) { remember(); sequence.name = next.trim().slice(0, 60); save("event"); render(); } }
    return;
  }
  if (event.target.closest("[data-add-sequence]")) {
    const act = currentAction(); remember();
    const id = `sequence-${Date.now()}`;
    const timeline = { duration: 16, tracks: [{ id: `track-${Date.now()}`, name: "Track 1 · Main Sequence", kind: "main", color: "violet", locked: false, muted: false, clips: [] }] };
    act.sequences.push({ id, name: `Sequence ${act.sequences.length + 1}`, description: "", timeline });
    act.activeSequenceId = id; act.timeline = timeline; app.timelinePlayhead = 0; app.timelineActiveTrackId = timeline.tracks[0].id;
    save("event"); render(); return;
  }
  const deleteSequence = event.target.closest("[data-delete-sequence]");
  if (deleteSequence) {
    const act = currentAction();
    if (act.sequences.length <= 1) return;
    remember();
    const removedId = deleteSequence.dataset.deleteSequence;
    act.sequences = act.sequences.filter((sequence) => sequence.id !== removedId);
    act.activationRules = act.activationRules.filter((rule) => rule.sequenceId !== removedId);
    act.activeSequenceId = act.sequences[0].id; act.timeline = act.sequences[0].timeline;
    app.timelineSelectedClipIds?.clear(); app.timelineSelectedClipId = null; app.timelineActiveTrackId = act.timeline.tracks[0]?.id;
    app.timelinePreviewWaiting = null; app.timelinePreviewHandled = new Set(); app.timelinePreviewBranches = {};
    app.timelinePlayhead = 0; save("event"); render(); return;
  }

  const previewContinue = event.target.closest("[data-preview-continue]");
  const previewBranch = event.target.closest("[data-preview-branch]");
  const previewPlayer = event.target.closest("[data-preview-player]");
  if (previewContinue || previewBranch || previewPlayer) {
    const token = previewContinue?.dataset.previewContinue || previewBranch?.dataset.previewBranch || previewPlayer?.dataset.previewPlayer;
    const [clipId, choice] = String(token).split(":");
    app.timelinePreviewHandled.add(clipId);
    if (choice != null) {
      app.timelinePreviewBranches[clipId] = choice;
      const act = currentAction();
      const found = findClipInTimeline(act.timeline, clipId);
      if (found) {
        const first = found.clip.op === "choice" ? ensureChoiceOptions(found.clip)[0]?.id : "true";
        const branch = act.timeline.tracks.find((track) => track.boundDecisionId === clipId && String(track.outcomeId || "false") === String(choice));
        app.timelineActiveTrackId = String(choice) === String(first) ? found.track.id : branch?.id || found.track.id;
      }
    }
    app.timelinePreviewWaiting = null;
    updateTimelinePreviewLive(currentAction());
    setTimeout(() => root.querySelector("[data-timeline-play]")?.click(), 0);
    return;
  }

  // Timeline Play / Pause
  if (event.target.closest("[data-timeline-play]")) {
    const act = currentAction();
    if (app.timelinePlaying) {
      if (app.timelineTimer) clearInterval(app.timelineTimer);
      app.timelineTimer = null;
      app.timelinePlaying = false;
      updateTimelinePreviewLive(act);
      const pauseButton=root.querySelector("[data-timeline-play]");
      if(pauseButton)pauseButton.innerHTML="▶ PLAY";
      playSfx("dialogue-blip");
    } else {
      app.timelinePlaying = true;
      app.timelineTriggeringPlayer = 1;
      const pxPerSec = app.timelineZoom || 100;
      let duration = Math.max(0, ...playbackTracks(act.timeline, app.timelinePlayhead || 0).flatMap((track) => (track.clips || []).map((clip) => Number(clip.start || 0) + Number(clip.duration || 2))));
      if ((app.timelinePlayhead || 0) >= duration) { app.timelinePlayhead = 0; app.timelinePreviewHandled = new Set(); app.timelinePreviewBranches = {}; }
      let lastTime = performance.now();
      if ((app.timelinePlayhead || 0) === 0 && !app.timelinePreviewLeadInPlayed) {
        app.timelinePreviewLeadInPlayed = true;
        app.timelinePreviewLeadInUntil = lastTime + 1050;
      }

      app.timelineTimer = setInterval(() => {
        const now = performance.now();
        if (app.timelinePreviewLeadInUntil) {
          if (now < app.timelinePreviewLeadInUntil) { updateTimelinePreviewLive(act); return; }
          app.timelinePreviewLeadInUntil = null;
          lastTime = now;
          updateTimelinePreviewLive(act);
          return;
        }
        const dt = (now - lastTime) / 1000;
        lastTime = now;
        const previousPlayhead = app.timelinePlayhead || 0;
        app.timelinePlayhead = previousPlayhead + dt;

        const enabledTracks = playbackTracks(act.timeline, app.timelinePlayhead);
        duration = Math.max(app.timelinePlayhead, ...enabledTracks.flatMap((track) => (track.clips || []).map((clip) => Number(clip.start || 0) + Number(clip.duration || 2))));
        const blocking = enabledTracks.flatMap((track) => track.clips || []).filter((clip) => {
          const start = Number(clip.start || 0);
          const needsInput = clip.waitForInput === true || clip.op === "choose-player" || isBranchingDecisionClip(clip);
          return needsInput && !app.timelinePreviewHandled.has(clip.id) && start >= previousPlayhead && start < app.timelinePlayhead;
        }).sort((a,b) => Number(a.start || 0) - Number(b.start || 0))[0];
        if (blocking) {
          app.timelinePlayhead = Number(blocking.start || 0) + .01;
          app.timelinePreviewWaiting = blocking.id;
          clearInterval(app.timelineTimer); app.timelineTimer = null; app.timelinePlaying = false;
          updateTimelinePreviewLive(act); return;
        }

        const currentTrack = enabledTracks.find((track) => (track.clips || []).some((clip) => app.timelinePlayhead >= Number(clip.start || 0) && app.timelinePlayhead < Number(clip.start || 0) + Number(clip.duration || 2)));
        if (currentTrack && currentTrack.id !== app.timelineActiveTrackId) {
          app.timelineActiveTrackId = currentTrack.id;
          document.querySelectorAll(".track-header-item,.timeline-track-lane").forEach((node) => node.classList.toggle("active-track", node.dataset.trackId === currentTrack.id));
        }

        if (app.timelinePlayhead >= duration) {
          app.timelinePlayhead = 0;
          app.timelinePreviewHandled = new Set();
          app.timelinePreviewBranches = {};
          app.timelinePreviewWaiting = null;
          app.timelinePreviewLeadInPlayed = false;
          clearInterval(app.timelineTimer); app.timelineTimer = null; app.timelinePlaying = false;
          render(); return;
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
        updateTimelinePreviewLive(act);
        const previewTime = document.querySelector(".timeline-live-preview time");
        if (previewTime) previewTime.textContent = `${app.timelinePlayhead.toFixed(1)}s`;

        // Live Audio/SFX triggers on clip hits
        for (const track of enabledTracks) {
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
    app.timelinePreviewWaiting = null; app.timelinePreviewHandled = new Set(); app.timelinePreviewBranches = {};
    app.timelinePreviewLeadInUntil = null; app.timelinePreviewLeadInPlayed = false;
    render(); playSfx("dialogue-blip"); return;
  }

  if (event.target.closest("[data-timeline-step]")) {
    const act = currentAction();
    const starts = playbackTracks(act.timeline, app.timelinePlayhead || 0).flatMap((track) => (track.clips || []).map((clip) => Number(clip.start) || 0)).filter((start) => start > (app.timelinePlayhead || 0) + .01).sort((a, b) => a - b);
    app.timelinePlayhead = starts[0] ?? 0;
    render(); playSfx("dialogue-blip"); return;
  }

  // Open Action Picker from Timeline Header
  if (event.target.closest("[data-open-action-picker-timeline]") || event.target.closest("[data-open-action-picker-root]")) {
    app.actionPickerOpen = true;
    app.actionPickerTab = "flow";
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
    const track = act.timeline.tracks.find((item) => item.id === trackId);
    if (!track || act.timeline.tracks.length <= 1) { toast("KEEP AT LEAST ONE TRACK"); return; }
    if (isBoundBranchTrack(act.timeline, trackId)) { toast("DELETE THE LOGIC BLOCK OR REMOVE ITS OUTCOME FIRST"); return; }
    act.timeline.tracks = act.timeline.tracks.filter((t) => t.id !== trackId);
    syncTimelineToCommands(act);
    save("event"); render(); playSfx("thunder"); toast("TRACK REMOVED");
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
      const released = isBranchingDecisionClip(found.clip) ? releaseDecisionTracks(act.timeline, found.clip.id) : 0;
      found.track.clips.splice(found.clipIndex, 1);
      syncTimelineToCommands(act);
      save("event"); render(); playSfx("lose"); toast(released ? `LOGIC DELETED · ${released} OUTCOME TRACK${released === 1 ? "" : "S"} RELEASED` : "CLIP DELETED");
    }
    return;
  }

  // Clicking on Ruler or Canvas Track area to Scrub Playhead Cursor
  const rulerTarget = event.target.closest("#timeline-ruler") || event.target.closest(".timeline-track-lane");
  if (rulerTarget && !event.target.closest(".timeline-clip-block, .clip-mini-btn, button")) {
    if (app.ignoreTimelineClick) return;
    const viewport = document.querySelector("#timeline-canvas-viewport");
    if (viewport) {
      const rect = viewport.getBoundingClientRect();
      const clickX = event.clientX - rect.left + viewport.scrollLeft;
      const pxPerSec = app.timelineZoom || 100;
      app.timelinePlayhead = Math.max(0, Math.round((clickX / pxPerSec) * 10) / 10);
      const lane = event.target.closest(".timeline-track-lane");
      if (lane?.dataset.trackId) app.timelineActiveTrackId = lane.dataset.trackId;
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

  // Cancel Space Action Deletion
  if (event.target.closest("[data-cancel-delete-space-action]") || (event.target.dataset && "closeDeleteSpaceActionBackdrop" in event.target.dataset)) {
    app.confirmDeleteSpaceAction = null;
    render(); return;
  }

  // Confirm Space Action Deletion
  const confirmDeleteBtn = event.target.closest("[data-confirm-delete-space-action]");
  if (confirmDeleteBtn) {
    const id = confirmDeleteBtn.dataset.confirmDeleteSpaceAction;
    if (app.project.events.entries.length <= 1) {
      app.confirmDeleteSpaceAction = null;
      toast("KEEP AT LEAST ONE SPACE ACTION"); playSfx("lose"); render(); return;
    }
    remember();
    app.project.events.entries = app.project.events.entries.filter((e) => e.id !== id);
    if (app.activeSpaceActionId === id) app.activeSpaceActionId = app.project.events.entries[0]?.id;
    app.confirmDeleteSpaceAction = null;
    save("event"); render(); playSfx("thunder"); toast("SPACE ACTION DELETED");
    return;
  }

  // Delete Space Action (Opens Confirmation Modal)
  const deleteBtn = event.target.closest("[data-space-action-delete]");
  if (deleteBtn) {
    if (app.project.events.entries.length <= 1) {
      toast("KEEP AT LEAST ONE SPACE ACTION"); playSfx("lose"); return;
    }
    app.confirmDeleteSpaceAction = deleteBtn.dataset.spaceActionDelete;
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

  // Edit Space Action
  const editBtn = event.target.closest("[data-space-action-edit], [data-space-action-card]");
  if (editBtn) {
    app.activeSpaceActionId = editBtn.dataset.spaceActionEdit || editBtn.dataset.spaceActionCard;
    app.spaceActionCatalogView = false;
    app.spaceActionTab = "visuals";
    render(); playSfx("dialogue-blip"); return;
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
    if (app.spaceActionTab === "timeline") { app.timelinePlayhead = 0; app.timelinePreviewWaiting = null; app.timelinePreviewHandled = new Set(); app.timelinePreviewBranches = {}; app.timelinePreviewLeadInUntil = null; app.timelinePreviewLeadInPlayed = false; }
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

  // Space Appearance Tab: Visibility Toggle & Actor Selection
  const toggleVisibility = event.target.closest("[data-toggle-actor-visibility]");
  if (toggleVisibility) {
    event.preventDefault();
    event.stopPropagation();
    const act = currentAction();
    const charId = toggleVisibility.dataset.toggleActorVisibility;
    const targetChar = (act?.characters || []).find((c) => String(c.id) === String(charId));
    if (targetChar) {
      const isCurrentlyVisible = targetChar.alwaysVisible !== false && targetChar.visibleOnBoard !== false;
      targetChar.alwaysVisible = !isCurrentlyVisible;
      targetChar.visibleOnBoard = !isCurrentlyVisible;
      syncSpaceActionToMapSpaces(act.id, act);
      save("event");
      save("map");
      render();
      playSfx(targetChar.alwaysVisible ? "star" : "dice");
    }
    return;
  }
  const openActorPicker = event.target.closest("[data-open-space-actor-picker]");
  if (openActorPicker) {
    app.spaceActorPickerOpen = true;
    render();
    playSfx("dialogue-blip");
    return;
  }
  const closeActorPicker = event.target.closest("[data-close-space-actor-picker]") || (event.target.classList.contains("space-actor-picker-backdrop") ? event.target : null);
  if (closeActorPicker) {
    app.spaceActorPickerOpen = false;
    render();
    return;
  }
  const selectAppearanceActor = event.target.closest("[data-select-appearance-actor]");
  if (selectAppearanceActor && !event.target.closest("select, input, button, .space-actor-folded-body")) {
    const nextId = selectAppearanceActor.dataset.selectAppearanceActor;
    app.spaceAppearanceActorId = (String(app.spaceAppearanceActorId) === String(nextId)) ? null : nextId;
    render();
    playSfx("dialogue-blip");
    return;
  }

  // Cast Tab / Space Actor Remove: Remove character
  const removeCastBtn = event.target.closest("[data-cast-remove], [data-space-actor-remove]");
  if (removeCastBtn) {
    const act = currentAction();
    const charId = removeCastBtn.dataset.spaceActorRemove || removeCastBtn.dataset.castRemove;
    if (act && act.characters) {
      const removed = act.characters.find((c) => String(c.id) === String(charId));
      act.characters = act.characters.filter((c) => String(c.id) !== String(charId));
      if (String(app.spaceAppearanceActorId) === String(charId)) {
        app.spaceAppearanceActorId = null;
      }
      syncSpaceActionToMapSpaces(act.id, act);
      save("event");
      save("map");
      render();
      playSfx("thunder");
      toast(`${(removed?.name || "ACTOR").toUpperCase()} REMOVED FROM SPACE`);
    }
    return;
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
  const presetSpaceActorBtn = event.target.closest("[data-add-preset-actor]");
  if (presetSpaceActorBtn) {
    const [name, icon, role, animation] = presetSpaceActorBtn.dataset.addPresetActor.split(":");
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
      const isBranch = isLogic || ["compare", "weighted-random", "switch", "check-assets", "check-status", "choice", "confirm"].includes(presetData.op) || presetData.isDecision === true;
      const dur = presetData.category === "dialogue" ? 2.5 : 1.8;

      const newClip = {
        ...presetData,
        id: `clip-${Date.now()}`,
        start: insertTime,
        duration: dur,
        category: presetData.category,
        kind: isBranch ? "condition" : ["assets", "status", "player"].includes(presetData.category) ? "player" : "action",
        label: presetData.label,
        isDecision: isBranch,
      };
      const firstActor=(act.characters||[])[0];
      if(newClip.category==="actors"&&firstActor){newClip.actorId=firstActor.id;newClip.target=firstActor.name;newClip.animationId=ragdollAnimations(firstActor)[0]?.id||"";}
      if(newClip.parameters&&Object.hasOwn(newClip.parameters,"actor")){newClip.parameters.actor=firstActor?.id||"";if(Object.hasOwn(newClip.parameters,"animation"))newClip.parameters.animation=ragdollAnimations(firstActor)[0]?.id||"";}
      if(newClip.op==="select-actor"&&newClip.parameters) newClip.parameters.selector=firstActor?.id||"";

      // Target track (active track or first unlocked track)
      let targetTrack = act.timeline.tracks.find((t) => t.id === app.timelineActiveTrackId && !t.locked) ||
                        act.timeline.tracks.find((t) => !t.locked) ||
                        act.timeline.tracks[0];

      targetTrack.clips ||= [];
      targetTrack.clips.push(newClip);
      targetTrack.clips.sort((a, b) => a.start - b.start);

      // Logic decisions own the lane immediately below them. Keeping that adjacency is
      // essential because both the renderer and drag/drop branch constraints use it.
      if (isBranch) {
        if (newClip.op === "choice") {
          ensureChoiceOptions(newClip);
          syncDecisionOutcomeTracks(act.timeline, targetTrack, newClip);
        } else {
        const targetIndex = act.timeline.tracks.indexOf(targetTrack);
        const laneBelow = act.timeline.tracks[targetIndex + 1];
        const falseLabel = newClip.parameters?.falseLabel || newClip.choice2 || "NO";
        if (!laneBelow || laneBelow.kind !== "branch-false") {
          const branchTrack = {
            id: `track-branch-${Date.now()}`,
            name: `Branch 2 · ${falseLabel} / False`,
            kind: "branch-false",
            boundDecisionId: newClip.id,
            color: "amber",
            locked: false,
            muted: false,
            clips: []
          };
          act.timeline.tracks.splice(targetIndex + 1, 0, branchTrack);
        } else {
          laneBelow.boundDecisionId = newClip.id;
          laneBelow.name = `Branch 2 · ${falseLabel} / False`;
        }
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

  // Save Edits from Command Inspector Modal
  if (event.target.closest("[data-save-cmd-edit]")) {
    if (!app.editingCommand) return;
    const act = currentAction();
    const foundClip = findClipInTimeline(act.timeline, app.editingCommand.id);
    const foundCmd = findCommandInTree(act.commands, app.editingCommand.id);
    const targetObj = foundClip ? foundClip.clip : (foundCmd ? foundCmd.cmd : null);

    if (targetObj) {
      const cat = targetObj.category || "dialogue";
      if (targetObj.op === "dialogue" || cat === "dialogue") {
        const spk = document.querySelector("#edit-cmd-speaker")?.value || "Active Player";
        const txt = document.querySelector("#edit-cmd-text")?.value.trim() || "";
        const sty = document.querySelector("#edit-cmd-style")?.value || "speech";
        targetObj.category = "dialogue";
        targetObj.speaker = spk;
        targetObj.text = txt;
        targetObj.style = sty;
        targetObj.parameters ||= {};
        targetObj.parameters.speaker = spk;
        targetObj.parameters.text = txt;
        targetObj.parameters.style = sty;
        targetObj.label = `${spk}: "${txt}"`;
      } else if (targetObj.op === "confirm") {
        const prompt = document.querySelector("#edit-confirm-prompt")?.value.trim() || "Are you sure?";
        const trueLabel = document.querySelector("#edit-confirm-true")?.value.trim() || "YES";
        const falseLabel = document.querySelector("#edit-confirm-false")?.value.trim() || "NO";
        targetObj.parameters ||= {};
        targetObj.parameters.prompt = prompt;
        targetObj.parameters.trueLabel = trueLabel;
        targetObj.parameters.falseLabel = falseLabel;
        targetObj.choice1 = trueLabel;
        targetObj.choice2 = falseLabel;
        targetObj.label = `CONFIRM: "${prompt}" [${trueLabel} / ${falseLabel}]`;
        const found = findClipInTimeline(act.timeline, targetObj.id);
        if (found) {
          const laneBelow = act.timeline.tracks[found.trackIndex + 1];
          if (laneBelow && (laneBelow.kind === "branch-false" || laneBelow.boundDecisionId === targetObj.id)) {
            laneBelow.name = `Branch 2 · ${falseLabel} / False`;
          }
        }
      } else if (targetObj.op === "choice") {
        targetObj.parameters.prompt = document.querySelector("#edit-choice-prompt")?.value.trim() || "Choose an option";
        targetObj.parameters.allowCancel = document.querySelector("#edit-choice-cancel")?.checked === true;
        targetObj.parameters.saveAs = document.querySelector("#edit-choice-output")?.value.trim() || "selectedChoice";
        for (const row of document.querySelectorAll("[data-choice-option]")) { const choice = targetObj.parameters.choices[Number(row.dataset.choiceOption)]; if (!choice) continue; for (const input of row.querySelectorAll("[data-choice-field]")) choice[input.dataset.choiceField] = input.value; }
        const foundChoice = findClipInTimeline(act.timeline, targetObj.id);
        if (foundChoice) syncDecisionOutcomeTracks(act.timeline, foundChoice.track, targetObj);
      } else if (Array.isArray(targetObj.parameterSchema) && targetObj.parameterSchema.length > 0) {
        targetObj.parameters = { ...(targetObj.parameters || {}), ...(app.editingCommand.cmd.parameters || {}) };
        for (const input of document.querySelectorAll("[data-generic-param]")) targetObj.parameters[input.dataset.genericParam] = input.type === "checkbox" ? input.checked : ["number","range"].includes(input.type) ? Number(input.value) : input.value;
        if (["spawn-actor","despawn-actor","spawn","despawn"].includes(targetObj.op)) {
          targetObj.stageEffect = document.querySelector("#edit-cmd-stage-effect")?.value || "none";
          targetObj.particleDump = {
            ...(app.editingCommand.cmd.particleDump || {}),
            count: Math.max(1, Math.min(300, Number(app.editingCommand.cmd.particleDump?.count) || 24)),
            controllers: app.editingCommand.cmd.particleDump?.controllers || []
          };
        }
        if (targetObj.op === "confirm" && targetObj.parameters.prompt) targetObj.label = `CONFIRM: "${targetObj.parameters.prompt}"`;
        else if (targetObj.op === "modify-asset" && targetObj.parameters.asset) targetObj.label = `MODIFY ASSET: ${targetObj.parameters.asset} (${targetObj.parameters.operation || "Add"} ${targetObj.parameters.amount ?? 10})`;
        else if (targetObj.op === "set-asset" && targetObj.parameters.asset) targetObj.label = `SET ASSET: ${targetObj.parameters.asset} = ${targetObj.parameters.amount ?? 0}`;
        else if (targetObj.op === "transfer-asset" && targetObj.parameters.asset) targetObj.label = `TRANSFER: ${targetObj.parameters.amount ?? 10} ${targetObj.parameters.asset}`;
        else if (targetObj.op === "apply-status" && targetObj.parameters.status) targetObj.label = `STATUS: ${targetObj.parameters.status} (${targetObj.parameters.duration ?? 2} ${targetObj.parameters.unit || "Turns"})`;
        else if (targetObj.op === "teleport" && targetObj.parameters.space) targetObj.label = `TELEPORT: ${typeof targetObj.parameters.space === "object" ? typedValueSummary("space-picker", targetObj.parameters.space) : targetObj.parameters.space}`;
        else if (targetObj.op === "launch-minigame" && targetObj.parameters.game) targetObj.label = `LAUNCH: ${targetObj.parameters.game}`;
        else if (targetObj.op === "start-duel") targetObj.label = `DUEL: ${targetObj.parameters.stake ?? 10} ${targetObj.parameters.stakeAsset || "Coins"}`;
        else if (targetObj.op === "dialogue" && targetObj.parameters.text) targetObj.label = `${targetObj.parameters.speaker || "Dialogue"}: "${targetObj.parameters.text}"`;
      } else if (cat === "dialogue") {
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
      } else if (cat === "actors" || targetObj.actorAction === "spawn" || targetObj.actorAction === "despawn" || ["spawn-actor","despawn-actor","spawn","despawn"].includes(targetObj.op)) {
        const actorId = document.querySelector("#edit-cmd-actor-target")?.value || "";
        const selectedActor = (currentSpaceAction()?.characters || []).find(actor=>String(actor.id)===String(actorId));
        const target = selectedActor?.name || "Unassigned Actor";
        const actAction = document.querySelector("#edit-cmd-actor-action")?.value || (["spawn-actor","spawn"].includes(targetObj.op) ? "spawn" : ["despawn-actor","despawn"].includes(targetObj.op) ? "despawn" : "pose");
        const pose = document.querySelector("#edit-cmd-pose")?.value || "cheer";
        targetObj.target = target;
        targetObj.actorAction = actAction;
        targetObj.pose = pose;
        targetObj.actorId = actorId;
        targetObj.animationId = document.querySelector("#edit-cmd-animation")?.value || "";
        targetObj.transition = document.querySelector("#edit-cmd-transition")?.value || "crossfade";
        targetObj.stageEffect = document.querySelector("#edit-cmd-stage-effect")?.value || "none";
        targetObj.particleDump = {
          ...(app.editingCommand.cmd.particleDump || {}),
          count: Math.max(1, Math.min(300, Number(app.editingCommand.cmd.particleDump?.count) || 24)),
          controllers: app.editingCommand.cmd.particleDump?.controllers || []
        };
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
      } else if (cat === "logic") {
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
      targetObj.duration=Math.max(.1,Number(document.querySelector("#edit-cmd-duration")?.value)||2);
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

  if (event.target.closest("[data-close-toy-editor]") || event.target.classList.contains("toy-editor-backdrop")) {
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
  if(event.target.matches("[data-space-actor-picker]")){
    const cast=currentSpaceAction()?.characters||[],actor=selectedSpaceActor(cast,event.target.value),animationPicker=event.target.closest(".cmd-editor-body")?.querySelector("[data-ragdoll-animation-picker]");
    if(animationPicker)animationPicker.innerHTML=ragdollAnimationPickerOptions(actor,"");
    return;
  }
  if(event.target.matches("[data-keyframe-time]")){moveSelectedKeyframe(Number(event.target.value));save("actors");render();return;}
  const keyframePointField=event.target.closest("[data-keyframe-point]");if(keyframePointField){const {frame}=selectedActorAnimation();if(frame){const [index,axis]=keyframePointField.dataset.keyframePoint.split(":");frame.corners[Number(index)][axis]=Number(keyframePointField.value);save("actors");render();}return;}
  const anchorField=event.target.closest("[data-keyframe-anchor]");if(anchorField){const {frame}=selectedActorAnimation();if(frame){frame.anchor[anchorField.dataset.keyframeAnchor]=Number(anchorField.value);save("actors");render();}return;}
  const emoteField=event.target.closest("[data-keyframe-emote]");if(emoteField){const {frame}=selectedActorAnimation();if(frame){frame.emote ||= {};frame.emote[emoteField.dataset.keyframeEmote]=emoteField.type==="checkbox"?emoteField.checked:emoteField.value;save("actors");render();}return;}
  if(event.target.matches("[data-keyframe-sound]")){const {frame}=selectedActorAnimation();if(frame){frame.sound=event.target.value;save("actors");}return;}
  const spawnField=event.target.closest("[data-particle-spawn-field]");if(spawnField){const {frame}=selectedActorAnimation(),row=spawnField.closest("[data-keyframe-particle]"),spawn=frame?.particles?.[Number(row?.dataset.keyframeParticle)];if(spawn){spawn[spawnField.dataset.particleSpawnField]=spawnField.type==="number"?Number(spawnField.value):spawnField.value;save("actors");render();}return;}
  const particlePickerField=event.target.closest("[data-particle-picker-field]");if(particlePickerField&&app.particlePickerEditor){app.particlePickerEditor[particlePickerField.dataset.particlePickerField]=particlePickerField.type==="number"||particlePickerField.type==="range"?Number(particlePickerField.value):particlePickerField.value;render();return;}
  const actorField=event.target.closest("[data-actor-field]");if(actorField){const actor=ensureBoardActors().find(item=>String(item.id)===String(app.actorEditorId))||currentAction()?.characters?.find(item=>String(item.id)===String(app.actorEditorId));if(actor){const oldName=actor.name;actor[actorField.dataset.actorField]=actorField.value;syncActorToAllSpaceActions(actor.id,oldName,actor);save("actors");save("event");render();}return;}
  const animationField=event.target.closest("[data-animation-field]");if(animationField){const actor=ensureBoardActors().find(item=>item.id===app.actorEditorId)||currentAction()?.characters?.find(item=>item.id===app.actorEditorId),animation=actor&&ensureActorAnimations(actor).find(item=>item.id===app.actorAnimationId);if(animation){animation[animationField.dataset.animationField]=animationField.type==="number"?Math.max(.1,Number(animationField.value)):animationField.value;save("actors");save("event");render();}return;}
  const effectField=event.target.closest("[data-keyframe-effect]");if(effectField){const actor=ensureBoardActors().find(item=>item.id===app.actorEditorId)||currentAction()?.characters?.find(item=>item.id===app.actorEditorId),animation=actor&&ensureActorAnimations(actor).find(item=>item.id===app.actorAnimationId),frame=app.actorKeyframeSelected?animation?.keyframes?.[app.actorKeyframeIndex]:null;if(frame){frame.effect=effectField.value;save("actors");save("event");}return;}
  const boardActorUpload = event.target.closest("#board-actor-file-upload");
  if (boardActorUpload && boardActorUpload.files && boardActorUpload.files[0]) {
    const file = boardActorUpload.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      const dataUrl = e.target.result;
      const actors = ensureBoardActors();
      const count = actors.length + 1;
      actors.push({
        id: `actor-${Date.now()}`,
        name: file.name.replace(/\.[^/.]+$/, "") || `Actor ${count}`,
        role: "Actor",
        isHost: false,
        icon: "🖼️",
        sprite: dataUrl,
        anchor: "center",
        animation: "float",
        animations: [],
      });
      save("actors");
      render();
      playSfx("star");
      toast("ACTOR SPRITE UPLOADED! ★");
    };
    reader.readAsDataURL(file);
    return;
  }
  if (app.valuePickerEditor) {
    if (event.target.matches("[data-color-picker-value],[data-color-picker-text]")) { app.valuePickerEditor.value = event.target.value; render(); return; }
    const selectorField = event.target.closest("[data-space-selector-field]"); if (selectorField) { app.valuePickerEditor.value[selectorField.dataset.spaceSelectorField] = selectorField.value; render(); return; }
    const filterField = event.target.closest("[data-space-filter-field]"); if (filterField) { app.valuePickerEditor.value.filters ||= {}; app.valuePickerEditor.value.filters[filterField.dataset.spaceFilterField] = filterField.value; render(); return; }
    if (event.target.id === "typed-picker-category") { const category = event.target.value; for (const card of root.querySelectorAll("[data-picker-category]")) card.hidden = category !== "all" && card.dataset.pickerCategory !== category; return; }
  }
  if (app.playerSelectorEditor) {
    const selector = app.playerSelectorEditor.selector;
    const seat = event.target.closest("[data-player-seat]");
    if (seat) { const value = Number(seat.dataset.playerSeat); selector.seats = seat.checked ? [...new Set([...selector.seats, value])] : selector.seats.filter((item) => item !== value); selector.multiple = selector.seats.length > 1; render(); return; }
    const field = event.target.closest("[data-player-selector-field]");
    if (field) { const key = field.dataset.playerSelectorField; selector[key] = field.type === "checkbox" ? field.checked : key === "multiple" ? field.value === "true" : field.type === "number" ? Number(field.value) : field.value; if (key === "multiple" && !selector.multiple) selector.limit = 1; render(); return; }
    const sort = event.target.closest("[data-player-sort]");
    if (sort) { selector.sort[sort.dataset.playerSort] = sort.value; render(); return; }
    const filterField = event.target.closest("[data-player-filter-field]");
    if (filterField) { const row = filterField.closest("[data-player-filter-index]"); const filter = selector.filters[Number(row?.dataset.playerFilterIndex)]; if (filter) filter[filterField.dataset.playerFilterField] = filterField.type === "number" ? Number(filterField.value) : filterField.value; render(); return; }
  }
  const activationField = event.target.closest("[data-activation-field]");
  if (activationField) {
    const act = app.project.events.entries.find((entry) => entry.id === app.activeSpaceActionId) || app.project.events.entries[0];
    const card = activationField.closest("[data-activation-rule]");
    const rule = act?.activationRules?.find((item) => item.id === card?.dataset.activationRule);
    if (rule) {
      const field = activationField.dataset.activationField;
      rule[field] = activationField.type === "checkbox" ? activationField.checked : activationField.type === "number" ? Number(activationField.value) : activationField.value;
      save("event"); render();
    }
    return;
  }
  const activationCondition = event.target.closest("[data-activation-condition]");
  if (activationCondition) {
    const act = app.project.events.entries.find((entry) => entry.id === app.activeSpaceActionId) || app.project.events.entries[0];
    const rule = act?.activationRules?.find((item) => item.id === app.editingActivationId);
    if (rule) { rule.condition ||= {}; const key = activationCondition.dataset.activationCondition; rule.condition[key] = activationCondition.type === "checkbox" ? activationCondition.checked : activationCondition.value; save("event"); render(); }
    return;
  }
  const activationAppearance = event.target.closest("[data-activation-appearance]");
  if (activationAppearance) {
    const act = app.project.events.entries.find((entry) => entry.id === app.activeSpaceActionId) || app.project.events.entries[0];
    const rule = act?.activationRules?.find((item) => item.id === app.editingActivationId);
    if (rule) { rule.appearance ||= {}; rule.appearance[activationAppearance.dataset.activationAppearance] = activationAppearance.value; save("event"); render(); }
    return;
  }
  // Map Replacement Image Upload
  const mapImgInput = event.target.closest("#map-image-upload");
  if (mapImgInput && mapImgInput.files && mapImgInput.files[0]) {
    const file = mapImgInput.files[0];
    const reader = new FileReader();
    reader.onload = (e) => {
      remember();
      app.project.map.image = e.target.result;
      save("map");
      render();
      playSfx("star");
      toast("MAP IMAGE UPDATED! ★");
    };
    reader.readAsDataURL(file);
    return;
  }
  const foregroundInput=event.target.closest("#map-foreground-upload");if(foregroundInput?.files?.[0]){const reader=new FileReader();reader.onload=load=>{remember();app.project.map.foreground=load.target.result;save("map");render();toast("FOREGROUND LAYER UPDATED! ★");};reader.readAsDataURL(foregroundInput.files[0]);return;}
  const effectUpload=event.target.closest("#effect-image-upload,#effect-sound-upload,#effect-music-upload");if(effectUpload?.files?.[0]){const effect=ensureEffects().find(item=>item.id===app.activeEffectId);if(!effect)return;const key=effectUpload.id==="effect-image-upload"?"image":effectUpload.id==="effect-sound-upload"?"sound":"music",reader=new FileReader();reader.onload=load=>{effect[key]=load.target.result;save("data");render();toast(`${key.toUpperCase()} UPLOADED! ★`);};reader.readAsDataURL(effectUpload.files[0]);return;}

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
  const changeActorField = event.target.closest("[data-space-actor-field]");
  if (changeActorField) {
    const act = currentAction();
    const field = changeActorField.dataset.spaceActorField;
    const targetCharId = changeActorField.dataset.actorId || app.spaceAppearanceActorId;
    const targetChar = (act.characters || []).find((c) => String(c.id) === String(targetCharId)) || (act.characters || [])[0];
    if (targetChar) {
      if (field === "alwaysVisible") {
        targetChar.alwaysVisible = changeActorField.checked;
        targetChar.visibleOnBoard = changeActorField.checked;
      } else if (field === "scale") {
        targetChar[field] = Number(changeActorField.value);
      } else if (field === "animation") {
        targetChar.animation = changeActorField.value;
        targetChar.idleAnimationId = changeActorField.value;
      } else {
        targetChar[field] = changeActorField.value;
      }
      syncSpaceActionToMapSpaces(act.id, act);
      save("event");
      save("map");
      render();
    }
  }
});

root.addEventListener("input", (event) => {
  if (event.target.matches("[data-space-preview-scale]")) {
    app.spacePreviewScale = Number(event.target.value);
    const wrap = root.querySelector(".space-preview-token-wrap");
    if (wrap) wrap.style.transform = `scale(${app.spacePreviewScale})`;
    const scaleLbl = event.target.closest("div")?.querySelector("b");
    if (scaleLbl) scaleLbl.textContent = `${app.spacePreviewScale.toFixed(1)}x`;
    const act = currentAction();
    (act?.characters || []).forEach((char) => {
      const node = root.querySelector(`[data-space-actor-drag="${char.id}"]`);
      if (node) {
        const sc = Math.max(0.2, Number(char.scale ?? 1.0) * app.spacePreviewScale);
        const offX = Number(char.offsetX ?? 0) * app.spacePreviewScale;
        const offY = Number(char.offsetY ?? -34) * app.spacePreviewScale;
        node.style.left = `calc(50% + ${offX}px)`;
        node.style.top = `calc(50% + ${offY}px)`;
        node.style.transform = `translate(-50%, -50%) scale(${sc})`;
      }
    });
    return;
  }
  const liveSpaceActorField = event.target.closest("[data-space-actor-field]");
  if (liveSpaceActorField) {
    const act = currentAction();
    const field = liveSpaceActorField.dataset.spaceActorField;
    const targetCharId = liveSpaceActorField.dataset.actorId || app.spaceAppearanceActorId;
    const targetChar = (act.characters || []).find((c) => String(c.id) === String(targetCharId)) || (act.characters || [])[0];
    if (targetChar) {
      if (field === "scale") {
        targetChar[field] = Number(liveSpaceActorField.value);
        const out = liveSpaceActorField.closest(".input-row-group")?.querySelector("output");
        if (out) out.textContent = `${targetChar[field].toFixed(2)}x`;
        const previewNode = root.querySelector(`[data-space-actor-drag="${targetChar.id}"]`);
        if (previewNode) {
          const previewScale = app.spacePreviewScale || 1.0;
          const sc = Math.max(0.2, Number(targetChar.scale ?? 1.0) * previewScale);
          const offX = Number(targetChar.offsetX ?? 0) * previewScale;
          const offY = Number(targetChar.offsetY ?? -34) * previewScale;
          previewNode.style.left = `calc(50% + ${offX}px)`;
          previewNode.style.top = `calc(50% + ${offY}px)`;
          previewNode.style.transform = `translate(-50%, -50%) scale(${sc})`;
        }
      }
      syncSpaceActionToMapSpaces(act.id, act);
      save("event");
      save("map");
    }
    return;
  }
  const liveActorField = event.target.closest("[data-actor-field]");
  if (liveActorField) {
    const actor = ensureBoardActors().find(item => String(item.id) === String(app.actorEditorId)) || currentAction()?.characters?.find(item => String(item.id) === String(app.actorEditorId));
    if (actor) {
      const oldName = actor.name;
      actor[liveActorField.dataset.actorField] = liveActorField.value;
      if (liveActorField.dataset.actorField === "name") {
        const titleEl = root.querySelector(".actor-settings-dialog header b");
        if (titleEl) titleEl.textContent = liveActorField.value;
      }
      syncActorToAllSpaceActions(actor.id, oldName, actor);
    }
    return;
  }
  const livePoint=event.target.closest("[data-keyframe-point]");if(livePoint){const {frame}=selectedActorAnimation();if(frame){const [index,axis]=livePoint.dataset.keyframePoint.split(":");frame.corners[Number(index)][axis]=Number(livePoint.value);app.actorPreviewRenderer?.applyFrame(frame);}return;}
  const liveAnchor=event.target.closest("[data-keyframe-anchor]");if(liveAnchor){const {frame}=selectedActorAnimation();if(frame){frame.anchor[liveAnchor.dataset.keyframeAnchor]=Number(liveAnchor.value);app.actorPreviewRenderer?.applyFrame(frame);}return;}
  if(event.target.matches("[data-keyframe-time]")){moveSelectedKeyframe(Number(event.target.value));app.actorPreviewRenderer?.seek(app.actorPreviewTime);const dot=root.querySelector(`[data-actor-keyframe="${app.actorKeyframeIndex}"]`);if(dot)dot.style.left=`${selectedActorAnimation().frame.time*100}%`;return;}
  const liveEmote=event.target.closest("[data-keyframe-emote]");if(liveEmote&&["icon","color"].includes(liveEmote.dataset.keyframeEmote)){const {animation,frame}=selectedActorAnimation();if(frame){frame.emote[liveEmote.dataset.keyframeEmote]=liveEmote.value;updateActorPreviewDecorations(root.querySelector("[data-actor-preview]"),animation,app.actorPreviewTime,true);}return;}
  if(event.target.matches("[data-actor-preview-scrub]")){app.actorPreviewTime=Number(event.target.value);app.actorPreviewPlaying=false;app.actorKeyframeSelected=false;root.querySelectorAll("[data-actor-keyframe]").forEach(dot=>dot.classList.remove("selected"));if(app.actorPreviewRenderer){app.actorPreviewRenderer.playing=false;app.actorPreviewRenderer.seek(app.actorPreviewTime);}updateActorPreviewDecorations(root.querySelector("[data-actor-preview]"),selectedActorAnimation().animation,app.actorPreviewTime,true);const label=root.querySelector("[data-actor-preview-time]");if(label)label.textContent=`${app.actorPreviewTime.toFixed(2)}s`;return;}
  if (event.target.matches(".parameter-range input[type=range]")) { const output = event.target.closest(".parameter-range")?.querySelector("output"); if (output) output.textContent = event.target.value; }
  if (event.target.id === "typed-picker-search") { const query = event.target.value.trim().toLowerCase(); for (const card of root.querySelectorAll("[data-picker-search]")) card.hidden = Boolean(query) && !card.dataset.pickerSearch.includes(query); return; }
  if (event.target.id === "action-block-search") {
    const query = event.target.value.trim().toLowerCase();
    for (const card of root.querySelectorAll("[data-preset-search]")) card.hidden = Boolean(query) && !card.dataset.presetSearch.includes(query);
    return;
  }
  if (event.target.id === "act-prox-radius") {
    const lbl = document.querySelector("#prox-radius-label");
    if (lbl) lbl.textContent = `${event.target.value} UNITS`;
  }
});
// Helper: Detect whether a clip is an originating branching / decision / logic block
function isBranchingDecisionClip(clip) {
  if (!clip) return false;
  const op = String(clip.op || "").toLowerCase();
  const cat = String(clip.category || (clip.kind === "condition" ? "logic" : "dialogue")).toLowerCase();
  const branchingOps = ["compare", "confirm", "choice", "check-assets", "check-status", "weighted-random", "switch", "roulette", "decision", "condition", "transaction", "toll", "service-purchase"];
  if (branchingOps.includes(op)) return true;
  if (clip.kind === "condition" || clip.isDecision === true) return true;
  if (cat === "logic" || cat === "input") return true;
  if (Boolean(clip.inputType) || Boolean(clip.condType)) return true;
  if (clip.label && /prompt|question|qte|decision|compare|branch|check/i.test(clip.label)) return true;
  return false;
}

// Helper: Detect whether a track is a bound-to-logic secondary branch track
function isBoundBranchTrack(timeline, trackId) {
  if (!timeline || !Array.isArray(timeline.tracks)) return false;
  const tIdx = timeline.tracks.findIndex((t) => t.id === trackId);
  if (tIdx <= 0) return false;
  const track = timeline.tracks[tIdx];
  if (track.kind === "branch-false" || track.kind === "branch-outcome" || track.boundDecisionId) return true;
  const prevTrack = timeline.tracks[tIdx - 1];
  if ((prevTrack?.clips || []).some(isBranchingDecisionClip)) return true;
  return false;
}

function releaseDecisionTracks(timeline, decisionId) {
  let released = 0;
  for (const track of timeline?.tracks || []) if (track.boundDecisionId === decisionId) {
    track.kind = "normal"; delete track.boundDecisionId; delete track.outcomeId;
    track.name = track.name.replace(/^Choice · [^·]+ · /, "").replace(/^Branch \d+ · [^·]+(?: · )?/, "") || `Track ${timeline.tracks.indexOf(track) + 1}`;
    released++;
  }
  const found = findClipInTimeline(timeline, decisionId);
  const legacy = found ? timeline.tracks[found.trackIndex + 1] : null;
  if (legacy && legacy.kind === "branch-false" && !legacy.boundDecisionId) { legacy.kind = "normal"; legacy.name = `Track ${found.trackIndex + 2}`; released++; }
  return released;
}

function syncDecisionOutcomeTracks(timeline, decisionTrack, clip) {
  if (!timeline || !decisionTrack || !clip) return;
  const choices = Array.isArray(clip.parameters?.choices) ? clip.parameters.choices : [];
  if (clip.op !== "choice" || choices.length < 2) return;
  const current = timeline.tracks.filter((track) => track.boundDecisionId === clip.id);
  const anchor = timeline.tracks.indexOf(decisionTrack);
  choices.slice(1).forEach((choice, index) => {
    let track = current[index];
    if (!track) {
      track = { id:`track-choice-${clip.id}-${choice.id}`, name:"", kind:"branch-outcome", color:["amber","cyan","emerald","rose","indigo"][index % 5], locked:false, muted:false, clips:[] };
      timeline.tracks.splice(anchor + index + 1, 0, track);
    }
    track.kind = "branch-outcome"; track.boundDecisionId = clip.id; track.outcomeId = choice.id;
    track.name = `Choice · ${choice.label || `Option ${index + 2}`} · Outcome`;
  });
  for (const extra of current.slice(Math.max(0, choices.length - 1))) { extra.kind = "normal"; delete extra.boundDecisionId; delete extra.outcomeId; extra.name = `Track ${timeline.tracks.indexOf(extra) + 1}`; }
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

root.addEventListener("change",event=>{
  const placementParticle=event.target.closest("[data-placement-particle]");if(placementParticle){const placement=app.project.map.effectPlacements.find(item=>item.id===app.placementInspectorId),particle=ensureEffects().find(item=>item.id===placementParticle.value&&item.kind==="particle");if(placement){bindParticleToPlacement(placement,particle);save("map");render();toast(particle?`${particle.name.toUpperCase()} ASSIGNED`:"PARTICLE ASSIGNMENT CLEARED");}return;}
  const placementField=event.target.closest("[data-placement-edit]");if(placementField){const placement=app.project.map.effectPlacements.find(item=>item.id===app.placementInspectorId);if(placement){placement[placementField.dataset.placementEdit]=Number(placementField.value);save("map");render();}return;}
  const effectField=event.target.closest("[data-effect-edit]");if(effectField){const effect=ensureEffects().find(item=>item.id===app.activeEffectId);if(effect){const key=effectField.dataset.effectEdit;effect[key]=effectField.type==="range"?Number(effectField.value):effectField.value;if(key==="kind"){effect.type=effect.kind==="controller"?"emitter":effect.kind==="lightsource"?"point-light":"particle";app.effectPropertyTab="identity";}save("data");render();}return;}
  const mapSetting=event.target.closest("[data-map-setting]");if(mapSetting){remember();app.project.map[mapSetting.dataset.mapSetting]=mapSetting.value;save("map");render();return;}
  const mapDefault=event.target.closest("[data-map-default]");if(mapDefault){remember();app.project.map.defaults||={};app.project.map.defaults[mapDefault.dataset.mapDefault]=mapDefault.type==="checkbox"?mapDefault.checked:["range","number"].includes(mapDefault.type)?Number(mapDefault.value):mapDefault.value;save("map");render();return;}
  const multiSpace=event.target.closest("[data-multi-space-edit]");if(multiSpace&&multiSpace.value!==""){remember();const key=multiSpace.dataset.multiSpaceEdit,value=["size","rotation"].includes(key)?Number(multiSpace.value):multiSpace.value;for(const space of app.project.map.spaces.filter(item=>app.selectedSpaces.has(item.id)))space[key]=value;save("map");render();return;}
  const spaceField=event.target.closest("[data-space-edit]");if(spaceField){const space=app.project.map.spaces.find(item=>item.id===app.mapInspector);if(!space)return;remember();const key=spaceField.dataset.spaceEdit,value=spaceField.type==="checkbox"?spaceField.checked:spaceField.type==="number"||spaceField.type==="range"?Number(spaceField.value):spaceField.value;if(key==="name"){space.activity||={id:space.action||`space-${space.id}`,icon:"✦"};space.activity.title=value;}else space[key]=value;save("map");render();return;}
  const pathDirection=event.target.closest("[data-path-edit=direction]");if(pathDirection){const path=app.project.map.paths.find(item=>item.id===app.editingPath);if(path){remember();path.oneWay=pathDirection.value!=="both";path.direction=pathDirection.value==="reverse"?"reverse":"forward";save("map");render();}return;}
  const pathRender=event.target.closest("[data-path-render]");if(pathRender){const path=app.project.map.paths.find(item=>item.id===app.editingPath);if(path){remember();path.render||={};const key=pathRender.dataset.pathRender;path.render[key]=pathRender.type==="checkbox"?pathRender.checked:pathRender.type==="range"?Number(pathRender.value):pathRender.value;save("map");render();}return;}
  const pointField=event.target.closest("[data-point-edit]");if(pointField){const menu=app.pathPointMenu,path=menu&&app.project.map.paths.find(item=>item.id===menu.pathId),point=path?.points?.[menu.index];if(point){remember();const key=pointField.dataset.pointEdit;point[key]=pointField.type==="checkbox"?pointField.checked:pointField.type==="range"?Number(pointField.value):pointField.value;save("map");render();}return;}
});
root.addEventListener("dragstart", (event) => {
  const actorCard = event.target.closest("[data-draggable-actor]");
  if (actorCard) {
    event.dataTransfer?.setData("text/x-board-actor", actorCard.dataset.draggableActor);
    event.dataTransfer.effectAllowed = "move";
    actorCard.classList.add("dragging-actor");
    return;
  }
  const effect = event.target.closest("[data-placement-effect]");
  if (effect) {
    event.dataTransfer?.setData("text/x-sfx-controller", effect.dataset.placementEffect);
    event.dataTransfer.effectAllowed = "copy";
    return;
  }
  const action = event.target.closest("[data-catalog-action]");
  if (action) event.dataTransfer?.setData("text/x-space-action", action.dataset.catalogAction);
});
root.addEventListener("dragend", () => {
  document.querySelectorAll(".dragging-actor").forEach((el) => el.classList.remove("dragging-actor"));
  document.querySelectorAll(".host-dropzone.drag-over").forEach((el) => el.classList.remove("drag-over"));
});
root.addEventListener("dragover", (event) => {
  const hostDropzone = event.target.closest("[data-host-dropzone]");
  if (hostDropzone && event.dataTransfer?.types.includes("text/x-board-actor")) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "move";
    hostDropzone.classList.add("drag-over");
    return;
  }
  const effectsBoard = event.target.closest("#effects-board");
  if (effectsBoard && event.dataTransfer?.types.includes("text/x-sfx-controller")) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    return;
  }
  const board = event.target.closest("#map-board");
  if (board && event.dataTransfer?.types.includes("text/x-space-action")) {
    event.preventDefault();
    event.dataTransfer.dropEffect = "copy";
    const point = boardPoint(board, event);
    let shadow = board.querySelector(".space-drop-shadow.catalog-shadow");
    if (!shadow) {
      shadow = document.createElement("span");
      shadow.className = "space-drop-shadow catalog-shadow";
      board.append(shadow);
    }
    shadow.style.left = `${point.x}%`;
    shadow.style.top = `${point.y}%`;
  }
});
root.addEventListener("dragleave", (event) => {
  const hostDropzone = event.target.closest("[data-host-dropzone]");
  if (hostDropzone && !hostDropzone.contains(event.relatedTarget)) {
    hostDropzone.classList.remove("drag-over");
  }
  if (event.target.closest("#map-board") && !event.relatedTarget?.closest?.("#map-board")) {
    document.querySelector(".catalog-shadow")?.remove();
  }
});
root.addEventListener("drop", (event) => {
  const hostDropzone = event.target.closest("[data-host-dropzone]");
  const droppedActorId = event.dataTransfer?.getData("text/x-board-actor");
  if (hostDropzone && droppedActorId) {
    event.preventDefault();
    hostDropzone.classList.remove("drag-over");
    const actors = ensureBoardActors();
    const actor = actors.find((a) => String(a.id) === String(droppedActorId));
    if (actor) {
      actors.forEach((a) => (a.isHost = false));
      actor.isHost = true;
      actor.role = "Host";
      save("actors");
      render();
      playSfx("fanfare");
      toast(`👑 ${actor.name.toUpperCase()} IS NOW THE STAGE HOST! ★`);
    }
    return;
  }
  const effectsBoard = event.target.closest("#effects-board"), effectId = event.dataTransfer?.getData("text/x-sfx-controller");
  if (effectsBoard && effectId && studioBoardRenderer) {
    event.preventDefault();
    const definitions = ensureEffects(), effect = definitions.find((item) => item.id === effectId), particle = effect && definitions.find((item) => item.id === effect.boundEffectId), rect = studioBoardRenderer.app.canvas.getBoundingClientRect(), point = studioBoardRenderer.percentFromScreen(event.clientX - rect.left, event.clientY - rect.top);
    if (effect && effect.kind !== "particle") {
      remember();
      app.project.map.effectPlacements.push({ ...structuredClone(effect), particle: particle ? structuredClone(particle) : null, id: `placement-${Date.now()}`, effectId: effect.id, ...point });
      save("map");
      render();
      toast(`${effect.name.toUpperCase()} PLACED`);
    }
    return;
  }
  const board = event.target.closest("#map-board"), actionId = event.dataTransfer?.getData("text/x-space-action");
  document.querySelector(".catalog-shadow")?.remove();
  if (!board || !actionId) return;
  event.preventDefault();
  const action = app.project.events.entries.find((item) => item.id === actionId);
  if (!action) return;
  remember();
  const map = app.project.map, id = Math.max(-1, ...map.spaces.map((space) => space.id)) + 1, point = boardPoint(board, event), space = mapSpaceAction({ id, ...point, depth: 2 }, action, map.spaces.length);
  map.spaces.push(space);
  app.selectedSpace = id;
  app.justPlacedSpace = id;
  save("map");
  render();
  toast(`PLACED ${action.name}`);
  sound(620, .1);
});
root.addEventListener("pointerdown",(event)=>{
  const actorDrag = event.target.closest("[data-space-actor-drag]");
  if (actorDrag && event.button === 0) {
    const act = currentAction();
    const charId = actorDrag.dataset.spaceActorDrag;
    const targetChar = (act?.characters || []).find((c) => String(c.id) === String(charId));
    if (targetChar) {
      app.spaceAppearanceActorId = charId;
      app.spaceActorDrag = {
        pointerId: event.pointerId,
        charId,
        startX: event.clientX,
        startY: event.clientY,
        initialOffsetX: Number(targetChar.offsetX ?? 0),
        initialOffsetY: Number(targetChar.offsetY ?? -34),
        node: actorDrag,
        moved: false
      };
      actorDrag.setPointerCapture?.(event.pointerId);
      event.preventDefault();
      event.stopPropagation();
      return;
    }
  }
  const previewStageDrag=event.target.closest("[data-preview-stage-drag]");if(previewStageDrag&&event.button===0){const act=currentAction(),found=findClipInTimeline(act,previewStageDrag.dataset.previewStageClip),scene=previewStageDrag.closest("[data-preview-scene]");if(found&&scene){app.timelineStageDrag={pointerId:event.pointerId,clip:found.clip,node:previewStageDrag,scene,moved:false};previewStageDrag.setPointerCapture?.(event.pointerId);event.preventDefault();event.stopPropagation();return;}}
  const keyframeDot=event.target.closest("[data-actor-keyframe]");if(keyframeDot&&event.button===0){const {animation}=selectedActorAnimation(),track=keyframeDot.closest(".actor-keyframe-track");if(animation&&track){app.actorKeyframeIndex=Number(keyframeDot.dataset.actorKeyframe);app.actorKeyframeSelected=true;app.actorKeyframeDrag={pointerId:event.pointerId,track,animation};keyframeDot.setPointerCapture?.(event.pointerId);event.preventDefault();}return;}
  const placementMarker=event.target.closest("[data-effect-placement]");if(placementMarker&&event.button===0){const placement=app.project.map.effectPlacements.find(item=>item.id===placementMarker.dataset.effectPlacement);if(placement){app.placementDrag={pointerId:event.pointerId,id:placement.id,startX:event.clientX,startY:event.clientY,before:structuredClone(app.project),moved:false,holdTimer:setTimeout(()=>{app.placementInspectorId=placement.id;app.placementDrag=null;render();sound(260,.12);},650)};placementMarker.setPointerCapture?.(event.pointerId);event.preventDefault();}return;}
  const catalogAction=event.target.closest("[data-catalog-action]");if(catalogAction&&event.button===0){const avatar=catalogAction.querySelector(".space-token-visual")?.cloneNode(true)||document.createElement("span");avatar.classList.add("catalog-drag-avatar");document.body.append(avatar);app.catalogDrag={pointerId:event.pointerId,actionId:catalogAction.dataset.catalogAction,avatar};catalogAction.setPointerCapture?.(event.pointerId);avatar.style.left=`${event.clientX}px`;avatar.style.top=`${event.clientY}px`;event.preventDefault();return;}
  const heldSpace=event.target.closest("[data-space]");if(heldSpace&&event.button===0){const id=Number(heldSpace.dataset.space);app.mapHold={pointerId:event.pointerId,id,startX:event.clientX,startY:event.clientY,timer:setTimeout(()=>{app.suppressMapClick=true;app.mapHoldMenu=id;app.mapHold=null;render();sound(260,.12);},650)};}
  const heldPath=event.target.closest(".path-hit");if(heldPath&&event.button===0&&!app.mapInspector&&!app.editingPath&&!app.pathPointMenu){const pathId=heldPath.closest("[data-path-id]")?.dataset.pathId;app.mapPathHold={pointerId:event.pointerId,pathId,startX:event.clientX,startY:event.clientY,timer:setTimeout(()=>{app.suppressMapClick=true;app.editingPath=pathId;app.mapPathHold=null;render();sound(260,.12);},650)};}
  const point=event.target.closest("[data-path-point]");if(point&&app.editingPath&&event.button===0){const index=Number(point.dataset.pathPoint),path=app.project.map.paths.find(item=>item.id===app.editingPath);app.draggingPathPoint={pointerId:event.pointerId,pathId:path.id,index,before:structuredClone(app.project),startX:event.clientX,startY:event.clientY,moved:false,holdTimer:setTimeout(()=>{app.pathPointHoldMenu={pathId:path.id,index};app.draggingPathPoint=null;render();},650)};point.setPointerCapture?.(event.pointerId);event.preventDefault();return;}
  // Video Editor Timeline Clip Dragging (Space Actions) with Multi-Select
  const timelineClip = event.target.closest(".timeline-clip-block");
  if (timelineClip && !event.target.closest(".clip-mini-btn, .clip-trim-handle, button") && event.button === 0) {
    const act = currentSpaceAction();
    const clipId = timelineClip.dataset.clipId;
    const trackId = timelineClip.dataset.trackId;
    app.timelineActiveTrackId = trackId;
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
    document.querySelectorAll(".timeline-clip-block").forEach((el) => {
      el.classList.toggle("clip-selected", app.timelineSelectedClipIds?.has(el.dataset.clipId) || el.dataset.clipId === clipId);
    });

    const found = findClipInTimeline(act, clipId);
    if (found) {
      // Snapshot of all selected clips for group dragging
      const groupItems = [];
      for (const sId of app.timelineSelectedClipIds) {
        const itemFound = findClipInTimeline(act, sId);
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
        element: timelineClip,
        captureTarget: event.target,
        primaryClipId: clipId,
        primaryTrackId: trackId,
        primaryOriginalStart: found.clip.start || 0,
        groupItems,
        startX: event.clientX,
        startY: event.clientY,
        grabOffsetX: event.clientX - timelineClip.getBoundingClientRect().left,
        previewDeltaSec: 0,
        virtualWidth: document.querySelector("#timeline-canvas-viewport")?.scrollWidth || 0,
        moved: false,
        targetTrackId: trackId
      };

      try { event.target?.setPointerCapture?.(event.pointerId); } catch {}
      try { timelineClip.setPointerCapture?.(event.pointerId); } catch {}
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
  const viewport=event.target.closest("#map-viewport"),board=viewport?.querySelector("#map-board");if(!viewport||!board)return;
  const space=event.target.closest("[data-space]");
  if(space&&app.project.map.tool!=="pan"&&event.button===0){const item=app.project.map.spaces.find(entry=>entry.id===Number(space.dataset.space));if(item){const ids=app.selectedSpaces.has(item.id)?app.selectedSpaces:new Set([item.id]);app.draggingSpace={pointerId:event.pointerId,id:item.id,before:structuredClone(app.project),startX:event.clientX,startY:event.clientY,point:{x:item.x,y:item.y},anchor:boardPoint(document.querySelector("#map-board"),event),items:app.project.map.spaces.filter(entry=>ids.has(entry.id)).map(entry=>({id:entry.id,x:entry.x,y:entry.y})),moved:false};space.setPointerCapture?.(event.pointerId);event.preventDefault();}return;}
  if((!space&&!event.target.closest(".path-hit,.path-control-point"))||app.project.map.tool==="pan"||app.spaceHeld||event.button===1||event.button===2){app.panning={pointerId:event.pointerId,startX:event.clientX,startY:event.clientY,panX:app.mapPan.x,panY:app.mapPan.y,moved:false};app.panMoved=false;viewport.setPointerCapture?.(event.pointerId);viewport.classList.add("grabbing");event.preventDefault();}
});
root.addEventListener("wheel",event=>{if(event.target.closest("#placement-viewport")){event.preventDefault();updateMapCamera({zoom:app.mapZoom*(event.deltaY<0?1.12:.89)});}}, {passive:false});

root.addEventListener("pointermove",(event)=>{
  if (app.spaceActorDrag?.pointerId === event.pointerId) {
    const act = currentAction();
    const targetChar = (act?.characters || []).find((c) => String(c.id) === String(app.spaceActorDrag.charId));
    if (targetChar) {
      app.spaceActorDrag.moved = true;
      const previewScale = app.spacePreviewScale || 1.0;
      const dx = (event.clientX - app.spaceActorDrag.startX) / previewScale;
      const dy = (event.clientY - app.spaceActorDrag.startY) / previewScale;
      targetChar.offsetX = Math.round(Math.max(-180, Math.min(180, app.spaceActorDrag.initialOffsetX + dx)));
      targetChar.offsetY = Math.round(Math.max(-180, Math.min(180, app.spaceActorDrag.initialOffsetY + dy)));
      const sc = Math.max(0.2, Number(targetChar.scale ?? 1.0) * previewScale);
      app.spaceActorDrag.node.style.left = `calc(50% + ${targetChar.offsetX * previewScale}px)`;
      app.spaceActorDrag.node.style.top = `calc(50% + ${targetChar.offsetY * previewScale}px)`;
      app.spaceActorDrag.node.style.transform = `translate(-50%, -50%) scale(${sc})`;
    }
    return;
  }
  if(app.timelineStageDrag?.pointerId===event.pointerId){const drag=app.timelineStageDrag,rect=drag.scene.getBoundingClientRect();if(rect.width&&rect.height){const x=Math.max(-90,Math.min(90,((event.clientX-rect.left)/rect.width*100-50)*2)),y=Math.max(-70,Math.min(70,((event.clientY-rect.top)/rect.height*100-53)*2));drag.clip.stagePosition={x:Math.round(x*10)/10,y:Math.round(y*10)/10};drag.node.style.cssText=timelineStageStyle(drag.clip.stagePosition);drag.moved=true;}return;}
  if(app.actorKeyframeDrag?.pointerId===event.pointerId){const rect=app.actorKeyframeDrag.track.getBoundingClientRect(),seconds=Math.max(0,Math.min(app.actorKeyframeDrag.animation.duration,(event.clientX-rect.left)/rect.width*app.actorKeyframeDrag.animation.duration));moveSelectedKeyframe(seconds);for(const dot of root.querySelectorAll("[data-actor-keyframe]"))dot.classList.toggle("selected",Number(dot.dataset.actorKeyframe)===app.actorKeyframeIndex);const selected=root.querySelector(`[data-actor-keyframe="${app.actorKeyframeIndex}"]`);if(selected)selected.style.left=`${(app.actorPreviewTime/app.actorKeyframeDrag.animation.duration)*100}%`;const time=root.querySelector("[data-keyframe-time]");if(time)time.value=app.actorPreviewTime.toFixed(2);app.actorPreviewRenderer?.seek(app.actorPreviewTime);return;}
  if(app.placementDrag?.pointerId===event.pointerId){const drag=app.placementDrag,placement=app.project.map.effectPlacements.find(item=>item.id===drag.id);if(!placement||!studioBoardRenderer)return;if(Math.hypot(event.clientX-drag.startX,event.clientY-drag.startY)>4){clearTimeout(drag.holdTimer);drag.moved=true;}if(drag.moved){const rect=studioBoardRenderer.app.canvas.getBoundingClientRect(),next=studioBoardRenderer.percentFromScreen(event.clientX-rect.left,event.clientY-rect.top);placement.x=next.x;placement.y=next.y;const marker=root.querySelector(`[data-effect-placement="${drag.id}"]`);if(marker){marker.style.left=`${next.x}%`;marker.style.top=`${next.y}%`;}}return;}
  if(app.catalogDrag?.pointerId===event.pointerId){const drag=app.catalogDrag,viewport=document.querySelector("#map-viewport"),board=document.querySelector("#map-board");drag.avatar.style.left=`${event.clientX}px`;drag.avatar.style.top=`${event.clientY}px`;if(viewport&&board){const rect=viewport.getBoundingClientRect(),inside=event.clientX>=rect.left&&event.clientX<=rect.right&&event.clientY>=rect.top&&event.clientY<=rect.bottom;let shadow=board.querySelector(".space-drop-shadow.catalog-shadow");if(inside){const next=boardPoint(board,event);if(!shadow){shadow=document.createElement("span");shadow.className="space-drop-shadow catalog-shadow";board.append(shadow);}shadow.style.left=`${next.x}%`;shadow.style.top=`${next.y}%`;drag.point=next;}else{shadow?.remove();drag.point=null;}}return;}
  if(app.mapHold?.pointerId===event.pointerId&&Math.hypot(event.clientX-app.mapHold.startX,event.clientY-app.mapHold.startY)>6){clearTimeout(app.mapHold.timer);app.mapHold=null;}
  if(app.mapPathHold?.pointerId===event.pointerId&&Math.hypot(event.clientX-app.mapPathHold.startX,event.clientY-app.mapPathHold.startY)>6){clearTimeout(app.mapPathHold.timer);app.mapPathHold=null;}
  if(app.draggingPathPoint?.pointerId===event.pointerId){const drag=app.draggingPathPoint,board=document.querySelector("#map-board"),path=app.project.map.paths.find(item=>item.id===drag.pathId),point=path?.points?.[drag.index];if(!board||!point)return;if(Math.hypot(event.clientX-drag.startX,event.clientY-drag.startY)>4){clearTimeout(drag.holdTimer);drag.moved=true;}const next=boardPoint(board,event);point.x=next.x;point.y=next.y;const node=document.querySelector(`[data-path-point="${drag.index}"]`);if(node){node.setAttribute("cx",next.x);node.setAttribute("cy",next.y);}studioBoardRenderer?.refreshPaths();return;}
  // Video Editor Timeline Clip Dragging Movement (Group support)
  if (app.timelineDraggingClip?.pointerId === event.pointerId) {
    const drag = app.timelineDraggingClip;
    const act = currentSpaceAction();
    const pxPerSec = app.timelineZoom || 100;
    const viewport = document.querySelector("#timeline-canvas-viewport");
    if (!viewport) return;
    const viewportRect = viewport.getBoundingClientRect();
    const edge = 72;
    if (event.clientX > viewportRect.right - edge) {
      if (viewport.scrollLeft + viewport.clientWidth >= viewport.scrollWidth - 8) {
        drag.virtualWidth = Math.max(drag.virtualWidth || viewport.scrollWidth, viewport.scrollWidth) + 600;
        document.querySelectorAll("#timeline-ruler,.timeline-lanes-stack,.timeline-track-lane").forEach((node) => { node.style.width = `${drag.virtualWidth}px`; });
      }
      viewport.scrollLeft += Math.max(8, (event.clientX - (viewportRect.right - edge)) * .35);
    } else if (event.clientX < viewportRect.left + edge) {
      viewport.scrollLeft -= Math.max(8, ((viewportRect.left + edge) - event.clientX) * .35);
    }
    const primaryStart = Math.max(0, (event.clientX - viewportRect.left + viewport.scrollLeft - drag.grabOffsetX) / pxPerSec);
    const deltaSec = primaryStart - drag.primaryOriginalStart;
    drag.previewDeltaSec = deltaSec;
    const deltaX = event.clientX - drag.startX;
    const deltaY = event.clientY - drag.startY;

    if (Math.abs(deltaX) > 2 || Math.abs(deltaY) > 2) {
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
        const f = findClipInTimeline(act, item.clipId);
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
  if(app.draggingSpace?.pointerId===event.pointerId){const drag=app.draggingSpace,board=document.querySelector("#map-board");if(!board)return;const distance=Math.hypot(event.clientX-drag.startX,event.clientY-drag.startY);if(distance<=6)return;drag.moved=true;drag.point=boardPoint(board,event);const dx=drag.point.x-drag.anchor.x,dy=drag.point.y-drag.anchor.y;for(const original of drag.items){const item=app.project.map.spaces.find(entry=>entry.id===original.id);if(item){item.x=Math.max(0,Math.min(100,original.x+dx));item.y=Math.max(0,Math.min(100,original.y+dy));studioBoardRenderer?.previewSpaceAt(item.id,item);}}let shadow=document.querySelector(".space-drop-shadow");if(!shadow){shadow=document.createElement("span");shadow.className="space-drop-shadow";board.append(shadow);}shadow.style.left=`${drag.point.x}%`;shadow.style.top=`${drag.point.y}%`;return;}
  if(app.panning?.pointerId!==event.pointerId)return;const viewport=document.querySelector("#map-viewport"),board=document.querySelector("#map-board");if(!viewport||!board)return;const dx=event.clientX-app.panning.startX,dy=event.clientY-app.panning.startY,maxX=viewport.clientWidth*Math.max(1,app.mapZoom),maxY=viewport.clientHeight*Math.max(1,app.mapZoom);app.mapPan={x:Math.max(-maxX,Math.min(maxX,app.panning.panX+dx)),y:Math.max(-maxY,Math.min(maxY,app.panning.panY+dy))};if(Math.abs(dx)+Math.abs(dy)>4){app.panning.moved=true;app.panMoved=true;}board.style.transform=`translate(${app.mapPan.x}px,${app.mapPan.y}px) scale(${app.mapZoom}) rotate(${app.mapRotation||0}rad)`;studioBoardRenderer?.setCamera({x:app.mapPan.x,y:app.mapPan.y,zoom:app.mapZoom,rotation:app.mapRotation||0},true);
});

root.addEventListener("pointerup",(event)=>{
  if (app.spaceActorDrag?.pointerId === event.pointerId) {
    const drag = app.spaceActorDrag;
    app.spaceActorDrag = null;
    try { drag.node?.releasePointerCapture?.(event.pointerId); } catch {}
    if (drag.moved) {
      const act = currentAction();
      if (act) {
        syncSpaceActionToMapSpaces(act.id, act);
      }
      save("event");
      save("map");
      render();
      toast("ACTOR PLACEMENT SAVED");
    }
    return;
  }
  if(app.timelineStageDrag?.pointerId===event.pointerId){const drag=app.timelineStageDrag;app.timelineStageDrag=null;drag.node.releasePointerCapture?.(event.pointerId);if(drag.moved){save("event");render();toast("STAGE POSITION SAVED");}return;}
  if(app.actorKeyframeDrag?.pointerId===event.pointerId){app.actorKeyframeDrag=null;save("event");render();return;}
  if(app.placementDrag?.pointerId===event.pointerId){const drag=app.placementDrag;clearTimeout(drag.holdTimer);app.placementDrag=null;if(drag.moved){app.history.push(drag.before);app.history=app.history.slice(-30);app.future=[];save("map");render();toast("PLACEMENT MOVED");}return;}
  if(app.catalogDrag?.pointerId===event.pointerId){const drag=app.catalogDrag;app.catalogDrag=null;drag.avatar.remove();document.querySelector(".catalog-shadow")?.remove();if(drag.point){const action=app.project.events.entries.find(item=>item.id===drag.actionId);if(action){remember();const map=app.project.map,id=Math.max(-1,...map.spaces.map(space=>space.id))+1,space=mapSpaceAction({id,...drag.point,depth:2},action,map.spaces.length);map.spaces.push(space);app.selectedSpace=id;app.justPlacedSpace=id;save("map");render();toast(`PLACED ${action.name}`);sound(620,.1);}}return;}
  if(app.mapHold?.pointerId===event.pointerId){clearTimeout(app.mapHold.timer);app.mapHold=null;}
  if(app.mapPathHold?.pointerId===event.pointerId){clearTimeout(app.mapPathHold.timer);app.mapPathHold=null;}
  if(app.draggingPathPoint?.pointerId===event.pointerId){const drag=app.draggingPathPoint;clearTimeout(drag.holdTimer);app.draggingPathPoint=null;if(drag.moved){app.history.push(drag.before);app.history=app.history.slice(-30);app.future=[];save("map");render();toast("PATH SHAPE SAVED");}return;}
  // Video Editor Timeline Clip Drop (Group & Movement)
  if (app.timelineDraggingClip?.pointerId === event.pointerId) {
    const drag = app.timelineDraggingClip;
    app.timelineDraggingClip = null;
    try { drag.captureTarget?.releasePointerCapture?.(event.pointerId); } catch {}
    try { drag.element?.releasePointerCapture?.(event.pointerId); } catch {}
    try { event.target?.releasePointerCapture?.(event.pointerId); } catch {}
    document.querySelectorAll(".timeline-track-lane.drag-target-hover").forEach((el) => el.classList.remove("drag-target-hover"));
    document.querySelectorAll(".timeline-clip-block.is-dragging, .timeline-clip-block.is-group-dragging").forEach((el) => {
      el.classList.remove("is-dragging", "is-group-dragging");
    });

    if (drag.moved) {
      app.ignoreTimelineClick = true;
      setTimeout(() => { app.ignoreTimelineClick = false; }, 80);

      const act = currentSpaceAction();
      const deltaSec = Number(drag.previewDeltaSec || 0);

      // Track index offset for primary clip
      const primaryTrackIdx = act.timeline.tracks.findIndex((t) => t.id === drag.primaryTrackId);
      const targetTrackIdx = act.timeline.tracks.findIndex((t) => t.id === drag.targetTrackId);
      const trackOffset = (targetTrackIdx >= 0 && primaryTrackIdx >= 0) ? (targetTrackIdx - primaryTrackIdx) : 0;

      const affectedTracks = new Set();
      const movedLogicClips = [];

      // Move each clip in the selected group
      drag.groupItems.forEach((item) => {
        const found = findClipInTimeline(act, item.clipId);
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

          // The pointer's snapped time is authoritative.
          destTrack.clips.push(found.clip);
          found.clip.start = newStart;
          destTrack.clips.sort((a,b) => Number(a.start || 0) - Number(b.start || 0));
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

      // Lock selection onto the moved clips and update active track
      app.timelineSelectedClipId = drag.primaryClipId;
      app.timelineSelectedClipIds = new Set(drag.groupItems.map((g) => g.clipId));
      if (drag.targetTrackId) app.timelineActiveTrackId = drag.targetTrackId;

      syncTimelineToCommands(act);
      save("event"); render(); playSfx("star"); toast("CLIPS MOVED ON TIMELINE! ★");
    } else {
      render();
    }
    return;
  }

  if(app.draggingClip?.pointerId===event.pointerId){const drag=app.draggingClip;app.draggingClip=null;if(drag.moved){app.history.push(drag.before);app.history=app.history.slice(-30);app.future=[];app.ignoreClipClick=true;save("scene");sound(540,.08);render();setTimeout(()=>{app.ignoreClipClick=false;},0);}return;}
  if(app.draggingSpace?.pointerId===event.pointerId){const drag=app.draggingSpace;app.draggingSpace=null;document.querySelector(".space-drop-shadow")?.remove();if(drag.moved){app.history.push(drag.before);app.history=app.history.slice(-30);app.future=[];app.selectedSpace=drag.id;save("map");sound(180,.1);render();}return;}
  if(app.panning?.pointerId!==event.pointerId)return;const moved=app.panning.moved;app.panning=null;document.querySelector("#map-viewport")?.classList.remove("grabbing");if(moved)setTimeout(()=>{app.panMoved=false;},0);
});
root.addEventListener("pointercancel", (event) => {
  if (app.timelineDraggingClip?.pointerId === event.pointerId) {
    const drag = app.timelineDraggingClip;
    app.timelineDraggingClip = null;
    try { drag.captureTarget?.releasePointerCapture?.(event.pointerId); } catch {}
    try { drag.element?.releasePointerCapture?.(event.pointerId); } catch {}
    try { event.target?.releasePointerCapture?.(event.pointerId); } catch {}
    document.querySelectorAll(".timeline-track-lane.drag-target-hover").forEach((el) => el.classList.remove("drag-target-hover"));
    document.querySelectorAll(".timeline-clip-block.is-dragging, .timeline-clip-block.is-group-dragging").forEach((el) => {
      el.classList.remove("is-dragging", "is-group-dragging");
    });
    render();
  }
  if (app.draggingClip?.pointerId === event.pointerId) app.draggingClip = null;
  if (app.draggingSpace?.pointerId === event.pointerId) app.draggingSpace = null;
  if (app.panning?.pointerId === event.pointerId) app.panning = null;
  if (app.placementDrag?.pointerId === event.pointerId) app.placementDrag = null;
  if (app.catalogDrag?.pointerId === event.pointerId) { app.catalogDrag = null; document.querySelector(".catalog-shadow")?.remove(); }
});
root.addEventListener("wheel",(event)=>{if(!event.target.closest("#map-viewport"))return;event.preventDefault();const previous=app.mapZoom,next=Math.max(.8,Math.min(8,previous+(event.deltaY<0?.18:-.18)));if(!studioBoardRenderer||next===previous)return;studioBoardRenderer.zoomAt(event.clientX,event.clientY,next/previous);app.mapZoom=studioBoardRenderer.camera.targetZoom;app.mapPan={x:studioBoardRenderer.camera.targetX,y:studioBoardRenderer.camera.targetY};const readout=root.querySelector(".map-floating-toolbar > b");if(readout)readout.textContent=`${Math.round(app.mapZoom*100)}%`;},{passive:false});
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
  if(event.key==="Escape"&&app.valuePickerEditor){event.preventDefault();app.valuePickerEditor=null;render();return;}
  if(event.key==="Escape"&&app.playerSelectorEditor){event.preventDefault();app.playerSelectorEditor=null;render();return;}
  if(event.key==="Escape"&&app.editingToy){event.preventDefault();app.editingToy=null;render();return;}
  if(event.key==="Escape"&&app.actorEditorId){event.preventDefault();app.actorEditorId=null;render();return;}
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
