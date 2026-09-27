(() => {
  const NF = globalThis.NaverFocus;
  if (!NF || NF.newsDom) return;

  const ARTICLE_HOST = /(^|\.)news\.naver\.com$/i;
  const CARD_SELECTORS = [
    ".sa_item_flex",
    ".cjs_news_tw",
    "[class*='cc_item']",
    "div[class*='cc_text']",
    "li[class*='sa_item']",
    "li[class*='ranking']",
    "li[class*='news_item']",
    "li[class*='list_item']",
    ".news_area",
    "div[class*='news_wrap']",
    "article",
    "li"
  ];
  const TITLE_SELECTORS = ".sa_text_title, .sa_text_strong, a.cc_text_a[href], a.list_title[href], a[href*='news.naver.com'][class*='title']";
  const LEDE_SELECTORS = ".sa_text_lede, [class*='lede'], [class*='summary']";
  const ARTICLE_TITLE_SELECTORS = "#title_area, .media_end_head_headline";
  const ARTICLE_BODY_SELECTORS = "#dic_area, #newsct_article, .newsct_article, ._article_body, ._article_content, article";

  function parseArticle(anchor) {
    if (!(anchor instanceof HTMLAnchorElement) || anchor.closest("[data-nf-owned]")) return null;
    try {
      const url = new URL(anchor.href, location.href);
      if (!ARTICLE_HOST.test(url.hostname)) return null;

      const pathMatch = url.pathname.match(/(?:\/mnews)?\/article\/(\d{3})\/(\d+)/i);
      const oid = pathMatch?.[1] || url.searchParams.get("oid") || "";
      const aid = pathMatch?.[2] || url.searchParams.get("aid") || "";
      if (oid && aid) return { key: `${oid}:${aid}`, url: url.href, oid, aid };

      if (!/read|article/i.test(url.pathname + url.search)) return null;
      url.hash = "";
      return { key: url.href, url: url.href, oid: "", aid: "" };
    } catch (_) {
      return null;
    }
  }

  function findAnchors(root = document) {
    const base = root instanceof Element || root instanceof Document ? root : document;
    const anchors = [];
    if (base instanceof HTMLAnchorElement) anchors.push(base);
    anchors.push(...(base.querySelectorAll?.("a[href]") || []));
    return anchors;
  }

  function pickCard(anchor) {
    for (const selector of CARD_SELECTORS) {
      const card = anchor.closest(selector);
      if (!card || card.closest("[data-nf-owned]")) continue;
      const height = card.getBoundingClientRect().height;
      if (!height || height < 700) return card;
    }
    return anchor;
  }

  function textFromSelectors(card, selectors) {
    const values = [];
    for (const node of card.querySelectorAll?.(selectors) || []) {
      const text = NF.keywordMatcher.normalize(node.textContent);
      if (text && !values.includes(text)) values.push(text);
    }
    return values.join(" ");
  }

  function listText(card, anchor) {
    const title = textFromSelectors(card, TITLE_SELECTORS) || NF.keywordMatcher.normalize(anchor?.textContent);
    const lede = textFromSelectors(card, LEDE_SELECTORS);
    return NF.keywordMatcher.normalize(`${title} ${lede}`);
  }

  function cardTitle(card, anchor) {
    return (textFromSelectors(card, TITLE_SELECTORS) || NF.keywordMatcher.normalize(anchor?.textContent) || "기사").slice(0, 180);
  }

  function firstText(root, selectors) {
    for (const selector of selectors.split(",")) {
      const text = root.querySelector(selector.trim())?.textContent;
      if (NF.keywordMatcher.normalize(text)) return text;
    }
    return "";
  }

  function extractArticleText(html) {
    try {
      const doc = new DOMParser().parseFromString(String(html || ""), "text/html");
      const title = firstText(doc, ARTICLE_TITLE_SELECTORS);
      const body = firstText(doc, ARTICLE_BODY_SELECTORS);
      return NF.keywordMatcher.normalize(`${title} ${body}`);
    } catch (_) {
      return "";
    }
  }

  function isArticlePage() {
    return /(?:\/mnews)?\/article\/\d{3}\/\d+/i.test(location.pathname)
      || !!document.querySelector("#dic_area, #newsct_article");
  }

  function articlePageText() {
    const title = firstText(document, ARTICLE_TITLE_SELECTORS);
    const body = firstText(document, ARTICLE_BODY_SELECTORS);
    return NF.keywordMatcher.normalize(`${title} ${body}`);
  }

  NF.newsDom = Object.freeze({
    parseArticle,
    findAnchors,
    pickCard,
    listText,
    cardTitle,
    extractArticleText,
    isArticlePage,
    articlePageText
  });
})();
