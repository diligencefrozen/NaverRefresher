(() => {
  const NF = globalThis.NaverFocus;
  if (!NF || NF.cleaner) return;

  const STYLE_ID = "nf-hidden-selectors-style";
  const OVERLAY_ID = "nf-area-overlay";
  let settings = null;
  let lastContextTarget = null;
  let pickerActive = false;
  let pickerTarget = null;

  const escapeAttr = (value) => String(value || "").replace(/\\/g, "\\\\").replace(/"/g, '\\"');

  function safeQuery(selector) {
    try { return document.querySelectorAll(selector); } catch (_) { return []; }
  }

  function looksRandom(value) {
    const text = String(value || "");
    if (!text) return true;
    if (/^[a-f0-9]{8,}$/i.test(text)) return true;
    if (/^[A-Za-z0-9_-]{12,}$/.test(text) && /\d/.test(text) && /[A-Za-z]/.test(text)) return true;
    return false;
  }

  function cssModulePrefix(token) {
    const match = String(token || "").match(/^([A-Za-z0-9_-]+-module__[A-Za-z0-9_-]+___)[A-Za-z0-9_-]+$/);
    return match?.[1] || "";
  }

  function candidateSelectors(el) {
    const candidates = [];
    const tag = el.tagName?.toLowerCase() || "div";

    if (el.id && !looksRandom(el.id)) candidates.push(`#${CSS.escape(el.id)}`);

    for (const attr of ["data-ui-selector", "data-nlog-area", "aria-label", "role"]) {
      const value = el.getAttribute?.(attr);
      if (!value || value.length > 140) continue;
      candidates.push(`${tag}[${attr}="${escapeAttr(value)}"]`);
      candidates.push(`[${attr}="${escapeAttr(value)}"]`);
    }

    for (const token of el.classList || []) {
      const prefix = cssModulePrefix(token);
      if (prefix) candidates.push(`${tag}[class*="${escapeAttr(prefix)}"]`);
      if (!looksRandom(token) && token.length < 80 && !token.startsWith("_")) {
        candidates.push(`${tag}.${CSS.escape(token)}`);
      }
    }

    if (el.getAttribute?.("href")) {
      const href = el.getAttribute("href");
      if (/^https:\/\//.test(href) && href.length < 180) {
        try {
          const url = new URL(href);
          candidates.push(`${tag}[href^="${escapeAttr(url.origin + url.pathname)}"]`);
        } catch (_) {}
      }
    }

    return [...new Set(candidates)];
  }

  function scoreSelector(selector, target) {
    const matches = safeQuery(selector);
    if (!matches.length || !Array.from(matches).includes(target)) return -Infinity;
    let score = 150 - selector.length;
    if (matches.length === 1) score += 220;
    else score -= Math.min(120, matches.length * 8);
    if (selector.startsWith("#")) score += 100;
    if (/data-ui-selector|data-nlog-area|aria-label/.test(selector)) score += 70;
    if (/class\*=/.test(selector)) score += 45;
    return score;
  }

  function buildSelector(target) {
    if (!(target instanceof Element)) return "";
    const direct = candidateSelectors(target)
      .map((selector) => ({ selector, score: scoreSelector(selector, target) }))
      .filter((item) => Number.isFinite(item.score))
      .sort((a, b) => b.score - a.score);

    if (direct[0]?.score > 40) return direct[0].selector;

    let current = target.parentElement;
    for (let depth = 0; current && depth < 4; depth += 1, current = current.parentElement) {
      const parentCandidates = candidateSelectors(current);
      const childTag = target.tagName.toLowerCase();
      for (const parentSelector of parentCandidates) {
        const selector = `${parentSelector} > ${childTag}`;
        const score = scoreSelector(selector, target) - depth * 20;
        if (Number.isFinite(score) && score > 10) return selector;
      }
    }

    const parent = target.parentElement;
    if (!parent) return target.tagName.toLowerCase();
    const siblings = Array.from(parent.children).filter((el) => el.tagName === target.tagName);
    const index = siblings.indexOf(target) + 1;
    return `${target.tagName.toLowerCase()}:nth-of-type(${Math.max(1, index)})`;
  }

  function ensureHiddenStyle() {
    let style = document.getElementById(STYLE_ID);
    if (style) return style;
    style = document.createElement("style");
    style.id = STYLE_ID;
    style.setAttribute("data-nf-owned", "1");
    (document.head || document.documentElement).appendChild(style);
    return style;
  }

  function applyHiddenSelectors() {
    if (!settings?.enabled || !settings?.cleanerEnabled) {
      document.getElementById(STYLE_ID)?.remove();
      return;
    }
    const list = settings.hiddenSelectorsByHost?.[location.hostname] || [];
    const valid = list.filter((selector) => {
      try { document.querySelector(selector); return true; } catch (_) { return false; }
    });
    const style = ensureHiddenStyle();
    style.textContent = valid.map((selector) => `${selector}{display:none!important;visibility:hidden!important;}`).join("\n");
  }

  async function hideTarget(target) {
    if (!(target instanceof Element)) return;
    if (target.closest?.("[data-nf-owned]")) return;
    const selector = buildSelector(target);
    if (!selector) {
      NF.ui.toast("영역을 숨기지 못했습니다", "안정적인 선택자를 만들 수 없습니다.");
      return;
    }
    settings = await NF.storage.addHiddenSelector(location.hostname, selector);
    applyHiddenSelectors();
    NF.ui.toast("영역을 숨겼습니다", selector);
  }

  function ensureOverlay() {
    let overlay = document.getElementById(OVERLAY_ID);
    if (overlay) return overlay;
    overlay = document.createElement("div");
    overlay.id = OVERLAY_ID;
    overlay.setAttribute("data-nf-owned", "1");
    document.documentElement.appendChild(overlay);
    return overlay;
  }

  function moveOverlay(target) {
    const overlay = ensureOverlay();
    if (!(target instanceof Element)) {
      overlay.style.display = "none";
      return;
    }
    const rect = target.getBoundingClientRect();
    overlay.style.display = "block";
    overlay.style.left = `${rect.left}px`;
    overlay.style.top = `${rect.top}px`;
    overlay.style.width = `${rect.width}px`;
    overlay.style.height = `${rect.height}px`;
  }

  function stopPicker() {
    pickerActive = false;
    pickerTarget = null;
    document.documentElement.classList.remove("nf-picker-active");
    document.getElementById(OVERLAY_ID)?.remove();
    document.removeEventListener("mousemove", onPickerMove, true);
    document.removeEventListener("click", onPickerClick, true);
    document.removeEventListener("keydown", onPickerKey, true);
  }

  function onPickerMove(event) {
    const target = event.target instanceof Element ? event.target : null;
    if (!target || target.closest?.("[data-nf-owned]")) return;
    pickerTarget = target;
    moveOverlay(target);
  }

  function onPickerClick(event) {
    if (!pickerTarget) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    const target = pickerTarget;
    stopPicker();
    void hideTarget(target);
  }

  function onPickerKey(event) {
    if (event.key !== "Escape") return;
    event.preventDefault();
    stopPicker();
    NF.ui.toast("영역 선택을 취소했습니다");
  }

  function startPicker() {
    if (!settings?.enabled || !settings?.cleanerEnabled || pickerActive) return;
    pickerActive = true;
    document.documentElement.classList.add("nf-picker-active");
    document.addEventListener("mousemove", onPickerMove, true);
    document.addEventListener("click", onPickerClick, true);
    document.addEventListener("keydown", onPickerKey, true);
    NF.ui.toast("숨길 영역을 선택하세요", "마우스로 가리킨 뒤 클릭 · Esc로 취소");
  }

  document.addEventListener("contextmenu", (event) => {
    const target = event.target instanceof Element ? event.target : null;
    if (!target || target.closest?.("[data-nf-owned]")) return;
    if (target.closest?.(".u_cbox_btn_totalcomment, .u_cbox_nick, .u_cbox_name_area")) return;
    lastContextTarget = target;
  }, true);

  chrome.runtime.onMessage.addListener((message) => {
    if (message?.type === "NF_HIDE_CONTEXT_TARGET") {
      if (lastContextTarget?.isConnected) void hideTarget(lastContextTarget);
      else NF.ui.toast("영역을 찾지 못했습니다", "다시 우클릭한 뒤 시도해 주세요.");
    }
    if (message?.type === "NF_START_PICKER") startPicker();
  });

  NF.cleaner = Object.freeze({
    async init(initialSettings) {
      settings = initialSettings;
      applyHiddenSelectors();
    },
    update(nextSettings) {
      settings = nextSettings;
      applyHiddenSelectors();
    },
    startPicker,
    buildSelector
  });
})();
