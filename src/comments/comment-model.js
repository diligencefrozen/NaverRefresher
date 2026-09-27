(() => {
  const NF = globalThis.NaverFocus;
  if (!NF || NF.commentModel) return;

  const COMMENT_SELECTOR = "li.u_cbox_comment, .u_cbox_comment";
  const AUTHOR_SELECTOR = ".u_cbox_btn_totalcomment, .u_cbox_nick, .u_cbox_name_area";

  function parseParam(source, key) {
    const text = String(source || "");
    const quoted = text.match(new RegExp(`${key}\\s*:\\s*['\"]([^'\"]*)['\"]`));
    if (quoted) return quoted[1];
    const bare = text.match(new RegExp(`${key}:([^,}]+)`));
    return bare ? bare[1].trim() : "";
  }

  function getCommentRoot(node) {
    return node instanceof Element ? node.closest(COMMENT_SELECTOR) : null;
  }

  function findComments(root = document) {
    const base = root instanceof Element || root instanceof Document ? root : document;
    const comments = [];
    if (base instanceof Element && base.matches(COMMENT_SELECTOR)) comments.push(base);
    comments.push(...(base.querySelectorAll?.(COMMENT_SELECTOR) || []));
    return comments;
  }

  function getContentText(comment) {
    if (!(comment instanceof Element)) return "";
    const content = comment.querySelector('.u_cbox_contents, [data-ui-selector="commentContents"]');
    return NF.keywordMatcher.normalize(content?.textContent);
  }

  function getIdentity(comment) {
    if (!(comment instanceof Element)) return null;
    const button = comment.querySelector("button.u_cbox_btn_totalcomment[data-param], .u_cbox_btn_totalcomment[data-param]");
    const param = button?.getAttribute("data-param") || "";
    const label = NF.keywordMatcher.normalize(comment.querySelector(".u_cbox_nick")?.textContent)
      || parseParam(param, "userName")
      || "사용자";
    const classUserId = Array.from(comment.classList)
      .map((name) => name.match(/^_user_id_no_(.+)$/)?.[1] || "")
      .find(Boolean) || "";
    const candidates = [
      ["profileUserId", parseParam(param, "profileUserId")],
      ["targetMark", parseParam(param, "targetMark")],
      ["targetMark", classUserId],
      ["idNo", parseParam(param, "idNo")],
      ["userName", parseParam(param, "userName") || label]
    ];
    for (const [kind, rawValue] of candidates) {
      const value = String(rawValue || "").trim();
      if (!value || value === "undefined" || value === "null") continue;
      return { key: `${kind}:${value}`, kind, value, label };
    }
    return null;
  }

  function getBlockDecision(comment, blockedUserKeys, compiledKeywords, enabled) {
    const reasons = [];
    let keywordMatch = null;
    const identity = getIdentity(comment);
    if (enabled && identity && blockedUserKeys.has(identity.key)) reasons.push("blocked-user");
    if (enabled) {
      keywordMatch = NF.keywordMatcher.match(getContentText(comment), compiledKeywords);
      if (keywordMatch) reasons.push("blocked-keyword");
    }
    return { identity, keywordMatch, reasons };
  }

  function applyVisibility(comment, reasons) {
    if (!(comment instanceof Element)) return;
    if (reasons.length) {
      comment.setAttribute("data-nf-comment-hidden", "1");
      comment.setAttribute("data-nf-comment-reasons", reasons.join(" "));
    } else {
      comment.removeAttribute("data-nf-comment-hidden");
      comment.removeAttribute("data-nf-comment-reasons");
    }
  }

  NF.commentModel = Object.freeze({
    AUTHOR_SELECTOR,
    getCommentRoot,
    findComments,
    getContentText,
    getIdentity,
    getBlockDecision,
    applyVisibility
  });
})();
