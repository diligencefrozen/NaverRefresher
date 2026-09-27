(() => {
  const NF = globalThis.NaverFocus;
  if (!NF || NF.ui) return;

  let toastTimer = null;
  let tooltipTimer = null;

  function ensureToast() {
    let el = document.getElementById("nf-toast");
    if (el) return el;
    el = document.createElement("div");
    el.id = "nf-toast";
    el.setAttribute("data-nf-owned", "1");
    document.documentElement.appendChild(el);
    return el;
  }

  function toast(title, detail = "") {
    const el = ensureToast();
    el.innerHTML = "";
    const strong = document.createElement("strong");
    strong.textContent = title;
    el.appendChild(strong);
    if (detail) {
      const span = document.createElement("span");
      span.textContent = detail;
      el.appendChild(span);
    }
    el.classList.add("is-visible");
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove("is-visible"), 2300);
  }

  function ensureTooltip() {
    let el = document.getElementById("nf-tooltip");
    if (el) return el;
    el = document.createElement("div");
    el.id = "nf-tooltip";
    el.setAttribute("data-nf-owned", "1");
    document.documentElement.appendChild(el);
    return el;
  }

  function showTooltip(anchor, title, detail) {
    clearTimeout(tooltipTimer);
    tooltipTimer = setTimeout(() => {
      if (!(anchor instanceof Element) || !anchor.isConnected) return;
      const tip = ensureTooltip();
      tip.innerHTML = "";
      const strong = document.createElement("strong");
      strong.textContent = title;
      const span = document.createElement("span");
      span.textContent = detail;
      tip.append(strong, span);
      const rect = anchor.getBoundingClientRect();
      const top = Math.min(window.innerHeight - 84, Math.max(12, rect.bottom + 8));
      const left = Math.min(window.innerWidth - 300, Math.max(12, rect.left));
      tip.style.top = `${top}px`;
      tip.style.left = `${left}px`;
      tip.classList.add("is-visible");
    }, 420);
  }

  function hideTooltip() {
    clearTimeout(tooltipTimer);
    document.getElementById("nf-tooltip")?.classList.remove("is-visible");
  }

  NF.ui = Object.freeze({ toast, showTooltip, hideTooltip });
})();
