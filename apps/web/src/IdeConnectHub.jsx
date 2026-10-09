import { useMemo, useState } from 'react';
import { Check, Copy, ExternalLink, X } from 'lucide-react';

// ─── IDE Connect Hub — 플랫폼별 옴니채널 연동 허브 ───────────────────────────────
// 1차: 사용자 플랫폼 선택 (VS Code, Cursor, Antigravity, Claude Code, Codex, Colab)
// 2차: 해당 플랫폼 내부의 3대 연동 방식 [ CLI | Skills | MCP ] (순서 고정)
//
// DESIGN.md "The Liquid Ledger" 안티-AI-슬롭(Anti-AI-Slop) 8대 절대 규칙 준수:
// - The Three Voices Rule: 수치 Schibsted, 한글 Noto Sans KR, 기계출력 JetBrains Mono
// - The No-Border-Bloat Rule: 최외곽 단일 카드 외 내부 중첩 1px 테두리 전면 배제
// - The No-Clipart-No-Emoji Rule: 장식용 이모지(0건) 및 제네릭 클립아트 퇴출, 공식 브랜드 에셋 적용
// - The Proportional Balance Rule: 세로 신장 배제, 수평 12컬럼 비대칭 균형 분할
// - The Two Stages Rule: 콘솔 액션은 뼈백색 ink pill (bg-ink text-void, hover 순백)

const PLATFORMS = [
  {
    id: 'vscode',
    name: 'VS Code',
    badge: 'Desktop Native',
    iconSrc: '/assets/icons/vscode.png',
    invert: false,
    tagline: '가장 널리 쓰이는 표준 데스크톱 개발 환경',
  },
  {
    id: 'cursor',
    name: 'Cursor',
    badge: 'AI Native',
    iconSrc: '/assets/icons/cursor.png',
    invert: true,
    tagline: 'AI 어시스턴트 페어 프로그래밍',
  },
  {
    id: 'antigravity',
    name: 'Antigravity',
    badge: 'Agentic AI',
    iconSrc: '/assets/icons/antigravity.png',
    invert: false,
    tagline: 'DeepMind Antigravity 자율 에이전트',
  },
  {
    id: 'claude',
    name: 'Claude Code',
    badge: 'Terminal Agent',
    iconSrc: '/assets/icons/claude.png',
    invert: false,
    tagline: 'Anthropic CLI 자율 코딩 에이전트',
  },
  {
    id: 'codex',
    name: 'Codex',
    badge: 'CLI Agent',
    iconSrc: '/assets/icons/codex.png',
    invert: true,
    tagline: 'OpenAI 명령어 기반 자율 에이전트',
  },
  {
    id: 'colab',
    name: 'Google Colab',
    badge: 'Cloud T4 GPU',
    iconSrc: null,
    invert: false,
    tagline: 'MacBook(macOS) 및 외장 GPU 미보유 환경용 무료 클라우드 실행',
  },
];

const MODES = [
  { id: 'cli', label: 'CLI (명령어)' },
  { id: 'skills', label: 'Skills (에이전트 스킬)' },
  { id: 'mcp', label: 'MCP (프로토콜)' },
];

export default function IdeConnectHub({
  model,
  recipeCode: propRecipeCode,
  onBack,
  isModal = false,
  onClose,
  go,
  addToast,
}) {
  const [activePlatformId, setActivePlatformId] = useState('vscode');
  const [activeMode, setActiveMode] = useState('cli'); // 'cli' | 'skills' | 'mcp'
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);

  // 고유 레시피 코드 생성
  const defaultCode = useMemo(() => {
    if (propRecipeCode) return propRecipeCode;
    const prefix = (model?.model_id?.split('-')[0] || 'PLAI').toUpperCase().slice(0, 4);
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `PLAI-${prefix}-${rand}`;
  }, [propRecipeCode, model?.model_id]);

  const recipeCode = propRecipeCode || defaultCode;
  const platform = PLATFORMS.find((p) => p.id === activePlatformId) || PLATFORMS[0];

  // 플랫폼 × 모드별 데이터 매핑
  const activePayload = useMemo(() => {
    // Google Colab 특화
    if (activePlatformId === 'colab') {
      return {
        command: `!pip install -q plaiground\nimport plaiground as pg\npg.pull('${recipeCode}')\n!python train.py`,
        label: 'Google Colab 노트북 셀 코드 (Python)',
        desc: '맥북(macOS) 및 외장 GPU가 없는 환경을 위해 구글 클라우드 무료 T4 GPU에서 1줄로 실행합니다.',
        colabUrl: 'https://colab.research.google.com/#create=true',
        steps: [
          { num: '01', title: 'Colab 새 노트북 열기', desc: '브라우저에서 새 노트북을 생성하고 런타임 유형을 [T4 GPU]로 설정합니다.' },
          { num: '02', title: '1줄 코드 실행', desc: '복사한 코드를 셀에 붙여넣고 실행하면 모델 템플릿과 데이터가 자동 로드됩니다.' },
          { num: '03', title: '실시간 웹 동기화', desc: '클라우드 학습 로그와 가중치 변화가 웹 View AI 대시보드로 실시간 동기화됩니다.' },
        ],
        note: 'MacBook 사용자 및 엔비디아 GPU가 없는 환경에서는 Colab 무료 T4 GPU를 활용하시는 것을 권장합니다.',
      };
    }

    // 모드 1: CLI (명령어)
    if (activeMode === 'cli') {
      switch (activePlatformId) {
        case 'vscode':
          return {
            command: `pip install plaiground && plaiground pull ${recipeCode}`,
            altCommand: `uvx plaiground pull ${recipeCode}`,
            label: 'VS Code 내장 터미널 실행 명령어',
            desc: 'VS Code 내장 터미널에서 실행 시 로컬 GPU를 자동 판별하여 uv 가상환경을 5초 내 빌드합니다.',
            steps: [
              { num: '01', title: '내장 터미널 실행', desc: 'VS Code에서 단축키 Ctrl + ` (macOS: Cmd + `)로 터미널을 엽니다.' },
              { num: '02', title: '1줄 명령어 실행', desc: '복사한 명령어를 실행하면 GPU 자동 감지 후 최적 PyTorch 2.14.1이 구성됩니다.' },
              { num: '03', title: '로컬 학습 시작', desc: '생성된 워크스페이스에서 python train.py를 실행하여 훈련을 개시합니다.' },
            ],
            note: 'NVIDIA 드라이버 및 Compute Capability(sm_75 ~ sm_120)를 자동 분석하여 최적 휠을 주입합니다.',
          };
        case 'cursor':
          return {
            command: `pip install plaiground && plaiground pull ${recipeCode}`,
            label: 'Cursor 터미널 실행 명령어',
            desc: 'Cursor 내장 터미널에서 실행하여 모델 템플릿 및 uv 초경량 가상환경을 구성합니다.',
            steps: [
              { num: '01', title: 'Cursor 터미널 열기', desc: '단축키 Ctrl + ` (Cmd + `)로 내장 터미널을 실행합니다.' },
              { num: '02', title: '레시피 풀', desc: '복사한 명령어를 실행하여 로컬 GPU 가속 가상환경을 자동 빌드합니다.' },
              { num: '03', title: '학습 및 텔레메트리', desc: 'python train.py를 실행하면 손실값과 디버깅 로그가 자동 기록됩니다.' },
            ],
            note: '로컬 GPU에 최적화된 PyTorch 가상환경이 생성되며 실시간 메트릭이 웹으로 전송됩니다.',
          };
        case 'antigravity':
          return {
            command: `plaiground pull ${recipeCode}`,
            label: 'Antigravity 터미널 명령어',
            desc: 'Antigravity 워크스페이스 터미널에서 레시피 코드를 직접 내려받아 환경을 구성합니다.',
            steps: [
              { num: '01', title: '터미널 열기', desc: 'Antigravity IDE 하단 터미널을 실행합니다.' },
              { num: '02', title: '레시피 풀', desc: '1줄 명령어를 실행하여 모델 템플릿과 uv 가상환경을 세팅합니다.' },
              { num: '03', title: '훈련 개시', desc: 'python train.py를 실행하여 로컬 GPU 가속 훈련을 수행합니다.' },
            ],
            note: '에이전트 워크스페이스 내에 독립된 가상환경과 실습 코드가 배치됩니다.',
          };
        case 'claude':
          return {
            command: `pip install plaiground && plaiground pull ${recipeCode}`,
            label: 'Claude Code 세션 터미널 명령어',
            desc: 'Claude Code가 실행 중인 터미널 세션에서 1줄 명령으로 실습 환경을 빌드합니다.',
            steps: [
              { num: '01', title: '터미널 준비', desc: 'Claude Code가 구동 중인 작업 디렉토리 터미널을 준비합니다.' },
              { num: '02', title: '레시피 풀 실행', desc: '1줄 명령을 실행하여 모델 템플릿과 uv 가상환경을 자동 빌드합니다.' },
              { num: '03', title: '학습 시작', desc: '생성된 워크스페이스에서 python train.py를 실행합니다.' },
            ],
            note: 'Claude Code 작업 디렉토리에 격리된 가상환경과 의도된 오류 템플릿이 배치됩니다.',
          };
        case 'codex':
        default:
          return {
            command: `plaiground pull ${recipeCode}`,
            label: 'Codex CLI 워크스페이스 명령어',
            desc: '명령어 기반 자율 코딩 환경에서 1줄로 템플릿과 가상환경을 빌드합니다.',
            steps: [
              { num: '01', title: '터미널 준비', desc: 'Codex 워크스페이스 터미널을 실행합니다.' },
              { num: '02', title: '레시피 풀', desc: '1줄 명령어를 실행하여 가상환경과 학습 코드를 세팅합니다.' },
              { num: '03', title: '스트리밍 학습', desc: 'python train.py를 실행하여 실시간 텔레메트리를 스트리밍합니다.' },
            ],
            note: '명령어 기반 자율 환경에서 실시간 텔레메트리가 웹으로 스트리밍됩니다.',
          };
      }
    }

    // 모드 2: Skills (에이전트 스킬)
    if (activeMode === 'skills') {
      switch (activePlatformId) {
        case 'antigravity':
          return {
            command: `npx skills add plaiground/skills && plaiground pull ${recipeCode}`,
            prompt: `@plaiground ${recipeCode} 레시피를 학습하고 텐서 손실값을 요약해줘`,
            label: 'Antigravity 에이전트 스킬 등록 및 프롬프트',
            desc: 'DeepMind Antigravity 에이전트에게 plAI-ground 공식 스킬 패키지를 주입하고 작업을 위임합니다.',
            steps: [
              { num: '01', title: '스킬 패키지 등록', desc: '터미널에서 npx skills 명령어로 plAI-ground 공식 스킬을 주입합니다.' },
              { num: '02', title: '자율 페어링 지시', desc: '채팅창에 @plaiground 추천 프롬프트를 입력하여 학습 목표를 지시합니다.' },
              { num: '03', title: '백그라운드 자율 수행', desc: '에이전트가 가상환경 빌드, 스크립트 실행, 실시간 텔레메트리 연동을 수행합니다.' },
            ],
            note: '에이전트와의 질의응답 및 실험 반복 로그가 웹 대시보드와 즉시 동기화됩니다.',
          };
        case 'cursor':
          return {
            command: `plaiground pull ${recipeCode} --rules`,
            rulesSnippet: `# .cursorrules - plAI-ground AI Pairing\nRecipe: ${recipeCode}\nRun: plaiground pull ${recipeCode}\nRole: AI Training Specialist. Inspect loss curves and auto-debug OOM errors.`,
            label: 'Cursor Rules(.cursorrules) 및 Composer 페어링',
            desc: '.cursorrules 파일에 규칙을 주입하여 Cursor Composer(Ctrl + I)가 디버깅을 전담하도록 설정합니다.',
            steps: [
              { num: '01', title: '규칙 주입', desc: '터미널에서 --rules 옵션으로 풀하거나 .cursorrules에 규칙 스니펫을 추가합니다.' },
              { num: '02', title: 'Composer AI 튜닝', desc: 'Ctrl + I(Cmd + I)로 Composer를 열어 모델 아키텍처 및 손실값을 AI와 검토합니다.' },
              { num: '03', title: '자동 에러 인터셉트', desc: 'CUDA OOM이나 오류 발생 시 디버깅 이력이 포트폴리오에 자동 기록됩니다.' },
            ],
            note: 'AI 에디터와의 협업 디버깅 과정 전체가 타임스탬프와 함께 검증형 원장에 영구 보존됩니다.',
          };
        case 'claude':
          return {
            command: `echo -e "\\n# plAI-ground Rules\\nRecipe: ${recipeCode}\\nTrack metrics with plaiground.track" >> CLAUDE.md`,
            rulesSnippet: `# CLAUDE.md - plAI-ground Integration\n- Recipe: ${recipeCode}\n- Training Script: python train.py\n- Error Intercept: Auto-logged to telemetry on exceptions\n- When editing code, preserve telemetry hooks and verify with check.py`,
            label: 'Claude Code 컨텍스트 지침(CLAUDE.md)',
            desc: '저장소 루트 CLAUDE.md에 학습 가이드라인과 텔레메트리 후크 보존 규칙을 주입합니다.',
            steps: [
              { num: '01', title: 'CLAUDE.md 지침 등록', desc: '저장소 루트 CLAUDE.md 파일에 레시피 규칙 스니펫을 추가합니다.' },
              { num: '02', title: '에이전트 지시', desc: 'Claude Code에게 "CLAUDE.md에 명시된 레시피를 학습하고 오류를 해결해줘"라고 지시합니다.' },
              { num: '03', title: '자율 디버깅 및 서명', desc: '에러 발생 시 Claude Code가 코드를 고치고 포트폴리오 인증을 획득합니다.' },
            ],
            note: 'Claude Code의 장기 기억 엔진(CLAUDE.md)을 활용하여 에이전트가 훈련 전 과정을 자율 제어합니다.',
          };
        case 'vscode':
          return {
            command: `npx skills add plaiground/skills && plaiground pull ${recipeCode}`,
            label: 'VS Code Copilot / AI 확장 스킬 연동',
            desc: 'VS Code 환경 내 AI 어시스턴트에게 plAI-ground 훈련 제어 스킬을 장착합니다.',
            steps: [
              { num: '01', title: '스킬 등록', desc: '터미널에서 npx skills add 명령어로 plAI-ground 스킬을 등록합니다.' },
              { num: '02', title: '프롬프트 지시', desc: '채팅에서 AI에게 딥러닝 실습 템플릿 검토 및 학습 실행을 요청합니다.' },
              { num: '03', title: '자동 텔레메트리', desc: '학습 로그와 코드 수정 이력이 실시간 대시보드와 동기화됩니다.' },
            ],
            note: 'VS Code 내 AI 어시스턴트에게 학습 및 디버깅 가이드라인을 제공합니다.',
          };
        case 'codex':
        default:
          return {
            command: `plaiground pull ${recipeCode} --agent codex`,
            label: 'Codex 에이전트 지침 주입',
            desc: 'Codex 에이전트 워크스페이스에 딥러닝 템플릿 조작 지침을 주입합니다.',
            steps: [
              { num: '01', title: '지침 배치', desc: 'Codex 워크스페이스에 전용 에이전트 지침 파일을 구성합니다.' },
              { num: '02', title: '코드 점검', desc: 'Codex CLI를 통해 하이퍼파라미터 및 가상환경 상태를 점검합니다.' },
              { num: '03', title: '자율 실행', desc: 'Codex가 학습을 실행하고 텔레메트리를 스트리밍합니다.' },
            ],
            note: 'OpenAI Codex 자율 에이전트 워크플로우에 최적화된 프롬프트를 제공합니다.',
          };
      }
    }

    // 모드 3: MCP (프로토콜)
    if (activeMode === 'mcp') {
      switch (activePlatformId) {
        case 'claude':
          return {
            command: `claude mcp add plaiground -- uvx plaiground mcp --recipe ${recipeCode}`,
            label: 'Claude Code 1줄 MCP 등록 명령어',
            desc: '터미널에서 1줄 명령으로 Claude Code에 plAI-ground 표준 도구를 직접 등록합니다.',
            tools: ['pull_recipe', 'start_training', 'stream_telemetry', 'create_portfolio'],
            steps: [
              { num: '01', title: '1줄 MCP 등록', desc: '터미널에서 claude mcp add 명령어를 실행합니다.' },
              { num: '02', title: '도구 권한 승인', desc: 'Claude Code 세션에서 plAI-ground MLOps 도구 사용을 승인합니다.' },
              { num: '03', title: '도구 기반 자율 실행', desc: 'Claude Code가 pull_recipe 도구를 호출하여 훈련 파이프라인을 구동합니다.' },
            ],
            note: 'Anthropic Claude Code CLI와 네이티브로 연동되는 표준 1줄 MCP 등록 명령어입니다.',
          };
        case 'cursor':
          return {
            command: JSON.stringify({
              name: 'plaiground',
              command: 'uvx',
              args: ['plaiground', 'mcp', '--recipe', recipeCode],
            }, null, 2),
            label: 'Cursor Settings > Features > MCP 등록 JSON',
            desc: 'Cursor 설정 창에서 plaiground MCP 서버를 등록하여 Composer에서 도구를 호출합니다.',
            tools: ['pull_recipe', 'start_training', 'stream_telemetry', 'create_portfolio'],
            steps: [
              { num: '01', title: 'Cursor MCP 설정 열기', desc: 'Settings > Features > MCP 메뉴로 이동합니다.' },
              { num: '02', title: '서버 설정 붙여넣기', desc: '복사한 JSON 구성을 추가하여 plaiground 도구를 등록합니다.' },
              { num: '03', title: 'Tool-call 페어링', desc: 'Composer에서 에이전트가 학습 시작 및 텔레메트리를 직접 호출합니다.' },
            ],
            note: 'Cursor Composer와 완벽 호환되는 로컬 stdio MCP 프로세스로 구동됩니다.',
          };
        case 'vscode':
          return {
            command: JSON.stringify({
              mcpServers: {
                plaiground: {
                  command: 'uvx',
                  args: ['plaiground', 'mcp', '--recipe', recipeCode],
                },
              },
            }, null, 2),
            label: '.vscode/mcp.json 설정 블록 (Cline / Roo-Code 호환)',
            desc: 'VS Code 프로젝트 디렉토리에 MCP 설정을 등록하여 에이전트 도구를 연동합니다.',
            tools: ['pull_recipe', 'start_training', 'stream_telemetry', 'create_portfolio'],
            steps: [
              { num: '01', title: '설정 파일 생성', desc: '프로젝트 루트 .vscode/mcp.json 파일에 설정 블록을 붙여넣습니다.' },
              { num: '02', title: '에이전트 도구 감지', desc: 'VS Code 에이전트(Cline 등)가 plAI-ground MLOps 도구를 감지합니다.' },
              { num: '03', title: '자율 훈련 제어', desc: '에이전트가 pull_recipe 및 start_training 도구를 호출합니다.' },
            ],
            note: 'VS Code MCP 클라이언트를 통해 에이전트가 플랫폼 파이프라인을 직접 제어합니다.',
          };
        case 'antigravity':
          return {
            command: JSON.stringify({
              mcpServers: {
                plaiground: {
                  command: 'uvx',
                  args: ['plaiground', 'mcp', '--recipe', recipeCode],
                },
              },
            }, null, 2),
            label: 'Antigravity mcp_config.json 설정 블록',
            desc: 'Antigravity 에이전트 환경에 plAI-ground 표준 도구를 등록합니다.',
            tools: ['pull_recipe', 'start_training', 'stream_telemetry', 'create_portfolio'],
            steps: [
              { num: '01', title: 'mcp_config.json 등록', desc: '에이전트 MCP 설정 파일에 plAI-ground 서버를 등록합니다.' },
              { num: '02', title: '도구 툴킷 활성화', desc: 'pull_recipe, start_training 도구가 에이전트에 노출됩니다.' },
              { num: '03', title: '자율 Tool-Call', desc: '에이전트가 도구 호출을 통해 무결성 포트폴리오를 발급합니다.' },
            ],
            note: 'Antigravity 사이드카 에이전트와 직접 통신하는 표준 도구 인터페이스를 제공합니다.',
          };
        case 'codex':
        default:
          return {
            command: `uvx plaiground mcp --recipe ${recipeCode}`,
            label: 'Codex MCP stdio 서버 실행 명령어',
            desc: 'Codex 에이전트 클라이언트에 stdio MCP 서버를 등록하여 도구를 연동합니다.',
            tools: ['pull_recipe', 'start_training', 'stream_telemetry', 'create_portfolio'],
            steps: [
              { num: '01', title: 'MCP 프로세스 등록', desc: 'Codex 클라이언트에 stdio MCP 서버를 등록합니다.' },
              { num: '02', title: '도구 호출 연동', desc: 'Codex 에이전트가 모델 제어 도구를 자동 감지합니다.' },
              { num: '03', title: '파이프라인 수행', desc: '학습 실행 및 메트릭 전송이 백그라운드에서 진행됩니다.' },
            ],
            note: 'Codex 환경에서 표준 프로토콜 기반으로 안전하게 연동됩니다.',
          };
      }
    }

    return {
      command: `pip install plaiground && plaiground pull ${recipeCode}`,
      label: '표준 1줄 실행 명령어',
      desc: '터미널에서 가상환경을 자동 구성합니다.',
      steps: [],
      note: '',
    };
  }, [activePlatformId, activeMode, recipeCode]);

  const copyCommand = () => {
    navigator.clipboard?.writeText(activePayload.command);
    setCopiedCmd(true);
    addToast?.('클립보드에 복사되었습니다.');
    setTimeout(() => setCopiedCmd(false), 2200);
  };

  const copyToken = () => {
    navigator.clipboard?.writeText(recipeCode);
    setCopiedToken(true);
    addToast?.(`레시피 코드 [${recipeCode}]가 복사되었습니다.`);
    setTimeout(() => setCopiedToken(false), 2200);
  };

  const content = (
    <div className="space-y-8">
      {/* ── 1. 상단 헤더: 모델 정보 & 고유 레시피 토큰 (무테두리 위계) ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h2 className="font-display font-bold text-xl md:text-2xl text-ink tracking-tight">
              IDE Connect Hub
            </h2>
            <span className="px-2 py-0.5 rounded bg-white/[0.04] text-mint font-mono text-[11px] tracking-wider">
              [SYNC READY]
            </span>
          </div>
          <p className="mt-1.5 text-[14px] text-mist leading-relaxed">
            {model ? (
              <>
                선택 모델: <span className="font-semibold text-ink">{model.model_id}</span>
                {model.params && <span className="text-dim font-mono"> ({model.params})</span>}
                {' · '}
                <span className="text-cobalt font-mono">{model.min_vram_gb > 0 ? `${model.min_vram_gb}GB+ VRAM 권장` : 'CPU/GPU 가용'}</span>
              </>
            ) : (
              '사용 중인 개발 도구를 선택하고 원하는 연동 모드(CLI, Skills, MCP)로 1줄 실행합니다.'
            )}
          </p>
        </div>

        {/* 고유 레시피 토큰 (골드 강조, 단독 복사 버튼) */}
        <div className="flex items-center gap-2.5 self-start md:self-auto">
          <div className="text-right">
            <span className="block font-mono text-[10px] tracking-widest text-dim uppercase">Recipe Token</span>
            <span className="font-mono font-bold text-[16px] text-gold tracking-wider">{recipeCode}</span>
          </div>
          <button
            onClick={copyToken}
            title="레시피 토큰 복사"
            className="p-1.5 rounded hover:bg-white/10 text-mist hover:text-ink transition-colors"
          >
            {copiedToken ? <Check className="w-3.5 h-3.5 text-mint" /> : <Copy className="w-3.5 h-3.5" />}
          </button>
        </div>
      </div>

      {/* ── 2. 1차 선택: 플랫폼/도구 그리드 (박스 테두리 전면 해제: 플랫 그리드) ── */}
      <div>
        <div className="flex items-center justify-between mb-2.5">
          <span className="font-mono text-[11px] tracking-wider text-dim uppercase">1. Select Platform</span>
          <span className="text-[12px] text-dim">{platform.tagline}</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
          {PLATFORMS.map((p) => {
            const active = activePlatformId === p.id;
            return (
              <button
                key={p.id}
                onClick={() => setActivePlatformId(p.id)}
                className={`p-3 rounded-lg text-left transition-colors flex flex-col justify-between ${
                  active
                    ? 'bg-white/12 text-ink'
                    : 'text-mist hover:text-ink hover:bg-white/[0.03]'
                }`}
              >
                <div className="flex items-center gap-2">
                  {p.iconSrc ? (
                    <img
                      src={p.iconSrc}
                      alt=""
                      className={`w-4 h-4 object-contain ${p.invert ? 'brightness-0 invert' : ''}`}
                    />
                  ) : (
                    <span className="w-2 h-2 rounded-full bg-gold/80" />
                  )}
                  <span className="font-display font-semibold text-[13.5px] truncate">{p.name}</span>
                </div>
                <span className="font-mono text-[10px] text-dim mt-2 block truncate">{p.badge}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── 3. 2차 선택: 연동 모드 [ CLI | Skills | MCP ] (순서 고정!) ── */}
      {activePlatformId !== 'colab' && (
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="font-mono text-[11px] tracking-wider text-dim uppercase">2. Select Mode</span>
            <span className="text-[12px] text-dim">
              {activeMode === 'cli' && '터미널에서 1줄 명령으로 uv 가상환경 자동 빌드'}
              {activeMode === 'skills' && '에이전트에 템플릿 제어 지침 및 스킬 주입'}
              {activeMode === 'mcp' && '표준 Model Context Protocol 도구 호출 연동'}
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {MODES.map((m) => {
              const active = activeMode === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => setActiveMode(m.id)}
                  className={`px-4 py-1.5 rounded-full font-mono text-[12px] transition-colors ${
                    active
                      ? 'bg-ink text-void font-semibold'
                      : 'text-mist hover:text-ink hover:bg-white/[0.04]'
                  }`}
                >
                  {m.label}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* ── 4. 메인 바디: 터미널 콘솔 (7 cols) vs 스텝 가이드 (5 cols) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* 좌측 (7 cols): 실행 터미널 & 코드 콘솔 (순수 다크 서피스, 중첩 테두리 해제) */}
        <div className="lg:col-span-7 flex flex-col justify-between rounded-lg bg-void/80 p-5 overflow-hidden">
          {/* 터미널 상단 바 */}
          <div className="flex items-center justify-between pb-3 text-[11px] font-mono text-dim border-b border-line/40">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-ember/70" />
              <span className="w-2.5 h-2.5 rounded-full bg-gold/70" />
              <span className="w-2.5 h-2.5 rounded-full bg-mint/70" />
              <span className="ml-1.5 text-dim">
                {platform.name} · {activePlatformId === 'colab' ? 'Notebook' : activeMode.toUpperCase()}
              </span>
            </div>
            <span>{platform.badge}</span>
          </div>

          {/* 터미널 메인 텍스트 및 코드 블록 */}
          <div className="py-4 font-mono text-[13px] leading-relaxed flex-1 flex flex-col justify-center">
            <p className="text-dim text-[12px] select-none">
              # {activePayload.label}
            </p>
            <div className="mt-2.5 py-3 px-3.5 rounded bg-pit/60 text-ink select-all overflow-x-auto">
              <pre className="font-mono text-[12.5px] leading-6 whitespace-pre-wrap break-all">
                {activeMode === 'cli' && activePlatformId !== 'colab' && <span className="text-gold select-none">$ </span>}
                {activeMode === 'skills' && activePlatformId === 'antigravity' && <span className="text-gold select-none">$ </span>}
                {activePayload.command}
              </pre>
            </div>

            {/* 프롬프트 힌트 (Antigravity Skills 전용) */}
            {activePayload.prompt && (
              <div className="mt-3 text-[12px] text-mist leading-relaxed select-none">
                <span className="text-dim"># 추천 프롬프트: </span>
                <span className="text-gold font-mono">{activePayload.prompt}</span>
              </div>
            )}

            {/* MCP 등록 도구 라벨 (MCP 전용) */}
            {activePayload.tools && (
              <div className="mt-3 flex items-center gap-2 flex-wrap text-[11px] text-dim select-none">
                <span>자동 등록 도구:</span>
                {activePayload.tools.map((tool) => (
                  <span key={tool} className="px-1.5 py-0.5 rounded bg-white/[0.04] text-mint font-mono">
                    {tool}
                  </span>
                ))}
              </div>
            )}

            <p className="mt-3 text-[12px] text-dim leading-relaxed select-none">
              # {activePayload.desc}
            </p>
          </div>

          {/* 터미널 푸터: CTA 복사 버튼 (The Two Stages Rule: 뼈백색 ink pill) */}
          <div className="pt-3 border-t border-line/40 flex items-center justify-between gap-3 flex-wrap">
            {activePlatformId === 'colab' ? (
              <a
                href={activePayload.colabUrl}
                target="_blank"
                rel="noreferrer"
                className="text-[12px] text-gold hover:text-gold-deep transition-colors inline-flex items-center gap-1.5"
              >
                <span>Google Colab 새 창 열기</span>
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            ) : (
              <span className="text-[11px] font-mono text-dim">
                {activePayload.altCommand ? '대안: ' + activePayload.altCommand : '클릭 시 클립보드에 자동 복사'}
              </span>
            )}

            <button
              onClick={copyCommand}
              className="px-6 py-2 rounded-full bg-ink text-void text-[13px] font-semibold hover:bg-white transition-all flex items-center gap-2"
            >
              {copiedCmd ? (
                <>
                  <Check className="w-4 h-4 text-emerald-700" />
                  <span>복사 완료</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>복사하기</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* 우측 (5 cols): 3단계 실행 가이드 (무테두리, 여백 기반 수평 정렬) */}
        <div className="lg:col-span-5 p-4 flex flex-col justify-between space-y-5">
          <div>
            <h3 className="font-display font-semibold text-[15px] text-ink">
              실행 가이드 (3 Steps)
            </h3>
            <ol className="mt-4 space-y-4">
              {activePayload.steps.map((st) => (
                <li key={st.num} className="flex items-start gap-3 text-left">
                  <span className="font-mono text-[11px] text-gold font-bold px-1.5 py-0.5 rounded bg-gold/10 shrink-0">
                    {st.num}
                  </span>
                  <div>
                    <p className="font-medium text-[13px] text-ink">{st.title}</p>
                    <p className="text-[12px] text-mist leading-relaxed mt-0.5">{st.desc}</p>
                  </div>
                </li>
              ))}
            </ol>
          </div>

          <div className="pt-3 text-[12px] text-dim leading-relaxed border-t border-line/30">
            <p>{activePayload.note}</p>
          </div>
        </div>
      </div>

      {/* ── 5. 하단 텔레메트리 모니터링 연동 배너 (단일 구분선, 무테두리) ── */}
      <div className="pt-6 border-t border-line/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <p className="text-[13px] font-medium text-ink">실시간 3D 텐서 시각화 및 학습 모니터링</p>
          <p className="text-[12px] text-dim mt-0.5">
            로컬 터미널 또는 Colab에서 학습이 시작되면 View AI 화면에서 손실 곡선과 가중치가 실시간 스트리밍됩니다.
          </p>
        </div>

        <div className="flex items-center gap-3 w-full sm:w-auto justify-end">
          {onBack && (
            <button
              onClick={onBack}
              className="text-[13px] text-mist hover:text-ink px-3 py-1.5 transition-colors"
            >
              모델 다시 선택
            </button>
          )}
          {go && (
            <button
              onClick={() => go('view')}
              className="px-5 py-2 rounded-full bg-ink text-void hover:bg-white text-[13px] font-semibold transition-all"
            >
              View AI 모니터링 열기 →
            </button>
          )}
        </div>
      </div>
    </div>
  );

  if (isModal) {
    return (
      <div className="fixed inset-0 z-50 bg-void/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
        <div className="max-w-4xl w-full rounded-xl border border-line bg-pit/95 p-6 md:p-8 relative shadow-2xl animate-rise">
          {onClose && (
            <button
              onClick={onClose}
              aria-label="닫기"
              className="absolute top-5 right-5 p-2 rounded-full hover:bg-white/10 text-dim hover:text-ink transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
          {content}
        </div>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-line bg-pit/40 p-6 md:p-8 animate-rise">
      {content}
    </div>
  );
}
