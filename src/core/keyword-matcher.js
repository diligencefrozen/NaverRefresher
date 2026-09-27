(() => {
  const NF = globalThis.NaverFocus;
  if (!NF || NF.keywordMatcher) return;

  function normalize(value) {
    return String(value || "").replace(/\s+/g, " ").trim();
  }

  function compile(keywords) {
    return (Array.isArray(keywords) ? keywords : [])
      .map((raw) => ({ raw: normalize(raw), normalized: normalize(raw).toLocaleLowerCase("ko-KR") }))
      .filter((item) => item.normalized);
  }

  function match(text, compiledKeywords) {
    const haystack = normalize(text).toLocaleLowerCase("ko-KR");
    if (!haystack) return null;
    return (compiledKeywords || []).find((item) => haystack.includes(item.normalized)) || null;
  }

  NF.keywordMatcher = Object.freeze({ normalize, compile, match });
})();
