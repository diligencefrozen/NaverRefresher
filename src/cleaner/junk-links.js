(() => {
  const NF = globalThis.NaverFocus;
  if (!NF || NF.junkLinks) return;

  const HIDDEN_ATTRIBUTE = "data-nf-junk-hidden";
  const TARGET_PATHS = Object.freeze({
    "media.naver.com": new Set(["/algorithm", "/channel/settings"]),
    "news.naver.com": new Set(["/ombudsman/guidecenter"])
  });
  let settings = null;
  let unsubscribeDom = null;

  function hideSubscriptionAside(base) {
    const wrapperSelector = ".news_common_aside_wrapper._aside_wrapper";
    const fallbackSelector = ".news_common_aside._contents, .subscriptionlist";
    const wrappers = new Set();
    if (base instanceof Element) {
      if (base.matches(wrapperSelector)) wrappers.add(base);
      const containingWrapper = base.closest(wrapperSelector);
      if (containingWrapper) wrappers.add(containingWrapper);
    }
    for (const wrapper of base.querySelectorAll?.(wrapperSelector) || []) wrappers.add(wrapper);
    for (const wrapper of wrappers) wrapper.setAttribute(HIDDEN_ATTRIBUTE, "subscription-aside");

    const fallbacks = new Set();
    if (base instanceof Element && base.matches(fallbackSelector)) fallbacks.add(base);
    for (const node of base.querySelectorAll?.(fallbackSelector) || []) fallbacks.add(node);
    for (const node of fallbacks) {
      if (!node.closest(wrapperSelector)) node.setAttribute(HIDDEN_ATTRIBUTE, "subscription-aside-fallback");
    }
  }

  function targetKind(anchor) {
    if (!(anchor instanceof HTMLAnchorElement)) return "";
    try {
      const url = new URL(anchor.href, location.href);
      if (anchor.getAttribute("data-nlog-area") === "gnb.premium" && url.hostname === "contents.premium.naver.com") return "premium";
      if (url.hostname === "contents.premium.naver.com") return "premium";
      const paths = TARGET_PATHS[url.hostname];
      const pathname = url.pathname.replace(/\/+$/, "") || "/";
      if (!paths?.has(pathname)) return "";
      if (pathname === "/ombudsman/guidecenter") return "guidecenter";
      if (pathname === "/channel/settings") return "channel-settings";
      return "algorithm";
    } catch (_) {
      return "";
    }
  }

  function hideTargetFor(anchor, kind) {
    if (kind === "premium" && (anchor.getAttribute("data-nlog-area") === "gnb.premium" || anchor.closest("nav, [class*='gnb']"))) return anchor;
    if (kind === "algorithm" || kind === "premium") {
      const sideBanner = anchor.closest(".ct_snb_banner");
      if (sideBanner) return sideBanner;
    }
    const columnBanner = anchor.closest(".col2_banner");
    if (columnBanner) return columnBanner;
    if (kind === "guidecenter") return anchor.closest(".col2_banner_inner") || null;
    return null;
  }

  function scan(root = document) {
    if (!settings?.enabled || !settings?.hideJunkLinks) return;
    const base = root instanceof Element || root instanceof Document ? root : document;
    hideSubscriptionAside(base);
    const anchors = [];
    if (base instanceof HTMLAnchorElement) anchors.push(base);
    anchors.push(...(base.querySelectorAll?.("a[href]") || []));
    for (const anchor of anchors) {
      const kind = targetKind(anchor);
      if (!kind) continue;
      hideTargetFor(anchor, kind)?.setAttribute(HIDDEN_ATTRIBUTE, kind);
    }
  }

  function restore() {
    for (const node of document.querySelectorAll(`[${HIDDEN_ATTRIBUTE}]`)) node.removeAttribute(HIDDEN_ATTRIBUTE);
  }

  function subscribe() {
    if (unsubscribeDom) return;
    unsubscribeDom = NF.domBus.subscribe("junk-links", (records) => {
      for (const record of records) {
        for (const node of record.addedNodes || []) {
          if (node instanceof Element) scan(node);
        }
      }
    });
  }

  function update(nextSettings) {
    settings = nextSettings;
    if (settings?.enabled && settings?.hideJunkLinks) {
      scan(document);
      subscribe();
    } else {
      unsubscribeDom?.();
      unsubscribeDom = null;
      restore();
    }
  }

  NF.junkLinks = Object.freeze({
    init(initialSettings) { update(initialSettings); },
    update,
    destroy() {
      unsubscribeDom?.();
      unsubscribeDom = null;
      settings = null;
      restore();
    }
  });
})();
