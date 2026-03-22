# mdview

`mdview`는 터미널 중심(TUI) 워크플로우를 위한 로컬 Markdown 뷰어입니다.
쉘에서 탐색과 작업을 계속하면서, 브라우저 탭에서 Markdown과 Mermaid를 렌더링된 형태로 빠르게 확인할 수 있습니다.

## 문서
- English README (기본): [README.md](./README.md)
- 기여 가이드: [AGENTS.md](./AGENTS.md)
- 라이선스: [LICENSE](./LICENSE)

## 프로젝트 목적
이 프로젝트는 터미널 환경에서 개발하는 사용자가 문서를 원문 텍스트가 아닌 렌더링 결과로 바로 확인할 수 있도록 설계되었습니다.

- 제목, 표, 코드 블록, Mermaid 다이어그램을 정확히 렌더링
- 로컬 전용(`127.0.0.1`)으로 문서를 안전하게 확인
- 현재 열린 파일은 변경 시 자동 반영
- CLI 옵션으로 현재 프로젝트 또는 지정 문서 루트를 손쉽게 탐색

기본 스캔 동작:
- 최상위 `./*.md`
- `./docs/**` 재귀 스캔

## 핵심 기능
- 파일 목록과 미리보기를 제공하는 로컬 HTTP 뷰어
- `--root`로 사용자 지정 루트 스캔
- 현재 열린 파일 라이브 리로드(SSE + 파일 감시)
- 포그라운드/백그라운드 실행 모드
- `bun build --compile` 기반 단일 실행 파일 빌드

## 요구 사항
- [Bun](https://bun.sh/) 1.x+

## 개발 실행
```bash
bun start
```
접속 주소: `http://127.0.0.1:18094`

유용한 옵션:
```bash
# 포트 지정
bun src/server.js --port 18081

# 특정 루트 디렉터리 스캔
bun src/server.js --root ./docs

# 포그라운드 실행
bun src/server.js --foreground
```

## 빌드
```bash
bun run build
```
출력:
- macOS/Linux: `dist/mdview`
- Windows: `dist/mdview.exe`

## 배포
빌드 후 `~/bin`에 설치:
```bash
bun run deploy
```

`~/bin`이 PATH에 없는 경우:
```bash
# zsh
echo 'export PATH="$HOME/bin:$PATH"' >> ~/.zshrc && source ~/.zshrc

# bash
echo 'export PATH="$HOME/bin:$PATH"' >> ~/.bashrc && source ~/.bashrc
```

확인:
```bash
which mdview
mdview --help
```

## 사용 예시
```bash
# 현재 프로젝트 디렉터리 기준으로 실행
mdview

# 특정 문서 루트와 포트 지정
mdview --root ./docs --port 18094
```

## 프로젝트 구조
- `src/`: 서버, 파일 인덱싱, 경로 보호, 감시, UI 자산
- `scripts/`: 빌드 스크립트(`bun build --compile` 패키징)
- `vendor/`: 번들된 서드파티 브라우저 자산
- `dist/`: 생성된 빌드 결과물
