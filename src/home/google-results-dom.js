(() => {
  const NF = globalThis.NaverFocus = globalThis.NaverFocus || {};
  if (NF.googleResultsDom) return;

  function query() {
    return new URL(location.href).searchParams.get("q") || "";
  }

  function resultsRoot() {
    return document.querySelector("#search, #rso, main");
  }

  NF.googleResultsDom = Object.freeze({ query, resultsRoot });
})();
