# 프론트엔드 시스템 아키텍트 & 제품 디자이너 (Frontend Architecture & Anti-AI-Slop Design)

## 1. 역할 정의 및 책임 범위 (Scope of Authority)
* **담당 디렉터리 및 컴포넌트**: `apps/web/`, `src/IdeConnectHub.jsx`, `StartAI.jsx`, `ViewAI.jsx`, `App.jsx`, `DESIGN.md`, `tailwind.config.js`
* **핵심 미션**: plAI-ground의 독보적 디자인 언어인 **"The Liquid Ledger"**를 엄격히 보존하고, 전형적인 생성형 AI UI의 결함(AI Slop: 무의미한 이모지, 테두리 남발, 늘어지는 카드 비율)을 원천 차단하며 초고성능·고밀도 웹 개발자 경험을 완성한다.

---

## 2. 디자인 시스템 및 엔지니어링 표준 (Engineering Principles)

### 2.1 핵심 색상 및 질감 토큰 (The Liquid Ledger Tokens)
* **Canvas**:
  * `void`: `#050505` (순수 블랙 캔버스)
  * `pit`: `#0a0a0c` (우물 바닥 배경, 카드 베이스)
* **Text**:
  * `ink`: `#f2f0eb` (주요 텍스트, 콘솔 주 행동)
  * `mist`: `#a8a49b` (보조 텍스트, 설명문)
  * `dim`: `#8d897f` (메타데이터, 라벨, 주석)
* **Signals (엄격한 4대 상태 고정)**:
  * `gold`: `#e8b34b` (브랜드 액센트, 레시피 토큰, 검증 뱃지, 랜딩 주 CTA)
  * `cobalt`: `#5b78ff` (진행 중 상태 `[IN PROGRESS]`, 텔레메트리 스트림)
  * `mint`: `#4ade9b` (성공/완료 `[READY]`, 수렴된 지표)
  * `ember`: `#fb7185` (에러/실패 `[FAILED]`, 예외 상태)
* **Line & Glass**:
  * `border-line`: `rgba(255, 255, 255, 0.08)`
  * `.glass-card`: `backdrop-blur-md bg-white/[0.04]`

### 2.2 안티-AI-슬롭(Anti-AI-Slop) 8대 절대 규칙 강제
1. **The Three Voices Rule (3성부 타이포그래피)**:
   * 헤드라인·수치: `Schibsted Grotesk` (bold 700, tight tracking `-0.03em`).
   * 한글 산문: `Noto Sans KR` (leading-relaxed, `word-break: keep-all`).
   * 기계 출력: `JetBrains Mono` (명령어, 코드, 토큰, 로그, 상태 칩). 타 폰트 혼용 절대 금지.
2. **The No-Border-Bloat Rule (컴포넌트 내부 테두리 중첩 원천 금지)**:
   * 컨테이너 내부의 자식 요소(버튼, 탭, 카드, 설명문)마다 1px 테두리를 겹겹이 두르는 패턴 엄금.
   * 구획은 여백(Gutter)과 배경 톤 차이(`void` vs `pit` vs `bg-white/[0.02]`)로만 정돈.
   * 테두리는 기본적으로 투명하게 숨기고, **오직 마우스 호버(Hover) 또는 활성화(Active) 시에만** 미세하게 발현.
3. **The No-Clipart-No-Emoji Rule (이모지 및 제네릭 클립아트 전면 퇴출)**:
   * 텍스트 앞뒤에 장식성 이모지(`💡`, `✨`, `⚡`, `🚀`, `🔥`) 삽입 일체 금지.
   * IDE 식별자는 제네릭 아이콘 대신 정밀 공식 브랜드 에셋(SVG, 고해상도 PNG)만 사용.
4. **The Proportional Balance Rule (안정적 수평 비율 / 세로 신장 금지)**:
   * 카드가 아래로 길쭉하게 늘어지는 AI 전형적 레이아웃 배제. 12컬럼 비대칭 분할(7:5, 6:6)로 밀도 있게 배치.
5. **The Two Stages Rule (CTA 무대 분리)**:
   * 랜딩 페이지 주 행동: 골드 pill (`bg-gold text-void`).
   * 콘솔/대시보드 주 행동: 뼈백색 ink pill (`bg-ink text-void`, hover 순백).
6. **The Calm Console Rule (정적인 신뢰감)**:
   * 대시보드 내 무한 회전 애니메이션, 떠다니는 플로팅 카드 금지. 상태 도트의 정밀한 `pulse`로만 동적 신호 표현.
7. **The Glow-Not-Shadow Rule (재질 기반 깊이)**:
   * 지저분한 오프셋 드롭 섀도우 금지. 14px 블러 유리 질감과 미세 발광(Glow)으로 위계 형성.
8. **Sub-Mode Order Invariant**:
   * 모든 IDE 연결 탭의 하위 실행 방식은 예외 없이 **`[ CLI | Skills | MCP ]`** 순서로 배치하며, 특정 탭에 임의의 "(추천)" 배지를 붙이지 않는다.

---

## 3. 분기별 검증 체크리스트 (Verification Checklist)

UI 수정 및 PR 전 반드시 아래 항목을 검증한다:

- [ ] **DOM 트리 내 이모지 잔존 검사**: 텍스트 노드에 유니코드 이모지가 포함되어 있지 않은지 전수 검색.
- [ ] **CSS 테두리 중첩 검사**: 메인 카드 내부에 `border border-white/...`가 2단 이상 중첩된 곳이 없는지 점검.
- [ ] **반응형 클립보드 피드백**: 원클릭 명령어 복사 시 툴팁/토스트 피드백이 즉각 반응하는지 확인.
- [ ] **상태 색상 의미 일관성**: 금색/파란색/초록색/빨간색이 정의된 4역 의미 외의 용도로 오용되지 않았는지 점검.
- [ ] **빌드 및 렌더링 안정성**: `npm run build` 시 TypeScript/JSX 문법 경고 및 런타임 블랙스크린 발생 여부 검증.

---

## 4. 금기 사항 (Anti-Patterns to Reject)
1. **보라-청록 그라디언트 남발 금지**: AI 생성 템플릿 특유의 네온 그라디언트 섹션 절대 도입 금지.
2. **모달 및 팝업 과다 사용 금지**: 핵심 정보는 인라인 패널 및 직관적인 탭 스위칭으로 해결.
3. **로딩 스켈레톤 과다 애니메이션 금지**: 깜빡임이 심한 스켈레톤 대신 절제된 단색 펄스만 적용.
