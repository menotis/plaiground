# plAI-ground Instructor LMS Dashboard Architecture Specification
- Document ID: SPEC-UI-04-LMS
- Version: 1.0.0-MVP (Desktop Environment)
- Target Viewport: Desktop Workstation (1920x1080 / 2560x1440 Optimized)
- Design Philosophy: Anti-AI Aesthetic, High-Density Academic Management, Extreme Administrative Efficiency

---

## 0. Anti-AI Aesthetic Rules Enforcement Checklist

본 명세서에 작성된 모든 UI 요소는 소위 "AI 냄새(AI Slop)"를 유발하는 다음 5가지 디자인 패턴을 엄격히 금지합니다.

1. **NO Text Emojis / Emoticons**:
   - 🏫, 🟢, 🔴, 📄, 📊, 📥 등 모든 형태의 텍스트 이모지 사용을 금지합니다.
   - 모든 상태 시각화는 오직 단색 Lucide SVG Icon (14px~16px) 및 Monospaced Text Tag (`[ACTIVE]`, `[COMPLETED]`, `[BYOG_MODE]`)로만 처리합니다.
2. **NO Excessive Border Radius (Anti-Bubble)**:
   - 둥근 캡슐, 버블 형태의 모달 및 라운딩을 전면 금지합니다.
   - 플랫폼 전체 LMS 컴포넌트는 **`rounded-sm` (2px)** 및 **`rounded-md` (6px)** 규격만 사용합니다.
3. **NO Multi-color Neon Gradients**:
   - 네온 보라/핑크 테두리, 무지개빛 Glow 효과를 일절 배제합니다.
   - 단색 슬레이트 캔버스 (`#0F172A`) 위에 **Electric Blue (`#3B82F6`)** 액션 컬러와 **Emerald Green (`#10B981`)** 활성 상태 컬러만 정교하게 배치합니다.
4. **NO Dead Space & Overcrowded Context**:
   - 60명 학생 데이터를 한 화면에서 조망할 수 있는 고밀도 Data Table 시스템을 적용합니다.

---

## 1. Class Header & Academic Metadata Bar

### 1.1 Header Container Specification
- **Container Style**: `p-5 rounded-md bg-[#0B0F19] border border-slate-800 flex flex-col sm:flex-row sm:items-center justify-between gap-4`

### 1.2 Academic Department Metadata Zone
- **Breadcrumb Tag**: `[ACADEMIC_DEPT: CHEONGJU_UNIV_AI_SW]`
  - Style: `px-2 py-0.5 rounded-sm bg-blue-950/80 text-blue-400 border border-blue-800 text-[11px] font-mono font-bold`
- **Class Title**: "2026-2 Capstone Design & AI Fine-Tuning Lab" (`text-xl font-bold text-slate-100 tracking-tight mt-1`)
- **Instructor Info**: `Faculty: Hong Seong-Ung Professor | Enrolled: 60 Students | License: B2B Faculty Package` (`text-xs font-mono text-slate-400 mt-1`)

### 1.3 Batch Action Control Group (Top Right)
- **Secondary Action (Export CSV Data)**:
  - Text: `[Export Assessment Data (CSV)]`
  - Icon: Lucide `FileSpreadsheet` (`w-3.5 h-3.5 mr-1.5`)
  - Style: `px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 text-slate-300 text-xs font-mono rounded-sm border border-slate-700 transition-all flex items-center`
- **Primary Action (Batch Export All Portfolios)**:
  - Text: `[Batch Export All Portfolios (ZIP/PDF)]`
  - Icon: Lucide `Download` (`w-3.5 h-3.5 mr-1.5`)
  - Style: `px-3.5 py-1.5 bg-blue-600 hover:bg-blue-500 text-white text-xs font-mono font-semibold rounded-sm border border-blue-500 transition-all flex items-center`

---

## 2. Class Overview KPI Cards (3-Card High Density)

### 2.1 Grid Layout
- **Grid**: `grid grid-cols-1 sm:grid-cols-3 gap-4`

### 2.2 Metric Card Specifications

#### Card 1: Student Activation Rate
- **Container**: `p-4 rounded-md bg-[#0B0F19] border border-slate-800`
- **Label**: `STUDENT ACTIVATION RATE` (`text-[10px] font-mono text-slate-500 uppercase`)
- **Main Metric**: `58 / 60 ACTIVE (96.6%)` (`text-lg font-mono font-bold text-slate-100 mt-1`)
- **Detail**: `2 Students Not Started` (`text-[11px] font-mono text-slate-500 mt-1`)

#### Card 2: Cumulative Error Resolutions
- **Container**: `p-4 rounded-md bg-[#0B0F19] border border-slate-800`
- **Label**: `CUMULATIVE RESOLVED EXCEPTIONS` (`text-[10px] font-mono text-slate-500 uppercase`)
- **Main Metric**: `243 RESOLVED EXCEPTIONS` (`text-lg font-mono font-bold text-rose-400 mt-1`)
- **Detail**: `Avg 4.05 Exceptions / Student` (`text-[11px] font-mono text-slate-500 mt-1`)

#### Card 3: Average Weekly Lab Duration
- **Container**: `p-4 rounded-md bg-[#0B0F19] border border-slate-800`
- **Label**: `AVG WEEKLY LAB DURATION` (`text-[10px] font-mono text-slate-500 uppercase`)
- **Main Metric**: `06h 12m / WEEK` (`text-lg font-mono font-bold text-emerald-400 mt-1`)
- **Detail**: `BYOG 72% | Cloud 28%` (`text-[11px] font-mono text-slate-500 mt-1`)

---

## 3. High-Density Student Management Table (Core Component)

### 3.1 Table Container Specification
- **Container Style**: `p-5 rounded-md bg-[#0B0F19] border border-slate-800 space-y-4`
- **Header Title**: `STUDENT LAB STATUS & VERIFIED PORTFOLIOS` (`text-xs font-mono text-slate-400 uppercase tracking-wider flex items-center gap-2`)
- **Icon**: Lucide `Users` (`w-4 h-4 text-blue-400`)

### 3.2 High-Density Table Layout Rules
- **Table Element**: `w-full text-left text-xs font-mono text-slate-300`
- **Header Row (`<thead>`)**:
  - Style: `bg-slate-950 text-slate-400 uppercase font-bold border-b border-slate-800`
  - Padding: `p-3`
  - Columns: `[Student Name]`, `[Student ID]`, `[HW Infrastructure]`, `[Execution Status]`, `[Resolved Exceptions]`, `[Final Loss]`, `[Actions]`

---

### 3.3 Sample Student Data Rows (`<tbody>`)

#### Row 1: Active Student (Completed)
- **Student Name**: Hong Gil-Dong (`font-bold text-slate-100`)
- **Student ID**: `20210001` (`text-slate-400`)
- **HW Infrastructure Tag**: `[BYOG: RTX 3080]` (`px-1.5 py-0.5 bg-slate-900 border border-slate-700 text-slate-300 rounded-sm text-[11px]`)
- **Execution Status Tag**: `[COMPLETED]` (`px-1.5 py-0.5 bg-emerald-950/80 border border-emerald-800 text-emerald-400 font-bold rounded-sm text-[11px]`)
- **Resolved Exceptions**: `5 Exceptions` (`text-rose-400 font-bold`)
- **Final Loss**: `0.1420` (`text-emerald-400 font-bold`)
- **Actions**:
  - Button 1: `[View Report]` (`px-2 py-1 bg-blue-600 hover:bg-blue-500 text-white rounded-sm text-[11px] font-bold border border-blue-500`)
  - Button 2: `[PDF]` (`px-2 py-1 bg-slate-900 hover:bg-slate-800 text-slate-300 rounded-sm text-[11px] font-bold border border-slate-700 ml-1`)

#### Row 2: Active Student (In Progress)
- **Student Name**: Kim Chul-Soo (`font-bold text-slate-100`)
- **Student ID**: `20210002` (`text-slate-400`)
- **HW Infrastructure Tag**: `[CLOUD: A5000]` (`px-1.5 py-0.5 bg-blue-950/80 border border-blue-800 text-blue-400 rounded-sm text-[11px]`)
- **Execution Status Tag**: `[IN_PROGRESS]` (`px-1.5 py-0.5 bg-blue-950/80 border border-blue-800 text-blue-400 font-bold rounded-sm text-[11px]`)
- **Resolved Exceptions**: `3 Exceptions` (`text-rose-400 font-bold`)
- **Final Loss**: `0.3810` (`text-slate-300`)
- **Actions**: `[View Report]` | `[PDF]`

#### Row 3: Inactive Student (Not Started)
- **Student Name**: Lee Young-Hee (`font-bold text-slate-100`)
- **Student ID**: `20210003` (`text-slate-400`)
- **HW Infrastructure Tag**: `[UNASSIGNED]` (`text-slate-600`)
- **Execution Status Tag**: `[NOT_STARTED]` (`px-1.5 py-0.5 bg-slate-900 border border-slate-800 text-slate-500 font-bold rounded-sm text-[11px]`)
- **Resolved Exceptions**: `0 Exceptions` (`text-slate-600`)
- **Final Loss**: `N/A` (`text-slate-600`)
- **Actions**: `[UNAVAILABLE]` (`text-slate-600 text-[11px]`)

---

## 4. Academic Evaluation Data Export Subsystem (CSV Export Spec)

### 4.1 CSV Data Structure Definition
`[Export Assessment Data (CSV)]` 클릭 시 발급되는 CSV 파일의 데이터 구조입니다.

```csv
Student_ID,Student_Name,HW_Mode,Status,Total_Exceptions,Resolved_Exceptions,Avg_Resolution_Time_Min,Final_Loss,Verification_Hash
20210001,Hong Gil-Dong,BYOG_3080,COMPLETED,5,5,12.4,0.1420,PLAI-2026-0807-SHA256
20210002,Kim Chul-Soo,CLOUD_A5000,IN_PROGRESS,3,3,18.1,0.3810,PLAI-2026-0808-SHA256
20210003,Lee Young-Hee,UNASSIGNED,NOT_STARTED,0,0,0.0,0.0000,NONE