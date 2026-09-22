# plaiground_deployment

plAI-ground를 로컬 데모에서 실제 배포로 옮기는 작업 공간. 배포에 필요한 문서, 설정, 코드는 전부 이 폴더에서 만든다.

## 먼저 읽을 것

**[MASTER_PLAN.md](MASTER_PLAN.md) — 통합 실행 순서. 무엇을 언제 누가 하는지는 이 문서를 따른다.** 아래 두 문서는 상세와 근거다.

[DEPLOYMENT_PLAN.md](DEPLOYMENT_PLAN.md) — 지금 막혀 있는 것, 예비 작업 체크리스트, 단계별 로드맵, 역할 분담, 두 층 사이의 인터페이스, 보안 점검표.

[directory_plan.md](directory_plan.md) — 저장소 디렉토리 구조 진단과 목표 구조, 이동 순서. Phase 1 전에 읽는다.

개인별 분담 업무: [assignment_host_junhyung.md](assignment_host_junhyung.md)(GPU 호스트 층, 준형) · [assignment_edge_sanghyup.md](assignment_edge_sanghyup.md)(엣지 층, 상협). 각자 이것만 보고 일해도 되게 썼다.

[decisions.md](decisions.md) — 결정 기록. 회의 대신 여기서 확정한다.

[supabase/](supabase/) — 확정 스키마(`migrations/`)와 적용 절차.

[meeting_B0_agenda.md](meeting_B0_agenda.md) — B0 안건. 대부분 문서로 결정됨, 초대 확인과 시연 날짜만 남음.

[laptop_and_tailscale.md](laptop_and_tailscale.md) — 노트북에서 로컬로 실행하는 절차와 Tailscale로 호스트에 접속하는 절차(Stage C).

현재 구현 상태는 [../docs/STATUS.md](../docs/STATUS.md).

## 현재 위치

Stage B 진행 중. **B1(호스트 리팩터)과 B2-1(api.js) `main` 병합 완료 (2026-09-22).** 저장소는 `menotis/plaiground`. B0(인터페이스·스키마·규칙)은 문서로 확정됨. 남은 것: 상협 B2-2~B2-7, 그 뒤 Stage C. 최근 전달 사항: [handoff_2026-09-22.md](handoff_2026-09-22.md).

## 앞으로 이 폴더에 생길 것

실제로 필요해지는 단계에서 만든다. 미리 빈 폴더를 만들지 않는다.

| 경로 | 내용 | 만드는 단계 |
|---|---|---|
| `supabase/` | 마이그레이션 SQL, RLS 정책, 커뮤니티 시드 | Phase 2 |
| `cloudflare/` | Pages 설정 | Phase 2 |
| `gpu_host/` | 컨테이너 실행 설정, 리버스 프록시, 강화 옵션 | Phase 3~4 |
| `docs/` | 약관, 장애 대응 절차 | Phase 5 |

## 규칙

- 비밀(키, 토큰, 비밀번호)은 저장소에 올리지 않는다. Bitwarden에만 두고, 여기에는 변수 이름만 적은 `.env.example`을 둔다.
- `main`에 직접 푸시하지 않는다. 브랜치 → PR → 상대방 확인 → 머지.
- 구 저장소 `origin`에는 푸시하지 않는다.
- 단계의 완료 기준을 통과하기 전에 다음 단계로 가지 않는다.
