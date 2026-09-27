const KEY = "nf.settings.v1";
const DEFAULTS = {
  enabled: true,
  newsFilterEnabled: true,
  deepScanEnabled: true,
  articlePageGuardEnabled: true,
  commentBlockEnabled: true,
  commentHoverHintEnabled: true,
  commentRightClickEnabled: true,
  cleanerEnabled: true,
  focusHomeEnabled: false,
  blockedKeywords: [],
  blockedUsers: [],
  hiddenSelectorsByHost: {}
};

let settings = null;
let activeTab = null;

async function read() {
  const data = await chrome.storage.local.get({ [KEY]: null });
  return { ...DEFAULTS, ...(data[KEY] || {}) };
}

async function patch(patchValue) {
  settings = { ...settings, ...patchValue };
  await chrome.storage.local.set({ [KEY]: settings });
  render();
}

function isNaverUrl(url) {
  try { return /(^|\.)naver\.com$/i.test(new URL(url).hostname); } catch (_) { return false; }
}

function render() {
  document.getElementById("enabled").checked = !!settings.enabled;
  document.querySelectorAll("[data-setting]").forEach((input) => {
    input.checked = !!settings[input.dataset.setting];
  });
  document.body.classList.toggle("disabled", !settings.enabled);
  document.getElementById("statusText").textContent = settings.enabled ? "활성화됨" : "일시 중지";
  document.getElementById("keywordCount").textContent = settings.blockedKeywords?.length || 0;
  document.getElementById("userCount").textContent = settings.blockedUsers?.length || 0;
  const host = (() => { try { return new URL(activeTab?.url || "").hostname; } catch (_) { return ""; } })();
  document.getElementById("hiddenCount").textContent = settings.hiddenSelectorsByHost?.[host]?.length || 0;
  document.getElementById("host").textContent = host || "네이버 개인화 필터";
  document.getElementById("pickElement").disabled = !isNaverUrl(activeTab?.url || "");
}

async function addKeyword() {
  const input = document.getElementById("keywordInput");
  const value = input.value.replace(/\s+/g, " ").trim();
  if (!value) return;
  const exists = settings.blockedKeywords.some((item) => item.toLocaleLowerCase("ko-KR") === value.toLocaleLowerCase("ko-KR"));
  if (!exists) await patch({ blockedKeywords: [...settings.blockedKeywords, value] });
  input.value = "";
}

async function start() {
  [activeTab] = await chrome.tabs.query({ active: true, currentWindow: true });
  settings = await read();
  render();

  document.getElementById("enabled").addEventListener("change", (event) => patch({ enabled: event.target.checked }));
  document.querySelectorAll("[data-setting]").forEach((input) => {
    input.addEventListener("change", (event) => patch({ [input.dataset.setting]: event.target.checked }));
  });
  document.getElementById("addKeyword").addEventListener("click", addKeyword);
  document.getElementById("keywordInput").addEventListener("keydown", (event) => {
    if (event.key === "Enter") void addKeyword();
  });
  document.getElementById("openOptions").addEventListener("click", () => chrome.runtime.openOptionsPage());
  document.getElementById("pickElement").addEventListener("click", async () => {
    if (!activeTab?.id) return;
    await chrome.tabs.sendMessage(activeTab.id, { type: "NF_START_PICKER" }).catch(() => {});
    window.close();
  });
}

void start();
