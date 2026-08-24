import fs from "node:fs";

const debugPort = process.env.CHROME_DEBUG_PORT || "9223";
const pages = await fetch(`http://127.0.0.1:${debugPort}/json/list`).then((response) => response.json());
const page = pages.find((item) => item.type === "page" && item.url.startsWith("http://127.0.0.1"));
if (!page) throw new Error("No local Starlight Party page found in Chrome");

const socket = new WebSocket(page.webSocketDebuggerUrl);
await new Promise((resolve, reject) => {
  socket.addEventListener("open", resolve, { once: true });
  socket.addEventListener("error", reject, { once: true });
});

let nextId = 1;
const pending = new Map();
const errors = [];
socket.addEventListener("message", ({ data }) => {
  const message = JSON.parse(data);
  if (message.id && pending.has(message.id)) {
    const { resolve, reject } = pending.get(message.id);
    pending.delete(message.id);
    message.error ? reject(new Error(message.error.message)) : resolve(message.result);
  }
  if (message.method === "Runtime.exceptionThrown") errors.push(message.params.exceptionDetails.text);
  if (message.method === "Log.entryAdded" && message.params.entry.level === "error") errors.push(message.params.entry.text);
});

function command(method, params = {}) {
  const id = nextId++;
  socket.send(JSON.stringify({ id, method, params }));
  return new Promise((resolve, reject) => pending.set(id, { resolve, reject }));
}

async function evaluate(expression) {
  const result = await command("Runtime.evaluate", { expression, awaitPromise: true, returnByValue: true });
  if (result.exceptionDetails) throw new Error(result.exceptionDetails.text);
  return result.result.value;
}

await command("Runtime.enable");
await command("Log.enable");
await command("Page.enable");
await command("Emulation.setDeviceMetricsOverride", { width: 1440, height: 1000, deviceScaleFactor: 1, mobile: false });
await command("Page.reload", { ignoreCache: true });
await new Promise((resolve) => setTimeout(resolve, 2500));
errors.length = 0;
const report = [];
report.push(await evaluate(`fetch("/api/catalog").then(function(response){ return response.json(); }).then(function(catalog){ return { apiGames: catalog.games.length, apiChallenges: catalog.challenges.length, renderedRomCount: document.getElementById("rom-count").textContent }; })`));
report.push(await evaluate(`({ headerControllerTargets: document.querySelectorAll('.party-bar [data-nav]').length })`));

await command("Input.dispatchKeyEvent", { type: "keyDown", key: "ArrowDown", code: "ArrowDown", windowsVirtualKeyCode: 40 });
await command("Input.dispatchKeyEvent", { type: "keyUp", key: "ArrowDown", code: "ArrowDown", windowsVirtualKeyCode: 40 });
await new Promise((resolve) => setTimeout(resolve, 100));
report.push(await evaluate(`({ controllerFocusAfterDown: document.querySelector('.nav-focus')?.innerText?.trim().slice(0, 40) })`));
await command("Input.dispatchKeyEvent", { type: "keyDown", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
await command("Input.dispatchKeyEvent", { type: "keyUp", key: "Enter", code: "Enter", windowsVirtualKeyCode: 13 });
await new Promise((resolve) => setTimeout(resolve, 100));
report.push(await evaluate(`({ controllerRouteAfterConfirm: document.body.dataset.route })`));
await evaluate(`document.querySelector('[data-route="home"]').click()`);

const routes = ["home", "board-setup", "minigames", "games", "packs", "rules", "settings", "creator"];
for (const route of routes) {
  await evaluate(`document.querySelector('[data-route="${route}"]')?.click()`);
  await new Promise((resolve) => setTimeout(resolve, 250));
  const metrics = await evaluate(`(() => {
    const view = document.querySelector('[data-view="${route}"]');
    return {
      route: document.body.dataset.route,
      navItems: [...view.querySelectorAll('[data-nav]')].filter((item) => item.offsetParent !== null && !item.disabled).length,
      viewport: [innerWidth, innerHeight],
      bodyOverflowX: document.documentElement.scrollWidth - innerWidth,
      viewBottom: Math.round(view.getBoundingClientRect().bottom),
      focusedLabel: document.querySelector('.nav-focus')?.innerText?.trim().slice(0, 60) || null,
    };
  })()`);
  report.push(metrics);
  const screenshot = await command("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
  fs.writeFileSync(`/private/tmp/starlight-${route}.png`, Buffer.from(screenshot.data, "base64"));
  if (route === "board-setup") {
    await evaluate(`document.querySelector('[data-wizard-next="2"]')?.click()`);
    await new Promise((resolve) => setTimeout(resolve, 100));
    report.push(await evaluate(`({ characterCards: document.querySelectorAll('.character-card').length, draftPlayers: document.querySelectorAll('.draft-player').length })`));
    const characterScreenshot = await command("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    fs.writeFileSync("/private/tmp/starlight-character-draft.png", Buffer.from(characterScreenshot.data, "base64"));
    await evaluate(`document.querySelector('#setup-progress [data-step="3"]').click()`);
    await evaluate(`document.querySelector('[data-select-board]').click()`);
    await new Promise((resolve) => setTimeout(resolve, 100));
    report.push(await evaluate(`({ selectionAdvancedFocus: document.querySelector('.nav-focus')?.dataset.wizardNext || null })`));
    await evaluate(`document.querySelector('[data-wizard-next="6"]')?.click()`);
    await new Promise((resolve) => setTimeout(resolve, 100));
    report.push(await evaluate(`(() => {
      const button = document.querySelector('#start-party');
      const style = getComputedStyle(button);
      return {
        boardConfirmVisible: button.offsetParent !== null,
        startPartyBackground: style.backgroundImage,
        startPartyRadius: style.borderRadius,
        startPartyHeight: Math.round(button.getBoundingClientRect().height),
      };
    })()`));
    const confirmScreenshot = await command("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
    fs.writeFileSync("/private/tmp/starlight-board-confirm.png", Buffer.from(confirmScreenshot.data, "base64"));
  }
}

await evaluate(`document.querySelector('[data-route="packs"]').click()`);
await new Promise((resolve) => setTimeout(resolve, 100));
await evaluate(`document.querySelector('[data-context-type="pack"]').dispatchEvent(new PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse' }))`);
await command("Input.dispatchKeyEvent", { type: "keyDown", key: "Shift", code: "ShiftLeft", windowsVirtualKeyCode: 16 });
await command("Input.dispatchKeyEvent", { type: "keyUp", key: "Shift", code: "ShiftLeft", windowsVirtualKeyCode: 16 });
await new Promise((resolve) => setTimeout(resolve, 100));
report.push(await evaluate(`({ packPopoverVisible: !document.querySelector('#action-popover').classList.contains('hidden'), packPopoverTitle: document.querySelector('#popover-title').textContent })`));
const packPopoverShot = await command("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
fs.writeFileSync("/private/tmp/starlight-pack-popover.png", Buffer.from(packPopoverShot.data, "base64"));
await evaluate(`document.querySelector('[data-context-action="edit"]').click()`);
await new Promise((resolve) => setTimeout(resolve, 100));
report.push(await evaluate(`({ packEditorVisible: !document.querySelector('#pack-form').classList.contains('hidden'), packEditorName: document.querySelector('#pack-form [name="name"]').value })`));
const packEditorShot = await command("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
fs.writeFileSync("/private/tmp/starlight-pack-editor.png", Buffer.from(packEditorShot.data, "base64"));
await evaluate(`document.querySelector('#pack-form [data-editor-cancel]').click()`);
await evaluate(`document.querySelector('[data-route="rules"]').click()`);
await new Promise((resolve) => setTimeout(resolve, 100));
await evaluate(`document.querySelector('[data-context-type="rules"]').dispatchEvent(new MouseEvent('contextmenu', { bubbles: true, clientX: 500, clientY: 350 }))`);
await new Promise((resolve) => setTimeout(resolve, 100));
report.push(await evaluate(`({ ruleRightClickPopover: !document.querySelector('#action-popover').classList.contains('hidden'), rulePopoverTitle: document.querySelector('#popover-title').textContent })`));
await evaluate(`document.querySelector('[data-context-action="close"]').click()`);

await evaluate(`document.querySelector('[data-route="games"]').click()`);
await new Promise((resolve) => setTimeout(resolve, 150));
await evaluate(`document.querySelector('[data-play-rom]')?.click()`);
await new Promise((resolve) => setTimeout(resolve, 2000));
report.push(await evaluate(`({ rawPlayRoute: document.body.dataset.route, rawPlayTitle: document.querySelector('#play-title')?.textContent, freeplayTools: !document.querySelector('#freeplay-tools')?.classList.contains('hidden') })`));
await evaluate(`document.querySelector('[data-back]').click()`);
await new Promise((resolve) => setTimeout(resolve, 150));
report.push(await evaluate(`fetch('/api/info').then(r => r.json()).then(info => ({ logicalBackRoute: document.body.dataset.route, gameUnloaded: !info.loaded }))`));
await evaluate(`document.querySelector('[data-route="minigames"]').click()`);
await new Promise((resolve) => setTimeout(resolve, 100));
await evaluate(`document.querySelector('[data-play-game]')?.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse' }))`);
await command("Input.dispatchKeyEvent", { type: "keyDown", key: "Shift", code: "ShiftLeft", windowsVirtualKeyCode: 16 });
await command("Input.dispatchKeyEvent", { type: "keyUp", key: "Shift", code: "ShiftLeft", windowsVirtualKeyCode: 16 });
await new Promise((resolve) => setTimeout(resolve, 100));
await evaluate(`document.querySelector('[data-context-action="edit"]')?.click()`);
await new Promise((resolve) => setTimeout(resolve, 2000));
await evaluate(`document.querySelector('[data-action="control-game"]').click()`);
await new Promise((resolve) => setTimeout(resolve, 150));
await command("Input.dispatchKeyEvent", { type: "keyDown", key: "ArrowRight", code: "ArrowRight", windowsVirtualKeyCode: 39 });
await new Promise((resolve) => setTimeout(resolve, 250));
report.push(await evaluate(`(async () => {
  const status = await fetch('/api/status').then((response) => response.json());
  return {
    creatorControlStatus: document.querySelector('#creator-screen-status')?.textContent,
    creatorInputMask: status.lastInputMask,
    creatorMode: status.creator?.mode,
  };
})()`));
await command("Input.dispatchKeyEvent", { type: "keyUp", key: "ArrowRight", code: "ArrowRight", windowsVirtualKeyCode: 39 });
await command("Input.dispatchKeyEvent", { type: "keyDown", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });
await command("Input.dispatchKeyEvent", { type: "keyUp", key: "Escape", code: "Escape", windowsVirtualKeyCode: 27 });

await evaluate(`document.querySelector('[data-route="minigames"]').click()`);
await new Promise((resolve) => setTimeout(resolve, 100));
await evaluate(`document.querySelector('[data-play-game]')?.dispatchEvent(new PointerEvent('pointerover', { bubbles: true, pointerType: 'mouse' }))`);
await command("Input.dispatchKeyEvent", { type: "keyDown", key: "Shift", code: "ShiftLeft", windowsVirtualKeyCode: 16 });
await command("Input.dispatchKeyEvent", { type: "keyUp", key: "Shift", code: "ShiftLeft", windowsVirtualKeyCode: 16 });
await new Promise((resolve) => setTimeout(resolve, 100));
await evaluate(`document.querySelector('[data-context-action="edit"]')?.click()`);
await new Promise((resolve) => setTimeout(resolve, 2000));
report.push(await evaluate(`({
  editRoute: document.body.dataset.route,
  editPhase: document.querySelector('#creator-phase')?.textContent,
  editTitle: document.querySelector('#challenge-title')?.value,
  lossButtonPresent: Boolean(document.querySelector('[data-action="mark-negative"]')),
  deleteButtonVisible: document.querySelector('#delete-step')?.offsetParent !== null,
})`));

await evaluate(`document.querySelector('[data-route="board-setup"]').click()`);
await new Promise((resolve) => setTimeout(resolve, 150));
await evaluate(`document.querySelector('#start-party').click()`);
await new Promise((resolve) => setTimeout(resolve, 1500));
for (let roll = 0; roll < 4; roll++) {
  await evaluate(`document.querySelector('#roll-dice').click()`);
  await new Promise((resolve) => setTimeout(resolve, 4000));
}
report.push(await evaluate(`(() => ({
  route: document.body.dataset.route,
  boardSpaces: document.querySelectorAll('.board-space').length,
  playerTokens: document.querySelectorAll('.player-token').length,
  pendingMiniGame: document.querySelector('#pending-title')?.textContent,
  calloutVisible: !document.querySelector('#minigame-callout')?.classList.contains('hidden'),
}))()`));
const boardShot = await command("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
fs.writeFileSync("/private/tmp/starlight-board.png", Buffer.from(boardShot.data, "base64"));

await evaluate(`document.querySelector('#launch-pending').click()`);
await new Promise((resolve) => setTimeout(resolve, 2000));
report.push(await evaluate(`(() => {
  const canvas = document.querySelector('#screen');
  const pixels = canvas.getContext('2d').getImageData(0, 0, canvas.width, canvas.height).data;
  let nonBlack = 0;
  for (let index = 0; index < pixels.length; index += 400) if (pixels[index] || pixels[index + 1] || pixels[index + 2]) nonBlack++;
  return {
    route: document.body.dataset.route,
    challengeTitle: document.querySelector('#play-title')?.textContent,
    canvas: [canvas.width, canvas.height],
    renderedPixelSamples: nonBlack,
    timer: document.querySelector('#timer-pill')?.textContent,
  };
})()`));
const playShot = await command("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
fs.writeFileSync("/private/tmp/starlight-play.png", Buffer.from(playShot.data, "base64"));
if (process.env.AUDIT_TIMEOUT === "1") {
  await new Promise((resolve) => setTimeout(resolve, 16000));
  report.push(await evaluate(`({
    timerExpired: document.querySelector('#timer-pill')?.textContent === '0s',
    resultTitle: document.querySelector('#result-title')?.textContent,
    retryVisible: !document.querySelector('#retry-game')?.classList.contains('hidden'),
  })`));
}

await evaluate(`document.querySelector('[data-route="board-setup"]').click()`);
await new Promise((resolve) => setTimeout(resolve, 150));
await evaluate(`document.querySelector('#setup-progress [data-step="3"]').click()`);
await new Promise((resolve) => setTimeout(resolve, 100));
await evaluate(`document.querySelector('[data-select-board="gearbolt-station"]').click()`);
await evaluate(`document.querySelector('#setup-progress [data-step="6"]').click()`);
await new Promise((resolve) => setTimeout(resolve, 100));
await evaluate(`document.querySelector('#start-party').click()`);
await new Promise((resolve) => setTimeout(resolve, 500));
report.push(await evaluate(`({
  robotBoardRoute: document.body.dataset.route,
  robotBoardBackground: getComputedStyle(document.querySelector('#board-stage')).backgroundImage.includes('gearbolt-station.webp'),
  robotBoardSpaces: document.querySelectorAll('.board-space').length,
  characterTokens: document.querySelectorAll('.token-character').length,
  starVendorVisible: document.querySelector('#star-vendor').offsetParent !== null,
})`));
const robotBoardShot = await command("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
fs.writeFileSync("/private/tmp/starlight-robot-board.png", Buffer.from(robotBoardShot.data, "base64"));

await command("Emulation.setDeviceMetricsOverride", { width: 390, height: 844, deviceScaleFactor: 1, mobile: true });
await evaluate(`document.querySelector('[data-route="home"]').click()`);
await new Promise((resolve) => setTimeout(resolve, 200));
report.push(await evaluate(`({
  mobileRoute: document.body.dataset.route,
  viewport: [innerWidth, innerHeight],
  overflowX: document.documentElement.scrollWidth - innerWidth,
  modeCards: document.querySelectorAll('.mode-card').length,
})`));
const mobileShot = await command("Page.captureScreenshot", { format: "png", captureBeyondViewport: false });
fs.writeFileSync("/private/tmp/starlight-mobile.png", Buffer.from(mobileShot.data, "base64"));

socket.close();
console.log(JSON.stringify({ report, errors }, null, 2));
if (errors.length) process.exitCode = 1;
