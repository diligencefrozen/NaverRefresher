(() => {
  const NF = globalThis.NaverFocus;
  if (!NF || NF.articleScan) return;

  const MAX_CONCURRENT = 2;
  let enabled = false;
  let cache = {};
  let saveTimer = null;
  let activeCount = 0;
  let generation = 0;
  const queue = [];
  const jobs = new Map();

  function pruneCache() {
    const now = Date.now();
    cache = Object.fromEntries(
      Object.entries(cache)
        .filter(([, value]) => value && now - Number(value.at || 0) < NF.ARTICLE_CACHE_TTL_MS)
        .sort((a, b) => Number(b[1].at || 0) - Number(a[1].at || 0))
        .slice(0, NF.ARTICLE_CACHE_MAX)
    );
  }

  function cachedText(article) {
    const entry = cache[article.key] || cache[article.url];
    if (!entry || Date.now() - Number(entry.at || 0) >= NF.ARTICLE_CACHE_TTL_MS) return null;
    return String(entry.text || "");
  }

  function scheduleCacheSave() {
    if (saveTimer) return;
    saveTimer = setTimeout(() => {
      saveTimer = null;
      pruneCache();
      void NF.storage.setArticleCache(cache);
    }, 700);
  }

  function flushCacheSave() {
    if (!saveTimer) return;
    clearTimeout(saveTimer);
    saveTimer = null;
    pruneCache();
    void NF.storage.setArticleCache(cache);
  }

  function pump() {
    while (enabled && activeCount < MAX_CONCURRENT && queue.length) {
      const job = queue.shift();
      if (jobs.get(job.article.key) !== job) continue;
      activeCount += 1;
      const runGeneration = generation;
      chrome.runtime.sendMessage({ type: NF.MESSAGE_TYPES.fetchArticle, url: job.article.url })
        .catch(() => null)
        .then((result) => {
          if (!enabled || runGeneration !== generation || !result?.ok || !result.html) return;
          const text = NF.newsDom.extractArticleText(result.html);
          if (text) {
            cache[job.article.key] = { text, at: Date.now(), url: result.url || job.article.url };
            scheduleCacheSave();
          }
          for (const callback of job.callbacks) {
            try { callback(text); } catch (error) { console.warn("[Naver Focus] Article result handler failed", error); }
          }
        })
        .finally(() => {
          if (jobs.get(job.article.key) === job) jobs.delete(job.article.key);
          activeCount -= 1;
          pump();
        });
    }
  }

  function request(article, callback) {
    if (!enabled || !article?.key || typeof callback !== "function") return;
    const existingText = cachedText(article);
    if (existingText !== null) {
      queueMicrotask(() => { if (enabled) callback(existingText); });
      return;
    }

    const existingJob = jobs.get(article.key);
    if (existingJob) {
      existingJob.callbacks.add(callback);
      return;
    }

    const job = { article, callbacks: new Set([callback]) };
    jobs.set(article.key, job);
    queue.push(job);
    pump();
  }

  function update(isEnabled) {
    enabled = !!isEnabled;
    if (enabled) {
      pump();
      return;
    }
    generation += 1;
    queue.splice(0, queue.length);
    jobs.clear();
    flushCacheSave();
  }

  async function init(isEnabled) {
    cache = await NF.storage.getArticleCache();
    pruneCache();
    update(isEnabled);
  }

  function destroy() {
    update(false);
    flushCacheSave();
  }

  NF.articleScan = Object.freeze({ init, update, request, destroy });
})();
