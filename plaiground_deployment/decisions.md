# 결정 기록

한 줄씩. 바꾸면 줄을 지우지 말고 아래에 새 줄을 추가하고 옛 줄에 "→ 대체됨"을 붙인다. 채팅에 묻힌 결정은 없는 결정이다.

| 날짜 | 결정 | 이유 | 영향 |
|---|---|---|---|
| 2026-09-21 | 모노레포 `apps/` + `packages/`, 백엔드는 모듈식 단일 앱 | 2인 팀, 배포 단위·신뢰 경계 기준 | directory_plan.md |
| 2026-09-21 | 도메인·카드 없이 0원: Pages + Supabase + Tailscale | 예비창업, 외부 사용자 전까지 돈 쓸 이유 없음 | DEPLOYMENT_PLAN 8장 |
| 2026-09-21 | Gemini는 개인 사용자 BYOK, 기관은 플랫폼 키 | API 비용 0원, 데이터가 사용자 계정에 남음 | `X-Gemini-Key` 헤더 |
| 2026-09-22 | 저장소 `menotis/plaiground` **비공개 유지** | 학습 템플릿에 실습 정답이 있다 | 브랜치 보호는 합의로 |
| 2026-09-22 | 컨테이너 이미지는 ghcr.io **공개** | 비공개 패키지 무료 한도 500MB, 이미지 7.2GB. 내용에 비밀 없음 | `docker pull` 로그인 불필요 |
| 2026-09-22 | 로그인은 **Google만**. GitHub은 선택 | 학생은 Google 계정이 있고 BYOK도 Google | OAuth 클라이언트 1개 |
| 2026-09-22 | Supabase 스키마 확정: `supabase/migrations/0001_init.sql` | 회의 대신 문서로 확정 | 상협 B2-2는 "실행·검증" |
| 2026-09-22 | 역할 3개(`student`/`faculty`/`admin`). **첫 admin = 준형 개인 Google**, 이후 faculty는 admin이 `rpc('set_role')` | 대시보드 손작업을 1회로 제한, 앱 안에서 관리 | `0002_roles.sql` |
| 2026-09-22 | Cloudflare Pages 프로젝트 이름 **`plaiground`** → `plaiground.pages.dev`. 이미 쓰였으면 `plaiground-app` | 짧고 제품명과 같음 | Supabase Redirect URL에 등록 |
| 2026-09-22 | PR은 **gh CLI**, 병합은 **Squash**, 리뷰는 상대, 작성자가 병합 | `main` 이력을 PR 단위로 | CONTRIBUTING.md |
| 2026-09-22 | CI: GitHub Actions가 PR마다 `check.py`와 같은 점검 | 두 사람이 서로의 PR을 안 돌려봐도 됨 | `.github/workflows/check.yml` |
| 2026-09-22 | 노트북 기간: 각자 로컬, GPU 작업은 데스크톱 복귀 후, `var/`는 zip으로 | Tailscale 호스트가 꺼져 있음 | laptop_and_tailscale.md |
| 2026-09-22 | Stage A 관문 통과: 상협이 5개 서비스(Bitwarden·GitHub·Cloudflare·Supabase·Tailscale)에 개인 계정으로 접속 확인 | | Stage B 병행 시작 |
| 2026-09-22 | Tailscale Serve는 HTTPS만 켜고 **Funnel은 끔**. 연결 시험은 Stage C 시점에 | 인증 꺼진 서버를 인터넷에 열 수 있는 기능이라 | laptop_and_tailscale.md B장 |
| 2026-09-22 | 병합된 브랜치는 삭제. `feat/api-client`, `feat/api-headers`, `stage-b/host-refactor` 삭제됨 | 남은 브랜치 = 진행 중인 작업 | |

## 미결

| 항목 | 언제 정하나 |
|---|---|
| Stage C 시연 날짜·장소 | 2026-09-22로 잡았으나 조건 미충족(상협 노트북 tailnet 미가입, 데스크톱 이틀 뒤 부재, B2 미완)으로 연기. 상협 B2-5 끝나고 준형 데스크톱 복귀 후 |
| `plaiground-prod` Supabase 프로젝트 생성 시점 | Pages 연결(B2-6) 직전 |
| 외부 사용자용 도메인 구매 | 첫 파일럿 상대가 정해질 때 (DEPLOYMENT_PLAN 8장) |
