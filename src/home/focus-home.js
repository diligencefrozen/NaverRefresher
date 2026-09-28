(() => {
  const NF = globalThis.NaverFocus;
  if (!NF || NF.home) return;

  let settings = null;
  let mounted = false;

  function isNaverHome() {
    return (location.hostname === "www.naver.com" || location.hostname === "naver.com") && (location.pathname === "/" || location.pathname === "");
  }

  function textFromFirst(selectors) {
    for (const selector of selectors) {
      const node = document.querySelector(selector);
      const text = node?.textContent?.replace(/\s+/g, " ").trim();
      if (text) return text;
    }
    return "";
  }

  function nativeSnapshot() {
    const weather = textFromFirst([
      "[class*='weather_info']",
      "[class*='weather'] [class*='temperature']",
      "[class*='weather']"
    ]).slice(0, 90);

    const market = textFromFirst([
      "[class*='stock']",
      "[class*='finance']",
      "[class*='sise']"
    ]).slice(0, 90);

    return { weather, market };
  }

  function build() {
    const existing = document.getElementById("nf-focus-home");
    if (existing) return existing;

    const root = document.createElement("div");
    root.id = "nf-focus-home";
    root.setAttribute("data-nf-owned", "1");
    root.innerHTML = `
      <main class="nf-home-shell">
        <header class="nf-home-topbar">
          <a class="nf-home-brand" href="https://www.naver.com/" aria-label="네이버 홈">NAVER <span>FOCUS</span></a>
          <nav>
            <a href="https://nid.naver.com/nidlogin.login">로그인</a>
            <button type="button" data-action="normal-home">기본 화면</button>
          </nav>
        </header>

        <section class="nf-home-hero">
          <div class="nf-home-kicker">필요한 것만, 조용하게.</div>
          <h1>네이버를 검색 중심으로</h1>
          <form class="nf-home-search" action="https://search.naver.com/search.naver" method="get">
            <input type="search" name="query" autocomplete="off" placeholder="검색어를 입력하세요" aria-label="네이버 검색" autofocus>
            <button type="submit" aria-label="검색">검색</button>
          </form>
          <div class="nf-home-shortcuts">
            <a href="https://mail.naver.com/">메일</a>
            <a href="https://news.naver.com/">뉴스</a>
            <a href="https://map.naver.com/">지도</a>
            <a href="https://cafe.naver.com/">카페</a>
            <a href="https://section.blog.naver.com/">블로그</a>
            <a href="https://finance.naver.com/">증권</a>
          </div>
        </section>

        <section class="nf-home-cards">
          <a class="nf-home-card" href="https://weather.naver.com/">
            <span class="nf-home-card-label">날씨</span>
            <strong data-slot="weather">네이버 날씨 보기</strong>
            <small>자세히 보기 →</small>
          </a>
          <a class="nf-home-card" href="https://finance.naver.com/">
            <span class="nf-home-card-label">증시</span>
            <strong data-slot="market">네이버 증시 보기</strong>
            <small>자세히 보기 →</small>
          </a>
        </section>

        <footer class="nf-home-footer">Naver Focus는 네이버 원본 화면 위에 별도 UI를 덧씌웁니다. 원본 DOM을 이동시키지 않습니다.</footer>
      </main>`;

    root.querySelector('[data-action="normal-home"]').addEventListener("click", async () => {
      settings = await NF.storage.patchSettings({ focusHomeEnabled: false });
      update(settings);
      NF.ui.toast("미니멀 홈을 껐습니다");
    });

    document.documentElement.appendChild(root);
    return root;
  }

  function refreshSnapshot() {
    const root = document.getElementById("nf-focus-home");
    if (!root) return;
    const snap = nativeSnapshot();
    if (snap.weather) root.querySelector('[data-slot="weather"]').textContent = snap.weather;
    if (snap.market) root.querySelector('[data-slot="market"]').textContent = snap.market;
  }

  function mount() {
    if (mounted || !isNaverHome()) return;
    build();
    document.documentElement.classList.add("nf-focus-home-active");
    mounted = true;
    setTimeout(refreshSnapshot, 700);
    setTimeout(refreshSnapshot, 1800);
  }

  function unmount() {
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
      if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", () => update(settings), { once: true });
      } else {
        update(settings);
      }
    },
    update
  });
})();
