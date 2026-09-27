# Codex 작업 지침 — Naver Focus

현재 기준 버전은 `9.1.1.2026`이며 사용자가 새 버전을 지정하기 전까지 임의로 변경하지 않는다.

이 저장소를 수정할 때 다음 규칙을 최우선으로 지킨다.

## 절대 규칙

- 필요한 부분에서만 추론한다.
- 명확한 요구사항을 다시 확대 해석하지 않는다.
- 테스트 파일을 생성하지 않는다.
- `tests/`, `__tests__/`, `*.test.*`, `*.spec.*` 파일을 만들지 않는다.
- 자동 테스트를 실행하지 않는다.
- 기존 테스트를 실행하려고 시도하지 않는다.
- 테스트를 위해 임시 파일이나 fixture를 생성하지 않는다.
- 요청하지 않은 리팩터링을 하지 않는다.
- 요청 범위 밖 기능을 임의로 추가하지 않는다.
- 기존 동작을 가능한 한 보존하고 필요한 모듈만 수정한다.
- npm, 번들러, 프레임워크 의존성을 임의로 추가하지 않는다.
- 사용자가 요청하지 않는 한 네이버 원본 DOM 노드를 다른 컨테이너로 이동시키지 않는다.

## 설계 원칙

1. Manifest V3, 빌드 없는 vanilla JavaScript 구조를 유지한다.
2. 뉴스 심층 분석은 화면 근처 기사만 수행한다.
3. 본문 요청은 큐와 캐시를 사용해 네이버에 불필요한 요청을 만들지 않는다.
4. 댓글 사용자 차단은 마스킹 닉네임보다 구조적으로 더 안정적인 식별값을 우선한다.
5. 네이버 CSS-module의 빌드 해시 전체값을 영구 selector로 저장하지 않는다.
6. `data-*`, `aria-*`, 안정적인 CSS-module prefix를 우선 사용한다.
7. 확장이 만든 DOM에는 `data-nf-owned`를 붙여 요소 선택/분석 대상에서 제외한다.
8. 미니멀 홈은 네이버 원본 로고·검색·로그인·광고 DOM을 유지하고 최소 제어 바와 submit intercept만 추가한다.
9. 설정은 `chrome.storage.local`을 기본으로 한다.
10. 개인정보나 사용자의 필터 설정을 외부 서버로 보내지 않는다.

## 주요 모듈

- `src/background.js`: 네이버 기사 HTML fetch, Chrome context menu
- `src/news/news-filter.js`: 뉴스 목록/본문 필터, article guard, 캐시/큐
- `src/comments/comment-blocker.js`: 댓글 사용자 식별과 우클릭 차단
- `src/cleaner/area-picker.js`: 사용자 선택 영역 숨김, stable selector 생성
- `src/home/focus-home.js`: 검색 중심의 미니멀 네이버 홈
- `src/ui/popup/*`: 빠른 토글/키워드 추가/영역 선택
- `src/ui/options/*`: 전체 설정 및 관리
- `src/core/dom-bus.js`: DOM 추가 감지 fan-out
- `src/core/storage.js`: 저장 스키마와 변경 함수

## 댓글 식별 우선순위

현재 초기 구현은 다음 순서로 사용 가능한 값을 고른다.

1. `profileUserId`
2. `targetMark` 또는 같은 값의 `_user_id_no_*` class suffix
3. `idNo`
4. `userName` (fallback)

실제 네이버 동작을 관찰하며 식별자의 페이지/기사 간 안정성이 확인되면 우선순위를 조정한다. 확인되지 않은 값을 전역 고유 ID라고 단정하지 않는다.

## 완료 보고 형식

수정 후에는 다음만 간단히 보고한다.

- 수정한 파일
- 바뀐 동작
- 남은 제한사항

테스트를 만들거나 실행하지 않았다는 점을 명시한다.
