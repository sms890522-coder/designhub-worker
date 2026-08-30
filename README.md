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

## 설치 파일 배포

`v0.1.1`처럼 `v`로 시작하는 태그를 GitHub에 push하면 Actions가 macOS(`.dmg`, `.zip`)와 Windows(`.exe`) 설치 파일을 만들고 Release에 자동으로 올립니다. 서명 인증서를 연결하기 전에는 테스트용 unsigned 패키지가 생성되므로, 실제 사용자 배포 시에는 각 플랫폼의 코드 서명·공증을 반드시 추가하세요.
