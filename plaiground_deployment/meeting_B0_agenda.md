# B0 회의 안건 — 인터페이스 확정

작성일: 2026-09-22 · 참석: 박준형, 한상협 · 예상 1시간

이 회의의 목적은 하나다. **두 사람이 2주간 서로 기다리지 않고 따로 일할 수 있게, 만나는 지점을 전부 문서로 고정한다.** 회의가 끝나면 [../docs/interface.md](../docs/interface.md)가 "확정" 상태가 되고, 그 뒤로는 문서를 고치는 것이 곧 합의다.

## 회의 전에 각자 읽어 올 것

- [../docs/interface.md](../docs/interface.md) 전체 (10분)
- 상협: [assignment_edge_sanghyup.md](assignment_edge_sanghyup.md) 2장·3장
- 준형: [assignment_host_junhyung.md](assignment_host_junhyung.md) 4장(Stage C)

## 안건

### 1. 초대 확인 (5분)

상협이 아래 다섯 곳에 **본인 개인 계정으로** 들어갈 수 있는지 그 자리에서 확인한다.

- [ ] Bitwarden 조직 `menotis` — 컬렉션의 항목이 보이는가
- [ ] GitHub 조직 `menotis` — Owner인가
- [ ] Cloudflare — Members에 있는가
- [ ] Supabase 조직 `menotis` — `plaiground-dev` 프로젝트가 보이는가
- [ ] Tailscale — Machines에 상협 노트북이 나오는가 (Google 계정으로 로그인)

상협은 루트 Gmail·Cloudflare·Supabase의 2단계 인증 설정 키를 Bitwarden에서 꺼내 자기 인증 앱에 등록한다.

### 2. 인터페이스 문서 확정 (15분)

interface.md 1~3장은 이미 서버와 `api.js`에 구현된 그대로다. 바꿀 것이 없으면 그대로 확정하고, 있으면 문서를 고친다. 확인할 문장:

- 인증 헤더 `Authorization: Bearer <access_token>`, 모든 `/api/*`
- `X-Gemini-Key`는 `/api/portfolio/run`만
- SSE는 `fetch` 스트리밍, 400/401 본문은 `error` 이벤트로
- 커뮤니티 4개만 Supabase로 이동, `practice`는 호스트에 남음

### 3. Supabase 테이블 확정 (15분) — 가장 중요

[assignment_edge_sanghyup.md](assignment_edge_sanghyup.md) 3장의 표를 놓고 컬럼과 RLS를 확정한다. 호스트가 Stage C에서 쓰는 두 테이블(`runs`, `portfolios`)의 컬럼 이름이 여기서 정해지면 준형이 그대로 구현한다. 특히:

- `portfolios.data`(jsonb)에 들어가는 내용 = `/api/portfolio/data`가 지금 돌려주는 JSON 그대로. 맞는가
- `profiles.role`의 값: `student` / `faculty` / `admin`. 첫 `faculty`는 누가 어떻게 지정하나 (제안: Supabase 대시보드에서 수동)
- 댓글 작성자 표시 이름은 `profiles.display_name`에서 오는가, Google 프로필에서 오는가

### 4. 결정 사항 (10분)

| 항목 | 제안 | 결정 |
|---|---|---|
| 저장소 공개 여부 | 비공개 유지. 템플릿에 실습 정답이 있다 | |
| Cloudflare Pages 프로젝트 이름 | `plaiground` → `plaiground.pages.dev`. 이미 쓰였으면 `plaiground-app` | |
| Stage C 시연 목표일 | B2 완료 예상 + 1주 | |
| 시연 장소 | 준형 PC가 GPU 호스트. 대면 또는 Tailscale로 원격 | |

### 5. 노트북 기간 작업 방식 (5분)

이틀 뒤부터 두 사람이 노트북만 쓴다. 이 기간에는:
- 각자 로컬에서 작업한다 ([laptop_and_tailscale.md](laptop_and_tailscale.md) A장). 상협의 B2 작업은 GPU가 필요 없다.
- 준형 데스크톱이 꺼져 있으므로 Tailscale 접속 시연은 데스크톱 복귀 후.
- 준형의 `var/` 데이터는 zip으로 옮긴다. git에 넣지 않는다.

### 6. 협업 규칙 재확인 (5분)

- 브랜치 → `main`으로 PR. 상대가 확인 후 병합. 지금까지 병합은 준형이 로컬에서 했는데, GitHub에서 PR로 하려면 `gh` CLI 설치 또는 웹에서 PR 생성. 어느 쪽으로 할지 정한다.
- 폴더 소유권: `apps/host`, `packages/telemetry`는 준형. `apps/web`, `plaiground_deployment/supabase`, `docs`는 상협. 상대 폴더는 interface.md에 요청을 적는다.
- 막히면 30분 안에 상대에게 알린다. 한쪽이 멈추면 Stage C에 못 들어간다.
- 비밀은 Bitwarden에만. 채팅·문서·커밋에 키 값을 적지 않는다. `service_role` 키는 프론트에 절대 넣지 않는다.

## 회의 뒤 바로 할 일

- 준형: interface.md의 "초안" 표시를 "확정"으로 바꾸고 결정 사항을 반영해 커밋
- 상협: B2-2 시작 ([assignment_edge_sanghyup.md](assignment_edge_sanghyup.md) 4장)
