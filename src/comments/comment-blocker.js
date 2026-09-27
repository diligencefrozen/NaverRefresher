(() => {
  const NF = globalThis.NaverFocus;
  if (!NF || NF.comments) return;

  let settings = null;
  let blockedUserKeys = new Set();
  let compiledKeywords = [];
  let unsubscribeDom = null;
  let listenersBound = false;
  let hoveredAuthor = null;

  function refreshMatchers() {
    blockedUserKeys = new Set((settings?.blockedUsers || []).map((item) => item?.key).filter(Boolean));
    compiledKeywords = NF.keywordMatcher.compile(settings?.blockedKeywords);
  }

  function applyToComment(comment) {
    const decision = NF.commentModel.getBlockDecision(
      comment,
      blockedUserKeys,
      compiledKeywords,
      !!settings?.enabled && !!settings?.commentBlockEnabled
    );
    NF.commentModel.applyVisibility(comment, decision.reasons);
  }

  function scan(root = document) {
    NF.commentModel.findComments(root).forEach(applyToComment);
  }

  async function toggleBlock(comment) {
    const identity = NF.commentModel.getIdentity(comment);
    if (!identity) {
      NF.ui.toast("사용자를 식별하지 못했습니다");
      return;
    }
    const isBlocked = blockedUserKeys.has(identity.key);
    settings = isBlocked
      ? await NF.storage.removeBlockedUser(identity.key)
      : await NF.storage.addBlockedUser(identity);
    refreshMatchers();
    scan(document);
    NF.ui.toast(isBlocked ? "사용자 차단을 해제했습니다" : "사용자를 차단했습니다", identity.label);
  }

  function onMouseOver(event) {
    if (!settings?.enabled || !settings?.commentBlockEnabled || !settings?.commentHoverHintEnabled) return;
    const target = event.target instanceof Element ? event.target : null;
    const author = target?.closest(NF.commentModel.AUTHOR_SELECTOR);
    if (!author || author === hoveredAuthor) return;
    hoveredAuthor = author;
    NF.ui.showTooltip(author, "이 사용자의 댓글을 보고 싶지 않으신가요?", "우클릭하면 즉시 숨깁니다.");
  }

  function onMouseOut(event) {
    if (!hoveredAuthor) return;
    const related = event.relatedTarget instanceof Node ? event.relatedTarget : null;
    if (related && hoveredAuthor.contains(related)) return;
    hoveredAuthor = null;
    NF.ui.hideTooltip();
  }

  function onContextMenu(event) {
    if (!settings?.enabled || !settings?.commentBlockEnabled || !settings?.commentRightClickEnabled) return;
    const target = event.target instanceof Element ? event.target : null;
    const author = target?.closest(NF.commentModel.AUTHOR_SELECTOR);
    const comment = NF.commentModel.getCommentRoot(author);
    if (!comment) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    NF.ui.hideTooltip();
    void toggleBlock(comment);
  }

  function bindListeners() {
    if (listenersBound) return;
    listenersBound = true;
    document.addEventListener("mouseover", onMouseOver, true);
    document.addEventListener("mouseout", onMouseOut, true);
    document.addEventListener("contextmenu", onContextMenu, true);
  }

  function unbindListeners() {
    if (!listenersBound) return;
    listenersBound = false;
    document.removeEventListener("mouseover", onMouseOver, true);
    document.removeEventListener("mouseout", onMouseOut, true);
    document.removeEventListener("contextmenu", onContextMenu, true);
    hoveredAuthor = null;
    NF.ui.hideTooltip();
  }

  function subscribeToDom() {
    unsubscribeDom?.();
    unsubscribeDom = NF.domBus.subscribe("comments", (records) => {
      for (const record of records) {
        for (const node of record.addedNodes || []) {
          if (node instanceof Element) scan(node);
        }
      }
    });
  }

  function init(initialSettings) {
    settings = initialSettings;
    refreshMatchers();
    scan(document);
    const enabled = !!settings?.enabled && !!settings?.commentBlockEnabled;
    if (enabled) {
      subscribeToDom();
      if (settings.commentHoverHintEnabled || settings.commentRightClickEnabled) bindListeners();
    }
  }

  function update(nextSettings) {
    settings = nextSettings;
    refreshMatchers();
    scan(document);
    const enabled = !!settings?.enabled && !!settings?.commentBlockEnabled;
    if (enabled) {
      subscribeToDom();
      if (settings.commentHoverHintEnabled || settings.commentRightClickEnabled) bindListeners();
      else unbindListeners();
    } else {
      unsubscribeDom?.();
      unsubscribeDom = null;
      unbindListeners();
    }
    if (!enabled || !settings?.commentHoverHintEnabled) NF.ui.hideTooltip();
  }

  function destroy() {
    unsubscribeDom?.();
    unsubscribeDom = null;
    unbindListeners();
    settings = null;
    blockedUserKeys = new Set();
    compiledKeywords = [];
    scan(document);
  }

  NF.comments = Object.freeze({ init, update, destroy });
})();
