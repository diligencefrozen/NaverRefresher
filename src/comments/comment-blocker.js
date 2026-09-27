(() => {
  const NF = globalThis.NaverFocus;
  if (!NF || NF.comments) return;

  let settings = null;
  const boundAuthorNodes = new WeakSet();

  function parseParam(source, key) {
    const text = String(source || "");
    const quoted = text.match(new RegExp(`${key}:'([^']*)'`));
    if (quoted) return quoted[1];
    const bare = text.match(new RegExp(`${key}:([^,}]+)`));
    return bare ? bare[1].trim() : "";
  }

  function getCommentRoot(node) {
    return node instanceof Element ? node.closest("li.u_cbox_comment, .u_cbox_comment") : null;
  }

  function getIdentity(comment) {
    if (!(comment instanceof Element)) return null;
    const button = comment.querySelector("button.u_cbox_btn_totalcomment[data-param]");
    const param = button?.getAttribute("data-param") || "";
    const label = comment.querySelector(".u_cbox_nick")?.textContent?.trim() || parseParam(param, "userName") || "사용자";

    const candidates = [
      ["profileUserId", parseParam(param, "profileUserId")],
      ["targetMark", parseParam(param, "targetMark")],
      ["idNo", parseParam(param, "idNo")],
      ["userName", parseParam(param, "userName") || label]
    ];

    for (const [kind, valueRaw] of candidates) {
      const value = String(valueRaw || "").trim();
      if (!value || value === "undefined" || value === "null") continue;
      return { key: `${kind}:${value}`, kind, value, label };
    }
    return null;
  }

  function blockedKeySet() {
    return new Set((settings?.blockedUsers || []).map((item) => item?.key).filter(Boolean));
  }

  function applyToComment(comment) {
    if (!(comment instanceof Element)) return;
    const identity = getIdentity(comment);
    const blocked = identity && blockedKeySet().has(identity.key);
    if (blocked && settings?.enabled && settings?.commentBlockEnabled) {
      comment.setAttribute("data-nf-comment-hidden", "1");
    } else {
      comment.removeAttribute("data-nf-comment-hidden");
    }
  }

  function bindAuthorNode(node) {
    if (!(node instanceof Element) || boundAuthorNodes.has(node)) return;
    boundAuthorNodes.add(node);

    node.addEventListener("mouseenter", () => {
      if (!settings?.enabled || !settings?.commentBlockEnabled || !settings?.commentHoverHintEnabled) return;
      NF.ui.showTooltip(node, "이 사용자의 댓글을 보고 싶지 않으신가요?", "우클릭하면 즉시 숨깁니다.");
    });
    node.addEventListener("mouseleave", () => NF.ui.hideTooltip());
  }

  function scan(root = document) {
    const base = root instanceof Element || root instanceof Document ? root : document;
    const comments = [];
    if (base instanceof Element && base.matches?.("li.u_cbox_comment, .u_cbox_comment")) comments.push(base);
    comments.push(...base.querySelectorAll?.("li.u_cbox_comment, .u_cbox_comment") || []);
    comments.forEach(applyToComment);

    const authors = [];
    if (base instanceof Element && base.matches?.(".u_cbox_btn_totalcomment, .u_cbox_nick, .u_cbox_name_area")) authors.push(base);
    authors.push(...base.querySelectorAll?.(".u_cbox_btn_totalcomment, .u_cbox_nick, .u_cbox_name_area") || []);
    authors.forEach(bindAuthorNode);
  }

  async function toggleBlock(comment) {
    const identity = getIdentity(comment);
    if (!identity) {
      NF.ui.toast("사용자를 식별하지 못했습니다");
      return;
    }
    const isBlocked = blockedKeySet().has(identity.key);
    settings = isBlocked
      ? await NF.storage.removeBlockedUser(identity.key)
      : await NF.storage.addBlockedUser(identity);
    scan(document);
    NF.ui.toast(
      isBlocked ? "사용자 차단을 해제했습니다" : "사용자를 차단했습니다",
      identity.label
    );
  }

  document.addEventListener("contextmenu", (event) => {
    if (!settings?.enabled || !settings?.commentBlockEnabled || !settings?.commentRightClickEnabled) return;
    const target = event.target instanceof Element ? event.target : null;
    const author = target?.closest?.(".u_cbox_btn_totalcomment, .u_cbox_nick, .u_cbox_name_area");
    if (!author) return;
    const comment = getCommentRoot(author);
    if (!comment) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    NF.ui.hideTooltip();
    void toggleBlock(comment);
  }, true);

  NF.comments = Object.freeze({
    init(initialSettings) {
      settings = initialSettings;
      scan(document);
      NF.domBus.subscribe("comments", (records) => {
        for (const record of records) {
          for (const node of record.addedNodes || []) {
            if (node instanceof Element) scan(node);
          }
        }
      });
    },
    update(nextSettings) {
      settings = nextSettings;
      scan(document);
    }
  });
})();
