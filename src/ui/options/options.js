const NF = globalThis.NaverFocus;

let settings = null;
let history = [];

async function load() {
  [settings, history] = await Promise.all([
    NF.storage.getSettings(),
    NF.storage.getRecentBlocks()
  ]);
  render();
}

async function save(patch) {
  settings = { ...settings, ...patch };
  settings = await NF.storage.setSettings(settings);
  render();
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

function renderKeywords() {
  const list = document.getElementById("keywordList");
  list.innerHTML = "";
  for (const keyword of settings.blockedKeywords || []) {
    const chip = el("div", "chip");
    chip.append(el("span", "", keyword));
    const remove = el("button", "", "×");
    remove.title = "삭제";
    remove.addEventListener("click", () => save({ blockedKeywords: settings.blockedKeywords.filter((item) => item !== keyword) }));
    chip.append(remove);
    list.append(chip);
  }
  document.getElementById("keywordCounter").textContent = settings.blockedKeywords?.length || 0;
}

function renderUsers() {
  const list = document.getElementById("userList");
  list.innerHTML = "";
  for (const user of settings.blockedUsers || []) {
    const row = el("div", "row-item");
    const text = el("div");
    text.append(el("b", "", user.label || user.value || "사용자"));
    text.append(el("small", "", `${user.kind || "id"} · ${user.value || user.key}`));
    const remove = el("button", "", "차단 해제");
    remove.addEventListener("click", () => save({ blockedUsers: settings.blockedUsers.filter((item) => item.key !== user.key) }));
    row.append(text, remove);
    list.append(row);
  }
  document.getElementById("userCounter").textContent = settings.blockedUsers?.length || 0;
}

function renderElements() {
  const list = document.getElementById("elementList");
  list.innerHTML = "";
  let count = 0;
  for (const [host, selectors] of Object.entries(settings.hiddenSelectorsByHost || {})) {
    for (const selector of selectors || []) {
      count += 1;
      const row = el("div", "row-item");
      const text = el("div");
      text.append(el("b", "", host));
      text.append(el("small", "", selector));
      const remove = el("button", "", "복원");
      remove.addEventListener("click", () => {
        const map = structuredClone(settings.hiddenSelectorsByHost || {});
        map[host] = (map[host] || []).filter((item) => item !== selector);
        if (!map[host].length) delete map[host];
        void save({ hiddenSelectorsByHost: map });
      });
      row.append(text, remove);
      list.append(row);
    }
  }
  document.getElementById("elementCounter").textContent = count;
}

function renderHistory() {
  const list = document.getElementById("historyList");
  list.innerHTML = "";
  for (const item of history.slice(0, 100)) {
    const row = el("div", "row-item");
    const text = el("div");
    text.append(el("b", "", item.title || "필터링된 기사"));
    const when = item.at ? new Date(item.at).toLocaleString("ko-KR") : "";
    text.append(el("small", "", `${item.keyword || ""} · ${item.source || ""} · ${when}`));
    const link = el("button", "", "주소 복사");
    link.addEventListener("click", () => navigator.clipboard.writeText(item.url || "").catch(() => {}));
    row.append(text, link);
    list.append(row);
  }
}

function render() {
  document.getElementById("enabled").checked = !!settings.enabled;
  document.querySelectorAll("[data-setting]").forEach((input) => { input.checked = !!settings[input.dataset.setting]; });
  renderKeywords();
  renderUsers();
  renderElements();
  renderHistory();
}

async function addKeyword() {
  const input = document.getElementById("keywordInput");
  settings = await NF.storage.addKeyword(input.value);
  input.value = "";
  render();
}

function exportData() {
  const payload = { format: "naver-focus-settings", version: 1, exportedAt: Date.now(), settings };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `naver-focus-settings-${new Date().toISOString().slice(0,10)}.json`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 500);
}

async function importFile(file) {
  const text = await file.text();
  const parsed = JSON.parse(text);
  const incoming = parsed?.settings && typeof parsed.settings === "object" ? parsed.settings : parsed;
  settings = await NF.storage.setSettings(incoming);
  render();
}

document.getElementById("enabled").addEventListener("change", (event) => save({ enabled: event.target.checked }));
document.querySelectorAll("[data-setting]").forEach((input) => input.addEventListener("change", (event) => save({ [input.dataset.setting]: event.target.checked })));
document.getElementById("addKeyword").addEventListener("click", addKeyword);
document.getElementById("keywordInput").addEventListener("keydown", (event) => { if (event.key === "Enter") void addKeyword(); });
document.getElementById("clearHistory").addEventListener("click", async () => { history = []; await NF.storage.clearRecentBlocks(); renderHistory(); });
document.getElementById("clearCache").addEventListener("click", async () => { await NF.storage.clearArticleCache(); });
document.getElementById("exportData").addEventListener("click", exportData);
document.getElementById("importData").addEventListener("click", () => document.getElementById("importFile").click());
document.getElementById("importFile").addEventListener("change", (event) => { const file = event.target.files?.[0]; if (file) void importFile(file); event.target.value = ""; });
document.getElementById("resetAll").addEventListener("click", async () => {
  settings = JSON.parse(JSON.stringify(NF.DEFAULT_SETTINGS));
  history = [];
  await NF.storage.resetAll();
  render();
});

void load();
