# plAI-ground

모델을 고르면 Docker 환경과 Web IDE가 뜨고, 거기서 돌린 학습의 기록(에러, 수정 이력, 성능 변화, 스텝별 가중치)이 서명된 포트폴리오와 학습 시각화로 바뀌는 플랫폼.

## 구조

저장소 하나를 **배포 단위**로 나눈다. 앱끼리는 서로 import하지 않고, 패키지는 앱을 import하지 않는다.

```
apps/
  web/                      React SPA (Vite + Tailwind). 배포 대상: Cloudflare Pages
  host/                     GPU 호스트 API 서버. 배포 대상: GPU 호스트
    plaiground_host/
      server.py               진입점. 모든 /api/* 라우팅 표 (ROUTES)
      settings.py             환경변수를 읽는 유일한 곳 (apps/host/.env.example)
      paths.py                경로. 사용자별 workspace/telemetry/portfolio 폴더
      auth.py                 Supabase 토큰 검증 (PLAIGROUND_AUTH=supabase)
      viz/                    학습 시각화 기록 읽기 (/api/viz/*)
      workspace/              모델 카탈로그, 컨테이너 프로비저닝, 학습 스크립트 생성, 학습 템플릿
      portfolio/              텔레메트리 → Gemini 구조화 → 서명된 포트폴리오
      community/              커뮤니티 글, 상호작용, 실습 코드 스테이징
    docker/plaiground-base/   사용자 컨테이너 이미지 (CUDA + PyTorch + code-server)
packages/
  telemetry/                사용자 컨테이너 **안에서** 실행되는 SDK. 비밀과 서버 로직을 넣지 않는다
    plaiground_telemetry/     interceptor(에러), tracker(실행 요약), recorder(스텝별 가중치)
    FORMAT.md                 기록 파일 형식 명세 (format_version 1)
plaiground_deployment/      배포 계획과 인프라 설정
docs/                       제품·구현 현황 문서, 화면 스펙
scripts/check.py            1분 회귀 점검
var/                        런타임 데이터 (전부 gitignore). 소스 폴더에는 쓰지 않는다
  workspaces/<user>/        컨테이너에 /workspace로 마운트. 학습 스크립트 + .telemetry/
  portfolios/<user>/        생성된 포트폴리오 (마운트 밖)
  community/
```

학습 시각화(View AI)처럼 여러 배포 단위에 걸친 기능은 세 곳에 나뉘어 있다.
기록은 `packages/telemetry/plaiground_telemetry/recorder.py`, 읽기 API는 `apps/host/plaiground_host/viz/`, 화면은 `apps/web/src/ViewAI.jsx`, `Network3D.jsx`, `netLayout.js`.

## 설치

Python 3.10 이상, Node 20 이상. GPU 학습에는 Docker Desktop과 NVIDIA 드라이버.

```bash
pip install -e packages/telemetry -e apps/host
cd apps/web && npm install
```

컨테이너 이미지는 최초 1회, 그리고 SDK(`packages/telemetry`)를 고쳤을 때 저장소 루트에서 빌드한다.

```bash
docker build -f apps/host/docker/plaiground-base/Dockerfile -t plaiground-base:dev .
```

Gemini 키는 `apps/host/plaiground_host/portfolio/.env`에 둔다. 저장소에 올라가지 않는다.

```
GEMINI_API_KEY=...
GEMINI_MODEL=gemini-3.7-flash
```

## 실행

```bash
cd apps/web && npm run build && cd ../..      # 프론트를 고쳤을 때만
python -m plaiground_host.server              # http://127.0.0.1:8770
```

서버 설정(포트, 인증, CORS 등)은 환경변수로 준다. 목록은 `apps/host/.env.example`.

UI를 고치면서 볼 때는 터미널 두 개를 쓴다.

```bash
python -m plaiground_host.server              # 터미널 1
cd apps/web && npm run dev                    # 터미널 2, http://127.0.0.1:5173
```

## 점검

```bash
python scripts/check.py             # 파이썬 점검 + 프론트 빌드
python scripts/check.py --skip-web  # 파이썬 점검만
```

pytest 12건과 프론트 빌드. Docker와 GPU 없이 돈다. 전체 흐름(Start AI → Web IDE → 학습 → 포트폴리오 → View AI)은 이 점검으로 대체되지 않으므로 Docker를 켜고 직접 확인한다.

## 실제로 동작하는 것

| 화면 | 상태 |
|---|---|
| Start AI | 실동작. Docker/GPU 감지, 모델 카탈로그, 컨테이너 프로비저닝 |
| Web IDE | 실동작. 컨테이너의 code-server를 임베딩 |
| Portfolio | 실동작. 실제 학습 텔레메트리를 Gemini로 구조화해 웹에서 렌더링, MD/PDF 내보내기 |
| View AI | mnist-cnn-lite는 실데이터 재생. klue-bert, llama, gemma는 기록기 미연결 |
| Community | 글 40건은 시드 데이터. 추천·조회·댓글과 실습 코드 스테이징은 실동작 |
| Faculty LMS | 샘플 데이터. 관리자 로그인 시에만 표시 |

## 보안

API 서버는 docker 명령과 학습 파이프라인을 실행하므로 `127.0.0.1`에만 바인딩한다. 기본(`PLAIGROUND_AUTH=off`)은 인증이 없으므로 외부에 열면 원격 코드 실행이 된다. 사용자 컨테이너에는 `var/workspaces/<user>/`만 마운트되어 플랫폼 소스와 키가 보이지 않는다. Gemini 키는 요청 헤더 `X-Gemini-Key`로 받아 저장하지 않는다. 공개 배포 전에 해야 할 일은 [plaiground_deployment/MASTER_PLAN.md](plaiground_deployment/MASTER_PLAN.md)에 있다.

## 문서

- [plaiground_deployment/MASTER_PLAN.md](plaiground_deployment/MASTER_PLAN.md): 배포까지의 통합 실행 계획. 현재 진행 위치
- [docs/STATUS.md](docs/STATUS.md): View AI 구현 현황과 기술 부채
- [docs/MVP_STATUS.md](docs/MVP_STATUS.md): MVP 구현 상태 명세 (2026-09-08 시점 기록)
- [PRODUCT.md](PRODUCT.md), [apps/web/DESIGN.md](apps/web/DESIGN.md): 제품 방향과 디자인 시스템
- [docs/specs/](docs/specs/): 화면별 스펙

2026-09-21 이전 문서와 커밋에 나오는 폴더 이름은 다음과 같이 바뀌었다.

| 옛 이름 | 현재 위치 |
|---|---|
| `ai_set_demo/` | `apps/host/plaiground_host/workspace/` |
| `portfolio_demo/` | `apps/host/plaiground_host/portfolio/` |
| `portfolio_demo/telemetry/` | `packages/telemetry/plaiground_telemetry/` |
| `community_demo/` | `apps/host/plaiground_host/community/` |
| `web_combine_demo/api_server.py` | `apps/host/plaiground_host/api_server.py` |
| `web_combine_demo/app/` | `apps/web/` |
| `portfolio_demo/.telemetry/`, `output/` | `var/workspaces/local/.telemetry/`, `var/portfolios/local/` |
| `ai_set_demo/generated/` | `var/workspaces/local/` |
| `web_combine_demo/api_server.py` (2차) | `apps/host/plaiground_host/server.py` |
| `web_demo/` | 삭제됨. 스펙 문서만 `docs/specs/`로 이동 |
