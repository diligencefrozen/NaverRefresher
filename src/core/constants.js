(() => {
  const NF = globalThis.NaverFocus = globalThis.NaverFocus || {};

  NF.VERSION = "0.1.0";
  NF.KEYS = Object.freeze({
    settings: "nf.settings.v1",
    articleCache: "nf.articleCache.v1",
    recentBlocks: "nf.recentBlocks.v1"
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
    focusHomeEnabled: false,
    blockedKeywords: [],
    blockedUsers: [],
    hiddenSelectorsByHost: {}
  });

  NF.ARTICLE_CACHE_TTL_MS = 7 * 24 * 60 * 60 * 1000;
  NF.ARTICLE_CACHE_MAX = 500;
  NF.RECENT_BLOCKS_MAX = 100;
})();
