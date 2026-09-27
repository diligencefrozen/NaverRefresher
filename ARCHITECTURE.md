# Naver Focus Architecture

## 데이터 흐름

### 뉴스

`기사 링크 발견 -> 목록 카드 텍스트 즉시 검사 -> 차단 시 숨김 -> 통과 시 IntersectionObserver -> background fetch -> DOMParser 본문 추출 -> 키워드 검사 -> 결과 캐시 -> 숨김/통과`

### 댓글

`댓글 DOM 발견 -> 작성자 data-param 분석 -> 사용자 식별 key 생성 -> 로컬 차단 Set과 비교 -> 댓글 숨김`

작성자 영역 우클릭 시 같은 식별 key를 차단 목록에 넣거나 제거합니다.

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

### 미니멀 홈

네이버 원본 DOM을 이동시키지 않습니다. `#nf-focus-home`이라는 fixed shell을 최상단에 렌더링하고 원본은 그 아래 그대로 둡니다. 따라서 기능을 끄면 원본 화면을 즉시 복원할 수 있습니다.

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
- `focusHomeEnabled`
- `blockedKeywords[]`
- `blockedUsers[]`
- `hiddenSelectorsByHost{}`

### `nf.articleCache.v1`

URL별 추출된 기사 텍스트와 분석 시각을 저장합니다. 기본 TTL은 7일이며 최대 500개입니다.

### `nf.recentBlocks.v1`

최근 필터링 기록을 최대 100개 저장합니다.
