# 다른 컴퓨터에서 이어서 작업하기

배포된 사이트: https://note-app-gamma-wheat.vercel.app

> 상세 변경 이력·현재 기능은 [`CHANGELOG.md`](CHANGELOG.md) 참고. 앱은 `index.html` 단일 파일.

## 현재 상태 (2026-07-26 기준)
- 노트 타입: 일반(마크다운) · 🎨 캔버스 · 📊 테이블. + 🗄 데이터베이스는 전역 뷰(사이드바 검색 위 버튼).
- 뷰 전환은 전부 `showView(name)` 한 곳을 거침. 좌측 사이드바 접기는 제거됨(우측 패널만 토글).
- 캔버스: Undo/Redo·다중선택·스냅·섹션·카드노드·커넥터 컨텍스트 툴바. 저장은 JSON.
- DB 스키마 변경 없음 — 모든 특수 카드는 `notes.content`에 JSON으로 저장(`schema.sql`은 그대로).

## 절차

1. 그 컴퓨터에 **Claude Code**와 **git**을 설치한다.
2. 저장소를 클론한다.
   ```
   git clone https://github.com/SpecialBee/NoteApp.git
   ```
3. 클론한 폴더에서 Claude Code를 실행하면 이어서 작업할 수 있다. (대화 맥락은 없지만 코드 자체는 그대로 이어받음)
4. 수정 후 커밋하고 `git push`만 하면 GitHub와 연결된 Vercel이 자동으로 재배포한다. 그 컴퓨터에서 Vercel CLI 로그인/설정을 따로 할 필요는 없다.

## 주의사항

- `git push`가 되려면 그 컴퓨터에서 GitHub 계정(SpecialBee) 인증이 되어 있어야 한다.
  - `gh auth login`으로 로그인하거나, SSH 키를 등록해두면 된다.
- Supabase 관련 작업(SQL 실행, Auth 설정 변경 등)은 코드가 아니라 [Supabase 대시보드](https://supabase.com/dashboard)에서 직접 하는 것이므로, 그 컴퓨터의 브라우저에서 Supabase 계정에 로그인하면 된다.
