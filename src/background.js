importScripts("core/constants.js", "core/storage.js");

const NF = globalThis.NaverFocus;

chrome.runtime.onInstalled.addListener(async () => {
  await NF.storage.setSettings(await NF.storage.getSettings());

  chrome.contextMenus.removeAll(() => {
    chrome.contextMenus.create({
      id: "nf-hide-element",
      title: "Naver Focus: 이 영역 숨기기",
      contexts: ["page", "link", "image", "selection"]
    });
    chrome.contextMenus.create({
      id: "nf-open-options",
      title: "Naver Focus 설정 열기",
      contexts: ["page"]
    });
  });
});

chrome.contextMenus.onClicked.addListener((info, tab) => {
  if (info.menuItemId === "nf-open-options") {
    chrome.runtime.openOptionsPage();
    return;
  }
  if (info.menuItemId === "nf-hide-element" && tab?.id) {
    chrome.tabs.sendMessage(tab.id, { type: NF.MESSAGE_TYPES.hideContextTarget }).catch(() => {});
  }
});

chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  if (message?.type !== NF.MESSAGE_TYPES.fetchArticle) return undefined;

  const url = String(message.url || "");
  if (!/^https:\/\/([a-z0-9-]+\.)*naver\.com\//i.test(url)) {
    sendResponse({ ok: false, error: "UNSUPPORTED_URL" });
    return false;
  }

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  fetch(url, {
    credentials: "omit",
    redirect: "follow",
    signal: controller.signal,
    headers: { "Accept": "text/html,application/xhtml+xml" }
  })
    .then(async (response) => {
      if (!response.ok) throw new Error(`HTTP_${response.status}`);
      const text = await response.text();
      return {
        ok: true,
        url: response.url,
        html: text.slice(0, 950000)
      };
    })
    .then(sendResponse)
    .catch((error) => sendResponse({ ok: false, error: error?.message || "FETCH_FAILED" }))
    .finally(() => clearTimeout(timeoutId));

  return true;
});
