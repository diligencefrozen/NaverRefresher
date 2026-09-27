(() => {
  const NF = globalThis.NaverFocus = globalThis.NaverFocus || {};

  NF.VERSION = "9.1.1.2026";
  NF.KEYS = Object.freeze({
    settings: "nf.settings.v1",
    articleCache: "nf.articleCache.v1",
    recentBlocks: "nf.recentBlocks.v1"
  });

  NF.MESSAGE_TYPES = Object.freeze({
    fetchArticle: "NF_FETCH_ARTICLE",
    ping: "NF_PING",
    startPicker: "NF_START_PICKER",
    hideContextTarget: "NF_HIDE_CONTEXT_TARGET"
  });

  NF.DEFAULT_SETTINGS = Object.freeze({
    enabled: true,
    newsFilterEnabled: true,
    deepScanEnabled: true,
    articlePageGuardEnabled: true,
    commentBlockEnabled: true,
    commentHoverHintEnabled: true,
    commentRightClickEnabled: true,
    cleanerEnabled: true,
    hideJunkLinks: false,
    focusHomeEnabled: false,
    blockedKeywords: [],
    blockedUsers: [],
    hiddenSelectorsByHost: {}
  });

  NF.ARTICLE_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
  NF.ARTICLE_CACHE_MAX = 500;
  NF.RECENT_BLOCKS_MAX = 100;
})();
