(() => {
  const NF = globalThis.NaverFocus;
  if (!NF || NF.news) return;

  let settings = null;
  let observer = null;
  let queueRunning = false;
  const queued = [];
  const queuedUrls = new Set();
  const processedAnchors = new WeakSet();
  const visibleOnceUrls = new Set();
  let cache = {};
  let cacheSaveTimer = null;
  let articleGuardShown = false;

  function normalizeText(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function normalizedKeywords() {
    return (settings?.blockedKeywords || [])
      .map((raw) => ({ raw, lower: normalizeText(raw).toLocaleLowerCase("ko-KR") }))
      .filter((item) => item.lower);
  }

  function findMatch(text) {
    const haystack = normalizeText(text).toLocaleLowerCase("ko-KR");
    if (!haystack) return null;
    return normalizedKeywords().find((item) => haystack.includes(item.lower)) || null;
  }

  function articleUrlFromAnchor(anchor) {
    if (!(anchor instanceof HTMLAnchorElement)) return "";
    try {
      const url = new URL(anchor.href, location.href);
      if (!/naver\.com$/i.test(url.hostname) && !/\.naver\.com$/i.test(url.hostname)) return "";
      if (/\/article\/\d{3}\/\d+/i.test(url.pathname)) return url.href;
      if (/news\.naver\.com/i.test(url.hostname) && /read|article/i.test(url.pathname + url.search)) return url.href;
      return "";
    } catch (_) {
      return "";
    }
  }

  function pickCard(anchor) {
    const selectors = [
      "li[class*='report_item']",
      "li[class*='info_item']",
      "li[class*='news_item']",
      "li[class*='item']",
      "article",
      "li",
      "div[class*='news_box']",
      "div[class*='item']"
    ];
    for (const selector of selectors) {
      const node = anchor.closest(selector);
      if (!node) continue;
      const rect = node.getBoundingClientRect();
      if (rect.height > 0 && rect.height < 650) return node;
      if (!rect.height) return node;
    }
    return anchor;
  }

  function cardTitle(card, anchor) {
    const titleNode = card.querySelector?.("[class*='title'], strong, h1, h2, h3") || anchor;
    return normalizeText(titleNode?.textContent || anchor?.textContent || "기사").slice(0, 180);
  }

  async function recordBlock(card, anchor, match, source) {
    const url = articleUrlFromAnchor(anchor) || anchor?.href || location.href;
    const title = cardTitle(card, anchor);
    const marker = `${source}:${url}:${match.raw}`;
    if (visibleOnceUrls.has(marker)) return;
    visibleOnceUrls.add(marker);
    await NF.storage.addRecentBlock({ title, url, keyword: match.raw, source });
  }

  function hideCard(card, match) {
    if (!(card instanceof Element)) return;
    card.setAttribute("data-nf-news-hidden", "1");
    card.setAttribute("data-nf-match", match.raw);
  }

  function showCard(card) {
    if (!(card instanceof Element)) return;
    card.removeAttribute("data-nf-news-hidden");
    card.removeAttribute("data-nf-match");
  }

  function pruneCache() {
    const now = Date.now();
    const entries = Object.entries(cache)
      .filter(([, value]) => value && now - Number(value.at || 0) < NF.ARTICLE_CACHE_TTL_MS)
      .sort((a, b) => Number(b[1].at || 0) - Number(a[1].at || 0))
      .slice(0, NF.ARTICLE_CACHE_MAX);
    cache = Object.fromEntries(entries);
  }

  function scheduleCacheSave() {
    if (cacheSaveTimer) return;
    cacheSaveTimer = setTimeout(() => {
      cacheSaveTimer = null;
      pruneCache();
      chrome.storage.local.set({ [NF.KEYS.articleCache]: cache });
    }, 700);
  }

  function extractArticleText(html) {
    try {
      const doc = new DOMParser().parseFromString(String(html || ""), "text/html");
      const title = doc.querySelector("#title_area, .media_end_head_headline, h2#title_area, h1")?.textContent || "";
      const body = doc.querySelector("#dic_area, #newsct_article, .news_end, article")?.textContent || "";
      const byline = doc.querySelector(".media_end_head_journalist, .byline, .journalistcard_summary_name")?.textContent || "";
      return normalizeText(`${title} ${byline} ${body}`);
    } catch (_) {
      return "";
    }
  }

  async function fetchArticleText(url) {
    const existing = cache[url];
    if (existing && Date.now() - Number(existing.at || 0) < NF.ARTICLE_CACHE_TTL_MS) return existing.text || "";

    const result = await chrome.runtime.sendMessage({ type: "NF_FETCH_ARTICLE", url }).catch(() => null);
    if (!result?.ok || !result.html) return "";
    const text = extractArticleText(result.html);
    cache[url] = { text, at: Date.now() };
    scheduleCacheSave();
    return text;
  }

  async function runQueue() {
    if (queueRunning) return;
    queueRunning = true;
    try {
      while (queued.length) {
        const item = queued.shift();
        queuedUrls.delete(item.url);
        if (!settings?.enabled || !settings?.newsFilterEnabled || !settings?.deepScanEnabled) continue;
        if (!item.card?.isConnected) continue;

        const text = await fetchArticleText(item.url);
        const match = findMatch(text);
        if (match) {
          hideCard(item.card, match);
          void recordBlock(item.card, item.anchor, match, "article-body");
        }
      }
    } finally {
      queueRunning = false;
      if (queued.length) setTimeout(runQueue, 120);
    }
  }

  function enqueue(anchor, card, url) {
    if (!url || queuedUrls.has(url)) return;
    queuedUrls.add(url);
    queued.push({ anchor, card, url });
    void runQueue();
  }

  function observeAnchor(anchor) {
    const url = articleUrlFromAnchor(anchor);
    if (!url) return;
    const card = pickCard(anchor);
    if (!settings?.enabled || !settings?.newsFilterEnabled) {
      showCard(card);
      return;
    }

    const immediate = findMatch(card.textContent || anchor.textContent || "");
    if (immediate) {
      hideCard(card, immediate);
      void recordBlock(card, anchor, immediate, "list");
      return;
    }

    showCard(card);
    if (!settings?.deepScanEnabled) return;
    if (observer) observer.observe(anchor);
    else enqueue(anchor, card, url);
  }

  function scan(root = document, force = false) {
    const base = root instanceof Element || root instanceof Document ? root : document;
    const anchors = [];
    if (base instanceof HTMLAnchorElement) anchors.push(base);
    anchors.push(...base.querySelectorAll?.("a[href]") || []);
    for (const anchor of anchors) {
      if (!articleUrlFromAnchor(anchor)) continue;
      if (!force && processedAnchors.has(anchor)) continue;
      processedAnchors.add(anchor);
      observeAnchor(anchor);
    }
  }

  function setupObserver() {
    observer?.disconnect();
    observer = null;
    if (!("IntersectionObserver" in window)) return;
    observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        observer.unobserve(entry.target);
        const anchor = entry.target;
        const url = articleUrlFromAnchor(anchor);
        if (!url) continue;
        enqueue(anchor, pickCard(anchor), url);
      }
    }, { rootMargin: "900px 0px" });
  }

  function isArticlePage() {
    return /\/article\/\d{3}\/\d+/i.test(location.pathname) || !!document.querySelector("#dic_area, #newsct_article");
  }

  function articlePageText() {
    const title = document.querySelector("#title_area, .media_end_head_headline, h1")?.textContent || "";
    const body = document.querySelector("#dic_area, #newsct_article, .news_end, article")?.textContent || "";
    const byline = document.querySelector(".media_end_head_journalist, .byline")?.textContent || "";
    return normalizeText(`${title} ${byline} ${body}`);
  }

  function removeGuard() {
    document.getElementById("nf-article-guard")?.remove();
  }

  function showArticleGuard(match) {
    if (articleGuardShown || document.getElementById("nf-article-guard")) return;
    articleGuardShown = true;
    const layer = document.createElement("div");
    layer.id = "nf-article-guard";
    layer.setAttribute("data-nf-owned", "1");
    layer.innerHTML = `
      <div class="nf-article-guard-card">
        <div class="nf-article-guard-mark">NF</div>
        <h2>이 기사는 숨김 설정과 일치합니다.</h2>
        <p>기사 본문에서 <strong></strong> 키워드를 발견했습니다.</p>
        <div class="nf-article-guard-actions">
          <button type="button" data-action="back">뒤로 가기</button>
          <button type="button" data-action="show" class="primary">이번만 보기</button>
        </div>
      </div>`;
    layer.querySelector("strong").textContent = match.raw;
    layer.querySelector('[data-action="back"]').addEventListener("click", () => history.back());
    layer.querySelector('[data-action="show"]').addEventListener("click", () => removeGuard());
    document.documentElement.appendChild(layer);
    void NF.storage.addRecentBlock({
      title: normalizeText(document.title),
      url: location.href,
      keyword: match.raw,
      source: "article-page"
    });
  }

  function runArticleGuard() {
    if (!settings?.enabled || !settings?.newsFilterEnabled || !settings?.articlePageGuardEnabled || !isArticlePage()) {
      removeGuard();
      return;
    }
    const match = findMatch(articlePageText());
    if (match) showArticleGuard(match);
  }

  NF.news = Object.freeze({
    async init(initialSettings) {
      settings = initialSettings;
      const data = await chrome.storage.local.get({ [NF.KEYS.articleCache]: {} });
      cache = data[NF.KEYS.articleCache] && typeof data[NF.KEYS.articleCache] === "object" ? data[NF.KEYS.articleCache] : {};
      pruneCache();
      setupObserver();
      scan(document);
      runArticleGuard();
      NF.domBus.subscribe("news", (records) => {
        for (const record of records) {
          for (const node of record.addedNodes || []) {
            if (node instanceof Element) scan(node);
          }
        }
        runArticleGuard();
      });
    },
    update(nextSettings) {
      settings = nextSettings;
      setupObserver();
      scan(document, true);
      runArticleGuard();
    }
  });
})();
