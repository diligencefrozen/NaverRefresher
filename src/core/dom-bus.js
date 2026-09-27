(() => {
  const NF = globalThis.NaverFocus;
  if (!NF || NF.domBus) return;

  const subscribers = new Map();
  const pending = [];
  let observer = null;
  let scheduled = false;

  function flush() {
    scheduled = false;
    if (!pending.length) return;
    const records = pending.splice(0, pending.length);
    for (const [id, handler] of subscribers.entries()) {
      try {
        handler(records);
      } catch (error) {
        console.warn(`[Naver Focus] DOM subscriber failed: ${id}`, error);
      }
    }
  }

  function schedule() {
    if (scheduled) return;
    scheduled = true;
    if (typeof requestAnimationFrame === "function") requestAnimationFrame(flush);
    else setTimeout(flush, 16);
  }

  function ensureObserver() {
    if (observer || !document.documentElement) return;
    observer = new MutationObserver((records) => {
      if (!records.length) return;
      pending.push(...records);
      schedule();
    });
    observer.observe(document.documentElement, {
      childList: true,
      subtree: true
    });
  }

  function subscribe(id, handler) {
    if (!id || typeof handler !== "function") return () => {};
    subscribers.set(id, handler);
    ensureObserver();
    return () => subscribers.delete(id);
  }

  if (!document.documentElement) {
    document.addEventListener("readystatechange", ensureObserver, { once: true });
  } else {
    ensureObserver();
  }

  NF.domBus = Object.freeze({ subscribe });
})();
