const root = document.querySelector("#mini-game-maker");

const tools = {
  "moment-maker": {
    icon: "🎞️",
    kicker: "CAPTURE & TIMELINE",
    title: "MOMENT MAKER",
    copy: "Choose a cartridge, capture live gameplay, scrub the DVR timeline, and mark the exact moment your challenge begins.",
  },
  "multi-creator": {
    icon: "🕹️",
    kicker: "GOALS & RULES",
    title: "MINI-GAME DESIGNER",
    copy: "Teach win and loss conditions, tune the rules, test the challenge, and save it to the party library.",
  },
};

function selectedTool() {
  const requested = new URLSearchParams(location.search).get("tool");
  return tools[requested] ? requested : null;
}

function navigate(tool = null, push = true) {
  const url = tool ? `/mini-game-maker?tool=${encodeURIComponent(tool)}` : "/mini-game-maker";
  if (push) history.pushState({}, "", url);
  else history.replaceState({}, "", url);
  render();
}

function renderMenu() {
  return `<section class="maker-menu"><header><a href="/" class="maker-home">◀ MAIN MENU</a><small>STANDALONE CREATION APP</small><h1>MINI-GAME MAKER</h1><p>Choose the tool that matches what you want to create.</p></header><div class="maker-tool-grid">${Object.entries(tools).map(([id, tool]) => `<button type="button" data-tool="${id}" class="maker-tool-card"><span>${tool.icon}</span><div><small>${tool.kicker}</small><h2>${tool.title}</h2><p>${tool.copy}</p><em>OPEN TOOL ▶</em></div></button>`).join("")}</div></section>`;
}

function renderTool(toolId) {
  const tool = tools[toolId];
  return `<section class="maker-workspace"><header><button type="button" data-close-tool>◀ MINI-GAME MAKER</button><div><small>${tool.kicker}</small><b>${tool.title}</b></div><a href="/">MAIN MENU</a></header><iframe src="/?studioRoute=${encodeURIComponent(toolId)}" title="${tool.title}" allow="autoplay; gamepad" loading="eager"></iframe></section>`;
}

function render() {
  const tool = selectedTool();
  root.innerHTML = tool ? renderTool(tool) : renderMenu();
  requestAnimationFrame(() => root.querySelector("button, a")?.focus());
}

root.addEventListener("click", (event) => {
  const tool = event.target.closest("[data-tool]");
  if (tool) return navigate(tool.dataset.tool);
  if (event.target.closest("[data-close-tool]")) return navigate();
});

window.addEventListener("popstate", render);
if (location.pathname === "/party/mini-games" || location.pathname.includes("/editor/minigame")) navigate(selectedTool(), false);
else render();
