# Naver Focus Architecture

현재 버전: `9.1.1.2026`

## 데이터 흐름

### 뉴스

`기사 링크 발견 -> oid+aid 기준 중복 제거 -> 목록 제목·요약 즉시 검사 -> 차단 시 카드 숨김 -> 통과 시 IntersectionObserver -> 제한된 background fetch queue -> 제목·본문 추출 -> 키워드 검사 -> TTL cache -> 중복 카드에 결과 반영`

### 댓글

`댓글 DOM 발견 -> 댓글 본문 키워드 판정 + 작성자 식별 key 판정 -> 차단 사유 합산 -> 댓글 단위 숨김`

작성자 영역 우클릭 시 `profileUserId`, `targetMark`/`_user_id_no_*`, `idNo`, `userName` 순으로 식별 key를 골라 차단 목록에 넣거나 제거합니다. 숨김 사유는 `blocked-user`, `blocked-keyword`로 구분하며 한 사유가 해제되어도 다른 사유가 남으면 계속 숨깁니다.

### 요소 숨김

`대상 element -> stable selector 후보 생성 -> 현재 DOM에서 정확도 점수 -> selector 저장 -> style rule 삽입`

우선하는 selector 특성:

1. 안정적인 id
2. `data-ui-selector`, `data-nlog-area`
3. `aria-label`, `role`
4. CSS-module class prefix (`Something-module__part___`)
5. 일반 class
6. parent-child 경로
7. `nth-of-type` 최후 fallback

사용자 지정 selector와 별도로 `junk-links.js`가 뉴스 서비스 배너의 URL·컨테이너 조합과 구독 aside wrapper를 판정합니다. `data-nf-junk-hidden` 상태만 적용하므로 토글 해제 시 해당 기능이 숨긴 요소만 복원합니다.

### 미니멀 홈

네이버 원본 DOM을 이동하거나 가리지 않습니다. 작은 `#nf-focus-home` 제어 바만 추가하며 원본 로고·검색·로그인·`#ad_premium_area`는 그대로 둡니다. 원본 form의 submit만 Google 검색 URL로 연결하고, Google 결과 페이지 adapter와 shell은 `src/home/google-results-*`에 분리되어 있습니다.

## 저장 스키마

### `nf.settings.v1`

- `enabled`
- `newsFilterEnabled`
- `deepScanEnabled`
- `articlePageGuardEnabled`
- `commentBlockEnabled`
- `commentHoverHintEnabled`
- `commentRightClickEnabled`
- `cleanerEnabled`
- `hideJunkLinks`
- `focusHomeEnabled`
- `blockedKeywords[]`
- `blockedUsers[]`
- `hiddenSelectorsByHost{}`

### `nf.articleCache.v1`

가능하면 `oid+aid`로 canonicalize한 기사별 추출 텍스트와 분석 시각을 저장합니다. 기존 URL key cache도 읽을 수 있으며 기본 TTL은 7일, 최대 500개입니다.

### `nf.recentBlocks.v1`

최근 필터링 기록을 최대 100개 저장합니다.
