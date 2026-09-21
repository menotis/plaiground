# 디렉토리 구조 계획

작성일: 2026-09-21 · 기준 커밋: `6340c88` · 대상 독자: 박준형, 한상협

질문: `ai_set_demo`, `community_demo`, `portfolio_demo`는 `web_combine_demo` 밖에 있고 학습 시각화는 `web_combine_demo` 안에 있다. 유지보수와 업데이트를 생각하면 어떤 구조가 맞는가. 한 폴더 안에 나누기, 폴더를 따로 만들어 끌어오기, 하나의 소스로 통합하기 중 무엇인가.

## 0. 결론

**저장소는 하나로 유지하고, 그 안을 "배포 단위"로 나눈다.** 구체적으로는 `apps/`(배포되는 것)와 `packages/`(공유 라이브러리) 두 갈래의 모노레포이고, 백엔드는 기능별 모듈을 가진 하나의 앱으로 합친다.

- 폴더를 따로 만들어 끌어오는 방식(저장소 분리, git submodule)은 2인 팀에는 비용만 크다. 하지 않는다.
- 전부 한 소스로 통합하는 방식은 백엔드에는 맞고, 전체에는 맞지 않는다. 브라우저, GPU 호스트, 사용자 컨테이너는 서로 다른 곳에서 실행되기 때문이다.
- 이동은 **Phase 1을 시작하기 전에, 로직 변경 없는 "이동 전용 커밋" 한 번으로** 한다. 지금이 가장 싸다. 테스트가 없고, 파일이 60개 남짓이고, 상협이 아직 브랜치를 따지 않았다.

"실리콘밸리의 정답"은 하나로 정해져 있지 않다. 구글과 메타는 초대형 모노레포를 쓰고, 넷플릭스와 아마존은 서비스별 저장소를 쓴다. 다만 아래 2장의 원칙들은 회사 규모와 무관하게 거의 공통이고, 소규모 팀에 대한 권고는 "모노레포 + 모듈식 단일 백엔드"로 상당히 수렴해 있다.

---

## 1. 현재 구조 진단

폴더 이름은 기능을 만든 **순서**를 반영하고 있다. 실제 의존 관계를 코드에서 뽑으면 이렇다.

```
web_combine_demo ──import──> ai_set_demo.api_server   (핸들러 클래스 상속)
web_combine_demo ──import──> community_demo
web_combine_demo ──경로───> portfolio_demo/           (서브프로세스 실행 + 파일 읽기)
ai_set_demo      ──import──> portfolio_demo.telemetry (학습 템플릿 4개가 import)
ai_set_demo      ──경로───> portfolio_demo/.telemetry/viz
ai_set_demo      ──경로───> web_demo/app/dist         (구버전 프론트)
community_demo   ──경로───> ai_set_demo/generated
```

import 순환은 없다. 문제는 다른 데 있다.

| # | 문제 | 근거 | 왜 아픈가 |
|---|---|---|---|
| 1 | **기능 하나가 세 폴더에 우연히 흩어져 있다** | View AI: 기록기는 `portfolio_demo/telemetry/recorder.py`, API는 `ai_set_demo/api_server.py`, 화면은 `web_combine_demo/app/src/`. 질문에서 "시각화는 web_combine_demo에 있다"고 한 것 자체가 이 증상이다 | 버그가 나면 어디를 봐야 하는지 이름만으로 알 수 없다 |
| 2 | **신뢰 경계가 폴더에 드러나지 않는다** | `portfolio_demo` 안에 사용자 컨테이너에서 도는 코드(`telemetry/`)와 API 키를 쓰는 서버 코드(`llm/`)가 같이 있다 | 레포 전체를 컨테이너에 마운트하게 된 근본 원인. 배포 보안 문제가 여기서 나온다 |
| 3 | **폴더 간 경로가 하드코딩되어 있다** | 다른 패키지의 폴더를 가리키는 경로 상수 4개. `.telemetry/viz` 경로는 두 파일에 따로 정의 | 폴더 하나를 옮기면 조용히 깨진다 |
| 4 | **라우트 합성에 폴더 간 클래스 상속을 쓴다** | `web_combine_demo._Handler`가 `ai_set_demo._Handler`를 상속 | "이 URL은 누가 처리하나"를 두 파일을 오가며 읽어야 한다 |
| 5 | **런타임 데이터가 소스 폴더 안에 있다** | `portfolio_demo/.telemetry/`, `portfolio_demo/output/`, `ai_set_demo/generated/`, `community_demo/state.json` | `.gitignore`가 길어지고, 소스와 사용자 데이터가 같은 마운트에 섞인다 |
| 6 | **죽은 코드가 추적되고 있다** | `web_demo/` 20개 파일. `ai_set_demo/api_server.py`가 아직 그쪽 빌드를 정적 경로로 가리킨다 | 새로 온 사람이 구버전을 고친다 |
| 7 | **루트에 진입점이 없다** | 루트 README, 의존성 선언 파일, 테스트가 없다. 검증은 `demo()` 자체 점검 함수뿐 | 상협이 "어떻게 설치하고 실행하나"를 물어봐야 한다 |

---

## 2. 구조를 정하는 원칙

업계에서 규모와 무관하게 통하는 것들이다.

1. **구조는 배포 단위와 신뢰 경계를 따른다.** 어디서 실행되는가, 누가 통제하는 환경인가가 최상위 구분이다. 이 플랫폼은 실행 장소가 셋이다. 브라우저, GPU 호스트, 사용자 컨테이너. 셋은 의존성도, 배포 방법도, 비밀 접근 권한도 다르다.
2. **의존 방향은 한쪽으로만.** 앱은 패키지를 import할 수 있고, 패키지는 앱을 import하지 않는다. 앱끼리는 import하지 않고 HTTP나 파일 형식 같은 계약으로만 만난다.
3. **같이 바뀌는 것은 같이 둔다.** Dockerfile과 그 이미지를 띄우는 코드, 프롬프트와 그 출력 스키마처럼. 파일 종류별로 모으지 않는다. 최상위에 `models/`, `services/`, `utils/`를 두는 구조는 기능 하나를 고칠 때 모든 폴더를 돌게 만든다.
4. **여러 배포 단위에 걸친 기능은 같은 이름으로 흩어 둔다.** View AI는 기록(컨테이너), 읽기(호스트), 그리기(브라우저)로 나뉠 수밖에 없다. 한 폴더에 모을 수 없으니, 세 곳 모두에서 같은 이름을 쓴다. 그러면 찾을 곳이 세 군데로 고정된다.
5. **이름은 역할을 말한다.** `_demo`는 역사이지 역할이 아니다.
6. **소스와 런타임 데이터를 분리한다.** 실행 중 생기는 파일은 소스 트리 밖 한 곳에, 위치는 환경변수로.
7. **필요해질 때까지 나누지 않는다.** 저장소 분리, 마이크로서비스, 빌드 오케스트레이터(Turborepo, Nx, Bazel)는 팀이 여럿이고 배포 주기가 서로 다를 때의 도구다.

---

## 3. 세 가지 방식 비교

| | A. 모노레포 `apps/` + `packages/` (권장) | B. 저장소 분리 후 끌어오기 | C. 전부 하나의 소스로 통합 |
|---|---|---|---|
| 형태 | 저장소 1개, 배포 단위별 폴더 | 기능별 저장소, submodule이나 패키지 배포로 연결 | 폴더 1개에 프론트·백엔드·SDK 전부 |
| 여러 부분에 걸친 변경 | 커밋 1개, PR 1개 | 저장소마다 PR, 버전 맞추기 | 커밋 1개 |
| 신뢰 경계 표현 | 폴더로 드러난다 | 가장 강하다(접근 권한까지 분리) | 드러나지 않는다 |
| 운영 비용 | 낮다 | 높다. CI, 이슈, 릴리스가 저장소 수만큼. submodule은 "커밋을 깜빡해 남의 PC에서 깨지는" 사고가 잦다 | 가장 낮다 |
| 맞는 상황 | 1~수십 명, 부분들이 같이 바뀜 | 팀이 독립적, 외부 공개 범위가 다름, 배포 주기가 다름 | 배포 단위가 하나뿐일 때 |
| 이 프로젝트에서 | **적합** | 과하다 | 백엔드 내부에만 적합 |

B가 필요해지는 시점은 분명하다. 텔레메트리 SDK를 오픈소스로 공개하거나, 외주 개발자에게 프론트만 보여줘야 할 때다. A 구조에서는 그때 해당 폴더 하나를 저장소로 떼어내면 되므로, A는 B로 가는 길을 막지 않는다. 반대 방향은 훨씬 어렵다.

---

## 4. 목표 구조

```
plaiground/
├── README.md                     설치·실행 방법, 이 구조의 한 줄 설명
├── pyproject.toml                파이썬 워크스페이스 루트 (uv workspace)
│
├── apps/                         배포되는 것. 앱끼리는 서로 import하지 않는다
│   ├── web/                      React SPA → Cloudflare Pages
│   │   └── src/                  (현재 web_combine_demo/app)
│   │
│   └── host/                     GPU 호스트 API 서버 → GPU 호스트
│       ├── plaiground_host/
│       │   ├── server.py         라우팅 표 하나. URL → 핸들러가 한 파일에서 보인다
│       │   ├── settings.py       경로·포트·인증 설정. 환경변수를 읽는 유일한 곳
│       │   ├── workspace/        모델 카탈로그, 프로비저닝, 코드 생성, 학습 템플릿
│       │   │                     (현재 ai_set_demo)
│       │   ├── portfolio/        LLM 호출, 스키마, 렌더러, HTML 템플릿
│       │   │                     (현재 portfolio_demo에서 telemetry를 뺀 나머지)
│       │   ├── viz/              기록된 프레임 읽기 API
│       │   │                     (현재 ai_set_demo/api_server.py 안의 /api/viz 부분)
│       │   └── community/        실습 코드 스테이징만. 글·댓글은 Supabase로 이동
│       ├── docker/workspace-base/  사용자 컨테이너 이미지 (현재 ai_set_demo/docker)
│       └── tests/
│
├── packages/
│   └── telemetry/                사용자 컨테이너 **안에** 설치되는 pip 패키지
│       ├── plaiground_telemetry/   interceptor, tracker, recorder
│       │                           (현재 portfolio_demo/telemetry)
│       ├── FORMAT.md             schema.json / frames.bin / frames.jsonl 형식 명세
│       └── tests/
│
├── plaiground_deployment/        인프라 설정과 배포 문서 (Supabase, Cloudflare, GPU 호스트)
├── docs/                         PRODUCT.md, DESIGN.md, STATUS.md 등
└── var/                          런타임 데이터. 전부 gitignore. 위치는 환경변수로 변경 가능
    ├── telemetry/                (현재 portfolio_demo/.telemetry)
    ├── generated/                (현재 ai_set_demo/generated)
    └── output/                   (현재 portfolio_demo/output)
```

### 이 구조가 앞의 문제를 어떻게 푸는가

- **`packages/telemetry`가 분리의 핵심이다.** 이 코드만 적대적일 수 있는 환경(사용자 컨테이너)에서 실행된다. 그래서 비밀도, 플랫폼 로직도 들어가면 안 되고, 의존성도 다르다(torch만 필요, LLM SDK 불필요). 폴더가 나뉘면 "이 안에는 키를 다루는 코드를 넣지 않는다"는 규칙이 눈에 보이고, 컨테이너에는 이 패키지의 휠만 들어가므로 레포 마운트가 필요 없어진다. 배포 계획 Phase 1의 첫 항목과 같은 작업이다.
- **백엔드는 하나로 합친다.** 서버 두 개를 상속으로 잇는 대신, `server.py`의 라우팅 표 하나가 모든 URL을 보여준다. 기능은 `workspace/`, `portfolio/`, `viz/`, `community/` 모듈로 나뉘되 프로세스는 하나다. 마이크로서비스로 쪼갤 이유가 없다. 사용자도 서버도 아직 하나다.
- **경로 상수 4개가 `settings.py` 하나로 모인다.** 폴더를 옮겨도 고칠 곳이 한 곳이다.
- **`var/`로 런타임 데이터가 빠진다.** `.gitignore`가 짧아지고, "소스는 읽기 전용, 데이터는 `var/`"라는 구분이 컨테이너 마운트 설계와 그대로 맞물린다.

### View AI는 어디에 있게 되나

한 폴더에 모을 수는 없다. 기록은 컨테이너에서, 읽기는 호스트에서, 그리기는 브라우저에서 일어나기 때문이다. 대신 찾을 곳이 고정된다.

| 역할 | 위치 |
|---|---|
| 기록 | `packages/telemetry/plaiground_telemetry/recorder.py` |
| 파일 형식 명세 | `packages/telemetry/FORMAT.md` |
| 읽기 API | `apps/host/plaiground_host/viz/` |
| 화면 | `apps/web/src/` 의 `ViewAI.jsx`, `Network3D.jsx`, `netLayout.js` |

세 곳을 잇는 것은 코드가 아니라 **파일 형식**이다. 기록기가 쓰는 쪽이므로 형식의 주인은 `packages/telemetry`이고, 명세를 거기에 둔다. `schema.json`에 `format_version` 필드를 넣어 두면, 나중에 대형 모델용으로 저장 방식을 바꿀 때 예전 실행 기록을 구분해 읽을 수 있다.

### 프론트엔드 내부

`src/`는 지금 파일 11개짜리 평면 구조이고, 이 크기에서는 그대로가 맞다. 기능별 폴더(`src/features/view-ai/` 등)로 나누는 시점은 한 기능의 파일이 4~5개를 넘을 때다. 첫 후보는 이미 파일이 3개인 View AI다. JS 앱이 하나뿐이므로 pnpm workspace나 Turborepo는 넣지 않는다.

---

## 5. 이동 순서

원칙: **이동과 로직 변경을 같은 커밋에 섞지 않는다.** 섞으면 diff를 읽을 수 없고, 문제가 생겼을 때 원인이 이동인지 변경인지 가릴 수 없다. `git mv`를 쓰면 `git log --follow`로 파일 이력이 이어진다.

각 단계 뒤에 로컬에서 Start AI → Web IDE → 학습 → 포트폴리오 생성 → View AI 재생을 한 번 돌려 확인한다. 테스트가 없으므로 지금은 이것이 유일한 회귀 검사다.

| 순서 | 작업 | 종류 | 추정 시간 |
|---|---|---|---|
| 1 | `web_demo/` 삭제, `ai_set_demo/api_server.py`의 구버전 정적 경로 제거. 이력은 git에 남는다 | 삭제 | 20분 |
| 2 | `portfolio_demo/telemetry/` → `packages/telemetry/plaiground_telemetry/`. 학습 템플릿 4개와 `train_real.py`의 import 수정 | 이동 | 1시간 |
| 3 | 나머지를 `apps/host/plaiground_host/` 아래로. `web_combine_demo/app` → `apps/web` | 이동 | 2시간 |
| 4 | 루트 `README.md`, `pyproject.toml` 추가. 문서를 `docs/`로 | 추가 | 1시간 |
| 5 | 두 `api_server.py`를 `server.py` 라우팅 표 하나로 합치기. `/api/viz`를 `viz/` 모듈로 | **로직 변경** | 반나절 |
| 6 | `settings.py`로 경로 상수 통합, 런타임 데이터를 `var/`로 | **로직 변경** | 반나절 |
| 7 | `demo()` 자체 점검 함수들을 각 `tests/`로 옮겨 `pytest`로 실행되게 | 추가 | 1시간 |

1~4는 이동 전용이라 하루 안에 끝나고, 상협이 첫 브랜치를 따기 전에 `main`에 들어가야 한다. 5~7은 배포 계획 Phase 1의 작업과 겹치므로 그때 같이 한다.

주의할 점:
- 2번 뒤에는 이미 생성되어 있던 학습 스크립트(`ai_set_demo/generated/`)가 옛 import 경로를 갖고 있어 실행되지 않는다. Start AI에서 다시 세팅하면 새로 생성된다.
- 학습 템플릿 안의 **의도된 버그 줄은 건드리지 않는다.** 바뀌는 것은 맨 위 import 줄뿐이다.
- Cloudflare Pages의 빌드 디렉터리 설정이 `web_combine_demo/app`에서 `apps/web`으로 바뀐다. 배포 계획서 Phase 2에 반영할 것.
- `STATUS.md`, `MVP_STATUS.md` 등에 적힌 파일 경로가 전부 옛 경로가 된다. 4번에서 같이 고친다.

---

## 6. 피할 것

- **`utils/`, `common/`, `shared/` 폴더를 먼저 만들기.** 주인 없는 코드가 쌓이는 곳이 된다. 두 곳에서 실제로 쓰일 때 옮긴다.
- **git submodule.** 2인 팀에서 얻는 것 없이 사고만 늘린다.
- **기능마다 서버 프로세스 나누기.** 지금 규모에서는 배포와 디버깅만 어려워진다.
- **깊은 중첩.** 의미 있는 파일까지 폴더 4단계를 넘기지 않는다.
- **앱이 다른 앱의 폴더 경로를 직접 아는 것.** 지금의 경로 상수 4개가 이 경우다. 계약(HTTP, 파일 형식, 설정값)으로만 만난다.
- **빈 폴더 미리 만들기.** `packages/`에는 지금 `telemetry` 하나만 있으면 된다.

---

## 7. 결정이 필요한 것

1. 이동 1~4를 Phase 1 전에 할지. 권장은 "한다"이다.
2. `web_demo/` 삭제 여부. 되살릴 계획이 없다면 삭제를 권장한다.
3. 파이썬 패키지 이름. 이 문서는 `plaiground_host`, `plaiground_telemetry`로 가정했다.
4. `plaiground_deployment/` 이름 유지 여부. 업계에서는 보통 `infra/`라 부르지만 기능상 차이는 없다. 이 문서는 현재 이름을 유지하는 것으로 썼다.
