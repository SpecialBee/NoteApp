# 다른 컴퓨터에서 이어서 작업하기

배포된 사이트: https://note-app-gamma-wheat.vercel.app

> 상세 변경 이력·현재 기능은 [`CHANGELOG.md`](CHANGELOG.md) 참고. 앱 본체는 `www/index.html` 단일 파일 (2026-07-30부로 Capacitor 빌드를 위해 저장소 루트에서 `www/`로 이동함).

## 안드로이드 빌드 (Capacitor)

### 2026-07-30 작업 요약 (이 컴퓨터 기준)
- `index.html`/`icon.png`를 저장소 루트에서 `www/`로 이동, `package.json`·`capacitor.config.json`·`vercel.json`(`outputDirectory: "www"`) 추가, `npx cap add android`로 `android/` 네이티브 프로젝트 생성. 웹(Vercel)과 앱이 `www/index.html` 하나를 공유 — 갈라진 코드베이스 아님.
- 대시보드 "오늘의 한 장" 저장형 XSS 수정(`escapeHtml` 누락, 커밋 `445b15b` 이전). 전체 파일 XSS 재점검 완료, 추가 취약점 없음.
- 백그라운드 진입 시 저장 강제 플러시 추가 (`visibilitychange` + Capacitor `App` pause/appStateChange).
- `@capacitor/assets`로 아이콘·스플래시(라이트/다크) 생성.
- **Android 15 edge-to-edge 렌더링 버그를 발견·수정**: 앱이 상태표시줄 영역까지 뚫고 그려져서 그 자리의 버튼(햄버거 메뉴 등)이 터치가 전혀 안 먹는 문제. `viewport-fit=cover` + 주요 상단바(`.mobile-topbar`, `.toolbar`, `.brand`, `.tev-toolbar`, `.cev-toolbar`, `.graph-header`, 모바일 오른쪽 패널 오버레이, `#dashboardView`)에 `padding-top: calc(... + env(safe-area-inset-top))` 적용해서 해결. 에뮬레이터에서 adb tap으로 전 화면 실측 확인함.
- **이 컴퓨터에 Android Studio + JDK(번들) + Android SDK 전부 설치 완료.** 아래 "이 컴퓨터의 안드로이드 개발 환경" 참고.
- 에뮬레이터(`graphidea_test`, Pixel 6, API 35 google_apis x86_64)로 첫 빌드·설치·실행 성공, 여러 화면 실사용 테스트 통과.
- **실제 기기(갤럭시 S25, "현빈의 S25") 연결 진행 중 — 막힌 지점: 개발자 옵션의 "USB 디버깅" 스위치가 회색으로 비활성화됨.** 삼성 공식 USB 드라이버는 설치 완료(Windows가 기기를 정상 인식, MTP/모뎀 인터페이스는 잡히지만 ADB 인터페이스는 아직 안 잡힘). 다음에 이어서 할 것: 폰 알림창에서 USB 연결 모드를 "충전 전용"이 아닌 "파일 전송"으로 바꾼 뒤 USB 디버깅 스위치가 활성화되는지 확인 → 활성화되면 `adb devices`로 잡히는지 재확인.

### 이 컴퓨터의 안드로이드 개발 환경 (다른 컴퓨터라면 이 절차 전체를 새로 해야 함)
- JDK: Android Studio 번들 `C:\Program Files\Android\Android Studio\jbr` (별도 JAVA_HOME 설정 안 해도 되지만, 커맨드라인에서 gradlew 돌릴 땐 `export JAVA_HOME="C:\Program Files\Android\Android Studio\jbr"` 필요했음)
- Android SDK: `C:\Users\User\AppData\Local\Android\Sdk` (Android Studio 기본 설치 경로 그대로)
- **cmdline-tools(`sdkmanager`/`avdmanager`)는 기본 설치엔 없어서 별도로 받아 넣었음** — Google 공식 페이지(`developer.android.com/studio` → Command line tools only)에서 `commandlinetools-win-*.zip` 받아서 `<SDK>/cmdline-tools/latest/`에 압축 해제한 구조로 넣어야 함. (참고: 페이지에 뜨는 `edgedl.me.gvt1.com` 링크는 curl로 바로 받으면 404 남 — `https://dl.google.com/android/repository/commandlinetools-win-<build>_latest.zip` 형태로 받아야 실제 zip이 받아짐.)
- 에뮬레이터 실행에 **Windows Hypervisor Platform** 기능 켜야 했음 (`Windows 기능 켜기/끄기`에서 체크, 재시작 필요) — 이거 없으면 "x86_64 emulation currently requires hardware acceleration" 에러로 부팅 안 됨.
- 실제 기기 USB 연결에 **삼성 공식 USB 드라이버**(`developer.samsung.com/android-usb-driver`) 설치 필요했음 — 안 넣으면 Windows가 기기를 "USB Composite Device"로만 인식하고 adb가 아예 못 봄.
- 빌드·설치·실행 명령 (모두 `C:\Users\User\Documents\NoteApp` 기준):
  ```
  export JAVA_HOME="C:\Program Files\Android\Android Studio\jbr"
  export ANDROID_HOME="C:\Users\User\AppData\Local\Android\Sdk"
  npx cap sync android
  cd android && ./gradlew.bat assembleDebug
  "$ANDROID_HOME/platform-tools/adb.exe" install -r app/build/outputs/apk/debug/app-debug.apk
  "$ANDROID_HOME/platform-tools/adb.exe" shell am start -n com.specialbee.graphidea/.MainActivity
  ```
- 에뮬레이터 켜기: `"$ANDROID_HOME/emulator/emulator.exe" -avd graphidea_test`
- 화면 캡처(에뮬레이터/실기기 공통, 창을 못 봐도 됨): `adb exec-out screencap -p > out.png`

### 앱·웹 관계
- `www/index.html`이 웹·앱 공용 소스. 수정 후 `npx cap sync android`로 `android/`에 반영 (그래야 다음 빌드에 코드 변경분이 들어감).
- `android/` 폴더는 저장소에 커밋됨(Capacitor 표준 관행). `node_modules`, `android/**/build`, `local.properties`, `.idea/` 등은 `.gitignore`로 제외.
- `capacitor.config.json`의 `appId`(`com.specialbee.graphidea`)는 임시값 — Play 스토어에 최초 게시하면 이후 변경 불가하니 정식 출시 전 확정할 것.
- 정식 출시 전 아직 안 한 것(막는 건 아니고 개인용 빌드엔 불필요, Play 스토어 공개 배포 전엔 필수): 회원 탈퇴 기능, 개인정보처리방침/이용약관 페이지, 비밀번호 재설정 딥링크(현재 `redirectTo: window.location.href`라 앱 안에서 안 돌아옴), CDN(jsdelivr) Supabase SDK 번들 내장·버전 고정, 페이지네이션(현재 노트 전체를 매번 `select('*')`로 한번에 로드).

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
