
  (() => {
  const NF = globalThis.NaverFocus;
  if (!NF || NF.home) return;

  let settings = null;
  let mounted = false;
  let nativeSearchForm = null;
  let unsubscribeDom = null;

  const isNaverHome = () => (location.hostname === "www.naver.com" || location.hostname === "naver.com")
    && (location.pathname === "/" || location.pathname === "");

  function findNativeSearchForm() {
    return document.querySelector("form#sform, form[action*='search.naver.com'], form[role='search']");
  }

  function queryInput(form) {
    return form?.querySelector("input#query, input[name='query'], input[type='search'], input[type='text']") || null;
  }

  function routeToGoogle(event) {
    if (!settings?.enabled || !settings?.focusHomeEnabled) return;
    const input = queryInput(event.currentTarget);
    const query = String(input?.value || "").trim();
    event.preventDefault();
    event.stopImmediatePropagation();
    if (!query) {
      input?.focus();
      return;
    }
    location.assign(`https://www.google.com/search?q=${encodeURIComponent(query)}`);
  }
  
  function onSearchKeydown(event) {
    if (event.key === "Enter" && event.target === queryInput(event.currentTarget)) routeToGoogle(event);
  }

  function onSearchClick(event) {
    const target = event.target instanceof Element ? event.target : null;
    if (target?.closest("#search-btn, button[type='submit'], input[type='submit'], .search_btn, .btn_search")) routeToGoogle(event);
  }

  function unbindNativeSearch() {
    if (!nativeSearchForm) return;
    nativeSearchForm.removeEventListener("submit", routeToGoogle, true);
    nativeSearchForm.removeEventListener("keydown", onSearchKeydown, true);
    nativeSearchForm.removeEventListener("click", onSearchClick, true);
    nativeSearchForm.removeAttribute("data-nf-google-bridge");
    nativeSearchForm = null;
  }

  function bindNativeSearch() {
    const form = findNativeSearchForm();
    if (!form) return false;
    if (form === nativeSearchForm) return true;
    unbindNativeSearch();
    nativeSearchForm = form;
    nativeSearchForm.setAttribute("data-nf-google-bridge", "1");
    nativeSearchForm.addEventListener("submit", routeToGoogle, true);
    nativeSearchForm.addEventListener("keydown", onSearchKeydown, true);
    nativeSearchForm.addEventListener("click", onSearchClick, true);
    return true;
  }

  function readNickname() {
    const accountLink = document.querySelector('a[data-nlog-area="login_box.login.id_name"]');
    if (!accountLink) return "";
    const spanText = NF.keywordMatcher.normalize(accountLink.querySelector("span")?.textContent);
    const nickname = (spanText || NF.keywordMatcher.normalize(accountLink.textContent).replace(/님\s*$/, "")).trim();
    return nickname && !nickname.includes("@") ? nickname : "";
  }

  function refreshGreeting() {
    const root = document.getElementById("nf-focus-home");
    if (!root) return;
    const nickname = readNickname();
    const greeting = root.querySelector('[data-slot="greeting"]');
    const login = root.querySelector('[data-slot="login"]');
    if (nickname) {
      greeting.textContent = `${nickname}님 안녕하세요.`;
      greeting.hidden = false;
      login.hidden = true;
    } else {
      greeting.textContent = "";
      greeting.hidden = true;
      login.hidden = false;
    }
  }

  function build() {
    const existing = document.getElementById("nf-focus-home");
    if (existing) return existing;
    const root = document.createElement("div");
    root.id = "nf-focus-home";
    root.setAttribute("data-nf-owned", "1");
    root.innerHTML = `
      <header class="nf-home-topbar">
        <strong class="nf-home-mode">NaverRefresher</strong>
        <nav>
          <span class="nf-home-greeting" data-slot="greeting" hidden></span>
          <a data-slot="login" href="https://nid.naver.com/nidlogin.login">로그인</a>
          <button type="button" data-action="normal-home">기본 화면</button>
        </nav>
      </header>`;
    root.querySelector('[data-action="normal-home"]').addEventListener("click", async () => {
      settings = await NF.storage.patchSettings({ focusHomeEnabled: false });
      update(settings);
      NF.ui.toast("미니멀 홈을 껐습니다");
    });
    document.documentElement.appendChild(root);
    return root;
  }

  function refreshBindings() {
    bindNativeSearch();
    refreshGreeting();
  }

  function mount() {
    if (mounted || !isNaverHome()) return;
    build();
    document.documentElement.classList.add("nf-focus-home-active");
    mounted = true;
    refreshBindings();
    unsubscribeDom = NF.domBus.subscribe("focus-home", refreshBindings);
  }

  function unmount() {
    unsubscribeDom?.();
    unsubscribeDom = null;
    unbindNativeSearch();
    document.getElementById("nf-focus-home")?.remove();
    document.documentElement.classList.remove("nf-focus-home-active");
    mounted = false;
  }

  function update(nextSettings) {
    settings = nextSettings;
    if (settings?.enabled && settings?.focusHomeEnabled && isNaverHome()) mount();
    else unmount();
  }

  NF.home = Object.freeze({
    init(initialSettings) {
      settings = initialSettings;
      if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", () => update(settings), { once: true });
      else update(settings);
    },
    update,
    destroy: unmount
  });
})();