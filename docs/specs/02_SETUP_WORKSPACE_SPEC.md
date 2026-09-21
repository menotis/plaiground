# plAI-ground Environment Setup Workspace Architecture Specification
- Document ID: SPEC-UI-02-SETUP
- Version: 1.0.0-MVP (Desktop Environment)
- Target Viewport: Desktop Workstation (1920x1080 / 2560x1440 Optimized)
- Design Philosophy: Anti-AI Aesthetic, Frictionless Onboarding, Technical Density

---

## 0. Anti-AI Aesthetic Rules Enforcement Checklist

본 명세서에 작성된 모든 UI 요소는 소위 "AI 냄새(AI Slop)"를 유발하는 다음 5가지 디자인 패턴을 엄격히 금지합니다.

1. **NO Text Emojis / Emoticons**:
   - 🚀, 🟢, 🔴, ⚡, 💻, ⚙️ 등 모든 형태의 텍스트 이모지 사용을 금지합니다.
   - 모든 상태 시각화는 Lucide SVG Icon (14px~16px) 및 Monospaced Text Badge (`[DETECTED]`, `[CONNECTED]`, `[BYOG_ACTIVE]`)로만 처리합니다.
2. **NO Excessive Border Radius (Anti-Bubble)**:
   - 둥근 캡슐, Pill 버튼, `rounded-2xl` 이상의 버블 디자인을 금지합니다.
   - 모든 컨테이너, 버튼, 입력창은 **`rounded-sm` (2px)** 및 **`rounded-md` (6px)** 규격으로 고정합니다.
3. **NO Multi-color Neon Gradients**:
   - 네온 보라/핑크 테두리, 무지개빛 Glow 효과를 금지합니다.
   - 슬레이트 다크 캔버스 (`#0F172A`) 위에 **Electric Blue (`#3B82F6`)** 및 **Emerald Green (`#10B981`)** 단색 액센트만 사용합니다.
4. **NO Dead Space & Overcrowded Context**:
   - 1px Solid Border (`#1E293B`) 기반 패널 구획화로 높은 정보 밀도를 유지하되, 정교한 마진/패딩 (`p-4`, `p-5`, `gap-3`)으로 시각적 피로도를 최소화합니다.

---

## 1. Workspace Header & Sub-Navigation

### 1.1 Header Layout & Dimension
- **Height**: `h-12` (48px fixed)
- **Background**: `bg-[#0B0F19]`
- **Border**: `border-b border-slate-800` (1px solid `#1E293B`)
- **Padding**: `px-6`

### 1.2 Breadcrumbs & Section Title
- **Breadcrumb Trail**: `Console / Workspaces / Environment Setup`
  - Font: `font-mono text-xs text-slate-500`
  - Active Item: `text-slate-200 font-semibold`
- **Title Block**:
  - Container: `flex items-center gap-2 mt-1`
  - Icon: Lucide `Terminal` (`w-4 h-4 text-blue-400`)
  - Title Text: "Environment Setup Workspace" (`text-base font-bold text-slate-100 tracking-tight`)
  - Subtitle Text: "하드웨어 자동 감지 및 2줄 코드 파이프라인 연동" (`text-xs text-slate-400 font-sans ml-2`)

---

## 2. Step 1: Hardware Sensing & Infrastructure Panel (Railway Style)

### 2.1 Panel Container Specification
- **Container Style**: `p-5 rounded-md bg-[#0B0F19] border border-slate-800 space-y-4`
- **Header Zone**:
  - Title: `STEP 1. HARDWARE AUTO-DETLECTION` (`text-xs font-mono text-slate-400 uppercase tracking-wider`)
  - Scan Status Tag: `[SCAN_COMPLETE]` (`text-[11px] font-mono text-emerald-400 border border-emerald-900 bg-emerald-950/50 px-2 py-0.5 rounded-sm flex items-center gap-1.5`)
  - Icon: Lucide `CheckCircle2` (`w-3.5 h-3.5 text-emerald-400`)

### 2.2 Dual Hardware Selector Cards (Grid Layout)
- **Grid**: `grid grid-cols-1 sm:grid-cols-2 gap-3`

#### Card A: Local GPU Mode (BYOG - Bring Your Own GPU)
- **Container Style (Selected)**: `p-4 rounded-md border border-blue-500 bg-slate-900/90 cursor-pointer`
- **Container Style (Unselected)**: `p-4 rounded-md border border-slate-800 bg-slate-950/50 hover:border-slate-700 cursor-pointer`
- **Card Header**:
  - Left: Lucide `Laptop` (`w-4 h-4 text-slate-300`) + Title "BYOG Local Mode" (`text-xs font-bold text-slate-200`)
  - Right Tag: `[COST: $0/hr]` (`text-[10px] font-mono px-1.5 py-0.5 rounded-sm bg-slate-800 text-slate-300 border border-slate-700`)
- **Metric Indicator Content**:
  - Hardware Name: `NVIDIA GeForce RTX 3080`
  - Detected VRAM: `10,240 MB / 10,240 MB (10GB VRAM)`
  - Status Message: "NVIDIA Driver & CUDA 12.1 정상 감지. QLoRA 최적화 파이프라인 즉시 적용 가능." (`text-xs text-slate-400 font-sans mt-2 leading-relaxed`)
  - Metric Bar: Monochromatic VRAM Usage Bar (`h-1.5 bg-slate-800 rounded-sm overflow-hidden mt-2` with `w-[100%] bg-blue-500`)

#### Card B: RunPod Secure Cloud (Cloud Fallback)
- **Container Style (Selected)**: `p-4 rounded-md border border-blue-500 bg-slate-900/90 cursor-pointer`
- **Container Style (Unselected)**: `p-4 rounded-md border border-slate-800 bg-slate-950/50 hover:border-slate-700 cursor-pointer`
- **Card Header**:
  - Left: Lucide `Server` (`w-4 h-4 text-slate-300`) + Title "RunPod Secure Cloud" (`text-xs font-bold text-slate-200`)
  - Right Tag: `[COST: $0.27/hr]` (`text-[10px] font-mono px-1.5 py-0.5 rounded-sm bg-blue-950 text-blue-400 border border-blue-800`)
- **Metric Indicator Content**:
  - Target Instance: `NVIDIA RTX A5000 Secure Pod`
  - Target VRAM: `24,576 MB (24GB VRAM)`
  - Status Message: "Apple Silicon (Mac) 및 저사양 환경 권장. 보안형 단독 GPU 인스턴스 1-Click 할당." (`text-xs text-slate-400 font-sans mt-2 leading-relaxed`)

### 2.3 Cloud Instance One-Click Action Banner (Triggered when Card B selected)
- **Container**: `p-3 bg-slate-950 border border-slate-800 rounded-md flex items-center justify-between text-xs font-mono`
- **Left Info**: `[POD_STATUS: READY]` | `Image: pytorch/pytorch:2.1.2-cuda12.1-cudnn8-runtime`
- **Action Button**: `[Spin Up A5000 Pod]` (`px-3 py-1.5 bg-blue-600 hover:bg-blue-500 text-white font-mono font-semibold rounded-sm border border-blue-500 transition-all`)

---

## 3. Step 2: 1-Click Code Snippet Integration Panel (Raycast Style)

### 3.1 Panel Container Specification
- **Container Style**: `p-5 rounded-md bg-[#0B0F19] border border-slate-800 space-y-4`
- **Header Zone**:
  - Title: `STEP 2. INTEGRATION CODE SNIPPET` (`text-xs font-mono text-slate-400 uppercase tracking-wider`)
  - Tab Group: `flex bg-slate-950 p-0.5 rounded-md border border-slate-800 text-xs`
    - Tab 1: `[Jupyter / Colab]` (`px-2.5 py-1 rounded-sm font-mono font-medium bg-slate-800 text-slate-100 border border-slate-700`)
    - Tab 2: `[Python CLI]` (`px-2.5 py-1 rounded-sm font-mono font-medium text-slate-400 hover:text-slate-200`)

### 3.2 Monospaced Code Display Block
- **Container**: `relative bg-slate-950 p-4 rounded-md border border-slate-800 font-mono text-xs leading-relaxed text-slate-200`
- **Copy Button Control**:
  - Position: `absolute top-3 right-3`
  - Style: `p-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-sm border border-slate-700 transition-all flex items-center gap-1 text-[11px]`
  - Icon: Lucide `Copy` (`w-3 h-3`) + Text "Copy"

#### Code Snippet A: Jupyter / Colab Cell Content
```python
# [Jupyter Notebook / Google Colab Cell]
!pip install plaiground --quiet
import plaiground

# Initialize Interceptor
plaiground.init(
    project_id="capstone-llama3",
    user_id="cju_20210001",
    auto_capture=True
)