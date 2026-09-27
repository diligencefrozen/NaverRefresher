(() => {
  const NF = globalThis.NaverFocus;
  if (!NF || NF.storage) return;

  const cloneDefaults = () => JSON.parse(JSON.stringify(NF.DEFAULT_SETTINGS));

  async function getSettings() {
    const data = await chrome.storage.local.get({ [NF.KEYS.settings]: null });
    const stored = data[NF.KEYS.settings];
    return {
      ...cloneDefaults(),
      ...(stored && typeof stored === "object" ? stored : {})
    };
  }

  async function patchSettings(patch) {
    const current = await getSettings();
    const next = { ...current, ...(patch || {}) };
    await chrome.storage.local.set({ [NF.KEYS.settings]: next });
    return next;
  }

  async function setSettings(settings) {
    const next = { ...cloneDefaults(), ...(settings || {}) };
    await chrome.storage.local.set({ [NF.KEYS.settings]: next });
    return next;
  }

  function normalizeKeyword(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  async function addKeyword(value) {
    const keyword = normalizeKeyword(value);
    if (!keyword) return getSettings();
    const current = await getSettings();
    const exists = current.blockedKeywords.some((item) => item.toLocaleLowerCase("ko-KR") === keyword.toLocaleLowerCase("ko-KR"));
    if (exists) return current;
    return patchSettings({ blockedKeywords: [...current.blockedKeywords, keyword] });
  }

  async function removeKeyword(value) {
    const target = normalizeKeyword(value).toLocaleLowerCase("ko-KR");
    const current = await getSettings();
    return patchSettings({
      blockedKeywords: current.blockedKeywords.filter((item) => item.toLocaleLowerCase("ko-KR") !== target)
    });
  }

  async function addBlockedUser(user) {
    if (!user || !user.key) return getSettings();
    const current = await getSettings();
    const list = Array.isArray(current.blockedUsers) ? current.blockedUsers : [];
    const exists = list.some((item) => item?.key === user.key);
    if (exists) return current;
    return patchSettings({
      blockedUsers: [
        ...list,
        {
          key: user.key,
          kind: user.kind || "unknown",
          value: user.value || "",
          label: user.label || user.value || "사용자",
          createdAt: Date.now()
        }
      ]
    });
  }

  async function removeBlockedUser(key) {
    const current = await getSettings();
    return patchSettings({
      blockedUsers: (current.blockedUsers || []).filter((item) => item?.key !== key)
    });
  }

  async function addHiddenSelector(host, selector) {
    if (!host || !selector) return getSettings();
    const current = await getSettings();
    const map = { ...(current.hiddenSelectorsByHost || {}) };
    const list = Array.isArray(map[host]) ? [...map[host]] : [];
    if (!list.includes(selector)) list.push(selector);
    map[host] = list;
    return patchSettings({ hiddenSelectorsByHost: map });
  }

  async function removeHiddenSelector(host, selector) {
    const current = await getSettings();
    const map = { ...(current.hiddenSelectorsByHost || {}) };
    map[host] = (map[host] || []).filter((item) => item !== selector);
    if (!map[host].length) delete map[host];
    return patchSettings({ hiddenSelectorsByHost: map });
  }

  async function addRecentBlock(entry) {
    const data = await chrome.storage.local.get({ [NF.KEYS.recentBlocks]: [] });
    const current = Array.isArray(data[NF.KEYS.recentBlocks]) ? data[NF.KEYS.recentBlocks] : [];
    const next = [{ ...entry, at: entry?.at || Date.now() }, ...current].slice(0, NF.RECENT_BLOCKS_MAX);
    await chrome.storage.local.set({ [NF.KEYS.recentBlocks]: next });
  }

  async function getRecentBlocks() {
    const data = await chrome.storage.local.get({ [NF.KEYS.recentBlocks]: [] });
    return Array.isArray(data[NF.KEYS.recentBlocks]) ? data[NF.KEYS.recentBlocks] : [];
  }

  async function clearRecentBlocks() {
    await chrome.storage.local.set({ [NF.KEYS.recentBlocks]: [] });
  }

  async function getArticleCache() {
    const data = await chrome.storage.local.get({ [NF.KEYS.articleCache]: {} });
    const stored = data[NF.KEYS.articleCache];
    return stored && typeof stored === "object" ? stored : {};
  }

  async function setArticleCache(cache) {
    await chrome.storage.local.set({
      [NF.KEYS.articleCache]: cache && typeof cache === "object" ? cache : {}
    });
  }

  async function clearArticleCache() {
    await setArticleCache({});
  }

  async function resetAll() {
    const next = cloneDefaults();
    await chrome.storage.local.set({
      [NF.KEYS.settings]: next,
      [NF.KEYS.recentBlocks]: [],
      [NF.KEYS.articleCache]: {}
    });
    return next;
  }

  NF.storage = Object.freeze({
    getSettings,
    patchSettings,
    setSettings,
    addKeyword,
    removeKeyword,
    addBlockedUser,
    removeBlockedUser,
    addHiddenSelector,
    removeHiddenSelector,
    addRecentBlock,
    getRecentBlocks,
    clearRecentBlocks,
    getArticleCache,
    setArticleCache,
    clearArticleCache,
    resetAll
  });
})();
