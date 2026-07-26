# GRAPHIDEA 변경 기록

> 프로젝트명: **GRAPHIDEA** (부제 "Idea Connect"). 이전 명칭 STACKER에서 리브랜딩(2026-07-26).

> 단일 파일 앱(`index.html`). 순수 HTML/CSS/JS + Supabase(Auth/Postgres/Realtime) + Vercel 자동 배포.
> GitHub: SpecialBee/NoteApp · 배포: https://note-app-gamma-wheat.vercel.app

---

## 2026-07-26 작업 요약

이날 앱을 "마크다운 노트"에서 **4가지 작업 공간(일반·캔버스·테이블 + 데이터베이스 뷰)** 을 갖춘 도구로 확장하고, 뷰 관리 구조를 리팩터하고 다수 버그를 잡았다.

### 노트 타입 (content 필드 접두사로 구분 — DB 스키마 변경 없음)
- **일반(마크다운)** — 기존.
- **🎨 캔버스** (` ```canvas `, `isCanvasNote`) — FigJam풍 에디터. **저장을 JSON**(`{elements,connectors}`)으로 전환, 레거시 `@`-directive는 `parseCanvasLegacy()`로 폴백 로드.
- **📊 테이블** (` ```table `, `isTableNote`) — 독립 스프레드시트.
- **🗄 데이터베이스** — 노트 타입이 아니라 **전역 단일 뷰**(사이드바 검색 위 버튼). 설정은 `localStorage: stk-db`.

### 캔버스 에디터(prefix `cev`) 강화
- Undo/Redo(Ctrl+Z / Ctrl+Shift+Z, 60스텝), 복제(Ctrl+D), 전체선택(Ctrl+A).
- 다중 선택(마퀴 드래그 + Shift+클릭), 그룹 이동/삭제/복제/정렬.
- 격자 스냅(⊞), 전체 보기(⤢), 레이어 순서(맨앞/맨뒤), 잠금.
- 노드/그룹/커넥터별 **컨텍스트 툴바**(색·글자색·크기·굵기·복제·정렬·잠금·삭제, 커넥터는 종류·색·라벨).
- **섹션(⊡)** 을 옮기면 내부 노드와 화살표가 함께 이동.
- **카드 노드(📇)** — 실제 노트 카드를 캔버스에 얹고 더블클릭으로 열기(`edata.noteId`).
- 패닝: 가운데 버튼 드래그 / Space+드래그(좌드래그는 마퀴 선택).
- 버그 수정: `cevDragMoved` 미초기화로 **도형이 생성되다 안 되던 문제**, 섹션 미직렬화로 **저장 시 사라지던 데이터 유실**.

### 테이블 에디터(prefix `tev`)
- 열 타입 text/number/checkbox/date/select, 헤더 클릭 정렬, 하단 합계/평균/개수 요약.
- 엑셀/시트 붙여넣기(TSV), CSV 가져오기/내보내기, 행·열 우클릭 중간 삽입/삭제.
- 실시간 동기화 시 편집 중 경고, 로컬 `updated` 반영, number는 원문 문자열 저장(정렬/집계 때만 파싱).

### 데이터베이스 뷰(prefix `cov`)
- 태그를 고르면 그 태그 카드가 **행**, 각 카드 Properties가 **열**. 셀 인라인 편집 → **원본 카드에 양방향 반영**, 제목 클릭 시 카드 열기, "+ 새 항목"으로 태그 단 카드 생성.

### 아키텍처 / UX
- **뷰 관리 단일화**: 모든 mainpane 전환을 `showView(name)` + `VIEW_DEF` 레지스트리로 통합(각 뷰가 rightpane/toolbar 적용 여부 선언). 흩어진 display 조작으로 인한 "왔다갔다 버그" 제거.
- **좌측 사이드바 접기 기능 제거**(문제 잦아 항상 표시). 우측 패널만 토글 — 토글 버튼을 패널 **왼쪽 경계 세로 중앙 탭**으로 이동. 패널 폭 CSS 변수는 `:root`로 이동(고정 탭이 리사이즈 추적).
- 검색: 캔버스/테이블은 JSON 원문 대신 **실제 텍스트만 인덱싱**(`noteSearchText`, 캐시).
- 사이드바 카드 목록 **스크롤 수정**(`.card-tab { flex-shrink:0 }`, `.cardlist { min-height:0 }`), 태그줄 높이 제한.
- 브랜드: `Stacker`→`STACKER`→**GRAPHIDEA**, 부제 `note stack`→`idea stack`→**Idea Connect**.
  (표시 텍스트만 변경 — GitHub 저장소명/배포 URL/Supabase 프로젝트/localStorage 키는 그대로.)
- 온보딩 사용법 전면 재작성 + **1회 안내 모달**(`?` 버튼으로 재열람, `localStorage: stk-guide-v2`).
- 대시보드 월별 활동 **날짜 시간대 버그 수정**: UTC 대신 `localDateKey()`로 로컬 날짜 기준 집계.

### 참고
- 이날 **DB 스키마 변경 없음**. 새 기능은 모두 `notes.content` 또는 localStorage 사용.
- 저장 포맷: 캔버스/테이블/(레거시)컬렉션 노트는 각각 ` ```canvas ` / ` ```table ` / ` ```collection ` + JSON.
