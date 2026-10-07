import { useId, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Check,
  CheckCircle2,
  Code2,
  Copy,
  Cpu,
  ExternalLink,
  Laptop,
  Terminal,
  X,
} from 'lucide-react';

// ─── IDE Connect Hub — 옴니채널 네이티브 IDE 연동 허브 ───────────────────────────
// 브라우저 iframe Web IDE를 전면 폐기하고, 사용자의 데스크톱 IDE(VS Code, Cursor,
// Antigravity) 및 Google Colab과 1줄 명령어(plaiground pull)로 직접 연동합니다.
// apps/web/DESIGN.md 의 시각 시스템(The Liquid Ledger)과 안티-AI-슬롭 규칙을 엄격히 준수합니다.

const CHANNELS = [
  {
    id: 'vscode',
    name: 'VS Code',
    badge: 'Desktop Native',
    icon: Code2,
    tagline: '가장 널리 쓰이는 표준 개발 환경',
    getCommand: (code) => `plaiground pull ${code}`,
    steps: [
      { num: '01', title: 'VS Code 터미널 열기', desc: '단축키 Ctrl + ` (macOS: Cmd + `)로 내장 터미널을 실행합니다.' },
      { num: '02', title: '레시피 1줄 풀(Pull)', desc: '복사한 명령어를 실행하면 GPU 자동 감지 후 uv 가상환경이 빌드됩니다.' },
      { num: '03', title: '로컬 GPU 학습 시작', desc: 'python train.py를 실행하여 최적화된 CUDA 가속으로 학습을 시작합니다.' },
    ],
    note: 'RTX 2060S부터 5090까지 Compute Capability를 자동 분석하여 최적 PyTorch 2.14.1을 즉시 세팅합니다.',
  },
  {
    id: 'cursor',
    name: 'Cursor',
    badge: 'AI Native',
    icon: Laptop,
    tagline: 'AI 어시스턴트 페어 프로그래밍',
    getCommand: (code) => `plaiground pull ${code}`,
    steps: [
      { num: '01', title: 'Cursor 터미널 열기', desc: '내장 터미널에서 plaiground pull 명령어를 붙여넣고 엔터를 누릅니다.' },
      { num: '02', title: 'Composer AI 튜닝', desc: 'Ctrl + I (Composer)를 열어 하이퍼파라미터 및 손실 함수 구조를 튜닝합니다.' },
      { num: '03', title: '학습 및 실시간 인터셉트', desc: 'CUDA OOM이나 오류 발생 시 디버깅 이력이 포트폴리오에 자동 기록됩니다.' },
    ],
    note: 'AI 에디터와의 협업 디버깅 과정 전체가 타임스탬프와 함께 검증형 원장에 영구 보존됩니다.',
  },
  {
    id: 'antigravity',
    name: 'Antigravity',
    badge: 'Agentic AI',
    icon: Bot,
    tagline: 'DeepMind Antigravity 자율 에이전트',
    getCommand: (code) => `npx skills add plaiground/skills && plaiground pull ${code}`,
    steps: [
      { num: '01', title: '에이전트 스킬 등록', desc: '터미널에서 plaiground Skills 패키지를 등록하고 레시피를 내려받습니다.' },
      { num: '02', title: '자율 페어링 프롬프트', desc: '채팅에 입력: "@plaiground 레시피를 학습하고 텐서 손실값을 요약해줘"' },
      { num: '03', title: '백그라운드 자율 수행', desc: '에이전트가 가상환경 빌드, 스크립트 실행, 실시간 텔레메트리 연동을 수행합니다.' },
    ],
    note: '에이전트와의 질의응답 및 실험 반복 로그가 웹 대시보드와 즉시 동기화됩니다.',
  },
  {
    id: 'colab',
    name: 'Google Colab',
    badge: 'Cloud GPU (Free T4)',
    icon: ExternalLink,
    tagline: '로컬 GPU가 없는 Mac·노트북 환경',
    getCommand: (code) => `!pip install plaiground && plaiground pull ${code}`,
    steps: [
      { num: '01', title: 'Colab 새 노트북 열기', desc: '상단 메뉴 [런타임] ➔ [런타임 유형 변경]에서 T4 GPU를 선택합니다.' },
      { num: '02', title: '1줄 명령 셀 실행', desc: '첫 번째 코드 셀에 1줄 명령어를 붙여넣고 Shift + Enter로 실행합니다.' },
      { num: '03', title: '클라우드 GPU 학습', desc: '%run train.py 로 구글 클라우드 인프라에서 고속 학습을 시작합니다.' },
    ],
    linkUrl: 'https://colab.research.google.com/#create=true',
    linkLabel: 'Colab 새 노트북 열기',
    note: '설치 없이 브라우저 환경에서 동일한 레시피 코드로 실습을 즉시 진행할 수 있습니다.',
  },
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
  const [activeChannelId, setActiveChannelId] = useState('vscode');
  const [copiedCmd, setCopiedCmd] = useState(false);
  const [copiedToken, setCopiedToken] = useState(false);

  // 고유 레시피 코드 생성 (props 전달 시 우선 적용, 없으면 모델 ID 기반 고유 토큰 생성)
  const defaultCode = useMemo(() => {
    if (propRecipeCode) return propRecipeCode;
    const prefix = (model?.model_id?.split('-')[0] || 'PLAI').toUpperCase().slice(0, 4);
    const rand = Math.random().toString(36).substring(2, 6).toUpperCase();
    return `PLAI-${prefix}-${rand}`;
  }, [propRecipeCode, model?.model_id]);

  const recipeCode = propRecipeCode || defaultCode;
  const channel = CHANNELS.find((c) => c.id === activeChannelId) || CHANNELS[0];
  const command = channel.getCommand(recipeCode);

  const copyCommand = () => {
    navigator.clipboard?.writeText(command);
    setCopiedCmd(true);
    addToast?.('1줄 터미널 명령어가 클립보드에 복사되었습니다.');
    setTimeout(() => setCopiedCmd(false), 2200);
  };

  const copyToken = () => {
    navigator.clipboard?.writeText(recipeCode);
    setCopiedToken(true);
    addToast?.(`레시피 코드 [${recipeCode}]가 복사되었습니다.`);
    setTimeout(() => setCopiedToken(false), 2200);
  };

  const content = (
    <div className="space-y-7">
      {/* ── 상단 헤더: 모델 정보 & 고유 레시피 토큰 ── */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 pb-6 border-b border-line">
        <div>
          <div className="flex items-center gap-2.5 flex-wrap">
            <h2 className="font-display font-bold text-xl md:text-2xl text-ink tracking-tight">
              IDE Connect Hub
            </h2>
            <span className="inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-mint/10 border border-mint/20 text-mint font-mono text-[11px] tracking-wide">
              <span className="w-1.5 h-1.5 rounded-full bg-mint animate-pulse" />
              SYNC READY
            </span>
          </div>
          <p className="mt-1.5 text-[14px] text-mist leading-relaxed">
            {model ? (
              <>
                선택 모델: <span className="font-semibold text-ink">{model.model_id}</span>
                {model.params && <span className="text-dim font-mono"> ({model.params})</span>}
                {' · '}
                <span className="text-cobalt font-mono">{model.min_vram_gb > 0 ? `${model.min_vram_gb}GB+ VRAM` : 'CPU/GPU 가용'}</span>
              </>
            ) : (
              '터미널에서 1줄 명령을 실행하면 로컬 GPU에 최적화된 uv 가상환경이 자동 구성됩니다.'
            )}
          </p>
        </div>

        {/* 고유 레시피 토큰 카드 (The Liquid Ledger Gold Proof) */}
        <div className="flex items-center gap-3 bg-pit/80 px-4 py-2.5 rounded-lg border border-line self-start md:self-auto">
          <div className="text-left">
            <span className="block font-mono text-[10px] tracking-widest text-dim uppercase">Recipe Token</span>
            <span className="font-mono font-bold text-[15px] text-gold tracking-wider">{recipeCode}</span>
          </div>
          <button
            onClick={copyToken}
            title="레시피 토큰 복사"
            className="p-2 rounded-md hover:bg-white/10 text-mist hover:text-ink transition-colors flex items-center gap-1"
          >
            {copiedToken ? <Check className="w-4 h-4 text-mint" /> : <Copy className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* ── IDE 채널 선택 탭 (4대 옴니채널) ── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <span className="font-mono text-[11px] tracking-wider text-dim uppercase">Select Target IDE</span>
          <span className="text-[12px] text-mist">{channel.tagline}</span>
        </div>
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5">
          {CHANNELS.map((c) => {
            const Icon = c.icon;
            const active = activeChannelId === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setActiveChannelId(c.id)}
                className={`flex flex-col text-left p-3.5 rounded-lg transition-all ${
                  active
                    ? 'bg-white/8 border border-white/20 text-ink shadow-[0_0_20px_rgba(255,255,255,0.03)]'
                    : 'bg-pit/40 border border-line text-mist hover:bg-white/[0.03] hover:text-ink'
                }`}
              >
                <div className="flex items-center justify-between w-full">
                  <span className="font-display font-semibold text-[15px] flex items-center gap-2">
                    <Icon className={`w-4 h-4 ${active ? 'text-gold' : 'text-dim'}`} />
                    {c.name}
                  </span>
                  {active && <span className="w-1.5 h-1.5 rounded-full bg-gold" />}
                </div>
                <span className="mt-1 font-mono text-[11px] text-dim">{c.badge}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── 메인 바디: 터미널 명령 블록 (좌) vs 실행 단계 가이드 (우) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-stretch">
        {/* 좌측 (7 cols): 터미널 콘솔 & 1줄 복사 */}
        <div className="lg:col-span-7 flex flex-col justify-between rounded-lg border border-line bg-pit/70 overflow-hidden">
          {/* 터미널 상단 바 */}
          <div className="flex items-center justify-between px-4 py-2.5 border-b border-line bg-void/50">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-ember/70" />
              <span className="w-2.5 h-2.5 rounded-full bg-gold/70" />
              <span className="w-2.5 h-2.5 rounded-full bg-mint/70" />
              <span className="ml-2 font-mono text-[11px] text-dim">terminal · {channel.name}</span>
            </div>
            <span className="font-mono text-[11px] text-dim">{channel.badge}</span>
          </div>

          {/* 터미널 본문 */}
          <div className="p-5 font-mono text-[13px] leading-relaxed flex-1 flex flex-col justify-center">
            <p className="text-dim select-none"># 1. 원하는 디렉토리에서 아래 1줄 명령어를 실행하세요</p>
            <div className="mt-2.5 p-3.5 rounded bg-void border border-line/60 flex items-center justify-between gap-3 group">
              <span className="text-ink break-all select-all font-mono">
                <span className="text-gold select-none">$ </span>
                {command}
              </span>
            </div>
            <p className="mt-3 text-[12px] text-dim leading-relaxed select-none">
              # 2. 실행 시 하드웨어(NVIDIA 드라이버/CC)를 분석하여 최적 PyTorch 2.14.1이 자동 설치됩니다.
            </p>
          </div>

          {/* 터미널 푸터: 복사 버튼 (Two Stages Rule: ink pill) */}
          <div className="px-5 py-3.5 border-t border-line bg-void/30 flex items-center justify-between gap-3 flex-wrap">
            <div className="flex items-center gap-2">
              {channel.linkUrl && (
                <a
                  href={channel.linkUrl}
                  target="_blank"
                  rel="noreferrer"
                  className="px-4 py-2 rounded-full border border-line text-[13px] text-mist hover:text-ink hover:border-white/20 transition-colors flex items-center gap-1.5"
                >
                  <ExternalLink className="w-3.5 h-3.5" />
                  {channel.linkLabel}
                </a>
              )}
            </div>

            <button
              onClick={copyCommand}
              className="px-6 py-2.5 rounded-full bg-ink text-void text-[13px] font-semibold hover:bg-white transition-all flex items-center gap-2 shadow-sm"
            >
              {copiedCmd ? (
                <>
                  <Check className="w-4 h-4 text-emerald-700" />
                  <span>복사 완료!</span>
                </>
              ) : (
                <>
                  <Copy className="w-4 h-4" />
                  <span>1줄 명령어 복사</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* 우측 (5 cols): 3단계 실행 가이드 & 안내 */}
        <div className="lg:col-span-5 flex flex-col justify-between rounded-lg border border-line bg-pit/40 p-5 space-y-4">
          <div>
            <h3 className="font-display font-semibold text-[15px] text-ink flex items-center gap-2">
              <Terminal className="w-4 h-4 text-cobalt" />
              로컬 실행 가이드 (3 Steps)
            </h3>
            <ol className="mt-4 space-y-3.5">
              {channel.steps.map((st) => (
                <li key={st.num} className="flex items-start gap-3 text-left">
                  <span className="font-mono text-[12px] text-gold font-bold px-1.5 py-0.5 rounded bg-gold/10 shrink-0">
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

          <div className="pt-3 border-t border-line text-[12px] text-mist leading-relaxed">
            <p className="flex items-start gap-1.5">
              <span className="text-gold">💡</span>
              <span>{channel.note}</span>
            </p>
          </div>
        </div>
      </div>

      {/* ── 하단 액션 & 텔레메트리 연동 배너 ── */}
      <div className="p-4 rounded-lg bg-white/[0.02] border border-line flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-cobalt/15 flex items-center justify-center shrink-0">
            <Cpu className="w-4 h-4 text-cobalt" />
          </div>
          <div>
            <p className="text-[13px] font-medium text-ink">실시간 3D 텐서 시각화 및 학습 모니터링</p>
            <p className="text-[12px] text-dim">
              로컬 터미널에서 학습이 시작되면 View AI 화면에서 손실 곡선과 가중치가 실시간 스트리밍됩니다.
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2.5 w-full sm:w-auto justify-end">
          {onBack && (
            <button
              onClick={onBack}
              className="px-5 py-2.5 rounded-full border border-line text-[13px] text-mist hover:text-ink hover:border-white/20 transition-colors flex items-center gap-1.5"
            >
              <ArrowLeft className="w-3.5 h-3.5" /> 모델 다시 선택
            </button>
          )}
          {go && (
            <button
              onClick={() => go('view')}
              className="px-5 py-2.5 rounded-full bg-white/6 hover:bg-white/10 text-[13px] font-medium text-ink transition-colors flex items-center gap-1.5"
            >
              View AI 모니터링 열기 <ArrowRight className="w-3.5 h-3.5" />
            </button>
          )}
        </div>
      </div>
    </div>
  );

  if (isModal) {
    return (
      <div className="fixed inset-0 z-50 bg-void/80 backdrop-blur-md flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
        <div className="max-w-4xl w-full glass-card rounded-xl border border-line bg-pit/95 p-6 md:p-8 relative shadow-2xl animate-rise">
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
    <div className="glass-card rounded-xl border border-line bg-pit/40 p-6 md:p-8 animate-rise">
      {content}
    </div>
  );
}
