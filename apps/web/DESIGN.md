---
name: plAI-ground — web_combine_demo
description: 순수 블랙 모눈 캔버스 위 라이브 원장 터미널과 글래스 콘솔 — 학습 과정이 증명이 되는 AI 실습 플랫폼의 시각 시스템
colors:
  void: "#050505"
  pit: "#0a0a0c"
  ink: "#f2f0eb"
  mist: "#a8a49b"
  dim: "#8d897f"
  line: "rgba(255, 255, 255, 0.08)"
  glass: "rgba(255, 255, 255, 0.05)"
  gold: "#e8b34b"
  gold-deep: "#9a6c1c"
  cobalt: "#5b78ff"
  mint: "#4ade9b"
  ember: "#fb7185"
  amber-warn: "#fcd34d"
typography:
  display:
    fontFamily: "Schibsted Grotesk, Noto Sans KR, sans-serif"
    fontSize: "clamp(2.6rem, 5vw, 3.75rem)"
    fontWeight: 700
    lineHeight: 1.06
    letterSpacing: "-0.03em"
  headline:
    fontFamily: "Schibsted Grotesk, Noto Sans KR, sans-serif"
    fontSize: "clamp(1.875rem, 4vw, 2.25rem)"
    fontWeight: 700
    lineHeight: 1.25
    letterSpacing: "-0.025em"
  title:
    fontFamily: "Schibsted Grotesk, Noto Sans KR, sans-serif"
    fontSize: "1.25rem"
    fontWeight: 700
    lineHeight: 1.4
  body:
    fontFamily: "Noto Sans KR, Schibsted Grotesk, sans-serif"
    fontSize: "14px"
    fontWeight: 400
    lineHeight: 1.625
  label:
    fontFamily: "Noto Sans KR, Schibsted Grotesk, sans-serif"
    fontSize: "12px"
    fontWeight: 500
    lineHeight: 1.4
  mono:
    fontFamily: "JetBrains Mono, ui-monospace, monospace"
    fontSize: "12px"
    fontWeight: 400
    lineHeight: "24px"
rounded:
  pill: "9999px"
  card: "16px"
  panel: "24px"
  focus: "4px"
spacing:
  gutter: "24px"
  card: "20px"
  card-lg: "24px"
  panel: "28px"
  grid-gap: "20px"
  stat-gap: "16px"
  band: "96px"
  section: "112px"
components:
  button-primary:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.void}"
    typography: "{typography.label}"
    rounded: "{rounded.pill}"
    padding: "12px 28px"
  button-primary-hover:
    backgroundColor: "#ffffff"
    textColor: "{colors.void}"
  button-ghost:
    backgroundColor: "transparent"
    textColor: "{colors.mist}"
    rounded: "{rounded.pill}"
    padding: "12px 28px"
  button-gold:
    backgroundColor: "{colors.gold}"
    textColor: "{colors.void}"
    rounded: "{rounded.pill}"
    padding: "12px 28px"
  nav-pill-active:
    backgroundColor: "{colors.ink}"
    textColor: "{colors.void}"
    rounded: "{rounded.pill}"
    padding: "6px 14px"
  badge-status:
    backgroundColor: "rgba(91, 120, 255, 0.15)"
    textColor: "{colors.cobalt}"
    typography: "{typography.mono}"
    rounded: "{rounded.pill}"
    padding: "4px 10px"
---

# Design System: plAI-ground (web_combine_demo)

> 적용 범위: `web_combine_demo/` 한정. 옆의 `web_demo/`는 의도적으로 다른(각진 rounded-sm · slate) 시스템을 쓰며 이 문서의 지배를 받지 않는다.

## Overview

**Creative North Star: "The Liquid Ledger"**

순수 블랙(#050505) 캔버스 위에서 제품 메커니즘 자체를 극화하는 세계. 카테고리 기본형(slate 대시보드 그리드 + 이모지 카드)을 거부하고, 어둠·유리·금속 세 가지 재질만으로 "학습 과정 자체가 증명이 된다"는 명제를 시각화한다. 히어로는 그 명제를 문자 그대로 보여준다: 모눈종이(gridfield) 배경 위에서 학습 세션 터미널이 에러를 가로채고, diff로 고치고, SHA-256 원장으로 서명하는 순간 — 그 위에 골드 광원(ledger-glow)이 얹힌다. 랜딩의 터미널이 약속이라면, 콘솔의 pit 바닥 로그 콘솔은 그 약속의 실행이다. 사용자 고정 레퍼런스는 Liquid Brokers 랜딩(binding).

밀도는 낮고 여백은 크다. 헤드라인은 영문 대형 그로테스크, 본문은 한글, 원시 출력(로그·해시·코드)은 모노스페이스 — 세 목소리가 섞이지 않는다. 목업 화면은 반드시 모노 배지(SIMULATION, SAMPLE DATA)로 정체를 밝힌다.

**Key Characteristics:**
- #050505 블랙 캔버스 + 타원 마스크된 1px 모눈 그리드(gridfield, 히어로 한정) + 골드/코발트 광원(ledger-glow)
- backdrop-blur 글래스 카드와 pill 실루엣(내비·CTA·배지 전부 rounded-full)
- 골드=증명/브랜드, 코발트=진행/텔레메트리, 민트=성공, 엠버=에러의 4역 시그널 팔레트
- 영문 헤드라인 + 한글 본문 + JetBrains Mono 원시 출력의 3성부 타이포그래피
- 진입 모션은 rise 스태거 하나, 상시 모션은 서명 카드의 drift와 라이브 도트의 pulse뿐

## Colors

밤하늘 위 금속 반사광 — 무채색 어둠 3단과 뼈백색 텍스트 3단 위에, 채도 있는 색은 오직 시그널로만 쓰인다.

### Primary
- **Gold** (`gold`): 증명·브랜드의 색이자 **랜딩의 주 CTA 색**. 랜딩 헤더·히어로의 Start Workspace pill, 로고 도트(+glow), VERIFIED LEDGER 배지, 히어로 원장 로그의 `[LEDGER]` 행과 서명 카드(`border-gold/25`), 리포트의 SHA-256 서명 블록·Engineering Takeaway 콜아웃(`border-gold/25 bg-gold/5`), 관리자 역할 칩(`bg-gold/15`), B2B 하이라이트 카드의 그라디언트 테두리와 CTA, 진행 레일의 완주 노드, 선택된 모델 카드 테두리, 스크롤바·캐럿·선택 영역·포커스 링. 짝인 **Gold Deep** (`gold-deep`)은 현재 `@theme`에만 남은 예비 토큰이다.

### Secondary
- **Cobalt** (`cobalt`): 살아있는 프로세스의 색. 로그의 스텝 라벨(`[1/4]`)과 `[RESUME]` 행, PROVISIONING/IN PROGRESS 상태, Accuracy 지표, 텔레메트리 아이콘, SIMULATION 배지, 학생 역할 칩(`bg-cobalt/15`). "지금 돌아가는 중"은 언제나 코발트다.

### Tertiary (시그널)
- **Mint** (`mint`): 성공·완료·READY. 상태 도트, 완료 배너(`mint/30` 테두리 + `mint/5` 배경), 학습 곡선 스트로크, 성공 CTA.
- **Ember** (`ember`): 에러·예외. FAILED 상태, 에러 배너(`ember/40` 테두리 + `ember/10` 배경), diff의 삭제 행, 해결된 예외 카운트.
- **Amber Warn** (`amber-warn`): 비차단 경고 텍스트와 일시정지 아이콘. Tailwind 기본 `amber-300`을 그대로 쓴다 — 아직 `@theme`에 승격되지 않은 유일한 시그널 색.

### Neutral
- **Void** (`void`): 페이지 캔버스이자 어두운 pill 위 텍스트 색.
- **Pit** (`pit`): 한 단 밝은 바닥 — 로그 콘솔, 상태 행, 파이프라인 밴드(`pit/60`), 가격 카드 내부.
- **Ink** (`ink`): 기본 텍스트·헤드라인, 그리고 주 CTA의 배경(반전).
- **Mist** (`mist`): 본문·설명·비활성 내비.
- **Dim** (`dim`): 캡션·타임스탬프·풋노트.
- **Line** (`line`): 유일한 테두리 색. **Glass** (`glass`): 글래스 카드 바탕.

**The One Ember Rule.** 채도 색은 상태를 말할 때만 등장한다. 장식 목적의 컬러 블록·컬러 배경 섹션은 없다 — 넓은 면은 언제나 void/pit/glass다.

**The Two Stages Rule.** (구 Ink CTA Rule 대체) CTA 색은 무대가 정한다: **랜딩(약속의 무대)의 주 행동은 골드 pill**(`bg-gold text-void`, hover `brightness-110` + 골드 글로우), **콘솔(실행의 무대)의 주 행동은 뼈백색 ink pill**(hover 순백). 두 무대를 섞지 않는다 — 콘솔에 골드 CTA를, 랜딩 히어로에 ink CTA를 놓지 않는다. 민트 배경 버튼은 세팅 완료 배너 한 곳뿐.

**The Borrowed Tint Rule.** 커뮤니티 한정으로 시그널 팔레트가 카테고리 틴트로 재사용된다: 오류해결=ember, 학습 결과=mint, Q&A=cobalt, 데이터 정보=gold — 커뮤니티의 커버와 카테고리 칩에만 적용되는 범주 색이며, 그 밖의 모든 화면에서 시그널색의 의미(진행/성공/에러/증명)는 그대로다. 새 카테고리를 만들 때도 이 네 색 밖으로 나가지 않는다.

## Typography

**Display Font:** Schibsted Grotesk (Noto Sans KR 폴백)
**Body Font:** Noto Sans KR (Schibsted Grotesk 폴백)
**Label/Mono Font:** JetBrains Mono (ui-monospace 폴백)

**Character:** 영문 헤드라인·라벨은 그로테스크로 크고 타이트하게(tracking-tight ~ -0.03em, bold 700 고정), 한글 본문은 Noto Sans KR로 편안하게(leading-relaxed), 기계의 출력은 전부 모노스페이스로. 카피 언어는 "영문 헤드라인/라벨 + 한글 본문"이 확정 규칙이다.

### Hierarchy
- **Display** (700, 2.6rem→3.75rem 반응형, lh 1.06, ls -0.03em): 히어로 2행 헤드라인 전용.
- **Headline** (700, 1.875–2.25rem, tracking-tight): 랜딩 섹션 제목과 콘솔 페이지 h1(콘솔은 1.875rem 고정).
- **Title** (700, 1.125–1.25rem): 카드 제목, 빈 상태 제목. 스탯 카드 값은 같은 display 계열 700에 1.25–1.5rem + `tabular-nums`.
- **Body** (400, 14px, lh 1.625): 설명문. 리드 문단은 15px. 보조 본문은 13px.
- **Label** (500, 11–13px): 내비 13px, 카드 라벨·캡션 11–12px(mist/dim).
- **Mono** (400–500, 10–12px, lh 24px): 로그 콘솔(11–12px/leading-6), 배지(10–11px), 해시·경로·명령어 인라인 코드.

**The Three Voices Rule.** 역할이 글꼴을 정한다: 헤드라인/값 = Schibsted Grotesk bold, 한글 산문 = Noto Sans KR, 기계가 낸 문자열(로그·해시·ID·명령·상태 코드) = JetBrains Mono. 상태 배지 텍스트도 기계의 말이므로 모노다.

**The Keep-All Rule.** `h1, h2, h3, p { word-break: keep-all; }` — 한글 제목·문단은 음절 단위로 꺾지 않는다. 이 규칙은 반드시 **`@layer base` 안**에 산다 — 그래야 `break-all` 같은 유틸리티가 필요한 곳(로그 콘솔의 긴 해시 등)에서 이길 수 있다 (index.css).

## Layout

- **컨테이너**: 랜딩 `max-w-6xl`(72rem), 콘솔 대시보드 `max-w-5xl`, 위저드형(Start AI) `max-w-3xl`, IDE 전면 뷰 `max-w-[1400px]`. 좌우 거터는 항상 `px-6`(모바일 콘솔은 px-4).
- **헤더 — 두 문법**: 랜딩은 전폭 하단 헤어라인 바(`fixed`, `bg-void/85 backdrop-blur-md border-b border-line`, h-16, 내부 max-w-6xl), 콘솔은 플로팅 글래스 pill(rounded-full, h-13, `pt-4`로 띄움). 랜딩 본문은 히어로가 `pt-36`으로, 콘솔 본문은 `pt-24`로 시작한다.
- **히어로**: 12컬럼 6/6 분할(`lg:grid-cols-12`, `gap-14`, `items-center`) — 좌측 메시지+CTA, 우측 터미널/서명 카드 스택. `pt-36 pb-24`, 배경은 절대배치 `.gridfield`.
- **섹션 리듬**: 랜딩 섹션 `py-28`(112px), 톤 반전 밴드(파이프라인)는 `py-24` + `bg-pit/60` + `border-y border-line`.
- **그리드**: 피처 카드는 12컬럼 7/5 비대칭 분할(`lg:grid-cols-12`, `gap-5`), 스탯/KPI는 2→4 또는 1→3 컬럼(`gap-4`), 가격은 3컬럼 `items-stretch`.
- **반응형**: Tailwind 기본 브레이크포인트(sm 640/md 768/lg 1024). 데스크톱 중앙 내비는 `hidden md:flex`이고 모바일은 헤더 두 번째 행의 가로 스크롤 메뉴 행(`md:hidden overflow-x-auto`)으로 대체 — 두 곳 모두 같은 콘솔 뷰 링크를 담는다. 히어로 서명 카드는 sm+에서 절대배치 겹침(`sm:absolute sm:-bottom-16 sm:right-6`), 모바일에서는 아래로 흐른다. 테이블은 `overflow-x-auto` 래퍼로 가로 스크롤.

**The Two Navigations Rule.** 랜딩(마케팅)과 콘솔(운영)의 내비 문법은 의도적으로 다르다: 랜딩 = 전폭 헤어라인 블러 바(중앙 링크는 콘솔 뷰 — Start AI/Web IDE/View AI/Portfolio/커뮤니티), 콘솔 = 플로팅 글래스 pill + 뷰 탭. 목적지는 같아도 바-대-pill 문법은 통일하지 않는다.

## Elevation & Depth

깊이는 그림자 계층이 아니라 **재질**로 만든다: 블러(backdrop-filter 14px) + 1px 백색 테두리 + 반투명 백색 바탕이 유리를, pit의 한 단 밝은 바닥이 우물을 만든다. 그림자는 두 역할뿐이다.

### Shadow Vocabulary
- **Glass ambient** (`box-shadow: 0 18px 40px rgba(0,0,0,0.45)`): `.glass-card` 전용 — 유리가 캔버스에서 떨어져 있다는 최소한의 근거.
- **Gold glow** (`0 0 12px rgba(232,179,75,0.7~0.8)`): 로고 도트와 진행 레일 완주 노드의 발광. 상자 그림자가 아니라 광원이다.
- **CTA hover glow** (`0 0 30px rgba(232,179,75,0.35)`): 히어로 골드 주 CTA hover 한정.
- **Ledger glow** (`.ledger-glow` — 골드/코발트 radial + `blur(30px)`): 히어로 원장 스택 뒤의 광원. 히어로 전용, 재사용하지 않는다.

**The Glow-Not-Shadow Rule.** 오프셋 그림자로 띄우지 않는다. 강조가 필요하면 발광(glow)·테두리 밝기·배경 투명도를 올린다.

## Shapes

두 실루엣만 존재한다: **완전한 원/pill**과 **크게 깎인 사각**.

- **Pill (9999px)**: 인터랙티브 요소 전부 — 내비, CTA, 배지, 스텝 인디케이터, 상태 칩, 명령어 캡슐, 게이지 트랙까지. 각진 버튼은 이 세계에 없다.
- **Card (16px, rounded-2xl)**: 스탯 카드, 상태 행, 로그 콘솔, 토스트, IDE 헤더, 선택 카드.
- **Panel (24px, rounded-3xl)**: 대형 피처 카드, 차트/텔레메트리 패널, 가격 카드, 빈 상태 컨테이너.
- **테두리**: 항상 1px, 기본 `line`. 상태 강조 시 시그널 색의 /25~/60 투명도 버전(서명 블록·서명 카드는 `border-gold/25`). B2B 하이라이트는 `p-[1px]` + 골드 그라디언트(`from-gold/60 via-gold/15 to-transparent`) 래퍼로 그라디언트 보더를 만든다.
- **겹침**: 히어로에서 서명 카드가 터미널 카드의 하단 모서리에 겹친다(sm+ 절대배치) — 카드가 서로 얹히는 유일한 곳.

## Components

### Buttons
- **Shape:** pill (9999px), 텍스트 13–14px semibold.
- **Primary (콘솔):** ink 배경 + void 텍스트, `px-6~7 py-2.5~3`. Hover: 순백(`hover:bg-white`). Disabled: `opacity-40 cursor-not-allowed`.
- **Primary (랜딩):** gold 배경 + void 텍스트, hover `brightness-110`, 히어로에서만 골드 glow 추가 (The Two Stages Rule).
- **Ghost:** 투명 배경 + `border-line` + mist 텍스트. Hover: `text-ink` + `border-white/25~30`(+선택적으로 `bg-white/5`).
- **Mint:** void 텍스트, hover `brightness-110`. 세팅 완료 배너 전용.
- 아이콘은 Lucide 스트로크 12–14px(`w-3~3.5`)를 텍스트 앞뒤에 `gap-2`로.

### Chips (상태 배지)
- **Style:** pill, `px-2~2.5 py-0.5~1`, JetBrains Mono 10–11px, 시그널색 `/15` 배경 + 시그널색 텍스트 (예: `bg-mint/15 text-mint`). 중립은 `bg-white/8~10 text-mist|dim`.
- **역할:** 상태(COMPLETED/IN PROGRESS)와 정직성 표기(SIMULATION, SAMPLE DATA, VERIFIED LEDGER) 둘 다 이 형태.

### Cards / Containers
- **Glass stat card:** `.glass-card rounded-2xl p-4~5` — 11–12px mist 라벨 위, display bold `tabular` 값(색은 지표 의미의 시그널색), 아래 11px dim 서브텍스트.
- **Feature panel:** `.glass-card rounded-3xl p-7`, 전체가 `<button>`. Hover: 의미색으로 테두리 착색(`hover:border-gold/40` 또는 `cobalt/40`) + 우상단 원형 아이콘 버튼(`w-9 h-9 rounded-full bg-white/10`)이 의미색 `/20` 배경으로.
- **Console(로그) 카드:** `rounded-2xl bg-pit border-line p-4`, mono 11–12px leading-6, 자동 스크롤. 라인 톤: 스텝=cobalt, 성공=mint, 에러=ember, 경고=amber-warn, 기본=mist, 구분선=dim.
- **Alert 배너:** `rounded-2xl` + 시그널색 `/30~40` 테두리 + `/5~10` 배경 + 시그널색 텍스트, 아이콘 `w-4 shrink-0`.

### Inputs / Fields
- **선택 카드(radio 카드):** `rounded-2xl border p-4`, 기본 `border-line bg-pit`, hover `border-white/20`, 선택 시 `border-gold/60 bg-gold/5`. 키보드 접근(role="radio", Enter/Space) 필수.
- **검색 필드(커뮤니티):** pill `border-line bg-pit px-4 py-2.5` 안에 dim 검색 아이콘 + 투명 배경 13px 입력(`outline-none placeholder:text-dim`) + 입력 시 지우기 버튼. 포커스는 래퍼의 `focus-within:border-gold/50`로 표현.
- **Focus:** 전역 `:focus-visible` — `outline: 2px solid rgba(232,179,75,0.75)`, offset 2px, radius 4px.

### Navigation
- **랜딩 바:** 전폭 `bg-void/85 backdrop-blur-md border-b border-line` h-16 — 좌측 로고(골드 발광 도트 + display bold 워드마크), 중앙에 콘솔 뷰 링크 5개(Start AI/Web IDE/View AI/Portfolio/커뮤니티, 13px mist, `hidden md:flex`), 우측 LoginMenu + 골드 Start Workspace pill. 모바일은 두 번째 행의 가로 스크롤 메뉴 행(`md:hidden`)에 같은 5개 링크.
- **콘솔 pill:** 글래스 pill 바 안의 pill 탭 — 비활성 `text-mist hover:text-ink`(13px), 활성 `bg-ink text-void font-semibold` + `aria-current`. 탭은 역할 게이팅: 기본 5개(Start AI/Web IDE/View AI/Portfolio/커뮤니티) + 관리자에게만 Faculty LMS.
- 두 문법을 통일하지 않는다 (The Two Navigations Rule).

### LoginMenu (역할 선택 드롭다운)
- **트리거:** ghost pill "Login" + ChevronDown(open 시 180° 회전, `duration-200`).
- **패널:** `glass-card rounded-2xl p-1.5 w-48` 절대배치 드롭다운. 항목은 `rounded-xl px-3.5 py-2.5` 13px, hover `bg-white/8`, 좌측에 역할 아이콘(학생=cobalt GraduationCap, 관리자=gold ShieldCheck). `menu` role은 쓰지 않는다(화살표 키 포커스 관리를 약속하지 않으므로 평범한 버튼 목록) — Escape·바깥 클릭으로 닫힌다.
- **로그인 후:** 역할 칩(pill 12px medium — 관리자 `bg-gold/15 text-gold`, 학생 `bg-cobalt/15 text-cobalt`) + 로그아웃 아이콘 버튼(`p-2 rounded-full`, hover `bg-white/5`).

### Tables (LMS)
- `rounded-3xl` 글래스 카드 안, 13px, 헤더 11px dim `border-b border-line`, 행 `border-line/60` + `hover:bg-white/3`. 숫자·ID는 mono + `tabular`. 상태는 칩, 행동은 ghost pill.

### Progress
- **진행 레일(파이프라인):** 노드 = `w-3 h-3 rounded-full`, 미완 `border-2 border-gold/70 bg-void`, 완주 `bg-gold` + gold glow. 노드 사이는 `h-px bg-gradient-to-r from-gold/50 to-white/10`.
- **게이지/바:** 트랙 `h-1~1.5 rounded-full bg-white/8~10`, 필 시그널색, `transition-all duration-700`.
- **스텝 인디케이터(위저드):** pill 4분할 — 현재 `bg-ink text-void`, 완료 `bg-mint/15 text-mint border-mint/30`, 대기 `border-line text-dim`.

### Terminal Ledger Stack (시그니처)
히어로 우측의 제품 메커니즘 극화 — **히어로에 단 한 번**, `aria-hidden`.
- **터미널 카드:** `.glass-card rounded-2xl` — 상단 타이틀 바(트래픽 라이트 도트 3개 `w-2.5 rounded-full` ember/gold/mint의 `/70` + mono 11px dim 세션명, `border-b border-line`), 본문은 mono 12px `leading-7` 로그 드라마: epoch(mist) → `[INTERCEPT]` OOM(ember) → diff 2행(ember/mint, `pl-4`) → `[RESUME]`(cobalt) → `[LEDGER]` SHA-256(gold + `animate-pulse` 골드 도트).
- **서명 카드:** `glass-card rounded-2xl p-4 w-60 border-gold/25` — Verified Ledger 라벨 + gold/15 원형 아이콘 칩 + mono 골드 해시("(예시)" 명기). sm+에서 터미널 하단에 절대배치 겹침 + `animate-drift`, 모바일은 아래로 흐른다.
- **배경:** `.ledger-glow`(absolute `-inset-10`)가 스택 뒤에서 발광.

### Gridfield (시그니처)
`.gridfield` — 두 축 1px `rgba(255,255,255,0.04)` 라인, 56px 셀, `radial-gradient` 타원 마스크로 가장자리 소멸. 학습 곡선이 그려지는 모눈종이 메타포. 히어로 배경 전용.

### Report SectionCard (Portfolio 네이티브 리포트)
파이프라인 스키마 JSON을 iframe 없이 이 시스템으로 직접 렌더링하는 패턴.
- **SectionCard:** `glass-card rounded-3xl p-6~7`, 제목 = 틴트 원형 아이콘 칩(`w-8 h-8 rounded-full` + 시그널색 `/15` 배경·시그널색 아이콘) + display bold 15px, 본문은 `mt-5`. 섹션별 틴트: 데이터=cobalt, 학습 방법=gold, 에러 해결=ember.
- **서명 블록:** `rounded-2xl border-gold/25 bg-gold/5 p-5` — gold ShieldCheck 라벨, mono 11px `break-all` 해시, dim 발급 시각. Engineering Takeaway 콜아웃도 같은 재질(골드 라벨 + ink 본문).
- **델타 밴드:** Baseline(mist) → ArrowRight → Fine-tuned(mint) 4xl tabular 값 + mint mono 개선율 pill. 아래 게이지는 `h-2` 트랙 + `from-cobalt/70 to-mint` 그라디언트 필 — **0~1 스케일 지표일 때만 렌더링**(축이 참일 때만 그린다, truth guard).
- **Diff 행:** mono 12px, `-`행 `text-ember bg-ember/10`, `+`행 `text-mint bg-mint/10`, `px-2 rounded-md`.

### Community (커뮤니티)
글 목록·상세·실습 연계가 하나의 컴포넌트 패밀리다. 카테고리 색은 The Borrowed Tint Rule을 따른다.
- **포스트 카드 (3존):** `glass-card rounded-3xl p-5` 전체가 클릭 대상(role="button" + Enter/Space), hover `border-white/25`. ① 카테고리 칩(틴트 `/12` 배경) + 실습 가능 글엔 mono 10px 골드 '실습 가능' 배지 → display bold 15px 제목(`line-clamp-2`, group-hover 골드) ② 커버 ③ 한 줄 truncate 요약 + mono 11px `tabular` 메타 카운트(Eye/ThumbsUp/Bookmark — 활성 시 골드) + mono 10px dim 날짜(`mt-auto`로 바닥 정렬).
- **Cover:** 사진을 쓰지 않는다 — 카테고리 틴트 그라디언트(`linear-gradient(150deg, tint/0.2 → tint/0.04)`) + `border-line` `rounded-xl h-28` 위에 카테고리 lucide 아이콘(w-7, 틴트색)과 첫 해시태그(mono 10px). `aria-hidden`.
- **상세 오버레이:** `fixed inset-0 bg-black/70 backdrop-blur-sm` 위 `glass-card rounded-3xl max-w-2xl max-h-[85vh] p-7` 다이얼로그(role="dialog" aria-modal). 닫힘 = Escape·바깥 클릭·닫기 아이콘 버튼(자동 포커스); 열림 동안 body 스크롤 잠금 + Tab 포커스 트랩(셀렉터가 `button:not([disabled])`로 비활성 버튼 제외). 해시태그는 클릭 가능한 pill(`bg-white/6 border-line` mono 11px)로 검색어(`#태그`)를 채운다. 실습 글은 mono pit pill 행(민트 Play + run command)과 **ink '실습해보기' CTA**(콘솔 무대이므로 The Two Stages Rule) 노출. 추천/즐겨찾기 토글은 ghost pill, 활성 시 `border-gold/50 bg-gold/10 text-gold` + `aria-pressed`.
- **필터 문법:** 활성 세그먼트(카테고리 필터·정렬 토글)는 콘솔 탭과 같은 `bg-ink text-void font-semibold` pill, 비활성은 `border-line text-mist`(정렬은 `border-line p-0.5` pill 그룹 안). `aria-pressed` 필수.
- **스테이징 배너(IdeView):** 커뮤니티 실습 코드가 준비되면 `rounded-2xl border-gold/30 bg-gold/5` 배너 — 골드 라벨 + mono 경로/명령. 빈 상태와 IDE 상단 두 곳에서 같은 재질.

### Toast
우하단 fixed 스택, 글래스 `rounded-2xl px-4 py-3`, mint 체크 + 12px 본문 + 닫기, `role="status" aria-live="polite"`, 3.5초 자동 소멸.

## Motion

문법은 셋뿐이며 이징은 하나다: `cubic-bezier(0.16, 1, 0.3, 1)`.

- **rise** (0.9s, `both`): 진입 모션. 24px 아래에서 떠오르며 페이드인. 스태거는 0.15s 간격의 `animate-rise / -late / -later` 3단 — 히어로 헤드라인→리드+터미널→CTA 순.
- **drift** (9s infinite): 히어로 서명 카드(sm+) — -10px 부유.
- **pulse** (Tailwind `animate-pulse`): 히어로 `[LEDGER]` 행의 골드 라이브 도트.
- 그 외 상태 변화는 전부 `transition-colors`/`transition-all`(기본 지속시간), 게이지만 `duration-700`, 셰브론 회전 `duration-200`. 스크롤 트리거 애니메이션은 없다(스크롤은 `scroll-behavior: smooth`만).

**The Calm Console Rule.** 상시 모션(무한 루프)은 랜딩 히어로의 drift/pulse와 로딩 스피너(`animate-spin`), 라이브 커서 점멸뿐이다. 콘솔 화면은 데이터가 움직일 때만 움직인다.

## Browser Surfaces

브라우저 기본 표면까지 골드로 통일한다 (index.css 전역):
- **Selection:** `rgba(232,179,75,0.28)` 배경 + `#f8f6f0` 텍스트.
- **Scrollbar:** thin, 골드 `0.3~0.35` 썸(8px, radius 4px), 트랙 투명.
- **Caret:** `caret-color: gold`.
- **Focus ring:** 골드 0.75 2px 아웃라인, offset 2px (Components > Inputs 참조).

## Do's and Don'ts

### Do:
- **Do** 인터랙티브 요소는 pill(9999px), 컨테이너는 16px/24px 두 단만 쓴다.
- **Do** 기계의 출력(로그·해시·명령·상태 코드·ID)은 항상 JetBrains Mono + pit 바닥 + line 테두리에 담는다.
- **Do** 시그널색은 의미 고정으로 쓴다: gold=증명/브랜드, cobalt=진행 중, mint=성공, ember=에러, amber=경고.
- **Do** 목업/샘플 화면에는 mono 대문자 배지를 h1 옆에 단다 — 정직성이 시각 규칙이다. 현재 인스턴스: View AI=SIMULATION, Faculty LMS=SAMPLE DATA, 커뮤니티=SAMPLE DATA(글·수치는 데모 시드, 인용된 데이터셋·출처·코드는 실재).
- **Do** 진입은 rise 3단 스태거, 상태 강조는 시그널색 `/15` 배경 + `/30~40` 테두리 조합으로.
- **Do** 숫자 값에는 `tabular`(tabular-nums), 아이콘은 Lucide 스트로크 12–16px.

### Don't:
- **Don't** 커스텀(unlayered) CSS 규칙으로 유틸리티 소유 속성을 덮지 않는다. **Tailwind v4에서 unlayered 규칙은 `@layer utilities`를 이긴다** — 컴포넌트 클래스에 `position`을 넣으면 마크업의 `absolute`가 무시되고(구 `.orb-body`에서 실제 발생), 엘리먼트 셀렉터 규칙(`h1,h2,h3,p`의 keep-all 등)도 unlayered면 `break-all` 같은 유틸리티를 이겨버린다 — 반드시 `@layer base`에 넣는다(실제 이관됨). 레이아웃은 마크업 유틸리티, 재질(배경/그림자/radius)만 컴포넌트 클래스.
- **Don't** slate 팔레트·각진 모서리·이모지 아이콘 카드를 들여오지 않는다 — 그것은 옆 세계(web_demo)의 문법이다.
- **Don't** gridfield·ledger-glow·터미널 원장 스택을 히어로 밖에서 재사용하지 않는다. 극화는 한 번이라서 성립한다.
- **Don't** 랜딩 바와 콘솔 pill 내비를 하나로 통일하지 않는다 (The Two Navigations Rule). 콘솔에 골드 CTA, 랜딩 히어로에 ink CTA를 놓지 않는다 (The Two Stages Rule).
- **Don't** 오프셋 박스 섀도로 요소를 띄우지 않는다 — 발광·테두리·투명도가 이 세계의 강조 수단이다.
- **Don't** 콘솔 화면에 무한 루프 장식 모션을 추가하지 않는다 (The Calm Console Rule).
- **Don't** 증명 불가능한 수치를 UI에 박지 않는다 — 값은 백엔드 응답 또는 venture.md 출처만, 예시 해시에는 "(예시)"를 명기한다.
