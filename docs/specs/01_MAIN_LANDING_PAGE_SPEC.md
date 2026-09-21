# plAI-ground Main Landing Page Architecture Specification
- Document ID: SPEC-UI-01-LANDING
- Version: 1.0.0-MVP (Desktop Environment)
- Target Viewport: Desktop Workstation (1920x1080 / 2560x1440 Optimized)
- Design Philosophy: Anti-AI Aesthetic, Extreme Precision, High Information Density

---

## 0. Anti-AI Aesthetic Rules Enforcement Checklist

본 명세서에 작성된 모든 UI 요소는 소위 "AI 냄새(AI Slop)"를 유발하는 다음 5가지 디자인 패턴을 엄격히 금지합니다.

1. **NO Text Emojis / Emoticons**:
   - 🚀, 🟢, 🔴, 🛡️, 📄, 💡 등 모든 형태의 텍스트 이모지 사용을 금지합니다.
   - 상태 및 인디케이터 표현은 오직 단색 Lucide SVG Icon (14px~16px) 및 Monospaced Text Badge (`[VERIFIED]`, `[RUNNING]`)로만 처리합니다.
2. **NO Excessive Border Radius (Anti-Bubble)**:
   - `rounded-2xl`, `rounded-3xl`, `rounded-full`, Pill Shape 버튼을 전면 금지합니다.
   - 플랫폼 전체 테두리 곡률은 **`rounded-sm` (2px)** 및 **`rounded-md` (6px)** 두 가지 사양으로만 통합합니다.
3. **NO Multi-color Neon Gradients**:
   - 무지개빛, 핑크/보라 네온 그라데이션, 과도한 Glow 효과를 금지합니다.
   - 단색 Slate Canvas (`#0F172A`) 위에 오직 단 하나의 검증 포인트 컬러인 **Emerald Green (`#10B981`)**과 시스템 액션 컬러인 **Electric Blue (`#3B82F6`)**만 제한적으로 허용합니다.
4. **NO Dead Space & Overcrowded Context**:
   - 뷰포트 내 불필요한 빈 공간(Dead Space)을 방지하고, 1px Solid Border (`#1E293B`)로 구획된 고밀도 패널 시스템을 구축합니다.
   - 마진과 패딩은 8px 그리드 단위 (`p-4`, `p-6`, `gap-4`)의 엄격한 수학적 비례를 유지합니다.

---

## 1. Global Navigation Architecture (GNB Header)

### 1.1 Layout & Dimension
- **Height**: `h-14` (56px fixed)
- **Background**: `bg-[#0B0F19]/95` with `backdrop-blur-sm`
- **Border**: `border-b border-slate-800` (1px solid `#1E293B`)
- **Padding**: `px-6` (Horizontal padding 24px)

### 1.2 Left Zone: Brand & System Status Indicator
- **Brand Mark**:
  - Box Container: `w-6 h-6 bg-slate-100 text-slate-950 font-mono font-bold text-xs rounded flex items-center justify-center`
  - Symbol: Text "P" (Monospace)
  - Title: `plAI-ground` (Font size: `text-sm`, Weight: `font-bold`, Color: `text-slate-100`, Letter-spacing: `tracking-tight`)
  - Version Tag: `v1.0.0-MVP` (Font size: `text-[10px]`, Font: `font-mono`, Style: `px-1.5 py-0.5 rounded bg-slate-800 text-slate-400 border border-slate-700`)
- **System Status Badge (Supabase Style)**:
  - Container: `flex items-center gap-2 text-[11px] text-slate-400 font-mono border-l border-slate-800 pl-4 ml-4`
  - Active Dot: `w-2 h-2 rounded-full bg-emerald-500` (Static color, no ping animation)
  - Status Label: "ALL SYSTEMS OPERATIONAL"

### 1.3 Center Zone: Main Navigation Items
- **Container**: `flex items-center gap-1 bg-slate-950 p-1 rounded border border-slate-800 text-xs font-medium`
- **Nav Items**: `[Overview]`, `[Architecture]`, `[Verification Ledger]`, `[B2B Contract]`
- **Active State**: `bg-slate-800 text-slate-100 border border-slate-700`
- **Hover State**: `text-slate-400 hover:text-slate-200`

### 1.4 Right Zone: Primary CTA Controls
- **Secondary Action**: `[Faculty Log-in]` (`text-slate-400 hover:text-slate-200 text-xs font-medium px-3 py-1.5`)
- **Primary Action**: `[Start Workspace]` (`px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded transition-all shadow-none border border-blue-500`)

---

## 2. Hero Section (First Impression & Core Pitch)

### 2.1 Technical Announcement Bar
- **Style**: `inline-flex items-center gap-2 px-2.5 py-1 rounded bg-slate-900 border border-slate-800 text-slate-400 text-xs font-mono mb-6`
- **Icon**: Lucide `Activity` (`w-3.5 h-3.5 text-blue-400`)
- **Text**: "Desktop Native IDE & Verifiable Debugging Ledger Engine for AI/SW Labs"

### 2.2 Headline Hierarchy (Vercel Style Typography)
- **H1 Headline**:
  - Size: `text-3xl sm:text-5xl font-bold tracking-tight text-slate-100 leading-tight mb-6`
  - Text Content:
    "보급형 GPU 기반 5분 세팅과
     [검증형 포트폴리오] 자동화 파이프라인"
  - Highlight Style (`[검증형 포트폴리오]`): `text-blue-400` (Solid color, no gradient)
- **Subtitle**:
  - Size: `text-slate-400 text-sm max-w-2xl leading-relaxed mb-8 font-sans`
  - Text Content:
    "PyTorch/CUDA 버전 충돌 없는 원클릭 로컬/클라우드 환경 구축부터 백그라운드 예외 인터셉트 기반 무결성 디버깅 리포트 추출까지 단번에 수행합니다."

### 2.3 Primary CTA Button Group
- **Primary Button**:
  - Text: "Start Workspace"
  - Icon: Lucide `ArrowRight` (`w-4 h-4 ml-2`)
  - Style: `px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-semibold rounded border border-blue-500 flex items-center justify-center`
- **Secondary Button**:
  - Text: "B2B Faculty Inquiry"
  - Style: `px-5 py-2.5 bg-slate-900 hover:bg-slate-800 text-slate-300 border border-slate-800 text-xs font-semibold rounded`

---

## 3. Product Comparison Grid Section (Proof of Value)

### 3.1 Section Layout
- **Grid**: `grid grid-cols-1 md:grid-cols-2 gap-4 mt-12`
- **Title**: Section Header `Traditional Submission vs plAI-ground Ledger` (`text-xs font-mono uppercase text-slate-500 tracking-wider mb-4`)

### 3.2 Left Card: Traditional Submission (Negative Case)
- **Container**: `p-5 rounded bg-[#0B0F19] border border-slate-800`
- **Badge**: `text-xs font-mono text-slate-500 mb-2 uppercase tracking-wider` -> "TRADITIONAL METHOD"
- **Title**: `GitHub / Notion Code Dump` (`text-sm font-bold text-slate-300 mb-3`)
- **Item List**:
  - Item 1: `[-] 소스코드 및 결과 이미지/텍스트 캡처만 제출하여 결과 조작 용이`
  - Item 2: `[-] 런타임 CUDA OOM 및 패키지 버전 충돌 해결 논리 입증 불가`
  - Item 3: `[-] 교수자 및 면접관의 디버깅 진위 검증 오버헤드 극심`
- **Styling**: List bullet points use `w-1.5 h-1.5 bg-slate-600 rounded-full`

### 3.3 Right Card: plAI-ground Verified Ledger (Positive Case)
- **Container**: `p-5 rounded bg-[#0B0F19] border border-emerald-900/60`
- **Badge**: `text-xs font-mono text-emerald-400 mb-2 uppercase tracking-wider` -> "PLAI-GROUND VERIFIED LEDGER"
- **Title**: `Timestamped Debugging Ledger` (`text-sm font-bold text-slate-100 mb-3`)
- **Item List**:
  - Item 1: `[+] 예외 발생부터 원인 분석, Code Diff까지 백그라운드 자동 수집`
  - Item 2: `[+] SHA-256 디지털 타임스탬프 서명으로 수정 및 조작 가능성 원천 차단`
  - Item 3: `[+] B2B 캡스톤 성적 평가 및 기업 채용 우대용 표준 PDF 발급`
- **Styling**: List icons use Lucide `Check` (`w-3.5 h-3.5 text-emerald-400 shrink-0`)

---

## 4. Architecture Bento Grid (3-Card Precision System)

### 4.1 Card 1: Hybrid GPU Sensing Engine (Railway Style)
- **Icon Container**: `w-8 h-8 rounded bg-slate-900 border border-slate-800 flex items-center justify-center text-blue-400 mb-3`
- **Icon**: Lucide `Cpu`
- **Title**: "Hybrid GPU Sensing" (`text-sm font-bold text-slate-200 mb-1`)
- **Description**: "로컬 NVIDIA RTX GPU 자동 감지 시 BYOG $0 원가 적용. 저사양/Apple Silicon 환경 진입 시 RunPod Secure Cloud A5000 우회 제공." (`text-xs text-slate-400 leading-relaxed`)
- **Metric Visualizer Box**:
  - Style: `mt-3 p-2 bg-slate-950 border border-slate-800 rounded font-mono text-[11px] text-slate-400 flex justify-between items-center`
  - Content: `[DETECTED: RTX 3080 10GB]` | Status Tag: `[BYOG READY]`

### 4.2 Card 2: Non-Intrusive Interceptor (Resend Style)
- **Icon Container**: `w-8 h-8 rounded bg-slate-900 border border-slate-800 flex items-center justify-center text-emerald-400 mb-3`
- **Icon**: Lucide `Code`
- **Title**: "Non-Intrusive Interceptor" (`text-sm font-bold text-slate-200 mb-1`)
- **Description**: "`pip install plaiground` 단 2줄 선언으로 AI 모델 파인튜닝 연산 속도 저하 없는 백그라운드 예외 및 스택 트레이스 수집." (`text-xs text-slate-400 leading-relaxed`)
- **Code Snippet Preview**:
  - Style: `mt-3 p-2 bg-slate-950 border border-slate-800 rounded font-mono text-[11px] text-slate-300`
  - Code: `import plaiground; plaiground.init()`

### 4.3 Card 3: Verified Ledger Engine (Supabase Style)
- **Icon Container**: `w-8 h-8 rounded bg-slate-900 border border-slate-800 flex items-center justify-center text-slate-300 mb-3`
- **Icon**: Lucide `ShieldCheck`
- **Title**: "Verified Ledger Engine" (`text-sm font-bold text-slate-200 mb-1`)
- **Description**: "타임스탬프와 무결성 디지털 서명이 포함된 기술검증 포트폴리오 PDF 및 Markdown 자동 생성." (`text-xs text-slate-400 leading-relaxed`)
- **Verification Tag Preview**:
  - Style: `mt-3 p-2 bg-emerald-950/40 border border-emerald-900/80 rounded font-mono text-[11px] text-emerald-400 flex justify-between items-center`
  - Content: `HASH: SHA256-8A07...` | Status Tag: `[VERIFIED]`

---

## 5. Resend-Style Interactive Live Demo Section

### 5.1 Interactive State Machine Specification
페이지 이탈 없이 유저가 버튼 클릭 한 번으로 에러 수집 및 디버깅 리포트 변환 과정을 직접 시뮬레이션하는 인터랙티브 모듈입니다.

- **Trigger Control**: `[Simulate CUDA OOM Error]` Button
- **State 1 (Default)**: Normal Execution Monitoring State
- **State 2 (Triggered)**:
  - Step 2.1: Intercepting Exception Log (`CUDA out of memory. Tried to allocate 2.40 GiB`)
  - Step 2.2: Automated Cause Analysis (`VRAM Exceeded due to Batch Size=16`)
  - Step 2.3: Code Diff Generation (- `batch_size = 16`, + `batch_size = 4`)
  - Step 2.4: Ledger Hash Signature Generation (`#PLAI-2026-0807`)

### 5.2 Code Diff Display Specification
- **Container**: `bg-slate-950 p-4 rounded border border-slate-800 font-mono text-xs leading-relaxed`
- **Deleted Line**: `text-rose-400 bg-rose-950/40 px-2 py-0.5 rounded border-l-2 border-rose-500 mb-1`
- **Added Line**: `text-emerald-400 bg-emerald-950/40 px-2 py-0.5 rounded border-l-2 border-emerald-500`

---

## 6. Target-Specific Value Propositions (B2B vs B2C)

### 6.1 B2B Section: University Faculty & Institutions
- **Target**: AI/SW 전공 학과장, 캡스톤 디자인 담당 교수, 부트캠프 운영자
- **Header**: `For University Faculty & SW Institutions` (`text-xs font-mono text-blue-400 uppercase tracking-wider mb-2`)
- **Key Metrics**:
  - Metric 1: "실습실 PC 교체 예산 대비 60% 이상 절감"
  - Metric 2: "1,000만 원 이하 소액 수의계약 예산 규격 완벽 충족"
  - Metric 3: "'CUDA 안 돼요' 질의응답 오버헤드 90% 감소"
- **LMS Preview Callout**: `[View Faculty LMS Dashboard]` Button

### 6.2 B2C Section: AI/SW Undergraduate Students & Devs
- **Target**: 캡스톤 과제 제출 및 기업 취업을 준비하는 대학생 및 예비 개발자
- **Header**: `For Undergraduate Students & Developers` (`text-xs font-mono text-emerald-400 uppercase tracking-wider mb-2`)
- **Key Metrics**:
  - Metric 1: "맥북 및 저사양 PC에서 5분 만에 24GB VRAM 환경 세팅"
  - Metric 2: "기업 채용 우대용 조작 불가능한 디버깅 포트폴리오 자동 추출"
  - Metric 3: "BYOG 기술 기반 기본 실습 원가 $0 사용"

---

## 7. Transparent Pricing & Contract Specification

### 7.1 B2B University Faculty Plan (Primary Highlight)
- **Package Name**: `B2B University Faculty Package`
- **Pricing**: `9,720,000 KRW / Year` (VAT Excluded / 60 Students / 9-Month Full Support)
- **Compliance Highlight**: "1,000만 원 이하 대학 수의계약 규격 자격 요건 완벽 충족"
- **Features Included**:
  - RunPod Secure Cloud A5000 크레딧 패키지
  - 교수님 전용 LMS 대시보드 (60명 관리)
  - 검증 포트폴리오 PDF 일괄 압축 다운로드
  - 전담 기술 지원 및 행정 서류(견적서/비교표) 발급

### 7.2 B2C Individual Plans
- **Standard Plan**: `15,000 KRW / Month ($10)`
  - RunPod Community Cloud 20시간
  - 검증 리포트 무제한 생성
- **Premium Plan**: `37,500 KRW / Month ($25)`
  - RunPod Community Cloud 30시간 (A6000 48GB 지원)
  - 검증 리포트 무제한 생성 + 우선 대기열

---

## 8. Technical FAQ Specification (Linear Style Accordion)

### 8.1 Accordion Component Rules
- **Border**: `border-b border-slate-800`
- **Trigger**: `text-xs font-bold text-slate-200 py-3 flex justify-between items-center cursor-pointer hover:text-blue-400`
- **Icon**: Lucide `ChevronRight` (Rotates 90 deg when active)
- **Content**: `text-xs text-slate-400 leading-relaxed pb-3 font-sans`

### 8.2 Content Items
- **Q1**: 기존 Google Colab 및 AWS와 무엇이 다른가요?
  - **A**: Colab은 세션 단절 및 에러 이력 보존이 불가능하지만, plAI-ground는 로컬/클라우드 세팅을 5분 만에 마치며 디버깅 과정 전체를 타임스탬프 검증 포트폴리오로 자동 변환합니다.
- **Q2**: 대학 학과 수의계약 진행 시 필요한 서류가 제공되나요?
  - **A**: 수의계약용 견적서, 단가 비교표, 사업자등록증, 통장사본 등 대학 행정 집행에 필요한 서류 일체를 패키지 구매 시 즉시 발급해 드립니다.
- **Q3**: 학생 소스코드 유출에 대한 보안 우려는 없나요?
  - **A**: 개인 소스코드는 외부로 전송되지 않으며, 백엔드에는 예외 메타데이터 및 Code Diff 정보만 암호화되어 수집됩니다.

---

## 9. Footer Specification (Vercel Minimal Style)

### 9.1 Layout Structure
- **Container**: `border-t border-slate-800 bg-[#0B0F19] py-8 mt-16`
- **Content Grid**: `grid grid-cols-1 md:grid-cols-4 gap-6 text-xs`

### 9.2 Columns Definition
- **Col 1 (Brand & Legal)**:
  - Logo + Name: `plAI-ground`
  - Copyright: `© 2026 plAI-ground Inc. All rights reserved.`
  - System Status: `ALL SYSTEMS OPERATIONAL [EMERALD]`
- **Col 2 (Platform Views)**:
  - `Landing Workspace`, `Environment Setup`, `Verified Portfolio`, `Faculty LMS`
- **Col 3 (B2B & Edu)**:
  - `University Reference`, `LINC 3.0 Guide`, `Contract Documents`
- **Col 4 (Compliance & Contact)**:
  - `Terms of Service`, `Privacy Policy`, `Technical Support`