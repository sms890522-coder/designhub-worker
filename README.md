# DesignHub Worker

DesignHub Factory의 로컬 생성 프로그램입니다. 홈페이지에서 작업을 예약하면 이 프로그램이 공식 Codex CLI를 통해 사용자의 ChatGPT 계정으로 이미지를 만들고, 디자인허브 규격으로 정리한 뒤 결과를 업로드합니다.

## 보안 원칙

- ChatGPT 비밀번호와 API 키를 입력받거나 서버로 보내지 않습니다.
- 로그인은 Codex CLI의 공식 브라우저 인증 흐름에서 직접 진행합니다.
- 홈페이지 연결 토큰은 Electron `safeStorage`로 운영체제 보안 저장소에 암호화합니다.
- 각 작업은 전용 임시 폴더에서 실행하고 완료 후 삭제합니다.

## 개발 실행

1. Node.js 22 이상과 공식 Codex CLI를 설치합니다.
2. Codex CLI에서 ChatGPT 계정으로 로그인합니다.
3. `npm install` 후 `npm run dev`를 실행합니다.
4. 홈페이지에서 기기 연결 코드를 만들고 프로그램에 입력합니다.

공개 배포 전에는 Apple Developer ID 공증과 Windows 코드 서명 인증서를 GitHub Actions에 연결해야 합니다. 현재 `gpt-image-skill` 코드는 재배포하지 않고, 공식 Codex CLI를 호출하는 독립 어댑터만 사용합니다.

## macOS 서명·공증 설정

macOS에서 “손상되어 열 수 없음” 또는 개발자를 확인할 수 없다는 메시지가 나오지 않게 하려면 Apple Developer의 `Developer ID Application` 인증서와 공증 인증을 사용해야 합니다. GitHub 저장소의 **Settings → Secrets and variables → Actions**에 아래 5개 Secret을 등록하세요.

- `MAC_CSC_LINK`: `.p12` 인증서를 base64로 인코딩한 값
- `MAC_CSC_KEY_PASSWORD`: `.p12` 내보내기 비밀번호
- `APPLE_ID`: Apple Developer 계정 이메일
- `APPLE_APP_SPECIFIC_PASSWORD`: appleid.apple.com에서 만든 앱 전용 비밀번호
- `APPLE_TEAM_ID`: Apple Developer Team ID

이 값들은 소스 코드에 저장하지 않습니다. `v*` 태그를 push하면 Actions가 서명하고, Hardened Runtime을 적용한 뒤 Apple 공증 티켓을 stapling한 `.dmg`와 `.zip`을 Release에 업로드합니다. Secret이 빠진 릴리스는 unsigned 설치 파일이 배포되지 않도록 빌드 단계에서 실패합니다.

## 설치 파일 배포

`v0.1.4`처럼 `v`로 시작하는 태그를 GitHub에 push하면 Actions가 macOS(`.dmg`, `.zip`)와 Windows(`.exe`) 설치 파일을 만들고 Release에 자동으로 올립니다. macOS 빌드는 Developer ID 서명과 Apple 공증을 통과한 뒤 게시됩니다. 실제 사용자 배포는 서명·공증 릴리스의 설치 파일을 사용하세요.

프로그램 화면에서 `Codex CLI를 찾지 못했습니다`가 표시되면 공식 Codex CLI를 설치한 뒤 터미널에서 `codex login`을 완료하고 Worker를 다시 시작하세요. 릴리스 태그가 이미 존재하는 경우에도 Actions가 기존 릴리스에 새 산출물을 업로드하도록 구성되어 있습니다.
