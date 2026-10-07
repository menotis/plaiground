import { useMemo, useState } from 'react';
import { Check, Copy, X } from 'lucide-react';

// ─── IDE Connect Hub — 옴니채널 네이티브 IDE 연동 허브 ───────────────────────────
// 데스크톱 IDE(VS Code, Cursor, Antigravity, Codex) 맞춤 1줄 명령어 연동.
// 디자인 원칙:
// 1. 단일 외곽 테두리 유지: 내부 컴포넌트, 탭, 박스마다 중첩되던 테두리를 전면 해제.
// 2. 텍스트/요소 주변 테두리 해제: 오직 가장 바깥 큰 카드만 테두리를 가지고 내부는 자연스러운 여백과 톤으로 구성.
// 3. 이모지 및 제네릭 아이콘 배제, 전달받은 공식 브랜드 에셋 사용.

const CHANNELS = [
  {
    id: 'vscode',
    name: 'VS Code',
    badge: 'Desktop Native',
    iconSrc: '/assets/icons/vscode.png',
    invert: false,
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
    iconSrc: '/assets/icons/cursor.png',
    invert: true,
    tagline: 'AI 어시스턴트 페어 프로그래밍',
    getCommand: (code) => `plaiground pull ${code}`,
    steps: [
      { num: '01', title: 'Cursor 터미널 열기', desc: '내장 터미널에서 plaiground pull 명령어를 붙여넣고 실행합니다.' },
      { num: '02', title: 'Composer AI 튜닝', desc: 'Ctrl + I (Composer)를 열어 모델 구조 및 하이퍼파라미터를 AI와 튜닝합니다.' },
      { num: '03', title: '학습 및 자동 인터셉트', desc: 'CUDA OOM이나 오류 발생 시 디버깅 이력이 포트폴리오에 자동 기록됩니다.' },
    ],
    note: 'AI 에디터와의 협업 디버깅 과정 전체가 타임스탬프와 함께 검증형 원장에 영구 보존됩니다.',
  },
  {
    id: 'antigravity',
    name: 'Antigravity',
    badge: 'Agentic AI',
    iconSrc: '/assets/icons/antigravity.png',
    invert: false,
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
    id: 'codex',
    name: 'Codex',
    badge: 'CLI Agent',
    iconSrc: '/assets/icons/codex.png',
    invert: true,
    tagline: '명령어 기반 자율 코딩 에이전트',
    getCommand: (code) => `plaiground pull ${code}`,
    steps: [
      { num: '01', title: '터미널 워크스페이스 세팅', desc: '터미널에서 1줄 명령어를 실행하여 Codex 워크스페이스를 구성합니다.' },
      { num: '02', title: '에이전트 코드 검토', desc: 'Codex CLI를 통해 하이퍼파라미터 및 가상환경 상태를 자동 점검합니다.' },
      { num: '03', title: '학습 및 텔레메트리 스트리밍', desc: 'python train.py 실행 후 실시간 손실 곡선과 가중치를 모니터링합니다.' },
    ],
    note: '명령어 기반 자율 에이전트 환경에서 실시간 텔레메트리가 웹 대시보드로 자동 스트리밍됩니다.',
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

  // 고유 레시피 코드 생성
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
    addToast?.('1줄 터미널 명령어가 복사되었습니다.');
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
      {/* ── 1. 상단 헤더: 모델 정보 & 고유 레시피 토큰 (무테두리) ── */}
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
                <span className="text-cobalt font-mono">{model.min_vram_gb > 0 ? `${model.min_vram_gb}GB+ VRAM` : 'CPU/GPU 가용'}</span>
              </>
            ) : (
              '터미널에서 1줄 명령을 실행하면 로컬 GPU에 최적화된 uv 가상환경이 자동 구성됩니다.'
            )}
          </p>
        </div>

        {/* 고유 레시피 토큰 (테두리/박스 없이 순수 텍스트 + 복사 버튼) */}
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

      {/* ── 2. IDE 채널 탭 (박스 테두리 전면 해제: 깔끔한 플랫 메뉴) ── */}
      <div>
        <div className="flex items-center justify-between mb-2">
          <span className="font-mono text-[11px] tracking-wider text-dim uppercase">Select Target IDE</span>
          <span className="text-[12px] text-dim">{channel.tagline}</span>
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {CHANNELS.map((c) => {
            const active = activeChannelId === c.id;
            return (
              <button
                key={c.id}
                onClick={() => setActiveChannelId(c.id)}
                className={`flex items-center justify-between p-3 rounded-lg text-left transition-colors ${
                  active
                    ? 'bg-white/10 text-ink'
                    : 'text-mist hover:text-ink hover:bg-white/[0.03]'
                }`}
              >
                <div className="flex items-center gap-2.5">
                  <img
                    src={c.iconSrc}
                    alt=""
                    className={`w-4 h-4 object-contain ${c.invert ? 'brightness-0 invert' : ''}`}
                  />
                  <span className="font-display font-semibold text-[14px]">{c.name}</span>
                </div>
                <span className="font-mono text-[11px] text-dim">{c.badge}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* ── 3. 메인 바디: 터미널 (좌) vs 실행 단계 가이드 (우) (개별 테두리 박스 해제) ── */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-stretch">
        {/* 좌측 (7 cols): 터미널 뷰 (박스 테두리 없음, 순수 다크 서피스) */}
        <div className="lg:col-span-7 flex flex-col justify-between rounded-lg bg-void/80 p-5 overflow-hidden">
          {/* 터미널 상단 라벨 */}
          <div className="flex items-center justify-between pb-3 text-[11px] font-mono text-dim">
            <div className="flex items-center gap-2">
              <span className="w-2.5 h-2.5 rounded-full bg-ember/70" />
              <span className="w-2.5 h-2.5 rounded-full bg-gold/70" />
              <span className="w-2.5 h-2.5 rounded-full bg-mint/70" />
              <span className="ml-1.5 text-dim">terminal · {channel.name}</span>
            </div>
            <span>{channel.badge}</span>
          </div>

          {/* 터미널 본문 (중첩 테두리 박스 해제) */}
          <div className="py-4 font-mono text-[13px] leading-relaxed flex-1 flex flex-col justify-center">
            <p className="text-dim select-none"># 1. 원하는 디렉토리에서 아래 1줄 명령어를 실행하세요</p>
            <div className="mt-2.5 py-3 px-3.5 rounded bg-pit/60 text-ink select-all">
              <span className="break-all">
                <span className="text-gold select-none">$ </span>
                {command}
              </span>
            </div>
            <p className="mt-3 text-[12px] text-dim leading-relaxed select-none">
              # 2. 실행 시 하드웨어(NVIDIA 드라이버/CC)를 분석하여 최적 PyTorch 2.14.1이 자동 설치됩니다.
            </p>
          </div>

          {/* 터미널 푸터: 복사 버튼 & Colab 보조 링크 */}
          <div className="pt-3 flex items-center justify-between gap-3 flex-wrap">
            <a
              href="https://colab.research.google.com/#create=true"
              target="_blank"
              rel="noreferrer"
              className="text-[12px] text-dim hover:text-mist hover:underline underline-offset-4 transition-colors"
            >
              로컬 GPU가 없으신가요? Colab에서 열기 ↗
            </a>

            <button
              onClick={copyCommand}
              className="px-6 py-2 rounded-full bg-ink text-void text-[13px] font-semibold hover:bg-white transition-all flex items-center gap-2"
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

        {/* 우측 (5 cols): 3단계 실행 가이드 (박스 테두리 해제, 자연스러운 리스트) */}
        <div className="lg:col-span-5 p-4 flex flex-col justify-between space-y-5">
          <div>
            <h3 className="font-display font-semibold text-[15px] text-ink">
              로컬 실행 가이드 (3 Steps)
            </h3>
            <ol className="mt-4 space-y-4">
              {channel.steps.map((st) => (
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

          <div className="pt-3 text-[12px] text-dim leading-relaxed">
            <p>{channel.note}</p>
          </div>
        </div>
      </div>

      {/* ── 4. 하단 텔레메트리 연동 (별도 박스 해제, 단일 구분선으로 정돈) ── */}
      <div className="pt-6 border-t border-line/60 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <p className="text-[13px] font-medium text-ink">실시간 3D 텐서 시각화 및 학습 모니터링</p>
          <p className="text-[12px] text-dim mt-0.5">
            로컬 터미널에서 학습이 시작되면 View AI 화면에서 손실 곡선과 가중치가 실시간 스트리밍됩니다.
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
