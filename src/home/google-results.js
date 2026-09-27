(() => {
  const NF = globalThis.NaverFocus;
  if (!NF || NF.googleResults) return;

  const ROOT_ID = "nf-google-results-shell";
  let settings = null;
  let observer = null;

  function ensureObserver() {
    if (observer) return;
    observer = new MutationObserver(() => {
      const results = NF.googleResultsDom.resultsRoot();
      if (!document.getElementById(ROOT_ID)
        || NF.googleResultsDom.query() !== document.querySelector(`#${ROOT_ID} input`)?.value
        || (results && !results.hasAttribute("data-nf-google-results"))) render();
    });
    observer.observe(document.documentElement, { childList: true, subtree: true });
  }

  function buildShell() {
    let root = document.getElementById(ROOT_ID);
    if (root) return root;
    root = document.createElement("header");
    root.id = ROOT_ID;
    root.setAttribute("data-nf-owned", "1");
    root.innerHTML = `
      <a href="https://www.naver.com/">NaverRefresher</a>
      <form action="https://www.google.com/search" method="get">
        <input name="q" type="search" aria-label="Google 검색" autocomplete="off">
        <button type="submit">검색</button>
      </form>
      <span>Google 검색 결과</span>`;
    (document.body || document.documentElement).prepend(root);
    return root;
  }

  function render() {
    if (!settings?.enabled || !settings?.focusHomeEnabled) {
      destroyView();
      return;
    }
    const root = buildShell();
    root.querySelector('input[name="q"]').value = NF.googleResultsDom.query();
    document.documentElement.classList.add("nf-google-results-active");
    document.querySelector('[data-nf-google-results="1"]')?.removeAttribute("data-nf-google-results");
    NF.googleResultsDom.resultsRoot()?.setAttribute("data-nf-google-results", "1");
    ensureObserver();
  }

  function destroyView() {
    observer?.disconnect();
    observer = null;
    document.getElementById(ROOT_ID)?.remove();
    document.documentElement.classList.remove("nf-google-results-active");
    document.querySelector('[data-nf-google-results="1"]')?.removeAttribute("data-nf-google-results");
  }

  async function init() {
    settings = await NF.storage.getSettings();
    render();
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== "local" || !changes[NF.KEYS.settings]) return;
      void NF.storage.getSettings().then((next) => { settings = next; render(); });
    });
  }

  NF.googleResults = Object.freeze({ init, update(next) { settings = next; render(); }, destroy: destroyView });
  void init();
})();
