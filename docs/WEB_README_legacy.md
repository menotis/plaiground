# web_combine_demo 실행 방법

`ai_set_demo`(원클릭 환경 세팅)와 `portfolio_demo`(검증형 포트폴리오 파이프라인)를
하나의 플랫폼 웹페이지로 묶은 통합 데모다. 랜딩 페이지 + 콘솔(Start AI / Web IDE /
View AI / Portfolio)로 구성되며, **Faculty LMS 탭은 우측 상단 Login에서 관리자로
로그인했을 때만 나타난다** (학생/관리자 역할 선택은 데모용 클라이언트 상태).

## 실제로 동작하는 것과 시뮬레이션

| 화면 | 실체 | 백엔드 |
|---|---|---|
| Start AI 위저드 | 실제 실행 — Docker/GPU 감지, 모델 카탈로그, SSE 프로비저닝 | `GET /api/status` `/api/models` `/api/setup` |
| Web IDE | 실제 — 컨테이너의 code-server iframe 임베딩 | http://127.0.0.1:8080 |
| Portfolio | 실제 실행 — run_demo.py 파이프라인 실행 후 스키마 JSON을 받아 **웹 네이티브로 렌더링** (원본 HTML은 보조 링크) | `GET /api/portfolio/run`(SSE) `/data` `/output` `/telemetry` |
| View AI | 시뮬레이션 (화면에 SIMULATION 배지 표기) | 없음 |
| 커뮤니티 | 글 40건은 데모 시드(SAMPLE DATA 배지)지만 추천·조회·즐겨찾기 카운트는 서버에 실제 누적되고(`community_demo/state.json`), '실습해보기'는 글의 코드를 `ai_set_demo/generated/`에 실제로 저장해 Web IDE에서 실행 가능. 인용된 데이터셋·출처(KLUE·NSMC·KorQuAD·AI허브·Kaggle 등)는 전부 실재 | `GET /api/community/posts` · `POST /api/community/interact` `/practice` |
| Faculty LMS | 샘플 데이터 (화면에 SAMPLE DATA 배지 표기, 관리자 전용) | 없음 |

## 방법 1. 한 프로세스로 실행 (권장)

```bash
cd web_combine_demo/app && npm install && npm run build   # 최초 1회
cd ../.. && python -m web_combine_demo.api_server
```

→ http://127.0.0.1:8770

## 방법 2. UI를 고치면서 볼 때 (HMR)

```bash
python -m web_combine_demo.api_server        # 터미널 1 (8770)
cd web_combine_demo/app && npm run dev       # 터미널 2 → http://127.0.0.1:5173
```

## 사전 조건

- Start AI 실행에는 Docker Desktop + `plaiground-base:dev` 이미지 필요
  (위저드 1단계에서 실시간 확인됨)
- Portfolio 실행은 Docker 없이도 동작 (Gemini 키 없으면 Mock 서사로 폴백)

## 보안

API 서버는 docker 명령과 파이프라인을 실행하므로 `127.0.0.1`에만 바인딩한다.
외부에 노출하면 원격 코드 실행이 된다 — `0.0.0.0`으로 열지 말 것.
