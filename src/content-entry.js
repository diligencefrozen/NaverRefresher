(() => {
  const NF = globalThis.NaverFocus;
  if (!NF) return;

  let currentSettings = null;

  async function waitForRoot() {
    if (document.documentElement) return;
    await new Promise((resolve) => {
      const done = () => {
        if (!document.documentElement) return;
        document.removeEventListener("readystatechange", done);
        resolve();
      };
      document.addEventListener("readystatechange", done);
      done();
    });
  }

  async function boot() {
    await waitForRoot();
    currentSettings = await NF.storage.getSettings();
    await NF.cleaner?.init?.(currentSettings);
    NF.comments?.init?.(currentSettings);
    await NF.news?.init?.(currentSettings);
    NF.home?.init?.(currentSettings);
  }

  chrome.storage.onChanged.addListener(async (changes, area) => {
    if (area !== "local" || !changes[NF.KEYS.settings]) return;
    currentSettings = await NF.storage.getSettings();
    NF.cleaner?.update?.(currentSettings);
    NF.comments?.update?.(currentSettings);
    NF.news?.update?.(currentSettings);
    NF.home?.update?.(currentSettings);
  });

  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (message?.type === "NF_PING") {
      sendResponse({ ok: true, version: NF.VERSION, host: location.hostname });
      return false;
    }
    if (message?.type === "NF_START_PICKER") {
      NF.cleaner?.startPicker?.();
      sendResponse({ ok: true });
      return false;
    }
    return undefined;
  });

  void boot();
})();
