import { PartyAudio } from "./audio.js";
import { bitsToMask, firstConnectedGamepad, gamepadInputMask, nesBits } from "./input.js";
import { BrowserEmulatorSession, browserBytes } from "./emulator/session.js";
import { TasMovie, TasPlaybackEngine } from "./emulator/tas-player.js";
import { mountBoardRenderer } from "./board-renderer.js";

const $ = (selector, root = document) => root.querySelector(selector);
const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
const audio = new PartyAudio();
let mainBoardRenderer=null,mainBoardId=null,mainBoardMount=0;
async function renderPixiMainBoard(board){const host=$("#board-stage");if(!host)return;const actors=(app.session?.players||[]).map((player,index)=>{const avatar=getCharacter(player.characterId,index);return{id:player.id,name:player.name,color:avatar.color,position:player.position,icon:String(index+1),spriteSheet:"/assets/rainshadow-roster.png",spriteX:avatar.x,spriteY:avatar.y};});actors.push({id:"star-vendor",name:"Star Shop",color:"#ffd55a",position:app.session.starPosition,icon:"★"});if(!mainBoardRenderer||mainBoardId!==board.id){const generation=++mainBoardMount,renderer=await mountBoardRenderer(host,board,{interactive:true,starPosition:app.session.starPosition});if(generation!==mainBoardMount){renderer?.destroy();return;}mainBoardRenderer=renderer;mainBoardId=board.id;host.classList.add("pixi-active");}mainBoardRenderer.options.starPosition=app.session.starPosition;mainBoardRenderer.setActors(actors);if(!host.querySelector(".main-board-camera"))host.insertAdjacentHTML("beforeend",`<nav class="main-board-camera" aria-label="Board camera"><button data-main-camera="left">←</button><button data-main-camera="up">↑</button><button data-main-camera="right">→</button><button data-main-camera="out">−</button><button data-main-camera="in">＋</button><button data-main-camera="rotate-left">↶</button><button data-main-camera="rotate-right">↷</button><button data-main-camera="reset">⌂</button></nav>`);}
document.addEventListener("click",event=>{const control=event.target.closest("[data-main-camera]")?.dataset.mainCamera,renderer=mainBoardRenderer;if(!control||!renderer)return;if(control==="left")renderer.panBy(80,0);else if(control==="right")renderer.panBy(-80,0);else if(control==="up")renderer.panBy(0,65);else if(control==="out")renderer.zoomBy(.84);else if(control==="in")renderer.zoomBy(1.2);else if(control==="rotate-left")renderer.rotateBy(-Math.PI/24);else if(control==="rotate-right")renderer.rotateBy(Math.PI/24);else renderer.setCamera({x:0,y:0,zoom:1,rotation:0});});
const emulator = new BrowserEmulatorSession();
const tasPlayback = new TasPlaybackEngine(emulator);

const app = {
  route: "home",
  previous: [],
  catalog: { challenges: [], packs: [], rulesets: [], boards: [], games: [], activeGameId: null },
  gameStates: [],
  momentMakerStage: "game",
  momentSelectedGame: null,
  momentSelectedTas: null,
  momentTasMovies: [],
  momentLiveControl: false,
  playerCount: 4,
  session: null,
  challenge: null,
  challengeContext: null,
  creator: null,
  inputMode: false,
  inputMask: 0,
  pressed: new Set(),
  fetchingFrame: false,
  coreAudio: null,
  coreAudioCursor: 0,
  lastToast: "",
  gamepadButtons: [],
  gamepadAxes: { x: 0, y: 0 },
  challengeStartedAt: 0,
  gameOutcome: null,
  rawGame: null,
  controls: { keyboard: { b: "z", a: "x", select: "shift", start: "enter", up: "arrowup", down: "arrowdown", left: "arrowleft", right: "arrowright", saveState: "p", rewind: "backspace", creator: "c", success: "q", failure: "r", exit: "escape" }, gamepad: { b: 1, a: 0, select: 8, start: 9, up: 12, down: 13, left: 14, right: 15, saveState: 3, rewind: 2, creator: 10, success: 4, failure: 5, exit: 11 } },
  captureBinding: null,
  deleteArmed: false,
  unloadPromise: Promise.resolve(),
  setupStep: 1,
  selectedBoardId: null,
  selectedPackId: null,
  selectedRulesetId: null,
  playerNames: ["Player 1", "Player 2", "Player 3", "Player 4"],
  selectedCharacterIds: ["nova", "marina", "nimbus", "sprig"],
  draftingPlayerIndex: 0,
  collectionEditor: null,
  contextTarget: null,
  contextDeleteArmed: false,
  persistedMomentSessions: {},
  savingMinigame: null,
};

async function api(path, options = {}) {
  const config = { ...options, headers: { ...(options.headers || {}) } };
  if (config.body && typeof config.body !== "string") {
    config.headers["Content-Type"] = "application/json";
    config.body = JSON.stringify(config.body);
  }
  const response = await fetch(path, config);
  const data = await response.json();
  if (!response.ok || data.error) throw new Error(data.error || `Request failed (${response.status})`);
  return data;
}

let toastTimer;
function notify(message) {
  if (!message) return;
  app.lastToast = message;
  $("#toast p").textContent = message;
  $("#toast").classList.add("show");
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => $("#toast").classList.remove("show"), 3200);
}

function visibleNav() {
  if (!$("#action-popover")?.classList.contains("hidden")) return $$("#action-popover [data-nav]").filter((item) => !item.disabled);
  return $$(`[data-view="${app.route}"] [data-nav], #action-popover [data-nav]`).filter((item) => !item.disabled && item.offsetParent !== null);
}

function updatePointerPosition() {
  const target = $(".nav-focus");
  const pointer = $("#pointer");
  if (!target || !pointer || app.inputMode || target.offsetParent === null || app.route === "title") {
    pointer?.classList.remove("show");
    return;
  }
  const rect = target.getBoundingClientRect();
  if (rect.width === 0 && rect.height === 0) {
    pointer.classList.remove("show");
    return;
  }
  pointer.style.left = `${Math.max(5, rect.left - 29)}px`;
  pointer.style.top = `${rect.top + rect.height / 2 - 16}px`;
  pointer.classList.add("show");
}

function focusNav(target, playSound = false) {
  if (!target) return;
  $$(".nav-focus").forEach((item) => item.classList.remove("nav-focus"));
  target.classList.add("nav-focus");
  updatePointerPosition();

  // Smoothly track pointer position across CSS transitions & expansions
  let frames = 0;
  const follow = () => {
    updatePointerPosition();
    frames++;
    if (frames < 24) requestAnimationFrame(follow);
  };
  requestAnimationFrame(follow);

  target.scrollIntoView({ block: "nearest", inline: "nearest", behavior: "smooth" });
  if (playSound) audio.sfx("move");
}

function moveFocus(direction) {
  const items = visibleNav();
  const current = $(".nav-focus");
  if (!current || !items.includes(current)) return focusNav(items[0], true);
  const origin = current.getBoundingClientRect();
  const ox = origin.left + origin.width / 2;
  const oy = origin.top + origin.height / 2;
  let best = null;
  let bestScore = Infinity;
  for (const item of items) {
    if (item === current) continue;
    const rect = item.getBoundingClientRect();
    const dx = rect.left + rect.width / 2 - ox;
    const dy = rect.top + rect.height / 2 - oy;
    const forward = direction === "left" ? -dx : direction === "right" ? dx : direction === "up" ? -dy : dy;
    if (forward <= 3) continue;
    const side = direction === "left" || direction === "right" ? Math.abs(dy) : Math.abs(dx);
    const score = forward + side * 2.6;
    if (score < bestScore) { best = item; bestScore = score; }
  }
  focusNav(best || current, true);
}

function navigate(route, push = true) {
  if (!$(`[data-view="${route}"]`)) route = "home";
  if (app.collectionEditor && route !== app.collectionEditor.type) {
    const editorType = app.collectionEditor.type;
    $(`[data-view="${editorType}"]`)?.classList.remove("editing-collection");
    $(`#${editorType === "packs" ? "pack" : "rules"}-form`)?.classList.add("hidden");
    $(`#${editorType === "packs" ? "pack" : "rules"}-browser`)?.classList.remove("hidden");
    app.collectionEditor = null;
  }
  if (push && route !== app.route) app.previous.push(app.route);
  app.route = route;
  setInputMode(route === "play");
  if (!new Set(["play", "multi-creator", "moment-maker", "title"]).has(route)) {
    tasPlayback.pause();
    emulator.unload();
    app.unloadPromise = Promise.resolve();
    app.catalog.activeGameId = null;
  }
  document.body.dataset.route = route;
  $$(".view").forEach((view) => view.classList.toggle("active", view.dataset.view === route));
  audio.setTheme(route);
  if (route === "title") initTitleSequence();
  if (route === "minigames") renderGames();
  if (route === "games") renderLibrary();
  if (route === "settings") renderSettings();
  if (route === "packs") renderPacks();
  if (route === "rules") renderRules();
  if (route === "multi-creator") {
    if (!app.multiCreatorStage || (!app.multiCreatorSelectedGame && !app.catalog.activeGameId)) {
      app.multiCreatorStage = "game";
    }
    renderMultiCreatorStages();
  }
  if (route === "moment-maker") {
    if (!app.momentMakerStage || (!app.momentSelectedGame && !app.catalog.activeGameId)) {
      app.momentMakerStage = "game";
    }
    renderMomentMakerStages();
  }
  if (route === "board-setup") renderSetup();
  if (route === "board") renderBoard();
  closeContextMenu(false);
  requestAnimationFrame(() => focusNav(visibleNav().find((item) => !item.classList.contains("edge-nav")) || visibleNav()[0]));
}

function logicalBackRoute() {
  if (app.route === "play") return app.challengeContext?.sessionId ? "board" : app.rawGame ? "games" : "minigames";
  if (app.route === "multi-creator") return "moment-maker";
  if (app.route === "moment-maker" || app.route === "packs" || app.route === "rules") return "home";
  if (app.route === "board") return "board-setup";
  if (app.route === "title") return "title";
  return "home";
}

function initTitleSequence() {
  app.titleState = "intro";
  const splash = $("#title-intro-splash");
  const stage = $("#title-screen-stage");
  const fade = $("#title-fade-overlay");
  const startBtn = $("#title-press-start .press-start-btn");

  if (splash) splash.classList.remove("hidden");
  if (stage) stage.classList.add("hidden");
  if (fade) fade.classList.remove("blackout");
  if (startBtn) startBtn.classList.remove("pressed");

  if (app.titleIntroTimer) clearTimeout(app.titleIntroTimer);
  app.titleIntroTimer = setTimeout(() => {
    showTitleScreen();
  }, 3200);
}

function showTitleScreen() {
  if (app.titleIntroTimer) {
    clearTimeout(app.titleIntroTimer);
    app.titleIntroTimer = null;
  }
  const splash = $("#title-intro-splash");
  const stage = $("#title-screen-stage");
  if (splash) splash.classList.add("hidden");
  if (stage) stage.classList.remove("hidden");
  app.titleState = "title";
  audio.setTheme("title");
  audio.start();
  requestAnimationFrame(() => focusNav($(".press-start-btn")));
}

async function titleStart() {
  const startBtn = $("#title-press-start .press-start-btn");
  const fade = $("#title-fade-overlay");
  if (startBtn) startBtn.classList.add("pressed");
  audio.sfx("confirm");
  app.titleState = "transitioning";

  if (fade) fade.classList.add("blackout");

  setTimeout(() => {
    navigate("home");
    if (fade) fade.classList.remove("blackout");
    app.titleState = "ready";
  }, 480);
}

function goBack() {
  if (!$("#action-popover").classList.contains("hidden")) return closeContextMenu();
  if (app.collectionEditor && app.collectionEditor.type === app.route) return closeCollectionEditor();
  audio.sfx("back");
  setInputMode(false);
  if (app.route === "board-setup" && app.setupStep > 1) {
    return setWizardStep(app.setupStep - 1);
  }
  if (app.route === "moment-maker") {
    if (app.momentMakerStage === "studio") {
      tasPlayback.pause();
      app.momentLiveControl = false;
      app.momentMakerStage = "minigames";
      renderMomentMakerStages();
      return;
    }
    if (app.momentMakerStage === "minigames") {
      app.momentMakerStage = "game";
      renderMomentMakerStages();
      return;
    }
  }
  if (app.route === "multi-creator") {
    if (app.momentSelectedGame) {
      app.momentMakerStage = "minigames";
      navigate("moment-maker", false);
      renderMomentMakerStages();
      return;
    }
  }
  const route = logicalBackRoute();
  if (app.route === "play") {
    app.rawGame = null;
    app.challenge = null;
    app.gameOutcome = null;
  }
  app.previous = [];
  navigate(route, false);
}

function setInputMode(active) {
  app.inputMode = Boolean(active);
  document.body.classList.toggle("game-input-active", app.inputMode);
  if (app.inputMode) {
    $("#pointer").classList.remove("show");
    const canvas = app.route === "moment-maker" ? $("#moment-screen") : app.route === "multi-creator" ? $("#multi-creator-screen") : $("#screen");
    canvas.setAttribute("tabindex", "-1");
    canvas.focus({ preventScroll: true });
  }
}

const CHARACTERS = [
  { id: "nova", name: "Nova", role: "Comet Pilot", color: "#f04d5e", x: 0, y: 0 },
  { id: "marina", name: "Marina", role: "Gadget Diver", color: "#28b9d6", x: 50, y: 0 },
  { id: "nimbus", name: "Nimbus", role: "Cloud Scout", color: "#f2b92f", x: 100, y: 0 },
  { id: "sprig", name: "Sprig", role: "Forest Tinkerer", color: "#4ebc79", x: 0, y: 100 },
  { id: "luna", name: "Luna", role: "Moon Magician", color: "#8d63dc", x: 50, y: 100 },
  { id: "dash", name: "Dash", role: "Desert Racer", color: "#ef8b32", x: 100, y: 100 },
];
function getCharacter(id, fallbackIndex = 0) {
  return CHARACTERS.find((character) => character.id === id) || CHARACTERS[fallbackIndex % CHARACTERS.length];
}

function characterArt(character, className = "") {
  return `<span class="character-art ${className}" style="--character-color:${character.color};--character-x:${character.x}%;--character-y:${character.y}%" role="img" aria-label="${character.name}, ${character.role}"></span>`;
}

function html(value) {
  return String(value ?? "").replace(/[&<>"']/g, (character) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[character]);
}

function focusWizardNext() {
  requestAnimationFrame(() => {
    const next = $(".wizard-step.active [data-wizard-next]");
    if (next) focusNav(next, true);
  });
}

function setWizardStep(stepNumber) {
  const step = Math.max(1, Math.min(6, Number(stepNumber) || 1));
  app.setupStep = step;

  // Sync player names before leaving step 1
  if ($("#player-names-roster")) {
    const inputs = $$("#player-names-roster input");
    if (inputs.length) {
      app.playerNames = inputs.map((input, idx) => input.value.trim() || `Player ${idx + 1}`);
    }
  }

  // Update progress pills
  $$("#setup-progress .progress-pill").forEach((pill) => {
    const pillStep = Number(pill.dataset.step);
    pill.classList.toggle("active", pillStep === step);
    pill.classList.toggle("completed", pillStep < step);
  });

  // Show active step
  $$(".wizard-step").forEach((stepEl) => {
    stepEl.classList.toggle("active", Number(stepEl.dataset.step) === step);
  });

  // Update step title in header
  const stepTitles = [
    "Party Questionnaire · Step 1 of 5",
    "Party Questionnaire · Step 2 of 5",
    "Party Questionnaire · Step 3 of 5",
    "Party Questionnaire · Step 4 of 5",
    "Party Questionnaire · Step 5 of 5",
    "Party Questionnaire · Confirmation",
  ];
  if ($("#setup-view-title")) {
    $("#setup-view-title").textContent = stepTitles[step - 1] || "Party Questionnaire";
  }

  // Update summary when step 5 is entered
  if (step === 2) renderCharacterDraft();
  if (step === 6) {
    renderSetupSummary();
  }

  requestAnimationFrame(() => {
    const focusable = visibleNav().find((item) => !item.closest(".party-bar") && !item.closest(".setup-progress"));
    if (focusable) focusNav(focusable);
  });
}

function renderSetup() {
  const { boards, packs, rulesets } = app.catalog;
  if (!app.selectedBoardId && boards?.length) app.selectedBoardId = boards[0].id;
  if (!app.selectedPackId && packs?.length) app.selectedPackId = packs[0].id;
  if (!app.selectedRulesetId && rulesets?.length) app.selectedRulesetId = rulesets[0].id;

  renderPlayerRoster();
  renderCharacterDraft();
  renderBoardCards();
  renderPackCards();
  renderRulesetCards();
  renderSetupSummary();
  setWizardStep(app.setupStep || 1);
}

function renderPlayerRoster() {
  $$("[data-player-count]").forEach((button) => {
    button.classList.toggle("selected", Number(button.dataset.playerCount) === app.playerCount);
  });

  const rosterEl = $("#player-names-roster");
  if (!rosterEl) return;

  const currentInputs = $$("#player-names-roster input");
  if (currentInputs.length) {
    currentInputs.forEach((input, idx) => {
      if (input.value.trim()) app.playerNames[idx] = input.value.trim();
    });
  }

  rosterEl.innerHTML = Array.from({ length: app.playerCount }, (_, index) => {
    const character = getCharacter(app.selectedCharacterIds[index], index);
    const pColor = character.color;
    const defaultName = app.playerNames[index] || `Player ${index + 1}`;
    return `
      <div class="player-roster-card" style="--p-color: ${pColor};">
        <div class="player-pin-preview">
          ${characterArt(character, "roster-character")}
        </div>
        <div class="player-info-input">
          <label>PLAYER ${index + 1}</label>
          <input data-nav aria-label="Player ${index + 1} name" data-player-index="${index}" value="${defaultName}" placeholder="Player ${index + 1}" maxlength="24">
        </div>
      </div>
    `;
  }).join("");
}

function renderCharacterDraft() {
  const status = $("#character-draft-status");
  const grid = $("#character-grid");
  if (!status || !grid) return;
  app.draftingPlayerIndex = Math.min(app.draftingPlayerIndex, app.playerCount - 1);
  const selected = app.selectedCharacterIds.slice(0, app.playerCount);
  status.innerHTML = Array.from({ length: app.playerCount }, (_, index) => {
    const character = getCharacter(selected[index], index);
    const active = index === app.draftingPlayerIndex;
    return `<button type="button" class="draft-player ${active ? "active" : ""}" style="--character-color:${character.color}" data-nav data-draft-player="${index}">
      ${characterArt(character, "draft-player-art")}
      <span><small>PLAYER ${index + 1}</small><b>${app.playerNames[index] || `Player ${index + 1}`}</b><em>${character.name}</em></span>
    </button>`;
  }).join("");
  grid.innerHTML = CHARACTERS.map((character) => {
    const owner = selected.indexOf(character.id);
    const chosenHere = selected[app.draftingPlayerIndex] === character.id;
    const unavailable = owner >= 0 && owner !== app.draftingPlayerIndex;
    return `<button type="button" class="character-card ${chosenHere ? "selected" : ""} ${unavailable ? "unavailable" : ""}" data-nav data-select-character="${character.id}" ${unavailable ? "disabled" : ""} style="--character-color:${character.color}">
      ${characterArt(character, "character-card-art")}
      <span class="character-card-copy"><small>${character.role}</small><b>${character.name}</b><em>${chosenHere ? `PLAYER ${app.draftingPlayerIndex + 1}` : unavailable ? `PLAYER ${owner + 1}` : "AVAILABLE"}</em></span>
    </button>`;
  }).join("");
}

function renderBoardCards() {
  const container = $("#setup-board-cards");
  if (!container) return;
  const boards = app.catalog.boards || [];
  container.innerHTML = boards.map((board) => {
    const isSelected = board.id === app.selectedBoardId;
    return `
      <button type="button" class="option-choice-card board-option-card ${isSelected ? "selected" : ""}" data-nav data-select-board="${board.id}">
        <div class="card-art-preview pixi-board-host" data-main-board-preview="${board.id}">
          <span class="card-tag difficulty">${board.difficulty || "Standard"}</span>
          <span class="card-tag spaces-count">${(board.spaces || []).length} SPACES</span>
        </div>
        <div class="card-content">
          <div class="card-title-row">
            <h4>${board.name}</h4>
            <span class="check-pill">${isSelected ? "✓ SELECTED" : "SELECT"}</span>
          </div>
          <p>${board.description}</p>
        </div>
      </button>
    `;
  }).join("");
  mountMainBoardPreviews(container);
}

function mountMainBoardPreviews(scope = document) {
  for (const host of scope.querySelectorAll("[data-main-board-preview]")) {
    const board = app.catalog.boards.find((item) => item.id === host.dataset.mainBoardPreview);
    if (board) mountBoardRenderer(host, board, { interactive: false }).catch(() => {});
  }
}

function renderPackCards() {
  const container = $("#setup-pack-cards");
  if (!container) return;
  const packs = app.catalog.packs || [];
  container.innerHTML = packs.map((pack) => {
    const isSelected = pack.id === app.selectedPackId;
    const gameCount = pack.challengeIds?.includes("*") ? "ALL MINI-GAMES" : `${pack.challengeIds?.length || 0} GAMES`;
    return `
      <button type="button" class="option-choice-card pack-card ${isSelected ? "selected" : ""}" data-nav data-select-pack="${pack.id}">
        <div class="pack-card-header">
          <span class="pack-icon">${pack.smart ? "✦" : "🎲"}</span>
          <div class="pack-info">
            <span class="card-tag category-tag">${gameCount}</span>
            <h4>${pack.name}</h4>
          </div>
          <span class="check-pill">${isSelected ? "✓ SELECTED" : "SELECT"}</span>
        </div>
        <div class="card-content">
          <p>${pack.description}</p>
          <div class="tag-row">
            ${(pack.categories || []).map((cat) => `<span class="tag">${cat}</span>`).join("")}
          </div>
        </div>
      </button>
    `;
  }).join("");
}

function renderRulesetCards() {
  const container = $("#setup-ruleset-cards");
  if (!container) return;
  const rulesets = app.catalog.rulesets || [];
  container.innerHTML = rulesets.map((rules) => {
    const isSelected = rules.id === app.selectedRulesetId;
    return `
      <button type="button" class="option-choice-card ruleset-card ${isSelected ? "selected" : ""}" data-nav data-select-ruleset="${rules.id}">
        <div class="ruleset-card-header">
          <span class="ruleset-icon">⚑</span>
          <div class="ruleset-info">
            <h4>${rules.name}</h4>
            <small>${rules.rounds} ROUNDS · ${rules.startingCoins} STARTING COINS</small>
          </div>
          <span class="check-pill">${isSelected ? "✓ SELECTED" : "SELECT"}</span>
        </div>
        <div class="card-content">
          <p>${rules.description || `Play for ${rules.rounds} rounds with mini games every ${rules.minigameEvery} round.`}</p>
          <div class="rules-stat-badges">
            <span class="stat-badge round-badge">🎯 ${rules.rounds} Rounds</span>
            <span class="stat-badge coin-badge">💰 ${rules.startingCoins} Coins</span>
            <span class="stat-badge mg-badge">⚡ Every ${rules.minigameEvery} Round</span>
            <span class="stat-badge payout-badge">● +${rules.blueCoins} / ${rules.redCoins} / +${rules.luckyCoins}</span>
          </div>
        </div>
      </button>
    `;
  }).join("");
}

function renderSetupSummary() {
  const container = $("#setup-summary-grid");
  if (!container) return;

  const board = app.catalog.boards.find((b) => b.id === app.selectedBoardId) || app.catalog.boards[0];
  const pack = app.catalog.packs.find((p) => p.id === app.selectedPackId) || app.catalog.packs[0];
  const rules = app.catalog.rulesets.find((r) => r.id === app.selectedRulesetId) || app.catalog.rulesets[0];
  const playerInputs = $$("#player-names-roster input");
  const names = playerInputs.length
    ? playerInputs.map((input, idx) => input.value.trim() || `Player ${idx + 1}`)
    : app.playerNames.slice(0, app.playerCount);

  container.innerHTML = `
    <!-- Players Summary Card -->
    <div class="summary-card players-summary">
      <div class="summary-card-header">
        <span class="summary-icon">👥</span>
        <div>
          <small>ROSTER</small>
          <h4>${app.playerCount} Players</h4>
        </div>
        <button type="button" class="summary-edit-btn" data-nav data-wizard-jump="1">Edit</button>
      </div>
      <div class="summary-players-list">
        ${names.map((name, i) => {
          const character = getCharacter(app.selectedCharacterIds[i], i);
          return `
            <div class="summary-player-item">
              ${characterArt(character, "summary-character")}
              <span>${name}<small>${character.name}</small></span>
            </div>
          `;
        }).join("")}
      </div>
    </div>

    <!-- Board Summary Card -->
    <div class="summary-card board-summary">
      <div class="summary-card-header">
        <span class="summary-icon">🗺️</span>
        <div>
          <small>BOARD</small>
          <h4>${board?.name || "Starlight Circuit"}</h4>
        </div>
        <button type="button" class="summary-edit-btn" data-nav data-wizard-jump="3">Edit</button>
      </div>
      <div class="summary-board-preview pixi-board-host" data-main-board-preview="${board?.id || ""}">
        <span class="board-preview-pill">${(board?.spaces || []).length} Spaces · ${board?.difficulty || "Friendly"}</span>
      </div>
    </div>

    <!-- Pack Summary Card -->
    <div class="summary-card pack-summary">
      <div class="summary-card-header">
        <span class="summary-icon">🎁</span>
        <div>
          <small>MINI-GAME PACK</small>
          <h4>${pack?.name || "Party Mix"}</h4>
        </div>
        <button type="button" class="summary-edit-btn" data-nav data-wizard-jump="4">Edit</button>
      </div>
      <p class="summary-copy">${pack?.description || "All mini-games included"}</p>
      <div class="tag-row">
        <span class="tag">${pack?.challengeIds?.includes("*") ? "All Server Challenges" : `${pack?.challengeIds?.length || 0} Challenges`}</span>
      </div>
    </div>

    <!-- Rules Summary Card -->
    <div class="summary-card rules-summary">
      <div class="summary-card-header">
        <span class="summary-icon">📜</span>
        <div>
          <small>HOUSE RULES</small>
          <h4>${rules?.name || "Classic Party"}</h4>
        </div>
        <button type="button" class="summary-edit-btn" data-nav data-wizard-jump="5">Edit</button>
      </div>
      <div class="summary-rules-stats">
        <div><b>${rules?.rounds || 5}</b><small>Rounds</small></div>
        <div><b>${rules?.startingCoins || 10}</b><small>Coins</small></div>
        <div><b>Every ${rules?.minigameEvery || 1}</b><small>Mini-Game</small></div>
      </div>
    </div>
  `;
  mountMainBoardPreviews(container);
}

function filteredGames() {
  const category = $("#filter-category")?.value || "All";
  const players = $("#filter-players")?.value || "all";
  const game = $("#filter-game")?.value || "all";
  return app.catalog.challenges.filter((item) =>
    (category === "All" || item.category === category) &&
    (players === "all" || item.playerCount === Number(players)) &&
    (game === "all" || item.gameId === game));
}

function gameCard(game) {
  const art = game.boxArt ? `<img src="${game.boxArt}" alt="${game.gameName} box art">` : (game.category === "Speed" ? "⚡" : game.category === "Puzzle" ? "◆" : "★");
  return `<article class="game-card" data-context-type="game" data-context-id="${game.id}"><div class="game-card-art ${game.boxArt ? "has-art" : ""}">${art}</div><div class="game-card-copy"><small>${game.gameName} · ${game.category}</small><h3>${game.title}</h3><p>${game.instructions}</p><div class="tag-row"><span class="tag">${game.playerCount} PLAYER${game.playerCount === 1 ? "" : "S"}</span><span class="tag">${game.difficulty}</span><span class="tag">${game.mode}</span></div><div class="game-card-actions"><button data-nav data-play-game="${game.id}">PLAY</button><span>SELECT · OPTIONS</span></div></div></article>`;
}

function renderGames() {
  const games = filteredGames();
  $("#game-count").textContent = `${games.length} GAME${games.length === 1 ? "" : "S"}`;
  $("#game-grid").innerHTML = games.length ? games.map(gameCard).join("") : '<div class="empty-card"><h2>No games match that mix.</h2><p>Try another category or create a new mini game.</p></div>';
}

function renderPacks() {
  $("#pack-count").textContent = `${app.catalog.packs.length} PACK${app.catalog.packs.length === 1 ? "" : "S"}`;
  $("#pack-list").innerHTML = app.catalog.packs.map((pack) => `<button type="button" class="collection-card ${pack.smart ? "smart-pack" : ""}" data-nav data-collection-item data-context-type="pack" data-context-id="${pack.id}"><span class="collection-icon">${pack.smart ? "✦" : "▦"}</span><span><small>${pack.smart ? "AUTO PLAYLIST" : "PARTY PACK"}</small><h3>${pack.name}</h3><p>${pack.description}</p><em>${pack.challengeIds.includes("*") ? "ALL SERVER GAMES" : `${pack.challengeIds.length} MINI GAMES`}</em></span><kbd>SELECT</kbd></button>`).join("") + `<button type="button" class="collection-card create-card" data-nav data-create-collection="packs"><span class="collection-icon">＋</span><span><small>MAKE IT YOURS</small><h3>Create New Party Pack</h3><p>Build a reusable playlist from your mini-game library.</p></span></button>`;
}

function renderPackChecklist(pack = null) {
  const included = new Set(pack?.challengeIds || []);
  const all = included.has("*");
  $("#pack-checklist").innerHTML = app.catalog.challenges.map((game) => `<button class="pack-toggle ${all || included.has(game.id) || !pack ? "selected" : ""}" type="button" data-nav data-pack-game="${game.id}">${game.title}</button>`).join("") || "<p>Create a mini game first.</p>";
}

function openCollectionEditor(type, item = null) {
  closeContextMenu(false);
  app.collectionEditor = { type, id: item?.id || null };
  const route = type;
  const browser = $(`#${route === "packs" ? "pack" : "rules"}-browser`);
  const form = $(`#${route === "packs" ? "pack" : "rules"}-form`);
  $(`[data-view="${route}"]`).classList.add("editing-collection");
  browser.classList.add("hidden");
  form.classList.remove("hidden");
  if (route === "packs") {
    form.elements.name.value = item?.name || "";
    form.elements.description.value = item?.description || "";
    $("#pack-editor-mode").textContent = item ? "EDIT PACK" : "NEW PACK";
    $("#pack-editor-title").textContent = item ? `Edit ${item.name}` : "Create Party Pack";
    renderPackChecklist(item);
  } else {
    const values = item || { name: "", description: "", rounds: 5, startingCoins: 10, minigameEvery: 1, blueCoins: 3, redCoins: -3, luckyCoins: 7 };
    for (const [name, value] of Object.entries(values)) if (form.elements[name]) form.elements[name].value = value ?? "";
    $("#rules-editor-mode").textContent = item ? "EDIT RULES" : "NEW RULES";
    $("#rules-editor-title").textContent = item ? `Edit ${item.name}` : "Create House Rules";
  }
  requestAnimationFrame(() => focusNav(form.querySelector("[data-nav]")));
}

function closeCollectionEditor() {
  if (!app.collectionEditor) return;
  const type = app.collectionEditor.type;
  app.collectionEditor = null;
  $(`[data-view="${type}"]`).classList.remove("editing-collection");
  $(`#${type === "packs" ? "pack" : "rules"}-form`).classList.add("hidden");
  $(`#${type === "packs" ? "pack" : "rules"}-browser`).classList.remove("hidden");
  type === "packs" ? renderPacks() : renderRules();
  requestAnimationFrame(() => focusNav($(`[data-view="${type}"] [data-create-collection]`)));
}

function contextItem(type, id) {
  if (type === "pack") return app.catalog.packs.find((item) => item.id === id);
  if (type === "rules") return app.catalog.rulesets.find((item) => item.id === id);
  if (type === "game") return app.catalog.challenges.find((item) => item.id === id);
  return null;
}

function openContextMenu(owner, point = null) {
  if (!owner) return false;
  const type = owner.dataset.contextType;
  const id = owner.dataset.contextId;
  const item = contextItem(type, id);
  if (!item) return false;
  app.contextTarget = { type, id, owner };
  app.contextDeleteArmed = false;
  const popover = $("#action-popover");
  const editButton = popover.querySelector('[data-context-action="edit"]');
  const deleteButton = popover.querySelector('[data-context-action="delete"]');
  $("#popover-title").textContent = item.title || item.name;
  const generated = type === "pack" && item.smart;
  editButton.disabled = generated;
  deleteButton.disabled = generated;
  deleteButton.textContent = generated ? "GENERATED PLAYLIST" : "DELETE";
  popover.classList.remove("hidden");
  const rect = owner.getBoundingClientRect();
  const desiredLeft = point?.x ?? rect.right + 14;
  const desiredTop = point?.y ?? rect.top + rect.height / 2;
  popover.style.left = `${Math.min(innerWidth - 245, Math.max(18, desiredLeft))}px`;
  popover.style.top = `${Math.min(innerHeight - 225, Math.max(18, desiredTop))}px`;
  requestAnimationFrame(() => focusNav(editButton.disabled ? popover.querySelector('[data-context-action="close"]') : editButton));
  audio.sfx("confirm");
  return true;
}

function openFocusedContextMenu() {
  const focused = $(".nav-focus");
  return openContextMenu(focused?.matches("[data-context-type]") ? focused : focused?.closest("[data-context-type]"));
}

function closeContextMenu(restoreFocus = true) {
  const popover = $("#action-popover");
  if (!popover || popover.classList.contains("hidden")) return;
  const owner = app.contextTarget?.owner;
  popover.classList.add("hidden");
  app.contextTarget = null;
  app.contextDeleteArmed = false;
  if (restoreFocus && owner?.offsetParent !== null) requestAnimationFrame(() => focusNav(owner));
}

async function runContextAction(action) {
  if (action === "close") return closeContextMenu();
  const target = app.contextTarget;
  const item = target && contextItem(target.type, target.id);
  if (!target || !item) return closeContextMenu(false);
  if (action === "edit") {
    if (target.type === "game") { closeContextMenu(false); return editGame(target.id); }
    return openCollectionEditor(target.type === "pack" ? "packs" : "rules", item);
  }
  if (action === "delete") {
    const button = $('#action-popover [data-context-action="delete"]');
    if (!app.contextDeleteArmed) {
      app.contextDeleteArmed = true;
      button.textContent = "PRESS AGAIN TO DELETE";
      button.classList.add("armed");
      audio.sfx("back");
      return;
    }
    const endpoint = target.type === "game" ? `/api/challenges/${target.id}` : target.type === "pack" ? `/api/packs/${target.id}` : `/api/rulesets/${target.id}`;
    await api(endpoint, { method: "DELETE" });
    closeContextMenu(false);
    await refreshCatalog();
    if (target.type === "game") renderGames();
    if (target.type === "pack") renderPacks();
    if (target.type === "rules") renderRules();
    audio.sfx("save");
    notify(`${item.title || item.name} deleted from the server.`);
    requestAnimationFrame(() => focusNav(visibleNav()[0]));
  }
}

function romArt(game) {
  return game.boxArt ? `<img src="${game.boxArt}" alt="${game.title} box art">` : `<div class="cart-placeholder"><span>NES</span><b>${game.title}</b></div>`;
}

function renderLibrary() {
  const games = app.catalog.games || [];
  $("#rom-count").textContent = `${games.length} GAME${games.length === 1 ? "" : "S"}`;
  $("#rom-grid").innerHTML = games.map((game) => `<button data-nav data-play-rom="${game.id}" class="rom-card ${game.id === app.catalog.activeGameId ? "active-rom" : ""}"><span class="box-art">${romArt(game)}</span><span class="rom-copy"><small>${game.series} · ${game.difficulty}</small><h3>${game.title}</h3><span class="tag-row">${game.genres.map((genre) => `<span class="tag">${genre}</span>`).join("")}</span><p>${game.fileHint}</p><span class="rom-play-label">PLAY GAME</span></span></button>`).join("") || '<div class="empty-card"><h2>No cartridges found.</h2><p>Add a ROM to the roms folder, then run the scanner in Settings.</p></div>';
}

function renderSettings() {
  const games = app.catalog.games || [];
  $("#settings-library").innerHTML = games.map((game) => `<article><span class="tiny-art">${game.boxArt ? `<img src="${game.boxArt}" alt="">` : "▣"}</span><div><b>${game.title}</b><small>${game.fileHint} · ${game.genres.join(" / ")}</small></div><em class="${game.boxArt ? "ready" : ""}">${game.boxArt ? "ART READY" : "NO ART"}</em></article>`).join("");
  renderControls();
}

const controlLabels = { up: "Move Up", down: "Move Down", left: "Move Left", right: "Move Right", b: "NES B", a: "NES A", select: "NES Select", start: "NES Start", saveState: "Save Moment", rewind: "Rewind", creator: "Make Mini-Game", success: "Training: Completed Goal", failure: "Training: Unsuccessful Goal", exit: "Leave Game" };
function keyLabel(key) { return key === " " ? "Space" : key.replace("arrow", "Arrow ").replace(/\b\w/g, (letter) => letter.toUpperCase()); }
function renderControls() {
  $("#bindings-grid").innerHTML = Object.entries(controlLabels).map(([action, label]) => `<div class="binding-row"><b>${label}</b><button type="button" data-nav data-bind-key="${action}" class="${app.captureBinding === action ? "listening" : ""}">${app.captureBinding === action ? "PRESS A KEY…" : keyLabel(app.controls.keyboard[action])}</button><select data-nav data-bind-pad="${action}">${Array.from({ length: 18 }, (_, index) => `<option value="${index}" ${Number(app.controls.gamepad[action]) === index ? "selected" : ""}>Controller Button ${index}</option>`).join("")}</select></div>`).join("");
  $("#nes-help").innerHTML = `<span><kbd>✚</kbd> MOVE</span><span><kbd>${keyLabel(app.controls.keyboard.b)}</kbd> B</span><span><kbd>${keyLabel(app.controls.keyboard.a)}</kbd> A</span><span><kbd>${keyLabel(app.controls.keyboard.saveState)}</kbd> SAVE</span><span><kbd>${keyLabel(app.controls.keyboard.rewind)}</kbd> REWIND</span><span><kbd>${keyLabel(app.controls.keyboard.exit)}</kbd> LEAVE</span>`;
}

function renderMultiCreatorStages() {
  const stage = app.multiCreatorStage || "game";
  const stageGame = $("#multi-stage-game");
  const stageState = $("#multi-stage-state");
  const stageEditor = $("#multi-stage-editor");

  if (!stageGame || !stageState || !stageEditor) return;

  stageGame.classList.toggle("hidden", stage !== "game");
  stageState.classList.toggle("hidden", stage !== "state");
  stageEditor.classList.toggle("hidden", stage !== "editor");

  if (stage === "game") {
    const games = app.catalog.games || [];
    const grid = $("#multi-game-grid");
    if (grid) {
      grid.innerHTML = games.map((game) => {
        const thumbUrl = game.boxArtUrl || `/boxart/${game.id}.png`;
        return `
          <div class="creator-game-card" data-nav data-multi-select-game="${game.id}">
            <img class="creator-game-thumb" src="${thumbUrl}" alt="${game.title}" onerror="this.src='/fallback-art.png'">
            <span class="creator-game-title">${game.title}</span>
            <span class="creator-game-genre">${game.genres?.[0] || game.series || "NES"}</span>
          </div>
        `;
      }).join("");
    }
  } else if (stage === "state") {
    const game = app.multiCreatorSelectedGame || {};
    $("#multi-state-title").textContent = `${game.title || "Game"}: Choose Starting Point`;
    const states = app.gameStates || [];
    const grid = $("#multi-state-grid");
    if (grid) {
      const cards = [
        `
        <div class="creator-state-card fresh" data-nav data-multi-select-state="fresh">
          <div class="state-card-icon">▶</div>
          <div class="state-card-info">
            <div class="state-card-title">Start Fresh</div>
            <div class="state-card-desc">Power on / boot from title screen</div>
          </div>
        </div>
        `,
        ...states.map((state) => `
          <div class="creator-state-card" data-nav data-multi-select-state="${state.id}">
            <div class="state-card-icon">💾</div>
            <div class="state-card-info">
              <div class="state-card-title">${state.title}</div>
              <div class="state-card-desc">Saved starting moment</div>
            </div>
          </div>
        `),
      ];
      grid.innerHTML = cards.join("");
    }
  } else if (stage === "editor") {
    const game = app.multiCreatorSelectedGame || {};
    const badge = $("#multi-editor-source-badge");
    if (badge) badge.textContent = `${game.title || "NES"} · ${app.multiCreatorStateTitle || "Start"}`;
    renderMultiCreator();
  }
  requestAnimationFrame(() => focusNav(visibleNav().find((item) => !item.classList.contains("edge-nav")) || visibleNav()[0]));
}

async function selectMultiCreatorGame(gameId) {
  const game = (app.catalog.games || []).find((g) => g.id === gameId);
  if (!game) throw new Error("Game not found");
  await app.unloadPromise;
  const result = await api(`/api/library/${game.id}/load`, { method: "POST" });
  await emulator.loadGame(result.game);
  app.catalog.activeGameId = result.game.id;
  app.multiCreatorSelectedGame = result.game;
  app.creator = null;
  const [statesRes, modsRes] = await Promise.all([
    api(`/api/library/${game.id}/states`),
    api(`/api/library/${game.id}/modifiers`).catch(() => ({ modifiers: [] })),
  ]);
  app.gameStates = statesRes.states || [];
  app.gameModifiers = modsRes.modifiers || [];
  emulator.setAvailableModifiers(app.gameModifiers);
  app.multiCreatorStage = "state";
  renderMultiCreatorStages();
  audio.sfx("confirm");
}

function drawCurrentFrame(targetId = "#multi-creator-screen") {
  if (!emulator.core) return;
  try {
    const { width, height, video } = emulator.runFrame(0);
    const image = new ImageData(new Uint8ClampedArray(video.buffer, video.byteOffset, video.byteLength), width, height);
    const canvas = $(targetId);
    if (canvas) {
      if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
      const context = canvas.getContext("2d", { alpha: false });
      context.imageSmoothingEnabled = false;
      context.putImageData(image, 0, 0);
    }
  } catch {}
}

async function selectMultiCreatorStartingMoment(stateId) {
  if (!app.multiCreatorSelectedGame) throw new Error("Select a game first");
  if (stateId === "fresh") {
    app.multiCreatorStateTitle = "Title Screen / Start";
  } else {
    const saved = await api(`/api/library/${app.multiCreatorSelectedGame.id}/states/${stateId}/load`, { method: "POST" });
    if (!emulator.core?.loadState(browserBytes.fromBase64(saved.stateBase64))) {
      throw new Error("This starting moment is incompatible with the browser core");
    }
    app.multiCreatorStateTitle = saved.title || "Saved Moment";
  }
  app.creator = null;
  emulator.creator = null;
  ensureCoreAudio();
  app.multiCreatorStage = "editor";
  setInputMode(true);
  renderMultiCreatorStages();
  drawCurrentFrame("#multi-creator-screen");
  audio.sfx("confirm");
  notify(`Game loaded (${app.multiCreatorStateTitle})! Play to your starting moment, then click CAPTURE.`);
}

// --- MOMENT MAKER / GAMEPLAY RECORDER & DVR TIMELINE ---

tasPlayback.onFrameUpdate = (data, output) => {
  updateMomentMakerUI(data, output);
  if (app.momentSelectedGame && tasPlayback.movie) {
    app.persistedMomentSessions[app.momentSelectedGame.id] = {
      movie: tasPlayback.movie,
      currentFrame: tasPlayback.currentFrame,
    };
  }
};
tasPlayback.onStateCached = (frame, ratio) => updateScrubberGreenzone(ratio);

function renderMomentMakerStages() {
  const stage = app.momentMakerStage || "game";
  const stageGame = $("#moment-stage-game");
  const stageMinigames = $("#moment-stage-minigames");
  const stageStudio = $("#moment-stage-studio");

  if (!stageGame || !stageStudio) return;

  stageGame.classList.toggle("hidden", stage !== "game");
  if (stageMinigames) stageMinigames.classList.toggle("hidden", stage !== "minigames");
  stageStudio.classList.toggle("hidden", stage !== "studio");

  if (stage === "game") {
    tasPlayback.pause();
    app.momentLiveControl = false;
    setInputMode(false);
    const games = app.catalog.games || [];
    $("#moment-game-count").textContent = `${games.length} CARTRIDGE${games.length === 1 ? "" : "S"}`;
    const grid = $("#moment-game-grid");
    if (grid) {
      grid.innerHTML = games.map((game) => {
        const thumbUrl = game.boxArtUrl || `/boxart/${game.id}.png`;
        const count = (app.catalog.challenges || []).filter(
          (c) => c.gameId === game.id || c.gameTitle === game.title || c.gameName === game.title || c.cartridgeId === game.id
        ).length;
        return `
          <div class="creator-game-card moment-game-pick-card" data-nav data-moment-select-game="${game.id}">
            <img class="creator-game-thumb" src="${thumbUrl}" alt="${game.title}" onerror="this.src='/fallback-art.png'">
            <span class="creator-game-title">${game.title}</span>
            <span class="creator-game-genre">${game.genres?.[0] || game.series || "NES"} · ${count} MINI-GAME${count === 1 ? "" : "S"}</span>
          </div>
        `;
      }).join("");
    }
  } else if (stage === "minigames") {
    tasPlayback.pause();
    app.momentLiveControl = false;
    setInputMode(false);
    const game = app.momentSelectedGame || {};
    const heading = $("#moment-minigames-heading");
    if (heading) heading.textContent = `${game.title || "Game"} Mini-Games`;

    const grid = $("#moment-minigames-grid");
    if (grid) {
      const challenges = (app.catalog.challenges || []).filter(
        (c) => c.gameId === game.id || c.gameTitle === game.title || c.gameName === game.title || c.cartridgeId === game.id
      );

      const newCardHtml = `
        <div class="create-new-minigame-card" data-nav data-action="moment-create-new-minigame">
          <div class="create-new-icon-box">
            <span class="create-new-plus">＋</span>
          </div>
          <div class="create-new-meta">
            <strong class="create-new-title">MAKE NEW MINI-GAME</strong>
            <p class="create-new-desc">Record live gameplay and capture a new timeline moment</p>
          </div>
          <span class="create-new-badge">LAUNCH RECORDER ▶</span>
        </div>
      `;

      const savingCardHtml = (app.savingMinigame && (app.savingMinigame.gameId === game.id || app.savingMinigame.gameTitle === game.title)) ? `
        <div class="minigame-card-item saving-shadow-card">
          <div class="saving-spinner-ring"></div>
          <div class="minigame-card-meta">
            <small class="saving-kicker">SAVING TO SERVER…</small>
            <strong class="minigame-card-title">${app.savingMinigame.title || "New Mini-Game"}</strong>
            <p class="minigame-card-desc">Writing rule cartridge and compiling state...</p>
          </div>
          <span class="saving-badge">PLEASE WAIT ⏳</span>
        </div>
      ` : "";

      const challengeCardsHtml = challenges.map((c) => {
        const catIcon = c.category === "Speed" ? "⚡" : c.category === "Puzzle" ? "◆" : c.category === "Survival" ? "🛡️" : c.category === "Score Attack" ? "🎯" : "★";
        const timeSec = c.timeLimit || Math.round((c.timeLimitFrames || 900) / 60);
        return `
          <div class="minigame-card-item" data-nav data-minigame-id="${c.id}">
            <div class="minigame-card-header">
              <span class="minigame-icon">${catIcon}</span>
              <div class="minigame-card-meta">
                <strong class="minigame-card-title">${c.title}</strong>
                <div class="minigame-pill-row">
                  <span class="minigame-pill difficulty-${(c.difficulty || "medium").toLowerCase()}">${c.difficulty || "Medium"}</span>
                  <span class="minigame-pill category">${c.category || "Skill"}</span>
                  <span class="minigame-pill time">${timeSec}s</span>
                  <span class="minigame-pill players">${c.playerCount || 1}P</span>
                </div>
              </div>
            </div>
            <p class="minigame-card-instructions">${c.instructions || c.description || "Complete the goal before time runs out!"}</p>
            <div class="minigame-card-footer">
              <button class="minigame-action-btn play" data-nav data-action="play-challenge" data-challenge-id="${c.id}">PLAY ▶</button>
              <button class="minigame-action-btn edit" data-nav data-action="edit-challenge" data-challenge-id="${c.id}">EDIT ✏️</button>
            </div>
          </div>
        `;
      }).join("");

      grid.innerHTML = `${newCardHtml}${savingCardHtml}${challengeCardsHtml}`;
    }
  } else if (stage === "studio") {
    const game = app.momentSelectedGame || {};
    const heading = $("#moment-studio-heading");
    if (heading) heading.textContent = `Step 3 - DVR Gameplay for ${game.title || "Game"}`;
    
    const slider = $("#moment-timeline-slider");
    if (slider) {
      const total = tasPlayback.movie?.totalFrames || 0;
      slider.max = Math.max(1, total);
      slider.value = tasPlayback.currentFrame || 0;
    }
    
    renderMomentChapterBar();
    renderScrubberMarkers();
    tasPlayback.notifyUpdate();
    setupMomentScrubberHover();
  }
  requestAnimationFrame(() => focusNav(visibleNav().find((item) => !item.classList.contains("edge-nav")) || visibleNav()[0]));
}

async function selectMomentMakerGame(gameId) {
  const game = (app.catalog.games || []).find((g) => g.id === gameId);
  if (!game) throw new Error("Game not found");
  app.momentSelectedGame = game;
  app.momentMakerStage = "minigames";
  renderMomentMakerStages();
  audio.sfx("confirm");
}

async function launchMomentMakerForGame(gameId) {
  const game = (app.catalog.games || []).find((g) => g.id === gameId) || app.momentSelectedGame;
  if (!game) throw new Error("Game not found");
  await app.unloadPromise;
  
  const result = await api(`/api/library/${game.id}/load`, { method: "POST" });
  await emulator.loadGame(result.game);
  app.catalog.activeGameId = result.game.id;
  app.momentSelectedGame = result.game;

  // Load available cheat modifiers for this game
  const modsRes = await api(`/api/library/${game.id}/modifiers`).catch(() => ({ modifiers: [] }));
  app.gameModifiers = modsRes.modifiers || [];
  emulator.setAvailableModifiers(app.gameModifiers);

  // Check if we have a persisted session for this game
  const persisted = app.persistedMomentSessions?.[game.id];
  if (persisted && persisted.movie && persisted.movie.frames?.length) {
    await tasPlayback.loadMovie(persisted.movie, persisted.currentFrame || 0, persisted.startState || null);
    if (persisted.currentFrame) {
      await tasPlayback.seek(persisted.currentFrame);
    }
    app.momentSelectedTas = persisted.movie;
    notify(`Restored timeline for ${game.title} (Frame ${tasPlayback.currentFrame})`);
  } else {
    // Initialize live DVR recording movie
    const dvrMovie = new TasMovie({
      id: `dvr-${game.id}-${Date.now()}`,
      title: `${game.title} (Live Session)`,
      gameTitle: game.title,
      gameId: game.id,
      category: "Live",
      author: "Player",
    });
    await tasPlayback.loadMovie(dvrMovie);
    app.momentSelectedTas = dvrMovie;
    app.persistedMomentSessions[game.id] = {
      movie: dvrMovie,
      currentFrame: 0,
    };
    notify(`${game.title} loaded! Click RECORD to start playing or scrub the timeline.`);
  }

  ensureCoreAudio();
  app.momentMakerStage = "studio";
  app.momentLiveControl = false;
  setInputMode(false);
  app.inputMask = 0;

  renderMomentMakerStages();
  drawMomentScreen();
  updateMomentCheatsBadge();
  audio.sfx("confirm");
}

function updateMomentCheatsBadge() {
  const mods = emulator.modifiers || [];
  const activeCount = mods.filter((m) => m.enabled === true).length;
  const btn = $("#moment-cheats-btn");
  const label = $("#moment-cheats-badge-label");
  if (label) {
    label.textContent = activeCount > 0 ? `CHEAT CODES (${activeCount} ON)` : `CHEAT CODES (0)`;
  }
  if (btn) {
    btn.classList.toggle("has-active", activeCount > 0);
  }
}

function openMomentCheatsModal() {
  const modal = $("#moment-cheats-modal");
  const title = $("#moment-cheats-game-title");
  if (!modal) return;

  const game = app.momentSelectedGame || {};
  if (title) title.textContent = `${game.title || "Game"} Cheat Codes`;

  renderMomentCheatsList();
  modal.classList.remove("hidden");
  requestAnimationFrame(() => focusNav(visibleNav()[0]));
}

function closeMomentCheatsModal() {
  $("#moment-cheats-modal")?.classList.add("hidden");
}

async function openMomentStatesModal() {
  const modal = $("#moment-states-modal");
  const title = $("#moment-states-game-title");
  if (!modal || !app.momentSelectedGame) return;

  if (title) title.textContent = `${app.momentSelectedGame.title || "Game"} · Saved Moments`;

  try {
    const res = await api(`/api/library/${app.momentSelectedGame.id}/states`);
    app.momentGameStates = (res.states || []).filter(
      (s) => !s.isMinigame && s.type !== "minigame" && s.category !== "minigame" && s.source !== "minigame" && !s.title.startsWith("Mini-Game Start")
    );
  } catch (error) {
    app.momentGameStates = [];
  }

  renderMomentStatesList();
  modal.classList.remove("hidden");
  requestAnimationFrame(() => focusNav(visibleNav()[0]));
}

function closeMomentStatesModal() {
  $("#moment-states-modal")?.classList.add("hidden");
}

function renderMomentStatesList() {
  const list = $("#moment-states-list");
  if (!list) return;
  const states = app.momentGameStates || [];
  if (!states.length) {
    list.innerHTML = `
      <div class="empty-states-msg">
        <p>No saved moments found for this game yet.</p>
        <small>You can capture and save key moments using the "Save Reusable Moment" section below the screen!</small>
      </div>
    `;
    return;
  }

  list.innerHTML = states.map((state) => {
    const formattedDate = state.createdAt ? new Date(state.createdAt).toLocaleDateString(undefined, { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" }) : "Saved State";
    const sizeKb = state.bytes ? `${(state.bytes / 1024).toFixed(1)} KB` : "";
    return `
      <div class="moment-state-row" data-state-id="${state.id}">
        <div class="moment-state-info">
          <strong class="moment-state-title">${state.title || "Moment"}</strong>
          <span class="moment-state-meta">${formattedDate} ${sizeKb ? `· ${sizeKb}` : ""}</span>
        </div>
        <div class="moment-state-actions">
          <button type="button" class="state-action-btn edit-btn" data-nav data-action="moment-state-edit" data-state-id="${state.id}" title="Edit Name">✏️ EDIT</button>
          <button type="button" class="state-action-btn load-btn" data-nav data-action="moment-state-load" data-state-id="${state.id}" title="Load state and reset DVR">⚡ LOAD</button>
          <button type="button" class="state-action-btn delete-btn" data-nav data-action="moment-state-delete" data-state-id="${state.id}" title="Delete Save State">🗑️ DELETE</button>
        </div>
      </div>
    `;
  }).join("");
}

async function momentLoadState(stateId) {
  if (!app.momentSelectedGame || !emulator.core) return;
  const saved = await api(`/api/library/${app.momentSelectedGame.id}/states/${stateId}/load`, { method: "POST" });
  if (!saved?.stateBase64) throw new Error("Could not load save state");

  const stateBytes = browserBytes.fromBase64(saved.stateBase64);

  // Initialize live DVR recording movie starting from this state
  const dvrMovie = new TasMovie({
    id: `dvr-${app.momentSelectedGame.id}-${Date.now()}`,
    title: `${app.momentSelectedGame.title} (From ${saved.title})`,
    gameTitle: app.momentSelectedGame.title,
    gameId: app.momentSelectedGame.id,
    category: "Live",
    author: "Player",
  });
  await tasPlayback.loadMovie(dvrMovie, 0, stateBytes);
  app.momentSelectedTas = dvrMovie;

  app.momentLiveControl = false;
  setInputMode(false);
  app.inputMask = 0;

  closeMomentStatesModal();
  renderMomentMakerStages();
  drawMomentScreen();
  audio.sfx("confirm");
  notify(`⚡ Loaded "${saved.title}"! DVR reset to start from this moment.`);
}

async function momentEditStateName(stateId) {
  if (!app.momentSelectedGame) return;
  const state = (app.momentGameStates || []).find((s) => s.id === stateId);
  if (!state) return;
  const newTitle = prompt("Edit Moment Name:", state.title || "");
  if (newTitle !== null && newTitle.trim() && newTitle.trim() !== state.title) {
    const res = await api(`/api/library/${app.momentSelectedGame.id}/states/${stateId}`, {
      method: "PATCH",
      body: { title: newTitle.trim() },
    });
    if (res?.state) {
      state.title = res.state.title;
    } else {
      state.title = newTitle.trim();
    }
    renderMomentStatesList();
    audio.sfx("save");
    notify(`✏️ Renamed moment to "${state.title}"`);
  }
}

async function momentDeleteState(stateId) {
  if (!app.momentSelectedGame) return;
  const state = (app.momentGameStates || []).find((s) => s.id === stateId);
  if (!confirm(`Delete moment "${state?.title || "Save State"}"?`)) return;

  await api(`/api/library/${app.momentSelectedGame.id}/states/${stateId}`, { method: "DELETE" });
  app.momentGameStates = (app.momentGameStates || []).filter((s) => s.id !== stateId);
  renderMomentStatesList();
  audio.sfx("back");
  notify(`🗑️ Deleted moment "${state?.title || "Save State"}"`);
}

function renderMomentCheatsList() {
  const list = $("#moment-cheats-list");
  if (!list) return;
  const mods = emulator.modifiers || [];
  if (!mods.length) {
    list.innerHTML = `<p style="color:#8a849d;font-size:12px;padding:12px;margin:0;text-align:center;">No pre-packaged cheats found for this game. You can add custom RAM freeze codes below!</p>`;
  } else {
    list.innerHTML = mods.map((mod) => {
      const isChecked = mod.enabled === true;
      return `
        <label class="modifier-card ${isChecked ? "active" : ""}">
          <input type="checkbox" class="moment-mod-checkbox" data-moment-mod-id="${mod.id}" ${isChecked ? "checked" : ""}>
          <div class="modifier-info">
            <div class="modifier-header">
              <span class="modifier-name">${mod.name}</span>
              <span class="modifier-badge">${mod.category || "Cheat"}</span>
            </div>
            <div class="modifier-desc">${mod.description || `RAM Freeze at $${(mod.address || 0).toString(16).toUpperCase().padStart(4, "0")} = ${mod.value}`}</div>
          </div>
        </label>
      `;
    }).join("");
  }
  updateMomentCheatsBadge();
}

async function saveMomentCustomCheat() {
  const name = $("#moment-mod-input-name")?.value.trim() || "Custom Cheat";
  const rawAddr = ($("#moment-mod-input-address")?.value || "").trim().replace(/^[$#0x]/i, "");
  const rawVal = ($("#moment-mod-input-value")?.value || "").trim().replace(/^[$#0x]/i, "");
  const address = parseInt(rawAddr, 16);
  const value = parseInt(rawVal, isNaN(Number(rawVal)) ? 16 : 10);
  if (isNaN(address)) throw new Error("Invalid RAM address (e.g. 0756 or $0756)");
  if (isNaN(value)) throw new Error("Invalid Value (e.g. 2 or $02)");
  const gameId = app.momentSelectedGame?.id;
  if (!gameId) throw new Error("No game selected");

  const res = await api(`/api/library/${gameId}/modifiers`, {
    method: "POST",
    body: { name, address, value, kind: "freeze", category: "Custom" },
  });

  if (!app.gameModifiers) app.gameModifiers = [];
  app.gameModifiers.push({ ...res.modifier, enabled: true });
  emulator.setAvailableModifiers(app.gameModifiers);
  emulator.toggleModifier(res.modifier.id, true);

  $("#moment-custom-cheat-form")?.classList.add("hidden");
  if ($("#moment-mod-input-name")) $("#moment-mod-input-name").value = "";
  if ($("#moment-mod-input-address")) $("#moment-mod-input-address").value = "";
  if ($("#moment-mod-input-value")) $("#moment-mod-input-value").value = "";

  renderMomentCheatsList();
  audio.sfx("save");
  notify(`Saved and enabled cheat "${name}"!`);
}

function drawMomentScreen(output = null) {
  const frameOutput = output || tasPlayback.renderCurrentFrame();
  if (!frameOutput?.video) return;
  try {
    const { width, height, video } = frameOutput;
    const image = new ImageData(new Uint8ClampedArray(video.buffer, video.byteOffset, video.byteLength), width, height);
    const canvas = $("#moment-screen");
    if (canvas) {
      if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
      const context = canvas.getContext("2d", { alpha: false });
      context.imageSmoothingEnabled = false;
      context.putImageData(image, 0, 0);
    }
  } catch {}
}

function updateMomentMakerUI(data, output = null) {
  if (app.route !== "moment-maker" || app.momentMakerStage !== "studio") return;

  const currentFrameEl = $("#moment-current-frame");
  const totalFramesEl = $("#moment-total-frames");
  const currentTimecodeEl = $("#moment-current-timecode");
  const totalTimecodeEl = $("#moment-total-timecode");
  const slider = $("#moment-timeline-slider");
  const playBtnLabel = $("#moment-play-label");
  const playBtnIcon = $("#moment-play-icon");
  const chapterBadge = $("#moment-chapter-badge");
  const chapterTitle = $("#moment-chapter-title");
  const controlBadge = $("#moment-control-active");
  const recordBtn = $("#moment-record-btn");
  const recordLabel = $("#moment-record-label");
  const isPlayingOrLive = tasPlayback.isPlaying || app.momentLiveControl;

  if (currentFrameEl) currentFrameEl.textContent = data.currentFrame.toLocaleString();
  if (totalFramesEl) totalFramesEl.textContent = data.totalFrames.toLocaleString();
  if (currentTimecodeEl) currentTimecodeEl.textContent = data.timecode;
  if (totalTimecodeEl) totalTimecodeEl.textContent = data.totalTimecode;

  if (slider && !tasPlayback.isSeeking) {
    slider.max = Math.max(1, data.totalFrames);
    if (Number(slider.value) !== data.currentFrame) slider.value = data.currentFrame;
  }

  if (controlBadge) controlBadge.classList.toggle("hidden", !app.momentLiveControl);
  if (recordBtn) recordBtn.classList.toggle("recording", Boolean(app.momentLiveControl));
  if (recordLabel) recordLabel.textContent = app.momentLiveControl ? "RECORDING" : "RECORD";

  if (playBtnLabel) playBtnLabel.textContent = isPlayingOrLive ? "PAUSE" : "PLAY";
  if (playBtnIcon) playBtnIcon.textContent = isPlayingOrLive ? "❚❚" : "▶";

  if (chapterTitle && data.chapter) {
    chapterTitle.textContent = data.chapter.title;
    chapterBadge?.classList.remove("hidden");
  }

  // Active chapter pill highlight
  $$("#moment-chapter-bar .chapter-pill").forEach((pill) => {
    const frame = Number(pill.dataset.chapterFrame);
    pill.classList.toggle("active", data.chapter && data.chapter.frame === frame);
  });

  // Audio queue on 1x playback
  if (data.isPlaying && output?.audio?.length && data.speed === 1) {
    queueCoreAudio(output.audio, output.audio.length / 2, output.sampleRate);
  }

  drawMomentScreen(output);
}

function updateScrubberGreenzone(ratio) {
  const greenzone = $("#scrubber-greenzone");
  if (greenzone) {
    greenzone.style.width = `${Math.min(100, Math.max(0, ratio * 100))}%`;
  }
}

function renderScrubberMarkers() {
  const layer = $("#scrubber-markers-layer");
  const movie = tasPlayback.movie;
  if (!layer || !movie || !movie.totalFrames) return;

  layer.innerHTML = movie.markers.map((marker) => {
    const leftPercent = (marker.frame / movie.totalFrames) * 100;
    return `<div class="scrubber-tick" style="left: ${leftPercent}%;" title="${marker.title} (Frame ${marker.frame})"></div>`;
  }).join("");
}

function renderMomentChapterBar() {
  const bar = $("#moment-chapter-bar");
  const movie = tasPlayback.movie;
  if (!bar || !movie) return;

  bar.innerHTML = movie.markers.map((marker) => {
    return `
      <button type="button" class="chapter-pill" data-nav data-chapter-frame="${marker.frame}" title="${marker.title}">
        <span>★</span>
        <b>${marker.title}</b>
      </button>
    `;
  }).join("");
}

let scrubberHoverBound = false;
function setupMomentScrubberHover() {
  if (scrubberHoverBound) return;
  const slider = $("#moment-timeline-slider");
  const preview = $("#scrubber-hover-preview");
  const thumbImg = $("#scrubber-hover-thumb");
  const timeEl = $("#scrubber-hover-time");
  const frameEl = $("#scrubber-hover-frame");
  if (!slider || !preview) return;

  scrubberHoverBound = true;

  const updatePreview = (clientX) => {
    const rect = slider.getBoundingClientRect();
    if (!rect.width) return;
    const ratio = Math.max(0, Math.min(1, (clientX - rect.left) / rect.width));
    const total = tasPlayback.movie ? tasPlayback.movie.totalFrames : 0;
    const targetFrame = Math.round(ratio * total);
    const thumbUrl = tasPlayback.getThumbnailForFrame(targetFrame);

    if (thumbUrl && thumbImg) {
      thumbImg.src = thumbUrl;
      thumbImg.style.display = "block";
    } else if (thumbImg) {
      thumbImg.style.display = "none";
    }

    if (timeEl) timeEl.textContent = TasMovie.formatTimecode(targetFrame);
    if (frameEl) frameEl.textContent = `Frame ${targetFrame.toLocaleString()}`;

    const percent = Math.min(90, Math.max(10, ratio * 100));
    preview.style.left = `${percent}%`;
    preview.classList.remove("hidden");
  };

  slider.addEventListener("mousemove", (e) => updatePreview(e.clientX));
  slider.addEventListener("mouseleave", () => preview.classList.add("hidden"));
}

async function momentMakeMinigame() {
  if (!app.momentSelectedGame || !emulator.core) throw new Error("Load a game first");
  tasPlayback.pause();
  app.momentLiveControl = false;
  setInputMode(false);
  
  const frameNum = tasPlayback.currentFrame;
  const timecode = TasMovie.formatTimecode(frameNum);
  const momentName = `${app.momentSelectedGame.title} (Frame ${frameNum})`;

  // Prepare Multi-Creator with this starting state directly without polluting save states library
  app.multiCreatorSelectedGame = app.momentSelectedGame;
  app.multiCreatorStateTitle = momentName;
  
  const modsRes = await api(`/api/library/${app.momentSelectedGame.id}/modifiers`).catch(() => ({ modifiers: [] }));
  app.gameModifiers = modsRes.modifiers || [];
  emulator.setAvailableModifiers(app.gameModifiers);

  emulator.creator = null;
  app.creator = emulator.startCreator();
  app.multiCreatorStage = "editor";
  
  ensureCoreAudio();
  navigate("multi-creator");
  renderMultiCreatorStages();
  setInputMode(true);
  drawCurrentFrame("#multi-creator-screen");
  
  audio.sfx("win");
  notify(`⚡ Starting moment captured from frame ${frameNum}! You now have live control. Teach your goal!`);
}

async function momentSaveState() {
  if (!app.momentSelectedGame || !emulator.core) throw new Error("Load a game first");
  const inputEl = $("#moment-save-title");
  const title = inputEl?.value.trim() || `Moment @ ${TasMovie.formatTimecode(tasPlayback.currentFrame)}`;
  const stateBuffer = tasPlayback.captureState();

  const saved = await api(`/api/library/${app.momentSelectedGame.id}/states`, {
    method: "POST",
    body: {
      title,
      stateBase64: browserBytes.toBase64(stateBuffer),
    },
  });

  if (!app.gameStates) app.gameStates = [];
  app.gameStates.unshift(saved);
  audio.sfx("save");
  notify(`💾 Saved moment "${saved.title}" to ${app.momentSelectedGame.title} library!`);
}

function momentToggleLiveControl() {
  app.momentLiveControl = !app.momentLiveControl;
  tasPlayback.pause();
  
  if (app.momentLiveControl) {
    // If we scrubbed back, branch recording from current frame
    if (tasPlayback.movie && tasPlayback.currentFrame < tasPlayback.movie.totalFrames) {
      tasPlayback.branchFromFrame(tasPlayback.currentFrame);
    }
    setInputMode(true);
    app.inputMask = 0;
    notify("🔴 Live play recording active! Use your controller/keyboard. Press Esc or Select to pause and scrub.");
  } else {
    setInputMode(false);
    app.inputMask = 0;
    notify("Timeline scrubber active. Drag slider or use frame step buttons.");
  }

  tasPlayback.notifyUpdate();
}

async function restartMomentSession() {
  if (!app.momentSelectedGame) return;
  await selectMomentMakerGame(app.momentSelectedGame.id);
}

async function playRawGame(gameId) {
  await app.unloadPromise;
  ensureCoreAudio();
  const result = await api(`/api/library/${gameId}/load`, { method: "POST" });
  await emulator.loadGame(result.game);
  app.catalog.activeGameId = result.game.id;
  app.rawGame = result.game;
  app.challenge = null;
  app.challengeContext = null;
  app.gameOutcome = null;
  $("#play-kicker").textContent = "CARTRIDGE PLAY";
  $("#play-title").textContent = result.game.title;
  $("#play-instructions").textContent = "Play freely, rewind mistakes, or save a moment for the mini-game creator.";
  $("#timer-pill").textContent = "FREE PLAY";
  $("#timer-pill").classList.remove("hurry");
  $("#game-result").className = "game-result hidden";
  $("#freeplay-tools").classList.remove("hidden");
  navigate("play");
}

function renderRules() {
  $("#rules-count").textContent = `${app.catalog.rulesets.length} RULE SET${app.catalog.rulesets.length === 1 ? "" : "S"}`;
  $("#rules-list").innerHTML = app.catalog.rulesets.map((rules) => `<button type="button" class="collection-card" data-nav data-collection-item data-context-type="rules" data-context-id="${rules.id}"><span class="collection-icon rules-icon">⚑</span><span><small>HOUSE RULES</small><h3>${rules.name}</h3><p>${rules.description || `Play for ${rules.rounds} rounds with a mini game every ${rules.minigameEvery} round.`}</p><em>${rules.rounds} ROUNDS · ${rules.startingCoins} COINS · MINI-GAME EVERY ${rules.minigameEvery} ROUND${rules.minigameEvery === 1 ? "" : "S"}</em></span><kbd>SELECT</kbd></button>`).join("") + `<button type="button" class="collection-card create-card" data-nav data-create-collection="rules"><span class="collection-icon">＋</span><span><small>WRITE YOUR OWN</small><h3>Create New Rule Set</h3><p>Change rounds, rewards, and mini-game frequency.</p></span></button>`;
}

function placeBoardToken(token, space, playerIndex, playerCount) {
  const offsetX = (playerIndex - (playerCount - 1) / 2) * 1.65;
  const offsetY = playerIndex % 2 === 1 ? -1 : 1;
  token.style.left = `${space.x + offsetX}%`;
  token.style.top = `${space.y + offsetY}%`;
}

const wait = (milliseconds) => new Promise((resolve) => setTimeout(resolve, milliseconds));

async function animateBoardMove(playerId, movement) {
  const board = app.catalog.boards.find((item) => item.id === app.session.boardId) || app.catalog.boards[0];
  const playerIndex = app.session.players.findIndex((player) => player.id === playerId);
  const token = $(`#board-tokens [data-player-id="${playerId}"]`);
  if (!board || !token || playerIndex < 0) return;
  token.classList.add("moving");
  for (const position of movement || []) {
    placeBoardToken(token, board.spaces[position], playerIndex, app.session.players.length);
    audio.sfx("move");
    await wait(230);
  }
  token.classList.remove("moving");
}

function animateBoardReward(playerId, coinChange, starChange) {
  const token = $(`#board-tokens [data-player-id="${playerId}"]`);
  const score = $(`#score-ribbon [data-player-id="${playerId}"]`);
  if (coinChange) {
    score?.classList.add(coinChange > 0 ? "coins-gained" : "coins-lost");
    const burst = document.createElement("div");
    burst.className = `reward-burst ${coinChange > 0 ? "gain" : "loss"}`;
    burst.textContent = `${coinChange > 0 ? "+" : "−"}${Math.abs(coinChange)} ●`;
    if (token) {
      burst.style.left = token.style.left;
      burst.style.top = token.style.top;
    }
    $("#board-fx")?.append(burst);
    setTimeout(() => burst.remove(), 1400);
  }
  if (starChange) {
    score?.classList.add("star-gained");
    const burst = document.createElement("div");
    burst.className = "reward-burst star-burst";
    burst.textContent = "★ STAR!";
    if (token) { burst.style.left = token.style.left; burst.style.top = token.style.top; }
    $("#board-fx")?.append(burst);
    setTimeout(() => burst.remove(), 1800);
    audio.sfx("win");
  }
  setTimeout(() => score?.classList.remove("coins-gained", "coins-lost", "star-gained"), 1400);
}

function renderBoard() {
  if (!app.session) return;
  const board = app.catalog.boards.find((item) => item.id === app.session.boardId) || app.catalog.boards[0];
  const rules = app.catalog.rulesets.find((item) => item.id === app.session.rulesetId) || app.catalog.rulesets[0];
  if (!board) return;
  renderPixiMainBoard(board).catch(error=>console.warn("Pixi board renderer could not update",error));
  const boardStage = $("#board-stage");
  boardStage.style.backgroundImage = "none";
  boardStage.dataset.boardId = board.id;
  if ($("#board-tokens").dataset.sessionId !== app.session.id) {
    $("#board-tokens").innerHTML = "";
    $("#board-tokens").dataset.sessionId = app.session.id;
  }

  // 1. Draw SVG connecting track lines between dots
  if (board.spaces && board.spaces.length > 1) {
    const d = board.spaces.map((space, index) => `${index === 0 ? "M" : "L"} ${space.x} ${space.y}`).join(" ") + " Z";
    const casing = $("#board-track-casing");
    const glow = $("#board-track-glow");
    const line = $("#board-track-line");
    if (casing) casing.setAttribute("d", d);
    if (glow) glow.setAttribute("d", d);
    if (line) line.setAttribute("d", d);
  }

  // 2. Render board space dots
  const spaceIcons = { start: "GO", blue: "+", red: "−", lucky: "✦", event: "!" };
  $("#board-spaces").innerHTML = board.spaces.map((space) => `<i class="board-space ${space.type} ${space.id === app.session.starPosition ? "star-stop" : ""}" style="left:${space.x}%;top:${space.y}%" title="Space ${space.id + 1} (${space.type})"><span class="space-num">${spaceIcons[space.type] || space.id + 1}</span></i>`).join("");
  const starSpace = board.spaces[app.session.starPosition] || board.spaces[0];
  const vendor = $("#star-vendor");
  vendor.style.left = `${starSpace.x}%`;
  vendor.style.top = `${starSpace.y}%`;
  vendor.querySelector(".vendor-bubble span").textContent = `STAR SHOP · ${app.session.starCost || board.starCost || 20} COINS`;

  // 3. Render upside-down teardrop map placement pins
  for (const token of $$("#board-tokens .player-token")) {
    if (!app.session.players.some((player) => String(player.id) === token.dataset.playerId)) token.remove();
  }
  for (let index = 0; index < app.session.players.length; index++) {
    const player = app.session.players[index];
    let token = $(`#board-tokens [data-player-id="${player.id}"]`);
    if (!token) {
      token = document.createElement("div");
      token.className = "player-token";
      token.dataset.playerId = player.id;
      token.style.setProperty("--player-color", player.color);
      const character = getCharacter(player.characterId, index);
      token.innerHTML = `<div class="token-marker">${characterArt(character, "token-character")}<b>${player.id}</b></div><div class="pin-ground-shadow"></div>`;
      $("#board-tokens").append(token);
    }
    const space = board.spaces[player.position] || board.spaces[0];
    const isCurrent = (app.session.players[app.session.currentPlayerIndex]?.id === player.id) && app.session.status !== "complete";
    token.classList.toggle("current-turn", isCurrent);

    placeBoardToken(token, space, index, app.session.players.length);
  }

  $("#turn-round").textContent = app.session.status === "complete" ? "FINAL RESULTS" : `ROUND ${app.session.round} / ${rules.rounds}`;
  $("#turn-player").textContent = app.session.status === "complete" ? "Party complete!" : `${app.session.players[app.session.currentPlayerIndex].name}'s turn`;
  $("#board-event").textContent = app.session.lastEvent;
  $("#roll-dice").disabled = Boolean(app.session.pendingMinigame) || app.session.status === "complete";
  $("#score-ribbon").innerHTML = app.session.players.map((player, index) => {
    const character = getCharacter(player.characterId, index);
    return `<div class="score-card ${index === app.session.currentPlayerIndex && app.session.status !== "complete" ? "current" : ""}" data-player-id="${player.id}">${characterArt(character, "score-character")}<span><b>${player.name}</b><small>Space ${player.position + 1}</small></span><span class="score-treasure"><b>★ ${player.stars || 0}</b><small>● ${player.coins}</small></span></div>`;
  }).join("");
  const callout = $("#minigame-callout");
  const showCallout = Boolean(app.session.pendingMinigame) || app.session.status === "complete";
  callout.classList.toggle("hidden", !showCallout);
  callout.classList.toggle("final", app.session.status === "complete");
  if (app.session.status === "complete") {
    const winner = [...app.session.players].sort((a, b) => (b.stars || 0) - (a.stars || 0) || b.coins - a.coins)[0];
    $("#callout-kicker").textContent = "PARTY CHAMPION";
    $("#pending-title").textContent = `${winner.name} wins!`;
    $("#callout-copy").textContent = `${winner.stars || 0} stars and ${winner.coins} coins takes the crown.`;
    $("#launch-pending").textContent = "NEW PARTY";
  } else if (app.session.pendingMinigame) {
    $("#callout-kicker").textContent = "NEXT UP";
    $("#pending-title").textContent = app.session.pendingMinigame.title;
    $("#callout-copy").textContent = "Ten coins are on the line.";
    $("#launch-pending").textContent = "PLAY NOW";
  }
}

function updateMultiLedgerHUD(ledger, failureReason = null) {
  const ledgerHud = $("#multi-ledger-hud");
  if (!ledgerHud) return;
  const chips = [];
  if (ledger?.descriptions) {
    ledger.descriptions.forEach((desc, i) => {
      const done = ledger.statuses[i];
      const cleanLabel = desc.startsWith("$") ? `Goal ${i + 1}` : desc.replace(/^ALL:\s*/, "");
      chips.push(`<span class="ledger-chip ${done ? "done" : ""}">${done ? "✓" : "○"} ${cleanLabel}</span>`);
    });
  }
  if (failureReason) {
    chips.push(`<span class="ledger-chip loss">✕ ${failureReason}</span>`);
  }
  ledgerHud.innerHTML = chips.join("");
}

function renderMultiCreator() {
  const creator = app.creator;
  $("#multi-creator-phase").textContent = creator?.editingId ? `EDITING · ${creator.mode.toUpperCase()}` : creator?.mode?.replace(/-/g, " ").toUpperCase() || "NOT STARTED";
  const count = creator?.positiveCount || 0;
  const losses = creator?.negativeCount || 0;
  $("#multi-teach-copy").textContent = creator?.mode === "recording"
    ? `Recording now · ${creator.recordingFrames} frames. Mark when goal is complete or loss occurs.`
    : `${count} win${count === 1 ? "" : "s"} · ${losses} loss${losses === 1 ? "" : "es"} captured. Every attempt rewinds to the same starting moment.`;

  const candidates = creator?.candidates || [];
  const selected = creator?.selected || candidates[0];
  const guards = creator?.failureConditionCount ? ` · ${creator.failureConditionCount} fail guard${creator.failureConditionCount === 1 ? "" : "s"}` : "";
  $("#multi-rule-copy").textContent = selected
    ? `Selected: ${selected.description} (${selected.confidence || 100}% confidence${guards})`
    : "Learned candidate rules (single and compound pairs) will appear below once at least 2 wins are recorded.";

  // Modifiers step rendering (collapsed by default, completely optional)
  const mods = emulator.modifiers || [];
  const activeMods = mods.filter((m) => m.enabled === true);
  const activeCount = activeMods.length;
  const countSpan = $("#multi-active-mod-count");
  if (countSpan) countSpan.textContent = activeCount === 1 ? "1 active" : `${activeCount} active`;
  const toggleModsBtn = $("#multi-toggle-modifiers-btn");
  if (toggleModsBtn) {
    toggleModsBtn.textContent = app.modifiersExpanded
      ? "▲ HIDE CHEATS"
      : (activeCount > 0 ? `▼ CHEATS (${activeCount} ON)` : "+ SHOW CHEATS");
  }
  $("#multi-modifiers-drawer")?.classList.toggle("hidden", !app.modifiersExpanded);

  const modifiersList = $("#multi-modifiers-list");
  if (modifiersList) {
    if (!mods.length) {
      modifiersList.innerHTML = `<p style="color:#8a849d;font-size:11px;padding:8px;margin:0;text-align:center;">No cheat codes found for this game. Click <b>+ ADD CUSTOM CHEAT</b> below to add one.</p>`;
    } else {
      modifiersList.innerHTML = mods.map((mod) => {
        const isChecked = mod.enabled === true;
        return `
          <label class="modifier-card ${isChecked ? "active" : ""}">
            <input type="checkbox" class="modifier-checkbox" data-mod-id="${mod.id}" ${isChecked ? "checked" : ""}>
            <div class="modifier-info">
              <div class="modifier-header">
                <span class="modifier-name">${mod.name}</span>
                <span class="modifier-badge">${mod.category || "Cheat"}</span>
              </div>
              <div class="modifier-desc">${mod.description}</div>
            </div>
          </label>
        `;
      }).join("");
    }
  }

  const unifiedList = $("#multi-unified-rules-list");
  if (unifiedList) {
    const isRecording = creator?.mode === "recording";
    const milestones = creator?.milestones || [];
    const lossGuards = creator?.lossGuards || [];
    const allRules = [
      ...milestones.map((m) => ({ ...m, ruleType: "goal" })),
      ...lossGuards.map((g) => ({ ...g, ruleType: "loss" })),
    ];

    if (!allRules.length) {
      unifiedList.innerHTML = `<p style="color:#8a849d;font-size:11px;padding:12px;margin:0;text-align:center;">No goals or loss rules yet. Start Demo and press <b>+ New Goal</b> or <b>+ New Loss</b>.</p>`;
    } else {
      unifiedList.innerHTML = allRules.map((rule) => {
        const isGoal = rule.ruleType === "goal";
        const isExpanded = app.activeInspectorId === rule.id;
        const isEnabled = rule.enabled !== false;
        const candidates = rule.candidates || (rule.condition ? [rule.condition] : []);
        const selectedIds = rule.selectedCandidateIds || (rule.condition?.id ? [rule.condition.id] : []);

        const candidateRowsHtml = isExpanded ? `
          <div class="memory-inspector-drawer">
            <div class="inspector-header">
              <span>Memory Candidates (${candidates.length} found)</span>
              <small style="color:${selectedIds.length ? "#64748b" : "#ef4444"};font-size:8.5px;font-weight:${selectedIds.length ? "normal" : "bold"};">
                ${selectedIds.length ? "Check required addresses" : "No address checked (rule inactive)"}
              </small>
            </div>
            <div class="memory-candidates-list">
              ${candidates.map((cand) => {
                const isChecked = selectedIds.includes(cand.id);
                return `
                  <label class="memory-candidate-row ${isChecked ? "selected" : ""}">
                    <input type="checkbox" class="cand-checkbox" data-type="${rule.ruleType}" data-rule-id="${rule.id}" data-cand-id="${cand.id}" ${isChecked ? "checked" : ""}>
                    <span class="cand-conf">${cand.confidence || 90}%</span>
                    <div class="cand-info">
                      <div class="cand-desc">${cand.description}</div>
                      <div class="cand-expl">${cand.explanation || ""}</div>
                    </div>
                  </label>
                `;
              }).join("")}
            </div>
          </div>
        ` : "";

        const actionButtonsHtml = isRecording ? `
          <div class="rule-actions">
            ${isGoal
              ? `<button type="button" class="thumbs-btn thumbs-up-btn" data-action="reinforce-goal" data-id="${rule.id}" title="Reinforce Goal">👍 HIT GOAL</button>`
              : `<button type="button" class="thumbs-btn thumbs-down-btn" data-action="reinforce-loss" data-id="${rule.id}" title="Reinforce Loss Trigger">👎 TRIGGER</button>`
            }
          </div>
        ` : `
          <div class="rule-actions">
            <button type="button" class="rule-btn edit-rule-btn" data-action="toggle-inspector" data-id="${rule.id}">${isExpanded ? "▲ CLOSE" : "✏️ EDIT"}</button>
            <button type="button" class="rule-btn delete-rule-btn" data-action="delete-rule" data-type="${rule.ruleType}" data-id="${rule.id}" title="Delete Rule">🗑️</button>
          </div>
        `;

        const conditionDesc = rule.condition?.description || (selectedIds.length === 0 ? "⚠ No memory address checked (click Edit to select)" : "Pending demonstration...");

        return `
          <div class="unified-rule-card ${isGoal ? "goal-theme" : "loss-theme"} ${isEnabled && rule.condition ? "" : "disabled"}">
            <div class="rule-card-main">
              ${!isRecording ? `<input type="checkbox" class="rule-card-checkbox rule-toggle-checkbox" data-type="${rule.ruleType}" data-id="${rule.id}" ${isEnabled ? "checked" : ""}>` : ""}
              <span class="rule-badge-tag">${isGoal ? "WIN GOAL" : "LOSS RULE"}</span>
              <div class="rule-info">
                <div class="rule-info-header">
                  <span class="rule-title">${rule.title}</span>
                  ${rule.hits ? `<span class="rule-hits-chip">${rule.hits} run${rule.hits === 1 ? "" : "s"}</span>` : ""}
                </div>
                <div class="rule-desc" title="${conditionDesc}">${conditionDesc}</div>
              </div>
              ${actionButtonsHtml}
            </div>
            ${candidateRowsHtml}
          </div>
        `;
      }).join("");
    }
  }

  const ledgerHud = $("#multi-ledger-hud");
  if (ledgerHud) {
    const isFailed = creator?.failureDetected || creator?.mode === "failed";
    const failReason = isFailed ? (creator?.failureReason || "Loss Triggered") : null;
    if (creator?.ledger?.descriptions?.length > 0) {
      updateMultiLedgerHUD(creator.ledger, failReason);
    } else if (creator?.milestones?.length > 0) {
      const activeMilestones = creator.milestones.filter((m) => m.enabled !== false);
      ledgerHud.innerHTML = activeMilestones.map((m) => `<span class="ledger-chip">○ ${m.title}</span>`).join("");
    } else if (selected) {
      ledgerHud.innerHTML = `<span class="ledger-chip">○ Goal 1</span>`;
    } else {
      ledgerHud.innerHTML = "";
    }
  }

  const isCaptured = Boolean(creator);
  const captureButton = $("#multi-capture-btn") || $('[data-action="multi-creator-start"]');
  if (captureButton) {
    captureButton.textContent = isCaptured ? "RECAPTURE" : "CAPTURE";
    captureButton.classList.toggle("captured-btn", isCaptured);
  }
  const captureCopy = $("#multi-capture-copy");
  if (captureCopy) {
    captureCopy.textContent = isCaptured
      ? "✓ Starting moment locked. (Click RECAPTURE to change)"
      : "Freeze this exact moment as the opening of your mini game.";
  }

  const attemptStartBtn = $("#multi-demo-start-btn") || $('[data-action="multi-attempt-start"]');
  if (attemptStartBtn) {
    attemptStartBtn.disabled = !isCaptured;
    attemptStartBtn.classList.toggle("hidden", creator?.mode === "recording");
  }
  $("#multi-creator-verdicts")?.classList.toggle("hidden", creator?.mode !== "recording");
  const hasActiveGoal = Boolean(selected || (creator?.milestones?.some((m) => m.enabled !== false && m.condition)));
  const isVerifying = creator?.mode === "verification";
  const verifyBtn = $('[data-action="multi-verify"]');
  if (verifyBtn) {
    if (isVerifying) {
      verifyBtn.disabled = false;
      verifyBtn.textContent = "STOP VERIFICATION";
      verifyBtn.classList.add("stop-verify-btn");
    } else {
      verifyBtn.disabled = !hasActiveGoal || creator?.mode === "recording";
      verifyBtn.textContent = "VERIFY RUN";
      verifyBtn.classList.remove("stop-verify-btn");
    }
  }
  const saveBtn = $('[data-action="multi-save-challenge"]');
  if (saveBtn) saveBtn.disabled = !selected || !creator?.verified;

  const screenStatus = $("#multi-creator-screen-status");
  if (screenStatus) {
    screenStatus.classList.toggle("playing", app.inputMode && app.route === "multi-creator");
    screenStatus.textContent = app.inputMode && app.route === "multi-creator"
      ? `GAME CONTROL ACTIVE · ${keyLabel(app.controls.keyboard.exit).toUpperCase()} TO EXIT`
      : "PRESS CONTROL GAME TO PLAY";
  }
  const note = $("#multi-control-note");
  if (note) note.textContent = `Press ${keyLabel(app.controls.keyboard.exit)} or your configured Leave Game button to return to creator controls.`;
}

function populateCreatorFields(creator) {
  const presentation = creator?.presentation || {};
  const metadata = creator?.metadata || {};
  if ($("#multi-challenge-title")) $("#multi-challenge-title").value = presentation.title || "Custom Challenge";
  if ($("#multi-challenge-instructions")) $("#multi-challenge-instructions").value = presentation.instructions || "Complete the goal!";
  if ($("#multi-challenge-category")) $("#multi-challenge-category").value = presentation.category || "Skill";
  if ($("#multi-challenge-difficulty")) $("#multi-challenge-difficulty").value = presentation.difficulty || "Medium";
  if ($("#multi-challenge-players")) $("#multi-challenge-players").value = String(presentation.playerCount || 1);
  if ($("#multi-challenge-time")) $("#multi-challenge-time").value = String(Math.round((creator?.rules?.timeLimitFrames || 900) / 60));
}

async function editGame(id) {
  await app.unloadPromise;
  const runtime = await api(`/api/challenges/${id}/edit`, { method: "POST" });
  await emulator.loadChallenge(runtime, true);
  app.creator = emulator.creatorSummary();
  populateCreatorFields(app.creator);
  app.catalog.activeGameId = app.creator.gameId;
  const game = (app.catalog.games || []).find((g) => g.id === app.creator.gameId);
  app.multiCreatorSelectedGame = game || { id: app.creator.gameId, title: "Game" };
  app.multiCreatorStateTitle = app.creator.presentation?.title || "Challenge";
  app.multiCreatorStage = "editor";
  navigate("multi-creator");
  renderMultiCreatorStages();
  drawCurrentFrame("#multi-creator-screen");
  notify(`Mini game "${app.creator.presentation?.title || "Challenge"}" opened for editing in Multi-Creator.`);
}

async function loadGame(id, context = null) {
  await app.unloadPromise;
  ensureCoreAudio();
  const challenge = app.catalog.challenges.find((item) => item.id === id);
  if (!challenge) throw new Error("Mini game not found");
  const runtime = await api(`/api/challenges/${id}/play`, { method: "POST" });
  await emulator.loadChallenge(runtime);
  app.challenge = challenge;
  app.rawGame = null;
  app.challengeContext = context;
  app.challengeStartedAt = performance.now();
  app.gameOutcome = null;
  $("#play-title").textContent = challenge.title;
  $("#play-instructions").textContent = challenge.instructions;
  $("#play-kicker").textContent = context ? "BOARD PARTY MINI GAME" : `${challenge.category.toUpperCase()} CHALLENGE`;
  $("#game-result").className = "game-result hidden";
  $("#freeplay-tools").classList.add("hidden");
  $("#retry-game").classList.add("hidden");
  $("#timer-pill").classList.remove("hurry");
  $("#timer-pill").textContent = challenge.timeLimitFrames ? `${Math.ceil(challenge.timeLimitFrames / 60)}s` : "GO!";
  navigate("play");
}

function updateGameTimer() {
  if (app.route !== "play" || !app.challenge || app.gameOutcome) return;
  const limit = Number(app.challenge.timeLimitFrames) / 60;
  if (!limit) return;
  const remaining = Math.max(0, limit - (performance.now() - app.challengeStartedAt) / 1000);
  $("#timer-pill").textContent = `${Math.ceil(remaining)}s`;
  $("#timer-pill").classList.toggle("hurry", remaining <= 5);
  if (remaining <= 0) showGameResult(false);
}

function showGameResult(success) {
  if (app.gameOutcome) return;
  app.gameOutcome = success ? "success" : "failed";
  app.inputMask = 0;
  app.pressed.clear();
  const result = $("#game-result");
  result.classList.remove("hidden");
  result.classList.toggle("failed", !success);
  $("#result-star").textContent = success ? "★" : "⌛";
  $("#result-title").textContent = success ? "GREAT JOB!" : "TIME'S UP!";
  $("#result-copy").textContent = success ? "The challenge goal was detected." : "That was close. Give it another go!";
  $("#retry-game").classList.toggle("hidden", success || Boolean(app.challengeContext?.sessionId));
  $("#finish-game").textContent = app.challengeContext?.sessionId ? "BACK TO THE PARTY" : "BACK TO THE ARCADE";
  setInputMode(false);
  success ? audio.sfx("win") : audio.sfx("back");
  requestAnimationFrame(() => focusNav(!success && !app.challengeContext?.sessionId ? $("#retry-game") : $("#finish-game")));
}

function ensureCoreAudio() {
  if (!app.coreAudio) {
    const AudioCtor = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtor) return;
    app.coreAudio = new AudioCtor({ latencyHint: "interactive" });
    app.coreAudioCursor = app.coreAudio.currentTime + .05;
  }
  if (app.coreAudio.state === "suspended") app.coreAudio.resume().catch(() => {});
}

function queueCoreAudio(samples, frames, sampleRate) {
  if (!app.coreAudio || !frames || (app.route !== "play" && !(new Set(["creator", "multi-creator"]).has(app.route) && app.inputMode))) return;
  const buffer = app.coreAudio.createBuffer(2, frames, sampleRate);
  for (let channel = 0; channel < 2; channel++) {
    const output = buffer.getChannelData(channel);
    for (let index = 0; index < frames; index++) output[index] = samples[index * 2 + channel] / 32768;
  }
  const source = app.coreAudio.createBufferSource();
  source.buffer = buffer;
  source.connect(app.coreAudio.destination);
  const now = app.coreAudio.currentTime;
  if (app.coreAudioCursor < now || app.coreAudioCursor > now + .2) app.coreAudioCursor = now + .04;
  source.start(app.coreAudioCursor);
  app.coreAudioCursor += frames / sampleRate;
}

async function nextFrame() {
  updateGameTimer();
  const isPlayingGame = app.route === "play";
  const isMomentControl = app.route === "moment-maker" && app.momentLiveControl && app.inputMode;
  const isCreatorControl = (new Set(["creator", "multi-creator"]).has(app.route) && app.inputMode && Boolean(emulator.game || app.catalog.activeGameId)) || isMomentControl;
  const isGameResultActive = isPlayingGame && !$("#game-result")?.classList.contains("hidden");
  if ((!isPlayingGame && !isCreatorControl) || app.fetchingFrame || document.hidden || isGameResultActive) return;
  app.fetchingFrame = true;
  try {
    const { width, height, video, audio: samples, sampleRate, outcome, ledger } = emulator.runFrame(app.inputMask);
    const image = new ImageData(new Uint8ClampedArray(video.buffer, video.byteOffset, video.byteLength), width, height);
    const targetId = app.route === "moment-maker" ? "#moment-screen" : (app.route === "multi-creator" ? "#multi-creator-screen" : (app.route === "creator" ? "#creator-screen" : "#screen"));
    const canvas = $(targetId);
    if (canvas) {
      if (canvas.width !== width || canvas.height !== height) { canvas.width = width; canvas.height = height; }
      const context = canvas.getContext("2d", { alpha: false });
      context.imageSmoothingEnabled = false;
      context.putImageData(image, 0, 0);
    }
    queueCoreAudio(samples, samples.length / 2, sampleRate);
    if (app.route === "moment-maker" && isMomentControl) {
      tasPlayback.recordLiveFrame(app.inputMask, { width, height, video, audio: samples, sampleRate });
    }
    if (app.route === "multi-creator" && app.creator?.mode === "verification" && ledger) {
      updateMultiLedgerHUD(ledger);
    }
    if (outcome?.completed === false) await challengeFailed();
    else if (outcome?.completed === true) await goalDetected();
  } catch (error) { if (app.route === "play" || app.route === "creator" || app.route === "multi-creator" || app.route === "moment-maker") notify(error.message); }
  finally { app.fetchingFrame = false; }
}

async function challengeFailed() {
  if (app.route === "play") return showGameResult(false);
  if (app.route === "multi-creator") {
    setInputMode(false);
    app.inputMask = 0;
    const reason = emulator.outcome?.reason || "Loss detected";
    app.creator = emulator.creatorSummary();
    renderMultiCreator();
    const res = $("#multi-verify-result");
    if (res) {
      res.className = "verify-outcome-card lose";
      res.innerHTML = `<span class="verify-outcome-icon">✕</span><div><strong>VERIFY RESULT: LOSS DETECTED</strong><br><small>${reason}. All goal events were not completed.</small></div>`;
    }
    audio.sfx("back");
    notify(`Verification test: ${reason}`);
    requestAnimationFrame(() => focusNav($('[data-action="multi-verify"]')));
  }
}

async function goalDetected() {
  app.inputMask = 0;
  if (app.route === "play") {
    showGameResult(true);
  } else if (app.creator?.mode === "verification") {
    app.creator = emulator.acceptVerification();
    setInputMode(false);
    audio.sfx("win");
    if (app.route === "multi-creator") {
      notify("Multi-event goal verified! WIN result detected.");
      const res = $("#multi-verify-result");
      if (res) {
        res.className = "verify-outcome-card win";
        res.innerHTML = `<span class="verify-outcome-icon">★</span><div><strong>VERIFY RESULT: WIN DETECTED!</strong><br><small>All conditions in the event ledger were successfully completed!</small></div>`;
      }
      renderMultiCreator();
    }
  }
}

function updateMask() {
  app.inputMask = keyboardInputMask();
}

function keyboardInputMask() {
  return bitsToMask(app.pressed);
}

function gameBitForKey(key) {
  const action = Object.keys(nesBits).find((name) => app.controls.keyboard[name] === key);
  return action === undefined ? null : nesBits[action];
}

async function saveFreeplayMoment(title = "Quick Moment") {
  if (!app.rawGame) throw new Error("Open a library game first");
  const saved = await api(`/api/library/${app.rawGame.id}/states`, { method: "POST", body: { title, stateBase64: browserBytes.toBase64(emulator.core.saveState()) } });
  audio.sfx("save");
  notify(`Saved “${saved.title}”.`);
  return saved;
}

async function performAction(action, target = null) {
  switch (action) {
    case "title-start": {
      await titleStart();
      break;
    }
    case "open-board-editor":
    case "start-party-mode": {
      window.location.href = "/party";
      break;
    }
    case "open-mini-game-maker": {
      window.location.href = "/mini-game-maker";
      break;
    }
    case "start-space-actions":
    case "open-space-actions": {
      window.location.href = "/party/editor/event";
      break;
    }
    case "freeplay-save": await saveFreeplayMoment($("#freeplay-state-title").value); break;
    case "rewind": emulator.rewind(6); app.coreAudioCursor = app.coreAudio?.currentTime || 0; notify("Rewound about one second."); break;
    case "freeplay-create": {
      const game = app.rawGame;
      if (!game) throw new Error("Open a library game first");
      app.multiCreatorSelectedGame = game;
      app.multiCreatorStateTitle = "Current Gameplay Moment";
      emulator.creator = null;
      app.creator = emulator.startCreator();
      app.multiCreatorStage = "editor";
      ensureCoreAudio();
      navigate("multi-creator");
      renderMultiCreatorStages();
      setInputMode(true);
      drawCurrentFrame("#multi-creator-screen");
      audio.sfx("confirm");
      notify("Starting moment captured into Mini-Game Creator! Teach your goals & rules.");
      break;
    }
    case "save-controls": {
      for (const select of $$('[data-bind-pad]')) app.controls.gamepad[select.dataset.bindPad] = Number(select.value);
      app.controls = await api("/api/controls", { method: "POST", body: app.controls });
      app.captureBinding = null; renderControls(); audio.sfx("save"); notify("Control settings saved to the server."); break;
    }
    case "delete-challenge": {
      if (!app.creator?.editingId) throw new Error("No saved mini-game is being edited");
      const button = $('[data-action="delete-challenge"]');
      if (!app.deleteArmed) {
        app.deleteArmed = true; if (button) { button.textContent = "PRESS AGAIN TO DELETE"; button.classList.add("armed"); }
        notify("Press Delete Mini-Game again to confirm.");
        setTimeout(() => { app.deleteArmed = false; if (button?.isConnected) { button.textContent = "DELETE MINI-GAME"; button.classList.remove("armed"); } }, 5000);
        break;
      }
      const deleted = await api(`/api/challenges/${app.creator.editingId}`, { method: "DELETE" });
      app.creator = null; app.deleteArmed = false; await refreshCatalog(); navigate("minigames", false); renderGames();
      audio.sfx("back"); notify(`Mini-game deleted. Recovery copy: ${deleted.recoverableFrom}`); break;
    }
    case "scan-roms": {
      const result = await api("/api/library/scan", { method: "POST" });
      await refreshCatalog(); renderSettings(); renderLibrary();
      audio.sfx("save"); notify(`Library scan complete: ${result.games.length} games found.`); break;
    }
    case "download-art": {
      const button = $('[data-action="download-art"]');
      button.disabled = true; button.textContent = "DOWNLOADING…";
      try {
        const result = await api("/api/library/artwork", { method: "POST" });
        await refreshCatalog(); renderSettings(); renderLibrary();
        const downloaded = result.results.filter((item) => item.status === "downloaded").length;
        const missing = result.results.filter((item) => item.status === "missing").length;
        audio.sfx("save"); notify(`${downloaded} box-art images downloaded${missing ? ` · ${missing} unmatched` : ""}.`);
      } finally { button.disabled = false; button.innerHTML = "DOWNLOAD MISSING ART <span>↓</span>"; }
      break;
    }
    case "multi-back-to-games": {
      app.multiCreatorStage = "game";
      renderMultiCreatorStages();
      audio.sfx("back");
      break;
    }
    case "multi-switch-game-state": {
      app.multiCreatorStage = "game";
      renderMultiCreatorStages();
      audio.sfx("back");
      break;
    }
    case "multi-control-game": ensureCoreAudio(); setInputMode(true); app.inputMask = 0; renderMultiCreator(); notify(`Game control active. Press ${keyLabel(app.controls.keyboard.exit)} to return to creator controls.`); break;
    case "multi-creator-start": {
      app.creator = emulator.startCreator();
      setInputMode(false);
      renderMultiCreator();
      audio.sfx("save");
      notify("✓ Starting moment captured! Click RECAPTURE anytime to change it.");
      break;
    }
    case "toggle-modifiers-drawer": {
      app.modifiersExpanded = !app.modifiersExpanded;
      renderMultiCreator();
      break;
    }
    case "toggle-add-modifier": {
      $("#multi-add-modifier-form")?.classList.toggle("hidden");
      break;
    }
    case "save-custom-modifier": {
      const name = $("#mod-input-name").value.trim() || "Custom Cheat";
      const rawAddr = $("#mod-input-address").value.trim().replace(/^[$#0x]/i, "");
      const rawVal = $("#mod-input-value").value.trim().replace(/^[$#0x]/i, "");
      const address = parseInt(rawAddr, 16);
      const value = parseInt(rawVal, isNaN(Number(rawVal)) ? 16 : 10);
      if (isNaN(address)) throw new Error("Invalid RAM address (e.g. 0756)");
      if (isNaN(value)) throw new Error("Invalid Value (e.g. 2)");
      const gameId = app.catalog.activeGameId || app.game?.id || $("#multi-creator-game-select")?.value;
      if (!gameId) throw new Error("No game selected");
      const res = await api(`/api/library/${gameId}/modifiers`, {
        method: "POST",
        body: { name, address, value, kind: "freeze", category: "Custom" },
      });
      if (!app.gameModifiers) app.gameModifiers = [];
      app.gameModifiers.push(res.modifier);
      emulator.setAvailableModifiers(app.gameModifiers);
      $("#multi-add-modifier-form")?.classList.add("hidden");
      $("#mod-input-name").value = "";
      $("#mod-input-address").value = "";
      $("#mod-input-value").value = "";
      renderMultiCreator();
      audio.sfx("save");
      notify(`Saved cheat "${name}" to game library!`);
      break;
    }
    case "multi-attempt-start": ensureCoreAudio(); app.creator = emulator.beginAttempt("recording"); setInputMode(true); renderMultiCreator(); notify("Demonstration active. Press 'E' to + New Goal, 'R' for + New Loss, 'T' to Restart, or 'Q' to Stop."); break;
    case "multi-restart-demo": {
      ensureCoreAudio();
      app.creator = emulator.beginAttempt("recording");
      setInputMode(true);
      renderMultiCreator();
      audio.sfx("move");
      notify("Demonstration restarted from the beginning.");
      break;
    }
    case "multi-stop-demo": {
      if (emulator.creator) {
        emulator.creator.mode = "review";
        emulator.creator.attempt = null;
      }
      setInputMode(false);
      audio.sfx("back");
      app.creator = emulator.creatorSummary();
      renderMultiCreator();
      notify("Demonstration stopped. Review and edit your goals below.");
      break;
    }
    case "multi-hit-goal": {
      const res = emulator.tagMilestone();
      if (res.error) notify(res.error);
      else {
        audio.sfx("save");
        notify(`⚡ ${res.milestone.title} marked! (${res.milestone.condition.description})`);
      }
      app.creator = emulator.creatorSummary();
      renderMultiCreator();
      break;
    }
    case "multi-game-lost": {
      const res = emulator.tagNewLoss();
      if (res.error) notify(res.error);
      else {
        audio.sfx("back");
        notify(`✕ ${res.guard.title} marked! (${res.guard.condition.description})`);
      }
      app.creator = emulator.creatorSummary();
      renderMultiCreator();
      break;
    }
    case "multi-verify": {
      if (app.creator?.mode === "verification") {
        if (emulator.creator) {
          emulator.creator.mode = "review";
          emulator.creator.attempt = null;
        }
        setInputMode(false);
        audio.sfx("back");
        app.creator = emulator.creatorSummary();
        renderMultiCreator();
        notify("Verification stopped.");
        break;
      }
      const hasActiveGoal = Boolean(app.creator?.selected || (app.creator?.milestones?.some((m) => m.enabled !== false && m.condition)));
      if (!hasActiveGoal) throw new Error("Tag at least one Goal milestone first");
      const res = $("#multi-verify-result");
      if (res) {
        res.className = "verify-outcome-card testing";
        res.innerHTML = `<span class="verify-outcome-icon">⌛</span><div><strong>VERIFICATION RUNNING</strong><br><small>Play through your challenge to test the event ledger.</small></div>`;
      }
      ensureCoreAudio(); app.creator = emulator.verify(); setInputMode(true); renderMultiCreator(); notify("Verification run started. Play the goal to test live Win/Loss detection."); break;
    }
    case "multi-save-challenge": {
      const fields = {
        title: $("#multi-challenge-title").value,
        instructions: $("#multi-challenge-instructions").value,
        category: $("#multi-challenge-category").value,
        difficulty: $("#multi-challenge-difficulty").value,
        playerCount: Number($("#multi-challenge-players").value),
        mode: Number($("#multi-challenge-players").value) === 1 ? "Solo" : "Free-for-all",
        timeLimitFrames: Number($("#multi-challenge-time").value) * 60,
      };
      const game = app.multiCreatorSelectedGame || app.momentSelectedGame;

      // 1. Immediately return to the mini-game selection menu with shadow loading card
      app.savingMinigame = {
        title: fields.title || "New Mini-Game",
        gameId: game?.id,
        gameTitle: game?.title,
      };
      app.momentSelectedGame = game;
      app.momentMakerStage = "minigames";
      navigate("moment-maker", false);
      renderMomentMakerStages();
      audio.sfx("move");
      notify(`Saving "${fields.title}" to the server…`);

      // 2. Perform save in background
      (async () => {
        try {
          const result = await api("/api/creator/save", { method: "POST", body: emulator.challengePackage(fields) });
          if (emulator.creator) emulator.creator.editingId = result.id;
          app.creator = emulator.creatorSummary();
          await refreshCatalog();
          app.savingMinigame = null;
          renderMomentMakerStages();
          audio.sfx("save");
          notify(`🎉 Saved "${result.saved?.title || fields.title}" to the server!`);
        } catch (error) {
          app.savingMinigame = null;
          renderMomentMakerStages();
          audio.sfx("lose");
          notify(`Save failed: ${error.message}`);
        }
      })();
      break;
    }
    case "moment-create-new-minigame": {
      await launchMomentMakerForGame(app.momentSelectedGame?.id);
      break;
    }
    case "moment-back-to-minigames": {
      tasPlayback.pause();
      app.momentLiveControl = false;
      setInputMode(false);
      app.momentMakerStage = "minigames";
      renderMomentMakerStages();
      audio.sfx("back");
      break;
    }
    case "play-challenge": {
      const challengeId = target?.dataset?.challengeId || target?.closest("[data-challenge-id]")?.dataset?.challengeId;
      if (challengeId) {
        audio.sfx("confirm");
        await loadGame(challengeId);
      }
      break;
    }
    case "edit-challenge": {
      const challengeId = target?.dataset?.challengeId || target?.closest("[data-challenge-id]")?.dataset?.challengeId;
      if (challengeId) {
        audio.sfx("confirm");
        await editChallenge(challengeId);
      }
      break;
    }
    case "moment-back-to-games": {
      app.momentMakerStage = "game";
      tasPlayback.pause();
      renderMomentMakerStages();
      audio.sfx("back");
      break;
    }
    case "moment-open-states": {
      await openMomentStatesModal();
      audio.sfx("confirm");
      break;
    }
    case "moment-close-states": {
      closeMomentStatesModal();
      audio.sfx("back");
      break;
    }
    case "moment-state-load": {
      const stateId = target?.dataset?.stateId || target?.closest("[data-state-id]")?.dataset?.stateId;
      if (stateId) await momentLoadState(stateId);
      break;
    }
    case "moment-state-edit": {
      const stateId = target?.dataset?.stateId || target?.closest("[data-state-id]")?.dataset?.stateId;
      if (stateId) await momentEditStateName(stateId);
      break;
    }
    case "moment-state-delete": {
      const stateId = target?.dataset?.stateId || target?.closest("[data-state-id]")?.dataset?.stateId;
      if (stateId) await momentDeleteState(stateId);
      break;
    }
    case "moment-open-cheats": {
      openMomentCheatsModal();
      audio.sfx("confirm");
      break;
    }
    case "moment-close-cheats": {
      closeMomentCheatsModal();
      audio.sfx("back");
      break;
    }
    case "moment-toggle-custom-cheat-form": {
      $("#moment-custom-cheat-form")?.classList.toggle("hidden");
      audio.sfx("move");
      break;
    }
    case "moment-save-custom-cheat": {
      await saveMomentCustomCheat();
      break;
    }
    case "moment-toggle-play": {
      if (app.momentLiveControl) {
        // Pauses live gameplay & timeline
        app.momentLiveControl = false;
        setInputMode(false);
        tasPlayback.pause();
        audio.sfx("back");
        notify("Game paused. Drag the timeline scrubber or press Record/Play.");
      } else if (tasPlayback.isPlaying) {
        tasPlayback.pause();
        audio.sfx("back");
      } else {
        tasPlayback.play();
        audio.sfx("confirm");
      }
      tasPlayback.notifyUpdate();
      break;
    }
    case "moment-toggle-record":
    case "moment-take-control": {
      momentToggleLiveControl();
      audio.sfx(app.momentLiveControl ? "confirm" : "back");
      break;
    }
    case "moment-frame-back": {
      if (app.momentLiveControl) {
        app.momentLiveControl = false;
        setInputMode(false);
      }
      tasPlayback.stepBackward(1);
      audio.sfx("move");
      break;
    }
    case "moment-frame-fwd": {
      if (app.momentLiveControl) {
        app.momentLiveControl = false;
        setInputMode(false);
      }
      tasPlayback.stepForward(1);
      audio.sfx("move");
      break;
    }
    case "moment-jump-back": {
      if (app.momentLiveControl) {
        app.momentLiveControl = false;
        setInputMode(false);
      }
      tasPlayback.stepBackward(60);
      audio.sfx("move");
      break;
    }
    case "moment-jump-fwd": {
      if (app.momentLiveControl) {
        app.momentLiveControl = false;
        setInputMode(false);
      }
      tasPlayback.stepForward(60);
      audio.sfx("move");
      break;
    }
    case "moment-restart-session": {
      await restartMomentSession();
      audio.sfx("confirm");
      break;
    }
    case "moment-make-minigame": {
      await momentMakeMinigame();
      break;
    }
    case "moment-save-state": {
      await momentSaveState();
      break;
    }
    case "moment-add-custom-marker": {
      const title = prompt("Enter a label for this moment on the timeline:", `Checkpoint @ ${TasMovie.formatTimecode(tasPlayback.currentFrame)}`);
      if (title && title.trim()) {
        tasPlayback.movie?.addMarker(tasPlayback.currentFrame, title.trim());
        renderMomentChapterBar();
        renderScrubberMarkers();
        tasPlayback.notifyUpdate();
        audio.sfx("save");
        notify(`Added marker: "${title.trim()}"`);
      }
      break;
    }
  }
}

document.addEventListener("click", async (event) => {
  const target = event.target.closest("button, [data-nav], .progress-pill, .multi-candidate-item, .remove-item-btn, .rule-btn, .thumbs-btn");
  if (!target) return;
  audio.start();
  if (target.matches("[data-nav]")) focusNav(target);
  try {
    if (target.dataset.action === "reinforce-goal") {
      const res = emulator.reinforceGoal(target.dataset.id);
      if (res.error) notify(res.error);
      else {
        audio.sfx("save");
        notify(`👍 ${res.milestone.title} reinforced!`);
      }
      app.creator = emulator.creatorSummary();
      renderMultiCreator();
      return;
    }
    if (target.dataset.action === "reinforce-loss") {
      const res = emulator.reinforceLoss(target.dataset.id);
      if (res.error) notify(res.error);
      else {
        audio.sfx("back");
        notify(`👎 ${res.guard.title} reinforced!`);
      }
      app.creator = emulator.creatorSummary();
      renderMultiCreator();
      return;
    }
    const multiGameCard = target.closest("[data-multi-select-game]");
    if (multiGameCard) {
      return await selectMultiCreatorGame(multiGameCard.dataset.multiSelectGame);
    }
    const multiStateCard = target.closest("[data-multi-select-state]");
    if (multiStateCard) {
      return await selectMultiCreatorStartingMoment(multiStateCard.dataset.multiSelectState);
    }
    const momentGameCard = target.closest("[data-moment-select-game]");
    if (momentGameCard) {
      return await selectMomentMakerGame(momentGameCard.dataset.momentSelectGame);
    }
    const chapterPill = target.closest("[data-chapter-frame]");
    if (chapterPill) {
      const frame = Number(chapterPill.dataset.chapterFrame);
      await tasPlayback.seekTo(frame);
      audio.sfx("move");
      return;
    }
    const speedBtn = target.closest("[data-moment-speed]");
    if (speedBtn) {
      const speed = Number(speedBtn.dataset.momentSpeed);
      tasPlayback.setSpeed(speed);
      $$("[data-moment-speed]").forEach((btn) => btn.classList.toggle("active", Number(btn.dataset.momentSpeed) === speed));
      audio.sfx("move");
      return;
    }
    if (target.dataset.action === "moment-select-tas") {
      await loadTasForMomentMaker(target.dataset.tasId);
      closeTasPickerModal();
      audio.sfx("save");
      return;
    }
    if (target.dataset.action === "moment-delete-tas") {
      await api(`/api/tas/${target.dataset.tasId}`, { method: "DELETE" });
      const game = app.momentSelectedGame || {};
      const tasRes = await api(`/api/tas?gameId=${game.id}&gameTitle=${encodeURIComponent(game.title)}`).catch(() => ({ movies: [] }));
      app.momentTasMovies = tasRes.movies || [];
      openTasPickerModal();
      audio.sfx("back");
      notify("Deleted custom TAS movie.");
      return;
    }
    if (target.dataset.action === "toggle-inspector") {
      app.activeInspectorId = app.activeInspectorId === target.dataset.id ? null : target.dataset.id;
      renderMultiCreator();
      audio.sfx("move");
      return;
    }
    if (target.dataset.action === "delete-rule") {
      if (target.dataset.type === "goal") app.creator = emulator.removeMilestone(target.dataset.id);
      else app.creator = emulator.removeLossGuard(target.dataset.id);
      renderMultiCreator();
      audio.sfx("move");
      return;
    }
    if (target.dataset.action === "remove-milestone") {
      app.creator = emulator.removeMilestone(target.dataset.id);
      renderMultiCreator();
      audio.sfx("move");
      return;
    }
    if (target.dataset.action === "remove-lossguard") {
      app.creator = emulator.removeLossGuard(target.dataset.id);
      renderMultiCreator();
      audio.sfx("move");
      return;
    }
    if (target.classList.contains("multi-candidate-item")) {
      const id = target.dataset.candidateId;
      if (id && emulator.creator) {
        app.creator = emulator.selectCandidate(id);
        renderMultiCreator();
        audio.sfx("move");
        return;
      }
    }
    if (target.tagName === "SELECT" && event.detail === 0) {
      event.preventDefault();
      target.selectedIndex = (target.selectedIndex + 1) % target.options.length;
      target.dispatchEvent(new Event("change", { bubbles: true }));
      audio.sfx("move");
      return;
    }
    if (target.dataset.bindKey) { app.captureBinding = target.dataset.bindKey; renderControls(); notify("Press the keyboard key you want to use."); return; }
    if (target.dataset.contextAction) return await runContextAction(target.dataset.contextAction);
    if (target.dataset.createCollection) return openCollectionEditor(target.dataset.createCollection);
    if (target.hasAttribute("data-editor-cancel")) return closeCollectionEditor();
    if (target.hasAttribute("data-collection-item")) { notify("Press NES Select or right-click for edit and delete options."); return; }
    if (target.dataset.route) { audio.sfx("confirm"); return navigate(target.dataset.route); }
    if (target.hasAttribute("data-back")) return goBack();
    if (target.dataset.wizardNext) { audio.sfx("confirm"); return setWizardStep(Number(target.dataset.wizardNext)); }
    if (target.dataset.wizardPrev) { audio.sfx("back"); return setWizardStep(Number(target.dataset.wizardPrev)); }
    if (target.dataset.wizardJump) { audio.sfx("move"); return setWizardStep(Number(target.dataset.wizardJump)); }
    if (target.closest(".progress-pill")) {
      const pill = target.closest(".progress-pill");
      audio.sfx("move");
      return setWizardStep(Number(pill.dataset.step));
    }
    if (target.dataset.playerCount) {
      app.playerCount = Number(target.dataset.playerCount);
      app.draftingPlayerIndex = Math.min(app.draftingPlayerIndex, app.playerCount - 1);
      renderPlayerRoster();
      renderCharacterDraft();
      audio.sfx("confirm");
      focusWizardNext();
      return;
    }
    if (target.dataset.draftPlayer !== undefined) {
      app.draftingPlayerIndex = Number(target.dataset.draftPlayer);
      renderCharacterDraft();
      audio.sfx("move");
      return;
    }
    if (target.dataset.selectCharacter) {
      const selectingLastPlayer = app.draftingPlayerIndex === app.playerCount - 1;
      app.selectedCharacterIds[app.draftingPlayerIndex] = target.dataset.selectCharacter;
      app.draftingPlayerIndex = (app.draftingPlayerIndex + 1) % app.playerCount;
      renderCharacterDraft();
      renderPlayerRoster();
      audio.sfx("confirm");
      if (selectingLastPlayer) focusWizardNext();
      else requestAnimationFrame(() => focusNav($(".draft-player.active"), true));
      return;
    }
    if (target.dataset.selectBoard) {
      app.selectedBoardId = target.dataset.selectBoard;
      renderBoardCards();
      audio.sfx("confirm");
      focusWizardNext();
      return;
    }
    if (target.dataset.selectPack) {
      app.selectedPackId = target.dataset.selectPack;
      renderPackCards();
      audio.sfx("confirm");
      focusWizardNext();
      return;
    }
    if (target.dataset.selectRuleset) {
      app.selectedRulesetId = target.dataset.selectRuleset;
      renderRulesetCards();
      audio.sfx("confirm");
      focusWizardNext();
      return;
    }
    if (app.route === "title") {
      if (app.titleState === "intro") {
        showTitleScreen();
        return;
      }
      if (app.titleState === "title") {
        return await titleStart();
      }
    }
    if (target.dataset.packGame) { target.classList.toggle("selected"); audio.sfx(target.classList.contains("selected") ? "confirm" : "back"); return; }
    if (target.dataset.playRom) { audio.sfx("confirm"); return await playRawGame(target.dataset.playRom); }
    if (target.dataset.playGame) { audio.sfx("confirm"); return await loadGame(target.dataset.playGame); }
    if (target.dataset.editGame) { audio.sfx("confirm"); return await editGame(target.dataset.editGame); }
    if (target.dataset.action) { return await performAction(target.dataset.action, target); }
  } catch (error) { notify(error.message); }
});

document.addEventListener("contextmenu", (event) => {
  const owner = event.target.closest("[data-context-type]");
  if (!owner) return;
  event.preventDefault();
  const focusable = owner.matches("[data-nav]") ? owner : owner.querySelector("[data-nav]");
  if (focusable) focusNav(focusable);
  openContextMenu(owner, { x: event.clientX + 8, y: event.clientY + 8 });
});

document.addEventListener("pointerover", (event) => {
  if (event.pointerType && event.pointerType !== "mouse") return;
  const target = event.target.closest("[data-nav]");
  if (target && target !== $(".nav-focus") && target.offsetParent !== null && !target.disabled) focusNav(target);
});

for (const select of [$("#filter-category"), $("#filter-players"), $("#filter-game")]) {
  if (select) select.addEventListener("change", renderGames);
}
$("#creator-game-select")?.addEventListener("change", (event) => refreshGameStates(event.target.value).catch((error) => notify(error.message)));

document.addEventListener("change", (event) => {
  if (event.target.classList.contains("moment-mod-checkbox")) {
    const modId = event.target.dataset.momentModId;
    emulator.toggleModifier(modId, event.target.checked);
    renderMomentCheatsList();
    audio.sfx("confirm");
    notify(event.target.checked ? "Cheat code enabled!" : "Cheat code disabled.");
    return;
  }
  if (event.target.classList.contains("modifier-checkbox")) {
    const modId = event.target.dataset.modId;
    emulator.toggleModifier(modId, event.target.checked);
    renderMultiCreator();
    audio.sfx("move");
  } else if (event.target.classList.contains("rule-toggle-checkbox")) {
    const id = event.target.dataset.id;
    if (event.target.dataset.type === "goal") app.creator = emulator.toggleMilestone(id, event.target.checked);
    else app.creator = emulator.toggleLossGuard(id, event.target.checked);
    renderMultiCreator();
    audio.sfx("move");
  } else if (event.target.classList.contains("cand-checkbox")) {
    const ruleId = event.target.dataset.ruleId;
    const type = event.target.dataset.type;
    const checkedIds = Array.from($$(`.cand-checkbox[data-rule-id="${ruleId}"]:checked`)).map((cb) => cb.dataset.candId);
    if (type === "goal") app.creator = emulator.updateMilestoneCondition(ruleId, checkedIds);
    else app.creator = emulator.updateLossGuardCondition(ruleId, checkedIds);
    renderMultiCreator();
    audio.sfx("move");
  } else if (event.target.classList.contains("milestone-checkbox")) {
    const id = event.target.dataset.id;
    app.creator = emulator.toggleMilestone(id, event.target.checked);
    renderMultiCreator();
    audio.sfx("move");
  } else if (event.target.classList.contains("lossguard-checkbox")) {
    const id = event.target.dataset.id;
    app.creator = emulator.toggleLossGuard(id, event.target.checked);
    renderMultiCreator();
    audio.sfx("move");
  }
});

$("#music-toggle")?.addEventListener("click", () => { const enabled = audio.toggle(); $("#music-toggle").textContent = enabled ? "♫" : "♩"; notify(enabled ? "Music on" : "Music muted"); });

$("#start-party")?.addEventListener("click", async () => {
  try {
    const playerInputs = $$("#player-names-roster input");
    const playerNames = playerInputs.length
      ? playerInputs.map((input, idx) => input.value.trim() || `Player ${idx + 1}`)
      : app.playerNames.slice(0, app.playerCount);

    const boardId = app.selectedBoardId || app.catalog.boards[0]?.id;
    const packId = app.selectedPackId || app.catalog.packs[0]?.id;
    const rulesetId = app.selectedRulesetId || app.catalog.rulesets[0]?.id;

    app.session = await api("/api/sessions", {
      method: "POST",
      body: {
        playerCount: app.playerCount,
        playerNames,
        characterIds: app.selectedCharacterIds.slice(0, app.playerCount),
        boardId,
        packId,
        rulesetId,
      },
    });
    audio.sfx("win");
    navigate("board");
  } catch (error) { notify(error.message); }
});

$("#roll-dice").addEventListener("click", async () => {
  const button = $("#roll-dice");
  let shuffle;
  try {
    const movingPlayerId = app.session.players[app.session.currentPlayerIndex].id;
    audio.sfx("roll");
    button.disabled = true;
    button.classList.add("rolling");
    const faces = ["⚀", "⚁", "⚂", "⚃", "⚄", "⚅"];
    shuffle = setInterval(() => { $("#die-face").textContent = faces[Math.floor(Math.random() * faces.length)]; }, 90);
    const [result] = await Promise.all([
      api(`/api/sessions/${app.session.id}/roll`, { method: "POST" }),
      new Promise((resolve) => setTimeout(resolve, 700)),
    ]);
    app.session = result.session;
    $("#die-face").textContent = faces[result.roll - 1];
    await animateBoardMove(movingPlayerId, result.movement);
    renderBoard();
    animateBoardReward(movingPlayerId, result.coinChange, result.starChange);
  } catch (error) { notify(error.message); }
  finally {
    clearInterval(shuffle);
    button.classList.remove("rolling");
    if (!app.session?.pendingMinigame && app.session?.status === "playing") button.disabled = false;
  }
});

$("#launch-pending").addEventListener("click", () => {
  if (app.session.status === "complete") return navigate("board-setup");
  return loadGame(app.session.pendingMinigame.challengeId, { sessionId: app.session.id });
});
$("#finish-game").addEventListener("click", async () => {
  try {
    if (app.challengeContext?.sessionId) {
      const rewardedPlayerId = app.session.players[app.session.currentPlayerIndex].id;
      const previousCoins = app.session.players.find((player) => player.id === rewardedPlayerId)?.coins || 0;
      app.session = await api(`/api/sessions/${app.challengeContext.sessionId}/minigame-result`, { method: "POST", body: { completed: app.gameOutcome === "success", winnerIndex: app.session.currentPlayerIndex } });
      app.challengeContext = null;
      navigate("board");
      const updatedCoins = app.session.players.find((player) => player.id === rewardedPlayerId)?.coins || 0;
      if (updatedCoins !== previousCoins) requestAnimationFrame(() => animateBoardReward(rewardedPlayerId, updatedCoins - previousCoins, 0));
    } else navigate("minigames");
  } catch (error) { notify(error.message); }
});
$("#retry-game").addEventListener("click", () => loadGame(app.challenge.id));

$("#pack-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const form = new FormData(event.currentTarget);
    const challengeIds = $$("#pack-checklist .pack-toggle.selected").map((button) => button.dataset.packGame);
    if (!challengeIds.length) throw new Error("Choose at least one mini game for this pack");
    await api("/api/packs", { method: "POST", body: { id: app.collectionEditor?.id, name: form.get("name"), description: form.get("description"), challengeIds } });
    await refreshCatalog(); audio.sfx("save"); notify("Party pack saved to the server."); closeCollectionEditor();
  } catch (error) { notify(error.message); }
});

$("#rules-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  try {
    const values = Object.fromEntries(new FormData(event.currentTarget));
    await api("/api/rulesets", { method: "POST", body: { ...values, id: app.collectionEditor?.id } });
    await refreshCatalog(); audio.sfx("save"); notify("House rules saved to the server."); closeCollectionEditor();
  } catch (error) { notify(error.message); }
});

document.addEventListener("keydown", async (event) => {
  const key = event.key.toLowerCase();
  audio.start();
  if (app.route === "title") {
    event.preventDefault();
    if (app.titleState === "intro") {
      showTitleScreen();
    } else if (app.titleState === "title") {
      if (["enter", " ", "a", "start"].includes(key) || !event.repeat) {
        await titleStart();
      }
    }
    return;
  }
  if (app.captureBinding) {
    event.preventDefault();
    app.controls.keyboard[app.captureBinding] = key;
    app.captureBinding = null;
    renderControls();
    return;
  }
  if (app.inputMode) {
    if (key === app.controls.keyboard.exit) {
      if (app.route === "moment-maker") {
        momentToggleLiveControl();
        return;
      }
      setInputMode(false); app.pressed.clear(); updateMask();
      if (app.route === "play") return goBack();
      if (app.route === "multi-creator") {
        renderMultiCreator();
        notify("Creator controls active.");
        focusNav($('[data-action="multi-control-game"]'));
      }
      return;
    }
    if (app.rawGame && key === app.controls.keyboard.saveState && !event.repeat) { event.preventDefault(); await saveFreeplayMoment("Quick Moment"); return; }
    if (app.rawGame && key === app.controls.keyboard.rewind) { event.preventDefault(); await performAction("rewind"); return; }
    if (app.rawGame && key === app.controls.keyboard.creator && !event.repeat) { event.preventDefault(); await performAction("freeplay-create"); return; }
    if (app.route === "multi-creator" && (key === "e" || key === "g") && app.creator?.mode === "recording" && !event.repeat) {
      event.preventDefault();
      await performAction("multi-hit-goal");
      return;
    }
    if (app.route === "multi-creator" && key === "r" && app.creator?.mode === "recording" && !event.repeat) {
      event.preventDefault();
      await performAction("multi-game-lost");
      return;
    }
    if (app.route === "multi-creator" && key === "t" && app.creator?.mode === "recording" && !event.repeat) {
      event.preventDefault();
      await performAction("multi-restart-demo");
      return;
    }
    if (app.route === "multi-creator" && key === "q" && app.creator?.mode === "recording" && !event.repeat) {
      event.preventDefault();
      await performAction("multi-stop-demo");
      return;
    }
    const bit = gameBitForKey(key);
    if (bit !== null) { event.preventDefault(); app.pressed.add(bit); updateMask(); }
    return;
  }
  if (app.route === "moment-maker" && !event.target.matches("input")) {
    if (key === " " || key === "k") {
      event.preventDefault();
      tasPlayback.togglePlay();
      return;
    }
    if (key === "[" || key === "," || key === "j") {
      event.preventDefault();
      tasPlayback.stepBackward(1);
      return;
    }
    if (key === "]" || key === "." || key === "l") {
      event.preventDefault();
      tasPlayback.stepForward(1);
      return;
    }
    if (key === "m") {
      event.preventDefault();
      await momentMakeMinigame();
      return;
    }
    if (key === "s" && !event.ctrlKey && !event.metaKey) {
      event.preventDefault();
      await momentSaveState();
      return;
    }
    if (key === "c") {
      event.preventDefault();
      momentToggleLiveControl();
      return;
    }
  }
  if (key === app.controls.keyboard.select && !event.repeat) {
    event.preventDefault();
    if (!openFocusedContextMenu()) notify("This option has no edit menu.");
    return;
  }
  const menuDirection = Object.entries({ up: app.controls.keyboard.up, down: app.controls.keyboard.down, left: app.controls.keyboard.left, right: app.controls.keyboard.right }).find(([, bound]) => bound === key)?.[0];
  if (menuDirection) {
    if (event.target.matches("input") && ["left", "right"].includes(menuDirection)) return;
    event.preventDefault(); moveFocus(menuDirection); return;
  }
  if ([app.controls.keyboard.start, app.controls.keyboard.a].includes(key)) { event.preventDefault(); const focus = $(".nav-focus") || visibleNav()[0]; focus?.click(); return; }
  if ([app.controls.keyboard.exit, app.controls.keyboard.b].includes(key) && app.route !== "home") {
    if (app.route === "moment-maker" && app.momentLiveControl) {
      event.preventDefault();
      app.momentLiveControl = false;
      setInputMode(false);
      tasPlayback.pause();
      tasPlayback.notifyUpdate();
      notify("Game paused. Timeline scrubber active.");
      return;
    }
    event.preventDefault();
    goBack();
  }
});

$("#moment-timeline-slider")?.addEventListener("input", (event) => {
  if (app.momentLiveControl) {
    app.momentLiveControl = false;
    setInputMode(false);
  }
  tasPlayback.pause();
  tasPlayback.seekTo(Number(event.target.value));
});

document.addEventListener("keyup", (event) => { const bit = gameBitForKey(event.key.toLowerCase()); if (bit !== null) { app.pressed.delete(bit); updateMask(); } });
window.addEventListener("pointerdown", () => audio.start(), { once: true });
window.addEventListener("touchstart", () => audio.start(), { once: true });
window.addEventListener("resize", updatePointerPosition);
window.addEventListener("scroll", updatePointerPosition, { passive: true, capture: true });
window.addEventListener("gamepadconnected", (event) => { $("#controller-status").innerHTML = `<i></i> ${event.gamepad.id.split("(")[0].slice(0, 24).toUpperCase()}`; notify("Controller connected!"); });

function pollGamepad() {
  const pad = firstConnectedGamepad(navigator.getGamepads?.());
  if (pad) {
    const pressedOnce = (index) => pad.buttons[index]?.pressed && !app.gamepadButtons[index];
    if (app.route === "title") {
      const anyPressed = pad.buttons.some((b) => b?.pressed);
      if (anyPressed) {
        if (app.titleState === "intro") showTitleScreen();
        else if (app.titleState === "title") titleStart();
        return;
      }
    }
    if (app.inputMode) {
      app.inputMask = keyboardInputMask() | gamepadInputMask(pad, app.controls.gamepad);
      if (pressedOnce(app.controls.gamepad.exit)) {
        setInputMode(false); app.inputMask = 0;
        if (app.route === "play") goBack();
        else if (app.route === "moment-maker") {
          app.momentLiveControl = false;
          tasPlayback.pause();
          tasPlayback.notifyUpdate();
          notify("Game paused. Timeline scrubber active.");
        }
        else if (app.route === "multi-creator") {
          renderMultiCreatorStages();
          focusNav($('[data-action="multi-toggle-demo"]'));
        }
      }
      if (app.rawGame && pressedOnce(app.controls.gamepad.saveState)) saveFreeplayMoment("Quick Moment").catch((error) => notify(error.message));
      if (app.rawGame && pressedOnce(app.controls.gamepad.rewind)) performAction("rewind").catch((error) => notify(error.message));
      if (app.rawGame && pressedOnce(app.controls.gamepad.creator)) performAction("freeplay-create").catch((error) => notify(error.message));
      if (pressedOnce(app.controls.gamepad.success) && app.creator?.mode === "recording" && app.route === "multi-creator") performAction("multi-hit-goal").catch((error) => notify(error.message));
      if (pressedOnce(app.controls.gamepad.failure) && app.creator?.mode === "recording" && app.route === "multi-creator") performAction("multi-game-lost").catch((error) => notify(error.message));
    } else {
      if (pressedOnce(app.controls.gamepad.select) && !openFocusedContextMenu()) notify("This option has no edit menu.");
      if (pressedOnce(app.controls.gamepad.a)) ($(".nav-focus") || visibleNav()[0])?.click();
      if (pressedOnce(app.controls.gamepad.b) && app.route !== "home") goBack();
      const x = pad.axes[0] || 0, y = pad.axes[1] || 0;
      if ((pressedOnce(app.controls.gamepad.left) || x < -.65) && app.gamepadAxes.x >= -.65) moveFocus("left");
      if ((pressedOnce(app.controls.gamepad.right) || x > .65) && app.gamepadAxes.x <= .65) moveFocus("right");
      if ((pressedOnce(app.controls.gamepad.up) || y < -.65) && app.gamepadAxes.y >= -.65) moveFocus("up");
      if ((pressedOnce(app.controls.gamepad.down) || y > .65) && app.gamepadAxes.y <= .65) moveFocus("down");
      app.gamepadAxes = { x, y };
    }
    app.gamepadButtons = pad.buttons.map((button) => button.pressed);
  }
  requestAnimationFrame(pollGamepad);
}

async function refreshCatalog() {
  app.catalog = await api("/api/catalog");
  const categories = [...new Set(app.catalog.challenges.map((item) => item.category))];
  $("#filter-category").innerHTML = '<option>All</option>' + categories.map((item) => `<option>${item}</option>`).join("");
  const games = (app.catalog.games || []).map((item) => [item.id, item.title]);
  $("#filter-game").innerHTML = '<option value="all">All Games</option>' + games.map(([id, name]) => `<option value="${id}">${name}</option>`).join("");
}

async function refreshStatus() {
  if (app.route === "multi-creator") {
    app.creator = emulator.creatorSummary();
    if (app.creator?.mode === "recording") {
      const copy = $("#multi-teach-copy");
      if (copy) copy.textContent = `Recording now · ${app.creator.recordingFrames} frames. Mark when goal is complete or loss occurs.`;
    }
  }
}

async function boot() {
  try {
    try {
      app.controls = await api("/api/controls");
    } catch (e) {
      console.warn("Could not load controls from server, using defaults:", e);
    }
    await refreshCatalog();
    renderGames(); renderPacks(); renderRules(); renderSetup(); renderMultiCreatorStages(); renderLibrary(); renderSettings();
    const musicBtn = $("#music-toggle");
    if (musicBtn) musicBtn.textContent = audio.enabled ? "♫" : "♩";
    navigate("title", false);
    setInterval(refreshStatus, 500);
    requestAnimationFrame(function frames() { nextFrame(); requestAnimationFrame(frames); });
    requestAnimationFrame(pollGamepad);
  } catch (error) { notify(error.message); }
}

boot();
