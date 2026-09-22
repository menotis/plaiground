# plAI-ground — 에이전트 인수인계 문서

작성일: 2026-09-22 · 기준 커밋: `main` (`4a62a5c` 이후) · 독자: 이 저장소에서 작업을 이어받는 AI 에이전트

이 문서는 "지금 무엇을 왜 하고 있는가"를 5분 안에 파악하게 하는 것이 목적이다. 앞으로 할 일의 순서는 여기 적지 않는다. 그것은 [plaiground_deployment/MASTER_PLAN.md](../plaiground_deployment/MASTER_PLAN.md)와 개인별 분담서가 원본이고, 현재 위치는 [plaiground_deployment/README.md](../plaiground_deployment/README.md)의 "현재 위치"가 기준이다. 작업 규칙은 [CLAUDE.md](../CLAUDE.md)와 [CONTRIBUTING.md](../CONTRIBUTING.md)를 따른다.

## 1. 무엇을 만드는가

**plAI-ground**는 AI를 배우는 대학생을 위한 실습 플랫폼이다. 팀 이름은 MENOTIS(예비창업, 2인: 박준형·한상협).

사용자 흐름은 하나다.

1. **Start AI** — 모델(mnist CNN, klue-bert, Llama-3.2-1B LoRA, Gemma-4-E2B LoRA)을 고르면 Docker 컨테이너와 웹 IDE(code-server)가 뜬다. 학습 스크립트는 템플릿에서 생성된다.
2. **Web IDE** — 학생이 그 스크립트를 실행한다. **템플릿에는 의도된 오류가 심어져 있다.** 첫 실행은 실패하고, 학생이 원인을 찾아 고치는 것이 실습이다. 이 오류는 절대 고치면 안 된다(CLAUDE.md).
3. **텔레메트리** — 컨테이너 안의 SDK(`plaiground_telemetry`)가 에러 이력, 실패→성공 수정 diff, 데이터셋·성능 요약, 스텝별 가중치 프레임을 기록한다.
4. **Portfolio** — 그 기록을 Gemini가 구조화하고(에러별 원인·해결, 전처리, 성능 향상), SHA-256 해시를 붙여 포트폴리오로 만든다. MD/PDF 내보내기. 학생의 취업 지원서에 첨부하는 산출물이다.
5. **View AI** — 학습 중 저장된 스텝별 가중치를 노드·엣지 애니메이션으로 재생한다. 슬라이더로 스텝을 고르고 노드를 클릭하면 그 시점 값이 보인다. 현재 mnist만 연결됨.
6. **Community** — 오류 해결·학습 결과·Q&A·데이터 글 40건, 댓글, "실습해보기"로 코드가 IDE 워크스페이스에 들어간다.
7. **Faculty LMS** — 교수용 학생 현황 화면. 아직 샘플 데이터.

**핵심 가치 문장:** "환경 세팅 5분, 디버깅 과정이 그대로 검증형 포트폴리오가 된다."

**수익 모델:** 개인은 무료(Gemini 키를 본인이 넣는 BYOK), 기관(교수 패키지)은 유료. 지금은 매출 전, 파일럿 전 단계.

## 2. 구조

저장소 하나(`github.com/menotis/plaiground`, 비공개)를 배포 단위로 나눈 모노레포다.

| 위치 | 실행 장소 | 내용 | 소유 |
|---|---|---|---|
| `apps/web/` | 브라우저 (Cloudflare Pages 예정) | React 19 + Vite + Tailwind SPA. `src/api.js`가 모든 API 호출 | 상협 |
| `apps/host/plaiground_host/` | GPU 호스트 (지금은 준형 PC) | stdlib `http.server` 기반 API. `server.py`의 `ROUTES` 표가 전부. `workspace/`(프로비저닝·템플릿), `portfolio/`(Gemini·렌더), `viz/`(프레임 읽기), `community/`, `auth.py`, `settings.py`, `paths.py` | 준형 |
| `apps/host/docker/plaiground-base/` | 사용자 컨테이너 이미지 | CUDA + PyTorch + code-server + 텔레메트리 SDK. `ghcr.io/menotis/plaiground-base:dev` (공개, 7.2GB) | 준형 |
| `packages/telemetry/plaiground_telemetry/` | **사용자 컨테이너 안** | interceptor(에러), tracker(요약), recorder(가중치). 적대적 환경이므로 비밀·서버 로직 금지. 형식 명세 `FORMAT.md` | 준형 |
| `plaiground_deployment/` | — | 배포 계획, 결정 기록, Supabase 마이그레이션, 분담서 | 공동 |
| `var/` | 호스트 | 런타임 데이터. gitignore. `workspaces/<user>/`(컨테이너에 마운트), `portfolios/<user>/`, `community/` | — |

두 층이 만나는 규칙은 [docs/interface.md](interface.md)(확정). 데이터 층은 Supabase(= 관리형 PostgreSQL): `profiles, posts, comments, post_interactions, runs, portfolios`, 전부 RLS. 스키마 원본은 `plaiground_deployment/supabase/migrations/`.

## 3. 지금 하고 있는 일: 로컬 데모 → 배포 전환

2026-09-21에 시작했다. 그 전까지는 준형 PC 한 대에서 한 사람이 쓰는 데모였고, 레포 전체가 컨테이너에 마운트되어 IDE에서 플랫폼 소스와 API 키가 보였다. 이것을 여러 사용자가 인터넷에서 쓰는 서비스로 바꾸는 것이 현재 작업이다. **돈은 0원**으로 간다(도메인·카드 없음, 전부 무료 등급).

| 단계 | 내용 | 상태 (2026-09-22 저녁) |
|---|---|---|
| Stage A | 폴더 구조 재편(모노레포), 계정·조직(Bitwarden, 루트 Gmail `menotis.team`, Cloudflare, GitHub 조직, Supabase, Tailscale, Google OAuth) | **완료** |
| Stage B · B1 | 호스트 리팩터: `settings.py`, 사용자별 워크스페이스, 레포 마운트 제거, `server.py` 통합, 인증 훅·CORS, Gemini BYOK 헤더, pytest 12건 | **완료, main** |
| Stage B · B0 | 인터페이스·스키마·협업 규칙 확정 (회의 대신 문서로) | **완료** |
| Stage B · B2 | 엣지 층: B2-1 `api.js`, 헤더, B2-2 스키마 적용, B2-3 글 시드, BYOK 입력 칸, B2-4 Google 로그인 | **B2-4까지 완료·검증.** 준형이 로컬에서 Google 로그인 → admin 전환까지 확인 |
| Stage B · B2 | B2-5 커뮤니티를 Supabase 직접 호출로, B2-6 Cloudflare Pages, B2-7 호스트 오프라인 안내 | 상협 진행 예정 |
| Stage C | 준형 PC를 Tailscale로 상협 노트북에 연결해 전체 흐름 시연 | B2 뒤. 준비(HTTPS, Serve 활성화)는 끝남 |
| Stage D | 사용자별 컨테이너 격리, 이그레스 제한, 서명, 약관·백업 | 미착수 |

현재 열린 PR은 없다. 두 사람은 이틀 뒤부터 노트북만 쓴다(절차: `plaiground_deployment/laptop_and_tailscale.md`).

## 4. 실행과 점검

```bash
pip install -e packages/telemetry -e apps/host
cd apps/web && npm install && cd ../..
docker pull ghcr.io/menotis/plaiground-base:dev
python scripts/check.py                 # pytest + 프론트 빌드. 작업 끝에 반드시
python -m plaiground_host.server        # http://127.0.0.1:8770
cd apps/web && npm run dev              # http://localhost:5173
```

로컬 비밀 파일(git 밖): `apps/host/plaiground_host/portfolio/.env`(Gemini 키), `apps/web/.env.local`(Supabase URL·anon 키). 이 파일들을 읽거나 값을 옮겨 적지 않는다.

## 5. 이미 부딪힌 함정 (다시 밟지 말 것)

| 증상 | 원인 | 해결 |
|---|---|---|
| Docker가 8080을 못 열음 ("ports are not available") | Windows가 8002~8101을 예약 | 관리자 PowerShell: `net stop winnat` → `netsh int ipv4 add excludedportrange protocol=tcp startport=8080 numberofports=1` → `net start winnat` |
| 이미지에 SDK가 `UNKNOWN-0.0.0`으로 설치됨 | Ubuntu 22.04의 pip 22/setuptools 59가 `pyproject` `[project]`를 못 읽음 | Dockerfile에서 `pip install "pip>=24" "setuptools>=68"` 먼저 (이미 반영) |
| 이미지 빌드 시 `COPY entrypoint.sh` 실패 | 빌드 컨텍스트가 저장소 루트 | 전체 경로로 COPY (반영). 빌드는 루트에서 `-f` 지정 |
| Supabase SQL Editor에서 `role` 변경이 트리거에 막힘 | SQL Editor는 `postgres` 역할이라 `auth.role()`이 비어 있음. `service_role`이 아님 | 트리거는 `auth.uid() is not null`일 때만 검사 (0004 반영). RLS·트리거 설계 시 기억할 것 |
| Google 로그인 후 "Unable to exchange external code" | Supabase에 넣은 Google Client Secret 불일치 | Secret 재발급 후 다시 붙임 |
| Google 로그인 후 아무 메시지 없이 랜딩으로 돌아옴 | Supabase가 오류를 `#error=...`로 붙여 보내는데 해시 라우터가 무시 | 주소창 전체를 확인. 오류 해시를 화면에 보여 주는 개선은 미착수 |
| SSE가 몇 분간 멈춘 것처럼 보임 | 서브프로세스 stdout 블록 버퍼링 | `PYTHONUNBUFFERED=1` (반영) |
| Gemini 503/429 | 무료 등급 모델당 하루 20회, 과부하 | `.env`의 `GEMINI_MODEL`을 다른 flash 모델로. 재시도는 2회로 제한됨. 실패 시 가짜 서사 대신 중단 |
| `EventSource`로는 헤더를 못 붙임 | 표준 제약 | `api.js`의 `apiStream`이 fetch 스트리밍으로 파싱 (반영) |
| 재세팅하면 학생이 고친 스크립트가 템플릿으로 덮어써짐 | 옛 동작 | 이미 있으면 유지 (반영) |
| Docker Desktop이 세션마다 꺼져 있음 | 사용자 PC 설정 | `docker info` 실패 시 Docker Desktop을 켜고 최대 4분 대기 |
| `gh`가 Git Bash PATH에 없음 | 설치 위치 | `"/c/Program Files/GitHub CLI/gh.exe"` 전체 경로. 인증은 `00PJH` 계정으로 되어 있음 |

## 6. 사람과 역할

- **박준형** — GPU 호스트 층(`apps/host`, `packages/telemetry`, 이미지). GitHub `00PJH`, 조직 `menotis` Owner. 첫 admin 계정. GPU PC(RTX)를 가진 유일한 사람.
- **한상협** — 엣지 층(`apps/web`, `plaiground_deployment/supabase`, `docs`). GitHub `hans6988`. Claude Code를 쓰며 저장소 `CLAUDE.md`를 따른다. B2-1~B2-4를 하루에 끝냈다.
- 두 사람은 브랜치 → PR → 상대 리뷰 → 작성자 Squash merge. `main` 직접 푸시 금지. CI(`.github/workflows/check.yml`)가 PR마다 점검을 돈다.

## 7. 에이전트가 특히 지킬 것

1. 학습 템플릿의 `[실습 과제 · 의도된 오류]`는 고치지 않는다. 설명만 한다.
2. `var/` 아래를 지우거나 덮어쓰지 않는다. 학습 기록은 재생성 비용이 크다. 점검은 임시 폴더에서.
3. 비밀 값을 채팅·문서·커밋에 옮기지 않는다. `.env`, `.env.local`을 읽지 않는다. `service_role` 키는 프론트·컨테이너 금지.
4. 상대 폴더를 고칠 때는 `docs/interface.md`에 적고 PR 설명에 이유를 쓴다.
5. 결정은 `plaiground_deployment/decisions.md`에 한 줄. 진행 위치는 `plaiground_deployment/README.md`.
6. 답변은 한국어. 사용자는 한국어로 묻고, 영어로 단계별 사고 후 한국어로 답하기를 원한다.
