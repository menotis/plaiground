# plAI-ground Verified Debugging Portfolio Report Architecture Specification
- Document ID: SPEC-UI-03-REPORT
- Version: 1.0.0-MVP (Desktop Environment)
- Target Viewport: Desktop Workstation (1920x1080 / 2560x1440 Optimized)
- Design Philosophy: Anti-AI Aesthetic, Immutable Ledger Transparency, High Technical Precision

---

## 0. Anti-AI Aesthetic Rules Enforcement Checklist

본 명세서에 작성된 모든 UI 요소는 소위 "AI 냄새(AI Slop)"를 유발하는 다음 5가지 디자인 패턴을 엄격히 금지합니다.

1. **NO Text Emojis / Emoticons**:
   - 🛡️, 🟢, 🔴, 📄, 💡, ⏱️ 등 모든 형태의 텍스트 이모지 사용을 금지합니다.
   - 무결성 검증, 에러 상태, Diff 표시는 오직 단색 Lucide SVG Icon (14px~16px) 및 Monospaced Text Tag (`[VERIFIED_LEDGER]`, `[HASH_PASS]`, `[DIFF_RESOLVED]`)로만 처리합니다.
2. **NO Excessive Border Radius (Anti-Bubble)**:
   - 둥근 캡슐, 버블 형태의 모달 및 라운딩을 전면 금지합니다.
   - 플랫폼 전체 리포트 컴포넌트는 **`rounded-sm` (2px)** 및 **`rounded-md` (6px)** 규격만 사용합니다.
3. **NO Multi-color Neon Gradients**:
   - 무지개빛 네온 그라데이션 및 화려한 글로우 효과를 금지합니다.
   - 단색 슬레이트 캔버스 (`#0F172A`) 위에 **Emerald Green (`#10B981`)** 검증 컬러와 **Crimson Red (`#EF4444`)** 에러 포인트 컬러만 정교하게 배치합니다.
4. **NO Dead Space & Overcrowded Context**:
   - 리포트 본문의 가독성을 위해 1px Solid Border (`#1E293B`) 패널 시스템과 Monospace 타이포그래피 계층 구조를 적용합니다.

---

## 1. Verified Report Header & Action Bar

### 1.1 Header Container Specification
- **Container Style**: `p-5 rounded-md bg-[#0B0F19] border border-slate-800 space-y-4`
- **Top Metadata Row**:
  - Left Badge: `[VERIFIED_LEDGER: #PLAI-2026-0807]`
    - Style: `px-2.5 py-1 rounded-sm bg-emerald-950/80 text-emerald-400 border border-emerald-800 text-xs font-mono font-bold flex items-center gap-1.5`
    - Icon: Lucide `ShieldCheck` (`w-3.5 h-3.5 text-emerald-400`)
  - Timestamp: `2026.08.07 16:20:04 KST` (`text-xs font-mono text-slate-500`)

### 1.2 Title & Author Profile Zone
- **Project Title**: "Llama-3 8B QLoRA Fine-Tuning Task" (`text-xl font-bold text-slate-100 tracking-tight`)
- **Author Information**: `Author: Hong Gil-Dong | Student ID: 20210001 | Dept: AI & Software Engineering, Cheongju Univ.` (`text-xs font-mono text-slate-400 mt-1`)

### 1.3 Action Control Group (Top Right)
- **Secondary Action (Copy Verification Link)**:
  - Text: `[Copy Verification Link]`
  - Icon: Lucide `ExternalLink` (`w-3.5 h-3.5 mr-1.5`)
  - Style: `px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-mono rounded-sm border border-slate-700 transition-all flex items-center`
- **Primary Action (PDF Export)**:
  - Text: `[Export Standard PDF]`
  - Icon: Lucide `Download` (`w-3.5 h-3.5 mr-1.5`)
  - Style: `px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-mono font-semibold rounded-sm border border-blue-500 transition-all flex items-center`

---

## 2. Executive Metrics Summary Grid (4-Metric High Density)

### 2.1 Grid Layout
- **Grid**: `grid grid-cols-2 sm:grid-cols-4 gap-3 pt-4 border-t border-slate-800`

### 2.2 Metric Card Specifications

#### Metric 1: Total Debugging Duration
- **Container**: `p-3 bg-slate-950 rounded-sm border border-slate-800`
- **Label**: `TOTAL DEBUG DURATION` (`text-[10px] font-mono text-slate-500 uppercase`)
- **Value**: `04h 12m 38s` (`text-sm font-mono font-bold text-slate-100 mt-0.5`)

#### Metric 2: Resolved Exceptions
- **Container**: `p-3 bg-slate-950 rounded-sm border border-slate-800`
- **Label**: `RESOLVED EXCEPTIONS` (`text-[10px] font-mono text-slate-500 uppercase`)
- **Value**: `5 EXCEPTIONS` (`text-sm font-mono font-bold text-rose-400 mt-0.5`)

#### Metric 3: Final Training Loss
- **Container**: `p-3 bg-slate-950 rounded-sm border border-slate-800`
- **Label**: `FINAL TRAINING LOSS` (`text-[10px] font-mono text-slate-500 uppercase`)
- **Value**: `0.1420 (TARGET MET)` (`text-sm font-mono font-bold text-emerald-400 mt-0.5`)

#### Metric 4: Hash Ledger Status
- **Container**: `p-3 bg-slate-950 rounded-sm border border-slate-800`
- **Label**: `INTEGRITY CHECKSUM` (`text-[10px] font-mono text-slate-500 uppercase`)
- **Value**: `SHA256: PASS` (`text-sm font-mono font-bold text-blue-400 mt-0.5`)

---

## 3. Debugging Timeline & Code Diff Viewer (Core IP Panel)

### 3.1 Timeline Container
- **Header Title**: `DEBUGGING TIMELINE & CODE DIFF LEDGER` (`text-xs font-mono text-slate-400 uppercase tracking-wider flex items-center gap-2 mb-4`)
- **Icon**: Lucide `Activity` (`w-4 h-4 text-blue-400`)

---

### 3.2 Error Card Item 1: CUDA Out of Memory (OOM)

#### Header Bar
- **Style**: `flex items-center justify-between pb-3 border-b border-slate-800`
- **Left Badge**: `[ERROR #01]` (`px-2 py-0.5 bg-rose-950/80 text-rose-400 border border-rose-800 rounded-sm text-[11px] font-mono font-bold`)
- **Error Name**: `torch.cuda.OutOfMemoryError: CUDA out of memory.` (`text-xs font-mono font-bold text-slate-200 ml-2`)
- **Captured Timestamp**: `14:23:10 KST` (`text-xs font-mono text-slate-500`)

#### Automated Cause Diagnosis Container (Resend Style)
- **Container**: `p-3 rounded-sm bg-slate-950 border border-slate-800 font-mono text-xs space-y-1 my-3`
- **Label**: `[DIAGNOSIS]` (`text-amber-400 font-bold text-[11px]`)
- **Detail**: `Batch Size=16 설정으로 인해 RTX 3080 (10,240 MB) VRAM 한계 할당 초과. QLoRA gradient_accumulation 적용 필요.` (`text-slate-300 font-sans text-xs`)

#### Code Diff Box (Linear / Monospace Precision)
- **Container**: `p-4 rounded-sm bg-slate-950 border border-slate-800 font-mono text-xs leading-relaxed`
- **Diff Code Content**:
  ```diff
  # train.py (Line 42-45)
  - batch_size = 16
  + batch_size = 4
  + gradient_accumulation_steps = 4  # VRAM Optimization applied