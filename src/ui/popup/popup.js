const NF = globalThis.NaverFocus;

let settings = null;
let activeTab = null;

async function read() {
  return NF.storage.getSettings();
}

async function patch(patchValue) {
  settings = { ...settings, ...patchValue };
  settings = await NF.storage.setSettings(settings);
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
  document.getElementById("pickElement").disabled = !isNaverUrl(activeTab?.url || "") || !settings.enabled || !settings.cleanerEnabled;
}

async function addKeyword() {
  const input = document.getElementById("keywordInput");
  settings = await NF.storage.addKeyword(input.value);
  input.value = "";
  render();
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
    const result = await chrome.tabs.sendMessage(activeTab.id, { type: NF.MESSAGE_TYPES.startPicker }).catch(() => null);
    if (result?.ok) window.close();
    else document.getElementById("pickElement").textContent = "요소 숨기기를 켠 뒤 다시 시도하세요";
  });
}

void start();
