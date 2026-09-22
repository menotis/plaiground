import { useCallback, useEffect, useState } from 'react';
import { flushSync } from 'react-dom';
import { ArrowUpRight, Check, GraduationCap, LogOut, ShieldCheck, X } from 'lucide-react';
import { supabase } from './supabase.js';
import { setAccessTokenGetter } from './api.js';
import StartAI from './StartAI.jsx';
import IdeView from './IdeView.jsx';
import ViewAI from './ViewAI.jsx';
import PortfolioView from './PortfolioView.jsx';
import Lms from './Lms.jsx';
import Community from './Community.jsx';

// 로고 — doc/로고v2_03_궤적_Trace.png 를 벡터로 옮김. 점은 currentColor라 다크/라이트 어디서든 보인다
const Logo = ({ className }) => (
  <svg viewBox="230 270 590 490" className={className} aria-hidden="true">
    <circle cx="283" cy="705" r="33" fill="currentColor" />
    <circle cx="363" cy="620" r="40" fill="currentColor" />
    <circle cx="453" cy="543" r="46" fill="currentColor" />
    <path d="M552 466 C 625 402, 700 356, 768 342" stroke="#12B981" strokeWidth="92" strokeLinecap="round" fill="none" />
  </svg>
);

// ─── 페이지 전환 — View Transitions API (웹 표준: 라이브러리·라이선스 불필요) ──
// 지원 브라우저는 이전/새 화면을 크로스페이드+슬라이드로 잇고,
// 미지원 브라우저는 새 화면 등장 애니메이션(.vt-fallback)으로 폴백한다.
const SUPPORTS_VT = typeof document !== 'undefined' && typeof document.startViewTransition === 'function';

function withTransition(update) {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (SUPPORTS_VT && !reduced) {
    document.startViewTransition(() => flushSync(update));
  } else {
    update();
  }
}

// ─── 랜딩 View AI 카드용 미니 네트워크 — 실제 View AI 화면의 축소판 ───────────
const MINI_LAYERS = [4, 5, 5, 3];
const MINI = (() => {
  let s = 7; // 고정 시드 — 렌더마다 같은 그림
  const rnd = () => ((s = (s * 16807) % 2147483647) / 2147483647) * 2 - 1;
  const pos = (li, i) => [24 + li * 84, 10 + ((i + 0.5) * 70) / MINI_LAYERS[li]];
  const edges = [];
  for (let li = 0; li < MINI_LAYERS.length - 1; li++)
    for (let a = 0; a < MINI_LAYERS[li]; a++)
      for (let b = 0; b < MINI_LAYERS[li + 1]; b++) {
        const w = rnd() * 0.9;
        edges.push({ p1: pos(li, a), p2: pos(li + 1, b), w });
      }
  edges.sort((a, b) => Math.abs(b.w) - Math.abs(a.w));
  const nodes = MINI_LAYERS.flatMap((n, li) => Array.from({ length: n }, (_, i) => ({ p: pos(li, i), out: li === 3 })));
  return { edges: edges.slice(0, 42), nodes };
})();

function MiniNetwork() {
  return (
    <svg viewBox="0 0 300 90" className="mt-5 w-full h-20" aria-hidden="true">
      {MINI.edges.map((e, i) => (
        <line
          key={i}
          x1={e.p1[0]} y1={e.p1[1]} x2={e.p2[0]} y2={e.p2[1]}
          stroke={e.w >= 0 ? '#4ade9b' : '#fb7185'}
          strokeOpacity={0.15 + Math.abs(e.w) * 0.45}
          strokeWidth={0.4 + Math.abs(e.w) * 1.4}
        />
      ))}
      {MINI.nodes.map((n, i) => (
        <circle key={i} cx={n.p[0]} cy={n.p[1]} r="3.5" fill="#10141c" stroke={n.out ? '#e8b34b' : 'rgba(255,255,255,0.35)'} strokeWidth="1" />
      ))}
    </svg>
  );
}

// ─── Toast ────────────────────────────────────────────────────────────────────
function Toasts({ toasts, remove }) {
  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none print:hidden" role="status" aria-live="polite">
      {toasts.map((t) => (
        <div key={t.id} className="pointer-events-auto glass-card rounded-lg px-4 py-3 flex items-center gap-3 text-xs min-w-64">
          <Check className="w-3.5 h-3.5 text-mint shrink-0" />
          <span className="flex-1 text-ink">{t.message}</span>
          <button onClick={() => remove(t.id)} aria-label="알림 닫기" className="text-dim hover:text-ink transition-colors">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      ))}
    </div>
  );
}

// ─── 로그인 메뉴 (Google OAuth · Supabase 세션) ───────────────────────────────
const ROLE_LABEL = { student: '학생', faculty: '교수', admin: '관리자' };

function LoginMenu({ profile, onLogin, onLogout }) {
  if (profile) {
    const staff = profile.role === 'faculty' || profile.role === 'admin';
    return (
      <div className="flex items-center gap-1.5">
        <span className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-medium ${
          staff ? 'bg-gold/15 text-gold' : 'bg-cobalt/15 text-cobalt'
        }`}>
          {staff ? <ShieldCheck className="w-3.5 h-3.5" /> : <GraduationCap className="w-3.5 h-3.5" />}
          {profile.display_name || ROLE_LABEL[profile.role]}
          {profile.display_name && <span className="opacity-60">· {ROLE_LABEL[profile.role]}</span>}
        </span>
        <button
          onClick={onLogout}
          aria-label="로그아웃"
          className="p-2 rounded-full text-mist hover:text-ink hover:bg-white/5 transition-colors"
        >
          <LogOut className="w-3.5 h-3.5" />
        </button>
      </div>
    );
  }

  return (
    <button
      onClick={onLogin}
      className="px-4 py-2 rounded-full text-[13px] text-mist hover:text-ink transition-colors"
    >
      Google로 로그인
    </button>
  );
}

// ─── 공통 상단 바 — 랜딩·콘솔 모든 페이지에서 동일한 형태 ─────────────────────
const BASE_TABS = [
  { id: 'start', label: 'Start AI' },
  { id: 'ide', label: 'Web IDE' },
  { id: 'view', label: 'View AI' },
  { id: 'portfolio', label: 'Portfolio' },
  { id: 'community', label: 'Community' },
];
const ADMIN_TAB = { id: 'lms', label: 'Faculty LMS' };

function TopBar({ view, go, profile, onLogin, onLogout }) {
  const staff = profile?.role === 'faculty' || profile?.role === 'admin';
  const tabs = staff ? [...BASE_TABS, ADMIN_TAB] : BASE_TABS;
  const link = (t, extra = '') => (
    <button
      key={t.id}
      onClick={() => go(t.id)}
      aria-current={view === t.id ? 'page' : undefined}
      className={`font-medium tracking-[-0.01em] transition-colors ${extra} ${view === t.id ? 'text-ink font-semibold' : 'text-mist hover:text-ink'}`}
    >
      {t.label}
    </button>
  );
  return (
    <header data-topbar className="fixed top-0 inset-x-0 z-40 bg-void/85 backdrop-blur-md border-b border-line print:hidden">
      <div className="max-w-6xl mx-auto px-6 h-16 flex items-center justify-between">
        <button onClick={() => go('landing')} className="flex items-center gap-2 shrink-0" aria-label="메인으로 이동">
          <Logo className="w-7 h-7 text-ink" />
          <span className="font-display font-bold tracking-tight text-[15px]">plAI-ground</span>
        </button>
        <nav className="hidden md:flex items-center gap-6 text-[13px]">
          {tabs.map((t) => link(t))}
        </nav>
        <LoginMenu profile={profile} onLogin={onLogin} onLogout={onLogout} />
      </div>
      {/* 모바일 전용 메뉴 행 */}
      <nav className="md:hidden flex items-center gap-5 overflow-x-auto px-6 pb-3 text-[13px]">
        {tabs.map((t) => link(t, 'whitespace-nowrap'))}
      </nav>
    </header>
  );
}

// ─── 랜딩 페이지 ──────────────────────────────────────────────────────────────
function Landing({ go, profile, onLogin, onLogout }) {
  const [openFaq, setOpenFaq] = useState(0);

  const faqs = [
    {
      q: '기존 Google Colab 및 AWS와 무엇이 다른가요?',
      a: 'Colab은 세션 단절 및 에러 이력 보존이 불가능하지만, plAI-ground는 로컬/클라우드 세팅을 5분 만에 마치며 디버깅 과정 전체를 타임스탬프 검증 포트폴리오로 자동 변환합니다.',
    },
    {
      q: '대학 학과 수의계약 진행 시 필요한 서류가 제공되나요?',
      a: '수의계약용 견적서, 단가 비교표, 사업자등록증, 통장사본 등 대학 행정 집행에 필요한 서류 일체를 패키지 구매 시 즉시 발급해 드립니다.',
    },
    {
      q: '학생 소스코드 유출에 대한 보안 우려는 없나요?',
      a: '개인 소스코드는 외부로 전송되지 않으며, 백엔드에는 예외 메타데이터 및 Code Diff 정보만 암호화되어 수집됩니다.',
    },
  ];

  return (
    <div className="min-h-screen bg-void text-ink overflow-x-clip">
      {/* ── 내비게이션 — 모든 페이지 공통 TopBar ── */}
      <TopBar view="landing" go={go} profile={profile} onLogin={onLogin} onLogout={onLogout} />

      {/* ── 히어로 — 학습 여정이 원장이 되는 순간을 그대로 보여준다 ── */}
      <section id="top" className="relative overflow-hidden">
        <div className="relative max-w-6xl mx-auto px-6 pt-36 pb-24 grid grid-cols-1 lg:grid-cols-12 gap-14 items-center">
          {/* 좌측 — 메시지 */}
          <div className="lg:col-span-6">
            <h1 className="font-display font-bold tracking-[-0.04em] leading-[1.05] text-[clamp(2.4rem,4.4vw,3.75rem)] animate-rise">
              Train the Model.
              <br />
              Prove the Journey.
            </h1>
            <p className="mt-7 max-w-lg text-[15px] leading-relaxed text-mist animate-rise-late">
              5분 원클릭 GPU 실습 환경 구축부터, 디버깅 과정이 그대로
              검증형 포트폴리오가 되는 통합 AI 실습 플랫폼.
            </p>
            <div className="mt-9 animate-rise-later">
              <button
                onClick={() => go('start')}
                className="px-8 py-3 rounded-full bg-gold text-void text-sm font-semibold hover:brightness-110 transition-all"
              >
                Try it now
              </button>
            </div>
          </div>

          {/* 우측 — 트레이닝 세션 터미널 (제품 메커니즘의 극화) */}
          <div className="lg:col-span-6 animate-rise-late" aria-hidden="true">
            <div className="glass-card rounded-lg overflow-hidden">
              <div className="flex items-center gap-2 px-5 py-3 border-b border-line">
                <span className="w-2.5 h-2.5 rounded-full bg-ember/70" />
                <span className="w-2.5 h-2.5 rounded-full bg-gold/70" />
                <span className="w-2.5 h-2.5 rounded-full bg-mint/70" />
                <span className="ml-2 font-mono text-[11px] text-dim">plaiground · training session</span>
              </div>
              <div className="px-5 py-4 font-mono text-[12px] leading-7">
                <p className="text-mist"><span className="text-dim">[EPOCH 02/03]</span> loss 1.284 · f1 0.412</p>
                <p className="text-ember">[INTERCEPT] RuntimeError: CUDA out of memory (batch_size=64)</p>
                <p className="text-ember/90 pl-4">- batch_size = 64</p>
                <p className="text-mint pl-4">+ batch_size = 16, grad_accum = 4</p>
                <p className="text-cobalt"><span className="text-dim">[RESUME]</span> loss 1.12 · f1 0.783 (+37.1%p)</p>
                <p className="text-gold flex items-center gap-2">
                  [LEDGER] SHA-256 서명 완료 — 이력은 이제 증명입니다
                  <span className="w-1.5 h-1.5 rounded-full bg-gold animate-pulse" />
                </p>
              </div>
              {/* 서명 푸터 — 떠 있는 카드 대신 터미널의 마지막 행으로 */}
              <div className="px-5 py-3 border-t border-line flex items-center justify-between gap-3 flex-wrap font-mono text-[11px]">
                <span className="text-gold truncate">sha256: 8a07f3c1d2e9b4a0f6c8… <span className="text-dim">(예시)</span></span>
                <span className="text-dim">실제 해시는 포트폴리오에서 발급</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── 플랫폼 ── */}
      <section id="platform" className="max-w-6xl mx-auto px-6 py-28">
        <h2 className="font-display font-bold tracking-[-0.025em] text-[clamp(1.75rem,3.2vw,2.375rem)] max-w-2xl leading-tight">
          환경 세팅에서 증명까지,
          <br />
          하나의 워크스페이스.
        </h2>

        {/* 떠 있는 카드 3장 대신, 괘선으로 나뉜 하나의 시트 */}
        <div className="mt-12 border border-line rounded-lg grid grid-cols-1 lg:grid-cols-3 divide-y lg:divide-y-0 lg:divide-x divide-line">
          {[
            {
              id: 'start', title: 'One-Click GPU Lab',
              desc: 'Docker 데몬·베이스 이미지·로컬 GPU를 자동 감지하고, 모델을 고르면 학습 코드 생성과 컨테이너 기동까지 실제 파이프라인이 돌아갑니다.',
              preview: (
                <div className="font-mono text-[11.5px] leading-6 text-mist">
                  <p><span className="text-cobalt">[1/4]</span> Docker · plaiground-base:dev 확인</p>
                  <p><span className="text-cobalt">[2/4]</span> ModelCatalog → klue-bert-finetune</p>
                  <p><span className="text-cobalt">[3/4]</span> train 스크립트 생성 및 마운트</p>
                  <p><span className="text-mint">[4/4]</span> code-server 기동 <span className="text-mint">READY</span></p>
                </div>
              ),
            },
            {
              id: 'view', title: 'Live Training Telemetry',
              desc: '노드 가중치와 경사하강 변화, Loss·Accuracy·VRAM을 실시간 애니메이션으로 추적합니다.',
              preview: <MiniNetwork />,
            },
            {
              id: 'portfolio', title: 'Verified Portfolio',
              desc: '에러 해결 이력과 성능 델타가 SHA-256 서명과 함께 1페이지 포트폴리오로 자동 생성됩니다.',
              preview: (
                <div className="font-mono text-[11.5px] leading-6">
                  <p className="text-ember">- batch_size = 64  <span className="text-dim"># CUDA OOM</span></p>
                  <p className="text-mint">+ batch_size = 16, grad_accum = 4</p>
                  <p className="text-gold mt-1">sha256 서명 → 채용·평가용 PDF</p>
                </div>
              ),
            },
          ].map((f) => (
            <button key={f.id} onClick={() => go(f.id)} className="p-6 text-left group flex flex-col hover:bg-white/[0.025] transition-colors">
              <h3 className="font-display font-bold text-lg flex items-center gap-1.5">
                {f.title}
                <ArrowUpRight className="w-4 h-4 text-dim group-hover:text-ink group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-all" />
              </h3>
              <p className="mt-2 text-sm text-mist leading-relaxed">{f.desc}</p>
              <div className="mt-5 pt-4 border-t border-line flex-1 flex flex-col justify-center">{f.preview}</div>
            </button>
          ))}
        </div>
      </section>

      {/* ── 파이프라인 ── */}
      <section id="pipeline" className="border-y border-line bg-pit/60">
        <div className="max-w-6xl mx-auto px-6 py-24">
          <h2 className="font-display font-bold tracking-[-0.025em] text-[clamp(1.75rem,3.2vw,2.375rem)]">
            학습을 대신 돌려주지 않습니다.
          </h2>
          <p className="mt-4 text-mist text-sm max-w-2xl leading-relaxed">
            코드를 직접 보고, 고치고, 실행하는 경험이 제품입니다. plAI-ground는 그 과정을
            가로막는 세팅과, 그 과정을 증명하는 기록만 자동화합니다.
          </p>
          <ol className="mt-14 grid grid-cols-1 lg:grid-cols-4 gap-y-10 lg:gap-y-0">
            {[
              ['모델 선택', 'ModelCatalog에서 과제에 맞는 모델과 데이터셋을 고릅니다.'],
              ['환경 세팅', 'Docker 컨테이너와 학습 스크립트가 자동으로 준비됩니다.'],
              ['IDE에서 직접 학습', 'code-server 터미널에서 코드를 고치고 실행합니다. 에러는 자동 수집.'],
              ['포트폴리오 발급', '텔레메트리가 검증형 포트폴리오 HTML로 렌더링됩니다.'],
            ].map(([title, desc], i, arr) => (
              <li key={title} className="relative lg:pr-8">
                {/* 진행 레일 — 순서 자체가 정보라서 연결선으로 잇는다 */}
                <div className="flex items-center gap-3">
                  <span className={`w-3 h-3 rounded-full shrink-0 ${i === arr.length - 1 ? 'bg-gold' : 'border-2 border-gold/70 bg-void'}`} />
                  {i < arr.length - 1 && <span className="hidden lg:block flex-1 h-px bg-gradient-to-r from-gold/50 to-white/10" />}
                </div>
                <p className="mt-4 font-display font-bold text-[15px]">{title}</p>
                <p className="mt-2 text-[13px] text-mist leading-relaxed max-w-56">{desc}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ── 가격 — B2C 두 티어만 ── */}
      <section id="pricing" className="max-w-3xl mx-auto px-6 py-28">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5 items-stretch">
          {[
            {
              name: 'Standard', price: '₩15,000', margin: '캡스톤·과제 실습에 충분한 기본 구성',
              feats: ['원클릭 GPU 실습 환경', '검증 포트폴리오 무제한 발급', 'RunPod Community Cloud 20시간'],
            },
            {
              name: 'Premium', price: '₩37,500', margin: '대형 모델 파인튜닝을 위한 상위 구성',
              feats: ['A6000 48GB 클라우드 지원', '검증 포트폴리오 무제한 + 우선 대기열', 'RunPod Community Cloud 30시간'],
            },
          ].map((tier) => (
            <div key={tier.name} className="glass-clear rounded-lg p-7 flex flex-col">
              <h3 className="font-display font-bold text-lg">{tier.name}</h3>
              <p className="mt-1 text-[13px] text-mist">개인 정기 구독</p>
              <p className="mt-6 font-display font-bold text-4xl tabular">{tier.price}<span className="text-base text-mist font-medium"> /월</span></p>
              <p className="mt-1 text-[12px] text-dim">{tier.margin}</p>
              <ul className="mt-6 space-y-2.5 text-[13px] text-mist flex-1">
                {tier.feats.map((f) => (
                  <li key={f} className="flex items-start gap-2.5">
                    <Check className="w-3.5 h-3.5 text-cobalt shrink-0 mt-0.5" />
                    {f}
                  </li>
                ))}
              </ul>
              <button
                onClick={() => go('start')}
                className="mt-7 w-full py-3 rounded-full border border-line text-sm text-ink hover:border-white/30 hover:bg-white/5 transition-colors"
              >
                지금 시작하기
              </button>
            </div>
          ))}
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="max-w-3xl mx-auto px-6 pb-28">
        <h2 className="font-display font-bold tracking-[-0.025em] text-[clamp(1.75rem,3.2vw,2.375rem)]">자주 묻는 질문</h2>
        <div className="mt-10 divide-y divide-line border-y border-line">
          {faqs.map((f, i) => (
            <div key={f.q}>
              <button
                onClick={() => setOpenFaq(openFaq === i ? null : i)}
                aria-expanded={openFaq === i}
                className="w-full py-5 flex items-center justify-between gap-4 text-left group"
              >
                <span className="text-[15px] font-medium group-hover:text-gold transition-colors">{f.q}</span>
                <ArrowUpRight
                  className={`w-4 h-4 text-dim shrink-0 transition-transform duration-300 ${openFaq === i ? 'rotate-90' : 'rotate-45'}`}
                />
              </button>
              {openFaq === i && (
                <p className="pb-6 text-sm text-mist leading-relaxed max-w-xl">{f.a}</p>
              )}
            </div>
          ))}
        </div>
      </section>

      {/* ── 푸터 ── */}
      <footer className="border-t border-line">
        <div className="max-w-6xl mx-auto px-6 py-10 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <Logo className="w-5 h-5 text-ink" />
            <span className="font-display font-bold text-sm">plAI-ground</span>
            <span className="text-[12px] text-dim">by MENOTIS</span>
          </div>
          <p className="text-[12px] text-dim">© 2026 plAI-ground. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
}

// ─── 콘솔 셸 — 랜딩과 동일한 TopBar를 그대로 쓴다 ─────────────────────────────
function ConsoleShell({ view, go, profile, onLogin, onLogout, children }) {
  return (
    <div className="min-h-screen bg-void text-ink">
      <TopBar view={view} go={go} profile={profile} onLogin={onLogin} onLogout={onLogout} />
      <main className="pt-32 md:pt-24">{children}</main>
    </div>
  );
}

// ─── 루트 ─────────────────────────────────────────────────────────────────────
export default function App() {
  const [view, setView] = useState('landing');
  const [authSession, setAuthSession] = useState(null); // Supabase 로그인 세션
  const [profile, setProfile] = useState(null); // profiles 행 — { role, display_name }
  const [session, setSession] = useState(null); // /api/setup ready 페이로드 (IDE 접속 정보)
  const [staged, setStaged] = useState(null); // 커뮤니티 '실습해보기'로 준비된 코드 정보
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((message) => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, message }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 3500);
  }, []);
  const removeToast = useCallback((id) => setToasts((prev) => prev.filter((t) => t.id !== id)), []);

  // 해시 라우팅 — 브라우저 뒤로가기/앞으로가기가 화면 전환과 함께 동작한다.
  // #/community/err-001 처럼 두 번째 세그먼트는 화면 파라미터(게시글 id 등)다.
  const [viewParam, setViewParam] = useState(null);
  useEffect(() => {
    const VIEWS = ['landing', 'start', 'ide', 'view', 'portfolio', 'community', 'lms'];
    const apply = () => {
      const [v, param] = window.location.hash.replace(/^#\/?/, '').split('/');
      setView(VIEWS.includes(v) ? v : 'landing');
      setViewParam(param || null);
    };
    apply();
    const onPop = () => withTransition(apply); // 뒤로가기/앞으로가기도 같은 전환
    window.addEventListener('popstate', onPop);
    return () => window.removeEventListener('popstate', onPop);
  }, []);

  const go = useCallback((v, param = null) => {
    const hash = v === 'landing' ? '#/' : `#/${v}${param ? `/${param}` : ''}`;
    if (window.location.hash !== hash) window.history.pushState(null, '', hash);
    withTransition(() => {
      setView(v);
      setViewParam(param);
      window.scrollTo(0, 0);
    });
  }, []);

  // Supabase 세션 구독 — 새로고침·OAuth 리다이렉트 복귀 모두 여기로 들어온다
  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setAuthSession(data.session));
    const { data: sub } = supabase.auth.onAuthStateChange((event, s) => {
      setAuthSession(s);
      if (event === 'SIGNED_IN') addToast('로그인했습니다.');
    });
    return () => sub.subscription.unsubscribe();
  }, [addToast]);

  // 세션이 바뀌면 api.js의 Authorization 헤더 공급자를 갱신하고 profiles를 읽는다
  useEffect(() => {
    setAccessTokenGetter(() => authSession?.access_token ?? null);
    if (!authSession) {
      setProfile(null);
      return;
    }
    let live = true;
    supabase
      .from('profiles')
      .select('role, display_name')
      .eq('id', authSession.user.id)
      .single()
      .then(({ data }) => { if (live && data) setProfile(data); });
    return () => { live = false; };
  }, [authSession]);

  const login = useCallback(() => {
    supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin },
    });
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setView((v) => (v === 'lms' ? 'start' : v));
    addToast('로그아웃했습니다.');
  }, [addToast]);

  // LMS는 교직원 전용 — 다른 역할로 접근하면 Start AI로 대체
  const isStaff = profile?.role === 'faculty' || profile?.role === 'admin';
  const effectiveView = view === 'lms' && !isStaff ? 'start' : view;

  return (
    <>
      {/* VT 미지원 브라우저는 화면 교체 시 래퍼를 리마운트해 등장 애니메이션으로 폴백 */}
      <div
        key={SUPPORTS_VT ? 'app' : `${effectiveView}/${viewParam ?? ''}`}
        className={SUPPORTS_VT ? undefined : 'vt-fallback'}
      >
        {effectiveView === 'landing' ? (
          <Landing go={go} profile={profile} onLogin={login} onLogout={logout} />
        ) : (
          <ConsoleShell view={effectiveView} go={go} profile={profile} onLogin={login} onLogout={logout}>
            {effectiveView === 'start' && <StartAI go={go} onSession={setSession} addToast={addToast} />}
            {effectiveView === 'ide' && <IdeView session={session} staged={staged} go={go} addToast={addToast} />}
            {effectiveView === 'community' && <Community go={go} postId={viewParam} onStaged={setStaged} addToast={addToast} />}
            {effectiveView === 'view' && <ViewAI addToast={addToast} />}
            {effectiveView === 'portfolio' && <PortfolioView addToast={addToast} />}
            {effectiveView === 'lms' && <Lms go={go} addToast={addToast} />}
          </ConsoleShell>
        )}
      </div>
      <Toasts toasts={toasts} remove={removeToast} />
    </>
  );
}
