# 협업 규칙

2인 팀 기준. 규칙은 적을수록 지켜진다. 아래가 전부다.

## 브랜치와 PR

- `main`은 항상 배포 가능한 상태다. **직접 푸시하지 않는다.** 문서만 고칠 때도 브랜치를 쓴다.
- 브랜치 이름: `feat/b2-2-schema`, `fix/8080-port`, `docs/interface`. 계획서 작업 번호가 있으면 넣는다.
- PR 하나에 작업 하나. 300줄을 넘으면 나눈다. 큰 diff는 사람도 AI도 제대로 못 읽는다.
- **파일 이동과 로직 변경을 한 PR에 섞지 않는다.**
- PR 본문은 템플릿(`.github/pull_request_template.md`)을 채운다. 무엇을, 왜, 어떻게 확인했는지.
- 리뷰는 상대가 한다. 승인 후 **작성자가 Squash merge**로 병합하고 브랜치를 지운다. `main` 이력이 PR 하나 = 커밋 하나로 남는다.
- 무료 플랜의 비공개 저장소는 브랜치 보호 규칙을 강제할 수 없다. 이 규칙은 합의로 지킨다.
- 상대가 24시간 안에 리뷰를 못 하면, 문서·설정처럼 되돌리기 쉬운 변경은 셀프 머지하고 알린다. 코드 변경은 기다린다.

## 커밋 메시지

`type(scope): 한 줄 요약` — type은 `feat`, `fix`, `refactor`, `docs`, `test`, `chore`. scope는 `host`, `web`, `telemetry`, `deploy`. 예: `feat(web): 포트폴리오 화면에 Gemini 키 입력 칸`. 본문은 "왜"가 있을 때만.

## 완료 기준 (Definition of Done)

1. `python scripts/check.py` 통과 (pytest + 프론트 빌드). CI가 같은 것을 돌린다.
2. 로직을 바꿨으면 그 로직이 깨졌을 때 실패하는 테스트 하나.
3. 사용자에게 보이는 변화가 있으면 PR에 스크린샷 또는 한 줄 설명.
4. 인터페이스(헤더, 엔드포인트, 테이블)를 바꿨으면 `docs/interface.md`를 같은 PR에서 고친다.

## 폴더 소유권

| 폴더 | 소유 | 상대가 고쳐야 할 때 |
|---|---|---|
| `apps/host/`, `packages/telemetry/`, `apps/host/docker/` | 준형 | `docs/interface.md`에 요청을 적고 알린다 |
| `apps/web/`, `plaiground_deployment/supabase/`, `plaiground_deployment/cloudflare/`, `docs/` | 상협 | 같음 |
| `plaiground_deployment/*.md`, `README.md`, `CLAUDE.md`, `CONTRIBUTING.md` | 공동 | PR로 |

소유는 "책임"이지 "독점"이 아니다. 급한 한 줄 수정은 상대 폴더라도 PR을 올리고 설명에 이유를 적으면 된다.

## 비밀

- 키, 토큰, 비밀번호는 Bitwarden 조직 컬렉션에만. 채팅·이슈·커밋·문서에 값을 적지 않는다.
- `.env`, `.env.local`, `.dev.vars`는 gitignore. 저장소에는 `.env.example`에 변수 이름만.
- Supabase `service_role` 키는 GPU 호스트 환경변수에만. 프론트·컨테이너에 절대 넣지 않는다.
- 실수로 커밋했으면 즉시 알리고 키를 **재발급**한다. 이력에서 지우는 것으로는 부족하다.

## 소통

- 비동기가 기본. 하루 한 번 "어제 한 것 / 오늘 할 것 / 막힌 것" 세 줄을 남긴다. 회의는 결정이 필요할 때만.
- 막히면 30분 안에 알린다. 한쪽이 멈추면 다른 쪽도 Stage C에 못 들어간다.
- 결정은 `plaiground_deployment/decisions.md`에 한 줄로 남긴다. 채팅에 묻힌 결정은 없는 결정이다.
- 진행 위치는 `plaiground_deployment/README.md`의 "현재 위치"가 기준이다.

## AI 코딩 도구

두 사람 모두 Claude Code를 쓴다. 저장소 루트의 `CLAUDE.md`가 자동으로 읽히므로 거기 적힌 금지 사항이 곧 팀 규칙이다. 도구가 만든 변경도 같은 PR 규칙을 따르고, 작성자가 내용을 이해하고 있어야 한다. 도구에 `.env`를 읽히지 않는다.

## 노트북만 쓰는 기간

- 각자 로컬에서 작업한다. 절차는 `plaiground_deployment/laptop_and_tailscale.md` A장.
- GPU가 필요한 작업(학습 시연, Tailscale 접속 시험)은 준형의 데스크톱 복귀 후로 미룬다. 상협의 B2는 GPU가 필요 없다.
- 시작할 때 `git pull`, 끝날 때 PR. 브랜치를 며칠 묵히지 않는다.
- 학습 기록(`var/`)은 git에 넣지 않는다. 옮겨야 하면 zip으로.

## 도구

- GitHub CLI: `winget install GitHub.cli` → `gh auth login` (브라우저 인증, HTTPS 또는 SSH 선택).
  - PR 만들기: `gh pr create --fill` (브랜치에서)
  - 리뷰 후 병합: `gh pr merge --squash --delete-branch`
  - 목록: `gh pr list`, 확인: `gh pr checks`
- CI: `.github/workflows/check.yml`이 PR마다 `scripts/check.py`를 돌린다. 빨간불이면 병합하지 않는다.
