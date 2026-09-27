(() => {
  const NF = globalThis.NaverFocus;
  if (!NF || NF.news) return;

  let settings = null;
  let compiledKeywords = [];
  let intersectionObserver = null;
  let unsubscribeDom = null;
  const processedAnchors = new WeakSet();
  const articleByAnchor = new WeakMap();
  const entriesByArticle = new Map();
  const requestedArticles = new Set();
  const articleTexts = new Map();
  const listMatchesByArticle = new Map();
  const recordedBlocks = new Set();

  const filteringEnabled = () => !!settings?.enabled && !!settings?.newsFilterEnabled;
  const deepScanEnabled = () => filteringEnabled() && !!settings?.deepScanEnabled;

  function hideCard(card, match, source) {
    if (!(card instanceof Element)) return;
    card.setAttribute("data-nf-news-hidden", "1");
    card.setAttribute("data-nf-match", match.raw);
    card.setAttribute("data-nf-news-source", source);
  }

  function showCard(card) {
    if (!(card instanceof Element)) return;
    card.removeAttribute("data-nf-news-hidden");
    card.removeAttribute("data-nf-match");
    card.removeAttribute("data-nf-news-source");
  }

  function recordBlock(entry, match, source) {
    const marker = `${source}:${entry.article.key}:${match.raw}`;
    if (recordedBlocks.has(marker)) return;
    recordedBlocks.add(marker);
    void NF.storage.addRecentBlock({
      title: NF.newsDom.cardTitle(entry.card, entry.anchor),
      url: entry.article.url,
      keyword: match.raw,
      source
    });
  }

  function registerEntry(article, anchor, card) {
    let entries = entriesByArticle.get(article.key);
    if (!entries) {
      entries = new Map();
      entriesByArticle.set(article.key, entries);
    }
    const entry = { article, anchor, card };
    entries.set(card, entry);
    articleByAnchor.set(anchor, article);
    return entry;
  }

  function applyEntry(entry, articleText = null) {
    if (!entry.card.isConnected) return;
    if (!filteringEnabled()) {
      showCard(entry.card);
      return;
    }

    const knownListMatch = listMatchesByArticle.get(entry.article.key);
    if (knownListMatch) {
      hideCard(entry.card, knownListMatch, "list");
      recordBlock(entry, knownListMatch, "list");
      return;
    }

    const listMatch = NF.keywordMatcher.match(NF.newsDom.listText(entry.card, entry.anchor), compiledKeywords);
    if (listMatch) {
      listMatchesByArticle.set(entry.article.key, listMatch);
      for (const duplicate of entriesByArticle.get(entry.article.key)?.values() || []) {
        hideCard(duplicate.card, listMatch, "list");
        recordBlock(duplicate, listMatch, "list");
      }
      return;
    }

    if (articleText !== null && deepScanEnabled()) {
      const articleMatch = NF.keywordMatcher.match(articleText, compiledKeywords);
      if (articleMatch) {
        hideCard(entry.card, articleMatch, "article-body");
        recordBlock(entry, articleMatch, "article-body");
        return;
      }
    }
    showCard(entry.card);
  }

  function applyArticleResult(key, text) {
    articleTexts.set(key, text);
    const entries = entriesByArticle.get(key);
    if (!entries) return;
    for (const [card, entry] of entries) {
      if (!card.isConnected) entries.delete(card);
      else applyEntry(entry, text);
    }
    if (!entries.size) entriesByArticle.delete(key);
  }

  function requestArticle(article) {
    if (!deepScanEnabled() || listMatchesByArticle.has(article.key) || requestedArticles.has(article.key)) return;
    requestedArticles.add(article.key);
    NF.articleScan.request(article, (text) => applyArticleResult(article.key, text));
  }

  function observeEntry(entry) {
    const knownText = articleTexts.get(entry.article.key);
    applyEntry(entry, knownText === undefined ? null : knownText);
    if (entry.card.hasAttribute("data-nf-news-hidden") || !deepScanEnabled() || knownText !== undefined) return;
    if (intersectionObserver) intersectionObserver.observe(entry.anchor);
    else requestArticle(entry.article);
  }

  function scan(root = document, force = false) {
    for (const anchor of NF.newsDom.findAnchors(root)) {
      const article = NF.newsDom.parseArticle(anchor);
      if (!article || (!force && processedAnchors.has(anchor))) continue;
      processedAnchors.add(anchor);
      observeEntry(registerEntry(article, anchor, NF.newsDom.pickCard(anchor)));
    }
  }

  function setupIntersectionObserver() {
    intersectionObserver?.disconnect();
    intersectionObserver = null;
    if (!("IntersectionObserver" in window) || !deepScanEnabled()) return;
    intersectionObserver = new IntersectionObserver((entries) => {
      for (const observed of entries) {
        if (!observed.isIntersecting) continue;
        intersectionObserver.unobserve(observed.target);
        const article = articleByAnchor.get(observed.target) || NF.newsDom.parseArticle(observed.target);
        if (article) requestArticle(article);
      }
    }, { rootMargin: "900px 0px" });
  }

  function resetCards() {
    for (const card of document.querySelectorAll('[data-nf-news-hidden], [data-nf-news-source], [data-nf-match]')) showCard(card);
    entriesByArticle.clear();
    requestedArticles.clear();
    listMatchesByArticle.clear();
  }

  function subscribeToDom() {
    unsubscribeDom?.();
    unsubscribeDom = NF.domBus.subscribe("news", (records) => {
      for (const record of records) {
        for (const node of record.addedNodes || []) {
          if (node instanceof Element) scan(node);
        }
      }
      NF.articleGuard.run();
    });
  }

  async function init(initialSettings) {
    settings = initialSettings;
    compiledKeywords = NF.keywordMatcher.compile(settings?.blockedKeywords);
    await NF.articleScan.init(deepScanEnabled());
    setupIntersectionObserver();
    scan(document);
    NF.articleGuard.init(settings);
    if (filteringEnabled()) subscribeToDom();
  }

  function update(nextSettings) {
    settings = nextSettings;
    compiledKeywords = NF.keywordMatcher.compile(settings?.blockedKeywords);
    NF.articleScan.update(deepScanEnabled());
    resetCards();
    setupIntersectionObserver();
    scan(document, true);
    NF.articleGuard.update(settings);
    if (filteringEnabled()) subscribeToDom();
    else {
      unsubscribeDom?.();
      unsubscribeDom = null;
    }
  }

  function destroy() {
    unsubscribeDom?.();
    unsubscribeDom = null;
    intersectionObserver?.disconnect();
    intersectionObserver = null;
    resetCards();
    articleTexts.clear();
    NF.articleScan.destroy();
    NF.articleGuard.destroy();
    settings = null;
  }

  NF.news = Object.freeze({ init, update, destroy });
})();
