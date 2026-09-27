(() => {
  const NF = globalThis.NaverFocus;
  if (!NF || NF.articleGuard) return;

  const GUARD_ID = "nf-article-guard";
  let settings = null;
  let dismissedMatch = "";
  let shownMatch = "";

  function remove() {
    document.getElementById(GUARD_ID)?.remove();
    shownMatch = "";
  }

  function show(match) {
    const signature = `${location.href}:${match.raw}`;
    if (dismissedMatch === signature) return;
    if (shownMatch === signature && document.getElementById(GUARD_ID)) return;
    remove();

    const layer = document.createElement("div");
    layer.id = GUARD_ID;
    layer.setAttribute("data-nf-owned", "1");
    layer.innerHTML = `
      <div class="nf-article-guard-card">
        <img class="nf-article-guard-mark" alt="">
        <h2>이 기사는 숨김 설정과 일치합니다.</h2>
        <p>기사 본문에서 <strong></strong> 키워드를 발견했습니다.</p>
        <div class="nf-article-guard-actions">
          <button type="button" data-action="back">뒤로 가기</button>
          <button type="button" data-action="show" class="primary">이번만 보기</button>
        </div>
      </div>`;
    layer.querySelector("strong").textContent = match.raw;
    layer.querySelector(".nf-article-guard-mark").src = chrome.runtime.getURL("icons/48.png");
    layer.querySelector('[data-action="back"]').addEventListener("click", () => history.back());
    layer.querySelector('[data-action="show"]').addEventListener("click", () => {
      dismissedMatch = signature;
      remove();
    });
    shownMatch = signature;
    document.documentElement.appendChild(layer);
    void NF.storage.addRecentBlock({
      title: NF.keywordMatcher.normalize(document.title),
      url: location.href,
      keyword: match.raw,
      source: "article-page"
    });
  }

  function run() {
    if (!settings?.enabled || !settings?.newsFilterEnabled || !settings?.articlePageGuardEnabled || !NF.newsDom.isArticlePage()) {
      remove();
      return;
    }
    const match = NF.keywordMatcher.match(
      NF.newsDom.articlePageText(),
      NF.keywordMatcher.compile(settings.blockedKeywords)
    );
    if (match) show(match);
    else remove();
  }

  NF.articleGuard = Object.freeze({
    init(initialSettings) { settings = initialSettings; run(); },
    update(nextSettings) { settings = nextSettings; run(); },
    run,
    destroy() { settings = null; dismissedMatch = ""; remove(); }
  });
})();
